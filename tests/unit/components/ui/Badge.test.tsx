import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('rend le contenu avec la couleur demandée', () => {
    render(<Badge color="pink">viewer</Badge>)
    expect(screen.getByText('viewer')).toHaveClass('bg-pink')
  })
  it('est jaune par défaut', () => {
    render(<Badge>owner</Badge>)
    expect(screen.getByText('owner')).toHaveClass('bg-yellow')
  })
})
