// 사다리타기 — DOM/Canvas 레이어 (로직은 ladder-core.js)
import {
  $, initTheme, toast, saveState, loadState,
  encodeShare, decodeShare, copyText, shuffle, parseNames,
} from './common.js';
import { mulberry32, generateRungs, computeResult, tracePath } from './ladder-core.js';

const MIN_NAMES = 2;
const MAX_NAMES = 10;
const ROWS = 12;
const PATH_DURATION_MS = 900;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── 상태 (교체 방식으로만 갱신) ──
let state = {
  names: [],        // 위쪽 참가자
  items: [],        // 사용자가 입력한 결과 항목(패딩 전)
  bottomItems: [],  // 아래쪽에 배치된 결과 (셔플됨)
  seed: 0,
  rungs: [],
  result: [],       // result[i] = 참가자 i의 도착 기둥
};
let donePaths = [];   // 완료된 경로 [{ start, pts }]
let activePath = null; // { start, pts, progress }
let animating = false;

const canvas = $('cv-ladder');
const ctx = canvas.getContext('2d');

// ── 색상 ──
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const pathColor = (i, n) => `hsl(${Math.round((i * 360) / Math.max(n, 1) + 15)} 75% 55%)`;

// ── 캔버스 레이아웃 ──
const PAD_X = 26;
const PAD_Y = 14;

function resizeCanvas() {
  const cssW = Math.min(canvas.parentElement.clientWidth, 720);
  const cssH = Math.max(280, Math.min(420, ROWS * 28));
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function layout() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const cols = state.names.length;
  const colX = (c) => (cols < 2 ? w / 2 : PAD_X + (c * (w - PAD_X * 2)) / (cols - 1));
  const rowY = (y) => PAD_Y + (y / ROWS) * (h - PAD_Y * 2);
  return { colX, rowY };
}

function pathToCanvasPoints(pts) {
  const { colX, rowY } = layout();
  return pts.map((p) => ({ x: colX(p.col), y: rowY(p.y) }));
}

// ── 그리기 ──
function drawBase() {
  const { colX, rowY } = layout();
  const cols = state.names.length;
  ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
  if (cols < MIN_NAMES) return;

  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = cssVar('--border') || '#2b313f';

  for (let c = 0; c < cols; c++) {
    ctx.beginPath();
    ctx.moveTo(colX(c), rowY(0));
    ctx.lineTo(colX(c), rowY(ROWS));
    ctx.stroke();
  }
  for (const { row, col } of state.rungs) {
    const y = rowY(row + 0.5);
    ctx.beginPath();
    ctx.moveTo(colX(col), y);
    ctx.lineTo(colX(col + 1), y);
    ctx.stroke();
  }
}

function drawPath(canvasPts, progress, color) {
  const total = [];
  let sum = 0;
  for (let i = 1; i < canvasPts.length; i++) {
    sum += Math.hypot(canvasPts[i].x - canvasPts[i - 1].x, canvasPts[i].y - canvasPts[i - 1].y);
    total.push(sum);
  }
  const target = sum * Math.min(1, Math.max(0, progress));

  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.moveTo(canvasPts[0].x, canvasPts[0].y);
  for (let i = 1; i < canvasPts.length; i++) {
    const segStart = i === 1 ? 0 : total[i - 2];
    const segEnd = total[i - 1];
    if (segEnd <= target) {
      ctx.lineTo(canvasPts[i].x, canvasPts[i].y);
    } else {
      const t = segEnd === segStart ? 1 : (target - segStart) / (segEnd - segStart);
      if (t > 0) {
        ctx.lineTo(
          canvasPts[i - 1].x + (canvasPts[i].x - canvasPts[i - 1].x) * t,
          canvasPts[i - 1].y + (canvasPts[i].y - canvasPts[i - 1].y) * t
        );
      }
      break;
    }
  }
  ctx.stroke();
}

function draw() {
  drawBase();
  const n = state.names.length;
  for (const p of donePaths) drawPath(pathToCanvasPoints(p.pts), 1, pathColor(p.start, n));
  if (activePath) {
    drawPath(pathToCanvasPoints(activePath.pts), activePath.progress, pathColor(activePath.start, n));
  }
}

// ── 라벨 ──
function renderLabels() {
  const top = $('lbl-top');
  const bottom = $('lbl-bottom');
  const n = state.names.length;
  top.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  bottom.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
  top.innerHTML = '';
  bottom.innerHTML = '';
  state.names.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ladder-name';
    btn.textContent = name;
    btn.style.setProperty('--path-color', pathColor(i, n));
    btn.title = `${name} 경로 보기`;
    btn.addEventListener('click', () => runSingle(i));
    top.appendChild(btn);
  });
  state.bottomItems.forEach((item) => {
    const span = document.createElement('span');
    span.className = 'ladder-item';
    span.textContent = item;
    bottom.appendChild(span);
  });
}

// ── 결과 표 ──
function renderResultTable(revealSet = null) {
  const box = $('result-card');
  const tbody = $('tbl-body');
  tbody.innerHTML = '';
  let shown = 0;
  state.names.forEach((name, i) => {
    if (revealSet && !revealSet.has(i)) return;
    const prize = state.bottomItems[state.result[i]];
    const tr = document.createElement('tr');
    const tdName = document.createElement('td');
    tdName.textContent = name;
    tdName.style.color = pathColor(i, state.names.length);
    tdName.style.fontWeight = '800';
    const tdPrize = document.createElement('td');
    tdPrize.textContent = prize;
    if (prize !== '꽝') tdPrize.classList.add('win');
    tr.append(tdName, tdPrize);
    tbody.appendChild(tr);
    shown += 1;
  });
  box.hidden = shown === 0;
}

