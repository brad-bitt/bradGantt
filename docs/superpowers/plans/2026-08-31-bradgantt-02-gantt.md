# BradGantt — Plan 2/3 : Moteur Gantt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la page `/projects/[id]` : un Gantt néo-brutaliste maison où un éditeur crée, déplace, redimensionne, relie et organise des tâches, jalons et groupes, avec persistance optimiste dans Supabase et rollback en cas d'échec.

**Architecture:** Toute la logique est dans des modules purs (`lib/gantt/dates|geometry|scheduling|events|layout|validate`) testés par Vitest. Un store Zustand tient les données + l'état d'interaction ; des **commandes** appliquent un événement typé au store (optimiste), persistent via un `GanttRepository` (Supabase), et restaurent un snapshot en cas d'erreur. Les composants React ne parlent jamais à Supabase : ils lisent le store et appellent les commandes. Le rendu est HTML/CSS (barres en `position:absolute`) + un overlay SVG pour les flèches.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Zustand, date-fns, @supabase/ssr, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-28-bradgantt-design.md` — sections 2 (périmètre), 6 (flux store + commandes), 7 (rendu et interactions), 9 (design), 10 (erreurs), 11 (tests), 12 (préparation v2).

## Global Constraints

- Prérequis : plan 1 terminé (composants `ui/`, clients Supabase, schéma + RLS, seed, e2e de login). Branche de travail : `feat/02-gantt` créée depuis `feat/01-fondations` (ou depuis `master` si le plan 1 a été mergé).
- Dates manipulées **en chaînes ISO `yyyy-MM-dd`** dans tout le store et les modules purs ; `end_date` est **inclusif** (une tâche du 1er au 3 dure 3 jours). Les chaînes ISO se comparent lexicographiquement (`a < b`).
- Géométrie : `pxPerDay` = 40 (jour) / 12 (semaine) / 4 (mois) ; hauteur de ligne 44 px ; header 56 px ; sidebar 300 px ; zone de resize 8 px.
- Plage affichée : `min(start) − 7 j` → `max(end) + 30 j`, élargie au minimum à `aujourd'hui ± 30 j`.
- Un jalon a `startDate === endDate`. Un groupe n'a pas de parent ; ses dates affichées = min/max de ses enfants (ses colonnes en base sont ignorées à l'affichage, mais restent valides).
- Dépendances fin → début uniquement ; refus si `from === to`, doublon, ou cycle. **Pas** de décalage en cascade (v2).
- Un `viewer` : aucune commande disponible, aucun handle de drag, badge « Lecture seule ».
- Tout échec de persistance → rollback du snapshot + `toast.error('Modification non enregistrée')`.
- Style : bordures 3 px `#111`, ombres dures, radius 0, palette de tâches `#FFD500 #FF6B9D #3B82F6 #22C55E #FF8A00 #A855F7`, ligne « aujourd'hui » rouge `#EF4444` épaisse (3 px), weekends hachurés, grille 1 px `#111` à 20 %.
- Textes d'interface en français. `git add` explicite, jamais `--no-verify`, trailers de commit fournis par l'environnement.

---

## Carte des fichiers

| Fichier | Responsabilité |
|---|---|
| `lib/gantt/types.ts` | Types `Task`, `Dependency`, `Member`, `GanttData`, `Zoom`, `Range`, `Rect`, `Role`, `TaskType` |
| `lib/gantt/dates.ts` | Helpers date ISO : `addDays`, `daysBetween`, `durationDays`, `isWeekend`, `minDate`, `maxDate`, `todayISO` |
| `lib/gantt/palette.ts` | `TASK_COLORS`, `nextColor()` |
| `lib/gantt/geometry.ts` | Constantes px, `computeRange`, `dateToX`, `xToDate`, `pxToDays`, `barRect`, `timelineWidth`, `dayColumns`, `monthCells`, `subCells`, `arrowPath` |
| `lib/gantt/scheduling.ts` | `shiftDates`, `resizeDates`, `groupBounds`, `checkLink`, `wouldCreateCycle`, `buildRows`, `siblingsOf`, `reorderSiblings`, `nextSortOrder` |
| `lib/gantt/events.ts` | `GanttEvent`, `applyEvent` (réducteur unique, réutilisé par le temps réel en v2) |
| `lib/gantt/layout.ts` | `computeLayout(data, drag, zoom, today)` → lignes visibles, rects, tâches « effectives » (aperçu du drag, bornes de groupe) |
| `lib/gantt/validate.ts` | `validateTaskInput` |
| `lib/gantt/store.ts` | Store Zustand `useGanttStore` (données + `zoom`, `selection`, `drag`, `editor`) |
| `lib/gantt/repository.ts` | Interface `GanttRepository`, mappers snake ↔ camel, `createSupabaseRepository` |
| `lib/gantt/commands.ts` | `createCommands({ store, repo, notify })` — optimiste + persist + rollback |
| `lib/gantt/client-commands.ts` | `getGanttCommands()` — singleton côté navigateur (Supabase + toast) |
| `app/(app)/projects/[id]/page.tsx` | Chargement serveur (projet, membres, tâches, dépendances) → `<GanttPage/>` |
| `components/gantt/GanttPage.tsx` | Hydrate le store, rend toolbar + vue + éditeur |
| `components/gantt/GanttToolbar.tsx` | Nom du projet, membres, badge rôle, `ZoomControls`, boutons « + Tâche / + Groupe / + Jalon » |
| `components/gantt/ZoomControls.tsx` | Trois boutons jour / semaine / mois |
| `components/gantt/GanttView.tsx` | Conteneur scrollable, header sticky, sidebar sticky, timeline, raccourcis clavier |
| `components/gantt/Sidebar.tsx`, `SidebarRow.tsx` | Arbre à un niveau, chevron, avatar, « + » de groupe, poignée de réordonnancement |
| `components/gantt/TimelineHeader.tsx` | Deux niveaux : mois / jours ou semaines |
| `components/gantt/TimelineGrid.tsx` | Colonnes (weekends hachurés), lignes horizontales, ligne « aujourd'hui » |
| `components/gantt/TaskBar.tsx`, `MilestoneMark.tsx`, `GroupBar.tsx` | Rendu des trois types |
| `components/gantt/DependencyArrows.tsx` | Overlay SVG des flèches + ligne temporaire pendant un drag de liaison |
| `components/gantt/TaskEditor.tsx` | Dialog de création / édition / suppression |
| `components/gantt/useTimelineDrag.ts` | Pointer events : déplacer, redimensionner, lier |
| `components/gantt/useReorderDrag.ts` | Pointer events : réordonner dans la sidebar |
| `components/gantt/useKeyboardShortcuts.ts` | `Suppr` / `Échap` |
| `supabase/seed.sql` | + projet « Projet démo » (alice owner, bob editor, carol viewer, 4 tâches, 2 dépendances) |
| `tests/unit/lib/gantt/*.test.ts` | Vitest des modules purs, du store, des commandes, des mappers |
| `tests/e2e/gantt-*.spec.ts` | Playwright |

Identifiants fixes du seed (réutilisés par les e2e) :
- projet démo `c0000000-0000-0000-0000-000000000001`
- groupe « Cadrage » `d0000000-0000-0000-0000-000000000001`, tâche « Ateliers » `…0002` (enfant, J−3 → J+2, 60 %), tâche « Spécifications » `…0003` (enfant, J+3 → J+9), jalon « Kick-off dev » `…0004` (J+10)
- dépendances Ateliers → Spécifications, Spécifications → Kick-off dev

---

### Task 1 : Types, helpers de dates, palette

**Files:**
- Create : `lib/gantt/types.ts`, `lib/gantt/dates.ts`, `lib/gantt/palette.ts`
- Test : `tests/unit/lib/gantt/dates.test.ts`, `tests/unit/lib/gantt/palette.test.ts`

**Interfaces:**
- Produces : tous les types listés ci-dessous ; `addDays(iso, n)`, `daysBetween(a, b)` (= b − a en jours calendaires), `durationDays(start, end)` (= inclusif), `isWeekend(iso)`, `minDate`, `maxDate`, `todayISO()`, `formatDate(Date)`, `parseDate(iso)` ; `TASK_COLORS`, `nextColor(usedColors: string[])`.

- [ ] **Step 1 : Créer la branche**

```bash
git checkout -b feat/02-gantt
```

- [ ] **Step 2 : Écrire les types**

`lib/gantt/types.ts` :

```ts
export type Role = 'owner' | 'editor' | 'viewer'
export type TaskType = 'task' | 'milestone' | 'group'
export type Zoom = 'day' | 'week' | 'month'

export interface Task {
  id: string
  projectId: string
  parentId: string | null
  title: string
  type: TaskType
  startDate: string // 'yyyy-MM-dd'
  endDate: string // 'yyyy-MM-dd', inclusif
  progress: number // 0..100
  color: string
  assigneeId: string | null
  sortOrder: number
  collapsed: boolean
  updatedAt: string // ISO datetime
}

export interface Dependency {
  id: string
  projectId: string
  fromTaskId: string
  toTaskId: string
}

export interface Member {
  userId: string
  role: Role
  displayName: string
  email: string
  avatarUrl: string | null
  color: string
}

export interface GanttData {
  tasks: Record<string, Task>
  dependencies: Record<string, Dependency>
}

export interface Range { start: string; end: string } // bornes inclusives
export interface Rect { x: number; y: number; width: number; height: number }

export interface Row { task: Task; depth: 0 | 1; index: number }

export type DragState =
  | { mode: 'move' | 'resize-start' | 'resize-end'; taskId: string; deltaDays: number }
  | { mode: 'link'; fromTaskId: string; x: number; y: number }
  | { mode: 'reorder'; taskId: string; targetIndex: number }

export type Selection = { kind: 'task'; id: string } | { kind: 'dependency'; id: string } | null

export type EditorState = { mode: 'edit'; taskId: string } | { mode: 'create'; parentId: string | null; type: TaskType } | null
```

- [ ] **Step 3 : Tests des dates et de la palette**

`tests/unit/lib/gantt/dates.test.ts` :

```ts
import { addDays, daysBetween, durationDays, isWeekend, minDate, maxDate } from '@/lib/gantt/dates'

describe('dates', () => {
  it('addDays gère les fins de mois', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
  })
  it('daysBetween est signé', () => {
    expect(daysBetween('2026-09-01', '2026-09-04')).toBe(3)
    expect(daysBetween('2026-09-04', '2026-09-01')).toBe(-3)
  })
  it('durationDays est inclusive', () => {
    expect(durationDays('2026-09-01', '2026-09-01')).toBe(1)
    expect(durationDays('2026-09-01', '2026-09-03')).toBe(3)
  })
  it('isWeekend', () => {
    expect(isWeekend('2026-09-05')).toBe(true) // samedi
    expect(isWeekend('2026-09-07')).toBe(false) // lundi
  })
  it('min/max', () => {
    expect(minDate('2026-09-01', '2026-08-31')).toBe('2026-08-31')
    expect(maxDate('2026-09-01', '2026-08-31')).toBe('2026-09-01')
  })
})
```

`tests/unit/lib/gantt/palette.test.ts` :

```ts
import { TASK_COLORS, nextColor } from '@/lib/gantt/palette'

describe('nextColor', () => {
  it('retourne la couleur la moins utilisée, dans l\'ordre de la palette', () => {
    expect(nextColor([])).toBe(TASK_COLORS[0])
    expect(nextColor([TASK_COLORS[0]])).toBe(TASK_COLORS[1])
    expect(nextColor([...TASK_COLORS, TASK_COLORS[0]])).toBe(TASK_COLORS[1])
  })
})
```

Run : `npm test` — Expected : FAIL (modules introuvables)

- [ ] **Step 4 : Implémenter**

`lib/gantt/dates.ts` :

```ts
import { addDays as dfAddDays, differenceInCalendarDays, format, isWeekend as dfIsWeekend, parseISO } from 'date-fns'

export const ISO = 'yyyy-MM-dd'

export function parseDate(iso: string): Date { return parseISO(iso) }
export function formatDate(d: Date): string { return format(d, ISO) }
export function todayISO(): string { return formatDate(new Date()) }
export function addDays(iso: string, n: number): string { return formatDate(dfAddDays(parseDate(iso), n)) }
export function daysBetween(a: string, b: string): number { return differenceInCalendarDays(parseDate(b), parseDate(a)) }
export function durationDays(start: string, end: string): number { return daysBetween(start, end) + 1 }
export function isWeekend(iso: string): boolean { return dfIsWeekend(parseDate(iso)) }
export function minDate(a: string, b: string): string { return a < b ? a : b }
export function maxDate(a: string, b: string): string { return a > b ? a : b }
```

`lib/gantt/palette.ts` :

```ts
export const TASK_COLORS = ['#FFD500', '#FF6B9D', '#3B82F6', '#22C55E', '#FF8A00', '#A855F7'] as const

export function nextColor(usedColors: string[]): string {
  const counts = TASK_COLORS.map((c) => usedColors.filter((u) => u === c).length)
  const min = Math.min(...counts)
  return TASK_COLORS[counts.indexOf(min)]
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add lib/gantt/types.ts lib/gantt/dates.ts lib/gantt/palette.ts tests/unit/lib/gantt/dates.test.ts tests/unit/lib/gantt/palette.test.ts
git commit -m "feat(gantt): types, helpers de dates et palette"
```

---

### Task 2 : Géométrie

**Files:**
- Create : `lib/gantt/geometry.ts`
- Test : `tests/unit/lib/gantt/geometry.test.ts`

**Interfaces:**
- Consumes : `dates.ts`, types `Range`, `Rect`, `Zoom`.
- Produces : `PX_PER_DAY`, `ROW_HEIGHT = 44`, `HEADER_HEIGHT = 56`, `BAR_INSET = 8`, `SIDEBAR_WIDTH = 300`, `RESIZE_HANDLE_PX = 8`, `computeRange(tasks, today)`, `timelineWidth(range, zoom)`, `dateToX(iso, range, zoom)`, `xToDate(x, range, zoom)`, `pxToDays(dx, zoom)`, `barRect(task, rowIndex, range, zoom)`, `dayColumns(range, zoom, today)`, `monthCells(range, zoom)`, `subCells(range, zoom)`, `arrowPath(from, to)`.

- [ ] **Step 1 : Tests**

`tests/unit/lib/gantt/geometry.test.ts` :

```ts
import {
  PX_PER_DAY, ROW_HEIGHT, BAR_INSET, computeRange, dateToX, xToDate, pxToDays, barRect,
  timelineWidth, dayColumns, monthCells, subCells, arrowPath,
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
  it('pxToDays arrondit au plus proche, symétriquement', () => {
    expect(pxToDays(59, 'day')).toBe(1)
    expect(pxToDays(61, 'day')).toBe(2)
    expect(pxToDays(-25, 'day')).toBe(-1)
    // Bornes exactes : un demi-jour doit se comporter pareil dans les deux sens
    expect(pxToDays(20, 'day')).toBe(1)
    expect(pxToDays(-20, 'day')).toBe(-1)
    expect(pxToDays(6, 'week')).toBe(1)
    expect(pxToDays(-6, 'week')).toBe(-1)
    expect(Object.is(pxToDays(-5, 'day'), 0)).toBe(true) // pas de -0
  })
  it('timelineWidth est inclusive', () => {
    expect(timelineWidth({ start: '2026-09-01', end: '2026-09-03' }, 'day')).toBe(3 * 40)
  })
  it('barRect', () => {
    const rect = barRect({ startDate: '2026-08-03', endDate: '2026-08-05' }, 2, range, 'day')
    expect(rect).toEqual({ x: 80, y: 2 * ROW_HEIGHT + BAR_INSET, width: 120, height: ROW_HEIGHT - 2 * BAR_INSET })
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
  it("contourne sans traverser aucune barre quand la dépendance remonte", () => {
    const from = { x: 0, y: 52, width: 200, height: 28 }
    const to = { x: 100, y: 8, width: 40, height: 28 }
    // Le segment horizontal de contournement doit tomber strictement entre les
    // deux lignes : sous la barre cible (y+height = 36) et au-dessus de la
    // barre source (y = 52).
    const midY = Number(arrowPath(from, to).match(/V([\d.]+) H/)![1])
    expect(midY).toBeGreaterThan(to.y + to.height)
    expect(midY).toBeLessThan(from.y)
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/geometry.ts` :

