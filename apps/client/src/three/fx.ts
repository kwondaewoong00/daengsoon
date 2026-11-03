import * as THREE from "three";
import type { ItemDef } from "@daengsoon/shared";

/** 태울 물건의 종이 텍스처: 종이색 바탕 + 줄 + 이모지 + 이름. 반쪽은 UV로 잘라 씁니다 */
const texCache = new Map<string, THREE.CanvasTexture>();
export function paperTexture(def: ItemDef) {
  let t = texCache.get(def.id);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = 256; c.height = 340;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f7f1e3";
  g.fillRect(0, 0, 256, 340);
  g.strokeStyle = "rgba(90, 70, 40, 0.18)";
  g.lineWidth = 2;
  for (let y = 60; y < 320; y += 26) { g.beginPath(); g.moveTo(24, y); g.lineTo(232, y); g.stroke(); }
  g.font = "110px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(def.emoji, 128, 150);
  g.fillStyle = "#3a2a1a";
  g.font = "700 40px 'Jua', 'Noto Sans KR', sans-serif";
  g.fillText(def.label, 128, 280);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(def.id, t);
  return t;
}
/** 왼쪽/오른쪽 반 장짜리 평면(찢어진 가장자리는 살짝 들쭉날쭉) */
export function halfPaperGeo(side: "L" | "R", w = 0.22, h = 0.3) {
  const geo = new THREE.PlaneGeometry(w / 2, h, 1, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const edge = side === "L" ? x > 0 : x < 0; // 찢긴 쪽
    if (edge && i % 2 === 0) pos.setX(i, x + (side === "L" ? 1 : -1) * (Math.random() * 0.012));
    uv.setX(i, side === "L" ? uv.getX(i) * 0.5 : 0.5 + uv.getX(i) * 0.5);
  }
  geo.translate(side === "L" ? -w / 4 : w / 4, 0, 0);
  return geo;
}
export function paperMaterial(def: ItemDef) {
  return new THREE.MeshStandardMaterial({ map: paperTexture(def), roughness: 0.9, side: THREE.DoubleSide });
}

interface Flight { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; spin: THREE.Vector3; onHit: () => void; fired: boolean }
interface Ash { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
const ashGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
const ashMat = new THREE.MeshBasicMaterial({ color: 0x8a8078, transparent: true });

/** 날아가는 조각들과 재 */
export class BurnFx {
  readonly group = new THREE.Group();
  private flights: Flight[] = [];
  private ashes: Ash[] = [];

  /** 아무 물체나 포물선으로 불에 던져 넣기. 닿으면 onHit, 그 뒤 재가 날림 */
  throwMesh(mesh: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, onHit: () => void, dur = 0.7) {
    mesh.position.copy(from);
    this.group.add(mesh);
    this.flights.push({ mesh, from: from.clone(), to: to.clone(), t: 0, dur, spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8), onHit, fired: false });
  }

  update(dt: number) {
    this.flights = this.flights.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = 1 - (1 - k) * (1 - k);
      f.mesh.position.lerpVectors(f.from, f.to, e);
      f.mesh.position.y += Math.sin(k * Math.PI) * 0.6;
      f.mesh.rotation.x += f.spin.x * dt; f.mesh.rotation.y += f.spin.y * dt; f.mesh.rotation.z += f.spin.z * dt;
      if (k >= 1 && !f.fired) {
        f.fired = true;
        f.onHit();
        for (let i = 0; i < 16; i++) {
          const m = new THREE.Mesh(ashGeo, ashMat.clone());
          m.position.copy(f.to).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
          this.group.add(m);
          this.ashes.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8), life: 1.2 + Math.random() * 1.5 });
        }
      }
      // 불에 닿은 뒤 0.35초 동안 오그라들며 사라짐
      if (f.t > f.dur) {
        const sh = Math.max(0, 1 - (f.t - f.dur) / 0.35);
        f.mesh.scale.setScalar(sh);
        if (sh <= 0) { this.group.remove(f.mesh); return false; }
      }
      return true;
    });
    this.ashes = this.ashes.filter((a) => {
      a.life -= dt;
      a.vel.y *= 1 - dt * 0.6;
      a.vel.x += Math.sin(a.mesh.position.y * 3 + a.life * 5) * dt * 0.5;
      a.mesh.position.addScaledVector(a.vel, dt);
      (a.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, a.life);
      if (a.life <= 0) { this.group.remove(a.mesh); return false; }
      return true;
    });
  }
}
