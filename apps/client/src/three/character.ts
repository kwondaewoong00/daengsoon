import * as THREE from "three";
import type { AgeBand, PlayerState } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 장난감처럼 통통한 캐릭터(2등신). 큰 동그란 머리, 캡슐 몸, 모자/비니, 배낭, 목도리.
 * 파일 없이 기본 도형만 조립했고 매끈한 셰이딩으로 '부드러운 플라스틱' 느낌을 냅니다.
 * 걷기·대기·앉기는 코드로 움직입니다. 진짜 모델(GLB)이 오면 이 파일만 교체.
 */
const HEAD_R = 0.3;
const LEG_H = 0.26;
const BODY_R = 0.2;
const BODY_LEN = 0.26; // 캡슐 가운데 길이
const BODY_H = BODY_LEN + BODY_R * 2;
const ARM_L = 0.24;

const skinMat = new THREE.MeshStandardMaterial({ color: 0xf2c9a8, roughness: 0.75 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.6 });
const blushMat = new THREE.MeshStandardMaterial({ color: 0xf0a090, roughness: 1, transparent: true, opacity: 0.6 });
const strawMat = new THREE.MeshStandardMaterial({ color: 0xd9b872, roughness: 0.9 });
const strawBandMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 });

const headGeo = new THREE.SphereGeometry(HEAD_R, 32, 24);
const eyeGeo = new THREE.SphereGeometry(0.032, 10, 8);
const blushGeo = new THREE.SphereGeometry(0.045, 10, 8);
const bodyGeo = new THREE.CapsuleGeometry(BODY_R, BODY_LEN, 8, 24);
const legGeo = new THREE.CapsuleGeometry(0.075, LEG_H - 0.15, 4, 12).translate(0, -(LEG_H - 0.15) / 2 - 0.075 + 0.075, 0);
const shoeGeo = new THREE.SphereGeometry(0.085, 12, 8);
const armGeo = new THREE.CapsuleGeometry(0.06, ARM_L - 0.12, 4, 12).translate(0, -ARM_L / 2, 0);
const hairCapGeo = new THREE.SphereGeometry(HEAD_R + 0.025, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5);
const hairLongGeo = new THREE.CylinderGeometry(HEAD_R + 0.02, HEAD_R - 0.03, 0.34, 24, 1, true);
const crownGeo = new THREE.CylinderGeometry(0.2, 0.23, 0.17, 24);
const brimGeo = new THREE.CylinderGeometry(0.44, 0.46, 0.03, 32);
const bandGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.05, 24, 1, true);
const beanieGeo = new THREE.SphereGeometry(HEAD_R + 0.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
const pomGeo = new THREE.SphereGeometry(0.07, 12, 10);
const packGeo = new THREE.CapsuleGeometry(0.11, 0.14, 6, 14);
const packLidGeo = new THREE.CapsuleGeometry(0.1, 0.03, 4, 12);
const scarfGeo = new THREE.TorusGeometry(0.2, 0.06, 10, 24);

function hairColor(age: AgeBand, hue: number) {
  if (age >= 60) return new THREE.Color("#e3ded6");
  if (age >= 50) return new THREE.Color("#9a9088");
  if (age >= 40) return new THREE.Color("#4a3328");
  if (age >= 30) return new THREE.Color("#32221a");
  if (age >= 20) return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.35, 0.3);
  return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.6, 0.5); // 10대: 염색
}

export class Character {
  readonly group = new THREE.Group();
  private root = new THREE.Group();
  private head = new THREE.Group();
  private body: THREE.Mesh;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private pack: THREE.Group | null = null;
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  private step = 0;
  private sitK = 0;
  private scale: number;
  x: number;
  y: number;
  facing: number;
  state: PlayerState;

