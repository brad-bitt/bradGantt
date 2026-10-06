import type { Member, Role } from '@/lib/gantt/types'

/** Une ligne `memberships` telle que la lisent les pages de projet, profil embarqué. */
export interface MembershipRow {
  user_id: string
  role: Role
  profiles: { display_name: string; email: string; avatar_url: string | null; color: string } | null
}

/**
 * Projection d'AFFICHAGE. L'embed `profiles` est nullable (jointure non `!inner`) : une ligne
 * dont le profil est masqué est écartée plutôt que rendue sans nom.
 */
export function rowsToMembers(rows: MembershipRow[]): Member[] {
  return rows.flatMap((m) => m.profiles
    ? [{
        userId: m.user_id,
        role: m.role,
        displayName: m.profiles.display_name,
        email: m.profiles.email,
        avatarUrl: m.profiles.avatar_url,
        color: m.profiles.color,
      }]
    : [])
}

/**
 * Le rôle se lit sur les lignes BRUTES, jamais sur `rowsToMembers` : un profil masqué priverait
 * sinon l'utilisateur de ses droits. Une décision d'autorisation ne s'adosse pas à une jointure
 * d'affichage.
 */
export function roleOf(rows: MembershipRow[], userId: string): Role | null {
  return rows.find((m) => m.user_id === userId)?.role ?? null
}
