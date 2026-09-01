import {
  PX_PER_DAY, ROW_HEIGHT, BAR_INSET, computeRange, dateToX, xToDate, pxToDays, barRect,
  timelineWidth, dayColumns, monthCells, subCells, arrowPath, initialScrollLeft, SIDEBAR_WIDTH,
} from '@/lib/gantt/geometry'

const today = '2026-08-31'

describe('computeRange', () => {
  it('sans tâche : aujourd\'hui ± 30 jours', () => {
    expect(computeRange([], today)).toEqual({ start: '2026-08-01', end: '2026-09-30' })
  })
  it('élargit à min − 7 et max + 30', () => {
    const r = computeRange([{ startDate: '2026-06-15', endDate: '2026-12-01' }], today)
    expect(r).toEqual({ start: '2026-06-08', end: '2026-12-31' })
  })
})

describe('conversions', () => {
  const range = { start: '2026-08-01', end: '2026-09-30' }
  it('dateToX', () => {
    expect(dateToX('2026-08-01', range, 'day')).toBe(0)
    expect(dateToX('2026-08-11', range, 'day')).toBe(10 * PX_PER_DAY.day)
    expect(dateToX('2026-08-11', range, 'month')).toBe(10 * PX_PER_DAY.month)
  })
  it('xToDate arrondit au jour inférieur', () => {
    expect(xToDate(39, range, 'day')).toBe('2026-08-01')
    expect(xToDate(40, range, 'day')).toBe('2026-08-02')
  })
  it('pxToDays arrondit au plus proche', () => {
    expect(pxToDays(59, 'day')).toBe(1)
    expect(pxToDays(61, 'day')).toBe(2)
    expect(pxToDays(-25, 'day')).toBe(-1)
  })
  it('pxToDays arrondit symétriquement sur la demi-colonne', () => {
    // Demi-colonne = 20px en zoom day (40px/jour)
    // L'arrondi doit être symétrique : +20 => 1, -20 => -1
    expect(pxToDays(20, 'day')).toBe(1)
    expect(pxToDays(-20, 'day')).toBe(-1)
    // Juste avant : 19 et -19 => 0
    expect(pxToDays(19, 'day')).toBe(0)
    expect(pxToDays(-19, 'day')).toBe(0)
    // Autres zooms
    expect(pxToDays(6, 'week')).toBe(1) // demi-colonne = 6px (12px/jour)
    expect(pxToDays(-6, 'week')).toBe(-1)
    expect(pxToDays(2, 'month')).toBe(1) // demi-colonne = 2px (4px/jour)
    expect(pxToDays(-2, 'month')).toBe(-1)
  })
  it('timelineWidth est inclusive', () => {
    expect(timelineWidth({ start: '2026-09-01', end: '2026-09-03' }, 'day')).toBe(3 * 40)
  })
  it('barRect', () => {
    const rect = barRect({ startDate: '2026-08-03', endDate: '2026-08-05' }, 2, range, 'day')
    expect(rect).toEqual({ x: 80, y: 2 * ROW_HEIGHT + BAR_INSET, width: 120, height: ROW_HEIGHT - 2 * BAR_INSET })
  })
})

describe('initialScrollLeft', () => {
  it('laisse un quart de la largeur visible de contexte à gauche d\'aujourd\'hui', () => {
    // 1280 px de conteneur, 300 de sidebar collante => 980 visibles, quart = 245.
    expect(initialScrollLeft(1200, 1280)).toBe(1200 - 245)
  })
  it('place réellement aujourd\'hui dans la partie visible', () => {
    const todayX = 1200
    const left = initialScrollLeft(todayX, 1280)
    // Abscisse d'aujourd'hui À L'ÉCRAN : la sidebar masque les SIDEBAR_WIDTH premiers pixels.
    const onScreen = SIDEBAR_WIDTH + todayX - left
    expect(onScreen).toBeGreaterThan(SIDEBAR_WIDTH)
    expect(onScreen).toBeLessThan(1280)
  })
  it('ne défile pas avant le début de la plage', () => {
    expect(initialScrollLeft(100, 1280)).toBe(0)
    expect(initialScrollLeft(0, 1280)).toBe(0)
  })
  it('reste borné quand le conteneur est plus étroit que la sidebar', () => {
    expect(initialScrollLeft(1200, 200)).toBe(1200)
  })
})

