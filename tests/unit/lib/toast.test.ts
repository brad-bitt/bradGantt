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
})
