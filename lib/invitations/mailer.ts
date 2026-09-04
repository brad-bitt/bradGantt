import { Resend } from 'resend'
import type { Mailer } from './types'

const FROM = process.env.EMAIL_FROM ?? 'BradGantt <onboarding@resend.dev>'

/**
 * Sans `RESEND_API_KEY`, les emails partent dans la console plutôt que nulle part : en local et
 * en test, le lien d'invitation reste lisible et le flux complet reste jouable sans compte
 * Resend ni adresse vérifiée.
 */
export function createMailer(): Mailer {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    return {
      async send(m) {
        console.info(`[mailer:console] → ${m.to} | ${m.subject}\n${m.text}`)
      },
    }
  }
  const resend = new Resend(key)
  return {
    async send(m) {
      const { error } = await resend.emails.send({ from: FROM, to: m.to, subject: m.subject, html: m.html, text: m.text })
      if (error) throw new Error(error.message)
    },
  }
}
