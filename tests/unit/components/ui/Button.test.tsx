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

  it('seul le niveau 1 porte l\'ombre brutale', () => {
    render(
      <>
        <Button>Principal</Button>
        <Button variant="secondary">Secondaire</Button>
        <Button variant="quiet">Discret</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Principal' })).toHaveClass('brutal')
    const secondary = screen.getByRole('button', { name: 'Secondaire' })
    expect(secondary).not.toHaveClass('brutal')
    expect(secondary).toHaveClass('border-ink')
    expect(screen.getByRole('button', { name: 'Discret' })).not.toHaveClass('brutal')
    expect(screen.getByRole('button', { name: 'Discret' })).toHaveClass('border-transparent')
  })

  it('le destructif discret est rouge sans fond au repos', () => {
    render(<Button variant="danger-quiet">Supprimer</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-danger', 'bg-transparent')
    expect(screen.getByRole('button')).not.toHaveClass('brutal')
  })
})
