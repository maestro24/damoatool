// 타이머 순수 로직 테스트 (Node, DOM 없음)
// 실행: node tests/timer.test.mjs
import assert from 'node:assert/strict';
import { formatTime, clampSec, parseCustomInput, MAX_SEC } from '../js/timer-core.js';

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

// ── formatTime ──
test('formatTime(0) → "00:00"', () => {
  assert.equal(formatTime(0), '00:00');
});

test('formatTime(59) → "00:59"', () => {
  assert.equal(formatTime(59), '00:59');
});

test('formatTime(60) → "01:00"', () => {
  assert.equal(formatTime(60), '01:00');
});

test('formatTime(3599) → "59:59"', () => {
  assert.equal(formatTime(3599), '59:59');
});

test('formatTime(3661) → "1:01:01"', () => {
  assert.equal(formatTime(3661), '1:01:01');
});

test('formatTime(3600) → "1:00:00"', () => {
  assert.equal(formatTime(3600), '1:00:00');
});

test('formatTime 음수/비정상 입력 → "00:00"', () => {
  assert.equal(formatTime(-10), '00:00');
  assert.equal(formatTime(NaN), '00:00');
});

// ── parseCustomInput: 유효 ──
test('parseCustomInput("5","30") → 330', () => {
  assert.equal(parseCustomInput('5', '30'), 330);
});

test('parseCustomInput("0","45") → 45', () => {
  assert.equal(parseCustomInput('0', '45'), 45);
});

test('parseCustomInput("5","") → 300 (빈 초는 0)', () => {
  assert.equal(parseCustomInput('5', ''), 300);
});

test('parseCustomInput("","30") → 30 (빈 분은 0)', () => {
  assert.equal(parseCustomInput('', '30'), 30);
});

test('parseCustomInput 공백 포함 입력 허용', () => {
  assert.equal(parseCustomInput(' 10 ', ' 5 '), 605);
});

// ── parseCustomInput: 무효 ──
test('parseCustomInput 둘 다 빈 값 → null', () => {
  assert.equal(parseCustomInput('', ''), null);
});

test('parseCustomInput("0","0") → null (0초 불가)', () => {
  assert.equal(parseCustomInput('0', '0'), null);
});

test('parseCustomInput 음수 → null', () => {
  assert.equal(parseCustomInput('-1', '0'), null);
  assert.equal(parseCustomInput('5', '-30'), null);
});

test('parseCustomInput 초 60 이상 → null', () => {
  assert.equal(parseCustomInput('5', '60'), null);
  assert.equal(parseCustomInput('0', '99'), null);
});

test('parseCustomInput 숫자 아닌 입력 → null', () => {
  assert.equal(parseCustomInput('abc', '0'), null);
  assert.equal(parseCustomInput('5', '삼십'), null);
  assert.equal(parseCustomInput('5.5', '0'), null);
});

test('parseCustomInput 최대치 초과 → null', () => {
  assert.equal(parseCustomInput('999999', '0'), null);
});

// ── clampSec ──
test('clampSec 정상 값 그대로 유지', () => {
  assert.equal(clampSec(0), 0);
  assert.equal(clampSec(300), 300);
  assert.equal(clampSec(MAX_SEC), MAX_SEC);
});

test('clampSec 음수 → 0', () => {
  assert.equal(clampSec(-1), 0);
  assert.equal(clampSec(-9999), 0);
});

test('clampSec 소수 → 내림', () => {
  assert.equal(clampSec(10.9), 10);
});

test('clampSec 최대치 초과 → MAX_SEC', () => {
  assert.equal(clampSec(MAX_SEC + 1), MAX_SEC);
  assert.equal(clampSec(1e12), MAX_SEC);
});

test('clampSec 숫자 아닌 값/NaN/Infinity → 0', () => {
  assert.equal(clampSec(NaN), 0);
  assert.equal(clampSec(Infinity), 0);
  assert.equal(clampSec('5'), 0);
  assert.equal(clampSec(undefined), 0);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
