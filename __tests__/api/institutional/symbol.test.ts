import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mock service ─────────────────────────────────────────────────────────────

const mockGetInstitutionalData = vi.fn()

vi.mock('@/services/institutionalData', () => ({
  getInstitutionalData: mockGetInstitutionalData,
}))

const { GET } = await import('@/app/api/institutional/[symbol]/route')

// ─── Helpers ─────────────────────────────────────────────────────────────────

function req(symbol?: string): [NextRequest, { params: Promise<{ symbol: string }> }] {
  return [
    new NextRequest(`http://localhost/api/institutional/${symbol ?? ''}`),
    { params: Promise.resolve({ symbol: symbol ?? '' }) },
  ]
}

const mockData = {
  unusualOptions: [],
  shortInterest: null,
  darkPool: null,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/institutional/[symbol]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with institutional data for a valid symbol', async () => {
    mockGetInstitutionalData.mockResolvedValue(mockData)

    const res = await GET(...req('AAPL'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(mockData)
  })

  it('returns 400 for a symbol with invalid characters', async () => {
    const res = await GET(...req('AA PL'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a symbol that exceeds 10 characters', async () => {
    const res = await GET(...req('TOOLONGSYMB'))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an empty symbol', async () => {
    const res = await GET(...req(''))
    expect(res.status).toBe(400)
  })

  it('returns 500 for unexpected service errors', async () => {
    mockGetInstitutionalData.mockRejectedValue(new Error('Redis exploded'))

    const res = await GET(...req('AAPL'))
    expect(res.status).toBe(500)
  })

  it('passes the symbol to getInstitutionalData', async () => {
    mockGetInstitutionalData.mockResolvedValue(mockData)

    await GET(...req('NVDA'))

    expect(mockGetInstitutionalData).toHaveBeenCalledWith('NVDA')
  })

  it('returns null fields when all providers are unavailable', async () => {
    mockGetInstitutionalData.mockResolvedValue({
      unusualOptions: null,
      shortInterest: null,
      darkPool: null,
    })

    const res = await GET(...req('TSLA'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.unusualOptions).toBeNull()
    expect(body.shortInterest).toBeNull()
    expect(body.darkPool).toBeNull()
  })
})
