import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from '@/components/gantt/Sidebar'
import { GanttViewContext } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { computeLayout } from '@/lib/gantt/layout'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })

function renderSidebar({ role = 'editor', compact = false }: { role?: 'editor' | 'viewer'; compact?: boolean } = {}) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: role, members: [], today: '2026-09-09',
    tasks: [task], dependencies: [],
  })
  const s = useGanttStore.getState()
  const layout = computeLayout({ tasks: s.tasks, dependencies: s.dependencies }, null, 'day', s.today, 800)
  return render(
    <GanttViewContext.Provider
      value={{ layout, canEdit: role !== 'viewer', drag: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} } as never, reorder: { onGripPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} }, sidebarWidth: 260, compact }}
    >
      <Sidebar />
    </GanttViewContext.Provider>,
  )
}

describe('SidebarRow : menu ⋯', () => {
  it('ouvre le menu contextuel de la tâche, ancré sous le bouton, et sélectionne la ligne', async () => {
    renderSidebar()
    await userEvent.click(screen.getByRole('button', { name: 'Actions de « Développement »' }))
    const s = useGanttStore.getState()
    expect(s.menu?.target).toEqual({ kind: 'task', id: 'k1' })
    expect(s.selection).toEqual({ kind: 'task', id: 'k1' })
    // Un clic sur le bouton ne doit pas, en remontant, rouvrir l'éditeur ni désélectionner.
    expect(s.editor).toBeNull()
  })

  it('révélé au survol et au focus de la ligne au bureau, visible en permanence en mode compact', () => {
    const { unmount } = renderSidebar()
    const dots = screen.getByRole('button', { name: 'Actions de « Développement »' })
    expect(dots).toHaveClass('opacity-0')
    expect(dots).toHaveClass('group-focus-within/row:opacity-100')
    unmount()
    renderSidebar({ compact: true })
    expect(screen.getByRole('button', { name: 'Actions de « Développement »' })).not.toHaveClass('opacity-0')
  })

  it('un lecteur n\'a pas de ⋯ : le menu contextuel ne lui propose rien', () => {
    renderSidebar({ role: 'viewer' })
    expect(screen.queryByRole('button', { name: /Actions de/ })).not.toBeInTheDocument()
  })
})

describe('SidebarRow : une seule couleur de fond', () => {
  // `cn` ne fusionne pas les classes : deux `bg-*` sur la même ligne se départagent au hasard de
  // l'ordre de la feuille de style. La sélection doit être exclusive du fond de groupe.
  it('un groupe sélectionné porte l’or voilé, et pas le fond de groupe', () => {
    const group = makeTask({ id: 'g1', title: 'Phase', type: 'group' })
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-09-09',
      tasks: [group], dependencies: [],
    })
    useGanttStore.getState().select({ kind: 'task', id: 'g1' })
    const s = useGanttStore.getState()
    const layout = computeLayout({ tasks: s.tasks, dependencies: s.dependencies }, null, 'day', s.today, 800)
    const { container } = render(
      <GanttViewContext.Provider
        value={{ layout, canEdit: true, drag: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} } as never, reorder: { onGripPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} }, sidebarWidth: 260, compact: false }}
      >
        <Sidebar />
      </GanttViewContext.Provider>,
    )
    const row = container.querySelector('.group\\/row') as HTMLElement
    expect(row).toHaveClass('bg-accent-soft')
    expect(row).not.toHaveClass('bg-paper')
  })
})
