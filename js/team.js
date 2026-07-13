// 팀 나누기 — DOM 로직 (순수 로직은 common.js 의 splitTeams/parseNames 사용)
import {
  $, initTheme, toast, saveState, loadState,
  encodeShare, decodeShare, copyText, splitTeams, parseNames,
} from './common.js';

const TOOL = 'team';
const MAX_NAMES = 100;
const MIN_TEAMS = 2;
const MAX_TEAMS = 10;

let selectedCount = 2;
let currentTeams = null;   // string[][] — 마지막 편성 결과
let currentLeader = false; // 결과 생성 시점의 팀장 옵션

// ── 팀 이름 ──
function parseTeamNames(text) {
  return (text || '').split(',').map((s) => s.trim()).filter(Boolean);
}
function teamLabel(i, customNames) {
  return customNames[i] || `${i + 1}팀`;
}

// ── 팀 수 칩 ──
function buildCountChips() {
  const wrap = $('team-count-chips');
  for (let n = MIN_TEAMS; n <= MAX_TEAMS; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-btn';
    btn.textContent = `${n}팀`;
    btn.dataset.count = String(n);
    btn.addEventListener('click', () => selectCount(n));
    wrap.append(btn);
  }
}
function selectCount(n) {
  selectedCount = n;
  document.querySelectorAll('#team-count-chips .chip-btn').forEach((b) => {
    b.classList.toggle('on', Number(b.dataset.count) === n);
  });
}

// ── 결과 렌더링 ──
function renderTeams(teams, leader, customNames) {
  const wrap = $('teams');
  wrap.innerHTML = '';
  teams.forEach((members, i) => {
    const card = document.createElement('article');
    card.className = 'team-card';
    card.style.setProperty('--i', String(i));
    const h = document.createElement('h3');
    h.textContent = `${teamLabel(i, customNames)} · ${members.length}명`;
    const ul = document.createElement('ul');
    members.forEach((name, j) => {
      const li = document.createElement('li');
      li.textContent = leader && j === 0 ? `👑 ${name}` : name;
      ul.append(li);
    });
    card.append(h, ul);
    wrap.append(card);
  });
  $('result-wrap').hidden = false;
  $('btn-reshuffle').disabled = false;
}

function resultText(teams, leader, customNames) {
  return teams
    .map((members, i) => {
      const list = members
        .map((n, j) => (leader && j === 0 ? `👑${n}` : n))
        .join(', ');
      return `${teamLabel(i, customNames)}: ${list}`;
    })
    .join('\n');
}

// ── 팀 짜기 ──
function runSplit() {
  const names = parseNames($('names').value, { max: MAX_NAMES });
  if (names.length < 2) {
    toast('이름을 2명 이상 입력해 주세요');
    return;
  }
  const teams = splitTeams(names, selectedCount);
  if (!teams) {
    toast(`인원(${names.length}명)이 팀 수(${selectedCount}팀)보다 적어요`);
    return;
  }
  currentTeams = teams;
  currentLeader = $('opt-leader').checked;
  renderTeams(teams, currentLeader, parseTeamNames($('team-names').value));
  persist();
}

function persist() {
  saveState(TOOL, {
    names: $('names').value,
    count: selectedCount,
    leader: $('opt-leader').checked,
    teamNames: $('team-names').value,
  });
}

// ── 공유 / 복사 ──
async function shareResult() {
  if (!currentTeams) return;
  const payload = {
    t: currentTeams,
    l: currentLeader ? 1 : 0,
    n: parseTeamNames($('team-names').value),
  };
  const url = `${location.origin}${location.pathname}?r=${encodeURIComponent(encodeShare(payload))}`;
  const ok = await copyText(url);
  toast(ok ? '공유 링크를 복사했어요' : '복사에 실패했어요');
}

async function copyResult() {
  if (!currentTeams) return;
  const text = resultText(currentTeams, currentLeader, parseTeamNames($('team-names').value));
  const ok = await copyText(text);
  toast(ok ? '결과를 복사했어요' : '복사에 실패했어요');
}

// ── URL 복원 (?r=) ──
function restoreFromUrl() {
  const raw = new URLSearchParams(location.search).get('r');
  if (!raw) return false;
  const data = decodeShare(raw);
  if (!data || !Array.isArray(data.t) || data.t.length === 0) return false;
  if (!data.t.every((team) => Array.isArray(team))) return false;
  currentTeams = data.t.map((team) => team.slice(0, MAX_NAMES).map(String));
  currentLeader = data.l === 1;
  const custom = Array.isArray(data.n) ? data.n.map(String) : [];
  $('team-names').value = custom.join(', ');
  $('opt-leader').checked = currentLeader;
  renderTeams(currentTeams, currentLeader, custom);
  toast('공유된 결과를 불러왔어요');
  return true;
}

// ── 저장 상태 복원 ──
function restoreState() {
  const state = loadState(TOOL);
  if (!state || typeof state !== 'object') return;
  if (typeof state.names === 'string') $('names').value = state.names;
  if (typeof state.teamNames === 'string') $('team-names').value = state.teamNames;
  if (typeof state.leader === 'boolean') $('opt-leader').checked = state.leader;
  const count = Number(state.count);
  if (Number.isInteger(count) && count >= MIN_TEAMS && count <= MAX_TEAMS) {
    selectCount(count);
    return;
  }
  selectCount(selectedCount);
}

function updateNameCount() {
  const n = parseNames($('names').value, { max: MAX_NAMES }).length;
  $('name-count').textContent = `${n}명`;
}

// ── 초기화 ──
function init() {
  initTheme();
  buildCountChips();
  restoreState();
  updateNameCount();

  $('names').addEventListener('input', updateNameCount);
  $('btn-split').addEventListener('click', runSplit);
  $('btn-reshuffle').addEventListener('click', runSplit);
  $('btn-share').addEventListener('click', shareResult);
  $('btn-copy').addEventListener('click', copyResult);

  restoreFromUrl();
}

init();
