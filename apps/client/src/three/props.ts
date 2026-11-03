import * as THREE from "three";
import { BRAZIERS, SEATS, WORLD, type Brazier, type SceneKind, type Seat } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 캠프 소품들을 기본 도형으로 깎습니다(저폴리). A1 캐릭터와 결이 맞도록 단순하게.
 * 화로(돌 둘레 + 장작), 그루터기 의자, 나무, 먼 산, 바다.
 */
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a5149, roughness: 0.95, flatShading: true });
const stoneMat2 = new THREE.MeshStandardMaterial({ color: 0x46403a, roughness: 0.95, flatShading: true });
const logMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1b, roughness: 0.9 });
const charMat = new THREE.MeshStandardMaterial({ color: 0x120c08, roughness: 1 });
const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2724, roughness: 0.6, metalness: 0.5 });
const stumpMat = new THREE.MeshStandardMaterial({ color: 0x5b3f26, roughness: 0.95 });
const stumpTopMat = new THREE.MeshStandardMaterial({ color: 0x9a7a52, roughness: 0.9 });
const stumpHoverMat = new THREE.MeshStandardMaterial({ color: 0xd9a66a, emissive: 0xff9a3c, emissiveIntensity: 0.5, roughness: 0.9 });

export function makeBrazier(b: Brazier): THREE.Group {
  const g = new THREE.Group();
  if (b.size === "large") {
    const n = 13;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + Math.random() * 0.06, 0), i % 3 ? stoneMat : stoneMat2);
      stone.position.set(Math.cos(a) * 0.82, 0.1, Math.sin(a) * 0.82);
      stone.rotation.set(Math.random(), Math.random(), Math.random());
      stone.scale.y = 0.7;
      g.add(stone);
    }
    const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 16), charMat);
    bed.position.y = 0.03;
    g.add(bed);
    // 숯불: 벌겋게 빛나는 알갱이들
    const coalGeo = new THREE.DodecahedronGeometry(0.06, 0);
    for (let i = 0; i < 22; i++) {
      const heat = Math.random();
      const coal = new THREE.Mesh(coalGeo, new THREE.MeshStandardMaterial({ color: 0x3a1a0a, emissive: new THREE.Color().setHSL(0.04 + heat * 0.04, 1, 0.3 + heat * 0.25), emissiveIntensity: 0.8 + heat, roughness: 1 }));
      const a = Math.random() * Math.PI * 2, r = Math.random() * 0.5;
      coal.position.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      coal.rotation.set(Math.random(), Math.random(), Math.random());
      coal.scale.setScalar(0.7 + Math.random() * 0.8);
      coal.name = "coal";
      g.add(coal);
    }
    for (const r of [-0.4, 0.5, 0.05, 1.3]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 1.0, 7), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = r;
      log.position.y = 0.12 + Math.abs(Math.sin(r)) * 0.05;
      g.add(log);
    }
  } else {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.26, 12, 1, true), ironMat);
    bowl.position.y = 0.3;
    bowl.material = ironMat.clone();
    (bowl.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    g.add(bowl);
    const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 12), charMat);
    bottom.position.y = 0.18;
    g.add(bottom);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 5), ironMat);
      leg.position.set(Math.cos(a) * 0.22, 0.15, Math.sin(a) * 0.22);
      leg.rotation.z = Math.cos(a) * 0.25;
      leg.rotation.x = -Math.sin(a) * 0.25;
      g.add(leg);
    }
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 6), logMat);
    log.rotation.z = Math.PI / 2;
    log.position.y = 0.26;
    g.add(log);
  }
  g.position.set(b.x * S, 0, b.y * S);
  return g;
}

export class Stump {
  readonly mesh: THREE.Group;
  private top: THREE.Mesh;
  constructor(readonly seat: Seat) {
    this.mesh = new THREE.Group();
    const side = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.36, 10), stumpMat);
    side.position.y = 0.18;
    this.top = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.02, 10), stumpTopMat);
    this.top.position.y = 0.37;
    this.mesh.add(side, this.top);
    this.mesh.position.set(seat.x * S, 0, seat.y * S);
    this.mesh.rotation.y = Math.random() * Math.PI;
  }
  setHover(on: boolean) {
    this.top.material = on ? stumpHoverMat : stumpTopMat;
  }
  setVisible(v: boolean) {
    this.mesh.visible = v;
  }
}

export function makeStumps(): Stump[] {
  return SEATS.map((s) => new Stump(s));
}

