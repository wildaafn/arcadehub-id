import { getSupabase } from './db.js'

// Ambil IP klien dari header Web API Request.
export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return String(xff).split(',')[0].trim()
  // Fallback: di EdgeOne, x-forwarded-for biasanya selalu ada.
  return 'unknown'
}

// DB-backed per-IP limiter (fixed window). Fail-open on DB error.
export async function rateLimit(ip, max = 15, windowSec = 60) {
  if (!ip || ip === 'unknown') return true
  try {
    const supabase = getSupabase()
    const bucket = `${ip}:${Math.floor(Date.now() / (windowSec * 1000))}`
    const { data, error } = await supabase.rpc('increment_rate_limit', {
      p_bucket: bucket,
      p_max: max,
    })
    if (error) return true // fail-open
    // Probabilistic cleanup of old buckets
    if (Math.random() < 0.03) {
      supabase.rpc('cleanup_rate_limits').catch(() => {})
    }
    return (data ?? 1) <= max
  } catch {
    return true
  }
}
