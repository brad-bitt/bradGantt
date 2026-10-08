import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Textarea } from '@/components/ui/Textarea'

describe('Input', () => {
  it('associe le label au champ', () => {
    render(<Input label="Email" name="email" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('name', 'email')
  })
  it("affiche l'erreur et marque le champ invalide", () => {
    render(<Input label="Nom" error="Le nom est requis" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Le nom est requis')
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-invalid', 'true')
  })
  it('un `type` fourni par l\'appelant passe intact (ex. date/number du plan suivant)', () => {
    render(<Input label="Échéance" type="date" />)
    expect(screen.getByLabelText('Échéance')).toHaveAttribute('type', 'date')
  })
  it('aria-invalid/aria-describedby dérivés de `error` ne sont pas écrasables via un spread de props', () => {
    render(<Input label="Nom" error="Le nom est requis" aria-invalid="false" aria-describedby="autre-id" />)
    const input = screen.getByLabelText('Nom')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input.getAttribute('aria-describedby')).not.toBe('autre-id')
  })
  it('sans erreur, un aria-describedby fourni par l\'appelant (ex. texte d\'aide) est conservé', () => {
    render(<Input label="Nom" aria-describedby="hint-id" />)
    expect(screen.getByLabelText('Nom')).toHaveAttribute('aria-describedby', 'hint-id')
  })
})

describe('Select', () => {
  it('rend les options et remonte le changement', async () => {
    const onChange = vi.fn()
    render(
      <Select label="Rôle" onChange={onChange} defaultValue="viewer"
        options={[{ value: 'editor', label: 'Éditeur' }, { value: 'viewer', label: 'Lecteur' }]} />,
    )
    await userEvent.selectOptions(screen.getByLabelText('Rôle'), 'editor')
    expect(onChange).toHaveBeenCalled()
    expect(screen.getByLabelText('Rôle')).toHaveValue('editor')
  })
})

describe('Checkbox', () => {
  it('bascule au clic sur le label', async () => {
    render(<Checkbox label="Replié" />)
    const box = screen.getByLabelText('Replié')
    expect(box).not.toBeChecked()
    await userEvent.click(screen.getByText('Replié'))
    expect(box).toBeChecked()
  })
  it('reste type="checkbox" même si un `type` différent est fourni via les props', () => {
    render(<Checkbox label="Replié" type="text" />)
    expect(screen.getByLabelText('Replié')).toHaveAttribute('type', 'checkbox')
  })
})

describe('champs à filet (spec §4)', () => {
  it('Input, Select et Textarea partagent le même gabarit', () => {
    render(
      <>
        <Input label="Titre" />
        <Select label="Statut" options={[{ value: 'a', label: 'A' }]} />
        <Textarea label="Description" />
      </>,
    )
    for (const el of [screen.getByLabelText('Titre'), screen.getByLabelText('Statut'), screen.getByLabelText('Description')]) {
      expect(el).toHaveClass('rounded-control', 'border', 'border-line', 'bg-surface', 'focus-ring')
      expect(el).not.toHaveClass('border-[3px]')
    }
    expect(screen.getByLabelText('Titre')).toHaveClass('h-10')
    expect(screen.getByText('Titre')).toHaveClass('font-medium', 'text-sm')
  })

  it('une erreur passe le filet en rouge', () => {
    render(<Input label="Courriel" error="Adresse invalide" />)
    expect(screen.getByLabelText('Courriel')).toHaveClass('border-danger')
    expect(screen.getByRole('alert')).toHaveClass('text-danger')
  })

  it('la case à cocher est native, en encre', () => {
    render(<Checkbox label="Lier" />)
    expect(screen.getByLabelText('Lier')).toHaveClass('accent-ink', 'focus-ring')
    expect(screen.getByLabelText('Lier')).not.toHaveClass('appearance-none')
  })
})
