import * as THREE from "three";
import type { AgeBand, PlayerState, Species } from "@daengsoon/shared";
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

/** 동물별 털색·무늬·귀 모양 */
const FUR: Record<Species, { fur: number; belly: number; inner: number; ear: "round" | "point" | "long" | "flop"; muzzle: boolean; mask?: boolean; stripes?: boolean }> = {
  dog: { fur: 0xe9c89a, belly: 0xfff1dc, inner: 0xf4b6a8, ear: "flop", muzzle: true },
  cat: { fur: 0xf2b76b, belly: 0xfff0d6, inner: 0xf4a3a3, ear: "point", muzzle: true, stripes: true },
  rabbit: { fur: 0xf6f1ea, belly: 0xffffff, inner: 0xf7b8c6, ear: "long", muzzle: true },
  bear: { fur: 0x9a6a46, belly: 0xd9b48f, inner: 0xc48e6a, ear: "round", muzzle: true },
  fox: { fur: 0xe88a3a, belly: 0xfff3e0, inner: 0xffffff, ear: "point", muzzle: true },
  panda: { fur: 0xf7f5f2, belly: 0xffffff, inner: 0x2b2b2b, ear: "round", muzzle: true, mask: true },
};
const matCache = new Map<number, THREE.MeshStandardMaterial>();
function fur(color: number) {
  let m = matCache.get(color);
  if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.85 }); matCache.set(color, m); }
  return m;
}
const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1f1a, roughness: 0.6 });
const blushMat = new THREE.MeshStandardMaterial({ color: 0xf0a090, roughness: 1, transparent: true, opacity: 0.6 });
const strawMat = new THREE.MeshStandardMaterial({ color: 0xd9b872, roughness: 0.9 });
const strawBandMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 });
const shoeMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.8 });

