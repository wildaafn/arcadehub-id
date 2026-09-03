import { getSupabase } from '../../lib/db.js'
import { rateLimit, clientIp } from '../../lib/ratelimit.js'
import { json } from '../lib/response.js'

export default async function onRequest(context) {
  const { request } = context
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    if (!(await rateLimit(clientIp(request), 12))) {
      return json({ error: 'Terlalu banyak permintaan. Tunggu sebentar.' }, 429)
    }

    const body = await request.json()
    const { id, token } = body || {}
    if (!id || !token) return json({ error: 'id dan token wajib.' }, 400)

    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('arcade_members')
      .delete()
      .match({ id, remove_token: token })
      .select('id')

    if (error) throw new Error(error.message)
    if (!data || !data.length) {
      return json({ error: 'Tidak bisa memverifikasi kepemilikan entri ini.' }, 403)
    }

    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message || 'Gagal keluar dari leaderboard.' }, 400)
  }
}
