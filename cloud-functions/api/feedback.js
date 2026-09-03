import { getSupabase } from '../../lib/db.js'
import { rateLimit, clientIp } from '../../lib/ratelimit.js'
import { json } from '../lib/response.js'
import { safeCompare, sanitizeText } from '../lib/security.js'

const ADMIN = process.env.ADMIN_KEY || ''

async function notifyEmail({ message, name, page }) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.FEEDBACK_EMAIL
  if (!key || !to) return
  const from = process.env.FEEDBACK_FROM || 'Arcade Hub <onboarding@resend.dev>'
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: '💬 Masukan baru, Arcade Hub',
        text: `Masukan baru dari Arcade Hub:\n\n"${message}"\n\nDari: ${name || '(tanpa nama)'}\nHalaman: ${page || '-'}\n\nBalas ke pengirim jika ada kontak. Semua masukan juga tersimpan di database.`,
      }),
      signal: AbortSignal.timeout(6000),
    })
  } catch {
    /* abaikan, email best-effort */
  }
}

export default async function onRequest(context) {
  const { request } = context
  try {
    const supabase = getSupabase()

    if (request.method === 'GET') {
      const url = new URL(request.url)
      const key = url.searchParams.get('adminKey')
      if (!ADMIN || !safeCompare(key, ADMIN)) return json({ error: 'Butuh kunci admin.' }, 403)
      const { data: rows, error } = await supabase
        .from('arcade_feedback')
        .select('id, message, name, page, created_at')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw new Error(error.message)
      return json({ feedback: rows })
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
    if (!(await rateLimit(clientIp(request), 6))) {
      return json({ error: 'Terlalu banyak kiriman. Coba lagi nanti.' }, 429)
    }

    const body = await request.json()
    const { message, name, page } = body || {}
    const msg = sanitizeText(message, 1000)
    if (msg.length < 3) return json({ error: 'Tulis masukan minimal 3 karakter.' }, 400)

    const cleanName = sanitizeText(name, 60) || null
    const cleanPage = sanitizeText(page, 40) || null

    const { error } = await supabase.from('arcade_feedback').insert({
      id: crypto.randomUUID(),
      message: msg,
      name: cleanName,
      page: cleanPage,
    })
    if (error) throw new Error(error.message)

    await notifyEmail({ message: msg, name: cleanName, page: cleanPage })

    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message || 'Gagal mengirim.' }, 400)
  }
}