describe('en-têtes', () => {
  const range = { start: '2026-08-25', end: '2026-09-05' }
  it('dayColumns marque weekends et aujourd\'hui', () => {
    const cols = dayColumns(range, 'day', today)
    expect(cols).toHaveLength(12)
    expect(cols.find((c) => c.date === '2026-08-29')?.isWeekend).toBe(true)
    expect(cols.find((c) => c.date === today)?.isToday).toBe(true)
  })
  it('monthCells découpe par mois avec libellé français', () => {
    const cells = monthCells(range, 'day')
    expect(cells.map((c) => c.label)).toEqual(['août 2026', 'septembre 2026'])
    expect(cells[0].width).toBe(7 * 40)
    expect(cells[1].x).toBe(7 * 40)
  })
  it('subCells : jours en zoom jour, semaines ISO sinon', () => {
    expect(subCells(range, 'day')).toHaveLength(12)
    const weeks = subCells(range, 'week')
    expect(weeks.map((w) => w.label)).toEqual(['S35', 'S36'])
  })
})

describe('arrowPath', () => {
  it('trace en angles droits vers une cible à droite', () => {
    const from = { x: 0, y: 8, width: 80, height: 28 }
    const to = { x: 160, y: 52, width: 40, height: 28 }
    expect(arrowPath(from, to)).toBe('M80,22 H90 V66 H160')
  })
  it('contourne quand la cible commence avant la fin de la source', () => {
    const from = { x: 0, y: 8, width: 200, height: 28 }
    const to = { x: 100, y: 52, width: 40, height: 28 }
    expect(arrowPath(from, to)).toBe('M200,22 H210 V44 H90 V66 H100')
  })
  it('trace vers une cible remontante sans chevauchement', () => {
    // Ligne 0 : y=8, ligne 1 : y=52 (au-dessus)
    const from = { x: 0, y: 52, width: 80, height: 28 } // ligne 1
    const to = { x: 160, y: 8, width: 40, height: 28 } // ligne 0 (au-dessus)
    // Espace horizontal libre : direct
    const path = arrowPath(from, to)
    expect(path).toBe('M80,66 H90 V22 H160')
    // Vérifie que le détour ne croise pas les deux barres
    verifyPathNoIntersection(path, from, to)
  })
  it('contourne une cible remontante avec chevauchement horizontal', () => {
    // Ligne 0 : y=8, ligne 1 : y=52
    const from = { x: 0, y: 52, width: 200, height: 28 } // ligne 1, étendue [0, 200]
    const to = { x: 100, y: 8, width: 40, height: 28 } // ligne 0, étendue [100, 140]
    // Chevauchement : ex=100, sx=200, donc ex-sx < 0 => contournement
    const path = arrowPath(from, to)
    // Le tracé ne doit pas traverser la plage y de l'une ou l'autre barre
    verifyPathNoIntersection(path, from, to)
  })
})

function verifyPathNoIntersection(path: string, from: { x: number; y: number; width: number; height: number }, to: { x: number; y: number; width: number; height: number }) {
  // Parse le chemin SVG pour vérifier que les segments verticaux ne croisent pas les barres
  // Format : M sx,sy H sx+stub V midY H ex-stub V ey H ex (ou direct M sx,sy H sx+stub V ey H ex)
  const parts = path.match(/M[\d.]+,[\d.]+|H[\d.]+|V[\d.]+/g) || []

  // Extraire les coordonnées clés
  let currentX = from.x + from.width // M sx,sy
  let currentY = from.y + from.height / 2

  const fromYMin = from.y
  const fromYMax = from.y + from.height
  const toYMin = to.y
  const toYMax = to.y + to.height

  for (const part of parts) {
    if (part.startsWith('H')) {
      currentX = parseFloat(part.substring(1))
    } else if (part.startsWith('V')) {
      const newY = parseFloat(part.substring(1))
      // Si c'est un segment vertical, vérifie qu'il ne croise pas les barres
      const minY = Math.min(currentY, newY)
      const maxY = Math.max(currentY, newY)

      // Ne doit pas croiser la barre source à son abscisse
      if (currentX >= from.x && currentX <= from.x + from.width) {
        expect(minY >= fromYMax || maxY <= fromYMin).toBe(true)
      }

      // Ne doit pas croiser la barre cible à son abscisse
      if (currentX >= to.x && currentX <= to.x + to.width) {
        expect(minY >= toYMax || maxY <= toYMin).toBe(true)
      }

      currentY = newY
    }
  }
}
