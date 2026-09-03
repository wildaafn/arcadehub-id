import { getSupabase } from '../../lib/db.js'
import { json } from '../lib/response.js'

export default async function onRequest(context) {
  try {
    const supabase = getSupabase()

    const { data: members, error } = await supabase
      .from('arcade_members')
      .select(
        'id, guild, name, profile_url, games, skills, facil_games, facil_skills, base, mbonus, total, tier_idx, last_earned, avatar, last_synced'
      )
      .order('total', { ascending: false })
      .order('last_earned', { ascending: true, nullsFirst: false })
      .order('skills', { ascending: false })
      .order('name', { ascending: true })

    if (error) throw new Error(error.message)

    return json({ members: members || [] }, 200, {
      'Cache-Control': 's-maxage=15, stale-while-revalidate=60',
    })
  } catch (e) {
    return json({ error: e.message }, 500)
  }
}
