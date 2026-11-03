import * as THREE from "three";
import { WORLD, type SceneKind } from "@daengsoon/shared";
import { S, currentSeason, groundFor, skyFor } from "./config";

/**
 * 무대 세팅: 렌더러, 하늘(HDRI = 배경 + 조명), 땅(PBR 텍스처), 안개, 달빛.
 * 비유하면 미니어처 세트에 조명을 설치하고 카메라를 놓는 일입니다.
 */
export class Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private pmrem: THREE.PMREMGenerator;
  private ground: THREE.Mesh | null = null;
  private moon: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private kind: SceneKind | null = null;
  private loadedSky = "";
  private loadedGround = "";
  private texLoader = new THREE.TextureLoader();

  constructor(canvas: HTMLCanvasElement) {
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: dpr < 1.5, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(dpr);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    this.scene.background = new THREE.Color(0x0a0806);
    this.scene.fog = new THREE.FogExp2(0x0b0a10, 0.02);

    this.hemi = new THREE.HemisphereLight(0x8c90c0, 0x3a2e22, 0.9);
    this.scene.add(this.hemi);
    this.moon = new THREE.DirectionalLight(0xffd9b0, 0.55);
    this.moon.position.set(-25, 18, -30); // 지는 해 방향(북서)
    this.scene.add(this.moon);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
  }
  setPixelRatio(r: number) {
    this.renderer.setPixelRatio(r);
    this.renderer.setSize(innerWidth, innerHeight, false);
  }

  /** 산/바다에 맞는 하늘과 땅을 불러옵니다. 이미 같은 걸 쓰고 있으면 아무것도 안 합니다. */
  async setKind(kind: SceneKind): Promise<void> {
    this.kind = kind;
    const sky = skyFor(kind);
    this.skyYaw = sky.yaw;
    const ground = groundFor(kind, currentSeason());
    await Promise.all([this.loadSky(sky.id, sky.exposure, sky.bg, sky.env), this.loadGround(ground.id, ground.repeat, kind)]);
    this.scene.fog = new THREE.FogExp2(kind === "sea" ? 0x6a5c80 : 0x0b0a10, kind === "sea" ? 0.0038 : 0.02);
    // 바다는 보랏빛 저녁 하늘이 반구광에도 배게
    this.hemi.color.set(kind === "sea" ? 0x9a86b4 : 0x8c90c0);
    this.hemi.groundColor.set(kind === "sea" ? 0x4a3c30 : 0x3a2e22);
  }

  private async loadSky(id: string, exposure: number, bg: number, envIntensity: number) {
    if (this.loadedSky === id) return;
    const hdr = await this.texLoader.loadAsync(`${import.meta.env.BASE_URL}assets/hdri/${id}_1k.jpg`);
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    hdr.colorSpace = THREE.SRGBColorSpace;
    const env = this.pmrem.fromEquirectangular(hdr).texture;
    this.scene.environment = env;
    this.scene.environmentIntensity = envIntensity * 1.3;
    this.scene.background = hdr;
    this.scene.backgroundIntensity = bg;
    this.scene.backgroundBlurriness = 0.02;
    this.renderer.toneMappingExposure = exposure;
    this.loadedSky = id;
  }

  private async loadGround(id: string, repeat: number, kind: SceneKind) {
    if (this.loadedGround === id) return;
    const base = `${import.meta.env.BASE_URL}assets/tex/${id}/${id}`;
    const [diff, nor, arm] = await Promise.all([
      this.texLoader.loadAsync(`${base}_diff_1k.jpg`),
      this.texLoader.loadAsync(`${base}_nor_gl_1k.jpg`),
      this.texLoader.loadAsync(`${base}_arm_1k.jpg`),
    ]);
    for (const t of [diff, nor, arm]) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat, repeat);
      t.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    }
    diff.colorSpace = THREE.SRGBColorSpace;
    arm.channel = 0; // aoMap은 기본 uv1을 보므로 uv0을 쓰게
    const mat = new THREE.MeshStandardMaterial({
      // 모래는 반사율이 높아 불빛에 하얗게 날아가므로 살짝 눌러줌
      // 가을 낙엽 바닥은 살짝 초록을 섞어 풀과 어울리게
      color: kind === "sea" ? 0xc9bfae : 0xd8e0b8,
      map: diff,
      normalMap: nor,
      aoMap: arm,
      roughnessMap: arm,
      metalnessMap: arm,
      metalness: 1,
      roughness: 1,
      normalScale: new THREE.Vector2(0.8, 0.8),
    });
    if (this.ground) this.scene.remove(this.ground);
    const size = 120;
    const geo = new THREE.PlaneGeometry(size, size);
    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set((WORLD.w * S) / 2, 0, (WORLD.h * S) / 2);
    this.ground.receiveShadow = false;
    this.scene.add(this.ground);
    this.loadedGround = id;
  }

  /** 배경(하늘)을 아주 천천히 돌려 구름·별이 흐르게. 한 바퀴에 약 40분 */
  /** 하늘 사진에서 가장 밝은 곳(해/달)을 어느 방향에 둘지. 바다는 북쪽(바다 쪽)에 노을이 오게 */
  skyYaw = 0;
  tick(t: number) {
    this.scene.backgroundRotation.set(0, this.skyYaw + t * 0.0026, 0);
    this.scene.environmentRotation.set(0, this.skyYaw + t * 0.0026, 0);
    this.moon.intensity = 0.55 + Math.sin(t * 0.11) * 0.05;
  }

  render(camera: THREE.Camera) {
    this.renderer.render(this.scene, camera);
  }
}
