import type { Mode } from "@daengsoon/shared";

/**
 * 소리를 파일 없이 "합성"합니다. 저작권 걱정이 없고, 세기에 따라 소리가 살아 움직입니다.
 * - 불: 낮게 깔린 노이즈(타는 소리) + 무작위로 터지는 짧은 "탁" (장작 튀는 소리)
 * - 물: 느리게 출렁이는 필터를 통과한 노이즈
 * Web Audio API = 브라우저 안의 믹싱 콘솔. 노이즈 → 필터 → 볼륨 → 스피커 순서로 선을 연결합니다.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private waterGain: GainNode | null = null;
  private waterFilter: BiquadFilterNode | null = null;
  private crackleTimer: number | undefined;
  private intensity = 0.5;
  enabled = false;

  /** 브라우저는 사용자가 클릭하기 전엔 소리를 못 냅니다(자동재생 차단). 그래서 버튼에서 호출합니다. */
  async enable(mode: Mode) {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.enabled = true;
    this.setMode(mode);
  }

  async disable() {
    this.enabled = false;
    await this.ctx?.suspend();
  }

  setIntensity(v: number) {
    this.intensity = v;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fireGain?.gain.setTargetAtTime(0.25 + v * 0.5, t, 0.5);
    this.waterFilter?.frequency.setTargetAtTime(300 + v * 500, t, 0.5);
  }

  setMode(mode: Mode) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.fireGain?.gain.setTargetAtTime(mode === "fire" ? 0.25 + this.intensity * 0.5 : 0, t, 0.8);
    this.waterGain?.gain.setTargetAtTime(mode === "water" ? 0.6 : 0, t, 0.8);
  }

  /** 장작 넣을 때 "투둑" */
  pop() {
    if (!this.ctx || !this.enabled) return;
    for (let i = 0; i < 4; i++) this.crackle(this.ctx.currentTime + Math.random() * 0.4, 0.5);
  }

  private build() {
    const ctx = new AudioContext();
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
    this.master = master;

    const noise = this.makeNoise(ctx);

    // --- 불 ---
    const fireLow = ctx.createBiquadFilter();
    fireLow.type = "lowpass";
    fireLow.frequency.value = 500;
    const fireGain = ctx.createGain();
    fireGain.gain.value = 0;
    noise.connect(fireLow).connect(fireGain).connect(master);
    this.fireGain = fireGain;

    // --- 물 ---
    const waterFilter = ctx.createBiquadFilter();
    waterFilter.type = "bandpass";
    waterFilter.frequency.value = 600;
    waterFilter.Q.value = 0.7;
    const lfo = ctx.createOscillator(); // 아주 느린 진동 → 필터를 흔들어 "출렁임"
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(waterFilter.frequency);
    lfo.start();
    const waterGain = ctx.createGain();
    waterGain.gain.value = 0;
    noise.connect(waterFilter).connect(waterGain).connect(master);
    this.waterGain = waterGain;
    this.waterFilter = waterFilter;

    // 불 탈 때 무작위 "탁탁"
    const schedule = () => {
      if (this.enabled && (this.fireGain?.gain.value ?? 0) > 0.05) {
        this.crackle(ctx.currentTime, 0.15 + this.intensity * 0.25);
      }
      this.crackleTimer = window.setTimeout(schedule, 80 + Math.random() * (600 - this.intensity * 400));
    };
    schedule();
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

  /** 2초짜리 핑크빛 노이즈 버퍼를 무한 반복 */
  private makeNoise(ctx: AudioContext) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
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
