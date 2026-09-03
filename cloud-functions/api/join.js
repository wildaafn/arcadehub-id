import { getSupabase } from '../../lib/db.js'
import { fetchAndScore, normalizeProfileUrl } from '../../lib/fetchProfile.js'
import { rateLimit, clientIp } from '../../lib/ratelimit.js'
import { json } from '../lib/response.js'
import { sanitizeText } from '../lib/security.js'

const DEFAULT_GUILD = 'UMUM'

export default async function onRequest(context) {
  const { request } = context
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!(await rateLimit(clientIp(request), 12))) {
      return json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, 429)
    }

    const body = await request.json()
    const { name, profileUrl, code } = body || {}
    const raw = code && sanitizeText(code, 24)
    // guild null = tidak diberikan; saat re-sync jangan timpa guild yang sudah ada.
    const guild = raw ? raw.toUpperCase() : null

    const url = normalizeProfileUrl(profileUrl)
    if (!url) {
      return json({ error: 'Link profil tidak valid. Pakai link public profile Cloud Skills Boost.' }, 400)
    }

    const s = await fetchAndScore(url)
    const displayName = sanitizeText(name, 60) || sanitizeText(s.name, 60) || 'Peserta'

    const supabase = getSupabase()
    const id = crypto.randomUUID()
    const token = crypto.randomUUID()

    const { data, error } = await supabase.rpc('arcade_upsert_member', {
      p_id: id,
      p_guild: guild,
      p_default_guild: DEFAULT_GUILD,
      p_name: displayName,
      p_profile_url: url,
      p_games: s.games,
      p_skills: s.skills,
      p_facil_games: s.facilGames,
      p_facil_skills: s.facilSkills,
      p_base: s.base,
      p_mbonus: s.mbonus,
      p_total: s.total,
      p_tier_idx: s.tierIdx,
      p_last_earned: s.lastEarned,
      p_avatar: s.avatar,
      p_remove_token: token,
    })

    if (error) throw new Error(error.message)
    const row = data?.[0] || {}

    return json({
      ok: true,
      id: row.out_id,
      guild: row.out_guild,
      // Hanya kembalikan token pada join pertama.
      removeToken: row.out_inserted ? row.out_remove_token : null,
      member: { ...s, name: displayName, profileUrl: url, guild: row.out_guild },
    })
  } catch (e) {
    return json({ error: e.message || 'Gagal memproses.' }, 400)
  }
}
