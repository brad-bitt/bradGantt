import { ROLE_LABEL, type InviteRole, type MailMessage } from './types'

/**
 * Le nom d'un projet et celui d'un inviteur sont saisis par des utilisateurs et repartent dans
 * un email en HTML : ils sont échappés à l'insertion, pas à la lecture.
 */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function layout(title: string, body: string, cta: { label: string; url: string }): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:32px;background:#F6F3EC;font-family:Arial,sans-serif;color:#2A2622">
<div style="max-width:520px;margin:0 auto;background:#FBF9F4;border:1px solid #DED7C8;border-radius:12px;padding:32px">
<h1 style="margin:0 0 16px;font-size:24px;font-family:Georgia,serif;font-weight:500">${esc(title)}</h1>
<p style="font-size:16px;line-height:1.5">${body}</p>
<p style="margin-top:24px"><a href="${esc(cta.url)}" style="display:inline-block;background:#2A2622;color:#F6F3EC;border-radius:7px;padding:12px 20px;font-weight:600;text-decoration:none">${esc(cta.label)}</a></p>
<p style="font-size:12px;color:#746D62;word-break:break-all">Ou copie ce lien : ${esc(cta.url)}</p>
</div></body></html>`
}

export function invitationEmail(p: { projectName: string; inviterName: string; inviteUrl: string; role: InviteRole }): Omit<MailMessage, 'to'> {
  const role = ROLE_LABEL[p.role]
  return {
    subject: `${p.inviterName} t'invite sur le projet « ${p.projectName} »`,
    html: layout('Invitation', `<strong>${esc(p.inviterName)}</strong> t'invite à rejoindre le projet <strong>${esc(p.projectName)}</strong> sur BradGantt en tant que <strong>${role}</strong>.`, { label: "Accepter l'invitation", url: p.inviteUrl }),
    text: `${p.inviterName} t'invite à rejoindre le projet « ${p.projectName} » sur BradGantt en tant que ${role}.\n\nAccepter : ${p.inviteUrl}`,
  }
}

export function addedEmail(p: { projectName: string; inviterName: string; projectUrl: string; role: InviteRole }): Omit<MailMessage, 'to'> {
  const role = ROLE_LABEL[p.role]
  return {
    subject: `Tu as été ajouté au projet « ${p.projectName} »`,
    html: layout('Bienvenue', `<strong>${esc(p.inviterName)}</strong> t'a ajouté au projet <strong>${esc(p.projectName)}</strong> en tant que <strong>${role}</strong>.`, { label: 'Ouvrir le projet', url: p.projectUrl }),
    text: `${p.inviterName} t'a ajouté au projet « ${p.projectName} » en tant que ${role}.\n\nOuvrir : ${p.projectUrl}`,
  }
}
