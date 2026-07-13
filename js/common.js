// 다모아툴 공용 모듈 — 테마, 토스트, 저장, 공유, 랜덤
export const $ = (id) => document.getElementById(id);

// ── 테마 ──
const PREF_KEY = 'damoa_prefs';
export const prefs = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
if (!prefs.theme) prefs.theme = window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

export function initTheme() {
  document.documentElement.dataset.theme = prefs.theme;
  const btn = $('btn-theme');
  if (!btn) return;
  btn.textContent = prefs.theme === 'dark' ? '☀' : '☾';
  btn.addEventListener('click', () => {
    prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    document.documentElement.dataset.theme = prefs.theme;
    btn.textContent = prefs.theme === 'dark' ? '☀' : '☾';
  });
}

// ── 토스트 ──
export function toast(msg, duration = 1600) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  wrap.prepend(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 350); }, duration);
}

// ── 도구별 상태 저장 ──
export function saveState(tool, state) {
  try { localStorage.setItem(`damoa_${tool}`, JSON.stringify(state)); } catch { /* full */ }
}
export function loadState(tool, fallback = null) {
  try {
    const raw = localStorage.getItem(`damoa_${tool}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

// ── URL 공유 (유니코드 안전 base64) ──
export function encodeShare(obj) {
  const json = JSON.stringify(obj);
  return btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}
export function decodeShare(str) {
  try {
    const bytes = Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

// ── 랜덤 (테스트 가능하게 rng 주입식) ──
/** Fisher-Yates 셔플. 원본 불변, 새 배열 반환 */
export function shuffle(arr, rng = Math.random) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** 명단을 n팀으로 균등 분배 (크기 차 최대 1) */
export function splitTeams(names, n, rng = Math.random) {
  if (n < 2 || names.length < n) return null;
  const shuffled = shuffle(names, rng);
  const teams = Array.from({ length: n }, () => []);
  shuffled.forEach((name, i) => teams[i % n].push(name));
  return teams;
}

/** 텍스트영역 → 이름 배열 (공백/중복 제거) */
export function parseNames(text, { max = 100 } = {}) {
  const seen = new Set();
  const out = [];
  for (const line of (text || '').split(/\r?\n/)) {
    const name = line.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

// ── 전체화면 ──
export function initFullscreen(btnId) {
  const btn = $(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  const sync = () => {
    // Fullscreen API + F11 브라우저 전체화면(이벤트 없음 → 크기 휴리스틱) 모두 감지
    const f11Like = window.innerHeight >= screen.height - 2
      && window.innerWidth >= screen.width - 2;
    document.body.classList.toggle('fs-active', !!document.fullscreenElement || f11Like);
  };
  document.addEventListener('fullscreenchange', sync);
  window.addEventListener('resize', sync);
  sync();
}
