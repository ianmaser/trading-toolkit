import TickerPageClient from './TickerPageClient'

interface TickerPageProps {
  params: Promise<{ symbol: string }>
}

export default async function TickerPage({ params }: TickerPageProps) {
  const { symbol } = await params
  return <TickerPageClient symbol={symbol.toUpperCase()} />
}
