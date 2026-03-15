/**
 * yieldFetcher.js
 * Provides REAL DeFi yield data from DeFi Llama API for the AI agent to evaluate.
 *
 * Uses the public DeFi Llama Yields API:
 *   https://yields.llama.fi/pools
 *
 * Filters for stablecoin yield opportunities (USDT, USDC, DAI) on Ethereum
 * from major protocols (Aave, Compound, Morpho, Spark, Fluid, etc.)
 *
 * Falls back to cached/simulated data if API is unreachable.
 */

// Target pools we care about: stablecoin yields on Ethereum from reputable protocols
const TARGET_PROTOCOLS = [
  'aave-v3', 'compound-v3', 'morpho-v1', 'spark-savings',
  'sparklend', 'fluid-lending', 'sky-lending', 'ethena-usde',
  'maple', 'ondo-yield-assets'
]

const TARGET_SYMBOLS = ['USDT', 'USDC', 'DAI', 'USDS', 'SUSDS', 'SUSDE', 'PYUSD']
const TARGET_CHAIN = ['Ethereum', 'Base'] // Support both chains

// Track yield history for charts
const yieldHistory = []

// Cache for last successful fetch
let cachedYields = null
let lastFetchTime = 0
const CACHE_TTL_MS = 60_000 // 1 minute cache

/**
 * Fetch REAL yield opportunities from DeFi Llama API.
 * Filters for relevant stablecoin pools on Ethereum.
 */
export async function fetchYields() {
  const now = Date.now()

  // Return cache if fresh
  if (cachedYields && (now - lastFetchTime) < CACHE_TTL_MS) {
    console.log('[Yields] Using cached data (fresh)')
    return cachedYields
  }

  try {
    console.log('[Yields] Fetching REAL data from DeFi Llama...')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000) // 10s timeout

    const response = await fetch('https://yields.llama.fi/pools', {
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`DeFi Llama API returned ${response.status}`)
    }

    const data = await response.json()

    if (!data?.data?.length) {
      throw new Error('Empty response from DeFi Llama')
    }

    // Filter for our target pools (minimum $10M TVL for safety)
    const filtered = data.data.filter(pool => {
      if (!TARGET_CHAIN.includes(pool.chain)) return false
      if (!TARGET_PROTOCOLS.includes(pool.project)) return false
      if (!pool.apy || pool.apy <= 0) return false
      if (!pool.stablecoin) return false
      if ((pool.tvlUsd || 0) < 10_000_000) return false // Min $10M TVL
      // Match symbol (could be USDT, USDC, DAI, etc.)
      const symbolUpper = (pool.symbol || '').toUpperCase()
      return TARGET_SYMBOLS.some(s => symbolUpper.includes(s))
    })

    // Sort by weighted score: APY matters most, but TVL gives a boost
    // This ensures we don't pick tiny pools with inflated APY
    filtered.sort((a, b) => {
      const scoreA = a.apy * (1 + Math.log10(Math.max(a.tvlUsd, 1)) / 20)
      const scoreB = b.apy * (1 + Math.log10(Math.max(b.tvlUsd, 1)) / 20)
      return scoreB - scoreA
    })

    // Take top 8, format for our system
    const yields = filtered.slice(0, 8).map(pool => ({
      name: `${pool.project.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${pool.symbol}`,
      apy: parseFloat(pool.apy.toFixed(2)),
      risk: classifyRisk(pool),
      protocol: pool.project.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      chain: pool.chain,
      tvl: pool.tvlUsd || 0,
      liquidity: pool.tvlUsd || 0,
      stablecoin: pool.stablecoin,
      apyBase: pool.apyBase,
      apyReward: pool.apyReward,
      poolId: pool.pool,
      predictions: pool.predictions,
      apyChange7d: pool.apyPct7D,
      fetchedAt: new Date().toISOString(),
      source: 'defillama' // Mark as real data
    }))

    if (yields.length === 0) {
      console.warn('[Yields] No matching pools found, using fallback')
      return getFallbackYields()
    }

    // Store snapshot for history chart
    yieldHistory.push({
      timestamp: new Date().toISOString(),
      yields: yields.map(y => ({ name: y.name, apy: y.apy })),
      source: 'defillama'
    })
    if (yieldHistory.length > 100) yieldHistory.shift()

    cachedYields = yields
    lastFetchTime = now
    console.log(`[Yields] ✅ Fetched ${yields.length} REAL opportunities. Best: ${yields[0].name} at ${yields[0].apy}%`)
    return yields

  } catch (err) {
    console.error(`[Yields] DeFi Llama fetch failed: ${err.message}`)
    console.log('[Yields] Using fallback data...')

    // Use cached data if available, otherwise fallback
    if (cachedYields) {
      console.log('[Yields] Returning last cached data')
      return cachedYields
    }

    return getFallbackYields()
  }
}

