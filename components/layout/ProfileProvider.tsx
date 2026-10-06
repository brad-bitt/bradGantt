'use client'
import { createContext, useContext, type ReactNode } from 'react'

export interface Profile {
  displayName: string
  email: string
  color: string
  avatarUrl: string | null
}

const ProfileContext = createContext<Profile | null>(null)

/**
 * Le profil est lu UNE fois, par `app/(app)/layout.tsx`, puis partagé par contexte. Les deux
 * groupes de routes ont chacun leur en-tête ; sans ce contexte, chacun relirait le profil.
 *
 * Composant CLIENT : un contexte React n'existe pas côté serveur. Les en-têtes, eux, restent
 * serveur — seul `UserMenu` (client) consomme le profil.
 */
export function ProfileProvider({ profile, children }: { profile: Profile; children: ReactNode }) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
}

export function useProfile(): Profile {
  const profile = useContext(ProfileContext)
  if (!profile) throw new Error('useProfile hors de ProfileProvider')
  return profile
}
