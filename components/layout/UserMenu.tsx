'use client'
import { useEffect, useState, useTransition } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Menu } from '@/components/ui/Menu'
import { signOut } from '@/app/(app)/(accueil)/projects/actions'
import { currentTheme, toggleTheme, type Theme } from './ThemeToggle'
import { useProfile } from './ProfileProvider'

/**
 * L'avatar de l'utilisateur, à droite des deux en-têtes. Nom, thème et déconnexion passent
 * derrière lui : à côté du fil d'Ariane et des onglets d'un projet, trois commandes de compte
 * en clair dans la bande noire faisaient jeu égal avec la navigation.
 */
export function UserMenu() {
  const profile = useProfile()
  const [theme, setTheme] = useState<Theme>('light')
  const [, start] = useTransition()

  // Le thème vit sur <html>, hors de React : on le relit au montage pour que le libellé dise ce
  // que fera le clic, pas ce que supposait le rendu serveur.
  useEffect(() => { setTheme(currentTheme()) }, [])

  return (
    <Menu
      label="Menu du compte"
      tone="header"
      trigger={<Avatar name={profile.displayName} color={profile.color} src={profile.avatarUrl} size="sm" />}
      entries={[
        {
          kind: 'heading',
          id: 'who',
          label: (
            <>
              <span className="block font-ui text-sm font-bold text-ink">{profile.displayName}</span>
              <span className="block">{profile.email}</span>
            </>
          ),
        },
        {
          id: 'theme',
          label: theme === 'dark' ? 'Passer au thème clair' : 'Passer au thème sombre',
          onSelect: () => setTheme(toggleTheme()),
        },
        { id: 'signout', label: 'Déconnexion', onSelect: () => start(async () => { await signOut() }) },
      ]}
    />
  )
}
