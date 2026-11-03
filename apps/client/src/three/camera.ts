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
  /** 앉아서 고개 돌린 각도(라디안). 쓸기로 바뀌고, 손을 떼면 천천히 불 쪽으로 돌아옴 */
  private headTurn = 0;
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
    if (this.seat !== null) {
      this.headTurn = Math.max(-1.3, Math.min(1.3, this.headTurn - dxPixels * 0.005));
    } else {
      this.yaw += dxPixels * 0.006;
    }
  }
  focusSeat(seatId: number | null) {
    if (seatId !== this.seat) this.headTurn = 0;
    this.seat = seatId;
  }
  get focused() {
    return this.seat !== null;
  }
  get yawAngle() {
    return this.yaw;
  }

  private breath = 0;

  update(dt: number) {
    this.breath += dt;
    const seat = this.seat !== null ? seatById(this.seat) : undefined;
    if (seat) {
      const b = BRAZIERS[seat.brazier];
      const fx = b.x * S, fz = b.y * S;
      const sx = seat.x * S, sz = seat.y * S;
      const dx = sx - fx, dz = sz - fz;
      const len = Math.hypot(dx, dz) || 1;
      const nx = dx / len, nz = dz / len;
      // 1인칭: 앉은 내 눈 높이(약 0.95m)에서 불을 바라봄. 숨쉬듯 아주 살짝 흔들림
      // 1인 화로는 바로 코앞(0.5m)이라 눈을 조금 더 들고 뒤로 물러남
      const small = b.size === "small";
      // 큰 모닥불은 불꽃이 1m 넘게 올라오므로 조금 물러나 앉은 눈높이에서 전체가 보이게
      const eyeH = (small ? 1.05 : 1.1) + Math.sin(this.breath * 1.1) * 0.012;
      const backOff = small ? 0.3 : 0.6;
      this.targetPos.set(sx + nx * backOff, eyeH, sz + nz * backOff);
      // 시선: 불꽃 아랫부분(장작 위). 고개를 돌리면 그 방향으로
      const toFire = Math.atan2(-nz, -nx) + this.headTurn;
      // 불은 화면 가운데 아래, 그 위로 하늘·풍경이 보이게 시선을 살짝 올림
      const lookDist = small ? 1.0 : 1.7;
      const lookH = (small ? 0.85 : 0.75) - Math.abs(this.headTurn) * 0.15;
      this.targetLook.set(sx + Math.cos(toFire) * lookDist, lookH, sz + Math.sin(toFire) * lookDist);
      // 손을 뗀 뒤 천천히 불 쪽으로 돌아옴
      this.headTurn *= 1 - Math.min(1, dt * 0.35);
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
      // 낮게 서서 조금 위를 봄 → 하늘이 화면 위 1/3을 차지
      const back = this.portrait ? 4.2 : 4.6;
      const up = this.portrait ? 2.6 : 2.3;
      this.targetPos.set(px - fx * back, up, pz - fz * back);
      this.targetLook.set(px + fx * 4.0, 1.75, pz + fz * 4.0);
    }
    const k = this.snap ? 1 : Math.min(1, dt * (seat ? 2.2 : 3.5));
    this.snap = false;
    this.pos.lerp(this.targetPos, k);
    this.look.lerp(this.targetLook, k);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }
}
