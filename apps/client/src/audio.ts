/**
 * 소리를 파일 없이 합성합니다. 저작권 걱정이 없고, 가까운 화로에 따라 소리가 살아 움직입니다.
 * Web Audio API = 브라우저 안의 믹싱 콘솔. 노이즈 → 필터 → 볼륨 → 스피커로 선을 연결합니다.
 */
import type { SceneKind } from "@daengsoon/shared";

export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private cricketGain: GainNode | null = null;
  private waveGain: GainNode | null = null;
  private nearness = 0.3;
  private kind: SceneKind = "mountain";
  enabled = false;

  /** 브라우저는 사용자가 클릭하기 전엔 소리를 못 냅니다(자동재생 차단). 그래서 버튼에서 호출합니다. */
  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.enabled = true;
    this.setKind(this.kind);
  }

  /** 산이면 귀뚜라미, 바다면 파도. 둘 다 불소리보다 작게 깔립니다. */
  setKind(kind: SceneKind) {
    this.kind = kind;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.cricketGain?.gain.setTargetAtTime(kind === "mountain" ? 0.16 : 0, t, 1.2);
    this.waveGain?.gain.setTargetAtTime(kind === "sea" ? 0.22 : 0, t, 1.2);
  }
  async disable() {
    this.enabled = false;
    await this.ctx?.suspend();
  }

  /** 0(멀다)~1(바로 앞) */
  setNearness(v: number) {
    this.nearness = v;
    if (!this.ctx || !this.fireGain) return;
    this.fireGain.gain.setTargetAtTime(0.08 + v * 0.6, this.ctx.currentTime, 0.4);
  }

  /** 불똥 터질 때 "타닥". 가까울수록 크고, 센 것은 두세 번 연달아 */
  crackleAt(strength: number, nearness: number) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const n = strength > 0.7 ? 3 : strength > 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) this.crackle(t + i * (0.03 + Math.random() * 0.05), (0.25 + strength * 0.6) * nearness);
  }

  /** 종이 찢는 "찌익": 노이즈를 짧게, 음높이가 내려가는 필터로 */
  tear() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer!;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.Q.value = 2.5;
    bp.frequency.setValueAtTime(2600, t);
    bp.frequency.exponentialRampToValueAtTime(900, t + 0.35);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.03);
    g.gain.setValueAtTime(0.5, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    src.connect(bp).connect(g).connect(this.master!);
    src.start(t); src.stop(t + 0.45);
  }

  /** 무언가 태울 때 "화르륵" */
  whoosh() {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this.crackle(t + Math.random() * 0.5, 0.6);
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    this.master = master;

    const noise = this.makeNoise(ctx);
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 500;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0.08 + this.nearness * 0.6;
    noise.connect(low).connect(fireGain).connect(master);
    this.fireGain = fireGain;

    const schedule = () => {
      if (this.enabled) this.crackle(ctx.currentTime, 0.04 + this.nearness * 0.1);
      window.setTimeout(schedule, 300 + Math.random() * 900);
    };
    schedule();

    // --- 귀뚜라미: 높은 음(약 4.2kHz)을 초당 ~30번 끊어서 "찌르르" ---
    const cricketGain = ctx.createGain();
    cricketGain.gain.value = 0;
    cricketGain.connect(master);
    this.cricketGain = cricketGain;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 3900 + i * 260;
      const chirp = ctx.createGain(); // 빠른 떨림
      chirp.gain.value = 0;
      const trem = ctx.createOscillator();
      trem.type = "square";
      trem.frequency.value = 26 + i * 5;
      const tremDepth = ctx.createGain();
      tremDepth.gain.value = 0.5;
      trem.connect(tremDepth).connect(chirp.gain);
      const song = ctx.createGain(); // 몇 초 울고 쉬는 호흡
      song.gain.value = 0;
      osc.connect(chirp).connect(song).connect(cricketGain);
      osc.start(); trem.start();
      const breathe = () => {
        const t0 = ctx.currentTime;
        song.gain.setTargetAtTime(0.35, t0, 0.3);
        song.gain.setTargetAtTime(0, t0 + 1.5 + Math.random() * 2.5, 0.4);
        window.setTimeout(breathe, 3000 + Math.random() * 5000);
      };
      window.setTimeout(breathe, i * 1200);
    }

    // --- 파도: 노이즈를 저역 필터로 누르고, 아주 느린 진동으로 밀려왔다 빠지게 ---
    const waveFilter = ctx.createBiquadFilter();
    waveFilter.type = "lowpass";
    waveFilter.frequency.value = 900;
    const waveSwell = ctx.createGain();
    waveSwell.gain.value = 0.3;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.11; // 약 9초에 한 번
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.25;
    lfo.connect(lfoDepth).connect(waveSwell.gain);
    const lfoF = ctx.createGain(); // 밀려올 때 소리가 밝아짐
    lfoF.gain.value = 500;
    lfo.connect(lfoF).connect(waveFilter.frequency);
    lfo.start();
    const waveGain = ctx.createGain();
    waveGain.gain.value = 0;
    noise.connect(waveFilter).connect(waveSwell).connect(waveGain).connect(master);
    this.waveGain = waveGain;
  }

  private crackle(at: number, vol: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = 1200 + Math.random() * 2500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(vol * 0.12, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.02 + Math.random() * 0.03);
    osc.connect(g).connect(this.master!);
    osc.start(at);
    osc.stop(at + 0.08);
  }

  private noiseBuffer: AudioBuffer | null = null;
  private makeNoise(ctx: AudioContext) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    this.noiseBuffer = buf;
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099;
      b1 = 0.963 * b1 + white * 0.2965;
      b2 = 0.57 * b2 + white * 1.0526;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.start();
    return src;
  }
}
