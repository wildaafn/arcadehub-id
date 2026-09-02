-- =============================================================================
-- Arcade Hub — Supabase Schema Terisolasi (Schema 'arcade')
-- Menjaga agar seluruh tabel, data, dan fungsi Arcade Hub tidak mencemari
-- atau bertabrakan dengan project lain yang berada di database yang sama.
-- =============================================================================

-- ─── 0. BUAT SCHEMA KHUSUS ──────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS arcade;

-- Bersihkan tabel/fungsi Arcade Hub lama di schema public jika sebelumnya sempat dibuat
DROP TABLE IF EXISTS public.point_history CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP FUNCTION IF EXISTS public.upsert_member CASCADE;
DROP FUNCTION IF EXISTS public.increment_rate_limit CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_rate_limits CASCADE;
DROP FUNCTION IF EXISTS public.snapshot_daily_points CASCADE;

-- ─── 1. TABEL: arcade.members ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arcade.members (
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

ALTER TABLE arcade.members ENABLE ROW LEVEL SECURITY;

-- ─── 2. TABEL: arcade.point_history ─────────────────────────────────────────
-- Snapshot poin harian. Dasar untuk leaderboard mingguan.
-- ON DELETE CASCADE: tombol "Keluar dari leaderboard" menghapus members,
-- dan histori orang yang sudah menarik diri TIDAK boleh tertinggal.
CREATE TABLE IF NOT EXISTS arcade.point_history (
  member_id text NOT NULL REFERENCES arcade.members(id) ON DELETE CASCADE,
  day       date NOT NULL,
  total     integer NOT NULL DEFAULT 0,
  games     integer NOT NULL DEFAULT 0,
  skills    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, day)
);

ALTER TABLE arcade.point_history ENABLE ROW LEVEL SECURITY;

-- ─── 3. TABEL: arcade.rate_limits ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arcade.rate_limits (
  k   text PRIMARY KEY,
  cnt integer NOT NULL DEFAULT 0,
  ts  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE arcade.rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── 4. TABEL: arcade.feedback ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS arcade.feedback (
  id         text PRIMARY KEY,
  message    text NOT NULL,
  name       text,
  page       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE arcade.feedback ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- RPC FUNCTIONS — dipanggil via supabase.rpc() di schema 'arcade'
-- SECURITY DEFINER agar berjalan dengan hak pemilik (service role).
-- =============================================================================

-- ─── arcade.upsert_member ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arcade.upsert_member(
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
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = arcade, public AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Cek apakah profil sudah ada sebelum upsert
  SELECT EXISTS(SELECT 1 FROM arcade.members WHERE profile_url = p_profile_url) INTO v_exists;

  INSERT INTO arcade.members (
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
    guild       = COALESCE(p_guild, arcade.members.guild),
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
    FROM arcade.members m
    WHERE m.profile_url = p_profile_url;
END;
$$;


-- ─── arcade.increment_rate_limit ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arcade.increment_rate_limit(
  p_bucket text,
  p_max int DEFAULT 15
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = arcade, public AS $$
DECLARE
  v_cnt int;
BEGIN
  INSERT INTO arcade.rate_limits (k, cnt, ts)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (k) DO UPDATE SET cnt = arcade.rate_limits.cnt + 1
  RETURNING cnt INTO v_cnt;

  RETURN v_cnt;
END;
$$;


-- ─── arcade.cleanup_rate_limits ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION arcade.cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = arcade, public AS $$
BEGIN
  DELETE FROM arcade.rate_limits WHERE ts < now() - interval '10 minutes';
END;
$$;


-- ─── arcade.snapshot_daily_points ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION arcade.snapshot_daily_points()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = arcade, public AS $$
DECLARE
  v_count int;
BEGIN
  WITH snap AS (
    INSERT INTO arcade.point_history (member_id, day, total, games, skills)
    SELECT id, (now() AT TIME ZONE 'Asia/Jakarta')::date, total, games, skills
    FROM arcade.members
    ON CONFLICT (member_id, day) DO UPDATE
      SET total = EXCLUDED.total, games = EXCLUDED.games, skills = EXCLUDED.skills
    RETURNING member_id
  )
  SELECT count(*) INTO v_count FROM snap;

  RETURN v_count;
END;
$$;


-- ─── 5. PERMISSIONS & PRIVILEGES ────────────────────────────────────────────
GRANT USAGE ON SCHEMA arcade TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA arcade TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA arcade TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA arcade TO postgres, anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA arcade GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA arcade GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA arcade GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