```ts
import { endOfISOWeek, endOfMonth, format, getISOWeek } from 'date-fns'
import { fr } from 'date-fns/locale'
import type { Range, Rect, Zoom } from './types'
import { addDays, daysBetween, durationDays, formatDate, isWeekend, maxDate, minDate, parseDate } from './dates'

export const PX_PER_DAY: Record<Zoom, number> = { day: 40, week: 12, month: 4 }
export const ROW_HEIGHT = 44
export const HEADER_HEIGHT = 56
export const BAR_INSET = 8
export const SIDEBAR_WIDTH = 300
export const RESIZE_HANDLE_PX = 8

type Dated = { startDate: string; endDate: string }

export function computeRange(tasks: Dated[], today: string): Range {
  let start = addDays(today, -30)
  let end = addDays(today, 30)
  for (const t of tasks) {
    start = minDate(start, addDays(t.startDate, -7))
    end = maxDate(end, addDays(t.endDate, 30))
  }
  return { start, end }
}

export function timelineWidth(range: Range, zoom: Zoom): number {
  return durationDays(range.start, range.end) * PX_PER_DAY[zoom]
}

export function dateToX(iso: string, range: Range, zoom: Zoom): number {
  return daysBetween(range.start, iso) * PX_PER_DAY[zoom]
}

export function xToDate(x: number, range: Range, zoom: Zoom): string {
  return addDays(range.start, Math.floor(x / PX_PER_DAY[zoom]))
}

export function pxToDays(dx: number, zoom: Zoom): number {
  // Arrondi symétrique : Math.round arrondit les .5 vers +infini, donc un
  // glissement d'exactement une demi-colonne déplacerait d'un jour vers la
  // droite mais de zéro vers la gauche — effet « collant » asymétrique
  // perceptible pendant un drag. Le `|| 0` neutralise le -0.
  const days = Math.sign(dx) * Math.round(Math.abs(dx) / PX_PER_DAY[zoom])
  return days || 0
}

export function barRect(task: Dated, rowIndex: number, range: Range, zoom: Zoom): Rect {
  return {
    x: dateToX(task.startDate, range, zoom),
    y: rowIndex * ROW_HEIGHT + BAR_INSET,
    width: durationDays(task.startDate, task.endDate) * PX_PER_DAY[zoom],
    height: ROW_HEIGHT - 2 * BAR_INSET,
  }
}

export interface DayColumn { date: string; x: number; width: number; isWeekend: boolean; isToday: boolean }

export function dayColumns(range: Range, zoom: Zoom, today: string): DayColumn[] {
  const n = durationDays(range.start, range.end)
  const width = PX_PER_DAY[zoom]
  const cols: DayColumn[] = []
  for (let i = 0; i < n; i++) {
    const date = addDays(range.start, i)
    cols.push({ date, x: i * width, width, isWeekend: isWeekend(date), isToday: date === today })
  }
  return cols
}

export interface HeaderCell { key: string; label: string; x: number; width: number }

export function monthCells(range: Range, zoom: Zoom): HeaderCell[] {
  const cells: HeaderCell[] = []
  let cursor = range.start
  while (cursor <= range.end) {
    const end = minDate(formatDate(endOfMonth(parseDate(cursor))), range.end)
    cells.push({
      key: cursor,
      label: format(parseDate(cursor), 'MMMM yyyy', { locale: fr }),
      x: dateToX(cursor, range, zoom),
      width: durationDays(cursor, end) * PX_PER_DAY[zoom],
    })
    cursor = addDays(end, 1)
  }
  return cells
}

export function subCells(range: Range, zoom: Zoom): HeaderCell[] {
  if (zoom === 'day') {
    return dayColumns(range, zoom, '').map((c) => ({
      key: c.date,
      label: format(parseDate(c.date), 'EEEEE d', { locale: fr }),
      x: c.x,
      width: c.width,
    }))
  }
  const cells: HeaderCell[] = []
  let cursor = range.start
  while (cursor <= range.end) {
    const end = minDate(formatDate(endOfISOWeek(parseDate(cursor))), range.end)
    cells.push({
      key: cursor,
      label: `S${getISOWeek(parseDate(cursor))}`,
      x: dateToX(cursor, range, zoom),
      width: durationDays(cursor, end) * PX_PER_DAY[zoom],
    })
    cursor = addDays(end, 1)
  }
  return cells
}

/** Flèche fin → début en angles droits. Sort à droite de `from`, entre à gauche de `to`. */
export function arrowPath(from: Rect, to: Rect): string {
  const sx = from.x + from.width
  const sy = from.y + from.height / 2
  const ex = to.x
  const ey = to.y + to.height / 2
  const stub = 10
  if (ex - sx >= 2 * stub) return `M${sx},${sy} H${sx + stub} V${ey} H${ex}`
  // Contournement : le segment horizontal doit passer STRICTEMENT ENTRE les deux
  // lignes, sans recouvrir l'étendue verticale d'aucune des deux barres. Le sens
  // dépend de la position relative — une dépendance peut remonter vers une ligne
  // au-dessus (tâches réordonnées) ; une frontière calculée en dur vers le bas
  // ferait traverser la barre source à la flèche.
  const goingDown = to.y > from.y
  const midY = goingDown
    ? (from.y + from.height + to.y) / 2
    : (to.y + to.height + from.y) / 2
  return `M${sx},${sy} H${sx + stub} V${midY} H${ex - stub} V${ey} H${ex}`
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/geometry.ts tests/unit/lib/gantt/geometry.test.ts
git commit -m "feat(gantt): géométrie date↔px, en-têtes et tracé des flèches"
```

---

### Task 3 : Ordonnancement (déplacement, resize, bornes, cycles, lignes, ordre)

**Files:**
- Create : `lib/gantt/scheduling.ts`
- Test : `tests/unit/lib/gantt/scheduling.test.ts`

**Interfaces:**
- Produces : `shiftDates(task, deltaDays)`, `resizeDates(task, 'start'|'end', deltaDays)`, `groupBounds(children)`, `wouldCreateCycle(deps, fromId, toId)`, `checkLink(deps, fromId, toId): LinkCheck`, `LINK_ERRORS`, `buildRows(tasks): Row[]`, `siblingsOf(tasks, task): Task[]`, `reorderSiblings(siblings, movedId, targetIndex)`, `nextSortOrder(siblings)`, `makeTask(partial)` (helper de test exporté depuis `tests/unit/lib/gantt/fixtures.ts`).

- [ ] **Step 1 : Fixture partagée**

`tests/unit/lib/gantt/fixtures.ts` :

```ts
import type { Dependency, Task } from '@/lib/gantt/types'

let seq = 0
export function makeTask(partial: Partial<Task> = {}): Task {
  seq++
  return {
    id: partial.id ?? `t${seq}`,
    projectId: 'p1',
    parentId: null,
    title: `Tâche ${seq}`,
    type: 'task',
    startDate: '2026-09-01',
    endDate: '2026-09-03',
    progress: 0,
    color: '#FFD500',
    assigneeId: null,
    sortOrder: seq,
    collapsed: false,
    updatedAt: '2026-08-31T00:00:00Z',
    ...partial,
  }
}

export function makeDep(fromTaskId: string, toTaskId: string, id = `${fromTaskId}->${toTaskId}`): Dependency {
  return { id, projectId: 'p1', fromTaskId, toTaskId }
}
```

- [ ] **Step 2 : Tests**

`tests/unit/lib/gantt/scheduling.test.ts` :

```ts
import { shiftDates, resizeDates, groupBounds, wouldCreateCycle, checkLink, buildRows, reorderSiblings, nextSortOrder, siblingsOf } from '@/lib/gantt/scheduling'
import { makeTask, makeDep } from './fixtures'

describe('shiftDates / resizeDates', () => {
  const t = makeTask({ startDate: '2026-09-01', endDate: '2026-09-03' })
  it('décale en conservant la durée', () => {
    expect(shiftDates(t, 2)).toEqual({ startDate: '2026-09-03', endDate: '2026-09-05' })
  })
  it('redimensionne le bord droit avec durée min 1 jour', () => {
    expect(resizeDates(t, 'end', 2)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-05' })
    expect(resizeDates(t, 'end', -10)).toEqual({ startDate: '2026-09-01', endDate: '2026-09-01' })
  })
  it('redimensionne le bord gauche avec durée min 1 jour', () => {
    expect(resizeDates(t, 'start', -1)).toEqual({ startDate: '2026-08-31', endDate: '2026-09-03' })
    expect(resizeDates(t, 'start', 10)).toEqual({ startDate: '2026-09-03', endDate: '2026-09-03' })
  })
})

describe('groupBounds', () => {
  it('null sans enfant, sinon min/max', () => {
    expect(groupBounds([])).toBeNull()
    expect(groupBounds([
      makeTask({ startDate: '2026-09-05', endDate: '2026-09-06' }),
      makeTask({ startDate: '2026-09-01', endDate: '2026-09-02' }),
    ])).toEqual({ startDate: '2026-09-01', endDate: '2026-09-06' })
  })
})

describe('liens', () => {
  const deps = [makeDep('a', 'b'), makeDep('b', 'c')]
  it('détecte un cycle direct et indirect', () => {
    expect(wouldCreateCycle(deps, 'b', 'a')).toBe(true)
    expect(wouldCreateCycle(deps, 'c', 'a')).toBe(true)
    expect(wouldCreateCycle(deps, 'a', 'c')).toBe(false)
  })
  it('checkLink refuse self, doublon, cycle', () => {
    expect(checkLink(deps, 'a', 'a')).toEqual({ ok: false, reason: 'self' })
    expect(checkLink(deps, 'a', 'b')).toEqual({ ok: false, reason: 'duplicate' })
    expect(checkLink(deps, 'c', 'a')).toEqual({ ok: false, reason: 'cycle' })
    expect(checkLink(deps, 'a', 'c')).toEqual({ ok: true })
  })
})

describe('buildRows', () => {
  const g = makeTask({ id: 'g', type: 'group', sortOrder: 0 })
  const c1 = makeTask({ id: 'c1', parentId: 'g', sortOrder: 1 })
  const c2 = makeTask({ id: 'c2', parentId: 'g', sortOrder: 0 })
  const r = makeTask({ id: 'r', sortOrder: 1 })
  it('ordonne racines puis enfants triés par sortOrder, avec profondeur et index', () => {
    const rows = buildRows([r, c1, g, c2])
    expect(rows.map((x) => x.task.id)).toEqual(['g', 'c2', 'c1', 'r'])
    expect(rows.map((x) => x.depth)).toEqual([0, 1, 1, 0])
    expect(rows.map((x) => x.index)).toEqual([0, 1, 2, 3])
  })
  it('masque les enfants d\'un groupe replié', () => {
    const rows = buildRows([r, c1, { ...g, collapsed: true }, c2])
    expect(rows.map((x) => x.task.id)).toEqual(['g', 'r'])
  })
})

describe('ordre', () => {
  const a = makeTask({ id: 'a', sortOrder: 0 }), b = makeTask({ id: 'b', sortOrder: 1 }), c = makeTask({ id: 'c', sortOrder: 2 })
  it('siblingsOf retourne les frères triés', () => {
    expect(siblingsOf([c, a, b], b).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })
  it('reorderSiblings renumérote', () => {
    expect(reorderSiblings([a, b, c], 'c', 0)).toEqual([
      { taskId: 'c', sortOrder: 0 }, { taskId: 'a', sortOrder: 1 }, { taskId: 'b', sortOrder: 2 },
    ])
  })
  it('nextSortOrder', () => {
    expect(nextSortOrder([])).toBe(0)
    expect(nextSortOrder([a, c])).toBe(3)
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 3 : Implémenter**

`lib/gantt/scheduling.ts` :

```ts
import type { Dependency, Row, Task } from './types'
import { addDays, maxDate, minDate } from './dates'

type Dated = { startDate: string; endDate: string }

export function shiftDates(t: Dated, deltaDays: number): Dated {
  return { startDate: addDays(t.startDate, deltaDays), endDate: addDays(t.endDate, deltaDays) }
}

export function resizeDates(t: Dated, edge: 'start' | 'end', deltaDays: number): Dated {
  if (edge === 'start') {
    return { startDate: minDate(addDays(t.startDate, deltaDays), t.endDate), endDate: t.endDate }
  }
  return { startDate: t.startDate, endDate: maxDate(addDays(t.endDate, deltaDays), t.startDate) }
}

export function groupBounds(children: Dated[]): Dated | null {
  if (children.length === 0) return null
  return children.reduce<Dated>(
    (acc, c) => ({ startDate: minDate(acc.startDate, c.startDate), endDate: maxDate(acc.endDate, c.endDate) }),
    { startDate: children[0].startDate, endDate: children[0].endDate },
  )
}

/** Ajouter from→to crée un cycle ssi `from` est déjà atteignable depuis `to`. */
export function wouldCreateCycle(deps: Dependency[], fromId: string, toId: string): boolean {
  const next = new Map<string, string[]>()
  for (const d of deps) next.set(d.fromTaskId, [...(next.get(d.fromTaskId) ?? []), d.toTaskId])
  const stack = [toId]
  const seen = new Set<string>()
  while (stack.length) {
    const n = stack.pop()!
    if (n === fromId) return true
    if (seen.has(n)) continue
    seen.add(n)
    stack.push(...(next.get(n) ?? []))
  }
  return false
}

export type LinkReason = 'self' | 'duplicate' | 'cycle'
export type LinkCheck = { ok: true } | { ok: false; reason: LinkReason }

export const LINK_ERRORS: Record<LinkReason, string> = {
  self: "Une tâche ne peut pas dépendre d'elle-même",
  duplicate: 'Cette dépendance existe déjà',
  cycle: 'Dépendance refusée : cela créerait un cycle',
}

export function checkLink(deps: Dependency[], fromId: string, toId: string): LinkCheck {
  if (fromId === toId) return { ok: false, reason: 'self' }
  if (deps.some((d) => d.fromTaskId === fromId && d.toTaskId === toId)) return { ok: false, reason: 'duplicate' }
  if (wouldCreateCycle(deps, fromId, toId)) return { ok: false, reason: 'cycle' }
  return { ok: true }
}

const byOrder = (a: Task, b: Task) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)

export function buildRows(tasks: Task[]): Row[] {
  const rows: Row[] = []
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const roots = tasks.filter((t) => t.parentId === null).sort(byOrder)
  for (const root of roots) {
    rows.push({ task: root, depth: 0, index: rows.length })
    if (root.type === 'group' && !root.collapsed) {
      for (const child of tasks.filter((t) => t.parentId === root.id).sort(byOrder)) {
        rows.push({ task: child, depth: 1, index: rows.length })
      }
    }
  }
  // Filet : une tâche dont le parent est introuvable ou n'est pas un groupe
  // n'apparaîtrait nulle part. Le trigger `check_task_parent` l'interdit en base,
  // mais « la tâche existe et l'utilisateur ne la voit pas » est indiagnosticable
  // depuis l'interface — on la remonte en racine plutôt que de l'avaler.
  const orphans = tasks
    .filter((t) => {
      if (t.parentId === null) return false
      const parent = byId.get(t.parentId)
      return !parent || parent.type !== 'group'
    })
    .sort(byOrder)
  for (const orphan of orphans) rows.push({ task: orphan, depth: 0, index: rows.length })
  return rows
}

export function siblingsOf(tasks: Task[], task: Pick<Task, 'parentId'>): Task[] {
  return tasks.filter((t) => t.parentId === task.parentId).sort(byOrder)
}

