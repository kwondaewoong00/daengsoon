import * as THREE from "three";
import type { Brazier } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 화로 하나의 불. 세 겹으로 되어 있습니다.
 *  1) 불꽃: 수백 개 입자가 아래에서 태어나 위로 올라가며 식어 사라짐. "돌풍(gust)"으로 세기가 출렁임
 *  2) 불똥: 가끔 "타닥" 하고 터지면서 밝은 점들이 튀어 올라 포물선을 그리며 떨어짐
 *  3) 연기: 불꽃 위로 천천히 올라가며 퍼지는 회색 입자
 * 그리고 흔들리는 빛(PointLight). 타닥 터질 때 빛도 살짝 튀고, onPop 으로 소리도 맞춥니다.
 */

let spriteTex: THREE.Texture | null = null;
function softSprite() {
  if (spriteTex) return spriteTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.65)");
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
const FRAG_ADD = /* glsl */ `
  uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor * t.a, t.a * vAlpha);
  }`;
const FRAG_SMOKE = /* glsl */ `
  uniform sampler2D uMap; varying float vAlpha; varying vec3 vColor;
  void main() {
    vec4 t = texture2D(uMap, gl_PointCoord);
    gl_FragColor = vec4(vColor, t.a * vAlpha);
  }`;

/** 입자 묶음 하나(위치·색·크기·알파 버퍼 + Points) */
class Cloud {
  readonly points: THREE.Points;
  readonly pos: Float32Array;
  readonly col: Float32Array;
  readonly size: Float32Array;
  readonly alpha: Float32Array;
  readonly life: Float32Array;
  readonly max: Float32Array;
  readonly vel: Float32Array;
  constructor(readonly n: number, additive: boolean) {
    this.pos = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.alpha = new Float32Array(n);
    this.life = new Float32Array(n);
    this.max = new Float32Array(n).fill(1);
    this.vel = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: softSprite() } },
      vertexShader: VERT,
      fragmentShader: additive ? FRAG_ADD : FRAG_SMOKE,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }
  dirty() {
    const g = this.points.geometry;
    for (const k of ["position", "aColor", "aSize", "aAlpha"]) (g.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }
}

export class Fire3D {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  /** 타닥 터질 때 호출(소리 동기화용). strength 0~1 */
  onPop: ((strength: number) => void) | null = null;

  private flames: Cloud;
  private sparks: Cloud;
  private smoke: Cloud;
  private glow: THREE.Sprite;
  private scale: number;
  private flash = 0;
  private flashColor = new THREE.Color("#fff");
  private baseIntensity: number;
  private t = 0;
  private flameAcc = 0;
  private smokeAcc = 0;
  private nextPop = 0.5 + Math.random();
  private popKick = 0;
  private sparkCursor = 0;

  constructor(readonly brazier: Brazier) {
    const large = brazier.size === "large";
    this.scale = large ? 1 : 0.55;
    this.flames = new Cloud(large ? 260 : 130, true);
    this.sparks = new Cloud(large ? 90 : 45, true);
    this.smoke = new Cloud(large ? 36 : 18, false);
    // 처음부터 타고 있던 것처럼
    for (let i = 0; i < this.flames.n; i++) this.spawnFlame(i, Math.random());
    for (let i = 0; i < this.smoke.n; i++) this.spawnSmoke(i, Math.random());
    this.sparks.alpha.fill(0);
    this.sparks.life.fill(9);
    this.group.add(this.flames.points, this.sparks.points, this.smoke.points);

    // 숯불 바닥의 벌건 빛
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: softSprite(), color: 0xff6a1a, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.scale.setScalar(1.3 * this.scale);
    this.glow.position.y = 0.12 * this.scale;
    this.group.add(this.glow);

    this.baseIntensity = large ? 9 : 4;
    this.light = new THREE.PointLight(0xff9a3c, this.baseIntensity, 14 * this.scale + 4, 1.6);
    this.light.position.set(0, 0.6 * this.scale, 0);
    this.group.add(this.light);
    this.group.position.set(brazier.x * S, 0, brazier.y * S);
  }

  burn(color: string) {
    this.flash = 1;
    this.flashColor.set(color);
    this.pop(1);
  }

