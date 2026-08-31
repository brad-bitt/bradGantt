import { notFound } from 'next/navigation'
import { E2ELoginForm } from './E2ELoginForm'

export default function E2ELoginPage() {
  if (process.env.NEXT_PUBLIC_E2E !== '1') notFound()
  return <main className="p-8 max-w-sm"><h1 className="text-2xl mb-4">Login E2E</h1><E2ELoginForm /></main>
}