export function reorderSiblings(siblings: Task[], movedId: string, targetIndex: number): { taskId: string; sortOrder: number }[] {
  const moved = siblings.find((s) => s.id === movedId)
  if (!moved) return []
  const rest = siblings.filter((s) => s.id !== movedId)
  const idx = Math.max(0, Math.min(targetIndex, rest.length))
  rest.splice(idx, 0, moved)
  return rest.map((t, i) => ({ taskId: t.id, sortOrder: i }))
}

export function nextSortOrder(siblings: Task[]): number {
  return siblings.length ? Math.max(...siblings.map((s) => s.sortOrder)) + 1 : 0
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 4 : Commit**

```bash
git add lib/gantt/scheduling.ts tests/unit/lib/gantt/scheduling.test.ts tests/unit/lib/gantt/fixtures.ts
git commit -m "feat(gantt): ordonnancement — décalage, resize, bornes, cycles, lignes, ordre"
```

---

### Task 4 : Événements typés et réducteur `applyEvent`

**Files:**
- Create : `lib/gantt/events.ts`
- Test : `tests/unit/lib/gantt/events.test.ts`

**Interfaces:**
- Produces :

```ts
type GanttEvent =
  | { type: 'task.created'; task: Task }
  | { type: 'task.updated'; taskId: string; patch: Partial<Omit<Task, 'id' | 'projectId'>> }
  | { type: 'task.deleted'; taskId: string }
  | { type: 'dependency.created'; dependency: Dependency }
  | { type: 'dependency.deleted'; dependencyId: string }
  | { type: 'tasks.reordered'; order: { taskId: string; sortOrder: number }[] }
function applyEvent(data: GanttData, event: GanttEvent): GanttData
function indexById<T extends { id: string }>(items: T[]): Record<string, T>
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/gantt/events.test.ts` :

```ts
import { applyEvent, indexById } from '@/lib/gantt/events'
import { makeTask, makeDep } from './fixtures'

const g = makeTask({ id: 'g', type: 'group' })
const c = makeTask({ id: 'c', parentId: 'g' })
const r = makeTask({ id: 'r' })
const base = { tasks: indexById([g, c, r]), dependencies: indexById([makeDep('c', 'r'), makeDep('r', 'g')]) }

describe('applyEvent', () => {
  it('task.created ajoute la tâche sans muter l\'état d\'origine', () => {
    const next = applyEvent(base, { type: 'task.created', task: makeTask({ id: 'n' }) })
    expect(next.tasks.n).toBeDefined()
    expect(base.tasks.n).toBeUndefined()
  })
  it('task.updated fusionne le patch', () => {
    const next = applyEvent(base, { type: 'task.updated', taskId: 'r', patch: { title: 'X', progress: 50 } })
    expect(next.tasks.r).toMatchObject({ title: 'X', progress: 50, id: 'r' })
  })
  it('task.updated ignore un id inconnu', () => {
    expect(applyEvent(base, { type: 'task.updated', taskId: 'zz', patch: { title: 'X' } })).toBe(base)
  })
  it('task.deleted supprime la tâche, ses enfants et les dépendances liées', () => {
    const next = applyEvent(base, { type: 'task.deleted', taskId: 'g' })
    expect(Object.keys(next.tasks)).toEqual(['r'])
    expect(Object.keys(next.dependencies)).toEqual([])
  })
  it('dependency.created / deleted', () => {
    const d = makeDep('g', 'r', 'x')
    const withDep = applyEvent(base, { type: 'dependency.created', dependency: d })
    expect(withDep.dependencies.x).toEqual(d)
    expect(applyEvent(withDep, { type: 'dependency.deleted', dependencyId: 'x' }).dependencies.x).toBeUndefined()
  })
  it('tasks.reordered met à jour sortOrder', () => {
    const next = applyEvent(base, { type: 'tasks.reordered', order: [{ taskId: 'r', sortOrder: 0 }, { taskId: 'g', sortOrder: 1 }] })
    expect(next.tasks.r.sortOrder).toBe(0)
    expect(next.tasks.g.sortOrder).toBe(1)
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/events.ts` :

```ts
import type { Dependency, GanttData, Task } from './types'

export type GanttEvent =
  | { type: 'task.created'; task: Task }
  | { type: 'task.updated'; taskId: string; patch: Partial<Omit<Task, 'id' | 'projectId'>> }
  | { type: 'task.deleted'; taskId: string }
  | { type: 'dependency.created'; dependency: Dependency }
  | { type: 'dependency.deleted'; dependencyId: string }
  | { type: 'tasks.reordered'; order: { taskId: string; sortOrder: number }[] }

export function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((i) => [i.id, i]))
}

export function applyEvent(data: GanttData, event: GanttEvent): GanttData {
  switch (event.type) {
    case 'task.created':
      return { ...data, tasks: { ...data.tasks, [event.task.id]: event.task } }

    case 'task.updated': {
      const current = data.tasks[event.taskId]
      if (!current) return data
      return { ...data, tasks: { ...data.tasks, [event.taskId]: { ...current, ...event.patch } } }
    }

    case 'task.deleted': {
      const removed = new Set<string>([event.taskId])
      for (const t of Object.values(data.tasks)) if (t.parentId === event.taskId) removed.add(t.id)
      const tasks = Object.fromEntries(Object.entries(data.tasks).filter(([id]) => !removed.has(id)))
      const dependencies = Object.fromEntries(
        Object.entries(data.dependencies).filter(([, d]) => !removed.has(d.fromTaskId) && !removed.has(d.toTaskId)),
      )
      return { tasks, dependencies }
    }

    case 'dependency.created':
      return { ...data, dependencies: { ...data.dependencies, [event.dependency.id]: event.dependency } }

    case 'dependency.deleted': {
      const { [event.dependencyId]: _removed, ...dependencies } = data.dependencies
      return { ...data, dependencies }
    }

    case 'tasks.reordered': {
      const tasks = { ...data.tasks }
      for (const { taskId, sortOrder } of event.order) {
        if (tasks[taskId]) tasks[taskId] = { ...tasks[taskId], sortOrder }
      }
      return { ...data, tasks }
    }
  }
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/events.ts tests/unit/lib/gantt/events.test.ts
git commit -m "feat(gantt): événements typés et réducteur applyEvent"
```

---

### Task 5 : Layout (lignes, rects, aperçu du drag)

**Files:**
- Create : `lib/gantt/layout.ts`
- Test : `tests/unit/lib/gantt/layout.test.ts`

**Interfaces:**
- Consumes : `computeRange`, `barRect`, `timelineWidth`, `ROW_HEIGHT`, `buildRows`, `shiftDates`, `resizeDates`, `groupBounds`, `DragState`.
- Produces :

```ts
interface Layout { rows: Row[]; rects: Record<string, Rect>; effective: Record<string, Task>; range: Range; width: number; height: number }
function computeLayout(data: GanttData, drag: DragState | null, zoom: Zoom, today: string): Layout
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/gantt/layout.test.ts` :

```ts
import { computeLayout } from '@/lib/gantt/layout'
import { indexById } from '@/lib/gantt/events'
import { PX_PER_DAY, ROW_HEIGHT } from '@/lib/gantt/geometry'
import { makeTask } from './fixtures'

const today = '2026-08-31'
const g = makeTask({ id: 'g', type: 'group', startDate: '2026-01-01', endDate: '2026-01-01', sortOrder: 0 })
const c1 = makeTask({ id: 'c1', parentId: 'g', startDate: '2026-09-01', endDate: '2026-09-03', sortOrder: 0 })
const c2 = makeTask({ id: 'c2', parentId: 'g', startDate: '2026-09-05', endDate: '2026-09-08', sortOrder: 1 })
const data = { tasks: indexById([g, c1, c2]), dependencies: {} }

describe('computeLayout', () => {
  it('calcule les dates du groupe depuis ses enfants et ignore ses dates stockées', () => {
    const l = computeLayout(data, null, 'day', today)
    expect(l.effective.g).toMatchObject({ startDate: '2026-09-01', endDate: '2026-09-08' })
    expect(l.range.start).toBe('2026-08-01') // aujourd'hui − 30, pas 2026-01-01 − 7
  })
  it('produit un rect par ligne visible et une hauteur totale', () => {
    const l = computeLayout(data, null, 'day', today)
    expect(Object.keys(l.rects)).toEqual(['g', 'c1', 'c2'])
    expect(l.height).toBe(3 * ROW_HEIGHT)
    expect(l.rects.c1.width).toBe(3 * PX_PER_DAY.day)
  })
  it('applique l\'aperçu d\'un drag de déplacement et propage au groupe', () => {
    const l = computeLayout(data, { mode: 'move', taskId: 'c2', deltaDays: 4 }, 'day', today)
    expect(l.effective.c2).toMatchObject({ startDate: '2026-09-09', endDate: '2026-09-12' })
    expect(l.effective.g.endDate).toBe('2026-09-12')
    expect(l.rows[2].task.startDate).toBe('2026-09-09')
  })
  it('applique l\'aperçu d\'un resize', () => {
    const l = computeLayout(data, { mode: 'resize-end', taskId: 'c1', deltaDays: 2 }, 'day', today)
    expect(l.effective.c1.endDate).toBe('2026-09-05')
  })
  it('masque les enfants d\'un groupe replié', () => {
    const collapsed = { ...data, tasks: { ...data.tasks, g: { ...g, collapsed: true } } }
    const l = computeLayout(collapsed, null, 'day', today)
    expect(Object.keys(l.rects)).toEqual(['g'])
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/layout.ts` :

```ts
import type { DragState, GanttData, Range, Rect, Row, Task, Zoom } from './types'
import { ROW_HEIGHT, barRect, computeRange, timelineWidth } from './geometry'
import { buildRows, groupBounds, resizeDates, shiftDates } from './scheduling'

export interface Layout {
  rows: Row[]
  rects: Record<string, Rect>
  effective: Record<string, Task>
  range: Range
  width: number
  height: number
}

export function computeLayout(data: GanttData, drag: DragState | null, zoom: Zoom, today: string): Layout {
  const tasks = Object.values(data.tasks)
  const effective: Record<string, Task> = {}

  for (const t of tasks) {
    let dates = { startDate: t.startDate, endDate: t.endDate }
    if (drag && 'taskId' in drag && drag.taskId === t.id) {
      if (drag.mode === 'move') dates = shiftDates(t, drag.deltaDays)
      else if (drag.mode === 'resize-start') dates = resizeDates(t, 'start', drag.deltaDays)
      else if (drag.mode === 'resize-end') dates = resizeDates(t, 'end', drag.deltaDays)
    }
    effective[t.id] = { ...t, ...dates }
  }

  for (const g of tasks) {
    if (g.type !== 'group') continue
    const bounds = groupBounds(tasks.filter((t) => t.parentId === g.id).map((c) => effective[c.id]))
    if (bounds) effective[g.id] = { ...effective[g.id], ...bounds }
  }

  // La plage ignore les dates stockées des groupes non vides (elles ne sont pas affichées)
  const forRange = Object.values(effective).filter((t) => t.type !== 'group' || !tasks.some((c) => c.parentId === t.id))
  const range = computeRange(forRange, today)
  const rows = buildRows(Object.values(effective))
  const rects: Record<string, Rect> = {}
  for (const row of rows) rects[row.task.id] = barRect(row.task, row.index, range, zoom)

  return { rows, rects, effective, range, width: timelineWidth(range, zoom), height: rows.length * ROW_HEIGHT }
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/layout.ts tests/unit/lib/gantt/layout.test.ts
git commit -m "feat(gantt): calcul de layout avec aperçu du drag et bornes de groupe"
```

---

### Task 6 : Store Zustand

**Files:**
- Create : `lib/gantt/store.ts`
- Test : `tests/unit/lib/gantt/store.test.ts`

**Interfaces:**
- Produces :

```ts
interface HydratePayload { projectId: string; projectName: string; myRole: Role; members: Member[]; tasks: Task[]; dependencies: Dependency[]; today: string }
interface GanttState extends GanttData {
  projectId: string; projectName: string; myRole: Role; members: Member[]; today: string
  zoom: Zoom; selection: Selection; drag: DragState | null; editor: EditorState
  hydrate(p: HydratePayload): void
  apply(e: GanttEvent): void
  replaceData(d: GanttData): void
  setZoom(z: Zoom): void; select(s: Selection): void; setDrag(d: DragState | null): void
  openEditor(e: Exclude<EditorState, null>): void; closeEditor(): void
}
const useGanttStore: UseBoundStore<StoreApi<GanttState>>
const selectCanEdit: (s: GanttState) => boolean
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/gantt/store.test.ts` :

```ts
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { makeTask, makeDep } from './fixtures'

const payload = {
  projectId: 'p1', projectName: 'Démo', myRole: 'editor' as const, members: [], today: '2026-08-31',
  tasks: [makeTask({ id: 'a' }), makeTask({ id: 'b' })], dependencies: [makeDep('a', 'b')],
}

describe('useGanttStore', () => {
  beforeEach(() => useGanttStore.getState().hydrate(payload))

  it('hydrate indexe tâches et dépendances et remet l\'état d\'interaction à zéro', () => {
    const s = useGanttStore.getState()
    expect(Object.keys(s.tasks)).toEqual(['a', 'b'])
    expect(s.dependencies['a->b']).toBeDefined()
    expect(s.selection).toBeNull()
    expect(s.drag).toBeNull()
    expect(s.editor).toBeNull()
  })
  it('apply passe par applyEvent', () => {
    useGanttStore.getState().apply({ type: 'task.deleted', taskId: 'a' })
    expect(useGanttStore.getState().tasks.a).toBeUndefined()
    expect(Object.keys(useGanttStore.getState().dependencies)).toEqual([])
  })
  it('replaceData restaure un snapshot', () => {
    const snapshot = { tasks: useGanttStore.getState().tasks, dependencies: useGanttStore.getState().dependencies }
    useGanttStore.getState().apply({ type: 'task.deleted', taskId: 'a' })
    useGanttStore.getState().replaceData(snapshot)
    expect(useGanttStore.getState().tasks.a).toBeDefined()
  })
  it('selectCanEdit', () => {
    expect(selectCanEdit(useGanttStore.getState())).toBe(true)
    useGanttStore.getState().hydrate({ ...payload, myRole: 'viewer' })
    expect(selectCanEdit(useGanttStore.getState())).toBe(false)
  })
  it('setters d\'interaction', () => {
    const s = useGanttStore.getState()
    s.setZoom('week'); s.select({ kind: 'task', id: 'a' }); s.openEditor({ mode: 'edit', taskId: 'a' })
    expect(useGanttStore.getState()).toMatchObject({ zoom: 'week', selection: { kind: 'task', id: 'a' }, editor: { mode: 'edit', taskId: 'a' } })
    useGanttStore.getState().closeEditor()
    expect(useGanttStore.getState().editor).toBeNull()
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/store.ts` :

```ts
import { create } from 'zustand'
import type { Dependency, DragState, EditorState, GanttData, Member, Role, Selection, Task, Zoom } from './types'
import { applyEvent, indexById, type GanttEvent } from './events'

export interface HydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: Task[]
  dependencies: Dependency[]
  today: string
}

export interface GanttState extends GanttData {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  today: string
  zoom: Zoom
  selection: Selection
  drag: DragState | null
  editor: EditorState
  hydrate: (p: HydratePayload) => void
  apply: (e: GanttEvent) => void
  replaceData: (d: GanttData) => void
  setZoom: (z: Zoom) => void
  select: (s: Selection) => void
  setDrag: (d: DragState | null) => void
  openEditor: (e: Exclude<EditorState, null>) => void
  closeEditor: () => void
}

export const useGanttStore = create<GanttState>((set) => ({
  projectId: '',
  projectName: '',
  myRole: 'viewer',
  members: [],
  today: '1970-01-01',
  tasks: {},
  dependencies: {},
  zoom: 'day',
  selection: null,
  drag: null,
  editor: null,

  hydrate: (p) => set({
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    today: p.today,
    tasks: indexById(p.tasks),
    dependencies: indexById(p.dependencies),
    selection: null,
    drag: null,
    editor: null,
  }),
  apply: (e) => set((s) => applyEvent({ tasks: s.tasks, dependencies: s.dependencies }, e)),
  replaceData: (d) => set({ tasks: d.tasks, dependencies: d.dependencies }),
  setZoom: (zoom) => set({ zoom }),
  select: (selection) => set({ selection }),
  setDrag: (drag) => set({ drag }),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
}))

export const selectCanEdit = (s: GanttState) => s.myRole !== 'viewer'
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/store.ts tests/unit/lib/gantt/store.test.ts
git commit -m "feat(gantt): store Zustand"
```

---

### Task 7 : Repository — interface, mappers, implémentation Supabase

**Files:**
- Create : `lib/gantt/repository.ts`
- Test : `tests/unit/lib/gantt/repository.test.ts`

**Interfaces:**
- Consumes : `Database`, `Tables`, `TablesInsert`, `TablesUpdate` de `lib/supabase/types.ts`.
- Produces :

```ts
interface GanttRepository {
  insertTask(task: Task): Promise<void>
  updateTask(taskId: string, patch: Partial<Task>): Promise<void>
  deleteTask(taskId: string): Promise<void>
  insertDependency(dep: Dependency): Promise<void>
  deleteDependency(depId: string): Promise<void>
  reorderTasks(order: { taskId: string; sortOrder: number }[]): Promise<void>
}
function rowToTask(row: Tables<'tasks'>): Task
function rowToDependency(row: Tables<'dependencies'>): Dependency
function taskToRow(task: Task): TablesInsert<'tasks'>
function patchToRow(patch: Partial<Task>): TablesUpdate<'tasks'>
function createSupabaseRepository(client: SupabaseClient<Database>): GanttRepository
```

- [ ] **Step 1 : Tests des mappers**

`tests/unit/lib/gantt/repository.test.ts` :

```ts
import { rowToTask, taskToRow, patchToRow, rowToDependency } from '@/lib/gantt/repository'
import { makeTask } from './fixtures'

describe('mappers', () => {
  it('rowToTask ↔ taskToRow sont inverses (hors created_at)', () => {
    const task = makeTask({ id: 'x', parentId: 'g', assigneeId: 'u1' })
    const row = taskToRow(task)
    expect(row).toMatchObject({ id: 'x', project_id: 'p1', parent_id: 'g', start_date: task.startDate, end_date: task.endDate, assignee_id: 'u1', sort_order: task.sortOrder })
    expect(rowToTask({ ...row, created_at: 'c', updated_at: task.updatedAt } as Parameters<typeof rowToTask>[0])).toEqual(task)
  })
  it('patchToRow ne mappe que les clés présentes', () => {
    expect(patchToRow({ startDate: '2026-09-01', collapsed: true })).toEqual({ start_date: '2026-09-01', collapsed: true })
    expect(patchToRow({})).toEqual({})
  })
  it('rowToDependency', () => {
    expect(rowToDependency({ id: 'd', project_id: 'p', from_task_id: 'a', to_task_id: 'b' })).toEqual({ id: 'd', projectId: 'p', fromTaskId: 'a', toTaskId: 'b' })
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/repository.ts` :

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types'
import type { Dependency, Task } from './types'

export interface GanttRepository {
  insertTask(task: Task): Promise<void>
  updateTask(taskId: string, patch: Partial<Task>): Promise<void>
  deleteTask(taskId: string): Promise<void>
  insertDependency(dep: Dependency): Promise<void>
  deleteDependency(depId: string): Promise<void>
  reorderTasks(order: { taskId: string; sortOrder: number }[]): Promise<void>
}

export function rowToTask(row: Tables<'tasks'>): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    title: row.title,
    type: row.type,
    startDate: row.start_date,
    endDate: row.end_date,
    progress: row.progress,
    color: row.color,
    assigneeId: row.assignee_id,
    sortOrder: row.sort_order,
    collapsed: row.collapsed,
    updatedAt: row.updated_at,
  }
}

