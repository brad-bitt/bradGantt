import { createClient } from '@/lib/supabase/server'
import { requireUser } from '@/lib/auth/require-user'
import { AppHeader } from '@/components/layout/AppHeader'
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
      <div className="min-h-screen flex flex-col">
        <AppHeader />
        <div className="flex-1">{children}</div>
      </div>
    </ProfileProvider>
  )
}
