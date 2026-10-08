import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/Button'

describe('Button', () => {
  it('rend le libellé et déclenche onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Créer</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('applique la classe de variante', () => {
    render(<Button variant="danger">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-danger')
  })

  it('est de type button par défaut', () => {
    render(<Button>Ok</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('ne déclenche pas onClick si désactivé', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Ok</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('ne met plus le libellé en capitales', () => {
    render(<Button>Nouveau projet</Button>)
    expect(screen.getByRole('button')).not.toHaveClass('uppercase')
  })

  it('seul le niveau 1 est en encre pleine, et rien ne porte d’ombre', () => {
    render(
      <>
        <Button>Principal</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="quiet">Discret</Button>
      </>,
    )
    const primary = screen.getByRole('button', { name: 'Principal' })
    expect(primary).toHaveClass('bg-ink', 'text-paper', 'rounded-control', 'focus-ring')
    const secondary = screen.getByRole('button', { name: 'Secondaire' })
    expect(secondary).not.toHaveClass('bg-ink')
    expect(secondary).toHaveClass('border-line')
    const quiet = screen.getByRole('button', { name: 'Discret' })
    expect(quiet).not.toHaveClass('bg-ink')
    expect(quiet).toHaveClass('border-transparent')
    for (const b of [primary, secondary, quiet]) {
      expect(Array.from(b.classList).some((c) => c.startsWith('shadow'))).toBe(false)
    }
  })

  it('le destructif discret est rouge sans fond au repos', () => {
    render(<Button variant="danger-quiet">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-danger', 'bg-transparent')
    expect(screen.getByRole('button')).not.toHaveClass('bg-danger')
  })

  it('deux hauteurs fixes : 40 px et 32 px', () => {
    render(<><Button>Grand</Button><Button size="sm">Petit</Button></>)
    expect(screen.getByRole('button', { name: 'Grand' })).toHaveClass('h-10')
    expect(screen.getByRole('button', { name: 'Petit' })).toHaveClass('h-8')
  })
})
