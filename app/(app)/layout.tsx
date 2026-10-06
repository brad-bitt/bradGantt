import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { ProfileProvider } from '@/components/layout/ProfileProvider'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('display_name, color, avatar_url').eq('id', user.id).single()

  return (
    <ProfileProvider
      profile={{
        displayName: profile?.display_name ?? user.email ?? '',
        email: user.email ?? '',
        color: profile?.color ?? '#FFD500',
        avatarUrl: profile?.avatar_url ?? null,
      }}
    >
      {/* Pas d'en-tête ici : chaque groupe de routes porte le sien (liste, ou projet). */}
      <div className="min-h-screen flex flex-col">{children}</div>
    </ProfileProvider>
  )
}
