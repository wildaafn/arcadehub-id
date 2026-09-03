import { getSupabase } from '../../lib/db.js'
import { fetchAndScore } from '../../lib/fetchProfile.js'
import { json } from '../lib/response.js'
import { safeCompare } from '../lib/security.js'

const BATCH = 60
const CONCURRENCY = 4
const TIME_BUDGET_MS = 50000

function authorized(request) {
  const secret = process.env.CRON_SECRET
  const authHeader = request.headers.get('authorization')
  if (secret && authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (safeCompare(token, secret)) return true
  }

  const admin = process.env.ADMIN_KEY
  const url = new URL(request.url)
  const adminKey = url.searchParams.get('adminKey')
  if (admin && adminKey && safeCompare(adminKey, admin)) return true

  return false
}

export default async function onRequest(context) {
  const { request } = context
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401)

  const startedAt = Date.now()
  try {
    const supabase = getSupabase()

    const { data: rows, error: selErr } = await supabase
      .from('arcade_members')
      .select('id, profile_url')
      .order('last_synced', { ascending: true })
      .limit(BATCH)

    if (selErr) throw new Error(selErr.message)

    let ok = 0, failed = 0, skipped = 0
    const queue = [...(rows || [])]

    const worker = async () => {
      while (queue.length) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          skipped += queue.length
          queue.length = 0
          break
        }
        const m = queue.shift()
        try {
          const s = await fetchAndScore(m.profile_url)
          const { error: updErr } = await supabase
            .from('arcade_members')
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
            .eq('id', m.id)

          if (updErr) throw updErr
          ok++
        } catch {
          failed++
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, (rows || []).length) }, worker)
    )

    let snapshot = 0
    let snapshotError = null
    try {
      const { data: snapCount, error: snapErr } = await supabase.rpc(
        'arcade_snapshot_daily_points'
      )
      if (snapErr) throw snapErr
      snapshot = snapCount ?? 0
    } catch (e) {
      snapshotError = e.message || String(e)
    }

    return json({
      ok: true,
      total: (rows || []).length,
      refreshed: ok,
      failed,
      skipped,
      snapshot,
      snapshotError,
      ms: Date.now() - startedAt,
    })
  } catch (e) {
    return json({ error: e.message || 'Gagal refresh-all.' }, 500)
  }
}
