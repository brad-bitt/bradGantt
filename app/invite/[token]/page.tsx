import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { InviteError } from './InviteError'

/**
 * Ouvrir le lien VAUT acceptation : la RPC `accept_invitation` vérifie l'adresse du compte
 * connecté, ajoute la membership et consomme le token, le tout côté base. Un anonyme n'arrive
 * jamais ici — le middleware le renvoie au login avec ce lien en `next`.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: projectId, error } = await supabase.rpc('accept_invitation', { p_token: token })

  if (!error && projectId) redirect(`/projects/${projectId}`)

  const kind = error?.message.includes('email_mismatch') ? 'mismatch' : 'not_found'
  return <InviteError kind={kind} token={token} />
}
