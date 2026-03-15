/**
 * swapManager.js
 * Token swap simulation for Sentient Treasury.
 *
 * Disclosure: Swaps are simulated for demo purposes.
 * In production, this would integrate with a DEX (Uniswap, 1inch, etc.)
 * via WDK for real on-chain token swaps.
 *
 * Supports: ETH, USDT, USDC, DAI, WBTC
 */

// Simulated token prices in USD (fluctuate slightly to feel real)
const BASE_PRICES = {
  ETH:  2450,
  USDT: 1.00,
  USDC: 1.00,
  DAI:  1.00,
  WBTC: 67500
}

// Simulated token balances (in-memory)
const tokenBalances = {
  ETH:  0,      // Will be synced from real wallet
  USDT: 1000,
  USDC: 0,
  DAI:  0,
  WBTC: 0
}

// Swap history
const swapHistory = []

/**
 * Get current simulated price for a token (with small random variance).
 */
function getPrice(token) {
  const base = BASE_PRICES[token]
  if (!base) throw new Error(`Unknown token: ${token}`)
  const variance = (Math.random() - 0.5) * base * 0.005 // ±0.25%
  return parseFloat((base + variance).toFixed(4))
}

/**
 * Get a swap quote (preview before executing).
 */
export function getSwapQuote(fromToken, toToken, amount) {
  if (!BASE_PRICES[fromToken]) throw new Error(`Unknown token: ${fromToken}`)
  if (!BASE_PRICES[toToken]) throw new Error(`Unknown token: ${toToken}`)
  if (amount <= 0) throw new Error('Amount must be positive')

  const fromPrice = getPrice(fromToken)
  const toPrice = getPrice(toToken)
  const usdValue = amount * fromPrice
  const outputAmount = usdValue / toPrice

  // Simulated 0.3% swap fee (like Uniswap)
  const fee = outputAmount * 0.003
  const outputAfterFee = outputAmount - fee

  // Simulated price impact (higher for larger swaps)
  const priceImpact = Math.min(amount * fromPrice / 1000000 * 100, 5) // max 5%

  return {
    fromToken,
    toToken,
    inputAmount: amount,
    outputAmount: parseFloat(outputAfterFee.toFixed(6)),
    rate: parseFloat((outputAfterFee / amount).toFixed(6)),
    fee: parseFloat(fee.toFixed(6)),
    feePercent: 0.3,
    priceImpact: parseFloat(priceImpact.toFixed(2)),
    fromPrice,
    toPrice,
    usdValue: parseFloat(usdValue.toFixed(2))
  }
}

/**
 * Execute a swap (simulated).
 */
export function executeSwap(fromToken, toToken, amount) {
  const quote = getSwapQuote(fromToken, toToken, amount)

  // Check balance
  if (tokenBalances[fromToken] < amount) {
    throw new Error(`Insufficient ${fromToken} balance. Have: ${tokenBalances[fromToken]}, Need: ${amount}`)
  }

  // Execute
  tokenBalances[fromToken] -= amount
  tokenBalances[toToken] += quote.outputAmount

  const record = {
    ...quote,
    timestamp: new Date().toISOString(),
    status: 'completed',
    txHash: 'swap-' + Date.now()
  }
  swapHistory.unshift(record)
  if (swapHistory.length > 50) swapHistory.pop()

  console.log(`[Swap] ${amount} ${fromToken} → ${quote.outputAmount} ${toToken} (rate: ${quote.rate})`)

  return record
}

/**
 * Get all token balances.
 */
export function getTokenBalances() {
  return { ...tokenBalances }
}

/**
 * Sync ETH balance from real wallet.
 */
export function syncEthBalance(realEthBalance) {
  tokenBalances.ETH = parseFloat(realEthBalance)
}

/**
 * Get swap history.
 */
export function getSwapHistory() {
  return swapHistory
}

/**
 * Get supported tokens with current prices.
 */
export function getSupportedTokens() {
  return Object.entries(BASE_PRICES).map(([symbol, base]) => ({
    symbol,
    price: getPrice(symbol),
    balance: tokenBalances[symbol]
  }))
}
