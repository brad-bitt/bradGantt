import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createInvitation } from '@/lib/invitations/create'
import { createSupabaseInvitationDb } from '@/lib/invitations/supabase-db'
import { createMailer } from '@/lib/invitations/mailer'
import { newInviteToken } from '@/lib/invitations/token'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { projectId?: unknown; email?: unknown; role?: unknown } | null
  if (!body) return NextResponse.json({ error: 'Requête invalide' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single()
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin

  try {
    const result = await createInvitation(
      { db: createSupabaseInvitationDb(supabase, user.id, String(body.projectId ?? '')), mailer: createMailer(), baseUrl, inviterName: profile?.display_name ?? user.email ?? 'Un membre', newToken: newInviteToken },
      { projectId: body.projectId, email: body.email, role: body.role },
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    // Le lien d'invitation ne sort de la boîte mail QUE sous `E2E_ENABLED` : c'est un jeton
    // d'accès au projet, le renvoyer en production le mettrait dans la réponse HTTP de
    // l'inviteur — donc dans ses journaux, son historique réseau, ses extensions.
    const exposeUrl = process.env.E2E_ENABLED === '1' && result.kind === 'invited'
    return NextResponse.json({ kind: result.kind, ...(exposeUrl ? { inviteUrl: result.inviteUrl } : {}) })
  } catch (e) {
    console.error('[api/invitations]', e)
    return NextResponse.json({ error: 'Invitation impossible, réessaie.' }, { status: 500 })
  }
}