export function rowToDependency(row: Tables<'dependencies'>): Dependency {
  return { id: row.id, projectId: row.project_id, fromTaskId: row.from_task_id, toTaskId: row.to_task_id }
}

export function taskToRow(t: Task): TablesInsert<'tasks'> {
  return {
    id: t.id,
    project_id: t.projectId,
    parent_id: t.parentId,
    title: t.title,
    type: t.type,
    start_date: t.startDate,
    end_date: t.endDate,
    progress: t.progress,
    color: t.color,
    assignee_id: t.assigneeId,
    sort_order: t.sortOrder,
    collapsed: t.collapsed,
  }
}

const COLUMN: { [K in keyof Task]?: keyof TablesUpdate<'tasks'> } = {
  parentId: 'parent_id', title: 'title', type: 'type', startDate: 'start_date', endDate: 'end_date',
  progress: 'progress', color: 'color', assigneeId: 'assignee_id', sortOrder: 'sort_order', collapsed: 'collapsed',
}

export function patchToRow(patch: Partial<Task>): TablesUpdate<'tasks'> {
  const row: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(COLUMN) as [keyof Task, string][]) {
    if (key in patch && patch[key] !== undefined) row[col] = patch[key]
  }
  return row as TablesUpdate<'tasks'>
}

export function createSupabaseRepository(client: SupabaseClient<Database>): GanttRepository {
  const check = (error: { message: string } | null, count?: number | null) => {
    if (error) throw new Error(error.message)
    if (count === 0) throw new Error('no_row_affected') // RLS a refusé silencieusement
  }
  return {
    async insertTask(task) {
      const { error } = await client.from('tasks').insert(taskToRow(task))
      check(error)
    },
    async updateTask(taskId, patch) {
      const { error, count } = await client.from('tasks').update(patchToRow(patch), { count: 'exact' }).eq('id', taskId)
      check(error, count)
    },
    async deleteTask(taskId) {
      const { error, count } = await client.from('tasks').delete({ count: 'exact' }).eq('id', taskId)
      check(error, count)
    },
    async insertDependency(dep) {
      const { error } = await client.from('dependencies').insert({ id: dep.id, project_id: dep.projectId, from_task_id: dep.fromTaskId, to_task_id: dep.toTaskId })
      check(error)
    },
    async deleteDependency(depId) {
      const { error, count } = await client.from('dependencies').delete({ count: 'exact' }).eq('id', depId)
      check(error, count)
    },
    async reorderTasks(order) {
      const results = await Promise.all(
        order.map((o) => client.from('tasks').update({ sort_order: o.sortOrder }, { count: 'exact' }).eq('id', o.taskId)),
      )
      for (const r of results) check(r.error, r.count)
    },
  }
}
```

Run : `npm test && npm run typecheck` — Expected : PASS. Si `Tables`/`TablesInsert` n'existent pas dans `lib/supabase/types.ts`, régénérer avec `npm run db:types` (le CLI ≥ 1.150 les exporte).

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/repository.ts tests/unit/lib/gantt/repository.test.ts
git commit -m "feat(gantt): repository Supabase et mappers"
```

---

### Task 8 : Commandes optimistes avec rollback

**Files:**
- Create : `lib/gantt/commands.ts`, `lib/gantt/client-commands.ts`
- Test : `tests/unit/lib/gantt/commands.test.ts`

**Interfaces:**
- Consumes : `useGanttStore` (type `StoreApi<GanttState>`), `GanttRepository`, `checkLink`, `LINK_ERRORS`, `shiftDates`, `resizeDates`, `siblingsOf`, `reorderSiblings`, `nextSortOrder`, `nextColor`.
- Produces :

```ts
interface CreateTaskInput { title: string; type: TaskType; startDate: string; endDate: string; parentId?: string | null; color?: string; assigneeId?: string | null; progress?: number }
interface GanttCommands {
  createTask(input: CreateTaskInput): Promise<Task | null>
  updateTask(taskId: string, patch: Partial<Omit<Task, 'id' | 'projectId'>>): Promise<boolean>
  moveTask(taskId: string, deltaDays: number): Promise<boolean>
  resizeTask(taskId: string, edge: 'start' | 'end', deltaDays: number): Promise<boolean>
  deleteTask(taskId: string): Promise<boolean>
  linkTasks(fromId: string, toId: string): Promise<boolean>
  unlinkTasks(depId: string): Promise<boolean>
  toggleGroup(groupId: string): Promise<boolean>
  reorderTask(taskId: string, targetIndex: number): Promise<boolean>
}
interface CommandDeps { store: StoreApi<GanttState>; repo: GanttRepository; notify: (msg: string) => void; newId?: () => string; now?: () => string }
function createCommands(deps: CommandDeps): GanttCommands
function getGanttCommands(): GanttCommands   // client-commands.ts, singleton navigateur
const PERSIST_ERROR = 'Modification non enregistrée'
```

- [ ] **Step 1 : Tests**

`tests/unit/lib/gantt/commands.test.ts` :

```ts
import { createCommands, PERSIST_ERROR } from '@/lib/gantt/commands'
import { useGanttStore } from '@/lib/gantt/store'
import type { GanttRepository } from '@/lib/gantt/repository'
import { LINK_ERRORS } from '@/lib/gantt/scheduling'
import { makeTask, makeDep } from './fixtures'

function fakeRepo(overrides: Partial<GanttRepository> = {}): GanttRepository {
  return {
    insertTask: vi.fn().mockResolvedValue(undefined),
    updateTask: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
    insertDependency: vi.fn().mockResolvedValue(undefined),
    deleteDependency: vi.fn().mockResolvedValue(undefined),
    reorderTasks: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const g = makeTask({ id: 'g', type: 'group', sortOrder: 0 })
const a = makeTask({ id: 'a', parentId: 'g', sortOrder: 0, startDate: '2026-09-01', endDate: '2026-09-03' })
const b = makeTask({ id: 'b', parentId: 'g', sortOrder: 1 })
const m = makeTask({ id: 'm', type: 'milestone', startDate: '2026-09-10', endDate: '2026-09-10', sortOrder: 1 })

function setup(repo = fakeRepo()) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-08-31',
    tasks: [g, a, b, m], dependencies: [makeDep('a', 'b')],
  })
  const notify = vi.fn()
  const cmd = createCommands({ store: useGanttStore, repo, notify, newId: () => 'new-id', now: () => '2026-08-31T10:00:00Z' })
  return { cmd, repo, notify }
}

describe('createTask', () => {
  it('ajoute au store, persiste, choisit couleur et sortOrder', async () => {
    const { cmd, repo } = setup()
    const t = await cmd.createTask({ title: 'N', type: 'task', startDate: '2026-09-01', endDate: '2026-09-02' })
    expect(t).toMatchObject({ id: 'new-id', projectId: 'p1', sortOrder: 2, parentId: null })
    expect(useGanttStore.getState().tasks['new-id']).toBeDefined()
    expect(repo.insertTask).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id' }))
  })
  it('force endDate = startDate pour un jalon', async () => {
    const { cmd } = setup()
    const t = await cmd.createTask({ title: 'J', type: 'milestone', startDate: '2026-09-01', endDate: '2026-09-09' })
    expect(t?.endDate).toBe('2026-09-01')
  })
  it('rollback + toast si la persistance échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ insertTask: vi.fn().mockRejectedValue(new Error('boom')) }))
    const t = await cmd.createTask({ title: 'N', type: 'task', startDate: '2026-09-01', endDate: '2026-09-02' })
    expect(t).toBeNull()
    expect(useGanttStore.getState().tasks['new-id']).toBeUndefined()
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})

describe('moveTask / resizeTask', () => {
  it('décale les dates et persiste le patch', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.moveTask('a', 2)).toBe(true)
    expect(useGanttStore.getState().tasks.a).toMatchObject({ startDate: '2026-09-03', endDate: '2026-09-05' })
    expect(repo.updateTask).toHaveBeenCalledWith('a', { startDate: '2026-09-03', endDate: '2026-09-05' })
  })
  it('ignore un groupe et un delta nul', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.moveTask('g', 2)).toBe(false)
    expect(await cmd.moveTask('a', 0)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('resize ignore un jalon', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.resizeTask('m', 'end', 3)).toBe(false)
    expect(repo.updateTask).not.toHaveBeenCalled()
  })
  it('rollback si échec', async () => {
    const { cmd } = setup(fakeRepo({ updateTask: vi.fn().mockRejectedValue(new Error('x')) }))
    await cmd.moveTask('a', 2)
    expect(useGanttStore.getState().tasks.a.startDate).toBe('2026-09-01')
  })
})

describe('deleteTask', () => {
  it('supprime en cascade dans le store et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.deleteTask('g')
    expect(Object.keys(useGanttStore.getState().tasks)).toEqual(['m'])
    expect(repo.deleteTask).toHaveBeenCalledWith('g')
  })
})

describe('linkTasks / unlinkTasks', () => {
  it('crée une dépendance valide', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.linkTasks('b', 'm')).toBe(true)
    expect(repo.insertDependency).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', fromTaskId: 'b', toTaskId: 'm' }))
  })
  it('refuse un cycle avec le message dédié, sans toucher au store', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.linkTasks('b', 'a')).toBe(false)
    expect(notify).toHaveBeenCalledWith(LINK_ERRORS.cycle)
    expect(repo.insertDependency).not.toHaveBeenCalled()
  })
  it('unlink supprime et persiste', async () => {
    const { cmd, repo } = setup()
    await cmd.unlinkTasks('a->b')
    expect(useGanttStore.getState().dependencies['a->b']).toBeUndefined()
    expect(repo.deleteDependency).toHaveBeenCalledWith('a->b')
  })
})

describe('toggleGroup / reorderTask', () => {
  it('toggleGroup inverse collapsed', async () => {
    const { cmd, repo } = setup()
    await cmd.toggleGroup('g')
    expect(useGanttStore.getState().tasks.g.collapsed).toBe(true)
    expect(repo.updateTask).toHaveBeenCalledWith('g', { collapsed: true })
  })
  it('reorderTask renumérote les frères', async () => {
    const { cmd, repo } = setup()
    await cmd.reorderTask('b', 0)
    expect(useGanttStore.getState().tasks.b.sortOrder).toBe(0)
    expect(useGanttStore.getState().tasks.a.sortOrder).toBe(1)
    expect(repo.reorderTasks).toHaveBeenCalledWith([{ taskId: 'b', sortOrder: 0 }, { taskId: 'a', sortOrder: 1 }])
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter**

`lib/gantt/commands.ts` :

```ts
import type { StoreApi } from 'zustand'
import type { GanttState } from './store'
import type { GanttRepository } from './repository'
import type { GanttEvent } from './events'
import type { Task, TaskType } from './types'
import { checkLink, LINK_ERRORS, nextSortOrder, reorderSiblings, resizeDates, shiftDates, siblingsOf } from './scheduling'
import { nextColor } from './palette'

export const PERSIST_ERROR = 'Modification non enregistrée'

export interface CreateTaskInput {
  title: string
  type: TaskType
  startDate: string
  endDate: string
  parentId?: string | null
  color?: string
  assigneeId?: string | null
  progress?: number
}

export interface GanttCommands {
  createTask(input: CreateTaskInput): Promise<Task | null>
  updateTask(taskId: string, patch: Partial<Omit<Task, 'id' | 'projectId'>>): Promise<boolean>
  moveTask(taskId: string, deltaDays: number): Promise<boolean>
  resizeTask(taskId: string, edge: 'start' | 'end', deltaDays: number): Promise<boolean>
  deleteTask(taskId: string): Promise<boolean>
  linkTasks(fromId: string, toId: string): Promise<boolean>
  unlinkTasks(depId: string): Promise<boolean>
  toggleGroup(groupId: string): Promise<boolean>
  reorderTask(taskId: string, targetIndex: number): Promise<boolean>
}

