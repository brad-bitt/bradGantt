import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('rend le contenu avec la couleur demandée', () => {
    render(<Badge color="cyan">Lecteur</Badge>)
    expect(screen.getByText('Lecteur')).toHaveClass('bg-cyan')
  })
  it('est encre par défaut', () => {
    render(<Badge>Propriétaire</Badge>)
    expect(screen.getByText('Propriétaire')).toHaveClass('bg-ink')
  })
  it('est en casse mixte et hors police mono', () => {
    render(<Badge>Éditeur</Badge>)
    expect(screen.getByText('Éditeur')).not.toHaveClass('uppercase')
    expect(screen.getByText('Éditeur')).not.toHaveClass('font-mono')
  })
  it('a une couleur papier, celle du statut « À faire »', () => {
    render(<Badge color="paper">À faire</Badge>)
    expect(screen.getByText('À faire')).toHaveClass('bg-paper', 'text-ink')
  })
})
