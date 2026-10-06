import { applyTicketEvent, indexTickets } from '@/lib/tickets/events'
import { makeTicket } from './fixtures'

describe('applyTicketEvent', () => {
  it('ajoute un ticket créé', () => {
    const t = makeTicket({ id: 'a' })
    const out = applyTicketEvent({}, { type: 'ticket.created', ticket: t })
    expect(out).toEqual({ a: t })
  })

  it('fusionne un patch sur un ticket existant', () => {
    const t = makeTicket({ id: 'a', status: 'todo' })
    const out = applyTicketEvent({ a: t }, { type: 'ticket.updated', ticketId: 'a', patch: { status: 'done' } })
    expect(out.a.status).toBe('done')
    expect(out.a.title).toBe(t.title)
  })

  it('ignore un patch sur un ticket inconnu plutôt que d\'en inventer un', () => {
    const before = {}
    const out = applyTicketEvent(before, { type: 'ticket.updated', ticketId: 'fantome', patch: { status: 'done' } })
    expect(out).toBe(before)
  })

  it('retire un ticket supprimé', () => {
    const t = makeTicket({ id: 'a' })
    const out = applyTicketEvent({ a: t }, { type: 'ticket.deleted', ticketId: 'a' })
    expect(out).toEqual({})
  })

  it('ignore la suppression d\'un ticket déjà absent', () => {
    const before = {}
    expect(applyTicketEvent(before, { type: 'ticket.deleted', ticketId: 'a' })).toBe(before)
  })

  it('indexe une liste par identifiant', () => {
    const a = makeTicket({ id: 'a' })
    const b = makeTicket({ id: 'b' })
    expect(indexTickets([a, b])).toEqual({ a, b })
  })
})