// ── 입력 파싱 ──
function readNames() {
  const raw = $('in-names').value.replace(/,/g, '\n');
  return parseNames(raw, { max: MAX_NAMES });
}

function readItems(count) {
  const raw = $('in-items').value.replace(/\n/g, ',');
  const entered = raw.split(',').map((s) => s.trim()).filter(Boolean).slice(0, count);
  const base = entered.length > 0 ? entered : ['당첨'];
  return [...base, ...new Array(Math.max(0, count - base.length)).fill('꽝')].slice(0, count);
}

// ── 사다리 생성 ──
function build({ seed, names, items } = {}) {
  const nextNames = names ?? readNames();
  if (nextNames.length < MIN_NAMES) {
    toast(`참가자를 ${MIN_NAMES}명 이상 입력하세요`);
    return false;
  }
  const nextItems = items ?? readItems(nextNames.length);
  const nextSeed = seed ?? ((Math.random() * 0x100000000) >>> 0);
  const rng = mulberry32(nextSeed);
  const bottomItems = shuffle(
    [...nextItems, ...new Array(Math.max(0, nextNames.length - nextItems.length)).fill('꽝')].slice(0, nextNames.length),
    rng
  );
  const rungs = generateRungs(nextNames.length, ROWS, rng);
  state = {
    names: nextNames,
    items: nextItems,
    bottomItems,
    seed: nextSeed,
    rungs,
    result: computeResult(nextNames.length, rungs),
  };
  donePaths = [];
  activePath = null;
  renderLabels();
  renderResultTable(new Set());
  resizeCanvas();
  saveState('ladder', { names: state.names, items: state.items });
  $('btn-start').disabled = false;
  $('btn-share').disabled = false;
  return true;
}

// ── 애니메이션 ──
function animatePath(start) {
  return new Promise((resolve) => {
    const pts = tracePath(start, ROWS, state.rungs);
    if (reducedMotion) {
      donePaths = [...donePaths, { start, pts }];
      draw();
      resolve();
      return;
    }
    activePath = { start, pts, progress: 0 };
    const t0 = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - t0) / PATH_DURATION_MS);
      activePath = { ...activePath, progress };
      draw();
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        donePaths = [...donePaths, { start, pts }];
        activePath = null;
        draw();
        resolve();
      }
    };
    requestAnimationFrame(tick);
  });
}

async function runAll() {
  if (animating || state.names.length < MIN_NAMES) return;
  animating = true;
  $('btn-start').disabled = true;
  donePaths = [];
  const revealed = new Set();
  renderResultTable(revealed);
  for (let i = 0; i < state.names.length; i++) {
    await animatePath(i);
    revealed.add(i);
    renderResultTable(revealed);
  }
  animating = false;
  $('btn-start').disabled = false;
  toast('🪜 결과가 나왔어요!');
}

async function runSingle(i) {
  if (animating || state.names.length < MIN_NAMES) return;
  animating = true;
  donePaths = [];
  await animatePath(i);
  animating = false;
  renderResultTable(new Set([i]));
  toast(`${state.names[i]} → ${state.bottomItems[state.result[i]]}`);
}

// ── 공유 ──
async function shareResult() {
  if (state.names.length < MIN_NAMES) return;
  const payload = { n: state.names, i: state.items, s: state.seed };
  const url = `${location.origin}${location.pathname}?r=${encodeShare(payload)}`;
  const ok = await copyText(url);
  toast(ok ? '결과 링크를 복사했어요' : '복사에 실패했어요. 주소창을 이용해 주세요');
}

function restoreFromUrl() {
  const raw = new URLSearchParams(location.search).get('r');
  if (!raw) return false;
  const data = decodeShare(raw);
  if (!data || !Array.isArray(data.n) || data.n.length < MIN_NAMES || data.n.length > MAX_NAMES
    || !Number.isInteger(data.s)) {
    toast('공유 링크를 해석하지 못했어요');
    return false;
  }
  const names = data.n.map(String).slice(0, MAX_NAMES);
  const items = (Array.isArray(data.i) ? data.i : ['당첨']).map(String).slice(0, names.length);
  $('in-names').value = names.join('\n');
  $('in-items').value = items.join(', ');
  if (build({ seed: data.s >>> 0, names, items })) {
    donePaths = names.map((_, i) => ({ start: i, pts: tracePath(i, ROWS, state.rungs) }));
    draw();
    renderResultTable();
    toast('공유된 결과를 복원했어요');
    return true;
  }
  return false;
}

// ── 초기화 ──
function init() {
  initTheme();

  const saved = loadState('ladder', null);
  if (saved?.names?.length) $('in-names').value = saved.names.join('\n');
  if (saved?.items?.length) $('in-items').value = saved.items.join(', ');

  $('btn-build').addEventListener('click', () => { if (build()) toast('사다리 완성! 시작을 눌러 보세요'); });
  $('btn-reshuffle').addEventListener('click', () => { if (build()) toast('새 사다리로 섞었어요'); });
  $('btn-start').addEventListener('click', runAll);
  $('btn-share').addEventListener('click', shareResult);

  window.addEventListener('resize', resizeCanvas);

  if (!restoreFromUrl() && saved?.names?.length >= MIN_NAMES) build();
  resizeCanvas();
}

init();
