'use client'

import { useAppStore } from '@/lib/store'
import { useUser } from '@/hooks/useUser'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function TopBar() {
  const { profile } = useUser()
  const { setActiveTicker } = useAppStore()
  const router = useRouter()
  const [query, setQuery] = useState('')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const symbol = query.trim().toUpperCase()
    if (!symbol) return
    setActiveTicker(symbol)
    router.push(`/dashboard/ticker/${symbol}`)
    setQuery('')
  }

  const initials = profile?.display_name
    ? profile.display_name.slice(0, 2).toUpperCase()
    : '?'

  return (
    <header className="fixed top-0 left-16 right-0 h-14 z-30 flex items-center gap-4 px-6 bg-background border-b border-border">
      <form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search ticker…"
          aria-label="Search ticker"
          className="pl-9 h-9 text-sm"
        />
      </form>

      <div className="ml-auto">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
