// 원판 룰렛 로직 테스트 — node tests/roulette.test.mjs
import {
  TAU, pickIndex, computeTargetAngle, angleToIndex, normalizeAngle, easeOutCubic,
} from '../js/roulette-core.js';
import { mulberry32 } from '../js/ladder-core.js';

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

test('angleToIndex(computeTargetAngle(i, n)) === i 전수 (n 2~12, 모든 i, 여러 extraTurns)', () => {
  for (let n = 2; n <= 12; n++) {
    for (let i = 0; i < n; i++) {
      for (const turns of [0, 1, 4, 5, 6, 13]) {
        const angle = computeTargetAngle(i, n, turns);
        const back = angleToIndex(angle, n);
        assert(back === i, `n=${n} i=${i} turns=${turns}: 역검증 ${back} ≠ ${i}`);
      }
    }
  }
});

test('pickIndex는 항상 0 ≤ i < count', () => {
  const rng = mulberry32(1234);
  for (let iter = 0; iter < 5000; iter++) {
    const count = 2 + Math.floor(rng() * 11); // 2~12
    const i = pickIndex(count, rng);
    assert(Number.isInteger(i) && i >= 0 && i < count, `count=${count}에서 ${i} 반환`);
  }
  // 극단값 방어: rng가 1을 반환해도 범위 내
  assert(pickIndex(8, () => 0.9999999999) === 7, '상한 근처 값 처리 실패');
  assert(pickIndex(8, () => 0) === 0, '0 처리 실패');
});

test('pickIndex 분포 대략 균등 (min/max 빈도 비율 < 3배)', () => {
  for (const count of [2, 5, 8, 12]) {
    const rng = mulberry32(555 + count);
    const freq = new Array(count).fill(0);
    const draws = 12000;
    for (let k = 0; k < draws; k++) freq[pickIndex(count, rng)] += 1;
    const min = Math.min(...freq);
    const max = Math.max(...freq);
    assert(min > 0, `count=${count}: 한 번도 안 나온 항목 존재`);
    assert(max / min < 3, `count=${count}: 빈도 편차 과다 (min=${min}, max=${max})`);
  }
});

test('normalizeAngle: 음수·큰 각도 모두 [0, TAU) 범위', () => {
  for (const a of [-0.1, -TAU, -7 * TAU - 1.3, 0, 1.5, TAU, 9 * TAU + 2.2]) {
    const n = normalizeAngle(a);
    assert(n >= 0 && n < TAU, `normalizeAngle(${a}) = ${n}`);
    assert(Math.abs(Math.sin(n) - Math.sin(a)) < 1e-9, `각도 동치 아님: ${a}`);
  }
});

test('easeOutCubic: 경계값과 단조 증가', () => {
  assert(easeOutCubic(0) === 0, 't=0에서 0이어야 함');
  assert(easeOutCubic(1) === 1, 't=1에서 1이어야 함');
  assert(easeOutCubic(-1) === 0 && easeOutCubic(2) === 1, '범위 밖 클램프 실패');
  let prev = 0;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const v = easeOutCubic(t);
    assert(v >= prev, `t=${t}에서 감소`);
    prev = v;
  }
});

test('입력 검증: 잘못된 count/index는 예외', () => {
  let threw = 0;
  for (const call of [
    () => pickIndex(0),
    () => pickIndex(2.5),
    () => computeTargetAngle(0, 0),
    () => computeTargetAngle(5, 5),
    () => computeTargetAngle(-1, 5),
    () => angleToIndex(1, 0),
  ]) {
    try { call(); } catch { threw += 1; }
  }
  assert(threw === 6, `예외 6건 기대, 실제 ${threw}건`);
});

console.log(`\nroulette-core: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
