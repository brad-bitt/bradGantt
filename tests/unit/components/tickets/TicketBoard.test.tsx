import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketBoard } from '@/components/tickets/TicketBoard'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const updateTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket, deleteTicket: vi.fn() }),
}))

const todo = makeTicket({ id: 'a', number: 1, title: 'À faire ça', status: 'todo', taskId: 'k1' })
const doing = makeTicket({ id: 'b', number: 2, title: 'En cours ça', status: 'doing' })

function hydrate(role: 'editor' | 'viewer' = 'editor') {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: role,
    members: [],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [todo, doing],
  })
}

beforeEach(() => updateTicket.mockClear())

describe('TicketBoard', () => {
  it('rend les trois colonnes, avec leur compteur, même vides', () => {
    hydrate()
    render(<TicketBoard />)
    expect(within(screen.getByRole('region', { name: 'À faire' })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Terminé' })).getByText('Vide')).toBeInTheDocument()
  })

  it('range chaque ticket dans sa colonne et montre sa tâche liée', () => {
    hydrate()
    render(<TicketBoard />)
    const column = screen.getByRole('region', { name: 'À faire' })
    expect(within(column).getByRole('article', { name: '#1 À faire ça' })).toBeInTheDocument()
    expect(within(column).getByText('↳ Développement')).toBeInTheDocument()
  })

  it('la flèche avance le statut d\'une colonne', async () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    await userEvent.click(within(card).getByRole('button', { name: 'Déplacer vers En cours' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'doing' })
  })

  it('pas de flèche « précédent » sur la première colonne ni « suivant » sur la dernière', () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    expect(within(card).queryByRole('button', { name: /Déplacer vers À faire/ })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Déplacer vers En cours' })).toBeInTheDocument()
  })

  it('un lecteur ne voit AUCUNE commande de déplacement', () => {
    hydrate('viewer')
    render(<TicketBoard />)
    expect(screen.queryByRole('button', { name: /Déplacer vers/ })).not.toBeInTheDocument()
  })

  // Double-clic et non clic simple (ruling F1) : la carte capture le pointeur pendant le glisser,
  // chaque dépôt déclencherait donc aussi un clic qui ouvrirait la modale.
  it('un double-clic sur la carte ouvre l\'éditeur, ni un clic simple ni un double-clic sur une flèche', async () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    await userEvent.dblClick(within(card).getByRole('button', { name: 'Déplacer vers En cours' }))
    expect(useTicketsStore.getState().editor).toBeNull()
    await userEvent.click(card)
    expect(useTicketsStore.getState().editor).toBeNull()
    await userEvent.dblClick(card)
    expect(useTicketsStore.getState().editor).toEqual({ mode: 'edit', ticketId: 'a' })
  })
})
