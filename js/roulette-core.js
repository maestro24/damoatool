// 원판 룰렛 핵심 로직 — DOM 의존 없음, Node에서 그대로 실행 가능
// 좌표 규약: 원판 회전각(라디안)은 시계 방향 양수. 포인터는 12시 방향 고정.
// 회전 0일 때 세그먼트 i는 12시부터 시계 방향으로 [i·seg, (i+1)·seg) 구간을 차지한다.

export const TAU = Math.PI * 2;

/** 0 ≤ 결과 < TAU 로 정규화 */
export function normalizeAngle(angle) {
  return ((angle % TAU) + TAU) % TAU;
}

/** count개 중 하나를 균등 추첨 */
export function pickIndex(count, rng = Math.random) {
  if (!Number.isInteger(count) || count < 1) throw new Error('count는 1 이상의 정수여야 합니다');
  const i = Math.floor(rng() * count);
  return Math.min(i, count - 1); // rng()가 1을 반환하는 극단 케이스 방어
}

/**
 * index 세그먼트의 "중앙"이 포인터(12시) 아래에 서도록 하는 최종 회전각.
 * extraTurns바퀴를 추가로 돈 뒤 멈춘다.
 */
export function computeTargetAngle(index, count, extraTurns = 5) {
  if (!Number.isInteger(count) || count < 1) throw new Error('count는 1 이상의 정수여야 합니다');
  if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error('index 범위 초과');
  const seg = TAU / count;
  return extraTurns * TAU - (index + 0.5) * seg;
}

/** 역검증: 회전각 angle에서 포인터가 가리키는 세그먼트 인덱스 */
export function angleToIndex(angle, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('count는 1 이상의 정수여야 합니다');
  const seg = TAU / count;
  const offset = normalizeAngle(-angle); // 포인터가 원판 기준 좌표에서 가리키는 오프셋
  return Math.floor(offset / seg) % count;
}

/** 감속 회전용 cubic ease-out (t: 0~1) */
export function easeOutCubic(t) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - clamped, 3);
}
