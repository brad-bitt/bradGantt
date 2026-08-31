import { notFound } from 'next/navigation'
import { E2ELoginForm } from './E2ELoginForm'
import { isE2EEnabled } from '@/lib/e2e'

// Aucune API dynamique n'est lue ici (pas de cookies()/headers()/searchParams) :
// sans ce flag, Next.js pourrait pré-rendre la page statiquement et figer la
// décision de garde au moment du build, malgré `E2E_ENABLED` lu au runtime.
export const dynamic = 'force-dynamic'

export default function E2ELoginPage() {
  if (!isE2EEnabled(process.env)) notFound()
  return <main className="p-8 max-w-sm"><h1 className="text-2xl mb-4">Login E2E</h1><E2ELoginForm /></main>
}
