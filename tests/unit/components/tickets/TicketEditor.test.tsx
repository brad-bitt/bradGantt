import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketEditor } from '@/components/tickets/TicketEditor'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const createTicket = vi.fn().mockResolvedValue(makeTicket({ id: 'neuf' }))
const updateTicket = vi.fn().mockResolvedValue(true)
const deleteTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket, updateTicket, deleteTicket }),
}))

const existing = makeTicket({ id: 'a', number: 7, title: 'Existant', description: 'Détail', status: 'doing', taskId: 'k1' })

function hydrate(role: 'editor' | 'viewer' = 'editor') {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: role,
    members: [{ userId: 'u1', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FFD500' }],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [existing],
  })
}

beforeEach(() => {
  createTicket.mockClear()
  updateTicket.mockClear()
  deleteTicket.mockClear()
})

describe('TicketEditor', () => {
  it('ne rend rien quand aucun éditeur n\'est ouvert', () => {
    hydrate()
    const { container } = render(<TicketEditor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ne rend rien pour un lecteur, même si l\'éditeur est ouvert', () => {
    hydrate('viewer')
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    const { container } = render(<TicketEditor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('crée un ticket avec le titre nettoyé et la tâche pré-remplie', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: 'k1' })
    render(<TicketEditor />)
    await userEvent.type(screen.getByLabelText('Titre'), '  Corriger la frise  ')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ title: '  Corriger la frise  ', taskId: 'k1', status: 'todo' }))
  })

  it('refuse un titre vide par un message inline, sans appeler la commande', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    render(<TicketEditor />)
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Le titre est requis')
    expect(createTicket).not.toHaveBeenCalled()
  })

  it('en édition, n\'envoie QUE les champs réellement modifiés', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('en édition sans aucune modification, n\'écrit rien et referme', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).not.toHaveBeenCalled()
    expect(useTicketsStore.getState().editor).toBeNull()
  })

  it('détache le ticket quand on choisit « Aucune » comme tâche', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.selectOptions(screen.getByLabelText('Tâche liée'), '')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { taskId: null })
  })
})
