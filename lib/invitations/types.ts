export type InviteRole = 'editor' | 'viewer'
export const INVITE_ROLES: InviteRole[] = ['editor', 'viewer']
export const ROLE_LABEL: Record<InviteRole, string> = { editor: 'éditeur', viewer: 'lecteur' }

export interface PendingInvitation { id: string; email: string; role: InviteRole; createdAt: string }

export interface MailMessage { to: string; subject: string; html: string; text: string }
export interface Mailer { send(message: MailMessage): Promise<void> }

/**
 * Tout ce dont `createInvitation` a besoin de la base, et rien de plus. L'interface existe pour
 * que la logique d'invitation se teste sans Postgres : l'implémentation Supabase (tâche 4) et le
 * double de test satisfont le même contrat.
 */
export interface InvitationDb {
  getMyRole(projectId: string): Promise<'owner' | 'editor' | 'viewer' | null>
  getProjectName(projectId: string): Promise<string | null>
  findProfileIdByEmail(email: string): Promise<string | null>
  isMember(projectId: string, userId: string): Promise<boolean>
  addMember(projectId: string, userId: string, role: InviteRole): Promise<void>
  hasPendingInvitation(projectId: string, email: string): Promise<boolean>
  insertInvitation(inv: { projectId: string; email: string; role: InviteRole; token: string }): Promise<void>
}

export type CreateInvitationResult =
  | { ok: true; kind: 'added'; projectUrl: string }
  | { ok: true; kind: 'invited'; inviteUrl: string }
  | { ok: false; status: 400 | 403 | 404; error: string }
