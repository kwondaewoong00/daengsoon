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

/** 캠프 바깥을 둘러싸는 풍경. 산: 나무 띠 + 먼 산. 바다: 북쪽에 바다. */
export function makeSurroundings(kind: SceneKind): { group: THREE.Group; water: THREE.Mesh | null } {
  const g = new THREE.Group();
  const cx = (WORLD.w * S) / 2, cz = (WORLD.h * S) / 2;
  let water: THREE.Mesh | null = null;

  if (kind === "mountain") {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 });
    const leafMats = [0x2f5a33, 0x3a6a3a, 0x29512d, 0x4a6b2e, 0x5a6a2a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
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
      if (i % 3 === 0) {
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
