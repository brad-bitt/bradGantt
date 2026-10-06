import { render, screen } from '@testing-library/react'
import { TaskEditor } from '@/components/gantt/TaskEditor'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })
const group = makeTask({ id: 'g1', title: 'Phase', type: 'group' })

function hydrate(options: { enabled: boolean; withTickets: boolean }) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-09-09',
    tasks: [task, group], dependencies: [],
    ticketsEnabled: options.enabled,
    ticketsByTask: options.withTickets
      ? { k1: [
          { id: 't1', number: 1, title: 'Brancher la connexion', status: 'done' },
          { id: 't2', number: 2, title: 'Dessiner la frise', status: 'doing' },
        ] }
      : {},
  })
}

describe('section « Tickets » de l\'éditeur de tâche', () => {
  it('liste les tickets rattachés avec leur numéro et leur statut', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByText('Brancher la connexion')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('le bouton de création NAVIGUE vers la page des tickets avec la tâche pré-remplie', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByRole('link', { name: '+ Nouveau ticket' })).toHaveAttribute('href', '/projects/p1/tickets?nouveau=k1')
  })

  it('dit qu\'il n\'y a aucun ticket plutôt que de masquer la section', () => {
    hydrate({ enabled: true, withTickets: false })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByText('Aucun ticket rattaché.')).toBeInTheDocument()
  })

  it('aucune section quand les tickets sont désactivés', () => {
    hydrate({ enabled: false, withTickets: false })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.queryByRole('link', { name: '+ Nouveau ticket' })).not.toBeInTheDocument()
  })

  it('aucune section en CRÉATION : la tâche n\'a pas encore d\'identifiant à rattacher', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'create', parentId: null, type: 'task' })
    render(<TaskEditor />)
    expect(screen.queryByRole('link', { name: '+ Nouveau ticket' })).not.toBeInTheDocument()
  })

  it('aucune section sur un GROUPE : la page des tickets refuse de rattacher un groupe', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'g1' })
    render(<TaskEditor />)
    expect(screen.queryByRole('link', { name: '+ Nouveau ticket' })).not.toBeInTheDocument()
    expect(screen.queryByText('Aucun ticket rattaché.')).not.toBeInTheDocument()
  })
})
