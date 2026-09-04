'use server'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { safeNext } from '@/lib/auth/redirect'

/**
 * Sortie de secours quand l'invitation vise une autre adresse : on déconnecte, puis on renvoie
 * au login en gardant le lien d'invitation en `next`. Sans elle, la seule issue serait de se
 * déconnecter à la main puis de retrouver le mail.
 */
export async function switchAccount(next: string) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(`/login?next=${encodeURIComponent(safeNext(next))}`)
}
