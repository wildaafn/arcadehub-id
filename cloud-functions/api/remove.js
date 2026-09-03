import { getSupabase } from '../../lib/db.js'
import { json } from '../lib/response.js'

const ADMIN = process.env.ADMIN_KEY || ''

export default async function onRequest(context) {
  const { request } = context
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const body = await request.json()
    const { id, adminKey } = body || {}
    if (!ADMIN || adminKey !== ADMIN) return json({ error: 'Butuh kunci admin.' }, 403)
    if (!id) return json({ error: 'id wajib' }, 400)

    const supabase = getSupabase()
    const { error } = await supabase.from('arcade_members').delete().eq('id', id)
    if (error) throw new Error(error.message)

    return json({ ok: true })
  } catch (e) {
    return json({ error: e.message }, 400)
  }
}
