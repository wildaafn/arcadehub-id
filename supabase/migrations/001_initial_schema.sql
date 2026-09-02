-- =============================================================================
-- Arcade Hub — Supabase initial schema
-- Idempoten: aman dijalankan ulang. Semua akses aplikasi via service-role key
-- di Cloud Functions. Tidak ada policy publik untuk data sensitif.
-- =============================================================================

-- ─── TABEL: members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS members (
  id           text PRIMARY KEY,
  guild        text NOT NULL DEFAULT 'UMUM',
  name         text NOT NULL,
  profile_url  text NOT NULL UNIQUE,
  games        integer NOT NULL DEFAULT 0,
  skills       integer NOT NULL DEFAULT 0,
  facil_games  integer NOT NULL DEFAULT 0,
  facil_skills integer NOT NULL DEFAULT 0,
  base         integer NOT NULL DEFAULT 0,
  mbonus       integer NOT NULL DEFAULT 0,
  total        integer NOT NULL DEFAULT 0,
  tier_idx     integer NOT NULL DEFAULT -1,
  last_earned  date,
  avatar       text,
  remove_token text,
  last_synced  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

-- ─── TABEL: point_history ───────────────────────────────────────────────────
-- Snapshot poin harian. Dasar untuk leaderboard mingguan.
-- ON DELETE CASCADE: tombol "Keluar dari leaderboard" menghapus members,
-- dan histori orang yang sudah menarik diri TIDAK boleh tertinggal.
CREATE TABLE IF NOT EXISTS point_history (
  member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day       date NOT NULL,
  total     integer NOT NULL DEFAULT 0,
  games     integer NOT NULL DEFAULT 0,
  skills    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, day)
);

ALTER TABLE point_history ENABLE ROW LEVEL SECURITY;

-- ─── TABEL: rate_limits ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  k   text PRIMARY KEY,
  cnt integer NOT NULL DEFAULT 0,
  ts  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── TABEL: feedback ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id         text PRIMARY KEY,
  message    text NOT NULL,
  name       text,
  page       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- RPC FUNCTIONS — dipanggil dari Cloud Functions via supabase.rpc()
-- SECURITY DEFINER agar berjalan dengan hak pemilik (service role),
-- bukan pemanggil (anon key tidak punya policy).
-- =============================================================================

-- ─── upsert_member ──────────────────────────────────────────────────────────
-- Menangani INSERT baru atau UPDATE jika profile_url sudah ada.
-- Mengembalikan id, guild, apakah INSERT (inserted=true), dan remove_token.
CREATE OR REPLACE FUNCTION upsert_member(
  p_id text,
  p_guild text,            -- NULL = jangan timpa guild yang sudah ada
  p_default_guild text,    -- dipakai saat INSERT jika p_guild NULL
  p_name text,
  p_profile_url text,
  p_games int,
  p_skills int,
  p_facil_games int,
  p_facil_skills int,
  p_base int,
  p_mbonus int,
  p_total int,
  p_tier_idx int,
  p_last_earned date,
  p_avatar text,
  p_remove_token text
) RETURNS TABLE(
  out_id text,
  out_guild text,
  out_inserted boolean,
  out_remove_token text
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Cek apakah profil sudah ada sebelum upsert
  SELECT EXISTS(SELECT 1 FROM members WHERE profile_url = p_profile_url) INTO v_exists;

  INSERT INTO members (
    id, guild, name, profile_url,
    games, skills, facil_games, facil_skills,
    base, mbonus, total, tier_idx,
    last_earned, avatar, remove_token, last_synced
  ) VALUES (
    p_id, COALESCE(p_guild, p_default_guild), p_name, p_profile_url,
    p_games, p_skills, p_facil_games, p_facil_skills,
    p_base, p_mbonus, p_total, p_tier_idx,
    p_last_earned, p_avatar, p_remove_token, now()
  )
  ON CONFLICT (profile_url) DO UPDATE SET
    guild       = COALESCE(p_guild, members.guild),
    name        = EXCLUDED.name,
    games       = EXCLUDED.games,
    skills      = EXCLUDED.skills,
    facil_games = EXCLUDED.facil_games,
    facil_skills= EXCLUDED.facil_skills,
    base        = EXCLUDED.base,
    mbonus      = EXCLUDED.mbonus,
    total       = EXCLUDED.total,
    tier_idx    = EXCLUDED.tier_idx,
    last_earned = EXCLUDED.last_earned,
    avatar      = EXCLUDED.avatar,
    last_synced = now();

  RETURN QUERY
    SELECT m.id, m.guild, NOT v_exists, m.remove_token
    FROM members m
    WHERE m.profile_url = p_profile_url;
END;
$$;


-- ─── increment_rate_limit ───────────────────────────────────────────────────
-- Operasi atomik: INSERT bucket baru atau increment counter.
-- Mengembalikan counter saat ini. Fail-open: jika error, biarkan lewat.
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_bucket text,
  p_max int DEFAULT 15
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cnt int;
BEGIN
  INSERT INTO rate_limits (k, cnt, ts)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (k) DO UPDATE SET cnt = rate_limits.cnt + 1
  RETURNING cnt INTO v_cnt;

  RETURN v_cnt;
END;
$$;


-- ─── cleanup_rate_limits ────────────────────────────────────────────────────
-- Hapus bucket lama (>10 menit). Dipanggil secara probabilistik.
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM rate_limits WHERE ts < now() - interval '10 minutes';
END;
$$;


-- ─── snapshot_daily_points ──────────────────────────────────────────────────
-- Sapu semua members dan simpan snapshot ke point_history.
-- Tanggal menggunakan Asia/Jakarta, bukan CURRENT_DATE (UTC).
-- Idempoten: ON CONFLICT menimpa baris yang sama jika dipanggil dua kali sehari.
CREATE OR REPLACE FUNCTION snapshot_daily_points()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  WITH snap AS (
    INSERT INTO point_history (member_id, day, total, games, skills)
    SELECT id, (now() AT TIME ZONE 'Asia/Jakarta')::date, total, games, skills
    FROM members
    ON CONFLICT (member_id, day) DO UPDATE
      SET total = EXCLUDED.total, games = EXCLUDED.games, skills = EXCLUDED.skills
    RETURNING member_id
  )
  SELECT count(*) INTO v_count FROM snap;

  RETURN v_count;
END;
$$;
