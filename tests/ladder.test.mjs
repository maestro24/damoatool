// 사다리타기 로직 테스트 — node tests/ladder.test.mjs
import { generateRungs, computeResult, tracePath, mulberry32 } from '../js/ladder-core.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failed += 1;
    console.error(`  FAIL  ${name}\n        ${e.message}`);
  }
}
function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

function isPermutation(arr, n) {
  if (arr.length !== n) return false;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i);
}

function hasAdjacentConflict(rungs) {
  const byRow = new Map();
  for (const { row, col } of rungs) {
    if (!byRow.has(row)) byRow.set(row, []);
    byRow.get(row).push(col);
  }
  for (const cols of byRow.values()) {
    const sorted = [...cols].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] < 2) return true; // 같은 row 인접(또는 중복) 가로줄
    }
  }
  return false;
}

test('시드 고정 1000회: computeResult는 항상 순열이고 인접 가로줄 충돌 없음', () => {
  const rng = mulberry32(20260713);
  for (let iter = 0; iter < 1000; iter++) {
    const cols = 2 + Math.floor(rng() * 9);   // 2~10
    const rows = 10 + Math.floor(rng() * 11); // 10~20
    const rungs = generateRungs(cols, rows, rng);

    assert(!hasAdjacentConflict(rungs), `iter=${iter} cols=${cols} rows=${rows}: 인접 가로줄 충돌`);
    for (const g of rungs) {
      assert(g.row >= 0 && g.row < rows, `iter=${iter}: row 범위 초과 (${g.row})`);
      assert(g.col >= 0 && g.col <= cols - 2, `iter=${iter}: col 범위 초과 (${g.col})`);
    }

    const result = computeResult(cols, rungs);
    assert(
      isPermutation(result, cols),
      `iter=${iter} cols=${cols} rows=${rows}: 순열 아님 → [${result}]`
    );
  }
});

test('같은 시드는 같은 사다리를 만든다 (공유/복원 결정성)', () => {
  const a = generateRungs(6, 14, mulberry32(42));
  const b = generateRungs(6, 14, mulberry32(42));
  assert(JSON.stringify(a) === JSON.stringify(b), '같은 시드인데 rungs가 다름');
  assert(
    JSON.stringify(computeResult(6, a)) === JSON.stringify(computeResult(6, b)),
    '같은 시드인데 결과가 다름'
  );
});

test('각 기둥 쌍마다 최소 1개 가로줄 보장 (시드 200회)', () => {
  const rng = mulberry32(7);
  for (let iter = 0; iter < 200; iter++) {
    const cols = 2 + Math.floor(rng() * 9);
    const rungs = generateRungs(cols, 15, rng);
    for (let c = 0; c < cols - 1; c++) {
      assert(rungs.some((g) => g.col === c), `iter=${iter} cols=${cols}: 기둥 쌍 ${c}에 가로줄 없음`);
    }
  }
});

test('tracePath 도착점은 computeResult와 일치', () => {
  const rng = mulberry32(999);
  for (let iter = 0; iter < 200; iter++) {
    const cols = 2 + Math.floor(rng() * 9);
    const rows = 10 + Math.floor(rng() * 11);
    const rungs = generateRungs(cols, rows, rng);
    const result = computeResult(cols, rungs);
    for (let s = 0; s < cols; s++) {
      const pts = tracePath(s, rows, rungs);
      assert(pts[0].col === s && pts[0].y === 0, '시작점 불일치');
      const last = pts[pts.length - 1];
      assert(last.col === result[s], `경로 도착점(${last.col}) ≠ 결과(${result[s]})`);
      assert(last.y === rows, '경로가 바닥까지 내려가지 않음');
    }
  }
});

test('입력 검증: 잘못된 cols/rows는 예외', () => {
  let threw = 0;
  for (const call of [
    () => generateRungs(1, 10),
    () => generateRungs(3.5, 10),
    () => generateRungs(3, 0),
    () => computeResult(1, []),
  ]) {
    try { call(); } catch { threw += 1; }
  }
  assert(threw === 4, `예외 4건 기대, 실제 ${threw}건`);
});

console.log(`\nladder-core: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
