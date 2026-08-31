import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export default function Home() {
  return (
    <main className="p-10 space-y-6">
      <h1 className="text-5xl">BradGantt</h1>
      <div className="flex gap-4">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
      <div className="flex gap-2"><Badge>owner</Badge><Badge color="blue">editor</Badge><Badge color="pink">viewer</Badge></div>
    </main>
  )
}
