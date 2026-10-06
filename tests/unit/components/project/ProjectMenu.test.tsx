import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProjectMenu } from '@/components/project/ProjectMenu'
import { useToastStore } from '@/lib/toast/store'

const mockDelete = vi.fn()
const mockSetTickets = vi.fn()
vi.mock('@/app/(app)/(accueil)/projects/actions', () => ({
  deleteProject: (...args: unknown[]) => mockDelete(...args),
  setTicketsEnabled: (...args: unknown[]) => mockSetTickets(...args),
  renameProject: vi.fn(),
}))

async function open(props: Partial<React.ComponentProps<typeof ProjectMenu>> = {}) {
  render(<ProjectMenu projectId="p1" projectName="Alpha" ticketsEnabled={false} {...props} />)
  await userEvent.click(screen.getByRole('button', { name: 'Actions du projet' }))
}

describe('ProjectMenu', () => {
  beforeEach(() => {
    mockDelete.mockReset()
    mockSetTickets.mockReset()
    useToastStore.setState({ toasts: [] })
  })

  it('propose d\'activer les tickets quand ils sont désactivés, de les désactiver sinon', async () => {
    await open({ ticketsEnabled: false })
    expect(screen.getByRole('menuitem', { name: 'Activer les tickets' })).toBeInTheDocument()
  })

  it('« Désactiver les tickets » écrit false ; un échec part en toast', async () => {
    mockSetTickets.mockResolvedValue({ error: 'Modification non enregistrée' })
    await open({ ticketsEnabled: true })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Désactiver les tickets' }))
    expect(mockSetTickets).toHaveBeenCalledWith('p1', false)
    expect(useToastStore.getState().toasts.map((t) => t.message)).toContain('Modification non enregistrée')
  })

  it('« Renommer » ouvre la fenêtre pré-remplie', async () => {
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Renommer' }))
    expect(screen.getByRole('dialog', { name: 'Renommer le projet' })).toBeInTheDocument()
    expect(screen.getByLabelText('Nom du projet')).toHaveValue('Alpha')
  })

  it('« Supprimer » demande confirmation ; un refus ne supprime rien', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await open()
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(confirm).toHaveBeenCalledWith('Supprimer « Alpha » et toutes ses tâches ?')
    expect(mockDelete).not.toHaveBeenCalled()
    confirm.mockRestore()
  })

  it('depuis l\'en-tête, la suppression demande au serveur de quitter la page', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockDelete.mockResolvedValue({})
    await open({ leaveOnDelete: true })
    await userEvent.click(screen.getByRole('menuitem', { name: 'Supprimer' }))
    expect(mockDelete).toHaveBeenCalledWith('p1', true)
    confirm.mockRestore()
  })
})
