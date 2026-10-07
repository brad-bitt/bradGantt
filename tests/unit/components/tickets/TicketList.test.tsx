import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketList } from '@/components/tickets/TicketList'
import { TicketFilterFields } from '@/components/tickets/TicketFilterFields'
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

/** Les filtres vivent dans la barre d'outils ; la liste se teste avec eux, comme à l'écran. */
function renderList() {
  return render(<><TicketFilterFields /><TicketList /></>)
}

describe('TicketList', () => {
  // Le store garde ses filtres d'une hydratation à l'autre (voulu) : sans remise à zéro, un
  // test hériterait du filtre du précédent.
  beforeEach(() => { useTicketsStore.setState({ filters: NO_FILTERS, editor: null }) })

  it('trie par numéro croissant quel que soit l\'ordre reçu', () => {
    hydrate()
    renderList()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Alpha')
    expect(rows[1]).toHaveTextContent('Beta')
  })

  it('filtre par statut', async () => {
    hydrate()
    renderList()
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('filtre sur « Personne » et sur « Aucune tâche »', async () => {
    hydrate()
    renderList()
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
    renderList()
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'doing')
    expect(screen.getByText(/Aucun ticket ne correspond/)).toBeInTheDocument()
  })

  it('un clic sur une ligne ouvre l\'éditeur du bon ticket', async () => {
    hydrate()
    renderList()
    await userEvent.click(screen.getByRole('button', { name: /#1 Alpha/ }))
    expect(useTicketsStore.getState().editor).toEqual({ mode: 'edit', ticketId: 'a' })
  })

  it('le statut est un badge en casse mixte dans la couleur du statut', () => {
    hydrate()
    renderList()
    const alpha = screen.getAllByRole('row').find((r) => r.textContent?.includes('Alpha'))!
    expect(within(alpha).getByText('À faire')).toHaveClass('bg-paper')
    expect(within(alpha).getByText('À faire')).not.toHaveClass('uppercase')
  })

  it('le titre est un bouton de niveau 3 : souligné au survol seulement', () => {
    hydrate()
    renderList()
    const button = screen.getByRole('button', { name: /#1 Alpha/ })
    expect(button).toHaveClass('hover:underline')
    expect(button).not.toHaveClass('underline')
  })
})
