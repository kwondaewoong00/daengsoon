/**
 * 소리를 파일 없이 합성합니다. 저작권 걱정이 없고, 가까운 화로에 따라 소리가 살아 움직입니다.
 * Web Audio API = 브라우저 안의 믹싱 콘솔. 노이즈 → 필터 → 볼륨 → 스피커로 선을 연결합니다.
 */
export class Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private fireGain: GainNode | null = null;
  private nearness = 0.3;
  enabled = false;

  /** 브라우저는 사용자가 클릭하기 전엔 소리를 못 냅니다(자동재생 차단). 그래서 버튼에서 호출합니다. */
  async enable() {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
    this.enabled = true;
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
      if (this.enabled) this.crackle(ctx.currentTime, 0.1 + this.nearness * 0.3);
      window.setTimeout(schedule, 120 + Math.random() * (700 - this.nearness * 450));
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
