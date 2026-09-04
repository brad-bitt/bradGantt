import { randomBytes } from 'node:crypto'

/** 32 octets aléatoires en base64url : 43 caractères, sans caractère à échapper dans une URL. */
export function newInviteToken(): string {
  return randomBytes(32).toString('base64url')
}
