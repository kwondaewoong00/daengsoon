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
 * 하늘. 360도 사진(등장방형 JPG)이 배경이자 조명입니다.
 * 원본 HDR은 파일마다 밝기가 제각각이라, 변환할 때 평균 휘도를 맞춰 두었습니다(해질녘은 더 어둡게).
 * 산: 초저녁 B1 → 늦은 밤 B9(멀리 마을 불빛). 바다: 초저녁 B12(별) → 늦은 밤 B6(달빛)
 */
export function skyFor(kind: SceneKind, hour = new Date().getHours()) {
  const late = hour >= 22 || hour < 5;
  const id = kind === "sea" ? (late ? "moonlit_golf" : "dikhololo_night") : late ? "satara_night" : "kloppenheim_02";
  return { id, env: 1.0, bg: 1.0, exposure: 0.85 };
}
