import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/Badge'

describe('Badge', () => {
  it('rend le contenu avec la couleur demandée', () => {
    render(<Badge color="cyan">viewer</Badge>)
    expect(screen.getByText('viewer')).toHaveClass('bg-cyan')
  })
  it('est encre par défaut', () => {
    render(<Badge>owner</Badge>)
    expect(screen.getByText('owner')).toHaveClass('bg-ink')
  })
})
