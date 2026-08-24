import {
  LEADERBOARD_LIMIT,
  getJstDayKey,
  getSeasonWindow,
  isSeasonReadyToFinalize
} from './ranking-rules.mjs';

function privateEntry(row) {
  return {
    rank: Number(row.rank),
    playerId: row.player_id,
    displayName: row.display_name,
    wins: Number(row.wins),
    connections: Number(row.connections)
  };
}

function publicEntry(row, isMe = false) {
  return {
    rank: Number(row.rank),
    displayName: row.display_name,
    wins: Number(row.wins),
    connections: Number(row.connections),
    isMe: Boolean(isMe)
  };
}

async function rankingRows(db, seasonKey, limit = LEADERBOARD_LIMIT) {
  const statement = db.prepare(`
    WITH totals AS (
      SELECT
        scores.player_id,
        profiles.display_name,
        scores.wins,
        scores.achieved_at,
        COUNT(opponents.opponent_id) AS connections
      FROM season_scores AS scores
      JOIN profiles ON profiles.player_id = scores.player_id
      LEFT JOIN season_opponents AS opponents
        ON opponents.season_key = scores.season_key
       AND opponents.player_id = scores.player_id
      WHERE scores.season_key = ?
      GROUP BY scores.player_id, profiles.display_name, scores.wins, scores.achieved_at
    ), ranked AS (
      SELECT
        player_id,
        display_name,
        wins,
        connections,
        ROW_NUMBER() OVER (
          ORDER BY wins DESC, connections DESC, achieved_at ASC, player_id ASC
        ) AS rank
      FROM totals
    )
    SELECT player_id, display_name, wins, connections, rank
    FROM ranked
    ORDER BY rank
    LIMIT ?
  `);
  const result = await statement.bind(seasonKey, limit).all();
  return result.results || [];
}

async function rankingRowForPlayer(db, seasonKey, playerId) {
  return db.prepare(`
    WITH totals AS (
      SELECT
        scores.player_id,
        profiles.display_name,
        scores.wins,
        scores.achieved_at,
        COUNT(opponents.opponent_id) AS connections
      FROM season_scores AS scores
      JOIN profiles ON profiles.player_id = scores.player_id
      LEFT JOIN season_opponents AS opponents
        ON opponents.season_key = scores.season_key
       AND opponents.player_id = scores.player_id
      WHERE scores.season_key = ?
      GROUP BY scores.player_id, profiles.display_name, scores.wins, scores.achieved_at
    ), ranked AS (
      SELECT
        player_id,
        display_name,
        wins,
        connections,
        ROW_NUMBER() OVER (
          ORDER BY wins DESC, connections DESC, achieved_at ASC, player_id ASC
        ) AS rank
      FROM totals
    )
    SELECT player_id, display_name, wins, connections, rank
    FROM ranked
    WHERE player_id = ?
  `).bind(seasonKey, playerId).first();
}

export async function createProfile(db, { playerId, tokenHash, displayName, createdAt }) {
  await db.prepare(`
    INSERT INTO profiles (player_id, token_hash, display_name, created_at)
    VALUES (?, ?, ?, ?)
  `).bind(playerId, tokenHash, displayName, createdAt).run();
  return { playerId, displayName };
}

export async function getProfile(db, playerId) {
  return db.prepare(`
    SELECT player_id, token_hash, display_name, created_at
    FROM profiles
    WHERE player_id = ?
  `).bind(playerId).first();
}

export async function deleteProfile(db, playerId) {
  const statements = [
    db.prepare('DELETE FROM matches WHERE host_id = ? OR guest_id = ?').bind(playerId, playerId),
    db.prepare('DELETE FROM season_awards WHERE player_id = ?').bind(playerId),
    db.prepare('DELETE FROM season_opponents WHERE player_id = ? OR opponent_id = ?').bind(playerId, playerId),
    db.prepare('DELETE FROM daily_win_caps WHERE winner_id = ? OR loser_id = ?').bind(playerId, playerId),
    db.prepare('DELETE FROM season_scores WHERE player_id = ?').bind(playerId),
    db.prepare('DELETE FROM profiles WHERE player_id = ?').bind(playerId)
  ];
  await db.batch(statements);
}

