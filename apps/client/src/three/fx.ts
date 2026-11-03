import * as THREE from "three";
import type { ItemDef } from "@daengsoon/shared";

/** 이모지를 캔버스에 그려 스프라이트 텍스처로 */
const texCache = new Map<string, THREE.Texture>();
function emojiTexture(emoji: string) {
  let t = texCache.get(emoji);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "96px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 64, 70);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(emoji, t);
  return t;
}

interface Flight { sprite: THREE.Sprite; from: THREE.Vector3; to: THREE.Vector3; t: number; onHit: () => void; fired: boolean }
interface Ash { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }

const ashGeo = new THREE.BoxGeometry(0.03, 0.03, 0.03);
const ashMat = new THREE.MeshBasicMaterial({ color: 0x8a8078, transparent: true });

/** 태우기 연출: 물건이 사람 머리에서 불로 포물선을 그리며 날아가고, 닿으면 재가 날립니다. */
export class BurnFx {
  readonly group = new THREE.Group();
  private flights: Flight[] = [];
  private ashes: Ash[] = [];

  throwItem(def: ItemDef, from: THREE.Vector3, to: THREE.Vector3, onHit: () => void) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(def.emoji), transparent: true, depthWrite: false }));
    sprite.scale.setScalar(0.45);
    sprite.position.copy(from);
    this.group.add(sprite);
    this.flights.push({ sprite, from: from.clone(), to: to.clone(), t: 0, onHit, fired: false });
  }

  update(dt: number) {
    this.flights = this.flights.filter((f) => {
      f.t += dt;
      const k = Math.min(1, f.t / 0.75);
      const e = 1 - (1 - k) * (1 - k);
      f.sprite.position.lerpVectors(f.from, f.to, e);
      f.sprite.position.y += Math.sin(k * Math.PI) * 0.8;
      f.sprite.material.rotation = Math.sin(f.t * 6) * 0.3;
      if (k >= 1 && !f.fired) {
        f.fired = true;
        f.onHit();
        for (let i = 0; i < 24; i++) {
          const m = new THREE.Mesh(ashGeo, ashMat.clone());
          m.position.copy(f.to).add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3));
          this.group.add(m);
          this.ashes.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0.9 + Math.random() * 1.6, (Math.random() - 0.5) * 0.8), life: 1.2 + Math.random() * 1.5 });
        }
      }
      if (f.t > 1.05) {
        this.group.remove(f.sprite);
        f.sprite.material.dispose();
        return false;
      }
      f.sprite.material.opacity = f.t > 0.75 ? Math.max(0, 1 - (f.t - 0.75) / 0.3) : 1;
      return true;
    });
    this.ashes = this.ashes.filter((a) => {
      a.life -= dt;
      a.vel.y *= 1 - dt * 0.6;
      a.vel.x += Math.sin(a.mesh.position.y * 3 + a.life * 5) * dt * 0.5;
      a.mesh.position.addScaledVector(a.vel, dt);
      (a.mesh.material as THREE.MeshBasicMaterial).opacity = Math.min(1, a.life);
      if (a.life <= 0) {
        this.group.remove(a.mesh);
        return false;
      }
      return true;
    });
  }
}
