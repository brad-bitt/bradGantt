import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { resolveAuthRedirect } from '@/lib/auth/redirect'

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const target = resolveAuthRedirect(request.nextUrl.pathname + request.nextUrl.search, !!user)
  if (target) return NextResponse.redirect(new URL(target, request.url))
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
