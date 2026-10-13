import type { Metadata } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from '@/components/ui/Toast'
import { THEME_BOOT_SCRIPT } from '@/components/layout/ThemeToggle'

// Fontes hébergées dans app/fonts (sous-ensemble latin de Google Fonts, licence OFL) plutôt que
// next/font/google : le build ne dépend plus d'un téléchargement chez Google, qui a déjà échoué
// de façon passagère sur Vercel. Les trois fichiers sont variables, d'où les plages de graisses.
// Fraunces : axes wght + opsz, l'axe optique suit la taille.
const fraunces = localFont({
  src: './fonts/fraunces-100-900.woff2',
  weight: '100 900',
  variable: '--font-fraunces',
  adjustFontFallback: 'Times New Roman',
})
// IBM Plex Sans : graisses employées 400 corps, 500 libellés, 600 initiales.
const plex = localFont({ src: './fonts/plex-100-700.woff2', weight: '100 700', variable: '--font-plex' })
const mono = localFont({ src: './fonts/jetbrains-100-800.woff2', weight: '100 800', variable: '--font-jetbrains-mono' })

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
