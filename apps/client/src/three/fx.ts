import * as THREE from "three";
import type { ItemDef } from "@daengsoon/shared";

/**
 * 태울 물건의 종이 텍스처. 물건마다 진짜 서류처럼 그립니다.
 * 보고서(제목·표·그래프), 사직서(격식 문장·도장), 편지(손글씨 풍·하트 봉인), 영수증(품목·합계),
 * 시험지(문제·빨간 점수), 일기장(날짜·줄글). 글은 일부러 작고 흐리게 둬서 "읽히는 느낌"만 줍니다.
 */
const texCache = new Map<string, THREE.CanvasTexture>();
export function paperTexture(def: ItemDef) {
  let t = texCache.get(def.id);
  if (t) return t;
  const W = 384, H = 512;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const serif = "'Noto Serif KR', 'Apple SD Gothic Neo', serif";
  const sans = "'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";
  const hand = "'Jua', 'Noto Sans KR', sans-serif";
  const ink = "#2d2620";
  const faint = "rgba(45, 38, 32, 0.55)";
  const line = (x1: number, y1: number, x2: number, y2: number, col = "rgba(45,38,32,0.35)", w = 1.5) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); };
  const text = (str: string, x: number, y: number, font: string, col = ink, align: CanvasTextAlign = "left") => { g.font = font; g.fillStyle = col; g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(str, x, y); };
  const scribble = (x: number, y: number, w: number, rows: number, gap = 22, col = faint) => {
    // 글줄처럼 보이는 가짜 손글씨: 짧은 물결선
    g.strokeStyle = col; g.lineWidth = 1.6;
    for (let r = 0; r < rows; r++) {
      const len = w * (r === rows - 1 ? 0.45 + Math.random() * 0.3 : 0.85 + Math.random() * 0.15);
      g.beginPath();
      for (let i = 0; i <= len; i += 4) g.lineTo(x + i, y + r * gap + Math.sin(i * 0.9 + r) * 1.6);
      g.stroke();
    }
  };
  const stamp = (x: number, y: number, label: string) => {
    g.save(); g.translate(x, y); g.rotate(-0.15);
    g.strokeStyle = "rgba(200, 40, 40, 0.8)"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 26, 0, Math.PI * 2); g.stroke();
    text(label, 0, 7, `700 18px ${serif}`, "rgba(200,40,40,0.85)", "center");
    g.restore();
  };

  // 바탕
  g.fillStyle = def.id === "receipt" ? "#fbfaf4" : def.id === "diary" ? "#f6efdf" : def.id === "letter" ? "#fff6ec" : "#f8f4ea";
  g.fillRect(0, 0, W, H);
  // 종이 질감: 아주 옅은 얼룩
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(90,70,40,${Math.random() * 0.05})`; g.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 4, 1 + Math.random() * 3); }

  switch (def.id) {
    case "report": {
      text("2026년 4분기 업무 보고서", W / 2, 58, `700 24px ${sans}`, ink, "center");
      text("작성: 기획팀  |  대외비", W / 2, 84, `12px ${sans}`, faint, "center");
      line(40, 98, W - 40, 98, "rgba(45,38,32,0.6)", 2);
      text("1. 개요", 44, 134, `700 15px ${sans}`);
      scribble(44, 152, 300, 3, 20);
      text("2. 주요 지표", 44, 234, `700 15px ${sans}`);
      // 표
      for (let r = 0; r < 4; r++) line(44, 250 + r * 26, W - 44, 250 + r * 26);
      line(44, 250, 44, 328); line(W - 44, 250, W - 44, 328); line(170, 250, 170, 328); line(260, 250, 260, 328);
      const rows = [["항목", "목표", "실적"], ["매출", "120", "97"], ["신규", "40", "22"]];
      rows.forEach((row, r) => { text(row[0], 56, 268 + r * 26, `12px ${sans}`, r ? ink : faint); text(row[1], 215, 268 + r * 26, `12px ${sans}`, ink, "center"); text(row[2], 300, 268 + r * 26, `12px ${sans}`, r === 2 ? "rgba(200,40,40,0.85)" : ink, "center"); });
      // 막대 그래프
      text("3. 추이", 44, 362, `700 15px ${sans}`);
      [0.5, 0.7, 0.45, 0.9, 0.35].forEach((v, i) => { g.fillStyle = i === 4 ? "rgba(200,40,40,0.6)" : "rgba(60,90,140,0.55)"; g.fillRect(60 + i * 56, 460 - v * 80, 34, v * 80); });
      line(50, 461, W - 50, 461, "rgba(45,38,32,0.5)");
      text("※ 야근 누적 142시간", W - 44, 492, `11px ${sans}`, faint, "right");
      break;
    }
    case "resignation": {
      text("사  직  서", W / 2, 70, `700 34px ${serif}`, ink, "center");
      line(W / 2 - 60, 82, W / 2 + 60, 82, "rgba(45,38,32,0.6)", 1.5);
      text("소속: 영업2팀      직위: 대리", 50, 130, `13px ${serif}`);
      text("성명: ○○○", 50, 156, `13px ${serif}`);
      text("상기 본인은 일신상의 사유로", 50, 206, `15px ${serif}`);
      text("2026년 11월 30일부로 사직하고자", 50, 232, `15px ${serif}`);
      text("하오니 허락하여 주시기 바랍니다.", 50, 258, `15px ${serif}`);
      scribble(50, 300, 280, 2, 24);
      text("2026년 11월 3일", W / 2, 380, `13px ${serif}`, ink, "center");
      text("신청인: ○○○ (인)", W - 50, 420, `14px ${serif}`, ink, "right");
      stamp(W - 72, 414, "印");
      text("대표이사 귀하", 50, 476, `14px ${serif}`);
      break;
    }
    case "letter": {
      // 편지지 줄
      for (let y = 120; y < 470; y += 30) line(40, y, W - 40, y, "rgba(120, 90, 90, 0.25)");
      text("To. 너에게", 48, 86, `700 24px ${hand}`, "#6a3b3b");
      const lines = ["그날 말하지 못한 게 있어.", "사실은 나도 많이", "고마웠고, 미안했어.", "잘 지내. 정말로."];
      lines.forEach((l, i) => text(l, 48, 146 + i * 30 + (i > 1 ? 30 : 0), `20px ${hand}`, "#4a3535"));
      scribble(48, 318, 240, 2, 30, "rgba(74,53,53,0.45)");
      text("From. 나", W - 48, 438, `700 20px ${hand}`, "#6a3b3b", "right");
      // 하트 봉인
      g.fillStyle = "#d9534f"; g.beginPath(); g.moveTo(300, 470); g.bezierCurveTo(300, 455, 280, 450, 280, 464); g.bezierCurveTo(280, 476, 300, 486, 300, 494); g.bezierCurveTo(300, 486, 320, 476, 320, 464); g.bezierCurveTo(320, 450, 300, 455, 300, 470); g.fill();
      break;
    }
    case "receipt": {
      text("영 수 증", W / 2, 50, `700 20px ${sans}`, ink, "center");
      text("2026-11-03 23:41   No.0417", W / 2, 72, `11px ${sans}`, faint, "center");
      line(30, 86, W - 30, 86, "rgba(45,38,32,0.5)", 1); line(30, 90, W - 30, 90, "rgba(45,38,32,0.5)", 1);
      const items: [string, string][] = [["아메리카노 x3", "13,500"], ["야식 세트", "18,000"], ["편의점 커피", "2,100"], ["택시", "24,300"], ["또 커피", "4,500"]];
      items.forEach(([n, v], i) => { text(n, 36, 124 + i * 32, `13px ${sans}`); text(v, W - 36, 124 + i * 32, `13px ${sans}`, ink, "right"); });
      for (let y = 100; y < 300; y += 32) line(30, y + 10, W - 30, y + 10, "rgba(45,38,32,0.12)");
      line(30, 300, W - 30, 300, "rgba(45,38,32,0.5)", 1.5);
      text("합계", 36, 334, `700 16px ${sans}`); text("62,400", W - 36, 334, `700 18px ${sans}`, ink, "right");
      text("이번 달 누적", 36, 362, `12px ${sans}`, faint); text("1,284,900", W - 36, 362, `12px ${sans}`, "rgba(200,40,40,0.85)", "right");
      // 바코드
      for (let x = 60; x < W - 60; x += 3 + Math.floor(Math.random() * 4)) { g.fillStyle = ink; g.fillRect(x, 400, 1 + Math.floor(Math.random() * 3), 56); }
      text("감사합니다. 또 오세요", W / 2, 490, `11px ${sans}`, faint, "center");
      // 지그재그 아랫단
      g.fillStyle = "#1a1410"; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) { g.lineTo(x + 8, H - 10); g.lineTo(x + 16, H); } g.lineTo(W, H); g.fill();
      break;
    }
    case "exam": {
      text("중간고사  수학 II", 44, 52, `700 20px ${sans}`);
      text("2학년 3반  이름: ______", W - 44, 52, `12px ${sans}`, faint, "right");
      line(40, 66, W - 40, 66, "rgba(45,38,32,0.6)", 2);
      const qs = ["1. 다음 극한값을 구하시오.", "2. 함수 f(x)의 도함수를 구하시오.", "3. 아래 그래프에서 넓이를 구하시오.", "4. 증명하시오."];
      qs.forEach((q, i) => { text(q, 44, 104 + i * 92, `13px ${sans}`); scribble(60, 122 + i * 92, 240, 2, 20); });
      // 빨간 채점
      g.strokeStyle = "rgba(220, 40, 40, 0.85)"; g.lineWidth = 4;
      [[300, 112], [300, 204]].forEach(([x, y]) => { g.beginPath(); g.moveTo(x - 10, y + 10); g.lineTo(x + 12, y - 12); g.moveTo(x - 10, y - 12); g.lineTo(x + 12, y + 10); g.stroke(); });
      g.beginPath(); g.arc(300, 296, 14, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(290, 398); g.lineTo(312, 376); g.moveTo(290, 376); g.lineTo(312, 398); g.stroke();
      g.save(); g.translate(W - 80, 470); g.rotate(-0.2); text("38", 0, 10, `700 48px ${hand}`, "rgba(220,40,40,0.9)", "center"); text("/100", 44, 10, `700 18px ${hand}`, "rgba(220,40,40,0.9)", "center"); g.restore();
      break;
    }
    case "diary": {
      // 다이어리 줄 + 구멍
      for (let y = 100; y < 490; y += 28) line(36, y, W - 30, y, "rgba(120, 100, 70, 0.3)");
      for (let y = 60; y < H; y += 64) { g.fillStyle = "#2a2219"; g.beginPath(); g.arc(18, y, 6, 0, Math.PI * 2); g.fill(); }
      text("11월 3일  월요일  흐림", 44, 70, `700 18px ${hand}`, "#4a3a2a");
      const lines = ["오늘도 아무 말 못 했다.", "내일은 꼭 말해야지 하고", "또 미뤘다.", "", "잠이 안 온다."];
      lines.forEach((l, i) => text(l, 44, 122 + i * 28, `17px ${hand}`, "#4a3a2a"));
      scribble(44, 290, 260, 4, 28, "rgba(74,58,42,0.4)");
      // 눈물 자국
      g.fillStyle = "rgba(120,140,170,0.18)"; g.beginPath(); g.ellipse(300, 420, 26, 18, 0.4, 0, Math.PI * 2); g.fill();
      break;
    }
  }
  // 모서리 살짝 접힌 느낌
  g.fillStyle = "rgba(0,0,0,0.08)"; g.beginPath(); g.moveTo(W, H - 40); g.lineTo(W, H); g.lineTo(W - 40, H); g.closePath(); g.fill();
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(def.id, t);
  return t;
}
/** 왼쪽/오른쪽 반 장짜리 평면(찢어진 가장자리는 살짝 들쭉날쭉) */
export function halfPaperGeo(side: "L" | "R", w = 0.21, h = 0.28) {
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
/** 찢기 전 한 장짜리 */
export function wholePaperGeo(w = 0.21, h = 0.28) {
  return new THREE.PlaneGeometry(w, h);
}
export function paperMaterial(def: ItemDef) {
  return new THREE.MeshStandardMaterial({ map: paperTexture(def), roughness: 0.9, side: THREE.DoubleSide });
}

interface Flight { mesh: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; t: number; dur: number; spin: THREE.Vector3; onHit: () => void; fired: boolean }
interface Ash { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }
const ashGeo = new THREE.BoxGeometry(0.016, 0.016, 0.016);
const ashMat = new THREE.MeshBasicMaterial({ color: 0x4a423c, transparent: true });

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
        for (let i = 0; i < 9; i++) {
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