/**
 * Classify risk based on pool metrics.
 */
function classifyRisk(pool) {
  const tvl = pool.tvlUsd || 0
  const protocol = pool.project || ''

  // Trusted, high-TVL protocols = low risk
  const lowRiskProtocols = ['aave-v3', 'compound-v3', 'spark-savings', 'sparklend', 'sky-lending']
  if (lowRiskProtocols.includes(protocol) && tvl > 100_000_000) return 'low'
  if (lowRiskProtocols.includes(protocol)) return 'low'

  // Medium TVL or newer protocols
  if (tvl > 50_000_000) return 'medium'
  if (tvl > 10_000_000) return 'medium'

  return 'high'
}

/**
 * Fallback yield data for when API is unavailable.
 * Clearly marked as fallback data.
 */
function getFallbackYields() {
  const fallback = [
    { name: 'Aave V3 USDT',     apy: 1.69, risk: 'low',    protocol: 'Aave V3',       chain: 'Ethereum', tvl: 1_840_000_000 },
    { name: 'Aave V3 USDC',     apy: 1.83, risk: 'low',    protocol: 'Aave V3',       chain: 'Ethereum', tvl: 1_153_000_000 },
    { name: 'Compound V3 USDC', apy: 2.42, risk: 'low',    protocol: 'Compound V3',   chain: 'Ethereum', tvl: 145_000_000 },
    { name: 'Maple USDT',       apy: 4.08, risk: 'medium', protocol: 'Maple',         chain: 'Ethereum', tvl: 1_939_000_000 },
    { name: 'Spark USDT',       apy: 3.22, risk: 'low',    protocol: 'Spark Savings', chain: 'Ethereum', tvl: 333_000_000 },
    { name: 'Fluid USDT',       apy: 4.32, risk: 'medium', protocol: 'Fluid Lending', chain: 'Ethereum', tvl: 148_000_000 },
  ].map(y => ({
    ...y,
    liquidity: y.tvl,
    stablecoin: true,
    fetchedAt: new Date().toISOString(),
    source: 'fallback' // Clearly marked
  }))

  fallback.sort((a, b) => b.apy - a.apy)

  yieldHistory.push({
    timestamp: new Date().toISOString(),
    yields: fallback.map(y => ({ name: y.name, apy: y.apy })),
    source: 'fallback'
  })
  if (yieldHistory.length > 100) yieldHistory.shift()

  return fallback
}

export function getYieldHistory() {
  return yieldHistory
}

/**
 * Format yields for AI prompt consumption.
 */
export function formatYieldsForPrompt(yields) {
  return yields.map(y =>
    `- ${y.name}: APY ${y.apy}%, Risk: ${y.risk}, TVL: $${(y.tvl / 1_000_000).toFixed(1)}M, Source: ${y.source || 'live'}${y.apyChange7d ? `, 7d change: ${y.apyChange7d > 0 ? '+' : ''}${y.apyChange7d.toFixed(2)}%` : ''}`
  ).join('\n')
}
