import { ImageResponse } from 'next/og'

export const alt = 'BradGantt — des Gantt partagés, simplement'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Fonte de titre pour l'image d'aperçu. `next/font` ne sert que le HTML : ici il faut le fichier
 * TTF lui-même. On le demande à Google Fonts au moment de générer l'image ; sans réseau, on
 * retombe sur la police système — l'aperçu reste correct, seulement moins typé.
 */
async function fraunces(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch('https://fonts.googleapis.com/css2?family=Fraunces:wght@500&display=swap')).text()
    const url = css.match(/src: url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1]
    if (!url) return null
    return await (await fetch(url)).arrayBuffer()
  } catch {
    return null
  }
}

const PAPER = '#F6F3EC'
const SURFACE = '#FBF9F4'
const INK = '#2A2622'
const LINE = '#DED7C8'

/** Une frise de quatre barres teinte + liseré, comme dans le produit (spec §11). */
const BARS = [
  { color: '#FF8A3D', left: 0, width: 360, label: 'Maquettes' },
  { color: '#5B9DFF', left: 220, width: 380, label: 'Intégration' },
  { color: '#3ECF8E', left: 470, width: 300, label: 'Recette' },
  { color: '#A78BFA', left: 700, width: 260, label: 'Mise en ligne' },
]

function tint(hex: string, paper = SURFACE, part = 0.32): string {
  const c = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16)
  const mix = (a: number, b: number) => Math.round(a * part + b * (1 - part))
  const r = mix(c(hex, 1), c(paper, 1)), g = mix(c(hex, 3), c(paper, 3)), b = mix(c(hex, 5), c(paper, 5))
  return `rgb(${r}, ${g}, ${b})`
}

/**
 * Aperçu de lien (Slack, Teams, LinkedIn…) : le signe, le nom en Fraunces, la promesse, et une
 * frise. Même vocabulaire que le site — papier chaud, filets, barres à liseré — sans image externe.
 * `next/og` n'évalue pas `color-mix` : la teinte est calculée ici.
 */
export default async function OpenGraphImage() {
  const font = await fraunces()
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center',
          gap: 48, padding: '64px 80px', background: PAPER, color: INK,
          fontFamily: font ? 'Fraunces' : 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9, width: 96, height: 96, padding: 14, background: INK }}>
            <div style={{ display: 'flex', width: 40, height: 13, background: '#5B9DFF' }} />
            <div style={{ display: 'flex', marginLeft: 15, width: 40, height: 13, background: '#FF8A3D' }} />
            <div style={{ display: 'flex', marginLeft: 30, width: 30, height: 13, background: '#FF6FA3' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 88, lineHeight: 1, letterSpacing: -2 }}>BradGantt</div>
            <div style={{ fontSize: 34, lineHeight: 1.2, color: '#746D62' }}>Des Gantt partagés, simplement.</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', background: SURFACE, border: `2px solid ${LINE}`, borderRadius: 20, padding: 24, gap: 14, position: 'relative' }}>
          {BARS.map((b) => (
            <div key={b.label} style={{ display: 'flex', height: 48 }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', marginLeft: b.left, width: b.width, height: 48,
                  background: tint(b.color), border: `2px solid ${tint(b.color, SURFACE, 0.4)}`,
                  borderLeftWidth: 8, borderLeftColor: b.color, borderRadius: '8px 12px 12px 8px', paddingLeft: 18, fontSize: 26, whiteSpace: 'nowrap',
                }}
              >
                {b.label}
              </div>
            </div>
          ))}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 474, width: 4, background: '#E5342A' }} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Fraunces', data: font, style: 'normal', weight: 500 }] : [],
    },
  )
}
