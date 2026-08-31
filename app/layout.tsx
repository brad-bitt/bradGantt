import type { Metadata } from 'next'
import { Archivo_Black, Space_Grotesk, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/Toast'

const archivo = Archivo_Black({ weight: '400', subsets: ['latin'], variable: '--font-archivo-black' })
const grotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'BradGantt',
  description: 'Diagrammes de Gantt collaboratifs, brutalement simples.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${archivo.variable} ${grotesk.variable} ${mono.variable}`}>
      <body>{children}<Toaster /></body>
    </html>
  )
}
