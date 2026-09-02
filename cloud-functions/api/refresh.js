import { getSupabase } from '../../lib/db.js'
import { fetchAndScore } from '../../lib/fetchProfile.js'
import { rateLimit, clientIp } from '../../lib/ratelimit.js'
import { json } from '../lib/response.js'

export default async function onRequest(context) {
  const { request } = context
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!(await rateLimit(clientIp(request), 20))) {
      return json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, 429)
    }

    const supabase = getSupabase()
    const body = await request.json()
    const { id } = body || {}
    if (!id) return json({ error: 'id wajib' }, 400)

    const { data: rows, error: selErr } = await supabase
      .from('members')
      .select('profile_url')
      .eq('id', id)
      .limit(1)

    if (selErr) throw new Error(selErr.message)
    if (!rows || !rows.length) return json({ error: 'Peserta tidak ditemukan' }, 404)

    const s = await fetchAndScore(rows[0].profile_url)

    const { error: updErr } = await supabase
      .from('members')
      .update({
        games: s.games,
        skills: s.skills,
        facil_games: s.facilGames,
        facil_skills: s.facilSkills,
        base: s.base,
        mbonus: s.mbonus,
        total: s.total,
        tier_idx: s.tierIdx,
        last_earned: s.lastEarned,
        avatar: s.avatar,
        last_synced: new Date().toISOString(),
      })
      .eq('id', id)

    if (updErr) throw new Error(updErr.message)

    return json({ ok: true, member: s })
  } catch (e) {
    return json({ error: e.message || 'Gagal refresh.' }, 400)
  }
}
