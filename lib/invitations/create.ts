import { addedEmail, invitationEmail } from './emails'
import { INVITE_ROLES, type CreateInvitationResult, type InvitationDb, type InviteRole, type Mailer } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function isValidEmail(s: string): boolean { return EMAIL_RE.test(s) }
export function normalizeEmail(s: string): string { return s.trim().toLowerCase() }

export interface CreateInvitationDeps {
  db: InvitationDb
  mailer: Mailer
  baseUrl: string
  inviterName: string
  newToken: () => string
}

/** Entrées non fiables : elles viennent telles quelles du corps d'une requête HTTP. */
export interface CreateInvitationInput { projectId: unknown; email: unknown; role: unknown }

/**
 * Inviter quelqu'un, en deux chemins selon qu'il a déjà un compte ou non :
 * - compte existant → il devient membre immédiatement, et reçoit un email « tu as été ajouté » ;
 * - compte inconnu → une invitation à token est enregistrée et il reçoit un lien à accepter.
 *
 * La fonction ne connaît ni Supabase ni Resend : elle reçoit un `InvitationDb` et un `Mailer`.
 * C'est ce qui permet de tenir ici les six refus (email, rôle, projet, droits, déjà membre,
 * invitation en attente) sans base de données, là où une route HTTP les rendrait coûteux à
 * couvrir.
 */
export async function createInvitation(deps: CreateInvitationDeps, input: CreateInvitationInput): Promise<CreateInvitationResult> {
  const { db, mailer, baseUrl, inviterName, newToken } = deps

  if (typeof input.email !== 'string' || !isValidEmail(input.email.trim())) return { ok: false, status: 400, error: 'Adresse email invalide' }
  if (typeof input.role !== 'string' || !INVITE_ROLES.includes(input.role as InviteRole)) return { ok: false, status: 400, error: 'Rôle invalide' }
  if (typeof input.projectId !== 'string' || input.projectId.length === 0) return { ok: false, status: 404, error: 'Projet introuvable' }

  const projectId = input.projectId
  const email = normalizeEmail(input.email)
  const role = input.role as InviteRole

  // `getMyRole` retourne null aussi bien pour un projet inexistant que pour un projet dont on
  // n'est pas membre : les deux répondent « introuvable », pour ne pas révéler l'existence d'un
  // projet auquel on n'a pas accès.
  const myRole = await db.getMyRole(projectId)
  if (myRole === null) return { ok: false, status: 404, error: 'Projet introuvable' }
  if (myRole !== 'owner') return { ok: false, status: 403, error: 'Seul le propriétaire peut inviter' }
  const projectName = (await db.getProjectName(projectId)) ?? 'BradGantt'

  // L'email est un effet de bord, pas la transaction : l'invité est ajouté (ou l'invitation
  // enregistrée) même si l'envoi échoue. Échouer ici obligerait l'owner à réinviter quelqu'un
  // qui est déjà membre — et se heurterait alors à « déjà membre ».
  const sendQuietly = async (to: string, m: { subject: string; html: string; text: string }) => {
    try { await mailer.send({ to, ...m }) } catch (e) { console.error('[invitations] envoi email échoué', e) }
  }

  const existingUserId = await db.findProfileIdByEmail(email)
  if (existingUserId) {
    if (await db.isMember(projectId, existingUserId)) return { ok: false, status: 400, error: 'Cette personne est déjà membre' }
    await db.addMember(projectId, existingUserId, role)
    const projectUrl = `${baseUrl}/projects/${projectId}`
    await sendQuietly(email, addedEmail({ projectName, inviterName, projectUrl, role }))
    return { ok: true, kind: 'added', projectUrl }
  }

  if (await db.hasPendingInvitation(projectId, email)) return { ok: false, status: 400, error: 'Une invitation est déjà en attente pour cette adresse' }
  const token = newToken()
  await db.insertInvitation({ projectId, email, role, token })
  const inviteUrl = `${baseUrl}/invite/${token}`
  await sendQuietly(email, invitationEmail({ projectName, inviterName, inviteUrl, role }))
  return { ok: true, kind: 'invited', inviteUrl }
}
