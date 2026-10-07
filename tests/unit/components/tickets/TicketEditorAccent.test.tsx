import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketEditor } from '@/components/tickets/TicketEditor'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket: vi.fn(), deleteTicket: vi.fn() }),
}))

describe('TicketEditor : bande de statut', () => {
  it('le bandeau de titre porte la couleur du statut, et la suit quand on le change', async () => {
    act(() => {
      useTicketsStore.getState().hydrate({
        projectId: 'p1', projectName: 'P', myRole: 'editor', members: [], tasks: [],
        tickets: [makeTicket({ id: 'a', number: 3, status: 'doing' })],
      })
      useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    })
    render(<TicketEditor />)
    expect(screen.getByRole('dialog', { name: 'Ticket #3' })).toBeInTheDocument()
    expect(screen.getByTestId('dialog-accent')).toHaveClass('bg-blue')
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    expect(screen.getByTestId('dialog-accent')).toHaveClass('bg-emerald')
    // Un seul bouton noir dans la fenêtre : « Enregistrer ». « Supprimer » est sobre au repos.
    expect(screen.getByRole('button', { name: 'Supprimer' })).toHaveClass('text-danger')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toHaveClass('bg-ink')
  })
})
