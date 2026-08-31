import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { useToastStore } from '@/lib/toast/store'

const mockCreateProject = vi.fn()
vi.mock('@/app/(app)/projects/actions', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}))

describe('NewProjectDialog : politique d\'erreur unifiée', () => {
  beforeEach(() => {
    mockCreateProject.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  async function openAndSubmit() {
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
  }

  it('une erreur de validation (fieldError) s\'affiche inline, sans toast', async () => {
    mockCreateProject.mockResolvedValue({ fieldError: 'Le nom est requis' })
    render(<NewProjectDialog />)
    await openAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom est requis')
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('un échec de persistance (error) déclenche un toast, sans message inline', async () => {
    mockCreateProject.mockResolvedValue({ error: 'Création impossible, réessaie.' })
    render(<NewProjectDialog />)
    await openAndSubmit()
    await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('un échec de persistance qui suit une erreur de validation efface le message inline précédent', async () => {
    mockCreateProject
      .mockResolvedValueOnce({ fieldError: 'Le nom est requis' })
      .mockResolvedValueOnce({ error: 'Création impossible, réessaie.' })
    render(<NewProjectDialog />)
    await openAndSubmit()
    expect(await screen.findByRole('alert')).toHaveTextContent('Le nom est requis')

    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
