import { render, screen } from '@testing-library/react'
import { ProjectTabs } from '@/components/layout/ProjectTabs'

let mockPathname = '/projects/p1'
vi.mock('next/navigation', () => ({ usePathname: () => mockPathname }))

describe('ProjectTabs', () => {
  it('Gantt est courant à la racine du projet, et seulement là', () => {
    mockPathname = '/projects/p1'
    render(<ProjectTabs projectId="p1" ticketsEnabled isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Gantt' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Gantt' })).toHaveAttribute('href', '/projects/p1')
    expect(screen.getByRole('link', { name: 'Membres' })).not.toHaveAttribute('aria-current')
  })

  it('Tickets reste courant sur la vue liste', () => {
    mockPathname = '/projects/p1/tickets'
    render(<ProjectTabs projectId="p1" ticketsEnabled isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Gantt' })).not.toHaveAttribute('aria-current')
  })

  it('Membres est courant sur sa page', () => {
    mockPathname = '/projects/p1/membres'
    render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner={false} />)
    expect(screen.getByRole('link', { name: 'Membres' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Membres' })).toHaveAttribute('href', '/projects/p1/membres')
  })

  it('tickets désactivés : l\'onglet n\'existe que pour le propriétaire', () => {
    mockPathname = '/projects/p1'
    const { unmount } = render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner={false} />)
    expect(screen.queryByRole('link', { name: 'Tickets' })).not.toBeInTheDocument()
    unmount()
    render(<ProjectTabs projectId="p1" ticketsEnabled={false} isOwner />)
    expect(screen.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/projects/p1/tickets')
  })
})
