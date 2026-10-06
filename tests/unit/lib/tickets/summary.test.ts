import { byNumber, countDone, filterTickets, groupByTask, ticketsByStatus } from '@/lib/tickets/summary'
import { NO_FILTERS } from '@/lib/tickets/types'
import { makeTicket } from './fixtures'

describe('filterTickets', () => {
  const a = makeTicket({ id: 'a', number: 2, status: 'done', assigneeId: 'u1', taskId: 'k1' })
  const b = makeTicket({ id: 'b', number: 1, status: 'todo', assigneeId: null, taskId: null })
  const all = [a, b]

  it('sans filtre, rend tout, trié par numéro croissant', () => {
    expect(filterTickets(all, NO_FILTERS).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('filtre par statut', () => {
    expect(filterTickets(all, { ...NO_FILTERS, status: 'done' }).map((t) => t.id)).toEqual(['a'])
  })

  it('la chaîne vide sur l\'assigné désigne « personne », pas « tout le monde »', () => {
    expect(filterTickets(all, { ...NO_FILTERS, assigneeId: '' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTickets(all, { ...NO_FILTERS, assigneeId: 'u1' }).map((t) => t.id)).toEqual(['a'])
  })

  it('la chaîne vide sur la tâche désigne « ticket libre »', () => {
    expect(filterTickets(all, { ...NO_FILTERS, taskId: '' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTickets(all, { ...NO_FILTERS, taskId: 'k1' }).map((t) => t.id)).toEqual(['a'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const input = [a, b]
    filterTickets(input, NO_FILTERS)
    expect(input.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('ticketsByStatus', () => {
  it('rend les trois colonnes, même vides, chacune triée par numéro', () => {
    const t1 = makeTicket({ id: '1', number: 3, status: 'todo' })
    const t2 = makeTicket({ id: '2', number: 1, status: 'todo' })
    const out = ticketsByStatus([t1, t2])
    expect(Object.keys(out)).toEqual(['todo', 'doing', 'done'])
    expect(out.todo.map((t) => t.id)).toEqual(['2', '1'])
    expect(out.doing).toEqual([])
    expect(out.done).toEqual([])
  })
})

describe('groupByTask', () => {
  it('groupe par tâche, ignore les tickets libres et trie par numéro', () => {
    const out = groupByTask([
      { id: 'x', number: 5, title: 'X', status: 'todo', taskId: 'k1' },
      { id: 'y', number: 2, title: 'Y', status: 'done', taskId: 'k1' },
      { id: 'z', number: 9, title: 'Z', status: 'todo', taskId: null },
    ])
    expect(Object.keys(out)).toEqual(['k1'])
    expect(out.k1.map((t) => t.id)).toEqual(['y', 'x'])
  })
})

describe('countDone', () => {
  it('compte les terminés sur le total', () => {
    expect(countDone([
      { id: 'a', number: 1, title: 'A', status: 'done' },
      { id: 'b', number: 2, title: 'B', status: 'todo' },
    ])).toEqual({ done: 1, total: 2 })
  })
  it('rend zéro sur zéro pour une tâche sans ticket', () => {
    expect(countDone([])).toEqual({ done: 0, total: 0 })
  })
})

describe('byNumber', () => {
  it('ordonne croissant', () => {
    expect([makeTicket({ number: 3 }), makeTicket({ number: 1 })].sort(byNumber).map((t) => t.number)).toEqual([1, 3])
  })
})
