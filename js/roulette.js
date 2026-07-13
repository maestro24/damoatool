// 원판 룰렛 — DOM/Canvas 레이어 (로직은 roulette-core.js)
import {
  $, initTheme, toast, saveState, loadState, parseNames, initFullscreen,
} from './common.js';
import {
  TAU, pickIndex, computeTargetAngle, angleToIndex, normalizeAngle, easeOutCubic,
} from './roulette-core.js';

const MIN_ITEMS = 2;
const MAX_ITEMS = 12;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const PRESETS = {
  lunch: { label: '점심 메뉴', items: ['김치찌개', '돈까스', '국밥', '파스타', '샐러드', '버거', '초밥', '쌀국수'] },
  clean: { label: '청소 당번', items: ['교실 앞', '교실 뒤', '복도', '창문', '칠판', '분리수거'] },
  order: { label: '발표 순서', items: ['1번', '2번', '3번', '4번', '5번', '6번'] },
};

// ── 상태 ──
let items = [];
let rotation = 0;       // 절대 회전각 (라디안, 시계 방향 양수, 계속 증가)
let spinning = false;
let winnerIndex = -1;

const canvas = $('cv-wheel');
const ctx = canvas.getContext('2d');
const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const segColor = (i, n) => `hsl(${Math.round((i * 360) / n + 265)} 62% ${i % 2 === 0 ? 56 : 46}%)`;

// ── 캔버스 ──
function resizeCanvas() {
  const size = Math.min(canvas.parentElement.clientWidth - 8, 420);
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.width = Math.round(size * dpr);
  canvas.height = Math.round(size * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw();
}

function draw() {
  const size = canvas.clientWidth;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 14;
  ctx.clearRect(0, 0, size, size);
  if (items.length < MIN_ITEMS || radius <= 0) return;

  const n = items.length;
  const seg = TAU / n;
  const baseStart = -Math.PI / 2 + rotation; // 세그먼트 0의 시작 (12시 기준, 시계 방향)

  for (let i = 0; i < n; i++) {
    const a0 = baseStart + i * seg;
    const a1 = a0 + seg;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, a0, a1);
    ctx.closePath();
    ctx.fillStyle = segColor(i, n);
    ctx.fill();
    if (!spinning && i === winnerIndex) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = cssVar('--bg-card') || '#191c23';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 라벨 (세그먼트 중앙, 바깥쪽으로)
    const mid = a0 + seg / 2;
    ctx.save();
    ctx.translate(cx + Math.cos(mid) * radius * 0.62, cy + Math.sin(mid) * radius * 0.62);
    ctx.rotate(mid + (Math.cos(mid) < 0 ? Math.PI : 0)); // 왼쪽 반원은 뒤집어 가독성 확보
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.max(12, Math.min(17, radius / 8))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = items[i].length > 6 ? `${items[i].slice(0, 6)}…` : items[i];
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  // 중앙 허브
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 0.13, 0, TAU);
  ctx.fillStyle = cssVar('--bg-card') || '#191c23';
  ctx.fill();
  ctx.strokeStyle = cssVar('--border') || '#2b313f';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 상단 포인터
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy - radius - 12);
  ctx.lineTo(cx + 12, cy - radius - 12);
  ctx.lineTo(cx, cy - radius + 12);
  ctx.closePath();
  ctx.fillStyle = cssVar('--tool-accent') || '#b57bee';
  ctx.fill();
}

// ── 입력 동기화 ──
function syncItems({ silent = false } = {}) {
  items = parseNames($('in-items').value, { max: MAX_ITEMS });
  winnerIndex = -1;
  $('btn-spin').disabled = items.length < MIN_ITEMS || spinning;
  if (!silent && $('in-items').value.trim() && items.length < MIN_ITEMS) {
    toast(`항목을 ${MIN_ITEMS}개 이상 입력하세요`);
  }
  saveState('roulette', { items, remove: $('chk-remove').checked });
  draw();
}

// ── 돌리기 ──
function finishSpin(index) {
  spinning = false;
  winnerIndex = index;
  // 역검증: 멈춘 각도가 실제로 해당 세그먼트를 가리키는지 확인
  const verified = angleToIndex(rotation, items.length);
  const finalIndex = verified === index ? index : verified;
  winnerIndex = finalIndex;
  const winner = items[finalIndex];
  $('result-text').textContent = winner;
  $('result-box').hidden = false;
  $('btn-spin').disabled = false;
  draw();
  toast(`🎯 ${winner}!`);

  if ($('chk-remove').checked && items.length > MIN_ITEMS) {
    setTimeout(() => {
      if (spinning) return;
      items = items.filter((_, i) => i !== finalIndex);
      winnerIndex = -1;
      $('in-items').value = items.join('\n');
      saveState('roulette', { items, remove: true });
      draw();
      toast(`"${winner}" 항목을 뺐어요 (${items.length}개 남음)`);
    }, 1400);
  }
}

function spin() {
  if (spinning || items.length < MIN_ITEMS) return;
  spinning = true;
  winnerIndex = -1;
  $('btn-spin').disabled = true;
  $('result-box').hidden = true;

  const index = pickIndex(items.length);
  // 목표: 최소 4바퀴 이상 더 돈 뒤 index 세그먼트 중앙에 정지
  const baseTarget = normalizeAngle(computeTargetAngle(index, items.length, 0));
  const extraTurns = 4 + Math.floor(Math.random() * 3); // 4~6바퀴
  const target = rotation + extraTurns * TAU + normalizeAngle(baseTarget - rotation);
  const duration = reducedMotion ? 0 : 4000 + Math.random() * 2000; // 4~6초

  if (duration === 0) {
    rotation = target;
    finishSpin(index);
    return;
  }

  const startRotation = rotation;
  const t0 = performance.now();
  const tick = (now) => {
    const t = Math.min(1, (now - t0) / duration);
    rotation = startRotation + (target - startRotation) * easeOutCubic(t);
    draw();
    if (t < 1) requestAnimationFrame(tick);
    else finishSpin(index);
  };
  requestAnimationFrame(tick);
}

// ── 초기화 ──
function init() {
  initTheme();
  initFullscreen('btn-fs');

  const saved = loadState('roulette', null);
  if (saved?.items?.length) {
    $('in-items').value = saved.items.join('\n');
    $('chk-remove').checked = !!saved.remove;
  } else {
    $('in-items').value = PRESETS.lunch.items.join('\n');
  }

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = PRESETS[btn.dataset.preset];
      if (!preset) return;
      $('in-items').value = preset.items.join('\n');
      syncItems({ silent: true });
      toast(`${preset.label} 프리셋을 불러왔어요`);
    });
  });

  $('in-items').addEventListener('input', () => syncItems({ silent: true }));
  $('chk-remove').addEventListener('change', () => syncItems({ silent: true }));
  $('btn-spin').addEventListener('click', spin);

  window.addEventListener('resize', resizeCanvas);
  new MutationObserver(() => draw())
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  syncItems({ silent: true });
  resizeCanvas();
}

init();
