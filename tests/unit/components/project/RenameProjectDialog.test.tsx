import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RenameProjectDialog } from '@/components/project/RenameProjectDialog'
import { useToastStore } from '@/lib/toast/store'

const mockRenameProject = vi.fn()
vi.mock('@/app/(app)/projects/actions', () => ({
  renameProject: (...args: unknown[]) => mockRenameProject(...args),
}))

// Politique d'erreur unifiée (C2) : une erreur de VALIDATION (fieldError) s'affiche
// inline dans le formulaire ; un échec de PERSISTANCE (error) déclenche un toast — jamais
// les deux à la fois pour le même échec (l'ancien comportement doublait le signalement).
describe('RenameProjectDialog : politique d\'erreur unifiée', () => {
  beforeEach(() => {
    mockRenameProject.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  it('une erreur de validation (fieldError) s\'affiche inline, sans toast', async () => {
    mockRenameProject.mockResolvedValue({ fieldError: 'Le nom est requis' })
    render(<RenameProjectDialog projectId="p1" currentName="Ancien nom" open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom est requis')
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('un échec de persistance (error) déclenche un toast, sans message inline', async () => {
    mockRenameProject.mockResolvedValue({ error: 'Modification non enregistrée' })
    render(<RenameProjectDialog projectId="p1" currentName="Ancien nom" open onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(useToastStore.getState().toasts[0]).toMatchObject({ kind: 'error', message: 'Modification non enregistrée' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
