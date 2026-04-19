export interface UnusualOptionsFlow {
  symbol: string
  expiry: string        // 'YYYY-MM-DD'
  strike: number
  type: 'call' | 'put'
  volume: number
  openInterest: number
  volumeRatio: number   // volume / openInterest
  premiumUsd: number    // total premium in dollars
  timestamp: string     // ISO 8601
}

export interface ShortInterest {
  symbol: string
  shortFloat: number          // e.g. 0.042 = 4.2%
  shortFloatPrevWeek: number
  changeVsPrevWeek: number    // signed delta
  updatedAt: string           // ISO 8601
}

export interface DarkPoolPrint {
  symbol: string
  price: number
  size: number        // shares
  notionalUsd: number
  timestamp: string   // ISO 8601
  exchange: string
}

export interface InstitutionalData {
  unusualOptions: UnusualOptionsFlow[] | null
  shortInterest: ShortInterest | null
  darkPool: DarkPoolPrint[] | null
}
