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
    adjusted.evasionRate = Math.min(60, adjusted.evasionRate + 10);
  }
  if (action === 'pray') adjusted.criticalRate = Math.min(65, adjusted.criticalRate + 15);
  return adjusted;
}

function balanceRelativePair(first, second, spreadRatio = 0.15) {
  const midpoint = (first + second) / 2;
  const spread = midpoint * spreadRatio;
  return [
    Math.round(Math.min(midpoint + spread, Math.max(midpoint - spread, first))),
    Math.round(Math.min(midpoint + spread, Math.max(midpoint - spread, second)))
  ];
}

function balancePercentagePair(first, second, maximumGap = 16) {
  const midpoint = (first + second) / 2;
  const halfGap = maximumGap / 2;
  return [
    Math.round(Math.min(midpoint + halfGap, Math.max(midpoint - halfGap, first))),
    Math.round(Math.min(midpoint + halfGap, Math.max(midpoint - halfGap, second)))
  ];
}

export function balanceMatchup(host, guest) {
  const balancedHost = { ...host };
  const balancedGuest = { ...guest };

  [balancedHost.hp, balancedGuest.hp] = balanceRelativePair(host.hp, guest.hp);
  [balancedHost.attack, balancedGuest.attack] = balanceRelativePair(host.attack, guest.attack);
  [balancedHost.evasionRate, balancedGuest.evasionRate] = balancePercentagePair(host.evasionRate, guest.evasionRate);
  [balancedHost.criticalRate, balancedGuest.criticalRate] = balancePercentagePair(host.criticalRate, guest.criticalRate);

  return { host: balancedHost, guest: balancedGuest };
}

export function simulateBattle({ host, guest, hostAction, guestAction, random = Math.random }) {
  if (!ACTIONS.has(hostAction) || !ACTIONS.has(guestAction)) throw new Error('invalid battle action');
  const matchup = balanceMatchup(sanitizeSnapshot(host), sanitizeSnapshot(guest));
  const hostStats = withAction(matchup.host, hostAction);
  const guestStats = withAction(matchup.guest, guestAction);
  const maxHp = { host: hostStats.hp, guest: guestStats.hp };
  const hp = { ...maxHp };
  const events = [];

  let turn = 1;
  while (hp.host > 0 && hp.guest > 0) {
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
    turn += 1;
  }

  // 残りHPの割合では決めず、相手のHPを0にした側だけを勝者にする。
  const hostWon = hp.guest <= 0;
  return { hostWon, maxHp, hp, events };
}
