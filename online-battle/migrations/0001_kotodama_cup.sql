PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  player_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS matches (
  match_id TEXT PRIMARY KEY,
  season_key TEXT NOT NULL,
  day_key TEXT NOT NULL,
  host_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  winner_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  loser_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  finished_at INTEGER NOT NULL,
  ranked_win_counted INTEGER NOT NULL DEFAULT 0 CHECK (ranked_win_counted IN (0, 1)),
  CHECK (host_id <> guest_id),
  CHECK (winner_id <> loser_id),
  CHECK (winner_id IN (host_id, guest_id)),
  CHECK (loser_id IN (host_id, guest_id))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_matches_season ON matches(season_key, finished_at);

CREATE TABLE IF NOT EXISTS season_scores (
  season_key TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  achieved_at INTEGER NOT NULL,
  PRIMARY KEY (season_key, player_id)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_season_scores_rank
  ON season_scores(season_key, wins DESC, achieved_at ASC, player_id ASC);

CREATE TABLE IF NOT EXISTS season_opponents (
  season_key TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  opponent_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  PRIMARY KEY (season_key, player_id, opponent_id),
  CHECK (player_id <> opponent_id)
) STRICT;

CREATE TABLE IF NOT EXISTS daily_win_caps (
  day_key TEXT NOT NULL,
  winner_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  loser_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  counted_wins INTEGER NOT NULL CHECK (counted_wins BETWEEN 1 AND 3),
  PRIMARY KEY (day_key, winner_id, loser_id),
  CHECK (winner_id <> loser_id)
) STRICT;

CREATE TABLE IF NOT EXISTS season_awards (
  season_key TEXT NOT NULL,
  player_id TEXT NOT NULL REFERENCES profiles(player_id) ON DELETE CASCADE,
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  awarded_at INTEGER NOT NULL,
  PRIMARY KEY (season_key, rank),
  UNIQUE (season_key, player_id)
) STRICT;

CREATE TABLE IF NOT EXISTS season_finalizations (
  season_key TEXT PRIMARY KEY,
  finalized_at INTEGER NOT NULL
) STRICT;

CREATE TRIGGER IF NOT EXISTS rank_completed_match
AFTER INSERT ON matches
BEGIN
  INSERT OR IGNORE INTO season_scores (season_key, player_id, wins, achieved_at)
  VALUES (NEW.season_key, NEW.host_id, 0, NEW.finished_at);

  INSERT OR IGNORE INTO season_scores (season_key, player_id, wins, achieved_at)
  VALUES (NEW.season_key, NEW.guest_id, 0, NEW.finished_at);

  INSERT OR IGNORE INTO season_opponents (season_key, player_id, opponent_id)
  VALUES (NEW.season_key, NEW.host_id, NEW.guest_id);

  INSERT OR IGNORE INTO season_opponents (season_key, player_id, opponent_id)
  VALUES (NEW.season_key, NEW.guest_id, NEW.host_id);

  UPDATE matches
  SET ranked_win_counted = CASE
    WHEN COALESCE((
      SELECT counted_wins
      FROM daily_win_caps
      WHERE day_key = NEW.day_key
        AND winner_id = NEW.winner_id
        AND loser_id = NEW.loser_id
    ), 0) < 3 THEN 1
    ELSE 0
  END
  WHERE match_id = NEW.match_id;

  UPDATE season_scores
  SET wins = wins + 1,
      achieved_at = MAX(achieved_at, NEW.finished_at)
  WHERE season_key = NEW.season_key
    AND player_id = NEW.winner_id
    AND (SELECT ranked_win_counted FROM matches WHERE match_id = NEW.match_id) = 1;

  INSERT INTO daily_win_caps (day_key, winner_id, loser_id, counted_wins)
  VALUES (NEW.day_key, NEW.winner_id, NEW.loser_id, 1)
  ON CONFLICT (day_key, winner_id, loser_id)
  DO UPDATE SET counted_wins = MIN(3, counted_wins + 1);
END;
