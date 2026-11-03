import * as THREE from "three";
import type { ItemDef } from "@daengsoon/shared";
import { halfPaperGeo, paperMaterial } from "./fx";

/**
 * 1인칭 손. 카메라에 붙어 있어 화면 아래에서 올라옵니다.
 * 시퀀스: 꺼내 들기(0.45s) → 잠깐 보기(0.35s) → 찢기(0.5s, 두 손이 벌어지며 종이가 둘로) → 던지기(0.35s) → 손 내리기
 * 던지는 순간 onThrow(left, right) 로 조각의 월드 위치를 넘겨주면 World 가 불로 날립니다.
 */
const skin = new THREE.MeshStandardMaterial({ color: 0xf2c9a8, roughness: 0.8 });
const sleeve = new THREE.MeshStandardMaterial({ color: 0x7a8c5a, roughness: 0.9 });
const handGeo = new THREE.SphereGeometry(0.075, 16, 12);
const thumbGeo = new THREE.CapsuleGeometry(0.022, 0.04, 4, 8);
const sleeveGeo = new THREE.CapsuleGeometry(0.06, 0.25, 4, 12);

export class Hands {
  readonly group = new THREE.Group();
  private handL = new THREE.Group();
  private handR = new THREE.Group();
  private paperL: THREE.Mesh | null = null;
  private paperR: THREE.Mesh | null = null;
  private t = -1;
  private onThrow: ((l: THREE.Mesh, r: THREE.Mesh) => void) | null = null;
  private onTear: (() => void) | null = null;
  private tore = false;

  constructor() {
    for (const [g, sx] of [[this.handL, -1], [this.handR, 1]] as const) {
      const hand = new THREE.Mesh(handGeo, skin);
      hand.scale.set(1, 0.8, 1.1);
      const thumb = new THREE.Mesh(thumbGeo, skin);
      thumb.position.set(-sx * 0.06, 0.03, 0.03);
      thumb.rotation.z = sx * 0.9;
      const arm = new THREE.Mesh(sleeveGeo, sleeve);
      arm.position.set(sx * 0.03, -0.17, -0.08);
      arm.rotation.x = 0.5;
      g.add(hand, thumb, arm);
      this.group.add(g);
    }
    this.group.visible = false;
  }

  get busy() { return this.t >= 0; }

  /** 시작. 카메라 로컬 좌표계에서 움직임 */
  start(def: ItemDef, onTear: () => void, onThrow: (l: THREE.Mesh, r: THREE.Mesh) => void) {
    if (this.paperL) { this.handL.remove(this.paperL); this.handR.remove(this.paperR!); }
    const mat = paperMaterial(def);
    this.paperL = new THREE.Mesh(halfPaperGeo("L", 0.15, 0.2), mat);
    this.paperR = new THREE.Mesh(halfPaperGeo("R", 0.15, 0.2), mat);
    // 두 손 사이에 한 장처럼 보이게: 각 손이 자기 반쪽을 듦
    this.paperL.position.set(0.045, 0.07, 0.03);
    this.paperR.position.set(-0.045, 0.07, 0.03);
    this.handL.add(this.paperL);
    this.handR.add(this.paperR);
    this.onTear = onTear;
    this.onThrow = onThrow;
    this.tore = false;
    this.t = 0;
    this.group.visible = true;
  }

  update(dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    const T = this.t;
    // 기본 위치: 화면 아래 바깥
    let y = -0.45, z = -0.5, spread = 0.05, tilt = 0.2, tear = 0, throwK = 0;
    if (T < 0.45) { const e = ease(T / 0.45); y = -0.45 + 0.25 * e; }                 // 올라옴
    else if (T < 0.8) { y = -0.2; }                                                     // 들고 봄
    else if (T < 1.3) { const e = ease((T - 0.8) / 0.5); y = -0.2; spread = 0.05 + 0.06 * e; tear = e; if (!this.tore && e > 0.15) { this.tore = true; this.onTear?.(); } }
    else if (T < 1.65) { const e = (T - 1.3) / 0.35; y = -0.2 + 0.1 * Math.sin(e * Math.PI); z = -0.5 - 0.25 * e; spread = 0.11; tear = 1; throwK = e;
      if (this.paperL && e > 0.35) { // 손에서 떨어져 나감
        const l = this.paperL, r = this.paperR!; this.paperL = this.paperR = null;
        this.onThrow?.(l, r);
      } }
    else if (T < 2.1) { const e = ease((T - 1.65) / 0.45); y = -0.1 - 0.4 * e; z = -0.75 + 0.25 * e; spread = 0.11; tear = 1; }
    else { this.t = -1; this.group.visible = false; return; }

    const bob = Math.sin(T * 6) * 0.004;
    this.handL.position.set(-spread, y + bob, z);
    this.handR.position.set(spread, y + bob, z);
    this.handL.rotation.set(tilt, 0.3 + tear * 0.5, 0.2 + throwK * 0.4);
    this.handR.rotation.set(tilt, -0.3 - tear * 0.5, -0.2 - throwK * 0.4);
    if (this.paperL && this.paperR) {
      // 찢기: 반쪽이 바깥으로 젖혀짐
      this.paperL.rotation.set(0, -tear * 0.9, tear * 0.25);
      this.paperR.rotation.set(0, tear * 0.9, -tear * 0.25);
    }
  }
}
function ease(k: number) { return k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k); }
