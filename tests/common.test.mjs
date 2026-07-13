// 공용 로직 테스트 — node tests/common.test.mjs
import { strict as assert } from 'node:assert';

// common.js는 DOM 참조가 최상위에 있어 node에서 직접 import 불가할 수 있음 → 방어적 확인
// localStorage/window/document mock
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.window = { matchMedia: () => ({ matches: false }) };
globalThis.document = {
  documentElement: { dataset: {} },
  getElementById: () => null,
  querySelector: () => null,
  createElement: () => ({ classList: { add: () => {} }, style: {} }),
  addEventListener: () => {},
  body: { appendChild: () => {}, classList: { toggle: () => {} } },
};

const { shuffle, splitTeams, parseNames, encodeShare, decodeShare } = await import('../js/common.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (e) { failed++; console.error(`  FAIL - ${name}\n    ${e.message}`); }
}

// 시드 고정 rng (mulberry32)
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

console.log('# shuffle');
test('원본 불변 + 원소 보존', () => {
  const src = [1, 2, 3, 4, 5];
  const out = shuffle(src, seededRng(1));
  assert.deepEqual(src, [1, 2, 3, 4, 5]);
  assert.deepEqual([...out].sort(), [1, 2, 3, 4, 5]);
});
test('시드 재현성', () => {
  assert.deepEqual(shuffle([1, 2, 3, 4], seededRng(42)), shuffle([1, 2, 3, 4], seededRng(42)));
});
test('분포 공정성: 각 원소가 각 위치에 대략 균등 (n=4, 10000회)', () => {
  const N = 10000;
  const counts = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const rng = seededRng(7);
  for (let i = 0; i < N; i++) {
    shuffle([0, 1, 2, 3], rng).forEach((v, pos) => counts[v][pos]++);
  }
  const expected = N / 4;
  for (const row of counts) for (const c of row) {
    assert.ok(Math.abs(c - expected) < expected * 0.1, `편향 감지: ${c} vs ${expected}`);
  }
});

console.log('# splitTeams');
test('크기 차 최대 1 (7명 3팀 → 3,2,2)', () => {
  const teams = splitTeams(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 3, seededRng(1));
  const sizes = teams.map((t) => t.length).sort((x, y) => y - x);
  assert.deepEqual(sizes, [3, 2, 2]);
});
test('전원 보존·중복 없음', () => {
  const names = Array.from({ length: 23 }, (_, i) => `사람${i}`);
  const teams = splitTeams(names, 5, seededRng(2));
  const flat = teams.flat();
  assert.equal(flat.length, 23);
  assert.equal(new Set(flat).size, 23);
});
test('인원 < 팀 수 → null', () => {
  assert.equal(splitTeams(['a'], 2), null);
});

console.log('# parseNames');
test('공백·중복·빈 줄 제거', () => {
  assert.deepEqual(parseNames(' 김철수 \n\n이영희\n김철수\n  '), ['김철수', '이영희']);
});
test('max 제한', () => {
  const text = Array.from({ length: 10 }, (_, i) => `n${i}`).join('\n');
  assert.equal(parseNames(text, { max: 5 }).length, 5);
});

console.log('# encodeShare/decodeShare');
test('유니코드 왕복', () => {
  const obj = { names: ['김철수', '이영희'], emoji: '🪜' };
  assert.deepEqual(decodeShare(encodeShare(obj)), obj);
});
test('손상된 입력 → null', () => {
  assert.equal(decodeShare('%%%invalid'), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
