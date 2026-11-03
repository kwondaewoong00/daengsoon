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
export function makeGroundDressing(kind: SceneKind): THREE.Group {
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
  const count = kind === "mountain" ? 2200 : 500;
  const plane = new THREE.PlaneGeometry(0.42, 0.34);
  plane.translate(0, 0.17, 0);
  const grassMat = new THREE.MeshStandardMaterial({
    map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1,
    color: kind === "mountain" ? 0x7fa548 : 0xb9b47a,
  });
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
    const sc = rnd(0.7, 1.5);
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

/** 캠프 바깥을 둘러싸는 풍경. 산: 나무 띠 + 먼 산. 바다: 북쪽에 바다. */
export function makeSurroundings(kind: SceneKind): { group: THREE.Group; water: THREE.Mesh | null } {
  const g = new THREE.Group();
  const cx = (WORLD.w * S) / 2, cz = (WORLD.h * S) / 2;
  let water: THREE.Mesh | null = null;

  if (kind === "mountain") {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
    const leafMats = [0x3f7a3c, 0x4e8a44, 0x5f9a4a, 0x6f9e3e, 0x7fa84a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
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
    // 바다: 북쪽(z 작은 쪽) 모래 끝에서 바다가 시작
    const shore = -2; // 월드 z=0 에서 2m 더 간 곳
    const geo = new THREE.PlaneGeometry(400, 200, 80, 40);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColorDeep: { value: new THREE.Color(0x061626) },
        uColorShallow: { value: new THREE.Color(0x173a4d) },
        uFoam: { value: new THREE.Color(0x9fc3d6) },
        uFog: { value: new THREE.Color(0x0a1420) },
      },
      vertexShader: /* glsl */ `
        uniform float uTime; varying float vH; varying vec2 vUv; varying float vDist;
        void main(){
          vUv = uv;
          vec3 p = position;
          float w = sin(p.x*0.35 + uTime*0.9)*0.12 + sin(p.y*0.5 - uTime*0.7)*0.1 + sin((p.x+p.y)*0.15 + uTime*0.4)*0.15;
          p.z += w; vH = w;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColorDeep, uColorShallow, uFoam, uFog; uniform float uTime; varying float vH; varying vec2 vUv; varying float vDist;
        void main(){
          float shore = smoothstep(0.0, 0.08, vUv.y); // uv.y=0 이 해안
          vec3 c = mix(uColorShallow, uColorDeep, shore);
          c += uFoam * smoothstep(0.08, 0.22, vH + 0.1) * 0.25;
          float foamLine = (1.0 - smoothstep(0.0, 0.025 + sin(uTime*0.8)*0.008, vUv.y)) * 0.5;
          c = mix(c, uFoam, foamLine);
          float fog = 1.0 - exp(-pow(vDist * 0.014, 2.0));
          c = mix(c, uFog, fog);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    water = new THREE.Mesh(geo, mat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, 0.02, shore - 100);
    g.add(water);
    // 바위 몇 개
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3f3a36, roughness: 1, flatShading: true });
    for (let i = 0; i < 24; i++) {
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.9, 0), rockMat);
      const side = Math.random() < 0.5 ? -1 : 1;
      r.position.set(cx + side * (16 + Math.random() * 10), 0.2, cz + (Math.random() - 0.5) * 30);
      r.rotation.set(Math.random(), Math.random(), Math.random());
      g.add(r);
    }
  }
  return { group: g, water };
}
