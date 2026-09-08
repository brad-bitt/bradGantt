import { ImageResponse } from 'next/og'

export const alt = 'BradGantt — des Gantt partagés, brutalement simples'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Police d'affichage pour l'image d'aperçu. `next/font` ne sert que le HTML : ici il faut le
 * fichier TTF lui-même. On le demande à Google Fonts au moment de générer l'image ; sans
 * réseau, on retombe sur la police système — l'aperçu reste correct, seulement moins typé.
 */
async function archivoBlack(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Archivo+Black&display=swap')).text()
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1]
    if (!url) return null
    return await (await fetch(url)).arrayBuffer()
  } catch {
    return null
  }
}

const BARS = [
  { color: '#5B9DFF', left: 0, width: 300 },
  { color: '#FF8A3D', left: 120, width: 300 },
  { color: '#FF6FA3', left: 240, width: 240 },
]

/**
 * Aperçu de lien (Slack, Teams, LinkedIn…) : le signe en grand, le nom, la promesse. Même
 * vocabulaire que le site — carré d'encre, barres en escalier, bordures de 6 px, ombre portée
 * pleine — sans image externe.
 */
export default async function OpenGraphImage() {
  const font = await archivoBlack()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 64,
          background: '#FDF6E3',
          backgroundImage: 'radial-gradient(rgba(17,17,17,0.09) 2px, transparent 2px)',
          backgroundSize: '28px 28px',
          fontFamily: font ? 'Archivo Black' : 'sans-serif',
          color: '#111111',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 26,
            width: 340,
            height: 340,
            padding: 40,
            background: '#111111',
            border: '8px solid #FDF6E3',
            boxShadow: '16px 16px 0 #111111',
          }}
        >
          {BARS.map((b) => (
            <div key={b.color} style={{ display: 'flex', marginLeft: b.left / 2, width: b.width / 2, height: 44, background: b.color }} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 112, lineHeight: 1 }}>BradGantt</div>
          <div style={{ fontSize: 36, lineHeight: 1.2, maxWidth: 560 }}>Des Gantt partagés, brutalement simples.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Archivo Black', data: font, style: 'normal', weight: 400 }] : [],
    },
  )
}
