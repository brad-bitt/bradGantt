import { render, screen } from '@testing-library/react'
import { Textarea } from '@/components/ui/Textarea'

describe('Textarea', () => {
  it('associe son libellé au champ', () => {
    render(<Textarea label="Description" defaultValue="Bonjour" />)
    expect(screen.getByLabelText('Description')).toHaveValue('Bonjour')
  })

  it('annonce l\'erreur et la relie au champ', () => {
    render(<Textarea label="Description" error="Trop long" />)
    const field = screen.getByLabelText('Description')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Trop long')
    expect(field).toHaveAttribute('aria-describedby', screen.getByRole('alert').id)
  })

  it('sans erreur, n\'écrase pas l\'aria-describedby fourni par l\'appelant', () => {
    render(<Textarea label="Description" aria-describedby="aide" />)
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-describedby', 'aide')
  })
})
