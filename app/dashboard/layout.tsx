import { Sidebar } from '@/components/features/Sidebar'
import { TopBar } from '@/components/features/TopBar'
import { BullEChat } from '@/components/features/BullEChat'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <TopBar />

      {/* Main content — offset for fixed sidebar (64px) and top bar (56px) */}
      <main className="ml-16 pt-14 min-h-screen">
        <div className="p-6">
          {children}
        </div>
      </main>

      <BullEChat />
    </div>
  )
}