export interface CommandDeps {
  store: StoreApi<GanttState>
  repo: GanttRepository
  notify: (message: string) => void
  newId?: () => string
  now?: () => string
}

export function createCommands({ store, repo, notify, newId = () => crypto.randomUUID(), now = () => new Date().toISOString() }: CommandDeps): GanttCommands {
  /** Applique l'événement (optimiste), persiste, restaure le snapshot en cas d'échec. */
  async function run(event: GanttEvent, persist: () => Promise<void>): Promise<boolean> {
    const { tasks, dependencies } = store.getState()
    store.getState().apply(event)
    try {
      await persist()
      return true
    } catch {
      store.getState().replaceData({ tasks, dependencies })
      notify(PERSIST_ERROR)
      return false
    }
  }

  const allTasks = () => Object.values(store.getState().tasks)
  const allDeps = () => Object.values(store.getState().dependencies)

  return {
    async createTask(input) {
      const s = store.getState()
      const parentId = input.type === 'group' ? null : (input.parentId ?? null)
      const endDate = input.type === 'milestone' ? input.startDate : input.endDate
      const task: Task = {
        id: newId(),
        projectId: s.projectId,
        parentId,
        title: input.title.trim(),
        type: input.type,
        startDate: input.startDate,
        endDate,
        progress: input.progress ?? 0,
        color: input.color ?? nextColor(allTasks().map((t) => t.color)),
        assigneeId: input.assigneeId ?? null,
        sortOrder: nextSortOrder(siblingsOf(allTasks(), { parentId })),
        collapsed: false,
        updatedAt: now(),
      }
      const ok = await run({ type: 'task.created', task }, () => repo.insertTask(task))
      return ok ? task : null
    },

    updateTask(taskId, patch) {
      if (!store.getState().tasks[taskId]) return Promise.resolve(false)
      const full = { ...patch, updatedAt: now() }
      return run({ type: 'task.updated', taskId, patch: full }, () => repo.updateTask(taskId, patch))
    },

    moveTask(taskId, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type === 'group' || deltaDays === 0) return Promise.resolve(false)
      const patch = shiftDates(t, deltaDays)
      return run({ type: 'task.updated', taskId, patch: { ...patch, updatedAt: now() } }, () => repo.updateTask(taskId, patch))
    },

    resizeTask(taskId, edge, deltaDays) {
      const t = store.getState().tasks[taskId]
      if (!t || t.type !== 'task' || deltaDays === 0) return Promise.resolve(false)
      const patch = resizeDates(t, edge, deltaDays)
      if (patch.startDate === t.startDate && patch.endDate === t.endDate) return Promise.resolve(false)
      return run({ type: 'task.updated', taskId, patch: { ...patch, updatedAt: now() } }, () => repo.updateTask(taskId, patch))
    },

    deleteTask(taskId) {
      if (!store.getState().tasks[taskId]) return Promise.resolve(false)
      return run({ type: 'task.deleted', taskId }, () => repo.deleteTask(taskId))
    },

    linkTasks(fromId, toId) {
      const check = checkLink(allDeps(), fromId, toId)
      if (!check.ok) { notify(LINK_ERRORS[check.reason]); return Promise.resolve(false) }
      const dependency = { id: newId(), projectId: store.getState().projectId, fromTaskId: fromId, toTaskId: toId }
      return run({ type: 'dependency.created', dependency }, () => repo.insertDependency(dependency))
    },

    unlinkTasks(depId) {
      if (!store.getState().dependencies[depId]) return Promise.resolve(false)
      return run({ type: 'dependency.deleted', dependencyId: depId }, () => repo.deleteDependency(depId))
    },

    toggleGroup(groupId) {
      const g = store.getState().tasks[groupId]
      if (!g || g.type !== 'group') return Promise.resolve(false)
      const patch = { collapsed: !g.collapsed }
      return run({ type: 'task.updated', taskId: groupId, patch }, () => repo.updateTask(groupId, patch))
    },

    reorderTask(taskId, targetIndex) {
      const t = store.getState().tasks[taskId]
      if (!t) return Promise.resolve(false)
      const order = reorderSiblings(siblingsOf(allTasks(), t), taskId, targetIndex)
      return run({ type: 'tasks.reordered', order }, () => repo.reorderTasks(order))
    },
  }
}
```

`lib/gantt/client-commands.ts` :

```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast/store'
import { useGanttStore } from './store'
import { createSupabaseRepository } from './repository'
import { createCommands, type GanttCommands } from './commands'

let instance: GanttCommands | null = null

/** Commandes branchées sur Supabase + toasts. Singleton côté navigateur. */
export function getGanttCommands(): GanttCommands {
  if (!instance) {
    instance = createCommands({ store: useGanttStore, repo: createSupabaseRepository(createClient()), notify: toast.error })
  }
  return instance
}
```

Run : `npm test && npm run typecheck` — Expected : PASS

- [ ] **Step 3 : Commit**

```bash
git add lib/gantt/commands.ts lib/gantt/client-commands.ts tests/unit/lib/gantt/commands.test.ts
git commit -m "feat(gantt): commandes optimistes avec persistance et rollback"
```

---

### Task 9 : Page projet, hydratation, toolbar, vue statique (sidebar + header + grille + barres)

**Files:**
- Create : `app/(app)/projects/[id]/page.tsx`, `components/gantt/GanttPage.tsx`, `components/gantt/GanttToolbar.tsx`, `components/gantt/ZoomControls.tsx`, `components/gantt/GanttView.tsx`, `components/gantt/Sidebar.tsx`, `components/gantt/SidebarRow.tsx`, `components/gantt/TimelineHeader.tsx`, `components/gantt/TimelineGrid.tsx`, `components/gantt/TaskBar.tsx`, `components/gantt/MilestoneMark.tsx`, `components/gantt/GroupBar.tsx`
- Modify : `supabase/seed.sql` (projet démo), `components/layout/AppHeader.tsx` (hauteur fixe `h-14`), `app/globals.css` (retirer le `!important` du reset de radius)
- Test : `tests/e2e/gantt-view.spec.ts`

**Interfaces:**
- Consumes : `HydratePayload`, `computeLayout`, `rowToTask`, `rowToDependency`, `todayISO`, `ui/`.
- Produces : la route `/projects/[id]` ; composants listés ; `data-task-id` sur chaque barre/jalon/groupe ; `data-row-task-id` sur chaque ligne de sidebar ; `GanttView` expose un contexte `GanttViewContext` `{ layout, canEdit }` (les tâches 11–13 y ajoutent les handlers).

- [ ] **Step 1 : Seed du projet démo** — ajouter à la fin de `supabase/seed.sql` :

```sql
-- Projet démo (alice owner, bob editor, carol viewer)
insert into public.projects (id, name, owner_id)
values ('c0000000-0000-0000-0000-000000000001', 'Projet démo', 'a0000000-0000-0000-0000-000000000001');
insert into public.memberships (project_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'editor'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'viewer');

insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order)
values ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', 'Cadrage', 'group', current_date, current_date, '#FFD500', 0);
insert into public.tasks (id, project_id, parent_id, title, type, start_date, end_date, color, sort_order, progress, assignee_id) values
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Ateliers', 'task', current_date - 3, current_date + 2, '#3B82F6', 0, 60, 'a0000000-0000-0000-0000-000000000002'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Spécifications', 'task', current_date + 3, current_date + 9, '#FF6B9D', 1, 0, null);
insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order)
values ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000001', 'Kick-off dev', 'milestone', current_date + 10, current_date + 10, '#22C55E', 1);
insert into public.dependencies (project_id, from_task_id, to_task_id) values
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000003'),
  ('c0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000004');
```

Run : `npx supabase db reset` — Expected : OK.

Dans `app/globals.css`, remplacer `* { border-radius: 0 !important; }` par `* { border-radius: 0; }`. Dans `components/layout/AppHeader.tsx`, ajouter `h-14` aux classes du `<header>` (hauteur fixe utilisée par la page Gantt).

- [ ] **Step 2 : Test e2e (échoue : route absente)**

`tests/e2e/gantt-view.spec.ts` :

```ts
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'

test('le projet démo affiche ses lignes, barres, jalon et flèches', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  await expect(page.getByRole('heading', { name: 'Projet démo' })).toBeVisible()
  for (const name of ['Cadrage', 'Ateliers', 'Spécifications', 'Kick-off dev']) {
    await expect(page.locator('[data-row-task-id]', { hasText: name })).toBeVisible()
  }
  await expect(page.locator('[data-task-id]')).toHaveCount(4)
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(2)
  await expect(page.getByTestId('today-line')).toBeVisible()
})

test('le zoom change la largeur de la timeline', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(DEMO)
  const bar = page.locator('[data-task-id="d0000000-0000-0000-0000-000000000002"]')
  const dayWidth = (await bar.boundingBox())!.width
  await page.getByRole('button', { name: 'Mois' }).click()
  const monthWidth = (await bar.boundingBox())!.width
  expect(monthWidth).toBeLessThan(dayWidth / 5)
})

test('un non-membre obtient une 404', async ({ page }) => {
  await loginAs(page, 'dave')
  const res = await page.goto(DEMO)
  expect(res?.status()).toBe(404)
})
```

Run : `npm run test:e2e tests/e2e/gantt-view.spec.ts` — Expected : FAIL

- [ ] **Step 3 : Page serveur**

`app/(app)/projects/[id]/page.tsx` :

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToDependency, rowToTask } from '@/lib/gantt/repository'
import { todayISO } from '@/lib/gantt/dates'
import type { Member } from '@/lib/gantt/types'
import { GanttPage } from '@/components/gantt/GanttPage'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: project } = await supabase.from('projects').select('id, name').eq('id', id).maybeSingle()
  if (!project) notFound()

  const [{ data: memberships }, { data: tasks }, { data: deps }] = await Promise.all([
    supabase.from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id),
    supabase.from('tasks').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('dependencies').select('*').eq('project_id', id),
  ])

  const members: Member[] = (memberships ?? []).map((m) => ({
    userId: m.user_id,
    role: m.role,
    displayName: m.profiles.display_name,
    email: m.profiles.email,
    avatarUrl: m.profiles.avatar_url,
    color: m.profiles.color,
  }))
  const myRole = members.find((m) => m.userId === user.id)?.role ?? 'viewer'

  return (
    <GanttPage
      payload={{
        projectId: project.id,
        projectName: project.name,
        myRole,
        members,
        tasks: (tasks ?? []).map(rowToTask),
        dependencies: (deps ?? []).map(rowToDependency),
        today: todayISO(),
      }}
    />
  )
}
```

- [ ] **Step 4 : GanttPage, toolbar, zoom**

`components/gantt/GanttPage.tsx` :

```tsx
'use client'
import { useEffect } from 'react'
import { useGanttStore, type HydratePayload } from '@/lib/gantt/store'
import { GanttToolbar } from './GanttToolbar'
import { GanttView } from './GanttView'

export function GanttPage({ payload }: { payload: HydratePayload }) {
  const hydrate = useGanttStore((s) => s.hydrate)
  const ready = useGanttStore((s) => s.projectId === payload.projectId)

  useEffect(() => { hydrate(payload) }, [hydrate, payload])

  if (!ready) return <div className="p-8 font-mono">Chargement…</div>
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <GanttToolbar />
      <GanttView />
    </div>
  )
}
```

`components/gantt/ZoomControls.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Zoom } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

const LEVELS: { value: Zoom; label: string }[] = [{ value: 'day', label: 'Jour' }, { value: 'week', label: 'Semaine' }, { value: 'month', label: 'Mois' }]

export function ZoomControls() {
  const zoom = useGanttStore((s) => s.zoom)
  const setZoom = useGanttStore((s) => s.setZoom)
  return (
    <div role="group" aria-label="Zoom" className="inline-flex border-[3px] border-ink shadow-brutal bg-paper">
      {LEVELS.map((l) => (
        <button key={l.value} type="button" onClick={() => setZoom(l.value)} aria-pressed={zoom === l.value}
          className={cn('px-3 py-1 font-bold uppercase text-sm border-r-[3px] border-ink last:border-r-0 brutal-focus', zoom === l.value ? 'bg-ink text-paper' : 'hover:bg-yellow')}>
          {l.label}
        </button>
      ))}
    </div>
  )
}
```

