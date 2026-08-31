import { cn } from '@/lib/utils'

describe('cn', () => {
  it('concatène les classes et ignore les valeurs fausses', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c')
  })
  it('retourne une chaîne vide sans argument', () => {
    expect(cn()).toBe('')
  })
})
