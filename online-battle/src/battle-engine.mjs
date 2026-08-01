export const ACTIONS = new Set(['attack', 'guard', 'pray']);

const SNAPSHOT_LIMITS = {
  hp: [100, 5000],
  attack: [10, 1000],
  evasionRate: [0, 75],
  criticalRate: [0, 75],
  wins: [0, 99999]
};

function clampInteger(value, [minimum, maximum], field) {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${field} is outside the permitted range`);
  }
  return value;
}

export function sanitizeSnapshot(input) {
  if (!input || typeof input !== 'object') throw new Error('battle snapshot is required');
  const form = typeof input.form === 'string' && /^[a-z0-9_-]{1,40}$/i.test(input.form)
    ? input.form
    : 'egg';

  return {
    form,
    hp: clampInteger(input.hp, SNAPSHOT_LIMITS.hp, 'hp'),
    attack: clampInteger(input.attack, SNAPSHOT_LIMITS.attack, 'attack'),
    evasionRate: clampInteger(input.evasionRate, SNAPSHOT_LIMITS.evasionRate, 'evasionRate'),
    criticalRate: clampInteger(input.criticalRate, SNAPSHOT_LIMITS.criticalRate, 'criticalRate'),
    wins: clampInteger(input.wins ?? 0, SNAPSHOT_LIMITS.wins, 'wins')
  };
}

function withAction(snapshot, action) {
  const adjusted = { ...snapshot };
  if (action === 'attack') adjusted.attack = Math.max(1, Math.round(adjusted.attack * 1.35));
  if (action === 'guard') {
    adjusted.hp = Math.max(1, Math.round(adjusted.hp * 1.4));
    adjusted.evasionRate = Math.min(75, adjusted.evasionRate + 10);
  }
  if (action === 'pray') adjusted.criticalRate = Math.min(80, adjusted.criticalRate + 15);
  return adjusted;
}

export function simulateBattle({ host, guest, hostAction, guestAction, random = Math.random }) {
  if (!ACTIONS.has(hostAction) || !ACTIONS.has(guestAction)) throw new Error('invalid battle action');
  const hostStats = withAction(sanitizeSnapshot(host), hostAction);
  const guestStats = withAction(sanitizeSnapshot(guest), guestAction);
  const maxHp = { host: hostStats.hp, guest: guestStats.hp };
  const hp = { ...maxHp };
  const events = [];

  for (let turn = 1; turn <= 8 && hp.host > 0 && hp.guest > 0; turn += 1) {
    const attacker = random() >= 0.5 ? 'host' : 'guest';
    const defender = attacker === 'host' ? 'guest' : 'host';
    const attackerStats = attacker === 'host' ? hostStats : guestStats;
    const defenderStats = defender === 'host' ? hostStats : guestStats;
    const hit = random() > defenderStats.evasionRate / 100;
    const critical = hit && random() < attackerStats.criticalRate / 100;
    const damage = hit
      ? Math.max(1, Math.round((attackerStats.attack + Math.floor(random() * 20)) * (critical ? 1.5 : 1)))
      : 0;
    hp[defender] = Math.max(0, hp[defender] - damage);
    events.push({ turn, attacker, hit, critical, damage, hp: { ...hp } });
  }

  const hostRatio = hp.host / maxHp.host;
  const guestRatio = hp.guest / maxHp.guest;
  const hostWon = hostRatio === guestRatio ? random() >= 0.5 : hostRatio > guestRatio;
  return { hostWon, maxHp, hp, events };
}
