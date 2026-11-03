import type { SceneKind } from "@daengsoon/shared";

/** 월드 좌표(1400x1000) → 3D 미터. 1 단위 = 2cm → 캠프는 28m x 20m */
export const S = 0.02;

export type Season = "spring" | "summer" | "autumn" | "winter";
export function currentSeason(d = new Date()): Season {
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "autumn";
  return "winter";
}

/** 계절별 땅. 지금은 가을(forest_floor)만 받아두었고, 다른 계절은 같은 걸 쓰다가 재료가 오면 바꿉니다. */
export function groundFor(kind: SceneKind, season: Season): { id: string; repeat: number } {
  if (kind === "sea") return { id: "coast_sand_01", repeat: 14 };
  const bySeason: Record<Season, string> = {
    spring: "forest_floor",
    summer: "forest_floor",
    autumn: "forest_floor",
    winter: "forest_floor",
  };
  return { id: bySeason[season], repeat: 12 };
}

/**
 * 하늘(HDRI). 파일마다 밝기가 제각각이라(평균 휘도 0.03~0.25) 측정값으로 정규화합니다.
 * mean = 평균 휘도(미리 계산). env = 조명 세기, bg = 배경 밝기.
 */
const SKY_MEAN: Record<string, { mean: number; median: number }> = {
  kloppenheim_02: { mean: 0.246, median: 0.082 },   // B1 해질녘 들판
  moonlit_golf: { mean: 0.035, median: 0.022 },     // B6 달밤
  satara_night: { mean: 0.187, median: 0.043 },     // B9 밤, 멀리 불빛
  dikhololo_night: { mean: 0.065, median: 0.018 },  // B12 별 많은 밤
};
function normalize(id: string) {
  const m = SKY_MEAN[id] ?? { mean: 0.1, median: 0.05 };
  // 해가 남아 있는 하늘(평균 휘도 높음)은 조명을 더 눌러야 불이 주인공이 됩니다
  const target = m.mean > 0.15 ? 0.045 : 0.09;
  const env = Math.min(2.5, Math.max(0.15, target / m.mean));
  const bg = Math.min(3, Math.max(0.4, 0.05 / m.median));
  return { id, env, bg, exposure: m.mean > 0.15 ? 0.65 : 0.8 };
}
/** 산: 초저녁 B1 → 늦은 밤 B9(멀리 마을 불빛). 바다: 초저녁 B12(별) → 늦은 밤 B6(달빛) */
export function skyFor(kind: SceneKind, hour = new Date().getHours()) {
  const late = hour >= 22 || hour < 5;
  if (kind === "sea") return normalize(late ? "moonlit_golf" : "dikhololo_night");
  return normalize(late ? "satara_night" : "kloppenheim_02");
}
