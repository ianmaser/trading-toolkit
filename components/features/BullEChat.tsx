'use client'

import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { MessageCircle, X, Send } from 'lucide-react'

// Placeholder — full implementation in Phase 6 (Prompt 15)
// Wires to /api/chat via Vercel AI SDK useChat with streaming,
// rate limit 429 handling, and context injection.
export function BullEChat() {
  const { bullEOpen, setBullEOpen } = useAppStore()

  return (
    <>
      {/* FAB trigger */}
      <Button
        onClick={() => setBullEOpen(!bullEOpen)}
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
        aria-label={bullEOpen ? 'Close BULL-E chat' : 'Open BULL-E chat'}
      >
        {bullEOpen ? (
          <X className="h-5 w-5" aria-hidden="true" />
        ) : (
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        )}
      </Button>

      {/* Sliding drawer */}
      <div
        className={cn(
          'fixed bottom-24 right-6 z-50 w-80 rounded-xl border border-border bg-card shadow-xl transition-all duration-200 overflow-hidden',
          bullEOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        aria-hidden={!bullEOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold">BULL-E</p>
            <p className="text-xs text-muted-foreground">AI trading analyst</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setBullEOpen(false)}
            aria-label="Close chat"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Message area — populated in Phase 6 */}
        <div className="h-72 flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground text-center">
            BULL-E is coming in Phase 6.<br />
            Full streaming chat with context injection.
          </p>
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 p-3 border-t border-border">
          <Input
            disabled
            placeholder="Ask BULL-E anything…"
            aria-label="Chat input"
            className="h-9 text-sm"
          />
          <Button size="icon" disabled className="h-9 w-9 shrink-0" aria-label="Send message">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </>
  )
}
