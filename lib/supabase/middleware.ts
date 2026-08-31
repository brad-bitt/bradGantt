import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data: { user } } = await supabase.auth.getUser()
  return { response, user }
}

// updateSession() reconstruit `response` précisément pour y reposer les cookies quand
// getUser() a fait tourner le jeton de rafraîchissement. Une redirection construite à
// partir de zéro (NextResponse.redirect(...)) n'hérite d'aucun de ces cookies : il faut
// les recopier explicitement dessus avant de la renvoyer, sous peine de jeter le
// rafraîchissement de session à chaque redirection (/, /login avec session, /projects
// sans session).
export function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie))
  return to
}
