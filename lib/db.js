import { createClient } from '@supabase/supabase-js'

if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {}
}

let _supabase

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error(
        'Supabase belum terkonfigurasi (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY kosong).'
      )
    }
    _supabase = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabase
}
