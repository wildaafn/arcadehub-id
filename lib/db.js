import { createClient } from '@supabase/supabase-js'

let _supabase

// Singleton Supabase client. Menggunakan service-role key agar bisa melewati
// RLS — JANGAN pernah ekspos key ini ke frontend (prefix VITE_ dilarang).
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
