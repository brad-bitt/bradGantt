import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GanttSummary } from '@/components/gantt/GanttSummary'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'
import type { Task } from '@/lib/gantt/types'

const TODAY = '2026-10-06'

function hydrate(tasks: Task[]) {
  act(() => {
    useGanttStore.getState().hydrate({ projectId: 'p1', projectName: 'P', myRole: 'viewer', members: [], tasks, dependencies: [], today: TODAY })
  })
}

describe('GanttSummary', () => {
  it('pas de bouton de retard quand rien n\'est en retard', () => {
    hydrate([makeTask({ startDate: '2026-10-05', endDate: '2026-10-10' })])
    render(<GanttSummary />)
    expect(screen.queryByRole('button', { name: /en retard/ })).not.toBeInTheDocument()
  })

  it('« N en retard » bascule la mise en évidence et dit son état', async () => {
    hydrate([makeTask({ startDate: '2026-09-01', endDate: '2026-09-05', progress: 0 })])
    render(<GanttSummary />)
    const button = screen.getByRole('button', { name: '1 en retard' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    expect(button).toHaveClass('text-danger')

    await userEvent.click(button)
    expect(useGanttStore.getState().highlightLate).toBe(true)
    expect(button).toHaveAttribute('aria-pressed', 'true')
    expect(button).toHaveClass('bg-yellow')

    await userEvent.click(button)
    expect(useGanttStore.getState().highlightLate).toBe(false)
  })

  it('libellés en casse mixte, chiffres en mono', () => {
    hydrate([makeTask({ startDate: '2026-10-05', endDate: '2026-10-10' })])
    render(<GanttSummary />)
    expect(screen.getByText('Tâches')).not.toHaveClass('uppercase')
    expect(screen.getByText('1', { selector: '.font-mono' })).toBeInTheDocument()
  })

  it('éteint la mise en évidence quand la barre se masque (écran étroit ou bas)', () => {
    hydrate([makeTask({ startDate: '2026-09-01', endDate: '2026-09-05', progress: 0 })])
    act(() => { useGanttStore.getState().setHighlightLate(true) })
    let listener: () => void = () => {}
    const mq = { matches: true, addEventListener: (_: string, l: () => void) => { listener = l }, removeEventListener: () => {} }
    window.matchMedia = (() => mq) as unknown as typeof window.matchMedia
    try {
      render(<GanttSummary />)
      expect(useGanttStore.getState().highlightLate).toBe(true)
      mq.matches = false
      act(() => listener())
      expect(useGanttStore.getState().highlightLate).toBe(false)
    } finally {
      // @ts-expect-error jsdom n'a pas matchMedia : on retire notre simulation
      delete window.matchMedia
    }
  })
})
