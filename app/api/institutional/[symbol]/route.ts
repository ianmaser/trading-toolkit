// Next.js Route Handler — GET /api/institutional/[symbol]
// The brackets in the directory name ([symbol]) create a dynamic route segment.
// Any path like /api/institutional/AAPL or /api/institutional/MSFT matches this file,
// and "AAPL" / "MSFT" is available as params.symbol inside the handler.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getInstitutionalData } from '@/services/institutionalData'

const paramsSchema = z.object({
  // Regex ensures the symbol contains only letters — prevents path traversal
  // or injection attempts via the URL parameter.
  symbol: z.string().min(1).max(10).regex(/^[A-Z]+$/i),
})

// In Next.js 15, dynamic route params are passed as a Promise — they must be awaited.
// This is a breaking change from Next.js 14 where params was a plain object.
// `_req` is prefixed with an underscore to signal it's unused — TypeScript/ESLint
// conventions treat underscore-prefixed params as intentionally ignored.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const parsed = paramsSchema.safeParse(await params)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 })
  }

  try {
    const data = await getInstitutionalData(parsed.data.symbol)
    return NextResponse.json(data)
  } catch {
    // getInstitutionalData almost never throws — it returns null fields on provider
    // failure rather than throwing. This catch exists as a last-resort safety net.
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
