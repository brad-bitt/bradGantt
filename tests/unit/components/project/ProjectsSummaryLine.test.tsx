import { render, screen } from '@testing-library/react'
import { ProjectsSummaryLine } from '@/components/project/ProjectsSummaryLine'

describe('ProjectsSummaryLine', () => {
  it('accorde chaque nombre : singulier à 0 et 1, pluriel au-delà', () => {
    render(<ProjectsSummaryLine figures={{ projects: 1, tasks: 0, upcomingMilestones: 1, late: 0 }} lateOnly={false} />)
    expect(screen.getByTestId('projects-summary')).toHaveTextContent('1 projet · 0 tâche · 1 jalon sous 14 jours · 0 en retard')
  })

  it('met les pluriels', () => {
    render(<ProjectsSummaryLine figures={{ projects: 12, tasks: 317, upcomingMilestones: 8, late: 2 }} lateOnly={false} />)
    expect(screen.getByTestId('projects-summary')).toHaveTextContent('12 projets · 317 tâches · 8 jalons sous 14 jours · 2 en retard')
  })

  it('à zéro retard, rien à cliquer', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 0 }} lateOnly={false} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('« N en retard » est un lien rouge vers le filtre', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 2 }} lateOnly={false} />)
    const link = screen.getByRole('link', { name: '2 en retard' })
    expect(link).toHaveAttribute('href', '/projects?filtre=retard')
    expect(link).toHaveClass('text-danger')
    expect(screen.queryByRole('link', { name: 'Tout afficher' })).not.toBeInTheDocument()
  })

  it('filtre actif : le lien est marqué courant et « Tout afficher » ramène à la liste entière', () => {
    render(<ProjectsSummaryLine figures={{ projects: 3, tasks: 4, upcomingMilestones: 0, late: 2 }} lateOnly />)
    expect(screen.getByRole('link', { name: '2 en retard' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Tout afficher' })).toHaveAttribute('href', '/projects')
  })
})
