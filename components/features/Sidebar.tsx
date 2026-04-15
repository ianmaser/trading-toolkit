'use client'

import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart2,
  BookOpen,
  Home,
  LineChart,
  Settings,
  Star,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',             icon: Home,      label: 'Daily Brief'  },
  { href: '/dashboard/watchlist',   icon: Star,      label: 'Watchlist'    },
  { href: '/dashboard/backtest',    icon: BarChart2, label: 'Backtest Lab' },
  { href: '/dashboard/journal',     icon: BookOpen,  label: 'Journal'      },
  { href: '/dashboard/performance', icon: LineChart, label: 'Performance'  },
  { href: '/dashboard/settings',    icon: Settings,  label: 'Settings'     },
]

export function Sidebar() {
  const { sidebarExpanded, setSidebarExpanded } = useAppStore()
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full z-40 flex flex-col bg-card border-r border-border transition-all duration-200 overflow-hidden',
        sidebarExpanded ? 'w-60' : 'w-16'
      )}
      onMouseEnter={() => setSidebarExpanded(true)}
      onMouseLeave={() => setSidebarExpanded(false)}
    >
      {/* Logo space — matches top bar height */}
      <div className="h-14 flex items-center px-4 shrink-0">
        <span className="font-bold text-lg tracking-tight">
          {sidebarExpanded ? 'EDGE' : 'E'}
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              {sidebarExpanded && <span className="truncate">{label}</span>}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
