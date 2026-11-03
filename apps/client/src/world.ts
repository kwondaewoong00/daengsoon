import * as THREE from "three";
import { BRAZIERS, SEATS, WORLD, itemById, seatById, type ItemId, type PlayerState, type SceneKind, type Seat } from "@daengsoon/shared";
import { Stage } from "./three/scene";
import { Fire3D } from "./three/fire";
import { Character } from "./three/character";
import { makeBraziers, makeGroundDressing, makeStumps, makeSurroundings, type Stump } from "./three/props";
import { CameraRig } from "./three/camera";
import { BurnFx } from "./three/fx";
import { S } from "./three/config";

/**
 * World = 3D 캠프장 전체.
 * 서버가 준 상태(플레이어 목록)를 받아 캐릭터·불·소품을 매 프레임 그립니다. 상태를 바꾸지는 않습니다.
 */
export class World {
  readonly stage: Stage;
  readonly rig: CameraRig;
  readonly fires: Fire3D[];
  readonly chars = new Map<string, Character>();
  private stumps: Stump[];
  private surroundings: THREE.Group | null = null;
  private dressing: THREE.Group | null = null;
  private water: THREE.Mesh | null = null;
  private fx = new BurnFx();
  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private _kind: SceneKind = "mountain";
  private hover: Stump | null = null;
  private t = 0;
  private tags = new Map<string, HTMLDivElement>();
  private tagLayer: HTMLElement;
  private tmp = new THREE.Vector3();
  selfId = "";
  ready = false;
  /** 가까운 불이 타닥 할 때(0~1 세기, 0~1 가까움) */
  onCrackle: ((strength: number, nearness: number) => void) | null = null;

  constructor(canvas: HTMLCanvasElement, tagLayer: HTMLElement) {
    this.tagLayer = tagLayer;
    this.stage = new Stage(canvas);
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.fires = BRAZIERS.map((b) => new Fire3D(b));
    for (const f of this.fires) {
      this.stage.scene.add(f.group);
      f.onPop = (strength) => {
        const me = this.chars.get(this.selfId);
        if (!me) return;
        const d = Math.hypot(f.brazier.x - me.x, f.brazier.y - me.y);
        const near = Math.max(0, 1 - d / 420);
        if (near > 0.05) this.onCrackle?.(strength, near);
      };
    }
    for (const g of makeBraziers()) this.stage.scene.add(g);
    this.stumps = makeStumps();
    for (const s of this.stumps) this.stage.scene.add(s.mesh);
    this.stage.scene.add(this.fx.group);
  }

  get kind() {
    return this._kind;
  }
  /** 산/바다 전환: 하늘·땅·주변 풍경을 교체 */
  async setKind(k: SceneKind) {
    this._kind = k;
    if (this.surroundings) this.stage.scene.remove(this.surroundings);
    if (this.dressing) this.stage.scene.remove(this.dressing);
    this.dressing = makeGroundDressing(k);
    this.stage.scene.add(this.dressing);
    const sur = makeSurroundings(k);
    this.surroundings = sur.group;
    this.water = sur.water;
    this.stage.scene.add(sur.group);
    await this.stage.setKind(k);
    this.ready = true;
  }

  resize(w: number, h: number) {
    this.stage.resize(w, h);
    this.rig.resize(w, h);
  }

  // ---------- 상태 반영 ----------
  upsert(p: PlayerState) {
    const c = this.chars.get(p.id);
    if (c) {
      c.state = { ...c.state, ...p };
    } else {
      const ch = new Character(p, p.id === this.selfId);
      this.chars.set(p.id, ch);
      this.stage.scene.add(ch.group);
      // 이름표 (HTML). 매 프레임 머리 위로 투영
      const tag = document.createElement("div");
      tag.className = "tag" + (p.id === this.selfId ? " me" : "");
      tag.innerHTML = (p.id === this.selfId ? '<span class="who">나</span>' : "") + `<span>${escapeHtml(p.name)}</span>`;
      this.tagLayer.appendChild(tag);
      this.tags.set(p.id, tag);
    }
  }
  patch(p: Partial<PlayerState> & { id: string }) {
    const c = this.chars.get(p.id);
    if (c) Object.assign(c.state, p);
  }
  remove(id: string) {
    const c = this.chars.get(id);
    if (!c) return;
    this.stage.scene.remove(c.group);
    this.chars.delete(id);
    this.tags.get(id)?.remove();
    this.tags.delete(id);
  }
  clear() {
    for (const id of [...this.chars.keys()]) this.remove(id);
  }

