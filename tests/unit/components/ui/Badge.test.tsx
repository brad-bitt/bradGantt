import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('porte une couleur de données en teinte pâle, texte en encre', () => {
    render(<Badge color="cyan">Lecteur</Badge>)
    expect(screen.getByText('Lecteur')).toHaveClass('bg-cyan/30', 'text-ink', 'rounded-full')
  })
  it('est encre par défaut', () => {
    render(<Badge>Propriétaire</Badge>)
    expect(screen.getByText('Propriétaire')).toHaveClass('bg-ink', 'text-paper')
  })
  it('est en casse mixte, hors police mono, en 13 px', () => {
    render(<Badge>Éditeur</Badge>)
    expect(screen.getByText('Éditeur')).not.toHaveClass('uppercase')
    expect(screen.getByText('Éditeur')).not.toHaveClass('font-mono')
    expect(screen.getByText('Éditeur')).toHaveClass('text-xs')
  })
  it('a une couleur de surface, celle du statut « À faire »', () => {
    render(<Badge color="paper">À faire</Badge>)
    expect(screen.getByText('À faire')).toHaveClass('bg-surface', 'text-ink')
  })
  it('a une couleur « actif », l’or voilé', () => {
    render(<Badge color="accent">Moi</Badge>)
    expect(screen.getByText('Moi')).toHaveClass('bg-accent-soft')
  })
})
