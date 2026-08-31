import { toast, useToastStore } from '@/lib/toast/store'

describe('toast store', () => {
  beforeEach(() => useToastStore.setState({ toasts: [] }))

  it('ajoute un toast d\'erreur', () => {
    toast.error('Modification non enregistrée')
    const [t] = useToastStore.getState().toasts
    expect(t).toMatchObject({ kind: 'error', message: 'Modification non enregistrée' })
  })

  it('retire un toast par id', () => {
    toast.success('Ok')
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('annule le timer si dismiss est appelé avant l\'échéance', () => {
    vi.useFakeTimers()
    try {
      toast.success('Ok')
      const id = useToastStore.getState().toasts[0].id
      useToastStore.getState().dismiss(id)
      vi.advanceTimersByTime(4000)
      expect(useToastStore.getState().toasts).toHaveLength(0)
    } finally {
      vi.useRealTimers()
    }
  })
})