export async function recordRankedMatch(db, {
  matchId,
  hostId,
  guestId,
  winnerId,
  loserId,
  finishedAt = Date.now()
}) {
  if (!hostId || !guestId || hostId === guestId) {
    return { eligible: false, counted: false };
  }

  const profiles = await db.prepare(`
    SELECT player_id FROM profiles WHERE player_id IN (?, ?)
  `).bind(hostId, guestId).all();
  if ((profiles.results || []).length !== 2) {
    return { eligible: false, counted: false };
  }

  const { seasonKey } = getSeasonWindow(finishedAt);
  const dayKey = getJstDayKey(finishedAt);
  await db.prepare(`
    INSERT OR IGNORE INTO matches (
      match_id, season_key, day_key, host_id, guest_id,
      winner_id, loser_id, finished_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    matchId,
    seasonKey,
    dayKey,
    hostId,
    guestId,
    winnerId,
    loserId,
    finishedAt
  ).run();

  const stored = await db.prepare(`
    SELECT season_key, ranked_win_counted
    FROM matches
    WHERE match_id = ?
  `).bind(matchId).first();
  return {
    eligible: Boolean(stored),
    counted: Boolean(stored?.ranked_win_counted),
    seasonKey: stored?.season_key || seasonKey
  };
}

export async function finalizeCompletedSeasons(db, now = Date.now()) {
  const { seasonKey: currentSeasonKey } = getSeasonWindow(now);
  const pending = await db.prepare(`
    SELECT DISTINCT scores.season_key
    FROM season_scores AS scores
    LEFT JOIN season_finalizations AS finalizations
      ON finalizations.season_key = scores.season_key
    WHERE scores.season_key < ? AND finalizations.season_key IS NULL
    ORDER BY scores.season_key
  `).bind(currentSeasonKey).all();

  for (const row of pending.results || []) {
    // A match completed immediately before Monday 00:00 JST can still be retried
    // by its room for up to 15 minutes. Wait out that window before making the
    // permanent top-three awards immutable.
    if (!isSeasonReadyToFinalize(row.season_key, now)) continue;
    const winners = await rankingRows(db, row.season_key, 3);
    const statements = winners.map((winner, index) => db.prepare(`
      INSERT OR IGNORE INTO season_awards (season_key, player_id, rank, awarded_at)
      VALUES (?, ?, ?, ?)
    `).bind(row.season_key, winner.player_id, index + 1, now));
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO season_finalizations (season_key, finalized_at)
      VALUES (?, ?)
    `).bind(row.season_key, now));
    await db.batch(statements);
  }
}

export async function getActiveAwardRank(db, playerId, now = Date.now(), { finalize = true } = {}) {
  if (!playerId) return null;
  if (finalize) await finalizeCompletedSeasons(db, now);
  const current = getSeasonWindow(now);
  const previousSeasonKey = getSeasonWindow(current.startsAtMs - 1).seasonKey;
  const award = await db.prepare(`
    SELECT rank
    FROM season_awards
    WHERE season_key = ? AND player_id = ?
  `).bind(previousSeasonKey, playerId).first();
  return award ? Number(award.rank) : null;
}

export async function getWeeklyRankings(db, playerId, now = Date.now()) {
  await finalizeCompletedSeasons(db, now);
  const season = getSeasonWindow(now);
  const rows = await rankingRows(db, season.seasonKey, LEADERBOARD_LIMIT);
  const entries = rows.map((row) => publicEntry(row, row.player_id === playerId));

  const topRowForPlayer = rows.find((row) => row.player_id === playerId) || null;
  let me = topRowForPlayer ? privateEntry(topRowForPlayer) : null;
  if (playerId && !me) {
    const row = await rankingRowForPlayer(db, season.seasonKey, playerId);
    me = row ? privateEntry(row) : null;
  }

  const activeAwardRank = await getActiveAwardRank(db, playerId, now, { finalize: false });
  if (me) {
    me.activeAwardRank = activeAwardRank;
  } else if (playerId) {
    const profile = await getProfile(db, playerId);
    if (profile) {
      me = {
        rank: null,
        playerId: profile.player_id,
        displayName: profile.display_name,
        wins: 0,
        connections: 0,
        activeAwardRank
      };
    }
  }

  let awards = [];
  if (playerId) {
    const result = await db.prepare(`
      SELECT season_key, rank
      FROM season_awards
      WHERE player_id = ?
      ORDER BY season_key DESC
    `).bind(playerId).all();
    awards = (result.results || []).map((award) => ({
      seasonKey: award.season_key,
      rank: Number(award.rank)
    }));
  }

  return {
    seasonKey: season.seasonKey,
    seasonEndsAt: season.endsAt,
    entries,
    me,
    awards
  };
}