export function makeBraziers(): THREE.Group[] {
  return BRAZIERS.map(makeBrazier);
}

/** 풀·나뭇잎이 공유하는 바람 시계 */
export const windUniform = { value: 0 };

/** 풀잎 텍스처: 캔버스에 잎 몇 가닥을 그려 알파 스프라이트로 */
let grassTex: THREE.Texture | null = null;
function grassTexture() {
  if (grassTex) return grassTex;
  const c = document.createElement("canvas");
  c.width = 64; c.height = 64;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 7; i++) {
    const x0 = 8 + i * 8 + (Math.random() - 0.5) * 4;
    const h = 30 + Math.random() * 30;
    const lean = (Math.random() - 0.5) * 18;
    const grd = g.createLinearGradient(0, 64, 0, 64 - h);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(1, "rgba(255,255,255,0.95)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(x0 - 2.5, 64);
    g.quadraticCurveTo(x0 + lean * 0.4, 64 - h * 0.6, x0 + lean, 64 - h);
    g.quadraticCurveTo(x0 + lean * 0.4 + 1, 64 - h * 0.6, x0 + 2.5, 64);
    g.closePath();
    g.fill();
  }
  grassTex = new THREE.CanvasTexture(c);
  return grassTex;
}

/**
 * 땅 위 장식: 풀 포기(인스턴스), 덤불, 돌멩이, 화로 옆 돌탑.
 * InstancedMesh = 같은 모양을 수천 개 그릴 때 한 번의 그리기 명령으로 끝내는 기법(폰에 중요).
 */
