import { createInvitation, isValidEmail, normalizeEmail } from '@/lib/invitations/create'
import type { InvitationDb, Mailer } from '@/lib/invitations/types'

function fakeDb(overrides: Partial<InvitationDb> = {}): InvitationDb {
  return {
    getMyRole: vi.fn().mockResolvedValue('owner'),
    getProjectName: vi.fn().mockResolvedValue('Refonte'),
    findProfileIdByEmail: vi.fn().mockResolvedValue(null),
    isMember: vi.fn().mockResolvedValue(false),
    addMember: vi.fn().mockResolvedValue(undefined),
    hasPendingInvitation: vi.fn().mockResolvedValue(false),
    insertInvitation: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}
const mailer = (): Mailer => ({ send: vi.fn().mockResolvedValue(undefined) })
const deps = (db = fakeDb(), m = mailer()) => ({ db, mailer: m, baseUrl: 'https://brad.test', inviterName: 'Alice Test', newToken: () => 'TOKEN' })
const input = { projectId: 'p1', email: ' Dave@Test.local ', role: 'viewer' }

describe('helpers', () => {
  it('isValidEmail', () => {
    expect(isValidEmail('a@b.co')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
    expect(isValidEmail('a@b')).toBe(false)
  })
  it('normalizeEmail', () => expect(normalizeEmail(' Dave@Test.local ')).toBe('dave@test.local'))
})

describe('createInvitation — validation et droits', () => {
  it('400 email invalide', async () => {
    expect(await createInvitation(deps(), { ...input, email: 'x' })).toEqual({ ok: false, status: 400, error: 'Adresse email invalide' })
  })
  it('400 rôle invalide (owner interdit)', async () => {
    expect(await createInvitation(deps(), { ...input, role: 'owner' })).toEqual({ ok: false, status: 400, error: 'Rôle invalide' })
  })
  it('404 projet introuvable / non membre', async () => {
    expect(await createInvitation(deps(fakeDb({ getMyRole: vi.fn().mockResolvedValue(null) })), input)).toEqual({ ok: false, status: 404, error: 'Projet introuvable' })
  })
  it('403 si pas owner', async () => {
    expect(await createInvitation(deps(fakeDb({ getMyRole: vi.fn().mockResolvedValue('editor') })), input)).toEqual({ ok: false, status: 403, error: 'Seul le propriétaire peut inviter' })
  })
})

describe('createInvitation — compte existant', () => {
  it('ajoute directement la membership et envoie « ajouté »', async () => {
    const db = fakeDb({ findProfileIdByEmail: vi.fn().mockResolvedValue('u-dave') })
    const m = mailer()
    const res = await createInvitation(deps(db, m), input)
    expect(res).toEqual({ ok: true, kind: 'added', projectUrl: 'https://brad.test/projects/p1' })
    expect(db.findProfileIdByEmail).toHaveBeenCalledWith('dave@test.local')
    expect(db.addMember).toHaveBeenCalledWith('p1', 'u-dave', 'viewer')
    expect(db.insertInvitation).not.toHaveBeenCalled()
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dave@test.local', subject: 'Tu as été ajouté au projet « Refonte »' }))
  })
  it('400 si déjà membre', async () => {
    const db = fakeDb({ findProfileIdByEmail: vi.fn().mockResolvedValue('u-dave'), isMember: vi.fn().mockResolvedValue(true) })
    expect(await createInvitation(deps(db), input)).toEqual({ ok: false, status: 400, error: 'Cette personne est déjà membre' })
  })
})

describe('createInvitation — compte inconnu', () => {
  it('insère une invitation et envoie le lien', async () => {
    const db = fakeDb()
    const m = mailer()
    const res = await createInvitation(deps(db, m), input)
    expect(res).toEqual({ ok: true, kind: 'invited', inviteUrl: 'https://brad.test/invite/TOKEN' })
    expect(db.insertInvitation).toHaveBeenCalledWith({ projectId: 'p1', email: 'dave@test.local', role: 'viewer', token: 'TOKEN' })
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'dave@test.local', subject: 'Alice Test t\'invite sur le projet « Refonte »' }))
  })
  it('400 si une invitation est déjà en attente', async () => {
    const db = fakeDb({ hasPendingInvitation: vi.fn().mockResolvedValue(true) })
    expect(await createInvitation(deps(db), input)).toEqual({ ok: false, status: 400, error: 'Une invitation est déjà en attente pour cette adresse' })
  })
  it('une erreur d\'envoi d\'email ne fait pas échouer l\'invitation', async () => {
    const m: Mailer = { send: vi.fn().mockRejectedValue(new Error('smtp')) }
    const res = await createInvitation(deps(fakeDb(), m), input)
    expect(res.ok).toBe(true)
  })
})
