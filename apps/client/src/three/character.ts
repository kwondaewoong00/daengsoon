import * as THREE from "three";
import type { AgeBand, Gender, PlayerState } from "@daengsoon/shared";
import { S } from "./config";

/**
 * A1(Quaternius) 느낌의 "코드로 깎은" 캐릭터.
 * 까만 동그란 얼굴 + 하얀 눈, 색깔 머리, 통통한 몸. 머리가 큰 2.5등신.
 * 파일 없이 기본 도형(구·캡슐·상자)만 조립했고, 걷기·대기·앉기는 코드로 움직입니다.
 * 나중에 진짜 A1 모델(GLB)이 오면 이 클래스만 교체하면 됩니다.
 */
const HEAD_R = 0.26;
const BODY_H = 0.42;
const LEG_H = 0.22;
const ARM_L = 0.3;

const faceMat = new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.9 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 1 });
const headGeo = new THREE.SphereGeometry(HEAD_R, 14, 10);
const eyeGeo = new THREE.BoxGeometry(0.045, 0.07, 0.02);
const bodyGeo = new THREE.CapsuleGeometry(0.17, BODY_H - 0.34, 4, 10);
const legGeo = new THREE.CapsuleGeometry(0.065, LEG_H - 0.13, 3, 8);
const armGeo = new THREE.CapsuleGeometry(0.05, ARM_L - 0.1, 3, 8);
const hairCapGeo = new THREE.SphereGeometry(HEAD_R + 0.03, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
const hairLongGeo = new THREE.CylinderGeometry(HEAD_R + 0.02, HEAD_R - 0.02, 0.32, 14, 1, true);
const shoulderGeo = new THREE.BoxGeometry(0.4, 0.08, 0.22);

function hairColor(age: AgeBand, hue: number) {
  if (age >= 60) return new THREE.Color("#d9d4cc");
  if (age >= 50) return new THREE.Color("#8d837a");
  if (age >= 40) return new THREE.Color("#3a2a22");
  if (age >= 30) return new THREE.Color("#2a1c16");
  if (age >= 20) return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.35, 0.28);
  return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.6, 0.45); // 10대: 염색
}

export class Character {
  readonly group = new THREE.Group();
  private root = new THREE.Group(); // 몸 전체 (앉을 때 내려감)
  private head = new THREE.Group();
  private body: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  private step = 0;
  private sitK = 0; // 0=서 있음, 1=앉음 (부드럽게)
  private scale: number;
  /** 보간된 현재 위치(월드 단위) */
  x: number;
  y: number;
  facing: number;
  state: PlayerState;

  constructor(state: PlayerState, isSelf: boolean) {
    this.state = state;
    this.x = state.x;
    this.y = state.y;
    this.facing = state.facing;
    this.scale = state.age === 10 ? 0.86 : 1;
    const hue = state.hue;
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.45, 0.5), roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(hue / 360, 0.3, 0.22), roughness: 0.9 });
    const hair = new THREE.MeshStandardMaterial({ color: hairColor(state.age, hue), roughness: 0.8 });

    // 다리
    // 캡슐의 회전 중심을 위쪽(엉덩이)으로 옮겨 두면 rotation.x 만으로 다리가 흔들립니다
    const legPivot = legGeo.clone().translate(0, -LEG_H / 2, 0);
    this.legL = new THREE.Mesh(legPivot, pants);
    this.legR = new THREE.Mesh(legPivot, pants);
    this.legL.position.set(-0.08, LEG_H, 0);
    this.legR.position.set(0.08, LEG_H, 0);
    // 몸
    this.body = new THREE.Mesh(bodyGeo, shirt);
    this.body.position.y = LEG_H + BODY_H / 2 - 0.02;
    // 팔
    this.armL = new THREE.Mesh(armGeo.clone().translate(0, -ARM_L / 2, 0), shirt);
    this.armR = new THREE.Mesh(armGeo.clone().translate(0, -ARM_L / 2, 0), shirt);
    this.armL.position.set(-0.21, LEG_H + BODY_H - 0.08, 0);
    this.armR.position.set(0.21, LEG_H + BODY_H - 0.08, 0);
    // 머리
    const face = new THREE.Mesh(headGeo, faceMat);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.08, 0.02, HEAD_R - 0.01);
    eyeR.position.set(0.08, 0.02, HEAD_R - 0.01);
    const cap = new THREE.Mesh(hairCapGeo, hair);
    cap.position.y = 0.01;
    this.head.add(face, eyeL, eyeR, cap);
    if (state.gender === "f") {
      const long = new THREE.Mesh(hairLongGeo, hair);
      long.position.y = -0.14;
      this.head.add(long);
    }
    this.head.position.y = LEG_H + BODY_H + HEAD_R - 0.06;
    // 40대 이상: 어깨에 숄
    if (state.age >= 40) {
      const shawl = new THREE.Mesh(shoulderGeo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(((hue + 40) % 360) / 360, 0.35, 0.4), roughness: 1 }));
      shawl.position.y = LEG_H + BODY_H - 0.06;
      this.root.add(shawl);
    }
    this.root.add(this.legL, this.legR, this.body, this.armL, this.armR, this.head);
    this.root.scale.setScalar(this.scale);
    this.group.add(this.root);

    if (isSelf) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(0.34, 0.4, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.01;
      this.group.add(this.ring);
    }
    this.sync();
  }

  private sync() {
    this.group.position.set(this.x * S, 0, this.y * S);
    // 월드의 facing(라디안, x→y 평면) → 3D y축 회전. z = y 이므로 각도 부호 반전
    this.group.rotation.y = -this.facing + Math.PI / 2;
  }

  update(dt: number, t: number) {
    const st = this.state;
    const k = Math.min(1, dt * 10);
    this.x += (st.x - this.x) * k;
    this.y += (st.y - this.y) * k;
    let d = st.facing - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, dt * 8);
    this.sync();

    const seated = st.seat !== null;
    this.sitK += ((seated ? 1 : 0) - this.sitK) * Math.min(1, dt * 6);
    const sit = this.sitK;

    if (st.moving && !seated) this.step += dt * 9;
    const swing = st.moving && !seated ? Math.sin(this.step) * 0.7 : 0;
    const breathe = Math.sin(t * 1.6 + st.hue) * 0.012;

    // 앉기: 엉덩이가 그루터기 높이(0.36)로 내려가고, 다리는 앞으로 90도
    this.root.position.y = (0.36 - LEG_H) * sit * this.scale;
    this.legL.rotation.x = swing * (1 - sit) + (-Math.PI / 2) * sit;
    this.legR.rotation.x = -swing * (1 - sit) + (-Math.PI / 2) * sit;
    this.armL.rotation.x = -swing * 0.8 * (1 - sit) + -0.5 * sit;
    this.armR.rotation.x = swing * 0.8 * (1 - sit) + -0.5 * sit;
    this.body.position.y = LEG_H + BODY_H / 2 - 0.02 + breathe + (st.moving ? Math.abs(Math.sin(this.step)) * 0.03 : 0);
    this.head.position.y = LEG_H + BODY_H + HEAD_R - 0.06 + breathe * 1.5 + (st.age >= 50 ? -0.03 : 0);
    this.head.rotation.x = st.age >= 50 ? 0.12 : 0;
    this.body.scale.y = 1 + breathe * 2;
    if (this.ring) this.ring.material.opacity = 0.4 + Math.sin(t * 2) * 0.15;
  }

  /** 머리 위치(3D) — 태우기 연출 시작점 */
  headWorldPos(target: THREE.Vector3) {
    this.head.getWorldPosition(target);
    return target;
  }
}