  constructor(state: PlayerState, isSelf: boolean) {
    this.state = state;
    this.x = state.x;
    this.y = state.y;
    this.facing = state.facing;
    this.scale = state.age === 10 ? 0.84 : 1;
    const hue = state.hue;
    const h = hue / 360;
    // 파스텔: 옷은 밝고 부드럽게, 바지는 보색 쪽 어두운 톤
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(h, 0.5, 0.62), roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((h + 0.55) % 1, 0.35, 0.42), roughness: 0.9 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((h + 0.12) % 1, 0.55, 0.55), roughness: 0.85 });
    const hair = new THREE.MeshStandardMaterial({ color: hairColor(state.age, hue), roughness: 0.75 });

    // 다리 + 신발 (피벗 = 엉덩이)
    const makeLeg = (x: number) => {
      const g = new THREE.Group();
      const leg = new THREE.Mesh(legGeo, pants);
      leg.position.y = -0.02;
      const shoe = new THREE.Mesh(shoeGeo, shoeMat);
      shoe.position.set(0, -LEG_H + 0.07, 0.03);
      shoe.scale.set(1, 0.7, 1.3);
      g.add(leg, shoe);
      g.position.set(x, LEG_H, 0);
      return g;
    };
    this.legL = makeLeg(-0.1);
    this.legR = makeLeg(0.1);
    // 몸
    this.body = new THREE.Mesh(bodyGeo, shirt);
    this.body.position.y = LEG_H - 0.06 + BODY_H / 2;
    // 팔
    this.armL = new THREE.Mesh(armGeo, shirt);
    this.armR = new THREE.Mesh(armGeo, shirt);
    this.armL.position.set(-BODY_R - 0.03, LEG_H + BODY_H - 0.2, 0);
    this.armR.position.set(BODY_R + 0.03, LEG_H + BODY_H - 0.2, 0);
    this.armL.rotation.z = 0.15;
    this.armR.rotation.z = -0.15;
    // 배낭 (등 = -z)
    this.pack = new THREE.Group();
    const packBody = new THREE.Mesh(packGeo, accent);
    const lid = new THREE.Mesh(packLidGeo, pants);
    lid.position.y = 0.12;
    lid.scale.set(1.05, 1, 1.05);
    this.pack.add(packBody, lid);
    this.pack.position.set(0, LEG_H + BODY_H * 0.55, -BODY_R - 0.04);
    this.pack.scale.set(1.1, 1, 0.8);
    // 머리
    const face = new THREE.Mesh(headGeo, skinMat);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 0.0, HEAD_R - 0.02);
    eyeR.position.set(0.1, 0.0, HEAD_R - 0.02);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.17, -0.07, HEAD_R - 0.07);
    blushR.position.set(0.17, -0.07, HEAD_R - 0.07);
    blushL.scale.set(1, 0.7, 0.5);
    blushR.scale.set(1, 0.7, 0.5);
    this.head.add(face, eyeL, eyeR, blushL, blushR);
    // 머리카락
    const cap = new THREE.Mesh(hairCapGeo, hair);
    cap.position.y = 0.02;
    this.head.add(cap);
    if (state.gender === "f") {
      const long = new THREE.Mesh(hairLongGeo, hair);
      long.position.y = -0.12;
      this.head.add(long);
    }
    // 모자: hue 로 결정 (절반 밀짚모자, 1/4 비니, 1/4 없음)
    const hatKind = hue % 4;
    if (hatKind < 2) {
      const crown = new THREE.Mesh(crownGeo, strawMat);
      crown.position.y = HEAD_R - 0.02 + 0.085;
      const brim = new THREE.Mesh(brimGeo, strawMat);
      brim.position.y = HEAD_R - 0.02;
      const band = new THREE.Mesh(bandGeo, strawBandMat);
      band.position.y = HEAD_R + 0.02;
      this.head.add(crown, brim, band);
    } else if (hatKind === 2) {
      const beanie = new THREE.Mesh(beanieGeo, accent);
      beanie.position.y = 0.03;
      beanie.scale.y = 1.15;
      const pom = new THREE.Mesh(pomGeo, pants);
      pom.position.y = HEAD_R + 0.12;
      this.head.add(beanie, pom);
    }
    this.head.position.y = LEG_H - 0.06 + BODY_H + HEAD_R - 0.08;
    // 50대 이상: 목도리
    if (state.age >= 50) {
      const scarf = new THREE.Mesh(scarfGeo, accent);
      scarf.rotation.x = Math.PI / 2;
      scarf.position.y = LEG_H - 0.06 + BODY_H - 0.04;
      scarf.scale.set(1, 1, 0.8);
      this.root.add(scarf);
    }
    this.root.add(this.legL, this.legR, this.body, this.armL, this.armR, this.pack, this.head);
    this.root.scale.setScalar(this.scale);
    this.group.add(this.root);

    if (isSelf) {
      this.ring = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.46, 40),
        new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
      );
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.01;
      this.group.add(this.ring);
    }
    this.sync();
  }

  private sync() {
    this.group.position.set(this.x * S, 0, this.y * S);
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
    const walking = st.moving && !seated;
    if (walking) this.step += dt * 8;
    const swing = walking ? Math.sin(this.step) * 0.75 : 0;
    const bob = walking ? Math.abs(Math.sin(this.step)) * 0.04 : 0;
    const breathe = Math.sin(t * 1.6 + st.hue) * 0.01;

    // 앉기: 엉덩이가 그루터기(0.37)까지 내려가고 다리는 앞으로
    this.root.position.y = (0.37 - LEG_H) * sit * this.scale;
    this.legL.rotation.x = swing * (1 - sit) + (-Math.PI / 2) * sit;
    this.legR.rotation.x = -swing * (1 - sit) + (-Math.PI / 2) * sit;
    this.armL.rotation.x = -swing * 0.9 * (1 - sit) + -0.6 * sit;
    this.armR.rotation.x = swing * 0.9 * (1 - sit) + -0.6 * sit;
    const baseBody = LEG_H - 0.06 + BODY_H / 2;
    this.body.position.y = baseBody + bob + breathe;
    this.body.scale.set(1, 1 + breathe * 2, 1);
    const headBase = LEG_H - 0.06 + BODY_H + HEAD_R - 0.08;
    this.head.position.y = headBase + bob + breathe * 1.5 + (st.age >= 50 ? -0.03 : 0);
    // 걸을 때 머리 살짝 까딱, 앉으면 불 쪽으로 살짝 숙임
    this.head.rotation.x = (st.age >= 50 ? 0.1 : 0) + (walking ? Math.sin(this.step * 2) * 0.03 : 0) + 0.12 * sit;
    this.head.rotation.z = walking ? Math.sin(this.step) * 0.04 : 0;
    if (this.pack) this.pack.position.y = LEG_H + BODY_H * 0.55 + bob;
    if (this.ring) this.ring.material.opacity = 0.35 + Math.sin(t * 2) * 0.12;
  }

  headWorldPos(target: THREE.Vector3) {
    this.head.getWorldPosition(target);
    return target;
  }
}