  // ---------- 생성 ----------
  private spawnFlame(i: number, lifeK = 0) {
    const f = this.flames, s = this.scale;
    const off = (Math.random() - 0.5) * 2 * Math.sqrt(Math.random());
    const ang = Math.random() * Math.PI * 2;
    const r = Math.abs(off) * 0.3 * s;
    f.pos[i * 3] = Math.cos(ang) * r;
    f.pos[i * 3 + 1] = 0.08 * s + Math.random() * 0.08;
    f.pos[i * 3 + 2] = Math.sin(ang) * r;
    f.vel[i * 3] = -Math.cos(ang) * r * 1.1 + (Math.random() - 0.5) * 0.12;
    f.vel[i * 3 + 1] = (1.0 + Math.random() * 1.3) * s;
    f.vel[i * 3 + 2] = -Math.sin(ang) * r * 1.1 + (Math.random() - 0.5) * 0.12;
    f.max[i] = (0.6 + Math.random() * 0.85) * (1 - Math.abs(off) * 0.45);
    f.life[i] = f.max[i] * lifeK;
    f.size[i] = (0.34 + Math.random() * 0.42) * s * (1 - Math.abs(off) * 0.4);
  }
  private spawnSmoke(i: number, lifeK = 0) {
    const m = this.smoke, s = this.scale;
    m.pos[i * 3] = (Math.random() - 0.5) * 0.25 * s;
    m.pos[i * 3 + 1] = (0.9 + Math.random() * 0.4) * s;
    m.pos[i * 3 + 2] = (Math.random() - 0.5) * 0.25 * s;
    m.vel[i * 3] = (Math.random() - 0.5) * 0.1;
    m.vel[i * 3 + 1] = 0.35 + Math.random() * 0.3;
    m.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
    m.max[i] = 2.5 + Math.random() * 2.5;
    m.life[i] = m.max[i] * lifeK;
    m.size[i] = (0.5 + Math.random() * 0.5) * s;
  }
  /** 타닥: 불똥 몇 개를 튀김 */
  private pop(strength: number) {
    const k = this.sparks, s = this.scale;
    const count = Math.round((2 + Math.random() * 6) * (0.5 + strength));
    for (let j = 0; j < count; j++) {
      const i = this.sparkCursor;
      this.sparkCursor = (this.sparkCursor + 1) % k.n;
      const ang = Math.random() * Math.PI * 2;
      const r = Math.random() * 0.22 * s;
      k.pos[i * 3] = Math.cos(ang) * r;
      k.pos[i * 3 + 1] = (0.2 + Math.random() * 0.3) * s;
      k.pos[i * 3 + 2] = Math.sin(ang) * r;
      const spread = 0.5 + strength * 0.8;
      k.vel[i * 3] = (Math.random() - 0.5) * spread;
      k.vel[i * 3 + 1] = (1.4 + Math.random() * 1.8) * (0.7 + strength * 0.5) * s;
      k.vel[i * 3 + 2] = (Math.random() - 0.5) * spread;
      k.max[i] = 0.7 + Math.random() * 1.3;
      k.life[i] = 0;
      k.size[i] = 0.045 + Math.random() * 0.05;
    }
    this.popKick = Math.max(this.popKick, 0.35 + strength * 0.5);
    this.onPop?.(strength);
  }

  // ---------- 매 프레임 ----------
  update(dt: number) {
    this.t += dt;
    const t = this.t;
    this.flash = Math.max(0, this.flash - dt * 0.7);
    this.popKick = Math.max(0, this.popKick - dt * 3);

    // 돌풍: 불이 커졌다 작아졌다 출렁임 + 옆으로 쏠림
    const gust = 0.75 + 0.2 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.3 + 1.3) + 0.08 * Math.sin(t * 5.1);
    const swayX = Math.sin(t * 1.7) * 0.35 + Math.sin(t * 0.6) * 0.2;
    const swayZ = Math.cos(t * 1.3) * 0.25;
    const power = gust + this.flash * 0.9;

    // 1) 불꽃
    const f = this.flames;
    const speedUp = 1 + this.flash * 0.8;
    for (let i = 0; i < f.n; i++) {
      f.life[i] += dt * speedUp;
      if (f.life[i] >= f.max[i]) this.spawnFlame(i, 0);
      const k = f.life[i] / f.max[i];
      const y = f.pos[i * 3 + 1];
      // 위로 갈수록 바람에 더 휩쓸림 + 작은 난류
      f.vel[i * 3] += (swayX * y + Math.sin(t * 6 + y * 4 + i) * 0.35) * dt;
      f.vel[i * 3 + 2] += (swayZ * y + Math.cos(t * 5 + y * 3 + i * 0.7) * 0.3) * dt;
      f.pos[i * 3] += f.vel[i * 3] * dt;
      f.pos[i * 3 + 1] += f.vel[i * 3 + 1] * dt * power * speedUp;
      f.pos[i * 3 + 2] += f.vel[i * 3 + 2] * dt;
      // 크기: 태어나서 잠깐 커졌다가 작아짐. 알파: 서서히 사라짐
      const grow = k < 0.25 ? 0.7 + k * 1.2 : 1 - (k - 0.25) * 0.9;
      f.alpha[i] = (1 - k) * 0.85 * grow;
      const flashing = this.flash > 0.05 && k < 0.5;
      if (flashing) {
        const m = 1.2 + this.flash;
        f.col[i * 3] = this.flashColor.r * m; f.col[i * 3 + 1] = this.flashColor.g * m; f.col[i * 3 + 2] = this.flashColor.b * m;
      } else {
        f.col[i * 3] = 1.7;
        f.col[i * 3 + 1] = 1.0 - k * 0.8;
        f.col[i * 3 + 2] = 0.3 - k * 0.3;
      }
    }
    f.dirty();

