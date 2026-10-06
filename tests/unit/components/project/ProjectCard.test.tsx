import { render, screen } from '@testing-library/react'
import { ProjectCard, type ProjectListItem } from '@/components/project/ProjectCard'
import { projectSummary } from '@/lib/gantt/summary'

vi.mock('@/app/(app)/(accueil)/projects/actions', () => ({
  deleteProject: vi.fn(),
  setTicketsEnabled: vi.fn(),
  renameProject: vi.fn(),
}))

const TODAY = '2026-10-06'

function item(patch: Partial<ProjectListItem> = {}): ProjectListItem {
  return {
    id: 'p1',
    name: 'Alpha',
    role: 'owner',
    createdAt: '2026-09-01T00:00:00Z',
    ticketsEnabled: true,
    ticketCount: 3,
    tasks: [],
    summary: projectSummary([], TODAY),
    members: [],
    today: TODAY,
    ...patch,
  }
}

describe('ProjectCard', () => {
  it('le titre est le lien du Gantt, et son pseudo-élément couvre toute la carte', () => {
    render(<ProjectCard project={item()} />)
    const link = screen.getByRole('link', { name: 'Alpha' })
    expect(link).toHaveAttribute('href', '/projects/p1')
    expect(link).toHaveClass('after:absolute', 'after:inset-0', 'after:z-[1]')
  })

  it('dit le rôle en toutes lettres', () => {
    render(<ProjectCard project={item({ role: 'editor' })} />)
    expect(screen.getByText('Éditeur')).toBeInTheDocument()
  })

  it('le menu ⋯ n\'est offert qu\'au propriétaire, posé au-dessus du lien de la carte', () => {
    const { unmount } = render(<ProjectCard project={item()} />)
    const trigger = screen.getByRole('button', { name: 'Actions du projet' })
    expect(trigger.closest('.z-10')).not.toBeNull()
    unmount()
    render(<ProjectCard project={item({ role: 'viewer' })} />)
    expect(screen.queryByRole('button', { name: 'Actions du projet' })).not.toBeInTheDocument()
  })

  it('« Tickets · N » mène au kanban quand les tickets sont activés', () => {
    render(<ProjectCard project={item({ ticketCount: 3 })} />)
    expect(screen.getByRole('link', { name: 'Tickets · 3' })).toHaveAttribute('href', '/projects/p1/tickets')
  })

  it('pas de lien Tickets sur un projet qui ne les active pas', () => {
    render(<ProjectCard project={item({ ticketsEnabled: false })} />)
    expect(screen.queryByRole('link', { name: /Tickets/ })).not.toBeInTheDocument()
  })

  it('un compte illisible garde le lien, sans chiffre', () => {
    render(<ProjectCard project={item({ ticketCount: null })} />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  })

  it('un projet vide dit « Aucune tâche » dans sa vignette', () => {
    render(<ProjectCard project={item()} />)
    expect(screen.getByText('Aucune tâche')).toBeInTheDocument()
    expect(screen.queryByText('Frise vide')).not.toBeInTheDocument()
  })
})
