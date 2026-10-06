import { createRunner, type OptimisticStore } from '@/lib/optimistic/run'

type FakeEvent = { type: 'a' } | { type: 'b' }

function fakeStore(epoch = 1) {
  const applied: FakeEvent[] = []
  const state = { epoch, apply: (e: FakeEvent) => { applied.push(e) } }
  const store: OptimisticStore<FakeEvent> = { getState: () => state }
  return { store, state, applied }
}

describe('createRunner', () => {
  it('applique les événements puis persiste, et ne touche pas à l\'inverse en cas de succès', async () => {
    const { store, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run([{ type: 'a' }, { type: 'b' }], [{ type: 'b' }], async () => {})

    expect(ok).toBe(true)
    expect(applied).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepte un événement seul comme un tableau', async () => {
    const { store, applied } = fakeStore()
    const run = createRunner<FakeEvent>({ store, notify: vi.fn(), errorMessage: 'raté' })
    await run({ type: 'a' }, [], async () => {})
    expect(applied).toEqual([{ type: 'a' }])
  })

  it('rejoue l\'inverse et signale quand la persistance échoue', async () => {
    const { store, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run({ type: 'a' }, [{ type: 'b' }], async () => { throw new Error('boum') })

    expect(ok).toBe(false)
    expect(applied).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(notify).toHaveBeenCalledWith('raté')
  })

  it('n\'annule RIEN si les données ont été remplacées pendant l\'écriture, mais signale quand même', async () => {
    const { store, state, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run({ type: 'a' }, [{ type: 'b' }], async () => {
      // Un hydrate est survenu pendant l'écriture : les entités d'avant n'ont plus rien à
      // faire dans l'état frais.
      state.epoch = 2
      throw new Error('boum')
    })

    expect(ok).toBe(false)
    expect(applied).toEqual([{ type: 'a' }])
    expect(notify).toHaveBeenCalledWith('raté')
  })
})
