import type { SceneKind } from "@daengsoon/shared";

/**
 * 소리. 실제 녹음(CC0)을 재생합니다. Web Audio API = 브라우저 안의 믹싱 콘솔.
 *  - 불: 29초 벽난로 녹음을 끊김 없이 반복. 가까울수록 크고, 멀면 저역만 남김(둔하게)
 *  - 타닥: 불똥 튀는 녹음의 일부(무작위 구간 0.25초)를 터질 때마다 재생. 음높이도 조금씩 다르게
 *  - 환경음: 산은 귀뚜라미 반복, 바다는 파도 두 녹음을 번갈아 밀려왔다 빠지듯
 *  - 찢기: 녹음이 없어 노이즈로 합성(짧아서 티가 덜 남)
 */
const BASE = `${import.meta.env.BASE_URL}assets/snd/`;

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private fireLow: BiquadFilterNode | null = null;
  private cricketGain: GainNode | null = null;
  private waveGain: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private nearness = 0.3;
  private kind: SceneKind = "mountain";
  private waveTimer: number | undefined;
  private loaded = false;
  enabled = false;

  /** 사용자가 뭔가 누른 뒤에만 소리를 낼 수 있어서(자동재생 제한) 버튼에서 호출합니다 */
  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.enabled = true;
    if (!this.loaded) await this.load();
    this.setKind(this.kind);
    this.setNearness(this.nearness);
  }
  async disable() {
    this.enabled = false;
    await this.ctx?.suspend();
  }

  setKind(kind: SceneKind) {
    this.kind = kind;
    if (!this.ctx || !this.loaded) return;
    const t = this.ctx.currentTime;
    this.cricketGain?.gain.setTargetAtTime(kind === "mountain" ? 0.5 : 0, t, 1.2);
    this.waveGain?.gain.setTargetAtTime(kind === "sea" ? 0.8 : 0, t, 1.2);
  }

  /** 0(멀다)~1(바로 앞). 멀면 작아지고 둔해짐 */
  setNearness(v: number) {
    this.nearness = v;
    if (!this.ctx || !this.fireGain || !this.fireLow) return;
    const t = this.ctx.currentTime;
    this.fireGain.gain.setTargetAtTime(0.05 + v * v * 0.95, t, 0.4);
    this.fireLow.frequency.setTargetAtTime(600 + v * 7000, t, 0.4);
  }

  /** 불똥 터질 때 */
  crackleAt(strength: number, nearness: number) {
    if (!this.enabled) return;
    const n = strength > 0.7 ? 2 : 1;
    for (let i = 0; i < n; i++) this.playSlice("crackle", 0.18 + Math.random() * 0.22, (0.3 + strength * 0.7) * nearness, 0.85 + Math.random() * 0.4, i * 0.12);
  }
  /** 종이 찢는 "찌익" */
  tear() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 1.8;
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(700, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.04);
    g.gain.setValueAtTime(0.35, t + 0.28);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t); src.stop(t + 0.5);
  }
  /** 던져 넣을 때: 불똥 녹음을 길게 + 약간 낮게 */
  whoosh() {
    if (!this.enabled) return;
    this.playSlice("crackle", 1.2, 0.9, 0.8, 0);
    this.playSlice("crackle", 0.6, 0.6, 1.1, 0.35);
  }

  // ---------- 내부 ----------
  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    this.master = master;
    this.fireLow = ctx.createBiquadFilter();
    this.fireLow.type = "lowpass";
    this.fireLow.frequency.value = 3000;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    this.fireLow.connect(this.fireGain).connect(master);
    this.cricketGain = ctx.createGain();
    this.cricketGain.gain.value = 0;
    this.cricketGain.connect(master);
    this.waveGain = ctx.createGain();
    this.waveGain.gain.value = 0;
    this.waveGain.connect(master);
  }

  private async load() {
    const ctx = this.ctx!;
    const names = ["fire_loop", "crackle", "wave_1", "wave_2", "crickets"];
    await Promise.all(names.map(async (n) => {
      try {
        const res = await fetch(`${BASE}${n}.mp3`);
        const buf = await ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(n, buf);
      } catch (e) {
        console.warn("sound load failed", n, e);
      }
    }));
    this.loaded = true;
    this.loop("fire_loop", this.fireLow!);
    this.loop("crickets", this.cricketGain!);
    this.scheduleWave();
  }

  private loop(name: string, dest: AudioNode) {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(dest);
    src.start(this.ctx.currentTime + Math.random() * 0.5);
  }

  /** 파도: 4초짜리 두 녹음을 번갈아, 사이에 1~3초 쉬면서 밀려왔다 빠지는 호흡 */
  private scheduleWave() {
    const play = () => {
      if (this.ctx && this.enabled && this.kind === "sea") {
        const name = Math.random() < 0.5 ? "wave_1" : "wave_2";
        const buf = this.buffers.get(name);
        if (buf) {
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = 0.9 + Math.random() * 0.2;
          const g = this.ctx.createGain();
          g.gain.value = 0.7 + Math.random() * 0.3;
          src.connect(g).connect(this.waveGain!);
          src.start();
        }
      }
      this.waveTimer = window.setTimeout(play, 3500 + Math.random() * 2500);
    };
    play();
  }

  private playSlice(name: string, dur: number, vol: number, rate: number, delay: number) {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx) return;
    const ctx = this.ctx;
    const start = Math.random() * Math.max(0, buf.duration - dur);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.setValueAtTime(vol, t + dur - 0.08);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(g).connect(this.master!);
    src.start(t, start, dur + 0.05);
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise(ctx: AudioContext) {
    if (this.noiseBuf) return this.noiseBuf;
    const len = ctx.sampleRate;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    this.noiseBuf = buf;
    return buf;
  }
}
