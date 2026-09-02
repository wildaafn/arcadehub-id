import { getSupabase } from '../../lib/db.js'
import { fetchAndScore } from '../../lib/fetchProfile.js'
import { json } from '../lib/response.js'

// Sinkron ulang semua peserta leaderboard. Dipanggil otomatis oleh cron (harian),
// atau manual dengan ?adminKey=<ADMIN_KEY>.
const BATCH = 60 // maksimal peserta per run (yang paling lama tak disinkron duluan)
const CONCURRENCY = 4 // fetch paralel ke Cloud Skills Boost
const TIME_BUDGET_MS = 50000

function authorized(request) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') === `Bearer ${secret}`) return true
  const admin = process.env.ADMIN_KEY
  const url = new URL(request.url)
  if (admin && url.searchParams.get('adminKey') === admin) return true
  return false
}

export default async function onRequest(context) {
  const { request } = context
  if (!authorized(request)) return json({ error: 'Unauthorized' }, 401)

  const startedAt = Date.now()
  try {
    const supabase = getSupabase()

    const { data: rows, error: selErr } = await supabase
      .from('members')
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
            .eq('id', m.id)

          if (updErr) throw updErr
          ok++
        } catch {
          failed++ // profil privat/tak terjangkau, biarkan data lama, lanjut
        }
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, (rows || []).length) }, worker)
    )

    // Snapshot poin harian via RPC, dasar untuk leaderboard mingguan.
    // try terpisah: menyinkron poin adalah tugas utama dan sudah berhasil di titik ini.
    // Snapshot gagal tidak boleh membuat cron dilaporkan merah dan memicu retry sia-sia.
    let snapshot = 0
    let snapshotError = null
    try {
      const { data: snapCount, error: snapErr } = await supabase.rpc(
        'snapshot_daily_points'
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
