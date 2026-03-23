import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabaseServer'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export async function POST() {
  // Verify the caller is authenticated
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete owned boards — cascades to columns, tasks, and board_members via FK
  const { data: ownedBoards } = await supabase
    .from('boards')
    .select('id')
    .eq('created_by', user.id)

  if (ownedBoards && ownedBoards.length > 0) {
    await supabase
      .from('boards')
      .delete()
      .in('id', ownedBoards.map((b) => b.id))
  }

  // Remove any remaining memberships (boards the user joined but didn't create)
  await supabase.from('board_members').delete().eq('user_id', user.id)

  // Delete the user from auth.users — requires service role key
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { error } = await adminClient.auth.admin.deleteUser(user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
