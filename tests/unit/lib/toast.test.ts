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

  it('appelle clearTimeout quand dismiss est appelé avant l\'échéance', () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout')
    toast.success('Ok')
    const id = useToastStore.getState().toasts[0].id
    useToastStore.getState().dismiss(id)
    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })

  it('timer résiduel ne re-crée pas un toast suppressible', () => {
    vi.useFakeTimers()
    try {
      // Push premier toast
      toast.success('Premier')
      const id1 = useToastStore.getState().toasts[0].id
      // Supprimer avant l'échéance
      useToastStore.getState().dismiss(id1)
      expect(useToastStore.getState().toasts).toHaveLength(0)
      // Push second toast avec un id différent
      toast.success('Deuxième')
      const id2 = useToastStore.getState().toasts[0].id
      // Avancer le temps de 4 secondes (le timer du premier a été annulé, le deuxième expire)
      vi.advanceTimersByTime(4000)
      // Vérifier que seul le premier timer s'est exécuté sans effet
      expect(useToastStore.getState().toasts).toHaveLength(0)
      expect(id2).not.toBe(id1)
    } finally {
      vi.useRealTimers()
    }
  })
})
