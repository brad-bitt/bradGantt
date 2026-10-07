import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketCard } from '@/components/tickets/TicketCard'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const updateTicket = vi.fn().mockResolvedValue(true)
const deleteTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket, deleteTicket }),
}))

const todo = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo', taskId: 'k1' })
const done = makeTicket({ id: 'b', number: 2, title: 'Beta', status: 'done', taskId: null })

function hydrate(myRole: 'editor' | 'viewer' = 'editor') {
  act(() => {
    useTicketsStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [{ id: 'k1', title: 'Développement' }], tickets: [todo, done],
    })
  })
}

beforeEach(() => { updateTicket.mockClear(); deleteTicket.mockClear() })

describe('TicketCard', () => {
  it('porte une bande d\'accent dans la couleur de son statut', () => {
    hydrate()
    render(<TicketCard ticket={{ ...todo, status: 'doing' }} onPointerDown={() => {}} />)
    expect(screen.getByTestId('status-accent')).toHaveClass('bg-blue')
  })

  it('une carte terminée recule à 75 % ; une carte sans tâche le dit', () => {
    hydrate()
    render(<TicketCard ticket={done} onPointerDown={() => {}} />)
    expect(screen.getByRole('article', { name: '#2 Beta' })).toHaveClass('opacity-75')
    expect(screen.getByText('Sans tâche')).toBeInTheDocument()
  })

  it('la tâche liée est une puce « ↳ titre »', () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    expect(screen.getByText('↳ Développement')).toHaveClass('font-mono')
  })

  it('le ⋯ propose Modifier, les deux AUTRES statuts, et Supprimer', async () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    const menu = screen.getByRole('menu', { name: 'Actions du ticket #1' })
    expect(within(menu).getAllByRole('menuitem').map((el) => el.textContent)).toEqual(['Modifier', 'En cours', 'Terminé', 'Supprimer'])
    expect(menu).toHaveTextContent('Déplacer vers…')
  })

  it('« Déplacer vers… Terminé » écrit le statut', async () => {
    hydrate()
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Terminé' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('« Supprimer » demande confirmation avant de supprimer', async () => {
    hydrate()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Actions du ticket #1' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(confirm).toHaveBeenCalledWith('Supprimer le ticket #1 « Alpha » ?')
    expect(deleteTicket).toHaveBeenCalledWith('a')
    confirm.mockRestore()
  })

  // Review Focus 1 : le menu vit sur une carte qu'on glisse et qu'on double-clique.
  it('ouvrir le menu et y choisir n\'arme pas le glisser et n\'ouvre pas l\'éditeur', async () => {
    hydrate()
    const onPointerDown = vi.fn()
    render(<TicketCard ticket={todo} onPointerDown={onPointerDown} />)
    const trigger = screen.getByRole('button', { name: 'Actions du ticket #1' })
    await userEvent.dblClick(trigger)
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('menuitem', { name: 'En cours' }))
    expect(onPointerDown).not.toHaveBeenCalled()
    expect(useTicketsStore.getState().editor).toBeNull()
  })

  it('un lecteur n\'a ni flèches ni menu', () => {
    hydrate('viewer')
    render(<TicketCard ticket={todo} onPointerDown={() => {}} />)
    expect(screen.queryByRole('button', { name: /Actions du ticket/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Déplacer vers/ })).not.toBeInTheDocument()
  })
})