`components/gantt/GanttToolbar.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ZoomControls } from './ZoomControls'

export function GanttToolbar() {
  const name = useGanttStore((s) => s.projectName)
  const members = useGanttStore((s) => s.members)
  const myRole = useGanttStore((s) => s.myRole)
  const canEdit = useGanttStore(selectCanEdit)
  const openEditor = useGanttStore((s) => s.openEditor)

  return (
    <div className="flex flex-wrap items-center gap-4 border-b-[3px] border-ink bg-paper px-6 py-3">
      <Link href="/projects" className="font-mono text-sm underline brutal-focus">← Projets</Link>
      <h1 className="text-2xl truncate max-w-md">{name}</h1>
      {canEdit ? <Badge color={myRole === 'owner' ? 'yellow' : 'blue'}>{myRole}</Badge> : <Badge color="pink">Lecture seule</Badge>}
      <div className="flex -space-x-2" aria-label="Membres">
        {members.map((m) => <Avatar key={m.userId} name={m.displayName} color={m.color} src={m.avatarUrl} size="sm" />)}
      </div>
      <div className="ml-auto flex items-center gap-3">
        <ZoomControls />
        {canEdit && (
          <>
            <Button size="sm" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'task' })}>+ Tâche</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'milestone' })}>+ Jalon</Button>
            <Button size="sm" variant="secondary" onClick={() => openEditor({ mode: 'create', parentId: null, type: 'group' })}>+ Groupe</Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5 : GanttView, contexte, header, grille**

`components/gantt/GanttView.tsx` :

```tsx
'use client'
import { createContext, useContext, useMemo, useRef } from 'react'
import { useGanttStore, selectCanEdit } from '@/lib/gantt/store'
import { computeLayout, type Layout } from '@/lib/gantt/layout'
import { HEADER_HEIGHT, SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { Sidebar } from './Sidebar'
import { TimelineHeader } from './TimelineHeader'
import { TimelineGrid } from './TimelineGrid'
import { TaskBar } from './TaskBar'
import { MilestoneMark } from './MilestoneMark'
import { GroupBar } from './GroupBar'

export interface GanttViewContextValue { layout: Layout; canEdit: boolean }
export const GanttViewContext = createContext<GanttViewContextValue | null>(null)
export function useGanttView() {
  const ctx = useContext(GanttViewContext)
  if (!ctx) throw new Error('useGanttView hors de GanttView')
  return ctx
}

export function GanttView() {
  const tasks = useGanttStore((s) => s.tasks)
  const dependencies = useGanttStore((s) => s.dependencies)
  const drag = useGanttStore((s) => s.drag)
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const canEdit = useGanttStore(selectCanEdit)
  const timelineRef = useRef<HTMLDivElement>(null)

  const layout = useMemo(() => computeLayout({ tasks, dependencies }, drag, zoom, today), [tasks, dependencies, drag, zoom, today])

  return (
    <GanttViewContext.Provider value={{ layout, canEdit }}>
      <div className="relative flex-1 overflow-auto bg-cream">
        <div className="relative" style={{ width: SIDEBAR_WIDTH + layout.width, minHeight: HEADER_HEIGHT + layout.height }}>
          <div className="sticky top-0 z-30 flex" style={{ height: HEADER_HEIGHT }}>
            <div className="sticky left-0 z-40 flex items-center border-b-[3px] border-r-[3px] border-ink bg-yellow px-3 font-display uppercase" style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
              Tâches
            </div>
            <TimelineHeader />
          </div>
          <div className="flex">
            <Sidebar />
            <div ref={timelineRef} className="relative" style={{ width: layout.width, height: Math.max(layout.height, 1) }}>
              <TimelineGrid />
              {layout.rows.map((row) => {
                const rect = layout.rects[row.task.id]
                if (row.task.type === 'milestone') return <MilestoneMark key={row.task.id} task={row.task} rect={rect} />
                if (row.task.type === 'group') return <GroupBar key={row.task.id} task={row.task} rect={rect} />
                return <TaskBar key={row.task.id} task={row.task} rect={rect} />
              })}
              {layout.rows.length === 0 && (
                <p className="absolute left-4 top-4 bg-paper brutal px-4 py-2 font-bold">Aucune tâche pour l'instant.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </GanttViewContext.Provider>
  )
}
```

`components/gantt/TimelineHeader.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { monthCells, subCells } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function TimelineHeader() {
  const zoom = useGanttStore((s) => s.zoom)
  const { layout } = useGanttView()
  const months = monthCells(layout.range, zoom)
  const subs = subCells(layout.range, zoom)
  return (
    <div className="relative border-b-[3px] border-ink bg-paper" style={{ width: layout.width, height: '100%' }}>
      {months.map((m) => (
        <div key={m.key} className="absolute top-0 h-7 border-r border-ink/20 px-2 font-display text-xs uppercase leading-7 truncate" style={{ left: m.x, width: m.width }}>
          {m.label}
        </div>
      ))}
      {subs.map((c) => (
        <div key={c.key} className="absolute top-7 h-7 border-r border-ink/20 border-t border-t-ink/20 text-center font-mono text-[11px] leading-7 truncate" style={{ left: c.x, width: c.width }}>
          {c.width >= 24 ? c.label : ''}
        </div>
      ))}
    </div>
  )
}
```

`components/gantt/TimelineGrid.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { ROW_HEIGHT, dayColumns, dateToX, PX_PER_DAY } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function TimelineGrid() {
  const zoom = useGanttStore((s) => s.zoom)
  const today = useGanttStore((s) => s.today)
  const { layout } = useGanttView()
  const cols = dayColumns(layout.range, zoom, today)
  const todayX = dateToX(today, layout.range, zoom)
  const inRange = today >= layout.range.start && today <= layout.range.end

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {cols.filter((c) => c.isWeekend).map((c) => (
        <div key={c.date} className="absolute top-0 bottom-0 bg-[repeating-linear-gradient(135deg,rgba(17,17,17,0.10)_0_3px,transparent_3px_9px)]" style={{ left: c.x, width: c.width }} />
      ))}
      {zoom === 'day' && cols.map((c) => (
        <div key={c.date} className="absolute top-0 bottom-0 border-r border-ink/20" style={{ left: c.x, width: c.width }} />
      ))}
      {layout.rows.map((r) => (
        <div key={r.task.id} className="absolute left-0 right-0 border-b border-ink/20" style={{ top: r.index * ROW_HEIGHT, height: ROW_HEIGHT }} />
      ))}
      {inRange && (
        <div data-testid="today-line" className="absolute top-0 bottom-0 bg-danger" style={{ left: todayX + PX_PER_DAY[zoom] / 2 - 1.5, width: 3 }} />
      )}
    </div>
  )
}
```

- [ ] **Step 6 : Sidebar et lignes**

`components/gantt/Sidebar.tsx` :

```tsx
'use client'
import { SIDEBAR_WIDTH } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'
import { SidebarRow } from './SidebarRow'

export function Sidebar() {
  const { layout } = useGanttView()
  return (
    <div className="sticky left-0 z-20 border-r-[3px] border-ink bg-paper" style={{ width: SIDEBAR_WIDTH, minWidth: SIDEBAR_WIDTH }}>
      {layout.rows.map((row) => <SidebarRow key={row.task.id} row={row} />)}
    </div>
  )
}
```

`components/gantt/SidebarRow.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { ROW_HEIGHT } from '@/lib/gantt/geometry'
import type { Row } from '@/lib/gantt/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'
import { useGanttView } from './GanttView'

export function SidebarRow({ row }: { row: Row }) {
  const { task, depth } = row
  const { canEdit } = useGanttView()
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const assignee = useGanttStore((s) => s.members.find((m) => m.userId === task.assigneeId))

  return (
    <div
      data-row-task-id={task.id}
      className={cn('flex items-center gap-2 border-b border-ink/20 pr-2 select-none', selected && 'bg-yellow')}
      style={{ height: ROW_HEIGHT, paddingLeft: depth === 1 ? 32 : 8 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      {task.type === 'group' ? (
        <span className="w-5 text-center font-mono">{task.collapsed ? '▸' : '▾'}</span>
      ) : (
        <span className="w-5" />
      )}
      {task.type === 'milestone' && <span className="size-3 rotate-45 bg-ink" aria-hidden />}
      <span className={cn('flex-1 truncate text-sm', task.type === 'group' && 'font-display uppercase')}>{task.title}</span>
      {assignee && <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />}
    </div>
  )
}
```

- [ ] **Step 7 : Barres, jalons, groupes (statique — les handlers arrivent en tâche 11)**

`components/gantt/TaskBar.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function TaskBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate} → ${task.endDate}`}
      className={cn('absolute flex items-center overflow-hidden border-[3px] border-ink shadow-brutal select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
      style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, backgroundColor: task.color }}
      onClick={() => select({ kind: 'task', id: task.id })}
    >
      <div className="absolute inset-y-0 left-0 bg-[repeating-linear-gradient(45deg,#111_0_4px,transparent_4px_8px)] opacity-40" style={{ width: `${task.progress}%` }} aria-hidden />
      <span className="relative truncate px-2 text-sm font-bold">{task.title}</span>
    </div>
  )
}
```

`components/gantt/MilestoneMark.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function MilestoneMark({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  const size = rect.height * 0.75
  return (
    <div
      data-task-id={task.id}
      title={`${task.title} — ${task.startDate}`}
      className="absolute flex items-center select-none"
      style={{ left: rect.x + rect.width / 2 - size / 2, top: rect.y, width: size, height: rect.height }}
      onClick={() => select({ kind: 'task', id: task.id })}
    >
      <div className={cn('rotate-45 border-[3px] border-ink shadow-brutal', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')} style={{ width: size, height: size, backgroundColor: task.color }} />
      <span className="absolute left-full ml-3 whitespace-nowrap text-sm font-bold">{task.title}</span>
    </div>
  )
}
```

`components/gantt/GroupBar.tsx` :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import type { Rect, Task } from '@/lib/gantt/types'
import { cn } from '@/lib/utils'

export function GroupBar({ task, rect }: { task: Task; rect: Rect }) {
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const select = useGanttStore((s) => s.select)
  return (
    <div
      data-task-id={task.id}
      title={task.title}
      className={cn('absolute bg-ink select-none', selected && 'outline-[3px] outline-dashed outline-ink outline-offset-2')}
      style={{ left: rect.x, top: rect.y + rect.height / 2 - 5, width: rect.width, height: 10 }}
      onClick={() => select({ kind: 'task', id: task.id })}
    >
      <span className="absolute -left-[3px] -top-[3px] size-4 rotate-45 bg-ink" aria-hidden />
      <span className="absolute -right-[3px] -top-[3px] size-4 rotate-45 bg-ink" aria-hidden />
    </div>
  )
}
```

- [ ] **Step 8 : Flèches (version statique, complétée en tâche 12)** — créer `components/gantt/DependencyArrows.tsx` et le monter dans `GanttView` juste après les barres :

```tsx
'use client'
import { useGanttStore } from '@/lib/gantt/store'
import { arrowPath } from '@/lib/gantt/geometry'
import { useGanttView } from './GanttView'

export function DependencyArrows() {
  const deps = useGanttStore((s) => s.dependencies)
  const selection = useGanttStore((s) => s.selection)
  const select = useGanttStore((s) => s.select)
  const { layout } = useGanttView()

  return (
    <svg className="absolute inset-0 overflow-visible pointer-events-none" width={layout.width} height={layout.height} aria-hidden>
      <defs>
        <marker id="arrow-head" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse">
          <path d="M0,0 L8,4 L0,8 z" fill="#111111" />
        </marker>
      </defs>
      {Object.values(deps).map((d) => {
        const from = layout.rects[d.fromTaskId]
        const to = layout.rects[d.toTaskId]
        if (!from || !to) return null
        const path = arrowPath(from, to)
        const selected = selection?.kind === 'dependency' && selection.id === d.id
        return (
          <g key={d.id} data-dep-id={d.id} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); select({ kind: 'dependency', id: d.id }) }}>
            <path d={path} stroke="transparent" strokeWidth={14} fill="none" />
            <path d={path} stroke="#111111" strokeWidth={selected ? 4 : 2.5} strokeDasharray={selected ? '6 4' : undefined} fill="none" markerEnd="url(#arrow-head)" />
          </g>
        )
      })}
    </svg>
  )
}
```

Dans `GanttView.tsx`, importer `DependencyArrows` et l'insérer après le `map` des lignes : `<DependencyArrows />`.

- [ ] **Step 9 : Rétablir la redirection après création de projet** — dans `components/project/NewProjectDialog.tsx`, s'assurer que le succès fait `router.push(\`/projects/${res.id}\`)` (si un `router.refresh()` temporaire avait été mis au plan 1, le remplacer).

- [ ] **Step 10 : Lancer typecheck + e2e**

Run : `npm run typecheck && npm run test:e2e tests/e2e/gantt-view.spec.ts`
Expected : 3 tests PASS. Vérifier visuellement (`npm run dev`, projet démo) : sidebar collée à gauche, header collé en haut, weekends hachurés, ligne rouge « aujourd'hui », deux flèches en angles droits.

- [ ] **Step 11 : Commit**

```bash
git add "app/(app)/projects/[id]/page.tsx" components/gantt/GanttPage.tsx components/gantt/GanttToolbar.tsx components/gantt/ZoomControls.tsx components/gantt/GanttView.tsx components/gantt/Sidebar.tsx components/gantt/SidebarRow.tsx components/gantt/TimelineHeader.tsx components/gantt/TimelineGrid.tsx components/gantt/TaskBar.tsx components/gantt/MilestoneMark.tsx components/gantt/GroupBar.tsx components/gantt/DependencyArrows.tsx components/project/NewProjectDialog.tsx components/layout/AppHeader.tsx app/globals.css supabase/seed.sql tests/e2e/gantt-view.spec.ts
git commit -m "feat(gantt): page projet et rendu statique du Gantt"
```

---

### Task 10 : Éditeur de tâche — créer, modifier, supprimer

**Files:**
- Create : `lib/gantt/validate.ts`, `components/gantt/TaskEditor.tsx`
- Modify : `components/gantt/GanttPage.tsx` (monter `<TaskEditor/>`), `components/gantt/TaskBar.tsx`, `MilestoneMark.tsx`, `GroupBar.tsx` (double-clic → éditeur)
- Test : `tests/unit/lib/gantt/validate.test.ts`, `tests/e2e/gantt-tasks.spec.ts`

**Interfaces:**
- Produces :

```ts
interface TaskInput { title: string; type: TaskType; startDate: string; endDate: string; progress: number }
interface TaskErrors { title?: string; dates?: string }
function validateTaskInput(input: TaskInput): { ok: true } | { ok: false; errors: TaskErrors }
```

- [ ] **Step 1 : Tests de validation**

`tests/unit/lib/gantt/validate.test.ts` :

```ts
import { validateTaskInput } from '@/lib/gantt/validate'

const base = { title: 'X', type: 'task' as const, startDate: '2026-09-01', endDate: '2026-09-03', progress: 0 }

describe('validateTaskInput', () => {
  it('accepte une entrée valide', () => expect(validateTaskInput(base)).toEqual({ ok: true }))
  it('refuse un titre vide', () => {
    expect(validateTaskInput({ ...base, title: '  ' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
  })
  it('refuse une fin avant le début', () => {
    expect(validateTaskInput({ ...base, endDate: '2026-08-31' })).toEqual({ ok: false, errors: { dates: 'La fin doit être après le début' } })
  })
  it('refuse une date invalide', () => {
    expect(validateTaskInput({ ...base, startDate: '' })).toEqual({ ok: false, errors: { dates: 'Dates invalides' } })
  })
  it('ignore la fin pour un jalon', () => {
    expect(validateTaskInput({ ...base, type: 'milestone', endDate: '2000-01-01' })).toEqual({ ok: true })
  })
})
```

Run : `npm test` — Expected : FAIL

- [ ] **Step 2 : Implémenter la validation**

`lib/gantt/validate.ts` :

```ts
import type { TaskType } from './types'

export interface TaskInput { title: string; type: TaskType; startDate: string; endDate: string; progress: number }
export interface TaskErrors { title?: string; dates?: string }

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function validateTaskInput(input: TaskInput): { ok: true } | { ok: false; errors: TaskErrors } {
  const errors: TaskErrors = {}
  if (input.title.trim().length === 0) errors.title = 'Le titre est requis'
  const end = input.type === 'milestone' ? input.startDate : input.endDate
  if (!ISO_RE.test(input.startDate) || !ISO_RE.test(end)) errors.dates = 'Dates invalides'
  else if (end < input.startDate) errors.dates = 'La fin doit être après le début'
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true }
}
```

Run : `npm test` — Expected : PASS

- [ ] **Step 3 : Test e2e (échoue : pas d'éditeur)**

`tests/e2e/gantt-tasks.spec.ts` :

```ts
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function createProject(page: Page, name: string) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
}

test('créer, éditer puis supprimer une tâche', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Édition ${Date.now()}`)

  await page.getByRole('button', { name: '+ Tâche' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nouvelle tâche' })
  await dialog.getByLabel('Titre').fill('Maquettes')
  await dialog.getByLabel('Début').fill('2026-09-01')
  await dialog.getByLabel('Fin').fill('2026-09-05')
  await dialog.getByRole('button', { name: 'Créer' }).click()
  const bar = page.locator('[data-task-id]', { hasText: 'Maquettes' })
  await expect(bar).toBeVisible()

  await bar.dblclick()
  const edit = page.getByRole('dialog', { name: 'Modifier la tâche' })
  await edit.getByLabel('Titre').fill('Maquettes v2')
  await edit.getByLabel('Avancement').fill('40')
  await edit.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.locator('[data-task-id]', { hasText: 'Maquettes v2' })).toBeVisible()

  await page.locator('[data-task-id]', { hasText: 'Maquettes v2' }).dblclick()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click()
  await expect(page.locator('[data-task-id]')).toHaveCount(0)
})

