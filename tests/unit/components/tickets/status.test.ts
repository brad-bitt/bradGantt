import { STATUS_SWATCH } from '@/components/tickets/status'

describe('couleurs de statut', () => {
  it('« À faire » est en encre douce : un filet `line` ne se voyait pas sur une surface (revue M3)', () => {
    expect(STATUS_SWATCH.todo).toBe('bg-ink-soft')
  })
})
