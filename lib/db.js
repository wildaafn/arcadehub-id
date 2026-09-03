import { createClient } from '@supabase/supabase-js'

// Polyfill minimal WebSocket jika runtime Node serverless tidak menyediakannya secara native
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class DummyWebSocket {}
}

let _supabase

// Singleton Supabase client. Menggunakan service-role key agar bisa melewati RLS.
// Dikonfigurasi dengan schema terisolasi 'arcade' agar tidak mengganggu tabel/project lain.
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
      db: { schema: 'arcade' },
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _supabase
}
