import { createTicketCommands, PERSIST_ERROR, UNKNOWN_TICKET_ERROR } from '@/lib/tickets/commands'
import { useTicketsStore } from '@/lib/tickets/store'
import type { TicketRepository } from '@/lib/tickets/repository'
import { makeTicket } from './fixtures'

const existing = makeTicket({ id: 'a', number: 1, status: 'todo', title: 'Existant' })

function fakeRepo(overrides: Partial<TicketRepository> = {}): TicketRepository {
  return {
    insertTicket: vi.fn().mockResolvedValue(makeTicket({ id: 'neuf', number: 42, title: 'Neuf' })),
    updateTicket: vi.fn().mockResolvedValue(undefined),
    deleteTicket: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function setup(repo = fakeRepo()) {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: 'editor',
    members: [],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [existing],
  })
  const notify = vi.fn()
  const cmd = createTicketCommands({ store: useTicketsStore, repo, notify })
  return { cmd, repo, notify }
}

describe('createTicket', () => {
  it('n\'ajoute le ticket QU\'APRÈS la réponse du serveur, avec le numéro attribué en base', async () => {
    const { cmd, repo } = setup()
    const created = await cmd.createTicket({ title: '  Neuf  ' })
    expect(created?.number).toBe(42)
    expect(useTicketsStore.getState().tickets.neuf.number).toBe(42)
    // Le titre part sans ses espaces : la contrainte SQL mesure après trim.
    expect(repo.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', title: 'Neuf', description: '', status: 'todo', assigneeId: null, taskId: null }))
  })

  it('transmet le rattachement et l\'assigné quand ils sont fournis', async () => {
    const { cmd, repo } = setup()
    await cmd.createTicket({ title: 'Neuf', taskId: 'k1', assigneeId: 'u1', status: 'doing', description: 'Détail' })
    expect(repo.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'k1', assigneeId: 'u1', status: 'doing', description: 'Détail' }))
  })

  it('signale l\'échec, n\'ajoute rien et rend null', async () => {
    const { cmd, notify } = setup(fakeRepo({ insertTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.createTicket({ title: 'Neuf' })).toBeNull()
    expect(Object.keys(useTicketsStore.getState().tickets)).toEqual(['a'])
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })

  it('n\'injecte PAS le ticket créé si les données ont été remplacées pendant l\'écriture', async () => {
    const repo = fakeRepo({
      insertTicket: vi.fn().mockImplementation(async () => {
        // L'utilisateur a navigué vers un autre projet pendant l'appel.
        useTicketsStore.getState().hydrate({ projectId: 'p2', projectName: 'Autre', myRole: 'editor', members: [], tasks: [], tickets: [] })
        return makeTicket({ id: 'neuf', number: 1 })
      }),
    })
    const { cmd } = setup(repo)
    expect(await cmd.createTicket({ title: 'Neuf' })).toBeNull()
    expect(useTicketsStore.getState().tickets).toEqual({})
  })
})

describe('updateTicket', () => {
  it('applique tout de suite puis persiste', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.updateTicket('a', { status: 'done' })).toBe(true)
    expect(useTicketsStore.getState().tickets.a.status).toBe('done')
    expect(repo.updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('remet la valeur d\'avant et signale quand la persistance échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ updateTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.updateTicket('a', { status: 'done' })).toBe(false)
    expect(useTicketsStore.getState().tickets.a.status).toBe('todo')
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })

  it('refuse un ticket inconnu et un patch vide, sans écrire', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.updateTicket('fantome', { status: 'done' })).toBe(false)
    expect(notify).toHaveBeenCalledWith(UNKNOWN_TICKET_ERROR)
    expect(await cmd.updateTicket('a', {})).toBe(false)
    expect(repo.updateTicket).not.toHaveBeenCalled()
  })
})

describe('deleteTicket', () => {
  it('retire tout de suite puis persiste', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.deleteTicket('a')).toBe(true)
    expect(useTicketsStore.getState().tickets.a).toBeUndefined()
    expect(repo.deleteTicket).toHaveBeenCalledWith('a')
  })

  it('rend le ticket INTACT quand la suppression échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ deleteTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.deleteTicket('a')).toBe(false)
    expect(useTicketsStore.getState().tickets.a).toEqual(existing)
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})
