import { render, screen } from '@testing-library/react'
import { Avatar, initials } from '@/components/ui/Avatar'

describe('initials', () => {
  it('prend les initiales des deux premiers mots', () => expect(initials('Alice Test')).toBe('AT'))
  it('prend deux lettres si un seul mot', () => expect(initials('bob')).toBe('BO'))
  it('gère une chaîne vide', () => expect(initials('')).toBe('?'))
})

describe('Avatar', () => {
  it('affiche les initiales avec la couleur du membre', () => {
    render(<Avatar name="Alice Test" color="#FF6B9D" />)
    const el = screen.getByTitle('Alice Test')
    expect(el).toHaveTextContent('AT')
    expect(el).toHaveStyle({ backgroundColor: '#FF6B9D' })
  })
  it("affiche l'image si src fourni", () => {
    render(<Avatar name="Alice" color="#FFD500" src="https://x/y.png" />)
    expect(screen.getByRole('img', { name: 'Alice' })).toHaveAttribute('src', 'https://x/y.png')
  })
})
