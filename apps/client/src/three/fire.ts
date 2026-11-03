import * as THREE from "three";
import type { Brazier } from "@daengsoon/shared";
import { S } from "./config";

const COUNT_LARGE = 220;
const COUNT_SMALL = 110;

let spriteTex: THREE.Texture | null = null;
function softSprite() {
  if (spriteTex) return spriteTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  spriteTex = new THREE.CanvasTexture(c);
  return spriteTex;
}

const VERT = /* glsl */ `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
  varying float vAlpha; varying vec3 vColor;
  void main() {
    vAlpha = aAlpha; vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.a, t.a * vAlpha);
  }`;

/**
 * 화로 하나의 불. 입자(Points) 수백 개가 아래에서 태어나 위로 올라가며 식어 사라집니다.
 * 2D 때와 같은 원리지만, 이제 진짜 빛(PointLight)을 내서 주변 사람과 땅을 비춥니다.
 */
export class Fire3D {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  private points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private life: Float32Array;
  private max: Float32Array;
  private vel: Float32Array;
  private count: number;
  private scale: number;
  private flash = 0;
  private flashColor = new THREE.Color("#fff");
  private baseIntensity: number;
  private t = 0;

  constructor(readonly brazier: Brazier) {
    this.scale = brazier.size === "large" ? 1 : 0.55;
    this.count = brazier.size === "large" ? COUNT_LARGE : COUNT_SMALL;
    const n = this.count;
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n);
    this.vel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.respawn(i, Math.random());

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softSprite() } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    this.baseIntensity = brazier.size === "large" ? 9 : 4;
    this.light = new THREE.PointLight(0xff9a3c, this.baseIntensity, 14 * this.scale + 4, 1.6);
    this.light.position.set(0, 0.5 * this.scale, 0);
    this.group.add(this.light);

    this.group.position.set(brazier.x * S, 0, brazier.y * S);
  }

  burn(color: string) {
    this.flash = 1;
    this.flashColor.set(color);
  }

  private respawn(i: number, lifeK = 0) {
    const s = this.scale;
    const off = (Math.random() - 0.5) * 2 * Math.sqrt(Math.random());
    const ang = Math.random() * Math.PI * 2;
    const r = Math.abs(off) * 0.32 * s;
    this.pos[i * 3] = Math.cos(ang) * r;
    this.pos[i * 3 + 1] = 0.1 * s + Math.random() * 0.1;
    this.pos[i * 3 + 2] = Math.sin(ang) * r;
    this.vel[i * 3] = -Math.cos(ang) * r * 0.9 + (Math.random() - 0.5) * 0.15;
    this.vel[i * 3 + 1] = (0.9 + Math.random() * 0.9) * s;
    this.vel[i * 3 + 2] = -Math.sin(ang) * r * 0.9 + (Math.random() - 0.5) * 0.15;
    this.max[i] = (0.6 + Math.random() * 0.7) * (1 - Math.abs(off) * 0.45);
    this.life[i] = this.max[i] * lifeK;
    this.size[i] = (0.35 + Math.random() * 0.35) * s * (1 - Math.abs(off) * 0.4);
  }

  update(dt: number) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 0.7);
    const wind = Math.sin(this.t * 0.7) * 0.12;
    const speedUp = 1 + this.flash * 0.8;
    for (let i = 0; i < this.count; i++) {
      this.life[i] += dt * speedUp;
      if (this.life[i] >= this.max[i]) this.respawn(i, 0);
      const k = this.life[i] / this.max[i];
      this.vel[i * 3] += (wind + Math.sin(this.t * 5 + this.pos[i * 3 + 1] * 3) * 0.25) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt * speedUp;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      // 색: 어릴 땐 노랗게, 늙으면 빨갛게. 플래시 중엔 지정 색으로.
      const a = (1 - k) * 0.9;
      this.alpha[i] = a;
      if (this.flash > 0.05 && k < 0.5) {
        this.col[i * 3] = this.flashColor.r * (1.2 + this.flash);
        this.col[i * 3 + 1] = this.flashColor.g * (1.2 + this.flash);
        this.col[i * 3 + 2] = this.flashColor.b * (1.2 + this.flash);
      } else {
        this.col[i * 3] = 1.6;
        this.col[i * 3 + 1] = 0.9 - k * 0.7;
        this.col[i * 3 + 2] = 0.25 - k * 0.25;
      }
      this.size[i] = this.size[i]; // 크기는 고정, 알파로 사라짐
    }
    const geo = this.points.geometry;
    (geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;

    // 빛 흔들림 + 플래시
    const flicker = 0.85 + Math.sin(this.t * 11) * 0.06 + Math.sin(this.t * 23.7) * 0.05 + Math.random() * 0.04;
    this.light.intensity = this.baseIntensity * flicker * (1 + this.flash * 1.4);
    this.light.color.lerpColors(new THREE.Color(0xff9a3c), this.flashColor, this.flash * 0.7);
  }
}
