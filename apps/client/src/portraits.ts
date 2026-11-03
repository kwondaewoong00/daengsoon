import * as THREE from "three";
import { SPECIES, type AgeBand, type Species } from "@daengsoon/shared";
import { Character } from "./three/character";

/**
 * 첫 화면의 동물 고르기용 초상화. 실제 3D 캐릭터를 작은 화면에 그려 이미지로 뽑습니다.
 * 그래서 고른 그대로 캠프에 나타납니다(그림과 실물이 같음).
 */
let renderer: THREE.WebGLRenderer | null = null;
export function renderPortraits(hue: number, age: AgeBand = 20): Record<Species, string> {
  const W = 160, H = 190;
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(W, H, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8a6a50, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(1.5, 2.5, 2.5);
  scene.add(key);
  const cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 10);
  cam.position.set(0, 1.05, 3.1);
  cam.lookAt(0, 0.78, 0);
  const out = {} as Record<Species, string>;
  for (const sp of SPECIES) {
    const ch = new Character(
      { id: "p", name: "", species: sp.id, gender: "m", age, x: 0, y: 0, hue, seat: null, moving: false, facing: Math.PI / 2 },
      false,
    );
    ch.group.position.set(0, 0, 0);
    ch.group.rotation.y = 0.35; // 살짝 비스듬히
    scene.add(ch.group);
    ch.update(0, 0);
    renderer.render(scene, cam);
    out[sp.id] = renderer.domElement.toDataURL("image/png");
    scene.remove(ch.group);
  }
  return out;
}
