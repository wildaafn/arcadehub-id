-- =============================================================================
-- Arcade Hub — Database Terisolasi dengan Prefix 'arcade_' (Schema public)
-- Seluruh tabel dan fungsi memiliki prefix 'arcade_' sehingga 100% terisolasi
-- dan tidak akan pernah bertabrakan dengan tabel lain di netdefenderdb.
-- =============================================================================

-- ─── 0. BERSIHKAN TABEL & FUNGSI LAMA JIKA ADA ──────────────────────────────
DROP TABLE IF EXISTS arcade.point_history CASCADE;
DROP TABLE IF EXISTS arcade.members CASCADE;
DROP TABLE IF EXISTS arcade.rate_limits CASCADE;
DROP TABLE IF EXISTS arcade.feedback CASCADE;
DROP SCHEMA IF EXISTS arcade CASCADE;

DROP TABLE IF EXISTS public.point_history CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.rate_limits CASCADE;
DROP TABLE IF EXISTS public.feedback CASCADE;
DROP TABLE IF EXISTS public.arcade_point_history CASCADE;
DROP TABLE IF EXISTS public.arcade_members CASCADE;
DROP TABLE IF EXISTS public.arcade_rate_limits CASCADE;
DROP TABLE IF EXISTS public.arcade_feedback CASCADE;

-- ─── 1. TABEL: arcade_members ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arcade_members (
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

ALTER TABLE public.arcade_members ENABLE ROW LEVEL SECURITY;

-- ─── 2. TABEL: arcade_point_history ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arcade_point_history (
  member_id text NOT NULL REFERENCES public.arcade_members(id) ON DELETE CASCADE,
  day       date NOT NULL,
  total     integer NOT NULL DEFAULT 0,
  games     integer NOT NULL DEFAULT 0,
  skills    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id, day)
);

ALTER TABLE public.arcade_point_history ENABLE ROW LEVEL SECURITY;

-- ─── 3. TABEL: arcade_rate_limits ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arcade_rate_limits (
  k   text PRIMARY KEY,
  cnt integer NOT NULL DEFAULT 0,
  ts  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arcade_rate_limits ENABLE ROW LEVEL SECURITY;

-- ─── 4. TABEL: arcade_feedback ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arcade_feedback (
  id         text PRIMARY KEY,
  message    text NOT NULL,
  name       text,
  page       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.arcade_feedback ENABLE ROW LEVEL SECURITY;


-- ─── 5. RPC FUNCTIONS (PREFIX 'arcade_') ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.arcade_upsert_member(
  p_id text,
  p_guild text,
  p_default_guild text,
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
  SELECT EXISTS(SELECT 1 FROM public.arcade_members WHERE profile_url = p_profile_url) INTO v_exists;

  INSERT INTO public.arcade_members (
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
    guild       = COALESCE(p_guild, arcade_members.guild),
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
    FROM public.arcade_members m
    WHERE m.profile_url = p_profile_url;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_increment_rate_limit(
  p_bucket text,
  p_max int DEFAULT 15
) RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cnt int;
BEGIN
  INSERT INTO public.arcade_rate_limits (k, cnt, ts)
  VALUES (p_bucket, 1, now())
  ON CONFLICT (k) DO UPDATE SET cnt = arcade_rate_limits.cnt + 1
  RETURNING cnt INTO v_cnt;

  RETURN v_cnt;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_cleanup_rate_limits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM public.arcade_rate_limits WHERE ts < now() - interval '10 minutes';
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_snapshot_daily_points()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count int;
BEGIN
  WITH snap AS (
    INSERT INTO public.arcade_point_history (member_id, day, total, games, skills)
    SELECT id, (now() AT TIME ZONE 'Asia/Jakarta')::date, total, games, skills
    FROM public.arcade_members
    ON CONFLICT (member_id, day) DO UPDATE
      SET total = EXCLUDED.total, games = EXCLUDED.games, skills = EXCLUDED.skills
    RETURNING member_id
  )
  SELECT count(*) INTO v_count FROM snap;

  RETURN v_count;
END;
$$;
