import * as THREE from "three";
import { BRAZIERS, seatById } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 카메라 리그.
 * - 걷기: 내 캐릭터를 비스듬히 위에서 따라갑니다.
 * - 앉기: 내 자리 뒤쪽 낮은 곳에서 불을 바라봅니다. 건너편 사람들이 불 너머로 보입니다.
 * 위치와 시선을 모두 lerp로 부드럽게 옮깁니다.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3(14, 10, 20);
  private look = new THREE.Vector3(14, 0, 10);
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private followX = 700;
  private followY = 900;
  private seat: number | null = null;
  private portrait = true;
  private snap = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 400);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.camera.fov = this.portrait ? 70 : 52;
    this.camera.updateProjectionMatrix();
  }

  follow(x: number, y: number) {
    this.followX = x;
    this.followY = y;
  }
  focusSeat(seatId: number | null) {
    this.seat = seatId;
  }
  get focused() {
    return this.seat !== null;
  }

  update(dt: number) {
    const seat = this.seat !== null ? seatById(this.seat) : undefined;
    if (seat) {
      const b = BRAZIERS[seat.brazier];
      const fx = b.x * S, fz = b.y * S;
      const sx = seat.x * S, sz = seat.y * S;
      // 자리에서 불 반대 방향으로 물러난 위치
      const dx = sx - fx, dz = sz - fz;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dx / len, nz = dz / len;
      // 어깨 너머 시점: 내 뒤로 물러나되 옆으로 살짝 비켜서 내 머리가 불을 가리지 않게
      const back = this.portrait ? 2.4 : 2.1;
      const side = this.portrait ? 1.0 : 1.3;
      const height = this.portrait ? 2.3 : 1.9;
      this.targetPos.set(sx + nx * back + -nz * side, height, sz + nz * back + nx * side);
      this.targetLook.set(fx - nx * 0.2, 0.5, fz - nz * 0.2);
    } else {
      const px = this.followX * S, pz = this.followY * S;
      // 비스듬히: 위에서 내려다보되 지평선이 화면 위쪽에 걸리게
      const up = this.portrait ? 9.5 : 7.5;
      const backZ = this.portrait ? 10 : 9.5;
      this.targetPos.set(px, up, pz + backZ);
      this.targetLook.set(px, 0.6, pz - 4);
    }
    const k = this.snap ? 1 : Math.min(1, dt * 3.2);
    this.snap = false;
    this.pos.lerp(this.targetPos, k);
    this.look.lerp(this.targetLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
