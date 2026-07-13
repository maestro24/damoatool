// 타이머 순수 로직 — DOM 사용 금지 (Node 테스트에서 직접 import)

/** 표시 가능한 최대 초 (23:59:59) */
export const MAX_SEC = 86399;

/**
 * 초 값을 안전한 정수 범위로 보정.
 * 숫자가 아니거나 NaN/Infinity → 0, 음수 → 0, 소수 → 내림, MAX_SEC 초과 → MAX_SEC
 */
export function clampSec(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  const v = Math.floor(n);
  if (v < 0) return 0;
  if (v > MAX_SEC) return MAX_SEC;
  return v;
}

/**
 * 초 → "MM:SS" (1시간 미만) 또는 "H:MM:SS" (1시간 이상)
 * 예: 0 → "00:00", 3599 → "59:59", 3661 → "1:01:01"
 */
export function formatTime(totalSec) {
  const t = clampSec(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * 커스텀 분·초 입력 → 총 초. 유효하지 않으면 null.
 * - 빈 문자열 필드는 0으로 취급 (둘 다 비면 총 0초 → null)
 * - 숫자가 아닌 문자, 음수, 소수 → null
 * - 초 필드는 0~59만 허용 (60 이상 → null)
 * - 총합이 0 이하이거나 MAX_SEC 초과 → null
 */
export function parseCustomInput(minStr, secStr) {
  const min = parseField(minStr);
  const sec = parseField(secStr);
  if (min === null || sec === null) return null;
  if (sec >= 60) return null;
  const total = min * 60 + sec;
  if (total <= 0 || total > MAX_SEC) return null;
  return total;
}

/** 입력 필드 문자열 → 음이 아닌 정수. 빈 값은 0, 그 외 형식 오류는 null */
function parseField(str) {
  const s = String(str ?? '').trim();
  if (s === '') return 0;
  if (!/^\d+$/.test(s)) return null;
  return parseInt(s, 10);
}
