import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GanttToolbar } from '@/components/gantt/GanttToolbar'
import { useGanttStore } from '@/lib/gantt/store'

function hydrate(myRole: 'owner' | 'editor' | 'viewer') {
  act(() => {
    useGanttStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [], dependencies: [], today: '2026-10-06',
    })
  })
}

describe('GanttToolbar', () => {
  beforeEach(() => useGanttStore.setState({ zoom: 'day' }))

  it('un lecteur voit « Lecture seule » et aucun bouton de création', () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    expect(screen.getByText('Lecture seule')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Tâche' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ajouter' })).not.toBeInTheDocument()
  })

  it('un éditeur : « + Tâche » est le seul principal, « + Jalon » et « + Groupe » secondaires', () => {
    hydrate('editor')
    render(<GanttToolbar />)
    expect(screen.getByRole('button', { name: '+ Tâche' })).toHaveClass('bg-ink')
    expect(screen.getByRole('button', { name: '+ Jalon' })).toHaveClass('bg-paper')
    expect(screen.getByRole('button', { name: '+ Groupe' })).toHaveClass('bg-paper')
    // Le rôle d'un éditeur n'est plus affiché : seul l'état « lecture seule » mérite d'être dit.
    expect(screen.queryByText('Lecture seule')).not.toBeInTheDocument()
  })

  it('« + Tâche » ouvre l\'éditeur en création', async () => {
    hydrate('editor')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: '+ Tâche' }))
    expect(useGanttStore.getState().editor).toEqual({ mode: 'create', parentId: null, type: 'task' })
  })

  it('« Aujourd\'hui » demande un recentrage sur le jour courant', async () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: 'Aujourd\'hui' }))
    expect(useGanttStore.getState().scrollTarget?.date).toBe('2026-10-06')
  })

  it('le « + » du téléphone propose Tâche, Jalon et Groupe', async () => {
    hydrate('editor')
    render(<GanttToolbar />)
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Jalon' }))
    expect(useGanttStore.getState().editor).toEqual({ mode: 'create', parentId: null, type: 'milestone' })
  })

  it('le zoom courant est en jaune, sans ombre', () => {
    hydrate('viewer')
    render(<GanttToolbar />)
    expect(screen.getByRole('button', { name: 'Jour', exact: true })).toHaveClass('bg-yellow')
    expect(screen.getByRole('group', { name: 'Zoom' })).not.toHaveClass('shadow-brutal')
  })
})
