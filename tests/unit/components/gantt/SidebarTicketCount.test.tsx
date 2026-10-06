import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/gantt/Sidebar'
import { GanttViewContext } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { computeLayout } from '@/lib/gantt/layout'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })

function hydrate(options: { enabled: boolean; done: number; total: number }) {
  const summaries = Array.from({ length: options.total }, (_, i) => ({
    id: `t${i}`, number: i + 1, title: `Ticket ${i + 1}`, status: i < options.done ? ('done' as const) : ('todo' as const),
  }))
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-09-09',
    tasks: [task], dependencies: [],
    ticketsEnabled: options.enabled,
    ticketsByTask: options.total > 0 ? { k1: summaries } : {},
  })
}

function renderSidebar(compact: boolean) {
  const s = useGanttStore.getState()
  const layout = computeLayout({ tasks: s.tasks, dependencies: s.dependencies }, null, 'day', s.today, 800)
  return render(
    <GanttViewContext.Provider
      value={{ layout, canEdit: true, drag: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} } as never, reorder: { onGripPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} }, sidebarWidth: 260, compact }}
    >
      <Sidebar />
    </GanttViewContext.Provider>,
  )
}

describe('compteur de tickets dans la sidebar', () => {
  it('affiche « terminés / total » sur une tâche qui a des tickets', () => {
    hydrate({ enabled: true, done: 2, total: 5 })
    renderSidebar(false)
    expect(screen.getByText('2 tickets terminés sur 5')).toHaveClass('sr-only')
    expect(screen.getByText('2/5')).toHaveAttribute('aria-hidden', 'true')
  })

  it('n\'affiche rien sur un projet dont les tickets sont désactivés', () => {
    hydrate({ enabled: false, done: 2, total: 5 })
    renderSidebar(false)
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })

  it('n\'affiche rien sur une tâche sans ticket', () => {
    hydrate({ enabled: true, done: 0, total: 0 })
    renderSidebar(false)
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
  })

  it('s\'efface sur un écran étroit, où chaque pixel est pris sur le titre', () => {
    hydrate({ enabled: true, done: 2, total: 5 })
    renderSidebar(true)
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })
})
