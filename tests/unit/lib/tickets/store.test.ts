import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { makeTicket } from './fixtures'

const base = {
  projectId: 'p1',
  projectName: 'Projet tickets',
  myRole: 'editor' as const,
  members: [],
  tasks: [{ id: 'k1', title: 'Développement' }],
}

describe('useTicketsStore', () => {
  it('hydrate en indexant par identifiant et incrémente epoch', () => {
    const t = makeTicket({ id: 'a' })
    const before = useTicketsStore.getState().epoch
    useTicketsStore.getState().hydrate({ ...base, tickets: [t] })
    const s = useTicketsStore.getState()
    expect(s.tickets).toEqual({ a: t })
    expect(s.projectName).toBe('Projet tickets')
    expect(s.epoch).toBe(before + 1)
  })

  it('referme l\'éditeur et abandonne le geste en cours à chaque hydratation', () => {
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'doing' })
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    expect(useTicketsStore.getState().editor).toBeNull()
    expect(useTicketsStore.getState().drag).toBeNull()
  })

  it('conserve les filtres au rechargement : ce sont des gestes de consultation, pas des données', () => {
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    useTicketsStore.getState().setFilter('status', 'done')
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    expect(useTicketsStore.getState().filters.status).toBe('done')
  })

  it('applique un événement au travers du réducteur', () => {
    const t = makeTicket({ id: 'a', status: 'todo' })
    useTicketsStore.getState().hydrate({ ...base, tickets: [t] })
    useTicketsStore.getState().apply({ type: 'ticket.updated', ticketId: 'a', patch: { status: 'doing' } })
    expect(useTicketsStore.getState().tickets.a.status).toBe('doing')
  })

  it('un lecteur ne peut pas écrire', () => {
    useTicketsStore.getState().hydrate({ ...base, myRole: 'viewer', tickets: [] })
    expect(selectCanEditTickets(useTicketsStore.getState())).toBe(false)
    useTicketsStore.getState().hydrate({ ...base, myRole: 'owner', tickets: [] })
    expect(selectCanEditTickets(useTicketsStore.getState())).toBe(true)
  })
})
