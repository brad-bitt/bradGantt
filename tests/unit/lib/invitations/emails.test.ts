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

describe('courriels : identité éditoriale (spec §9)', () => {
  it('bouton en encre pleine arrondi, titre en casse mixte, plus de brutalisme', () => {
    for (const html of [
      invitationEmail({ projectName: 'Refonte', inviterName: 'Alice', inviteUrl: 'https://x/i', role: 'editor' }).html,
      addedEmail({ projectName: 'Refonte', inviterName: 'Alice', projectUrl: 'https://x/p', role: 'viewer' }).html,
    ]) {
      expect(html).toContain('background:#2A2622')
      expect(html).toContain('border-radius:7px')
      expect(html).not.toContain('text-transform:uppercase')
      expect(html).not.toContain('box-shadow')
      expect(html).not.toContain('#FFD500')
      expect(html).not.toContain('#111')
    }
  })
})