const headGeo = new THREE.SphereGeometry(HEAD_R, 32, 24);
const eyeGeo = new THREE.SphereGeometry(0.034, 10, 8);
const blushGeo = new THREE.SphereGeometry(0.045, 10, 8);
const muzzleGeo = new THREE.SphereGeometry(0.13, 16, 12);
const noseGeo = new THREE.SphereGeometry(0.035, 10, 8);
const earRoundGeo = new THREE.SphereGeometry(0.1, 14, 10);
const earInnerGeo = new THREE.SphereGeometry(0.06, 12, 8);
const earPointGeo = new THREE.ConeGeometry(0.1, 0.2, 12);
const earLongGeo = new THREE.CapsuleGeometry(0.06, 0.26, 4, 12);
const earFlopGeo = new THREE.CapsuleGeometry(0.07, 0.16, 4, 12);
const maskGeo = new THREE.SphereGeometry(0.075, 12, 10);
const bellyGeo = new THREE.SphereGeometry(0.16, 16, 12);
const tailGeo = new THREE.SphereGeometry(0.07, 10, 8);
const foxTailGeo = new THREE.CapsuleGeometry(0.08, 0.2, 4, 10);
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
    // 머리: 동물
    const sp = FUR[state.species] ?? FUR.dog;
    const furMat = fur(sp.fur);
    const face = new THREE.Mesh(headGeo, furMat);
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-0.1, 0.02, HEAD_R - 0.03);
    eyeR.position.set(0.1, 0.02, HEAD_R - 0.03);
    const blushL = new THREE.Mesh(blushGeo, blushMat);
    const blushR = new THREE.Mesh(blushGeo, blushMat);
    blushL.position.set(-0.18, -0.06, HEAD_R - 0.08);
    blushR.position.set(0.18, -0.06, HEAD_R - 0.08);
    blushL.scale.set(1, 0.7, 0.5);
    blushR.scale.set(1, 0.7, 0.5);
    this.head.add(face, eyeL, eyeR, blushL, blushR);
    if (sp.mask) {
      // 판다 눈 주변 검정
      for (const sx of [-1, 1]) {
        const m = new THREE.Mesh(maskGeo, fur(sp.inner));
        m.position.set(sx * 0.1, 0.02, HEAD_R - 0.06);
        m.scale.set(1, 1.2, 0.6);
        this.head.add(m);
      }
    }
    // 주둥이 + 코
    const muzzle = new THREE.Mesh(muzzleGeo, fur(sp.belly));
    muzzle.position.set(0, -0.08, HEAD_R - 0.06);
    muzzle.scale.set(1.25, 0.8, 0.75);
    const nose = new THREE.Mesh(noseGeo, eyeMat);
    nose.position.set(0, -0.04, HEAD_R + 0.04);
    nose.scale.set(1.3, 0.9, 0.9);
    this.head.add(muzzle, nose);
    // 귀
    const inner = fur(sp.inner);
    for (const sx of [-1, 1]) {
      let ear: THREE.Mesh;
      if (sp.ear === "round") {
        ear = new THREE.Mesh(earRoundGeo, furMat);
        ear.position.set(sx * 0.2, HEAD_R - 0.04, -0.02);
        const inn = new THREE.Mesh(earInnerGeo, inner);
        inn.position.set(0, 0, 0.05);
        ear.add(inn);
      } else if (sp.ear === "point") {
        ear = new THREE.Mesh(earPointGeo, furMat);
        ear.position.set(sx * 0.17, HEAD_R + 0.02, -0.02);
        ear.rotation.z = -sx * 0.35;
        const inn = new THREE.Mesh(earPointGeo, inner);
        inn.scale.set(0.55, 0.6, 0.55);
        inn.position.set(0, -0.02, 0.03);
        ear.add(inn);
      } else if (sp.ear === "long") {
        ear = new THREE.Mesh(earLongGeo, furMat);
        ear.position.set(sx * 0.12, HEAD_R + 0.12, -0.04);
        ear.rotation.z = -sx * 0.18;
        const inn = new THREE.Mesh(earLongGeo, inner);
        inn.scale.set(0.5, 0.8, 0.5);
        inn.position.z = 0.03;
        ear.add(inn);
      } else {
        ear = new THREE.Mesh(earFlopGeo, fur(sp.fur === 0xe9c89a ? 0xc9a173 : sp.fur));
        ear.position.set(sx * 0.27, HEAD_R - 0.12, -0.02);
        ear.rotation.z = sx * 0.5;
      }
      this.head.add(ear);
    }
    // 배 무늬(옷 위로 살짝) + 꼬리
    const belly = new THREE.Mesh(bellyGeo, fur(sp.belly));
    belly.position.set(0, LEG_H - 0.06 + BODY_H * 0.45, BODY_R - 0.06);
    belly.scale.set(0.9, 1.0, 0.45);
    belly.visible = false; // 옷을 입고 있으니 기본은 숨김(나중에 '옷 벗기' 옵션용)
    this.root.add(belly);
    if (state.species === "fox") {
      const tail = new THREE.Mesh(foxTailGeo, furMat);
      tail.position.set(0.12, LEG_H + 0.02, -BODY_R - 0.1);
      tail.rotation.x = 0.9;
      const tip = new THREE.Mesh(tailGeo, fur(sp.belly));
      tip.position.y = -0.17;
      tail.add(tip);
      this.root.add(tail);
    } else if (state.species !== "panda") {
      const tail = new THREE.Mesh(tailGeo, state.species === "rabbit" ? fur(sp.belly) : furMat);
      tail.position.set(0, LEG_H + 0.06, -BODY_R - 0.06);
      this.root.add(tail);
    }
    void hair; void hairCapGeo; void hairLongGeo;
    // 모자: 10대·20대는 가끔 비니, 그 외는 가끔 밀짚모자. hue로 결정(1/3만 씀)
    const hatKind = hue % 3 === 0 ? (state.age <= 20 ? 2 : 0) : 9;
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
