// 대형 타이머 — DOM 로직 (순수 로직은 timer-core.js)
import { $, initTheme, toast, saveState, loadState, initFullscreen } from './common.js';
import { formatTime, clampSec, parseCustomInput } from './timer-core.js';

const TOOL = 'timer';
const PRESETS = [60, 180, 300, 600, 900, 1800];
const TICK_MS = 100;
const WARN_RATIO = 0.1; // 남은 시간 10% 이하 → 빨강
const DEFAULT_DURATION = 300;

const baseTitle = document.title;

let mode = 'timer';        // 'timer' | 'stopwatch'
let status = 'idle';       // 'idle' | 'running' | 'paused' | 'done'
let durationSec = DEFAULT_DURATION;
let endAt = 0;             // 타이머 실행 중: 종료 예정 시각(ms)
let remainMsPaused = 0;    // 타이머 일시정지: 남은 ms
let swStartAt = 0;         // 스톱워치 실행 시작 시각(ms)
let swAccumMs = 0;         // 스톱워치 누적 ms (일시정지분)
let tickId = null;
let audioCtx = null;

// ── 디스플레이 ──
function setDisplay(sec, { warn = false } = {}) {
  const text = formatTime(sec);
  const el = $('display');
  el.textContent = text;
  el.classList.toggle('long', text.length > 5);
  el.classList.toggle('warn', warn);
}

function setTabTitle(sec) {
  document.title = `${formatTime(sec)} — ${baseTitle}`;
}
function resetTabTitle() {
  document.title = baseTitle;
}

// ── 틱: setInterval 은 화면 갱신 용도로만, 시간은 항상 Date.now() 기준 ──
function startTick() {
  stopTick();
  tickId = setInterval(tick, TICK_MS);
  tick();
}
function stopTick() {
  if (tickId !== null) { clearInterval(tickId); tickId = null; }
}

function tick() {
  if (status !== 'running') return;
  const now = Date.now();
  if (mode === 'timer') {
    const remainMs = endAt - now;
    if (remainMs <= 0) { finish(); return; }
    const remainSec = Math.ceil(remainMs / 1000);
    const warn = remainMs <= durationSec * 1000 * WARN_RATIO;
    setDisplay(remainSec, { warn });
    setTabTitle(remainSec);
  } else {
    const elapsedSec = Math.floor((swAccumMs + (now - swStartAt)) / 1000);
    setDisplay(elapsedSec);
    setTabTitle(elapsedSec);
  }
}

// ── 컨트롤 ──
function start() {
  if (status === 'running') return;
  ensureAudio();
  const now = Date.now();
  if (mode === 'timer') {
    if (durationSec <= 0) { toast('시간을 먼저 설정해 주세요'); return; }
    const remainMs = status === 'paused' ? remainMsPaused : durationSec * 1000;
    endAt = now + remainMs;
  } else {
    if (status !== 'paused') swAccumMs = 0;
    swStartAt = now;
  }
  status = 'running';
  startTick();
  updateControls();
  persist();
}

function pause() {
  if (status !== 'running') return;
  const now = Date.now();
  if (mode === 'timer') remainMsPaused = Math.max(0, endAt - now);
  else swAccumMs += now - swStartAt;
  status = 'paused';
  stopTick();
  updateControls();
}

function reset() {
  status = 'idle';
  stopTick();
  remainMsPaused = 0;
  swAccumMs = 0;
  setDisplay(mode === 'timer' ? durationSec : 0);
  resetTabTitle();
  document.body.classList.remove('flash');
  updateControls();
}

function finish() {
  status = 'done';
  stopTick();
  setDisplay(0, { warn: true });
  document.title = `⏰ 시간 종료! — ${baseTitle}`;
  flashScreen();
  beep();
  updateControls();
}

function updateControls() {
  const startBtn = $('btn-start');
  startBtn.textContent = status === 'paused' ? '▶ 재개' : '▶ 시작';
  startBtn.disabled = status === 'running';
  $('btn-pause').disabled = status !== 'running';
}

// ── 종료 연출: 화면 플래시 + WebAudio 합성음 (외부 파일 없음) ──
function flashScreen() {
  document.body.classList.remove('flash');
  void document.body.offsetWidth; // 애니메이션 재시작
  document.body.classList.add('flash');
  setTimeout(() => document.body.classList.remove('flash'), 1600);
}

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  try {
    if (!audioCtx) audioCtx = new Ctx();
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  } catch { audioCtx = null; }
}

function beep() {
  if (!audioCtx || audioCtx.state !== 'running') return;
  const t0 = audioCtx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    const t = t0 + i * 0.35;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

// ── 시간 설정 ──
function setDuration(sec) {
  durationSec = clampSec(sec);
  status = 'idle';
  stopTick();
  remainMsPaused = 0;
  setDisplay(durationSec);
  resetTabTitle();
  markPresetChips();
  updateControls();
  persist();
}

function buildPresetChips() {
  const wrap = $('preset-chips');
  PRESETS.forEach((sec) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.dataset.sec = String(sec);
    btn.textContent = `${sec / 60}분`;
    btn.addEventListener('click', () => setDuration(sec));
    wrap.append(btn);
  });
}

function markPresetChips() {
  document.querySelectorAll('#preset-chips .chip-btn').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.sec) === durationSec);
  });
}

function applyCustom() {
  const total = parseCustomInput($('in-min').value, $('in-sec').value);
  if (total === null) {
    toast('올바른 시간을 입력해 주세요 (초는 0~59)');
    return;
  }
  setDuration(total);
}

// ── 모드 전환 ──
function setMode(next) {
  if (mode === next) return;
  mode = next;
  status = 'idle';
  stopTick();
  remainMsPaused = 0;
  swAccumMs = 0;
  const isTimer = mode === 'timer';
  $('tab-timer').classList.toggle('on', isTimer);
  $('tab-timer').setAttribute('aria-selected', String(isTimer));
  $('tab-stopwatch').classList.toggle('on', !isTimer);
  $('tab-stopwatch').setAttribute('aria-selected', String(!isTimer));
  $('setup-panel').hidden = !isTimer;
  setDisplay(isTimer ? durationSec : 0);
  resetTabTitle();
  updateControls();
  persist();
}

function persist() {
  saveState(TOOL, { mode, durationSec });
}

function restoreState() {
  const state = loadState(TOOL);
  if (!state || typeof state !== 'object') return;
  const sec = clampSec(Number(state.durationSec));
  if (sec > 0) durationSec = sec;
  if (state.mode === 'stopwatch') {
    mode = 'timer'; // setMode 가 전환하도록 임시 되돌림
    setMode('stopwatch');
  }
}

// ── 초기화 ──
function init() {
  initTheme();
  initFullscreen('btn-fs');
  buildPresetChips();
  restoreState();
  if (mode === 'timer') setDisplay(durationSec);
  markPresetChips();
  updateControls();

  $('tab-timer').addEventListener('click', () => setMode('timer'));
  $('tab-stopwatch').addEventListener('click', () => setMode('stopwatch'));
  $('btn-custom').addEventListener('click', applyCustom);
  $('btn-start').addEventListener('click', start);
  $('btn-pause').addEventListener('click', pause);
  $('btn-reset').addEventListener('click', reset);

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    if (e.target instanceof Element && e.target.matches('input, textarea, button, select')) return;
    e.preventDefault();
    if (status === 'running') pause();
    else start();
  });
}

init();
