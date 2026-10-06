import { roleOf, rowsToMembers, type MembershipRow } from '@/lib/projects/members'

const rows: MembershipRow[] = [
  { user_id: 'u1', role: 'owner', profiles: { display_name: 'Alice', email: 'a@t.l', avatar_url: null, color: '#FFD500' } },
  // Profil masqué par la RLS : la ligne d'appartenance existe, le profil ne se lit pas.
  { user_id: 'u2', role: 'editor', profiles: null },
]

describe('rowsToMembers', () => {
  it('projette les profils lisibles et écarte les autres', () => {
    expect(rowsToMembers(rows)).toEqual([
      { userId: 'u1', role: 'owner', displayName: 'Alice', email: 'a@t.l', avatarUrl: null, color: '#FFD500' },
    ])
  })
})

describe('roleOf', () => {
  it('lit le rôle sur les lignes BRUTES, même quand le profil est masqué', () => {
    expect(roleOf(rows, 'u2')).toBe('editor')
  })
  it('rend null pour qui n\'est pas membre', () => {
    expect(roleOf(rows, 'u9')).toBeNull()
  })
})
