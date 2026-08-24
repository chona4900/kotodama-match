const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const DAILY_WIN_LIMIT = 3;
export const LEADERBOARD_LIMIT = 100;
export const SEASON_FINALIZATION_GRACE_MS = 15 * 60 * 1000;
export const STAMPS = new Set(['thanks', 'nice', 'again']);

const NAME_PREFIXES = [
  'あおぞらの', 'おひさまの', 'きらきらの', 'そよかぜの',
  'にじいろの', 'ほしぞらの', 'まんまるの', 'わくわくの'
];

const NAME_CHARACTERS = [
  '白蛇っち', '八咫烏っち', '勾玉っち', '鏡っち',
  '剣っち', '桜っち', '月っち', '雲っち'
];

function epochMilliseconds(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

function isoDateInJst(epochMs) {
  return new Date(epochMs + JST_OFFSET_MS).toISOString().slice(0, 10);
}

export function getSeasonWindow(now = Date.now()) {
  const nowMs = epochMilliseconds(now);
  if (!Number.isFinite(nowMs)) throw new Error('invalid season date');

  const shifted = new Date(nowMs + JST_OFFSET_MS);
  const daysSinceMonday = (shifted.getUTCDay() + 6) % 7;
  const shiftedMonday = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate() - daysSinceMonday
  );
  const startsAtMs = shiftedMonday - JST_OFFSET_MS;
  const endsAtMs = startsAtMs + WEEK_MS;

  return {
    seasonKey: isoDateInJst(startsAtMs),
    startsAt: new Date(startsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    startsAtMs,
    endsAtMs
  };
}

export function getJstDayKey(now = Date.now()) {
  const nowMs = epochMilliseconds(now);
  if (!Number.isFinite(nowMs)) throw new Error('invalid day date');
  return isoDateInJst(nowMs);
}

export function isSeasonReadyToFinalize(
  seasonKey,
  now = Date.now(),
  graceMs = SEASON_FINALIZATION_GRACE_MS
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(seasonKey))) return false;
  const startsAtMs = Date.parse(`${seasonKey}T00:00:00+09:00`);
  const nowMs = epochMilliseconds(now);
  return Number.isFinite(startsAtMs)
    && Number.isFinite(nowMs)
    && Number.isFinite(graceMs)
    && graceMs >= 0
    && nowMs >= startsAtMs + WEEK_MS + graceMs;
}

export function shouldCountDailyWin(currentCount) {
  return Number.isInteger(currentCount) && currentCount >= 0 && currentCount < DAILY_WIN_LIMIT;
}

export function compareLeaderboardEntries(first, second) {
  return second.wins - first.wins
    || second.connections - first.connections
    || first.achievedAt - second.achievedAt
    || String(first.playerId).localeCompare(String(second.playerId));
}

export function rankLeaderboardEntries(entries) {
  return [...entries]
    .sort(compareLeaderboardEntries)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function isAllowedStamp(value) {
  return STAMPS.has(value);
}

export function canSendPostMatchStamp({ phase, existingStamp, stamp }) {
  return phase === 'finished' && !existingStamp && isAllowedStamp(stamp);
}

export function createSafeDisplayName(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) {
    throw new Error('four random bytes are required');
  }
  const suffix = ((bytes[2] << 8) | bytes[3]) % 1000;
  return `${NAME_PREFIXES[bytes[0] % NAME_PREFIXES.length]}${NAME_CHARACTERS[bytes[1] % NAME_CHARACTERS.length]}・${String(suffix).padStart(3, '0')}`;
}