    // 2) 불똥: 타닥
    this.nextPop -= dt * (0.8 + gust * 0.4);
    if (this.nextPop <= 0) {
      const strength = Math.random() < 0.2 ? 0.8 + Math.random() * 0.2 : Math.random() * 0.5;
      this.pop(strength);
      this.nextPop = 0.25 + Math.random() * (strength > 0.7 ? 2.5 : 1.3);
    }
    if (Math.random() < 0.08 * this.scale) this.trickle(); // 가끔 한 알씩
    const k = this.sparks;
    for (let i = 0; i < k.n; i++) {
      if (k.life[i] >= k.max[i]) { k.alpha[i] = 0; continue; }
      k.life[i] += dt;
      const a = k.life[i] / k.max[i];
      k.vel[i * 3 + 1] -= 2.6 * dt; // 중력
      k.vel[i * 3] += (swayX * 0.6 + Math.sin(t * 9 + i) * 0.6) * dt;
      k.vel[i * 3 + 2] += (swayZ * 0.6 + Math.cos(t * 7 + i) * 0.6) * dt;
      k.pos[i * 3] += k.vel[i * 3] * dt;
      k.pos[i * 3 + 1] += k.vel[i * 3 + 1] * dt;
      k.pos[i * 3 + 2] += k.vel[i * 3 + 2] * dt;
      if (k.pos[i * 3 + 1] < 0.05) { k.life[i] = k.max[i]; k.alpha[i] = 0; continue; }
      // 깜빡이며 식음: 노랑 → 주황 → 검붉음
      const flick = 0.7 + 0.3 * Math.sin(t * 40 + i * 3);
      k.alpha[i] = (1 - a) * flick;
      k.col[i * 3] = 2.2;
      k.col[i * 3 + 1] = 1.4 - a * 1.2;
      k.col[i * 3 + 2] = 0.5 - a * 0.5;
    }
    k.dirty();

    // 3) 연기
    const m = this.smoke;
    for (let i = 0; i < m.n; i++) {
      m.life[i] += dt;
      if (m.life[i] >= m.max[i]) this.spawnSmoke(i, 0);
      const a = m.life[i] / m.max[i];
      m.vel[i * 3] += (swayX * 0.4 + Math.sin(t * 0.8 + i) * 0.15) * dt;
      m.vel[i * 3 + 2] += (swayZ * 0.4 + Math.cos(t * 0.7 + i) * 0.15) * dt;
      m.pos[i * 3] += m.vel[i * 3] * dt;
      m.pos[i * 3 + 1] += m.vel[i * 3 + 1] * dt;
      m.pos[i * 3 + 2] += m.vel[i * 3 + 2] * dt;
      m.size[i] += dt * 0.35 * this.scale;
      m.alpha[i] = Math.sin(a * Math.PI) * 0.13;
      const g = 0.22 + a * 0.1;
      m.col[i * 3] = g; m.col[i * 3 + 1] = g; m.col[i * 3 + 2] = g + 0.02;
    }
    m.dirty();

    // 빛: 저주파 흔들림 + 고주파 떨림 + 타닥 튐 + 플래시
    const flicker = 0.82 + 0.1 * gust + Math.sin(t * 11) * 0.05 + Math.sin(t * 23.7) * 0.04 + Math.random() * 0.03;
    this.light.intensity = this.baseIntensity * flicker * (1 + this.flash * 1.4 + this.popKick * 0.5);
    this.light.color.lerpColors(new THREE.Color(0xff9a3c), this.flashColor, this.flash * 0.7);
    this.light.position.x = swayX * 0.08;
    this.light.position.z = swayZ * 0.08;
    (this.glow.material as THREE.SpriteMaterial).opacity = 0.35 + 0.15 * gust + this.popKick * 0.2;
  }

  private trickle() {
    const k = this.sparks;
    const i = this.sparkCursor;
    this.sparkCursor = (this.sparkCursor + 1) % k.n;
    const ang = Math.random() * Math.PI * 2, r = Math.random() * 0.2 * this.scale;
    k.pos[i * 3] = Math.cos(ang) * r; k.pos[i * 3 + 1] = 0.3 * this.scale; k.pos[i * 3 + 2] = Math.sin(ang) * r;
    k.vel[i * 3] = (Math.random() - 0.5) * 0.3; k.vel[i * 3 + 1] = (1.0 + Math.random() * 1.2) * this.scale; k.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
    k.max[i] = 1.2 + Math.random() * 1.5; k.life[i] = 0; k.size[i] = 0.04 + Math.random() * 0.03;
  }
}
