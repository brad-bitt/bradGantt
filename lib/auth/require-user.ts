import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Centralise l'invariant « on est authentifié » pour les layouts/pages serveur : évite
// que chaque appelant s'appuie sur `user!.id` sans rien exécuter derrière ce postulat.
// Next.js rend layout et page en parallèle : sans ce garde-fou, une page pourrait
// déréférencer `null` avant même que le layout n'ait eu l'occasion de rediriger.
//
// `cache()` mémoïse l'appel pour la durée de la requête : le layout ET la page peuvent
// chacun appeler requireUser() sans déclencher deux appels réseau à `getUser()`.
export const requireUser = cache(async function requireUser(): Promise<User> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return user
})
