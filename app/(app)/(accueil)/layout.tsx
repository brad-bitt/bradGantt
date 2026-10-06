import { AppHeader } from '@/components/layout/AppHeader'

/** Hors projet : la marque et le compte, rien d'autre. */
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader />
      <div className="flex-1">{children}</div>
    </>
  )
}
