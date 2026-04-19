import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getInstitutionalData } from '@/services/institutionalData'

const paramsSchema = z.object({
  symbol: z.string().min(1).max(10).regex(/^[A-Z]+$/i),
})

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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
