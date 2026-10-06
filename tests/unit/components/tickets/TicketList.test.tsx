import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketList } from '@/components/tickets/TicketList'
import { useTicketsStore } from '@/lib/tickets/store'
import { NO_FILTERS } from '@/lib/tickets/types'
import { makeTicket } from '../../lib/tickets/fixtures'

const a = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo', assigneeId: 'u1', taskId: 'k1' })
const b = makeTicket({ id: 'b', number: 2, title: 'Beta', status: 'done', assigneeId: null, taskId: null })

function hydrate() {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: 'editor',
    members: [{ userId: 'u1', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FFD500' }],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [b, a],
  })
}

describe('TicketList', () => {
  // Le store garde ses filtres d'une hydratation à l'autre (voulu) : sans remise à zéro, un
  // test hériterait du filtre du précédent.
  beforeEach(() => { useTicketsStore.setState({ filters: NO_FILTERS, editor: null }) })

  it('trie par numéro croissant quel que soit l\'ordre reçu', () => {
    hydrate()
    render(<TicketList />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Alpha')
    expect(rows[1]).toHaveTextContent('Beta')
  })

  it('filtre par statut', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('filtre sur « Personne » et sur « Aucune tâche »', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Assigné'), '')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Assigné'), 'all')
    await userEvent.selectOptions(screen.getByLabelText('Tâche'), 'k1')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('dit que le filtre ne rend rien plutôt que d\'afficher un tableau vide sans explication', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'doing')
    expect(screen.getByText(/Aucun ticket ne correspond/)).toBeInTheDocument()
  })

  it('un clic sur une ligne ouvre l\'éditeur du bon ticket', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.click(screen.getByRole('button', { name: /#1 Alpha/ }))
    expect(useTicketsStore.getState().editor).toEqual({ mode: 'edit', ticketId: 'a' })
  })
})
