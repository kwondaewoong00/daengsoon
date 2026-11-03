import * as THREE from "three";
import type { AgeBand, PlayerState } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 장난감처럼 통통한 사람 캐릭터(2등신). 나이·성별로 얼굴이 달라집니다.
 *  - 머리 모양: 남(짧은 머리 / 60대 머리숱 적음), 여(10~30대 긴 머리, 40~50대 단발, 60대 쪽머리)
 *  - 눈: 10대는 크고 반짝, 60대는 가늘게. 눈썹: 남자가 굵게
 *  - 수염: 남 30대+ 일부 콧수염, 50대+ 턱수염(60대는 흰색). 안경: 40대+ 일부
 *  - 볼터치: 20대 이하. 50대+ 목도리, 60대는 살짝 구부정
 * 파일 없이 기본 도형만 조립. 걷기·대기·앉기·찢어 넣기 동작은 코드로.
 */
const HEAD_R = 0.3;
const LEG_H = 0.26;
const BODY_R = 0.2;
const BODY_LEN = 0.26;
const BODY_H = BODY_LEN + BODY_R * 2;
const ARM_L = 0.24;

const SKINS = [0xf6d2b5, 0xf2c9a8, 0xe8b894, 0xd9a378];
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.5 });
const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
const blushMat = new THREE.MeshStandardMaterial({ color: 0xf0a090, roughness: 1, transparent: true, opacity: 0.6 });
const lipMat = new THREE.MeshStandardMaterial({ color: 0xc96a6a, roughness: 0.9 });
const strawMat = new THREE.MeshStandardMaterial({ color: 0xd9b872, roughness: 0.9 });
const strawBandMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 });
const glassMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.4 });
const paperMat = new THREE.MeshStandardMaterial({ color: 0xf7f1e3, roughness: 0.9, side: THREE.DoubleSide });

const headGeo = new THREE.SphereGeometry(HEAD_R, 32, 24);
const eyeGeo = new THREE.SphereGeometry(0.034, 12, 10);
const eyeBigGeo = new THREE.SphereGeometry(0.042, 12, 10);
const eyeLineGeo = new THREE.BoxGeometry(0.07, 0.016, 0.02);
const shineGeo = new THREE.SphereGeometry(0.012, 8, 6);
const browGeo = new THREE.BoxGeometry(0.09, 0.022, 0.025);
const browThickGeo = new THREE.BoxGeometry(0.1, 0.034, 0.025);
const blushGeo = new THREE.SphereGeometry(0.045, 10, 8);
const mouthGeo = new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI);
const noseGeo = new THREE.SphereGeometry(0.03, 10, 8);
const mustacheGeo = new THREE.BoxGeometry(0.13, 0.03, 0.03);
const beardGeo = new THREE.SphereGeometry(HEAD_R - 0.02, 24, 12, 0, Math.PI * 2, Math.PI * 0.6, Math.PI * 0.4);
const bodyGeo = new THREE.CapsuleGeometry(BODY_R, BODY_LEN, 8, 24);
const legGeo = new THREE.CapsuleGeometry(0.075, LEG_H - 0.15, 4, 12);
const shoeGeo = new THREE.SphereGeometry(0.085, 12, 8);
const armGeo = new THREE.CapsuleGeometry(0.06, ARM_L - 0.12, 4, 12).translate(0, -ARM_L / 2, 0);
const handGeo = new THREE.SphereGeometry(0.068, 12, 10);
const hairShortGeo = new THREE.SphereGeometry(HEAD_R + 0.025, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.52);
const hairThinGeo = new THREE.SphereGeometry(HEAD_R + 0.02, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.36);
const hairLongGeo = new THREE.CylinderGeometry(HEAD_R + 0.02, HEAD_R - 0.03, 0.36, 24, 1, true);
const hairBobGeo = new THREE.CylinderGeometry(HEAD_R + 0.03, HEAD_R + 0.01, 0.2, 24, 1, true);
const bunGeo = new THREE.SphereGeometry(0.11, 14, 10);
const crownGeo = new THREE.CylinderGeometry(0.2, 0.23, 0.17, 24);
const brimGeo = new THREE.CylinderGeometry(0.44, 0.46, 0.03, 32);
const bandGeo = new THREE.CylinderGeometry(0.235, 0.235, 0.05, 24, 1, true);
const beanieGeo = new THREE.SphereGeometry(HEAD_R + 0.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.55);
const pomGeo = new THREE.SphereGeometry(0.07, 12, 10);
const packGeo = new THREE.CapsuleGeometry(0.11, 0.14, 6, 14);
const packLidGeo = new THREE.CapsuleGeometry(0.1, 0.03, 4, 12);
const scarfGeo = new THREE.TorusGeometry(0.2, 0.06, 10, 24);
const glassRimGeo = new THREE.TorusGeometry(0.058, 0.008, 6, 16);
const glassBridgeGeo = new THREE.BoxGeometry(0.06, 0.008, 0.008);
const paperGeo = new THREE.PlaneGeometry(0.16, 0.22);

