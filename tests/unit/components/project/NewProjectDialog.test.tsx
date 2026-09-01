import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewProjectDialog } from '@/components/project/NewProjectDialog'
import { useToastStore } from '@/lib/toast/store'

const mockCreateProject = vi.fn()
vi.mock('@/app/(app)/projects/actions', () => ({
  createProject: (...args: unknown[]) => mockCreateProject(...args),
}))

// `useRouter` n'est pas disponible hors d'un App Router monté : on le remplace pour pouvoir
// observer la redirection vers la page du projet créé (rétablie en tâche 9 du plan 2).
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

describe('NewProjectDialog : politique d\'erreur unifiée', () => {
  beforeEach(() => {
    mockCreateProject.mockReset()
    mockPush.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  async function openAndSubmit() {
    await userEvent.click(screen.getByRole('button', { name: 'Nouveau projet' }))
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
  }

  it('un succès redirige vers la page du projet créé', async () => {
    mockCreateProject.mockResolvedValue({ id: 'c0000000-0000-0000-0000-000000000001' })
    render(<NewProjectDialog />)
    await openAndSubmit()
    await vi.waitFor(() => expect(mockPush).toHaveBeenCalledWith('/projects/c0000000-0000-0000-0000-000000000001'))
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('un succès sans identifiant ne redirige pas et signale l\'échec', async () => {
    // Garde-fou : sans identifiant, `router.push` viserait /projects/undefined.
    mockCreateProject.mockResolvedValue({})
    render(<NewProjectDialog />)
    await openAndSubmit()
    await vi.waitFor(() => expect(useToastStore.getState().toasts).toHaveLength(1))
    expect(mockPush).not.toHaveBeenCalled()
  })

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
