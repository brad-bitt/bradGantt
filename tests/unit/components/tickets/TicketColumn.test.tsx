import { act, render, screen } from '@testing-library/react'
import { TicketColumn } from '@/components/tickets/TicketColumn'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const a = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo' })

beforeEach(() => {
  act(() => {
    useTicketsStore.getState().hydrate({ projectId: 'p1', projectName: 'P', myRole: 'editor', members: [], tasks: [], tickets: [a] })
  })
})

describe('TicketColumn', () => {
  it('un en-tête : pastille de statut, nom, compte — et pas de cadre autour de la colonne', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    const column = screen.getByRole('region', { name: 'Terminé' })
    expect(column).not.toHaveClass('border-[3px]')
    expect(screen.getByRole('heading', { name: 'Terminé' })).toBeInTheDocument()
    expect(screen.getByTestId('status-swatch')).toHaveClass('bg-emerald')
    expect(screen.getByText('0')).toHaveClass('font-mono')
  })

  it('hors glisser, aucun emplacement de dépôt', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    expect(screen.queryByTestId('drop-slot')).not.toBeInTheDocument()
    expect(screen.getByText('Vide')).toBeInTheDocument()
  })

  it('pendant un glisser, les AUTRES colonnes offrent « Déposer ici », jaune quand on les survole', () => {
    render(<TicketColumn status="done" tickets={[]} onCardPointerDown={() => {}} />)
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'todo' }))
    const slot = screen.getByTestId('drop-slot')
    expect(slot).toHaveTextContent('Déposer ici')
    expect(slot).not.toHaveClass('bg-yellow')
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'done' }))
    expect(screen.getByTestId('drop-slot')).toHaveClass('bg-yellow')
  })

  it('la colonne d\'origine n\'offre pas d\'emplacement : y déposer ne ferait rien', () => {
    render(<TicketColumn status="todo" tickets={[a]} onCardPointerDown={() => {}} />)
    act(() => useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'todo' }))
    expect(screen.queryByTestId('drop-slot')).not.toBeInTheDocument()
  })
})
