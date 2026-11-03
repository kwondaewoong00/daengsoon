import * as THREE from "three";
import { BRAZIERS, seatById } from "@daengsoon/shared";
import { S } from "./config";

/**
 * 카메라 리그.
 * - 걷기: 캐릭터 등 뒤 2.4m 높이에서 따라갑니다(산사 식 3인칭). 캐릭터가 도는 방향으로 카메라도 천천히 돕니다.
 *   화면을 좌우로 쓸면(드래그) 카메라를 돌려 둘러볼 수 있습니다.
 * - 앉기: 내 자리 어깨 너머에서 불을 바라봅니다.
 * 위치와 시선을 모두 lerp로 부드럽게 옮깁니다.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private pos = new THREE.Vector3(14, 3, 24);
  private look = new THREE.Vector3(14, 1, 18);
  private targetPos = new THREE.Vector3();
  private targetLook = new THREE.Vector3();
  private followX = 700;
  private followY = 900;
  private followFacing = -Math.PI / 2;
  private followMoving = false;
  /** 카메라가 바라보는 방향(월드 facing 과 같은 단위). 캐릭터 facing을 천천히 따라감 */
  private yaw = -Math.PI / 2;
  private seat: number | null = null;
  private portrait = true;
  private snap = true;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 400);
  }

  resize(w: number, h: number) {
    this.camera.aspect = w / h;
    this.portrait = h > w;
    this.camera.fov = this.portrait ? 64 : 50;
    this.camera.updateProjectionMatrix();
  }

  follow(x: number, y: number, facing: number, moving: boolean) {
    this.followX = x;
    this.followY = y;
    this.followFacing = facing;
    this.followMoving = moving;
  }
  /** 손가락으로 쓸어 둘러보기. dx = 화면 픽셀 */
  orbit(dxPixels: number) {
    this.yaw += dxPixels * 0.006;
  }
  focusSeat(seatId: number | null) {
    this.seat = seatId;
  }
  get focused() {
    return this.seat !== null;
  }
  get yawAngle() {
    return this.yaw;
  }

  update(dt: number) {
    const seat = this.seat !== null ? seatById(this.seat) : undefined;
    if (seat) {
      const b = BRAZIERS[seat.brazier];
      const fx = b.x * S, fz = b.y * S;
      const sx = seat.x * S, sz = seat.y * S;
      const dx = sx - fx, dz = sz - fz;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dx / len, nz = dz / len;
      const back = this.portrait ? 2.4 : 2.1;
      const side = this.portrait ? 1.0 : 1.3;
      const height = this.portrait ? 2.3 : 1.9;
      this.targetPos.set(sx + nx * back + -nz * side, height, sz + nz * back + nx * side);
      this.targetLook.set(fx - nx * 0.2, 0.5, fz - nz * 0.2);
      this.yaw = Math.atan2(-nz, -nx); // 일어났을 때 불 쪽을 보고 시작
    } else {
      // 걷는 중이면 카메라가 걷는 방향 뒤로 천천히 돌아감
      if (this.followMoving) {
        let d = this.followFacing - this.yaw;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.yaw += d * Math.min(1, dt * 1.6);
      }
      const px = this.followX * S, pz = this.followY * S;
      const fx = Math.cos(this.yaw), fz = Math.sin(this.yaw);
      const back = this.portrait ? 4.2 : 4.6;
      const up = this.portrait ? 2.6 : 2.2;
      this.targetPos.set(px - fx * back, up, pz - fz * back);
      this.targetLook.set(px + fx * 2.5, 0.9, pz + fz * 2.5);
    }
    const k = this.snap ? 1 : Math.min(1, dt * 3.5);
    this.snap = false;
    this.pos.lerp(this.targetPos, k);
    this.look.lerp(this.targetLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
