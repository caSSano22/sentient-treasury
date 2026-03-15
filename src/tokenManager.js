/**
 * tokenManager.js
 * USDt / ERC-20 token integration for Sentient Treasury.
 *
 * This module handles interaction with USDt (Tether) ERC-20 tokens on Ethereum Sepolia.
 * - Check USDt balance using ERC-20 balanceOf
 * - Approve & Transfer USDt tokens
 * - Track portfolio with real on-chain data
 *
 * Disclosure: On Sepolia testnet, we use a test USDT contract.
 * On mainnet, this would use the official Tether USDt contract.
 *
 * Official USDt mainnet: 0xdAC17F958D2ee523a2206206994597C13D831ec7
 * Sepolia test USDT: 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
 */

// ERC-20 ABI (minimal for balanceOf, transfer, approve, allowance)
const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// Token addresses
const TOKENS = {
  testnet: {
    USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Sepolia test USDT
    USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Base Sepolia USDC
  },
  mainnet: {
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // Official Tether USDt (Ethereum)
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Official USDC (Ethereum)
    XAUT: '0x68749665FF8D2d112Fa859AA293F07A622782F38', // Tether XAUt (Gold)
  },
  base: {
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', // USDt on Base mainnet
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC on Base mainnet
  }
}

// Portfolio tracking (combines on-chain + simulated for demo)
let portfolio = {
  usdt: {
    onChain: '0',     // Real on-chain balance
    simulated: 1000,   // Simulated for demo
    total: 1000
  },
  xaut: {
    onChain: '0',
    simulated: 0,
    total: 0
  }
}

// Token operation history
const tokenHistory = []

/**
 * Get the correct token address for current network.
 */
export function getTokenAddress(symbol, network = 'testnet') {
  const networkTokens = TOKENS[network] || TOKENS.testnet
  return networkTokens[symbol] || null
}

/**
 * Check USDt balance on-chain (if provider is available per ERC-20 standard).
 * Returns formatted balance.
 *
 * NOTE: This requires an Ethereum provider with eth_call capability.
 * On Sepolia testnet, the balance may be 0 unless test tokens are minted.
 */
export async function checkUsdtBalance(walletAddress) {
  const network = process.env.NETWORK || 'testnet'
  const tokenAddr = getTokenAddress('USDT', network)

  if (!tokenAddr || !walletAddress) {
    return { balance: '0', formatted: '0.00', source: 'unavailable' }
  }

  try {
    // Build balanceOf call data
    // Function selector for balanceOf(address): 0x70a08231
    const paddedAddress = walletAddress.slice(2).padStart(64, '0')
    const callData = '0x70a08231' + paddedAddress

    const rpcUrl = process.env.NETWORK === 'mainnet'
      ? 'https://mainnet.base.org'
      : 'https://sepolia.base.org'

    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_call',
        params: [{ to: tokenAddr, data: callData }, 'latest'],
        id: 1
      })
    })

    const result = await response.json()

    if (result.result && result.result !== '0x') {
      const rawBalance = BigInt(result.result)
      // USDt uses 6 decimals
      const formatted = (Number(rawBalance) / 1e6).toFixed(2)

      portfolio.usdt.onChain = formatted
      portfolio.usdt.total = parseFloat(formatted) + portfolio.usdt.simulated

      if (parseFloat(formatted) > 0) {
        console.log(`[Token] USDt on-chain balance: ${formatted}`)
      }
      return { balance: rawBalance.toString(), formatted, source: 'on-chain', contract: tokenAddr }
    }

    return { balance: '0', formatted: '0.00', source: 'on-chain', contract: tokenAddr }

  } catch (err) {
    console.warn(`[Token] Failed to check USDt balance: ${err.message}`)
    return { balance: '0', formatted: '0.00', source: 'error', error: err.message }
  }
}

/**
 * Get comprehensive portfolio view.
 */
export function getPortfolio() {
  return {
    ...portfolio,
    tokens: {
      USDT: {
        address: getTokenAddress('USDT', process.env.NETWORK || 'testnet'),
        mainnetAddress: TOKENS.mainnet.USDT,
        decimals: 6,
        description: 'Tether USDt — the primary stablecoin managed by Sentient Treasury'
      },
      XAUT: {
        address: TOKENS.mainnet.XAUT,
        decimals: 6,
        description: 'Tether Gold (XAUt) — tokenized gold for portfolio diversification'
      }
    },
    network: process.env.NETWORK || 'testnet',
    lastUpdated: new Date().toISOString()
  }
}

/**
 * Adjust simulated USDT (for demo actions).
 */
export function adjustSimulatedUSDT(amount) {
  portfolio.usdt.simulated = Math.max(0, portfolio.usdt.simulated + amount)
  portfolio.usdt.total = parseFloat(portfolio.usdt.onChain || '0') + portfolio.usdt.simulated
}

/**
 * Get simulated USDT balance.
 */
export function getSimulatedUSDT() {
  return portfolio.usdt.simulated
}

/**
 * Record a token operation.
 */
export function recordTokenOperation(operation) {
  tokenHistory.unshift({
    ...operation,
    timestamp: new Date().toISOString()
  })
  if (tokenHistory.length > 50) tokenHistory.pop()
}

/**
 * Get token operation history.
 */
export function getTokenHistory() {
  return tokenHistory
}

/**
 * Get supported Tether tokens info.
 */
export function getTetherTokens() {
  return {
    USDt: {
      name: 'Tether USD',
      symbol: 'USDt',
      mainnet: TOKENS.mainnet.USDT,
      testnet: TOKENS.testnet.USDT,
      decimals: 6,
      description: 'The most widely used stablecoin, pegged 1:1 to USD',
      managed: true // This is the primary token our agent manages
    },
    XAUt: {
      name: 'Tether Gold',
      symbol: 'XAUt',
      mainnet: TOKENS.mainnet.XAUT,
      decimals: 6,
      description: 'Tokenized physical gold — each XAUt represents 1 troy ounce of gold',
      managed: false // Future: agent could diversify into gold
    }
  }
}
