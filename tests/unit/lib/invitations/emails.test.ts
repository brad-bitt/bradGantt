import { invitationEmail, addedEmail } from '@/lib/invitations/emails'

describe('emails', () => {
  it('invitationEmail contient le projet, l\'inviteur, le rôle et le lien', () => {
    const m = invitationEmail({ projectName: 'Refonte', inviterName: 'Alice Test', inviteUrl: 'https://x/invite/abc', role: 'editor' })
    expect(m.subject).toBe('Alice Test t\'invite sur le projet « Refonte »')
    expect(m.html).toContain('https://x/invite/abc')
    expect(m.html).toContain('éditeur')
    expect(m.text).toContain('https://x/invite/abc')
  })
  it('addedEmail pointe vers le projet', () => {
    const m = addedEmail({ projectName: 'Refonte', inviterName: 'Alice Test', projectUrl: 'https://x/projects/1', role: 'viewer' })
    expect(m.subject).toBe('Tu as été ajouté au projet « Refonte »')
    expect(m.text).toContain('https://x/projects/1')
    expect(m.html).toContain('lecteur')
  })
  it('échappe le HTML dans les noms', () => {
    const m = addedEmail({ projectName: '<b>x</b>', inviterName: 'A', projectUrl: 'https://x', role: 'viewer' })
    expect(m.html).not.toContain('<b>x</b>')
    expect(m.html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
