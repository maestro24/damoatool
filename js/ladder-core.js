// 사다리타기 핵심 로직 — DOM 의존 없음, Node에서 그대로 실행 가능

/** 시드 고정 난수 생성기 (mulberry32). 같은 시드 → 같은 수열 → 결과 공유/복원에 사용 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 가로줄 생성.
 * - 반환: [{ row, col }] (col = 왼쪽 기둥 인덱스, 0 ≤ col ≤ cols-2)
 * - 같은 row에서 인접 기둥(col, col±1)에 동시에 가로줄이 놓이지 않음 (교차 방지)
 * - 각 기둥 쌍마다 최소 1개의 가로줄 보장 시도
 */
export function generateRungs(cols, rows, rng = Math.random) {
  if (!Number.isInteger(cols) || cols < 2) throw new Error('cols는 2 이상의 정수여야 합니다');
  if (!Number.isInteger(rows) || rows < 1) throw new Error('rows는 1 이상의 정수여야 합니다');

  const used = Array.from({ length: rows }, () => new Array(cols - 1).fill(false));
  const rungs = [];
  const place = (r, c) => { used[r][c] = true; rungs.push({ row: r, col: c }); };

  // 1차: 확률적으로 배치 (같은 row 왼쪽 이웃이 있으면 건너뜀 → 인접 금지)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols - 1; c++) {
      if (c > 0 && used[r][c - 1]) continue;
      if (rng() < 0.38) place(r, c);
    }
  }

  // 2차: 가로줄이 하나도 없는 기둥 쌍에 최소 1개 보장 (인접 규칙을 지키는 자리만)
  for (let c = 0; c < cols - 1; c++) {
    if (rungs.some((g) => g.col === c)) continue;
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      const leftFree = c === 0 || !used[r][c - 1];
      const rightFree = c === cols - 2 || !used[r][c + 1];
      if (!used[r][c] && leftFree && rightFree) candidates.push(r);
    }
    if (candidates.length > 0) {
      place(candidates[Math.floor(rng() * candidates.length)], c);
    }
  }

  return [...rungs].sort((a, b) => a.row - b.row || a.col - b.col);
}

/** row별 가로줄 col 집합으로 인덱싱 */
function indexByRow(rungs) {
  const byRow = new Map();
  for (const { row, col } of rungs) {
    if (!byRow.has(row)) byRow.set(row, new Set());
    byRow.get(row).add(col);
  }
  return byRow;
}

/**
 * 각 시작 기둥 → 도착 기둥 인덱스 배열.
 * 각 row가 서로소 전치(swap)의 곱이므로 결과는 항상 순열(전단사).
 */
export function computeResult(cols, rungs) {
  if (!Number.isInteger(cols) || cols < 2) throw new Error('cols는 2 이상의 정수여야 합니다');
  const byRow = indexByRow(rungs);
  const sortedRows = [...byRow.keys()].sort((a, b) => a - b);
  const result = [];
  for (let start = 0; start < cols; start++) {
    let col = start;
    for (const r of sortedRows) {
      const set = byRow.get(r);
      if (set.has(col)) col += 1;
      else if (set.has(col - 1)) col -= 1;
    }
    result.push(col);
  }
  return result;
}

/**
 * 애니메이션용 경로 추적.
 * 반환: [{ col, y }] — col은 기둥 인덱스, y는 0(위)~rows(아래), 가로줄은 y = row + 0.5 위치.
 */
export function tracePath(startCol, rows, rungs) {
  const byRow = indexByRow(rungs);
  const points = [{ col: startCol, y: 0 }];
  let col = startCol;
  for (let r = 0; r < rows; r++) {
    const set = byRow.get(r);
    if (!set) continue;
    if (set.has(col)) {
      points.push({ col, y: r + 0.5 });
      col += 1;
      points.push({ col, y: r + 0.5 });
    } else if (set.has(col - 1)) {
      points.push({ col, y: r + 0.5 });
      col -= 1;
      points.push({ col, y: r + 0.5 });
    }
  }
  points.push({ col, y: rows });
  return points;
}