  burn(playerId: string, seatId: number, item: ItemId) {
    const seat = seatById(seatId);
    const def = itemById(item);
    if (!seat || !def) return;
    const fire = this.fires[seat.brazier];
    const from = new THREE.Vector3(seat.x * S, 1.2, seat.y * S);
    const c = this.chars.get(playerId);
    if (c) c.headWorldPos(from);
    const to = new THREE.Vector3(fire.brazier.x * S, 0.5, fire.brazier.y * S);
    this.fx.throwItem(def, from, to, () => fire.burn(def.flash));
  }

  // ---------- 입력 도우미 ----------
  /** 화면 좌표 → 땅 위 월드 좌표. 땅을 안 가리키면 null */
  pickGround(sx: number, sy: number): { x: number; y: number } | null {
    const ndc = new THREE.Vector2((sx / innerWidth) * 2 - 1, -(sy / innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.rig.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return { x: hit.x / S, y: hit.z / S };
  }

  seatNear(x: number, y: number, radius = 48): Seat | null {
    const occupied = new Set<number>();
    for (const c of this.chars.values()) if (c.state.seat !== null && c.state.id !== this.selfId) occupied.add(c.state.seat);
    let best: Seat | null = null, bd = radius;
    for (const s of SEATS) {
      if (occupied.has(s.id)) continue;
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  setHoverSeat(seat: Seat | null) {
    const st = seat ? this.stumps[seat.id] : null;
    if (this.hover === st) return;
    this.hover?.setHover(false);
    this.hover = st;
    this.hover?.setHover(true);
  }

  /** 월드 좌표를 화면 좌표로 (자동 테스트용) */
  toScreen(x: number, y: number) {
    const v = new THREE.Vector3(x * S, 0, y * S).project(this.rig.camera);
    return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
  }

  // ---------- 매 프레임 ----------
  /** dt: 시뮬레이션용(캡 있음), camDt: 카메라용(느린 기기에서도 제때 따라오도록 캡이 큼) */
  update(dt: number, camDt = dt) {
    this.t += dt;
    const me = this.chars.get(this.selfId);
    if (me) {
      this.rig.follow(me.x, me.y, me.state.facing, me.state.moving);
      // 1인칭(앉음)에서는 내 몸이 카메라를 가리므로 숨김. 이름표도 같이.
      const firstPerson = this.rig.focused;
      me.group.visible = !firstPerson;
      const myTag = this.tags.get(this.selfId);
      if (myTag) myTag.style.visibility = firstPerson ? "hidden" : "";
    }
    this.rig.update(camDt);
    for (const c of this.chars.values()) c.update(dt, this.t);
    this.updateTags();
    for (const f of this.fires) f.update(dt);
    this.fx.update(dt);
    if (this.water) ((this.water.material as THREE.ShaderMaterial).uniforms.uTime.value = this.t);
    // 앉은 자리의 그루터기는 캐릭터 밑에 그대로 둠(앉아 있는 모습). 빈 자리만 하이라이트 가능
    this.stage.render(this.rig.camera);
  }

  private updateTags() {
    const cam = this.rig.camera;
    for (const [id, tag] of this.tags) {
      const c = this.chars.get(id);
      if (!c) continue;
      c.headWorldPos(this.tmp);
      this.tmp.y += 0.3;
      const dist = this.tmp.distanceTo(cam.position);
      this.tmp.project(cam);
      const behind = this.tmp.z > 1;
      if (behind || dist > 16) {
        tag.style.display = "none";
        continue;
      }
      tag.style.display = "";
      const x = ((this.tmp.x + 1) / 2) * innerWidth;
      const y = ((1 - this.tmp.y) / 2) * innerHeight;
      tag.style.transform = `translate(-50%, -100%) translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
      tag.style.opacity = String(Math.max(0.25, 1 - dist / 16));
    }
  }

  /** 가장 가까운 화로까지의 거리(월드 단위) */
  nearestFireDistance(x: number, y: number) {
    let d = Infinity;
    for (const b of BRAZIERS) d = Math.min(d, Math.hypot(b.x - x, b.y - y));
    return d;
  }

  static readonly bounds = WORLD;
}

function escapeHtml(t: string) {
  return t.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}
