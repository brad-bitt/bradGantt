import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketsToolbar } from '@/components/tickets/TicketsToolbar'
import { useTicketsStore } from '@/lib/tickets/store'
import { NO_FILTERS } from '@/lib/tickets/types'
import { makeTicket } from '../../lib/tickets/fixtures'

function hydrate(myRole: 'editor' | 'viewer' = 'editor') {
  act(() => {
    useTicketsStore.getState().hydrate({
      projectId: 'p1', projectName: 'P', myRole, members: [], tasks: [],
      tickets: [makeTicket({ id: 'a', status: 'todo' }), makeTicket({ id: 'b', status: 'done' }), makeTicket({ id: 'c', status: 'done' })],
    })
  })
}

describe('TicketsToolbar', () => {
  beforeEach(() => useTicketsStore.setState({ filters: NO_FILTERS, editor: null }))

  it('compte les tickets, et dit « n sur N » quand un filtre en cache', () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    expect(screen.getByTestId('tickets-count')).toHaveTextContent('3 tickets')
    act(() => useTicketsStore.getState().setFilter('status', 'todo'))
    expect(screen.getByTestId('tickets-count')).toHaveTextContent('1 sur 3 tickets')
  })

  it('la vue courante est un segment jaune, marqué courant', () => {
    hydrate()
    render(<TicketsToolbar view="list" />)
    const list = screen.getByRole('link', { name: 'Liste' })
    expect(list).toHaveAttribute('aria-current', 'page')
    expect(list).toHaveClass('bg-yellow')
    expect(list).toHaveAttribute('href', '/projects/p1/tickets?vue=liste')
    expect(screen.getByRole('link', { name: 'Kanban' })).not.toHaveAttribute('aria-current')
  })

  it('n\'a plus ni titre ni lien retour : ils sont dans l\'en-tête', () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Frise|Gantt/ })).not.toBeInTheDocument()
  })

  it('un lecteur voit « Lecture seule » à la place de « + Ticket »', () => {
    hydrate('viewer')
    render(<TicketsToolbar view="board" />)
    expect(screen.getByText('Lecture seule')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Ticket' })).not.toBeInTheDocument()
  })

  it('« Filtres » ouvre une fenêtre avec les trois champs, branchés sur le store', async () => {
    hydrate()
    render(<TicketsToolbar view="board" />)
    await userEvent.click(screen.getByRole('button', { name: 'Filtres' }))
    const dialog = screen.getByRole('dialog', { name: 'Filtres' })
    await userEvent.selectOptions(within(dialog).getByLabelText('Statut'), 'done')
    expect(useTicketsStore.getState().filters.status).toBe('done')
    expect(within(dialog).getByLabelText('Assigné')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Tâche')).toBeInTheDocument()
  })
})