export function makeGroundDressing(kind: SceneKind): THREE.Group & { grass?: THREE.InstancedMesh[] } {
  const g = new THREE.Group();
  const W = WORLD.w * S, H = WORLD.h * S;
  const margin = 7;
  const avoid = (x: number, z: number) => {
    for (const b of BRAZIERS) if (Math.hypot(b.x * S - x, b.y * S - z) < (b.size === "large" ? 1.5 : 1.0)) return true;
    for (const st of SEATS) if (Math.hypot(st.x * S - x, st.y * S - z) < 0.5) return true;
    return false;
  };
  const rnd = (a: number, b: number) => a + Math.random() * (b - a);

  // --- 풀 ---
  const count = kind === "mountain" ? 2200 : 260;
  const plane = new THREE.PlaneGeometry(0.42, 0.34);
  plane.translate(0, 0.17, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1,
    color: kind === "mountain" ? 0x7fa548 : 0xb9b47a,
  });
  // 바람: 꼭짓점 셰이더에서 윗부분(uv.y 큰 쪽)만 좌우로 흔듦. 위치마다 위상이 달라 파도처럼 지나감
  grassMat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = windUniform;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        {
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float ph = wp.x * 0.35 + wp.z * 0.25;
          float sway = sin(uTime * 1.3 + ph) * 0.6 + sin(uTime * 2.9 + ph * 2.1) * 0.25;
          float k = uv.y * uv.y;
          transformed.x += sway * 0.06 * k;
          transformed.z += sin(uTime * 1.1 + ph * 1.7) * 0.03 * k;
        }`);
  };
  const a = new THREE.InstancedMesh(plane, grassMat, count);
  const b = new THREE.InstancedMesh(plane, grassMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
  const col = new THREE.Color();
  const palette = kind === "mountain" ? [0x6f9a3c, 0x86ad4a, 0x9bb65a, 0xb7a94a, 0x7f8f3a] : [0xb8b47c, 0xa7a06a, 0xc8c28a];
  let placed = 0, tries = 0;
  while (placed < count && tries < count * 4) {
    tries++;
    const x = rnd(-margin, W + margin), z = rnd(-margin, H + margin);
    if (avoid(x, z)) continue;
    const yaw = Math.random() * Math.PI;
    const sc = rnd(0.7, 1.5) * (kind === "sea" ? 0.7 : 1);
    pos.set(x, 0, z); scl.set(sc, sc * rnd(0.8, 1.3), sc);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    a.setMatrixAt(placed, m.compose(pos, q, scl));
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw + Math.PI / 2);
    b.setMatrixAt(placed, m.compose(pos, q, scl));
    col.setHex(palette[Math.floor(Math.random() * palette.length)]);
    a.setColorAt(placed, col); b.setColorAt(placed, col);
    placed++;
  }
  a.count = placed; b.count = placed;
  g.add(a, b);
  (g as THREE.Group & { grass?: THREE.InstancedMesh[] }).grass = [a, b];

  // --- 덤불 ---
  if (kind === "mountain") {
    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    const bp = bushGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(bp, i).multiplyScalar(0.85 + Math.random() * 0.3);
      bp.setXYZ(i, v.x, v.y, v.z);
    }
    bushGeo.computeVertexNormals();
    const bushMats = [0x3f6b2e, 0x4b7a33, 0x5a8a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    for (let i = 0; i < 40; i++) {
      let x = 0, z = 0, ok = false;
      for (let t = 0; t < 10 && !ok; t++) { x = rnd(-margin, W + margin); z = rnd(-margin, H + margin); ok = !avoid(x, z) && Math.hypot(x - W / 2, z - H / 2) > 4; }
      if (!ok) continue;
      const bush = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) {
        const mesh = new THREE.Mesh(bushGeo, bushMats[(i + j) % bushMats.length]);
        const r = rnd(0.3, 0.6);
        mesh.position.set(rnd(-0.3, 0.3), r * 0.8, rnd(-0.3, 0.3));
        mesh.scale.set(r, r * 0.8, r);
        bush.add(mesh);
      }
      bush.position.set(x, 0, z);
      g.add(bush);
    }
  }

  // --- 돌멩이 ---
  const rockMat = new THREE.MeshStandardMaterial({ color: kind === "sea" ? 0x8a8378 : 0x7d7468, roughness: 0.95 });
  const rockGeo = new THREE.DodecahedronGeometry(1, 1);
  for (let i = 0; i < 70; i++) {
    const x = rnd(-margin, W + margin), z = rnd(-margin, H + margin);
    if (avoid(x, z)) continue;
    const r = rnd(0.05, 0.16);
    const rock = new THREE.Mesh(rockGeo, rockMat);
    rock.position.set(x, r * 0.5, z);
    rock.scale.set(r, r * 0.6, r * rnd(0.8, 1.3));
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    g.add(rock);
  }

  // --- 돌탑: 큰 화로 근처에 하나씩 ---
  const cairnMat = new THREE.MeshStandardMaterial({ color: 0x8d8478, roughness: 0.95 });
  for (const br of BRAZIERS) {
    if (br.size !== "large") continue;
    const ang = Math.random() * Math.PI * 2;
    const cx = br.x * S + Math.cos(ang) * 2.4, cz = br.y * S + Math.sin(ang) * 2.4;
    let y = 0;
    const n = 4 + Math.floor(Math.random() * 3);
    for (let j = 0; j < n; j++) {
      const r = 0.22 - j * 0.03;
      const h = 0.09 + Math.random() * 0.05;
      const stone = new THREE.Mesh(rockGeo, cairnMat);
      stone.position.set(cx + rnd(-0.03, 0.03), y + h / 2, cz + rnd(-0.03, 0.03));
      stone.scale.set(r, h / 2, r * rnd(0.85, 1.15));
      stone.rotation.y = Math.random() * Math.PI;
      g.add(stone);
      y += h * 0.9;
    }
  }
  return g;
}

/**
 * 공중에 떠다니는 빛. 산: 반딧불(초록, 느리게 깜빡). 공통: 불티(주황, 화로 위에서 높이 올라감).
 * 작은 Points 하나로 처리하고 매 프레임 위치만 갱신합니다.
 */
export class Motes {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private seed: Float32Array;
  private isFirefly: Uint8Array;
  private n: number;
  constructor(kind: SceneKind) {
    this.n = kind === "mountain" ? 160 : 70;
    this.pos = new Float32Array(this.n * 3);
    this.seed = new Float32Array(this.n * 4);
    this.isFirefly = new Uint8Array(this.n);
    const col = new Float32Array(this.n * 3);
    const W = WORLD.w * S, H = WORLD.h * S;
    for (let i = 0; i < this.n; i++) {
      const firefly = kind === "mountain" && i < 100;
      this.isFirefly[i] = firefly ? 1 : 0;
      if (firefly) {
        this.seed[i * 4] = Math.random() * W; this.seed[i * 4 + 1] = 0.4 + Math.random() * 1.6; this.seed[i * 4 + 2] = Math.random() * H;
        col[i * 3] = 0.75; col[i * 3 + 1] = 1.0; col[i * 3 + 2] = 0.45;
      } else {
        const b = BRAZIERS[i % BRAZIERS.length];
        this.seed[i * 4] = b.x * S; this.seed[i * 4 + 1] = 1 + Math.random() * 4; this.seed[i * 4 + 2] = b.y * S;
        col[i * 3] = 1.0; col[i * 3 + 1] = 0.6; col[i * 3 + 2] = 0.25;
      }
      this.seed[i * 4 + 3] = Math.random() * 100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.09, map: glowTexture(), vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.update(0);
  }
  update(t: number) {
    for (let i = 0; i < this.n; i++) {
      const sx = this.seed[i * 4], sy = this.seed[i * 4 + 1], sz = this.seed[i * 4 + 2], ph = this.seed[i * 4 + 3];
      if (this.isFirefly[i]) {
        this.pos[i * 3] = sx + Math.sin(t * 0.25 + ph) * 1.6 + Math.sin(t * 0.9 + ph * 2) * 0.3;
        this.pos[i * 3 + 1] = sy + Math.sin(t * 0.5 + ph) * 0.35;
        this.pos[i * 3 + 2] = sz + Math.cos(t * 0.2 + ph) * 1.6;
      } else {
        // 불티: 화로 위에서 나선으로 천천히 올라가다 다시 아래에서
        const life = ((t * 0.18 + ph) % 1);
        const r = 0.2 + life * 1.4;
        this.pos[i * 3] = sx + Math.cos(t * 0.8 + ph * 3) * r;
        this.pos[i * 3 + 1] = 0.8 + life * sy;
        this.pos[i * 3 + 2] = sz + Math.sin(t * 0.8 + ph * 3) * r;
      }
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
}

/** 둥근 빛 스프라이트(랜턴·전구·텐트 창 발광용) */
let glowTex: THREE.Texture | null = null;
function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.25, "rgba(255,255,255,0.5)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

/**
 * 캠프 소품: 텐트 4동(안에서 따뜻한 빛), 기둥 사이 줄전구, 그루터기 옆 랜턴.
 * 진짜 조명(PointLight)은 폰에 부담이라 '빛나는 재질 + 글로우 스프라이트'로 빛나는 척만 합니다.
 */
export class CampDecor {
  readonly group = new THREE.Group();
  private bulbs: THREE.Points | null = null;
  private tentGlows: THREE.Sprite[] = [];
  private lanternGlows: THREE.Sprite[] = [];
  constructor(kind: SceneKind) {
    const W = WORLD.w * S, H = WORLD.h * S, cx = W / 2;
    const canvasMat = new THREE.MeshStandardMaterial({ color: kind === "sea" ? 0x7a8da0 : 0x8a7a52, roughness: 1, side: THREE.DoubleSide });
    const canvasLit = new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xff9a3c, emissiveIntensity: 0.9, roughness: 1, side: THREE.DoubleSide });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    // --- 텐트: 캠프 네 모서리 바깥 ---
    const tentGeo = new THREE.ConeGeometry(1.3, 1.5, 4, 1, true);
    const doorGeo = new THREE.PlaneGeometry(0.7, 0.9);
    for (const [tx, tz, ry] of [[3, 5, 0.3], [W - 3, 5, -0.4], [3, H - 3, 1.2], [W - 3, H - 3, -1.1]] as const) {
      const t = new THREE.Group();
      const body = new THREE.Mesh(tentGeo, canvasMat);
      body.position.y = 0.75;
      body.rotation.y = Math.PI / 4;
      const door = new THREE.Mesh(doorGeo, canvasLit);
      door.position.set(0, 0.42, 0.92);
      door.rotation.x = -0.55;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.set(0, 0.5, 1.0);
      glow.scale.setScalar(2.2);
      this.tentGlows.push(glow);
      t.add(body, door, glow);
      t.position.set(tx, 0, tz);
      t.rotation.y = ry + Math.atan2(cx - tx, H / 2 - tz); // 문이 캠프 안쪽을 향하게
      this.group.add(t);
    }
    // --- 줄전구: 기둥 6개를 캠프 둘레에 세우고 사이를 늘어진 줄로 연결 ---
    const poles: [number, number][] = [[W * 0.18, 2.2], [W * 0.5, 1.6], [W * 0.82, 2.2], [W * 0.82, H - 1.4], [W * 0.5, H - 0.8], [W * 0.18, H - 1.4]];
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.07, 3.4, 6);
    const positions: number[] = [];
    const wireMat = new THREE.LineBasicMaterial({ color: 0x1a1410 });
    for (let i = 0; i < poles.length; i++) {
      const [px, pz] = poles[i];
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(px, 1.7, pz);
      this.group.add(pole);
      const [qx, qz] = poles[(i + 1) % poles.length];
      if (i === 2 || i === 5) continue; // 양 옆(동서)은 비워 둠: 캠프를 가로막지 않게
      const pts: THREE.Vector3[] = [];
      const n = 14;
      for (let j = 0; j <= n; j++) {
        const k = j / n;
        const sag = Math.sin(k * Math.PI) * 0.55;
        const x = px + (qx - px) * k, z = pz + (qz - pz) * k, y = 3.3 - sag;
        pts.push(new THREE.Vector3(x, y, z));
        if (j > 0 && j < n) positions.push(x, y - 0.08, z);
      }
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireMat));
    }
    const bulbGeo = new THREE.BufferGeometry();
    bulbGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    const bulbMat = new THREE.PointsMaterial({ size: 0.07, map: glowTexture(), color: 0xffd9a0, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.bulbs = new THREE.Points(bulbGeo, bulbMat);
    this.group.add(this.bulbs);
    // --- 랜턴: 큰 화로 옆 그루터기 하나씩 ---
    const lanternBody = new THREE.CylinderGeometry(0.09, 0.11, 0.22, 8);
    const lanternCap = new THREE.ConeGeometry(0.13, 0.08, 8);
    const metal = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xffe0a8, emissive: 0xffb860, emissiveIntensity: 1.2, roughness: 0.3 });
    for (const b of BRAZIERS) {
      if (b.size !== "large") continue;
      const seat = b.seats[1];
      const lx = seat.x * S - 0.55, lz = seat.y * S + 0.2;
      const l = new THREE.Group();
      const body = new THREE.Mesh(lanternBody, glass);
      body.position.y = 0.11;
      const cap = new THREE.Mesh(lanternCap, metal);
      cap.position.y = 0.26;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 8), metal);
      base.position.y = 0.01;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffc070, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
      glow.position.y = 0.12;
      glow.scale.setScalar(0.9);
      this.lanternGlows.push(glow);
      l.add(base, body, cap, glow);
      l.position.set(lx, 0, lz);
      this.group.add(l);
    }
  }
  /** 장작 더미(큰 화로 옆), 이정표, 바다엔 보트·부표·조개 */
  static props(kind: SceneKind, roomLabel: string): THREE.Group {
    const g = new THREE.Group();
    const W = WORLD.w * S, H = WORLD.h * S;
    const logMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 1 });
    const logEnd = new THREE.MeshStandardMaterial({ color: 0xb08a5a, roughness: 1 });
    const logGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.7, 8);
    for (const b of BRAZIERS) {
      if (b.size !== "large") continue;
      const pile = new THREE.Group();
      for (let row = 0; row < 3; row++) for (let i = 0; i < 4 - row; i++) {
        const log = new THREE.Mesh(logGeo, [logMat, logEnd, logEnd]);
        log.rotation.z = Math.PI / 2;
        log.position.set(i * 0.19 + row * 0.095 - 0.3, 0.09 + row * 0.16, (Math.random() - 0.5) * 0.04);
        pile.add(log);
      }
      const seat = b.seats[3];
      pile.position.set(seat.x * S + 0.9, 0, seat.y * S + 0.5);
      pile.rotation.y = Math.random() * 0.6;
      g.add(pile);
    }
    // 이정표: 입구(남쪽 가운데)
    {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.7, 7), logMat);
      post.position.set(W / 2 + 2.2, 0.85, H - 0.6);
      const c = document.createElement("canvas"); c.width = 256; c.height = 96;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#c9a870"; ctx.fillRect(0, 0, 256, 96);
      ctx.fillStyle = "#3a2a1a"; ctx.font = "700 44px 'Jua', sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(roomLabel, 128, 50);
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.4, 0.05), [logMat, logMat, logMat, logMat, new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }), logMat]);
      board.position.set(W / 2 + 2.2, 1.45, H - 0.6);
      board.rotation.y = Math.PI;
      g.add(post, board);
    }
    if (kind === "sea") {
      // 뒤집어 둔 나룻배
      const hull = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.2, 4, 10), new THREE.MeshStandardMaterial({ color: 0x5a7a8a, roughness: 0.9 }));
      hull.rotation.z = Math.PI / 2; hull.rotation.y = 0.5;
      hull.scale.set(1, 0.55, 1);
      hull.position.set(W * 0.12, 0.28, H * 0.42);
      const keel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.06, 0.14), logMat);
      keel.rotation.y = 0.5; keel.position.set(W * 0.12, 0.58, H * 0.42);
      g.add(hull, keel);
      // 부표 둘
      for (const [bx, bz, col] of [[W * 0.9, H * 0.3, 0xe0523a], [W * 0.78, H * 0.18, 0xf2c14e]] as const) {
        const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshStandardMaterial({ color: col, roughness: 0.8 }));
        buoy.position.set(bx, 0.26, bz);
        const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.1, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
        stripe.position.set(bx, 0.26, bz);
        g.add(buoy, stripe);
      }
      // 조개껍데기
      const shellMat = new THREE.MeshStandardMaterial({ color: 0xf3e9dc, roughness: 0.6 });
      for (let i = 0; i < 40; i++) {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
        sh.position.set(Math.random() * W, 0.01, 1.5 + Math.random() * 6);
        sh.scale.set(1, 0.5, 1.2);
        sh.rotation.y = Math.random() * Math.PI;
        g.add(sh);
      }
    }
    return g;
  }

  update(t: number) {
    if (this.bulbs) (this.bulbs.material as THREE.PointsMaterial).opacity = 0.85 + Math.sin(t * 2.1) * 0.08 + Math.sin(t * 7.3) * 0.04;
    for (const [i, g] of this.tentGlows.entries()) g.material.opacity = 0.4 + Math.sin(t * 0.9 + i) * 0.06;
    for (const [i, g] of this.lanternGlows.entries()) g.material.opacity = 0.45 + Math.sin(t * 5 + i * 2) * 0.08 + Math.random() * 0.03;
  }
}

/**
 * 별: 하늘 사진 위에 반짝이는 별 300개를 세 겹으로 겹쳐(겹마다 다른 박자로 밝기 변화) 깜빡이게.
 * 별똥별: 20~50초에 한 번 짧은 선이 하늘을 가로지름.
 */
export class StarField {
  readonly group = new THREE.Group();
  private layers: THREE.Points[] = [];
  private shooter: THREE.Line;
  private shootT = -1;
  private nextShoot = 8 + Math.random() * 20;
  private from = new THREE.Vector3();
  private dir = new THREE.Vector3();
  constructor(center: THREE.Vector3) {
    for (let L = 0; L < 3; L++) {
      const n = 100;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const el = 0.12 + Math.random() * 1.3; // 지평선 위 7도~80도
        const r = 320;
        pos[i * 3] = center.x + Math.cos(a) * Math.cos(el) * r;
        pos[i * 3 + 1] = Math.sin(el) * r;
        pos[i * 3 + 2] = center.z + Math.sin(a) * Math.cos(el) * r;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ size: 1.6 + L * 0.5, map: glowTexture(), color: L === 1 ? 0xdfe6ff : 0xfff4e0, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      this.layers.push(pts);
      this.group.add(pts);
    }
    const sg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.shooter = new THREE.Line(sg, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, fog: false }));
    this.shooter.frustumCulled = false;
    this.group.add(this.shooter);
    this.center = center;
  }
  private center: THREE.Vector3;
  update(t: number, dt: number) {
    this.layers.forEach((l, i) => { (l.material as THREE.PointsMaterial).opacity = 0.55 + 0.35 * Math.sin(t * (0.9 + i * 0.6) + i * 2); });
    this.nextShoot -= dt;
    if (this.nextShoot <= 0 && this.shootT < 0) {
      this.shootT = 0;
      const a = Math.random() * Math.PI * 2, el = 0.5 + Math.random() * 0.7;
      this.from.set(this.center.x + Math.cos(a) * Math.cos(el) * 300, Math.sin(el) * 300, this.center.z + Math.sin(a) * Math.cos(el) * 300);
      this.dir.set(Math.random() - 0.5, -0.35 - Math.random() * 0.3, Math.random() - 0.5).normalize();
      this.nextShoot = 20 + Math.random() * 30;
    }
    if (this.shootT >= 0) {
      this.shootT += dt;
      const k = this.shootT / 0.9;
      const head = this.from.clone().addScaledVector(this.dir, k * 90);
      const tail = head.clone().addScaledVector(this.dir, -14);
      const pos = this.shooter.geometry.attributes.position as THREE.BufferAttribute;
      pos.setXYZ(0, tail.x, tail.y, tail.z); pos.setXYZ(1, head.x, head.y, head.z); pos.needsUpdate = true;
      (this.shooter.material as THREE.LineBasicMaterial).opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.9;
      if (k >= 1) { this.shootT = -1; (this.shooter.material as THREE.LineBasicMaterial).opacity = 0; }
    }
  }
}

/** 캠프 바깥을 둘러싸는 풍경. 산: 나무 띠 + 먼 산. 바다: 북쪽에 바다. */
export function makeSurroundings(kind: SceneKind): { group: THREE.Group; water: THREE.Mesh | null } {
  const g = new THREE.Group();
  const cx = (WORLD.w * S) / 2, cz = (WORLD.h * S) / 2;
  let water: THREE.Mesh | null = null;

  if (kind === "mountain") {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
    const leafMats = [0x3f7a3c, 0x4e8a44, 0x5f9a4a, 0x6f9e3e, 0x7fa84a].map((c) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 1 });
      m.onBeforeCompile = (sh) => {
        sh.uniforms.uTime = windUniform;
        sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nuniform float uTime;")
          .replace("#include <begin_vertex>", `#include <begin_vertex>
            {
              float ph = position.y * 0.8;
              transformed.x += sin(uTime * 0.9 + ph) * 0.05 * max(0.0, position.y);
              transformed.z += cos(uTime * 0.7 + ph) * 0.04 * max(0.0, position.y);
            }`);
      };
      return m;
    });
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 1.4, 8);
    const coneGeo = new THREE.ConeGeometry(1, 2.2, 9);
    const blobGeo = new THREE.IcosahedronGeometry(1, 1);
    // 활엽수 잎덩어리: 꼭짓점을 울퉁불퉁하게
    {
      const pos = blobGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, i);
        v.multiplyScalar(0.85 + Math.random() * 0.3);
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      blobGeo.computeVertexNormals();
    }
    const trees = new THREE.Group();
    for (let i = 0; i < 260; i++) {
      // 캠프 바깥 링(24m~44m)에 흩뿌림. 카메라가 캠프 아래쪽 9.5m 뒤까지 물러나므로 그보다 바깥
      const ang = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 20;
      const x = cx + Math.cos(ang) * r * 1.3, z = cz + Math.sin(ang) * r;
      const h = 0.8 + Math.random() * 1.2;
      const t = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.7;
      t.add(trunk);
      if (i % 4 === 0) {
        // 침엽수
        for (let j = 0; j < 3; j++) {
          const c = new THREE.Mesh(coneGeo, leafMats[(i + j) % leafMats.length]);
          c.position.y = 1.6 + j * 1.1;
          c.scale.setScalar(1.3 - j * 0.3);
          t.add(c);
        }
      } else {
        // 활엽수: 잎덩어리 3~4개
        const n = 3 + (i % 2);
        for (let j = 0; j < n; j++) {
          const c = new THREE.Mesh(blobGeo, leafMats[(i * 7 + j) % leafMats.length]);
          c.position.set((Math.random() - 0.5) * 1.2, 2.0 + Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
          c.scale.setScalar(0.9 + Math.random() * 0.6);
          t.add(c);
        }
      }
      t.position.set(x, 0, z);
      t.scale.setScalar(h);
      t.rotation.y = Math.random() * Math.PI;
      trees.add(t);
    }
    g.add(trees);
    // 먼 산 (큰 납작 원뿔)
    const mtnMat = new THREE.MeshStandardMaterial({ color: 0x2a2440, roughness: 1, flatShading: true });
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      const r = 90 + Math.random() * 40;
      const m = new THREE.Mesh(new THREE.ConeGeometry(30 + Math.random() * 25, 22 + Math.random() * 18, 5), mtnMat);
      m.position.set(cx + Math.cos(ang) * r, 0, cz + Math.sin(ang) * r);
      m.rotation.y = Math.random();
      g.add(m);
    }
  } else {
    // 바다: 북쪽(z 작은 쪽) 모래 끝에서 바다가 시작. 양옆으로도 넓게 펼쳐지고, 해 지는 쪽으로 빛기둥이 비침
    const shore = 2.4; // 걸을 수 있는 땅(HORIZON_Y) 바로 너머에서 바다 시작
    const geo = new THREE.PlaneGeometry(4000, 2000, 160, 80);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x1c3f5e) },
        uColorShallow: { value: new THREE.Color(0x2f7a86) },
        uFoam: { value: new THREE.Color(0xdbe9ee) },
        uSun: { value: new THREE.Color(0xffb26a) },
        uSky: { value: new THREE.Color(0x8d7aa3) },
        uFog: { value: new THREE.Color(0x6a5c80) },
        uSunDir: { value: new THREE.Vector2(0.25, -1).normalize() },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; varying float vH; varying vec2 vUv; varying float vDist; varying vec3 vWorld;
        void main(){
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x*0.22 + uTime*0.9)*0.16 + sin(p.y*0.35 - uTime*0.7)*0.12 + sin((p.x+p.y)*0.1 + uTime*0.4)*0.2 + sin(p.x*0.9 - uTime*1.6)*0.04;
          w *= smoothstep(0.0, 0.08, 1.0 - uv.y) ;
          p.z += w; vH = w;
          vec4 wp = modelMatrix * vec4(p,1.0); vWorld = wp.xyz;
          vec4 mv = viewMatrix * wp;
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorDeep, uColorShallow, uFoam, uSun, uSky, uFog; uniform vec2 uSunDir; uniform float uTime;
        varying float vH; varying vec2 vUv; varying float vDist; varying vec3 vWorld;
        void main(){
          float shore = smoothstep(0.0, 0.012, vUv.y);
          vec3 c = mix(uColorShallow, uColorDeep, shore);
          // 프레넬: 비스듬히 볼수록(멀수록) 하늘빛을 비춤 → 먼 바다가 검지 않고 하늘과 이어짐
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(0.0, v.y), 2.2);
          c = mix(c, uSky, fres * 0.75);
          // 물결 마루에 거품
          c += uFoam * smoothstep(0.14, 0.3, vH + 0.1) * 0.22;
          // 해안 거품선(두 줄, 밀려왔다 빠짐)
          float f1 = (1.0 - smoothstep(0.0, 0.003 + sin(uTime*0.8)*0.001, vUv.y)) * 0.6;
          float f2 = (1.0 - smoothstep(0.005, 0.008 + sin(uTime*0.6+1.0)*0.0012, vUv.y)) * 0.25 * step(0.003, vUv.y);
          c = mix(c, uFoam, f1 + f2);
          // 해 반사 기둥: 해 방향으로 뻗은 띠, 물결에 따라 반짝
          vec2 d = normalize(vWorld.xz - vec2(14.0, 0.0));
          float along = max(0.0, dot(d, uSunDir));
          float band = pow(along, 24.0);
          float glint = smoothstep(0.05, 0.25, vH + 0.08) * (0.5 + 0.5*sin(vWorld.x*3.1 + uTime*2.2) * sin(vWorld.z*2.3 - uTime*1.7));
          c += uSun * band * (0.35 + glint * 0.9);
          float fog = 1.0 - exp(-pow(vDist * 0.006, 2.0));
          c = mix(c, uFog, fog);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 0.02, shore - 1000);
    g.add(water);
    // 먼 섬 실루엣 둘 + 등대(불빛 깜빡)
    const isleMat = new THREE.MeshStandardMaterial({ color: 0x1c2436, roughness: 1, flatShading: true });
    for (const [ox, oz, r, h] of [[-90, -150, 40, 9], [70, -190, 55, 13], [160, -120, 25, 6]] as const) {
      const isle = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), isleMat);
      isle.position.set(cx + ox, h / 2 - 1, oz);
      isle.rotation.y = Math.random();
      g.add(isle);
    }
    const lhMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c6, roughness: 0.9 });
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 14, 10), lhMat);
    lh.position.set(cx + 70, 7 + 12, -190);
    g.add(lh);
    const beacon = new THREE.PointLight(0xfff0c0, 0, 400, 1.2);
    beacon.position.set(cx + 70, 27, -190);
    beacon.name = "beacon";
    g.add(beacon);
    const beaconBulb = new THREE.Mesh(new THREE.SphereGeometry(1.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff0c0 }));
    beaconBulb.position.copy(beacon.position);
    beaconBulb.name = "beaconBulb";
    g.add(beaconBulb);
    // 바위 + 유목
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3f3a36, roughness: 1, flatShading: true });
    for (let i = 0; i < 30; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15 + Math.random() * 0.35, 0), rockMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      r.position.set(cx + side * (15 + Math.random() * 12), 0.1, cz + (Math.random() - 0.5) * 34);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(r);
    }
    const driftMat = new THREE.MeshStandardMaterial({ color: 0x8a7a66, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2 + Math.random() * 2, 7), driftMat);
      d.position.set(cx + (Math.random() - 0.5) * 30, 0.14, 1.5 + Math.random() * 3);
      d.rotation.set(0, Math.random() * Math.PI, Math.PI / 2 + (Math.random() - 0.5) * 0.2);
      g.add(d);
    }
  }
  return { group: g, water };
}
