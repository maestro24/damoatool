// 팀 나누기 순수 로직 테스트 (Node, DOM 없음)
// 실행: node tests/team.test.mjs
import assert from 'node:assert/strict';

// common.js 는 모듈 로드 시 localStorage/window 를 참조하므로 최소 shim 후 동적 import
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = {};
const { splitTeams, parseNames, shuffle } = await import('../js/common.js');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}\n      ${e.message}`);
  }
}

/** 시드 기반 결정적 rng (mulberry32) */
function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNames(n) {
  return Array.from({ length: n }, (_, i) => `사람${i + 1}`);
}

// ── splitTeams: 팀 크기 차 ≤ 1 ──
test('splitTeams 7명/3팀 → 크기 3,2,2', () => {
  const teams = splitTeams(makeNames(7), 3, seededRng(1));
  const sizes = teams.map((t) => t.length).sort((a, b) => b - a);
  assert.deepEqual(sizes, [3, 2, 2]);
});

test('splitTeams 여러 조합에서 크기 차 최대 1', () => {
  const combos = [[10, 4], [5, 5], [11, 2], [100, 10], [9, 4], [23, 7]];
  for (const [n, k] of combos) {
    const teams = splitTeams(makeNames(n), k, seededRng(n * 31 + k));
    assert.equal(teams.length, k, `${n}/${k}: 팀 수`);
    const sizes = teams.map((t) => t.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${n}/${k}: 크기 차 ${sizes}`);
    assert.equal(sizes.reduce((a, b) => a + b, 0), n, `${n}/${k}: 총원`);
  }
});

test('splitTeams 전 인원 보존 · 중복 없음', () => {
  const names = makeNames(23);
  const teams = splitTeams(names, 4, seededRng(42));
  const flat = teams.flat();
  assert.equal(flat.length, names.length);
  assert.equal(new Set(flat).size, names.length, '중복 발견');
  assert.deepEqual([...flat].sort(), [...names].sort(), '인원 구성 불일치');
});

test('splitTeams 인원 < 팀 수 → null', () => {
  assert.equal(splitTeams(makeNames(3), 4, seededRng(1)), null);
  assert.equal(splitTeams([], 2, seededRng(1)), null);
});

test('splitTeams 팀 수 < 2 → null', () => {
  assert.equal(splitTeams(makeNames(5), 1, seededRng(1)), null);
  assert.equal(splitTeams(makeNames(5), 0, seededRng(1)), null);
});

// ── shuffle: 시드 재현성 + 불변성 ──
test('shuffle 같은 시드 → 같은 결과 (재현성)', () => {
  const names = makeNames(20);
  const a = shuffle(names, seededRng(7));
  const b = shuffle(names, seededRng(7));
  assert.deepEqual(a, b);
});

test('shuffle 다른 시드 → 다른 순서', () => {
  const names = makeNames(20);
  const a = shuffle(names, seededRng(7));
  const b = shuffle(names, seededRng(8));
  assert.notDeepEqual(a, b);
});

test('shuffle 원본 배열 불변', () => {
  const names = makeNames(10);
  const snapshot = [...names];
  shuffle(names, seededRng(3));
  assert.deepEqual(names, snapshot);
});

test('splitTeams 같은 시드 → 같은 편성 (재현성)', () => {
  const names = makeNames(13);
  assert.deepEqual(
    splitTeams(names, 3, seededRng(99)),
    splitTeams(names, 3, seededRng(99)),
  );
});

// ── parseNames ──
test('parseNames 앞뒤 공백 제거', () => {
  assert.deepEqual(parseNames('  김철수  \n\t이영희\t'), ['김철수', '이영희']);
});

test('parseNames 빈 줄 무시', () => {
  assert.deepEqual(parseNames('김철수\n\n\n이영희\n   \n박민수'), ['김철수', '이영희', '박민수']);
});

test('parseNames 중복 제거 (첫 등장 유지)', () => {
  assert.deepEqual(parseNames('김철수\n이영희\n김철수\n이영희'), ['김철수', '이영희']);
});

test('parseNames CRLF 줄바꿈 처리', () => {
  assert.deepEqual(parseNames('김철수\r\n이영희\r\n박민수'), ['김철수', '이영희', '박민수']);
});

test('parseNames 빈 입력 → 빈 배열', () => {
  assert.deepEqual(parseNames(''), []);
  assert.deepEqual(parseNames('   \n  \n'), []);
  assert.deepEqual(parseNames(null), []);
});

test('parseNames max 옵션으로 인원 제한', () => {
  const text = makeNames(150).join('\n');
  assert.equal(parseNames(text, { max: 100 }).length, 100);
  assert.equal(parseNames(text, { max: 5 }).length, 5);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
