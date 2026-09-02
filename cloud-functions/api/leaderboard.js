import { getSupabase } from '../../lib/db.js'
import { json } from '../lib/response.js'

export default async function onRequest(context) {
  try {
    const supabase = getSupabase()

    // semua peserta lintas guild; frontend yang memfilter per guild
    //
    // Poin sama diurutkan menurut SIAPA YANG LEBIH DULU SAMPAI di angka itu (last_earned =
    // tanggal badge berpoin terakhirnya).
    //
    // NULLS LAST buat baris yang belum tersinkron ulang sejak kolomnya ada. Tidak diketahui
    // bukan berarti duluan, jadi mereka ditaruh di belakang yang tanggalnya jelas.
    const { data: members, error } = await supabase
      .from('members')
      .select(
        'id, guild, name, profile_url, games, skills, facil_games, facil_skills, base, mbonus, total, tier_idx, last_earned, avatar, last_synced'
      )
      .order('total', { ascending: false })
      .order('last_earned', { ascending: true, nullsFirst: false })
      .order('skills', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    // Cache di edge: load ulang cepat (LCP). Stale-while-revalidate menyajikan cache lama
    // instan sambil refresh di background.
    return json({ members }, 200, {
      'Cache-Control': 's-maxage=15, stale-while-revalidate=60',
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
