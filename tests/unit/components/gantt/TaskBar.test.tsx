import { act, render } from '@testing-library/react'
import { GanttView } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'

// jsdom ne fait pas de mise en page : `clientWidth` vaut 0 et `scrollLeft` est en lecture seule.
// Mêmes cales que GanttView.test.tsx, le temps du fichier.
const scrollLefts = new WeakMap<Element, number>()
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollLeft', {
    configurable: true,
    get(this: Element) { return scrollLefts.get(this) ?? 0 },
    set(this: Element, v: number) { scrollLefts.set(this, v) },
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 1280 })
})
afterAll(() => {
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).scrollLeft
  delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth
})

const TODAY = '2026-09-15'
// « a » est dans les temps ; « late » est finie hier sans être achevée : en retard.
function hydrateWithLate() {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'Projet', myRole: 'owner', members: [],
      tasks: [
        makeTask({ id: 'a', projectId: 'p1', startDate: '2026-09-14', endDate: '2026-09-18', progress: 40, color: '#5B9DFF' }),
        makeTask({ id: 'late', projectId: 'p1', startDate: '2026-09-01', endDate: '2026-09-10', progress: 50, color: '#FF8A3D' }),
      ],
      dependencies: [],
      today: TODAY,
    })
  })
}

describe('TaskBar (spec §7)', () => {
  beforeEach(() => hydrateWithLate())

  it('teinte pâle et liseré : la barre pose sa couleur en variable et la classe data-bar', () => {
    const { container } = render(<GanttView />)
    const bar = container.querySelector('[data-task-id="a"]') as HTMLElement
    expect(bar).toHaveClass('data-bar')
    expect(bar.style.getPropertyValue('--bar-color')).not.toBe('')
    expect(bar.style.backgroundColor).toBe('')
    expect(bar).not.toHaveClass('shadow-brutal')
    expect(bar).not.toHaveClass('border-[3px]')
  })

  it('l’avancement est un trait du bord bas, de la longueur de l’avancement', () => {
    const { container } = render(<GanttView />)
    const task = useGanttStore.getState().tasks['a']
    const progress = container.querySelector('[data-task-id="a"] .data-bar-progress') as HTMLElement
    expect(progress).not.toBeNull()
    expect(progress.style.width).toBe(`${task.progress}%`)
    expect(progress).toHaveClass('absolute', 'bottom-0', 'left-0')
    expect(container.querySelector('[data-task-id="a"] .hatch-data')).toBeNull()
  })

  it('le texte est en encre du thème, et la sélection un anneau d’or', () => {
    const { container } = render(<GanttView />)
    act(() => useGanttStore.getState().select({ kind: 'task', id: 'a' }))
    const bar = container.querySelector('[data-task-id="a"]') as HTMLElement
    expect(bar).toHaveClass('outline-2', 'outline-accent')
    expect(bar.querySelector('span.truncate')).toHaveClass('text-ink')
  })

  it('le retard mis en évidence : liseré rouge sur la barre en retard, pas sur les autres', () => {
    const { container } = render(<GanttView />)
    act(() => useGanttStore.getState().toggleHighlightLate())
    expect(container.querySelector('[data-task-id="late"]')).toHaveClass('data-bar-late')
    expect(container.querySelector('[data-task-id="a"]')).not.toHaveClass('data-bar-late')
  })
})
