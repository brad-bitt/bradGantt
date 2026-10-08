import type { Metadata } from 'next'
import { Fraunces, IBM_Plex_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/Toast'
import { THEME_BOOT_SCRIPT } from '@/components/layout/ThemeToggle'

// Fraunces est une fonte variable : pas de liste de graisses, l'axe optique suit la taille.
const fraunces = Fraunces({ subsets: ['latin'], axes: ['opsz'], variable: '--font-fraunces' })
// IBM Plex Sans est statique : les trois graisses employées (400 corps, 500 libellés, 600 initiales).
const plex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'BradGantt',
  description: 'Des Gantt partagés, simplement.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` : le script ci-dessous pose `data-theme` sur <html> avant que
    // React ne se monte, et l'attribut n'existe pas dans le HTML rendu par le serveur. C'est
    // voulu, et c'est le seul écart toléré sur cet élément.
    <html lang="fr" className={`${fraunces.variable} ${plex.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        {/* Premier enfant du corps, donc exécuté avant que le reste ne soit analysé : le thème
            est en place au premier pixel peint. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