test('un titre vide est refusé', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProject(page, `Validation ${Date.now()}`)
  await page.getByRole('button', { name: '+ Jalon' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await expect(page.getByRole('alert')).toHaveText('Le titre est requis')
})
```

Run : `npm run test:e2e tests/e2e/gantt-tasks.spec.ts` — Expected : FAIL

- [ ] **Step 4 : Implémenter l'éditeur**

`components/gantt/TaskEditor.tsx` :

```tsx
'use client'
import { useState } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { validateTaskInput, type TaskErrors } from '@/lib/gantt/validate'
import { TASK_COLORS, nextColor } from '@/lib/gantt/palette'
import { addDays } from '@/lib/gantt/dates'
import type { Task, TaskType } from '@/lib/gantt/types'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const TITLES: Record<TaskType, { create: string; edit: string }> = {
  task: { create: 'Nouvelle tâche', edit: 'Modifier la tâche' },
  milestone: { create: 'Nouveau jalon', edit: 'Modifier le jalon' },
  group: { create: 'Nouveau groupe', edit: 'Modifier le groupe' },
}

export function TaskEditor() {
  const editor = useGanttStore((s) => s.editor)
  const tasks = useGanttStore((s) => s.tasks)
  if (!editor) return null
  const existing = editor.mode === 'edit' ? tasks[editor.taskId] : undefined
  if (editor.mode === 'edit' && !existing) return null
  return <TaskEditorForm key={existing?.id ?? 'new'} existing={existing} defaultType={editor.mode === 'create' ? editor.type : existing!.type} defaultParentId={editor.mode === 'create' ? editor.parentId : existing!.parentId} />
}

function TaskEditorForm({ existing, defaultType, defaultParentId }: { existing?: Task; defaultType: TaskType; defaultParentId: string | null }) {
  const closeEditor = useGanttStore((s) => s.closeEditor)
  const members = useGanttStore((s) => s.members)
  const tasks = useGanttStore((s) => s.tasks)
  const today = useGanttStore((s) => s.today)
  const groups = Object.values(tasks).filter((t) => t.type === 'group' && t.id !== existing?.id)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [type] = useState<TaskType>(defaultType)
  const [startDate, setStartDate] = useState(existing?.startDate ?? today)
  const [endDate, setEndDate] = useState(existing?.endDate ?? addDays(today, 2))
  const [progress, setProgress] = useState(existing?.progress ?? 0)
  const [color, setColor] = useState(existing?.color ?? nextColor(Object.values(tasks).map((t) => t.color)))
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '')
  const [parentId, setParentId] = useState(defaultParentId ?? '')
  const [errors, setErrors] = useState<TaskErrors>({})
  const [busy, setBusy] = useState(false)

  const isGroup = type === 'group'
  const isMilestone = type === 'milestone'
  const dialogTitle = TITLES[type][existing ? 'edit' : 'create']

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateTaskInput({ title, type, startDate, endDate, progress })
    if (!v.ok) { setErrors(v.errors); return }
    setBusy(true)
    const cmd = getGanttCommands()
    const common = { title, startDate, endDate: isMilestone ? startDate : endDate, progress: isGroup || isMilestone ? 0 : progress, color, assigneeId: assigneeId || null, parentId: isGroup ? null : parentId || null }
    const ok = existing ? await cmd.updateTask(existing.id, common) : (await cmd.createTask({ ...common, type })) !== null
    setBusy(false)
    if (ok) closeEditor()
  }

  async function remove() {
    if (!existing) return
    const label = existing.type === 'group' ? `Supprimer le groupe « ${existing.title} » et toutes ses tâches ?` : `Supprimer « ${existing.title} » ?`
    if (!window.confirm(label)) return
    await getGanttCommands().deleteTask(existing.id)
    closeEditor()
  }

  return (
    <Dialog open onClose={closeEditor} title={dialogTitle}
      footer={
        <>
          {existing && <Button variant="danger" onClick={remove} className="mr-auto">Supprimer</Button>}
          <Button variant="secondary" onClick={closeEditor}>Annuler</Button>
          <Button type="submit" form="task-editor" disabled={busy}>{existing ? 'Enregistrer' : 'Créer'}</Button>
        </>
      }>
      <form id="task-editor" onSubmit={submit} className="space-y-4">
        <Input label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} autoFocus />
        {!isGroup && (
          <div className="grid grid-cols-2 gap-4">
            <Input label="Début" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            {!isMilestone && <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />}
          </div>
        )}
        {errors.dates && <p role="alert" className="text-danger text-sm font-bold">{errors.dates}</p>}
        {!isGroup && !isMilestone && (
          <Input label="Avancement" type="number" min={0} max={100} value={progress} onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value))))} className="font-mono" />
        )}
        <fieldset>
          <legend className="font-bold uppercase text-sm mb-1">Couleur</legend>
          <div className="flex gap-2">
            {TASK_COLORS.map((c) => (
              <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}
                className={cn('size-8 border-[3px] border-ink', color === c && 'shadow-brutal outline-[3px] outline-dashed outline-ink outline-offset-2')} style={{ backgroundColor: c }} />
            ))}
          </div>
        </fieldset>
        {!isGroup && (
          <Select label="Assigné à" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
            options={[{ value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]} />
        )}
        {!isGroup && groups.length > 0 && (
          <Select label="Groupe" value={parentId} onChange={(e) => setParentId(e.target.value)}
            options={[{ value: '', label: 'Aucun' }, ...groups.map((g) => ({ value: g.id, label: g.title }))]} />
        )}
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 5 : Brancher l'éditeur**

Dans `GanttPage.tsx`, importer `TaskEditor` et rendre `<TaskEditor />` après `<GanttView />`.

Dans `TaskBar.tsx`, `MilestoneMark.tsx`, `GroupBar.tsx` : ajouter `const openEditor = useGanttStore((s) => s.openEditor)` et `const canEdit = useGanttStore(selectCanEdit)` (import `selectCanEdit`), puis sur l'élément racine `onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}`.

- [ ] **Step 6 : Lancer**

Run : `npm run typecheck && npm test && npm run test:e2e tests/e2e/gantt-tasks.spec.ts`
Expected : PASS

- [ ] **Step 7 : Commit**

```bash
git add lib/gantt/validate.ts components/gantt/TaskEditor.tsx components/gantt/GanttPage.tsx components/gantt/TaskBar.tsx components/gantt/MilestoneMark.tsx components/gantt/GroupBar.tsx tests/unit/lib/gantt/validate.test.ts tests/e2e/gantt-tasks.spec.ts
git commit -m "feat(gantt): éditeur de tâche (création, modification, suppression)"
```

---

### Task 11 : Drag — déplacer et redimensionner

**Files:**
- Create : `components/gantt/useTimelineDrag.ts`
- Modify : `components/gantt/GanttView.tsx` (handlers dans le contexte + `onPointerMove/Up` sur la timeline), `components/gantt/TaskBar.tsx`, `components/gantt/MilestoneMark.tsx`
- Test : `tests/e2e/gantt-drag.spec.ts`

**Interfaces:**
- Produces :

```ts
type BarDragMode = 'move' | 'resize-start' | 'resize-end'
interface TimelineDragHandlers {
  onBarPointerDown(e: React.PointerEvent, taskId: string, mode: BarDragMode): void
  onLinkPointerDown(e: React.PointerEvent, fromTaskId: string): void   // implémenté en tâche 12
  onPointerMove(e: React.PointerEvent): void
  onPointerUp(e: React.PointerEvent): void
}
function useTimelineDrag(timelineRef: RefObject<HTMLDivElement | null>): TimelineDragHandlers
```
- `GanttViewContextValue` devient `{ layout, canEdit, drag: TimelineDragHandlers }`.

- [ ] **Step 1 : Test e2e (échoue : pas de drag)**

`tests/e2e/gantt-drag.spec.ts` :

```ts
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function projectWithTask(page: Page) {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Drag ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Titre').fill('Dev')
  await d.getByLabel('Début').fill('2026-09-07')
  await d.getByLabel('Fin').fill('2026-09-09')
  await d.getByRole('button', { name: 'Créer' }).click()
  return page.locator('[data-task-id]', { hasText: 'Dev' })
}

async function dragBy(page: Page, x: number, y: number, dx: number) {
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx / 2, y, { steps: 4 })
  await page.mouse.move(x + dx, y, { steps: 4 })
  await page.mouse.up()
}

test('déplacer une barre de 2 jours conserve la durée', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  const box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width / 2, box.y + box.height / 2, 80)
  await expect(bar).toHaveAttribute('title', 'Dev — 2026-09-09 → 2026-09-11')
  await page.reload()
  await expect(page.locator('[data-task-id]', { hasText: 'Dev' })).toHaveAttribute('title', 'Dev — 2026-09-09 → 2026-09-11')
})

test('redimensionner par le bord droit puis le bord gauche', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  let box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width - 3, box.y + box.height / 2, 40)
  await expect(bar).toHaveAttribute('title', 'Dev — 2026-09-07 → 2026-09-10')
  box = (await bar.boundingBox())!
  await dragBy(page, box.x + 3, box.y + box.height / 2, 40)
  await expect(bar).toHaveAttribute('title', 'Dev — 2026-09-08 → 2026-09-10')
})

test('un resize ne descend pas sous 1 jour', async ({ page }) => {
  await loginAs(page, 'alice')
  const bar = await projectWithTask(page)
  const box = (await bar.boundingBox())!
  await dragBy(page, box.x + box.width - 3, box.y + box.height / 2, -400)
  await expect(bar).toHaveAttribute('title', 'Dev — 2026-09-07 → 2026-09-07')
})
```

Run : `npm run test:e2e tests/e2e/gantt-drag.spec.ts` — Expected : FAIL

- [ ] **Step 2 : Implémenter le hook**

`components/gantt/useTimelineDrag.ts` :

```ts
'use client'
import { useCallback, useRef, type PointerEvent, type RefObject } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { pxToDays } from '@/lib/gantt/geometry'

export type BarDragMode = 'move' | 'resize-start' | 'resize-end'

export interface TimelineDragHandlers {
  onBarPointerDown(e: PointerEvent, taskId: string, mode: BarDragMode): void
  onLinkPointerDown(e: PointerEvent, fromTaskId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
}

export function useTimelineDrag(timelineRef: RefObject<HTMLDivElement | null>): TimelineDragHandlers {
  const start = useRef<{ x: number; y: number } | null>(null)

  const toLocal = useCallback((e: PointerEvent) => {
    const r = timelineRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }, [timelineRef])

  const onBarPointerDown = useCallback((e: PointerEvent, taskId: string, mode: BarDragMode) => {
    if (e.button !== 0) return
    const s = useGanttStore.getState()
    s.select({ kind: 'task', id: taskId })
    if (s.myRole === 'viewer') return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    s.setDrag({ mode, taskId, deltaDays: 0 })
  }, [])

  const onLinkPointerDown = useCallback((e: PointerEvent, fromTaskId: string) => {
    if (e.button !== 0) return
    const s = useGanttStore.getState()
    if (s.myRole === 'viewer') return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY }
    const p = toLocal(e)
    s.setDrag({ mode: 'link', fromTaskId, x: p.x, y: p.y })
  }, [toLocal])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    if (!d || !start.current) return
    if (d.mode === 'link') {
      const p = toLocal(e)
      s.setDrag({ ...d, x: p.x, y: p.y })
      return
    }
    if (d.mode === 'move' || d.mode === 'resize-start' || d.mode === 'resize-end') {
      const deltaDays = pxToDays(e.clientX - start.current.x, s.zoom)
      if (deltaDays !== d.deltaDays) s.setDrag({ ...d, deltaDays })
    }
  }, [toLocal])

  const onPointerUp = useCallback(async (e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    start.current = null
    if (!d) return
    s.setDrag(null)
    const cmd = getGanttCommands()
    if (d.mode === 'move') { if (d.deltaDays !== 0) await cmd.moveTask(d.taskId, d.deltaDays) }
    else if (d.mode === 'resize-start') { if (d.deltaDays !== 0) await cmd.resizeTask(d.taskId, 'start', d.deltaDays) }
    else if (d.mode === 'resize-end') { if (d.deltaDays !== 0) await cmd.resizeTask(d.taskId, 'end', d.deltaDays) }
    else if (d.mode === 'link') {
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-task-id]')
      const toId = target?.dataset.taskId
      if (toId) await cmd.linkTasks(d.fromTaskId, toId)
    }
  }, [])

  return { onBarPointerDown, onLinkPointerDown, onPointerMove, onPointerUp }
}
```

- [ ] **Step 3 : Brancher dans GanttView et les barres**

Dans `GanttView.tsx` :
- importer `useTimelineDrag, type TimelineDragHandlers` ; étendre `GanttViewContextValue` avec `drag: TimelineDragHandlers` ;
- `const drag = useTimelineDrag(timelineRef)` ; passer `drag` dans le `value` du Provider ;
- sur le `div` `ref={timelineRef}` ajouter `onPointerMove={drag.onPointerMove} onPointerUp={drag.onPointerUp} onPointerCancel={drag.onPointerUp}` et la classe `touch-none`.

Attention : la variable locale `drag` du store (état) existe déjà dans `GanttView` — renommer l'état en `dragState` (`const dragState = useGanttStore((s) => s.drag)`) et l'utiliser dans `computeLayout`.

Dans `TaskBar.tsx` : remplacer `onClick` par `onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}` (via `const { drag, canEdit } = useGanttView()`), ajouter `cursor-grab active:cursor-grabbing`, et, si `canEdit`, deux poignées de resize à l'intérieur du conteneur (avant le `<span>` du titre) :

```tsx
{canEdit && (
  <>
    <div className="absolute inset-y-0 left-0 z-10 cursor-ew-resize" style={{ width: RESIZE_HANDLE_PX }} onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-start')} />
    <div className="absolute inset-y-0 right-0 z-10 cursor-ew-resize" style={{ width: RESIZE_HANDLE_PX }} onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'resize-end')} />
  </>
)}
```
(import `RESIZE_HANDLE_PX` depuis `@/lib/gantt/geometry`.) Retirer `overflow-hidden` de la barre (nécessaire pour la poignée de liaison en tâche 12) et mettre `overflow-hidden` sur le `<span>` du titre à la place.

Dans `MilestoneMark.tsx` : remplacer `onClick` par `onPointerDown={(e) => drag.onBarPointerDown(e, task.id, 'move')}` et ajouter `cursor-grab`.

`GroupBar.tsx` reste en `onClick` (un groupe ne se déplace pas).

- [ ] **Step 4 : Lancer**

Run : `npm run typecheck && npm run test:e2e tests/e2e/gantt-drag.spec.ts tests/e2e/gantt-tasks.spec.ts`
Expected : PASS (le double-clic de l'éditeur doit toujours fonctionner : `dblclick` émet deux `pointerdown/up` avec delta 0 → aucune commande).

- [ ] **Step 5 : Commit**

```bash
git add components/gantt/useTimelineDrag.ts components/gantt/GanttView.tsx components/gantt/TaskBar.tsx components/gantt/MilestoneMark.tsx tests/e2e/gantt-drag.spec.ts
git commit -m "feat(gantt): déplacement et redimensionnement des barres au pointeur"
```

---

### Task 12 : Dépendances — création par drag, sélection, suppression, raccourcis clavier

**Files:**
- Create : `components/gantt/useKeyboardShortcuts.ts`
- Modify : `components/gantt/TaskBar.tsx`, `MilestoneMark.tsx` (poignée de liaison), `components/gantt/DependencyArrows.tsx` (ligne temporaire), `components/gantt/GanttView.tsx` (monter le hook clavier, désélection au clic sur le fond)
- Test : `tests/e2e/gantt-deps.spec.ts`

**Interfaces:**
- Produces : `useKeyboardShortcuts()` — `Suppr`/`Backspace` supprime la sélection (confirmation pour une tâche), `Échap` désélectionne ou ferme l'éditeur ; ignoré si le focus est dans un champ.

- [ ] **Step 1 : Test e2e**

`tests/e2e/gantt-deps.spec.ts` :

```ts
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

async function addTask(page: Page, title: string, start: string, end: string) {
  await page.getByRole('button', { name: '+ Tâche' }).click()
  const d = page.getByRole('dialog')
  await d.getByLabel('Titre').fill(title)
  await d.getByLabel('Début').fill(start)
  await d.getByLabel('Fin').fill(end)
  await d.getByRole('button', { name: 'Créer' }).click()
  return page.locator('[data-task-id]', { hasText: title })
}

async function linkByDrag(page: Page, fromTitle: string, toTitle: string) {
  const from = page.locator('[data-task-id]', { hasText: fromTitle })
  const to = page.locator('[data-task-id]', { hasText: toTitle })
  const handle = from.getByRole('button', { name: 'Créer une dépendance' })
  const h = (await handle.boundingBox())!
  const t = (await to.boundingBox())!
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
  await page.mouse.down()
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Deps ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)
  await addTask(page, 'A', '2026-09-01', '2026-09-03')
  await addTask(page, 'B', '2026-09-07', '2026-09-09')
})

test('créer une dépendance par drag, refuser le cycle, supprimer au clavier', async ({ page }) => {
  await linkByDrag(page, 'A', 'B')
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(1)

  await linkByDrag(page, 'B', 'A')
  await expect(page.getByText('Dépendance refusée : cela créerait un cycle')).toBeVisible()
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(1)

  await linkByDrag(page, 'A', 'B')
  await expect(page.getByText('Cette dépendance existe déjà')).toBeVisible()

  await page.locator('svg [data-dep-id]').last().dispatchEvent('click')
  await page.keyboard.press('Delete')
  await expect(page.locator('svg [data-dep-id]')).toHaveCount(0)
})

test('Suppr supprime la tâche sélectionnée après confirmation, Échap désélectionne', async ({ page }) => {
  const a = page.locator('[data-task-id]', { hasText: 'A' })
  await a.click()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(2)

  await a.click()
  page.once('dialog', (d) => d.accept())
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(1)
})
```

Run : `npm run test:e2e tests/e2e/gantt-deps.spec.ts` — Expected : FAIL

- [ ] **Step 2 : Poignée de liaison sur TaskBar et MilestoneMark**

Dans `TaskBar.tsx`, après les poignées de resize, si `canEdit` :

```tsx
<button
  type="button"
  aria-label="Créer une dépendance"
  className="absolute top-1/2 -right-3 z-20 size-4 -translate-y-1/2 border-[3px] border-ink bg-paper cursor-crosshair hover:bg-yellow"
  onPointerDown={(e) => drag.onLinkPointerDown(e, task.id)}
  onClick={(e) => e.stopPropagation()}
/>
```

Dans `MilestoneMark.tsx`, même bouton positionné `-right-3` sur le conteneur (le losange fait `size` de large ; le conteneur a la même largeur).

- [ ] **Step 3 : Ligne temporaire dans DependencyArrows**

Dans `DependencyArrows.tsx`, lire `const drag = useGanttStore((s) => s.drag)` et ajouter avant `</svg>` :

```tsx
{drag?.mode === 'link' && layout.rects[drag.fromTaskId] && (() => {
  const r = layout.rects[drag.fromTaskId]
  return <line x1={r.x + r.width} y1={r.y + r.height / 2} x2={drag.x} y2={drag.y} stroke="#111111" strokeWidth={3} strokeDasharray="6 4" />
})()}
```

- [ ] **Step 4 : Raccourcis clavier**

`components/gantt/useKeyboardShortcuts.ts` :

```ts
'use client'
import { useEffect } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'

function inField(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      if (inField(e.target)) return
      const s = useGanttStore.getState()
      if (e.key === 'Escape') {
        if (s.editor) s.closeEditor()
        else s.select(null)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && s.selection && s.myRole !== 'viewer' && !s.editor) {
        e.preventDefault()
        const cmd = getGanttCommands()
        if (s.selection.kind === 'dependency') {
          await cmd.unlinkTasks(s.selection.id)
        } else {
          const t = s.tasks[s.selection.id]
          if (!t) return
          const label = t.type === 'group' ? `Supprimer le groupe « ${t.title} » et toutes ses tâches ?` : `Supprimer « ${t.title} » ?`
          if (window.confirm(label)) await cmd.deleteTask(t.id)
        }
        s.select(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
```

Dans `GanttView.tsx` : appeler `useKeyboardShortcuts()` et, sur le `div` `ref={timelineRef}`, ajouter `onPointerDown={(e) => { if (e.target === e.currentTarget) select(null) }}` (avec `const select = useGanttStore((s) => s.select)`) pour désélectionner au clic sur le fond. Comme `TimelineGrid` est en `pointer-events-none`, le clic sur le fond atteint bien le conteneur.

- [ ] **Step 5 : Lancer**

Run : `npm run typecheck && npm run test:e2e tests/e2e/gantt-deps.spec.ts`
Expected : PASS

- [ ] **Step 6 : Commit**

```bash
git add components/gantt/useKeyboardShortcuts.ts components/gantt/TaskBar.tsx components/gantt/MilestoneMark.tsx components/gantt/DependencyArrows.tsx components/gantt/GanttView.tsx tests/e2e/gantt-deps.spec.ts
git commit -m "feat(gantt): dépendances par drag, sélection et suppression au clavier"
```

---

### Task 13 : Groupes — repli, ajout d'enfant, réordonnancement

**Files:**
- Create : `components/gantt/useReorderDrag.ts`
- Modify : `components/gantt/SidebarRow.tsx` (chevron actif, bouton « + », poignée), `components/gantt/Sidebar.tsx` (handlers move/up), `components/gantt/GanttView.tsx` (contexte `reorder`)
- Test : `tests/e2e/gantt-groups.spec.ts`

**Interfaces:**
- Produces :

```ts
interface ReorderDragHandlers {
  onGripPointerDown(e: React.PointerEvent, taskId: string): void
  onPointerMove(e: React.PointerEvent): void
  onPointerUp(e: React.PointerEvent): void
}
function useReorderDrag(): ReorderDragHandlers
```
- `GanttViewContextValue` devient `{ layout, canEdit, drag, reorder: ReorderDragHandlers }`.

- [ ] **Step 1 : Test e2e**

`tests/e2e/gantt-groups.spec.ts` :

```ts
import { test, expect, type Page } from '@playwright/test'
import { loginAs } from './helpers'

const rows = (page: Page) => page.locator('[data-row-task-id]')

test('groupe : créer, ajouter un enfant, replier, réordonner', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(`Groupes ${Date.now()}`)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL(/\/projects\/[0-9a-f-]{36}$/)

  await page.getByRole('button', { name: '+ Groupe' }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Phase 1')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()

  const group = rows(page).filter({ hasText: 'Phase 1' })
  await group.getByRole('button', { name: 'Ajouter une tâche au groupe' }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Enfant A')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()
  await group.getByRole('button', { name: 'Ajouter une tâche au groupe' }).click()
  await page.getByRole('dialog').getByLabel('Titre').fill('Enfant B')
  await page.getByRole('dialog').getByRole('button', { name: 'Créer' }).click()

  await expect(rows(page)).toHaveText(['Phase 1', 'Enfant A', 'Enfant B'].map((t) => new RegExp(t)))
  await expect(page.locator('[data-task-id]').first()).toBeVisible() // la barre de groupe couvre les enfants

  await group.getByRole('button', { name: 'Replier' }).click()
  await expect(rows(page)).toHaveCount(1)
  await page.reload()
  await expect(rows(page)).toHaveCount(1)
  await rows(page).first().getByRole('button', { name: 'Déplier' }).click()
  await expect(rows(page)).toHaveCount(3)

  const gripB = rows(page).filter({ hasText: 'Enfant B' }).getByLabel('Réordonner')
  const rowA = rows(page).filter({ hasText: 'Enfant A' })
  const g = (await gripB.boundingBox())!
  const a = (await rowA.boundingBox())!
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + 40, a.y + a.height / 2, { steps: 6 })
  await page.mouse.up()
  await expect(rows(page)).toHaveText(['Phase 1', 'Enfant B', 'Enfant A'].map((t) => new RegExp(t)))
})
```

Run : `npm run test:e2e tests/e2e/gantt-groups.spec.ts` — Expected : FAIL

- [ ] **Step 2 : Hook de réordonnancement**

`components/gantt/useReorderDrag.ts` :

```ts
'use client'
import { useCallback, type PointerEvent } from 'react'
import { useGanttStore } from '@/lib/gantt/store'
import { getGanttCommands } from '@/lib/gantt/client-commands'
import { siblingsOf } from '@/lib/gantt/scheduling'

export interface ReorderDragHandlers {
  onGripPointerDown(e: PointerEvent, taskId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
}

function siblingIndex(taskId: string): number {
  const s = useGanttStore.getState()
  const t = s.tasks[taskId]
  return siblingsOf(Object.values(s.tasks), t).findIndex((x) => x.id === taskId)
}

export function useReorderDrag(): ReorderDragHandlers {
  const onGripPointerDown = useCallback((e: PointerEvent, taskId: string) => {
    if (e.button !== 0) return
    const s = useGanttStore.getState()
    if (s.myRole === 'viewer') return
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    s.setDrag({ mode: 'reorder', taskId, targetIndex: siblingIndex(taskId) })
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useGanttStore.getState()
    const d = s.drag
    if (!d || d.mode !== 'reorder') return
    const overId = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-row-task-id]')?.dataset.rowTaskId
    if (!overId || overId === d.taskId) return
    const moving = s.tasks[d.taskId]
    const over = s.tasks[overId]
    if (!moving || !over || over.parentId !== moving.parentId) return
    const targetIndex = siblingIndex(overId)
    if (targetIndex !== d.targetIndex) s.setDrag({ ...d, targetIndex })
  }, [])

  const onPointerUp = useCallback(async () => {
    const s = useGanttStore.getState()
    const d = s.drag
    if (!d || d.mode !== 'reorder') return
    s.setDrag(null)
    if (d.targetIndex !== siblingIndex(d.taskId)) await getGanttCommands().reorderTask(d.taskId, d.targetIndex)
  }, [])

  return { onGripPointerDown, onPointerMove, onPointerUp }
}
```

- [ ] **Step 3 : Brancher dans Sidebar / SidebarRow / GanttView**

`GanttView.tsx` : `const reorder = useReorderDrag()` ; ajouter `reorder` au contexte (`GanttViewContextValue` : `{ layout, canEdit, drag, reorder }`).

`Sidebar.tsx` : sur le `div` racine, `onPointerMove={reorder.onPointerMove} onPointerUp={reorder.onPointerUp} onPointerCancel={reorder.onPointerUp}` et classe `touch-none` (via `const { layout, reorder } = useGanttView()`).

`SidebarRow.tsx` — remplacer le contenu du composant par :

```tsx
export function SidebarRow({ row }: { row: Row }) {
  const { task, depth } = row
  const { canEdit, reorder } = useGanttView()
  const selected = useGanttStore((s) => s.selection?.kind === 'task' && s.selection.id === task.id)
  const isDropTarget = useGanttStore((s) => {
    const d = s.drag
    if (!d || d.mode !== 'reorder' || d.taskId === task.id) return false
    const moving = s.tasks[d.taskId]
    if (!moving || moving.parentId !== task.parentId) return false
    return siblingsOf(Object.values(s.tasks), task).findIndex((x) => x.id === task.id) === d.targetIndex
  })
  const select = useGanttStore((s) => s.select)
  const openEditor = useGanttStore((s) => s.openEditor)
  const assignee = useGanttStore((s) => s.members.find((m) => m.userId === task.assigneeId))

  return (
    <div
      data-row-task-id={task.id}
      className={cn('flex items-center gap-2 border-b border-ink/20 pr-2 select-none', selected && 'bg-yellow', isDropTarget && 'shadow-[inset_0_3px_0_#111]')}
      style={{ height: ROW_HEIGHT, paddingLeft: depth === 1 ? 32 : 8 }}
      onClick={() => select({ kind: 'task', id: task.id })}
      onDoubleClick={() => canEdit && openEditor({ mode: 'edit', taskId: task.id })}
    >
      {canEdit ? (
        <span aria-label="Réordonner" className="w-4 cursor-grab font-mono text-ink/40 active:cursor-grabbing" onPointerDown={(e) => reorder.onGripPointerDown(e, task.id)}>⋮⋮</span>
      ) : <span className="w-4" />}
      {task.type === 'group' ? (
        <button type="button" aria-label={task.collapsed ? 'Déplier' : 'Replier'} className="w-5 text-center font-mono brutal-focus"
          onClick={(e) => { e.stopPropagation(); getGanttCommands().toggleGroup(task.id) }}>
          {task.collapsed ? '▸' : '▾'}
        </button>
      ) : <span className="w-5" />}
      {task.type === 'milestone' && <span className="size-3 rotate-45 bg-ink" aria-hidden />}
      <span className={cn('flex-1 truncate text-sm', task.type === 'group' && 'font-display uppercase')}>{task.title}</span>
      {assignee && <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />}
      {task.type === 'group' && canEdit && (
        <button type="button" aria-label="Ajouter une tâche au groupe" className="size-6 border-[3px] border-ink bg-paper font-bold leading-none hover:bg-yellow brutal-focus"
          onClick={(e) => { e.stopPropagation(); openEditor({ mode: 'create', parentId: task.id, type: 'task' }) }}>+</button>
      )}
    </div>
  )
}
```

Imports à ajouter dans `SidebarRow.tsx` : `getGanttCommands` (`@/lib/gantt/client-commands`), `siblingsOf` (`@/lib/gantt/scheduling`).

- [ ] **Step 4 : Lancer**

Run : `npm run typecheck && npm run test:e2e tests/e2e/gantt-groups.spec.ts`
Expected : PASS

- [ ] **Step 5 : Commit**

```bash
git add components/gantt/useReorderDrag.ts components/gantt/Sidebar.tsx components/gantt/SidebarRow.tsx components/gantt/GanttView.tsx tests/e2e/gantt-groups.spec.ts
git commit -m "feat(gantt): groupes — repli, ajout d'enfant et réordonnancement"
```

---

### Task 14 : Lecture seule (viewer) et passe finale

**Files:**
- Test : `tests/e2e/gantt-readonly.spec.ts`
- Modify : au besoin `components/gantt/*` pour que rien d'éditable ne soit rendu pour un viewer

- [ ] **Step 1 : Test e2e**

`tests/e2e/gantt-readonly.spec.ts` :

```ts
import { test, expect } from '@playwright/test'
import { loginAs } from './helpers'

const DEMO = '/projects/c0000000-0000-0000-0000-000000000001'

test('un viewer voit le Gantt sans aucune action d\'édition', async ({ page }) => {
  await loginAs(page, 'carol')
  await page.goto(DEMO)
  await expect(page.getByText('Lecture seule')).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Tâche' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Créer une dépendance' })).toHaveCount(0)
  await expect(page.getByLabel('Réordonner')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Ajouter une tâche au groupe' })).toHaveCount(0)

  const bar = page.locator('[data-task-id="d0000000-0000-0000-0000-000000000002"]')
  const before = await bar.getAttribute('title')
  const box = (await bar.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 5 })
  await page.mouse.up()
  await expect(bar).toHaveAttribute('title', before!)

  await bar.dblclick()
  await expect(page.getByRole('dialog')).toHaveCount(0)

  await bar.click()
  await page.keyboard.press('Delete')
  await expect(page.locator('[data-task-id]')).toHaveCount(4)
})

test('un editor peut modifier le projet démo', async ({ page }) => {
  await loginAs(page, 'bob')
  await page.goto(DEMO)
  await expect(page.getByRole('button', { name: '+ Tâche' })).toBeVisible()
  await expect(page.getByText('editor')).toBeVisible()
})
```

Run : `npm run test:e2e tests/e2e/gantt-readonly.spec.ts` — Expected : PASS si les tâches 9–13 ont bien conditionné tout sur `canEdit` / `myRole`. Si un élément apparaît, le conditionner et relancer.

- [ ] **Step 2 : Suite complète**

```bash
npx supabase db reset
npm run typecheck && npm run lint && npm test && npm run test:db && npm run test:e2e
```

Expected : tout PASS.

- [ ] **Step 3 : Commit**

```bash
git add tests/e2e/gantt-readonly.spec.ts components/gantt
git commit -m "test(gantt): lecture seule pour les viewers"
```

---

## Critères de fin du plan 2

- `/projects/[id]` rend le Gantt néo-brutaliste : sidebar sticky, header deux niveaux, weekends hachurés, ligne « aujourd'hui », barres avec hachures d'avancement, losanges de jalon, barres de groupe, flèches en angles droits.
- Un editor crée / édite / supprime des tâches, jalons et groupes ; déplace et redimensionne au pointeur avec snap au jour ; crée des dépendances par drag (cycles et doublons refusés avec toast) ; replie les groupes ; réordonne par drag ; supprime au clavier.
- Toute écriture est optimiste avec rollback + toast en cas d'échec (prouvé par les tests de commandes).
- Un viewer voit tout, ne peut rien modifier (UI + RLS).
- Le plan 3 (`2026-08-31-bradgantt-03-membres-invitations.md`) ajoute la gestion des membres et les invitations par email.
