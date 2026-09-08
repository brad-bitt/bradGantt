import type { Metadata } from 'next'
import { Archivo_Black, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/Toast'
import { THEME_BOOT_SCRIPT } from '@/components/layout/ThemeToggle'

const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' })
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'BradGantt',
  description: 'Diagrammes de Gantt collaboratifs, brutalement simples.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `suppressHydrationWarning` : le script ci-dessous pose `data-theme` sur <html> avant que
    // React ne se monte, et l'attribut n'existe pas dans le HTML rendu par le serveur. C'est
    // voulu, et c'est le seul écart toléré sur cet élément.
    <html lang="fr" className={`${archivo.variable} ${grotesk.variable} ${mono.variable}`} suppressHydrationWarning>
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
