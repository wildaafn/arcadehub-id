import { getSupabase } from '../../lib/db.js'
import { rateLimit, clientIp } from '../../lib/ratelimit.js'
import { json } from '../lib/response.js'

// Self-service: peserta menghapus entri LEADERBOARD-nya sendiri. Otorisasi via remove_token
// rahasia (dibuat saat join pertama, hanya dipegang pemilik). id & profile_url publik jadi
// tidak cukup sebagai bukti; token wajib. Non-destruktif: bisa gabung lagi kapan saja.
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
      .from('members')
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