function hairColor(age: AgeBand, hue: number) {
  if (age >= 60) return new THREE.Color("#e3ded6");
  if (age >= 50) return new THREE.Color("#9a9088");
  if (age >= 40) return new THREE.Color("#4a3328");
  if (age >= 30) return new THREE.Color("#32221a");
  if (age >= 20) return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.35, 0.3);
  return new THREE.Color().setHSL(((hue + 180) % 360) / 360, 0.6, 0.5);
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
  private handL: THREE.Mesh;
  private handR: THREE.Mesh;
  private pack: THREE.Group | null = null;
  private ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial> | null = null;
  /** 찢어 넣기 동작: 0=없음, 진행 시간(초) */
  private tearT = -1;
  private paperL: THREE.Mesh | null = null;
  private paperR: THREE.Mesh | null = null;
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
    this.scale = state.age === 10 ? 0.84 : state.age >= 60 ? 0.95 : 1;
    const hue = state.hue;
    const h = hue / 360;
    const age = state.age;
    const male = state.gender === "m";
    const skinMat = new THREE.MeshStandardMaterial({ color: SKINS[hue % SKINS.length], roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(h, 0.5, 0.62), roughness: 0.8 });
    const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((h + 0.55) % 1, 0.35, 0.42), roughness: 0.9 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL((h + 0.12) % 1, 0.55, 0.55), roughness: 0.85 });
    const hair = new THREE.MeshStandardMaterial({ color: hairColor(age, hue), roughness: 0.75 });

    // 다리 + 신발
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
    this.body = new THREE.Mesh(bodyGeo, shirt);
    this.body.position.y = LEG_H - 0.06 + BODY_H / 2;
    // 팔 + 손
    const makeArm = (sx: number) => {
      const arm = new THREE.Mesh(armGeo, shirt);
      const hand = new THREE.Mesh(handGeo, skinMat);
      hand.position.y = -ARM_L;
      arm.add(hand);
      arm.position.set(sx * (BODY_R + 0.03), LEG_H + BODY_H - 0.2, 0);
      arm.rotation.z = -sx * 0.15;
      return { arm, hand };
    };
    const L = makeArm(-1), R = makeArm(1);
    this.armL = L.arm; this.handL = L.hand;
    this.armR = R.arm; this.handR = R.hand;
    // 배낭
    this.pack = new THREE.Group();
    const packBody = new THREE.Mesh(packGeo, accent);
    const lid = new THREE.Mesh(packLidGeo, pants);
    lid.position.y = 0.12;
    lid.scale.set(1.05, 1, 1.05);
    this.pack.add(packBody, lid);
    this.pack.position.set(0, LEG_H + BODY_H * 0.55, -BODY_R - 0.04);
    this.pack.scale.set(1.1, 1, 0.8);

    // ----- 얼굴 -----
    const face = new THREE.Mesh(headGeo, skinMat);
    this.head.add(face);
    const z = HEAD_R - 0.03;
    const eyeG = age <= 10 ? eyeBigGeo : eyeGeo;
    for (const sx of [-1, 1]) {
      if (age >= 60) {
        // 가늘게 웃는 눈
        const line = new THREE.Mesh(eyeLineGeo, eyeMat);
        line.position.set(sx * 0.1, 0.02, z);
        line.rotation.z = sx * 0.25;
        this.head.add(line);
      } else {
        const eye = new THREE.Mesh(eyeG, eyeMat);
        eye.position.set(sx * 0.1, 0.02, z);
        const shine = new THREE.Mesh(shineGeo, whiteMat);
        shine.position.set(-0.012, 0.014, 0.03);
        eye.add(shine);
        this.head.add(eye);
      }
      // 눈썹
      const brow = new THREE.Mesh(male ? browThickGeo : browGeo, hair);
      brow.position.set(sx * 0.1, 0.095, z - 0.01);
      brow.rotation.z = sx * (age >= 40 ? -0.12 : 0.08);
      this.head.add(brow);
      // 볼터치(젊을수록)
      if (age <= 20) {
        const blush = new THREE.Mesh(blushGeo, blushMat);
        blush.position.set(sx * 0.18, -0.06, HEAD_R - 0.08);
        blush.scale.set(1, 0.7, 0.5);
        this.head.add(blush);
      }
      // 안경 (40대+ 일부)
      if (age >= 40 && hue % 3 === 0) {
        const rim = new THREE.Mesh(glassRimGeo, glassMat);
        rim.position.set(sx * 0.1, 0.02, z + 0.02);
        this.head.add(rim);
      }
    }
    if (age >= 40 && hue % 3 === 0) {
      const bridge = new THREE.Mesh(glassBridgeGeo, glassMat);
      bridge.position.set(0, 0.025, z + 0.02);
      this.head.add(bridge);
    }
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.03, HEAD_R - 0.005);
    nose.scale.set(0.9, 0.8, 0.9);
    this.head.add(nose);
    const mouth = new THREE.Mesh(mouthGeo, male ? eyeMat : lipMat);
    mouth.position.set(0, -0.1, HEAD_R - 0.02);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);
    // 수염
    if (male && age >= 30 && hue % 2 === 0) {
      const m = new THREE.Mesh(mustacheGeo, hair);
      m.position.set(0, -0.075, HEAD_R - 0.01);
      this.head.add(m);
    }
    if (male && age >= 50) {
      const b = new THREE.Mesh(beardGeo, hair);
      b.position.y = -0.03;
      b.position.z = 0.03;
      this.head.add(b);
    }
    // 머리카락
    if (male) {
      const cap = new THREE.Mesh(age >= 60 ? hairThinGeo : hairShortGeo, hair);
      cap.position.y = age >= 60 ? 0.05 : 0.02;
      this.head.add(cap);
    } else {
      const cap = new THREE.Mesh(hairShortGeo, hair);
      cap.position.y = 0.02;
      this.head.add(cap);
      if (age <= 30) {
        const long = new THREE.Mesh(hairLongGeo, hair);
        long.position.y = -0.12;
        this.head.add(long);
      } else if (age <= 50) {
        const bob = new THREE.Mesh(hairBobGeo, hair);
        bob.position.y = 0.0;
        this.head.add(bob);
      } else {
        const bun = new THREE.Mesh(bunGeo, hair);
        bun.position.set(0, 0.12, -HEAD_R + 0.02);
        this.head.add(bun);
      }
    }
    // 모자: 젊은 층 일부 비니, 30~50대 일부 밀짚모자
    const wantsHat = hue % 3 === 0;
    if (wantsHat && age <= 20) {
      const beanie = new THREE.Mesh(beanieGeo, accent);
      beanie.position.y = 0.03;
      beanie.scale.y = 1.15;
      const pom = new THREE.Mesh(pomGeo, pants);
      pom.position.y = HEAD_R + 0.12;
      this.head.add(beanie, pom);
    } else if (wantsHat && age >= 30 && age <= 50) {
      const crown = new THREE.Mesh(crownGeo, strawMat);
      crown.position.y = HEAD_R - 0.02 + 0.085;
      const brim = new THREE.Mesh(brimGeo, strawMat);
      brim.position.y = HEAD_R - 0.02;
      const band = new THREE.Mesh(bandGeo, strawBandMat);
      band.position.y = HEAD_R + 0.02;
      this.head.add(crown, brim, band);
    }
    this.head.position.y = LEG_H - 0.06 + BODY_H + HEAD_R - 0.08;
    if (age >= 50) {
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

  /** 옆에서 본 "꺼내서 찢어 넣기" 동작. 종이 조각은 두 손에 하나씩 */
  playTear() {
    this.tearT = 0;
    if (!this.paperL) {
      this.paperL = new THREE.Mesh(paperGeo, paperMat);
      this.paperR = new THREE.Mesh(paperGeo, paperMat);
      this.paperL.position.set(0.02, -0.05, 0.05);
      this.paperR.position.set(-0.02, -0.05, 0.05);
      this.handL.add(this.paperL);
      this.handR.add(this.paperR);
    }
    this.paperL.visible = this.paperR!.visible = true;
    this.paperL.scale.set(1, 1, 1); this.paperR!.scale.set(1, 1, 1);
  }
  /** 손 위치(3D) — 찢은 조각이 날아가는 시작점 */
  handWorldPos(side: "L" | "R", target: THREE.Vector3) {
    (side === "L" ? this.handL : this.handR).getWorldPosition(target);
    return target;
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

    this.root.position.y = (0.37 - LEG_H) * sit * this.scale;
    this.legL.rotation.x = swing * (1 - sit) + (-Math.PI / 2) * sit;
    this.legR.rotation.x = -swing * (1 - sit) + (-Math.PI / 2) * sit;

    // 팔: 기본은 걷기/앉기. 찢기 동작 중엔 덮어씀
    let armLx = -swing * 0.9 * (1 - sit) + -0.6 * sit;
    let armRx = swing * 0.9 * (1 - sit) + -0.6 * sit;
    let armLz = 0.15, armRz = -0.15;
    if (this.tearT >= 0) {
      this.tearT += dt;
      const T = this.tearT;
      // 0~0.4 꺼내 들기(양손 앞으로 모음) → 0.4~0.9 찢기(양손 벌림) → 0.9~1.3 던지기(앞으로 휙) → 끝
      if (T < 0.4) { const e = T / 0.4; armLx = armRx = -1.5 * e; armLz = 0.15 - 0.3 * e; armRz = -0.15 + 0.3 * e; }
      else if (T < 0.9) { const e = (T - 0.4) / 0.5; armLx = armRx = -1.5; armLz = -0.15 - 0.6 * e; armRz = 0.15 + 0.6 * e; }
      else if (T < 1.3) { const e = (T - 0.9) / 0.4; armLx = armRx = -1.5 - 0.6 * Math.sin(e * Math.PI); armLz = -0.75 + 0.9 * e; armRz = 0.75 - 0.9 * e;
        if (this.paperL && T > 1.0) { this.paperL.visible = false; this.paperR!.visible = false; } }
      else { this.tearT = -1; }
    }
    this.armL.rotation.x = armLx; this.armR.rotation.x = armRx;
    this.armL.rotation.z = armLz; this.armR.rotation.z = armRz;

    const baseBody = LEG_H - 0.06 + BODY_H / 2;
    this.body.position.y = baseBody + bob + breathe;
    this.body.scale.set(1, 1 + breathe * 2, 1);
    const headBase = LEG_H - 0.06 + BODY_H + HEAD_R - 0.08;
    this.head.position.y = headBase + bob + breathe * 1.5 + (st.age >= 50 ? -0.03 : 0);
    this.head.rotation.x = (st.age >= 60 ? 0.12 : 0) + (walking ? Math.sin(this.step * 2) * 0.03 : 0) + 0.12 * sit;
    this.head.rotation.z = walking ? Math.sin(this.step) * 0.04 : 0;
    if (this.pack) this.pack.position.y = LEG_H + BODY_H * 0.55 + bob;
    if (this.ring) this.ring.material.opacity = 0.35 + Math.sin(t * 2) * 0.12;
  }

  headWorldPos(target: THREE.Vector3) {
    this.head.getWorldPosition(target);
    return target;
  }
}
