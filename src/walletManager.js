/**
 * walletManager.js
 * Handles all WDK wallet operations using the correct API from @tetherto/wdk + @tetherto/wdk-wallet-evm.
 *
 * Real API (from official docs):
 * - new WDK(seedPhrase).registerWallet('ethereum', WalletManagerEvm, config)
 * - wdk.getAccount('ethereum', 0) → account
 * - account.getAddress()
 * - account.getBalance()
 * - account.sendTransaction({ to, value })
 *
 * Now integrates with tokenManager for USDt balance checking.
 */

import WDK from '@tetherto/wdk'
import WalletManagerEvm from '@tetherto/wdk-wallet-evm'
import { generateMnemonic } from 'bip39'
import { checkUsdtBalance, getSimulatedUSDT, adjustSimulatedUSDT as _adjustUSDT } from './tokenManager.js'

// Base Sepolia testnet — L2 with very cheap gas
const BASE_SEPOLIA_RPC = 'https://sepolia.base.org'
const EXPLORER_URL = 'https://sepolia.basescan.org'

let wdk = null
let account = null
let walletAddress = null
const transactionHistory = []

/**
 * Initialize WDK wallet.
 * If no seed phrase provided, generates a new one automatically.
 */
export async function initWallet(seedPhrase = null) {
  const seed = seedPhrase || generateMnemonic()

  if (!seedPhrase) {
    console.log('[Wallet] No seed phrase found — generating new wallet...')
    console.log('[Wallet] ⚠️  Save this seed phrase:', seed)
    console.log('[Wallet] ⚠️  Add it to .env as WALLET_SEED_PHRASE to reuse this wallet')
  }

  // Correct WDK API: new WDK(seed).registerWallet(chain, Module, config)
  wdk = new WDK(seed)
    .registerWallet('ethereum', WalletManagerEvm, {
      provider: BASE_SEPOLIA_RPC,
      transferMaxFee: 100_000_000_000_000
    })

  account = await wdk.getAccount('ethereum', 0)
  walletAddress = await account.getAddress()

  console.log(`[Wallet] ✅ Initialized on Base Sepolia. Address: ${walletAddress}`)
  console.log(`[Wallet] Explorer: ${EXPLORER_URL}/address/${walletAddress}`)

  // Check USDt balance on-chain
  const usdtBalance = await checkUsdtBalance(walletAddress)
  console.log(`[Wallet] USDt on-chain: ${usdtBalance.formatted} (${usdtBalance.source})`)

  return walletAddress
}

/**
 * Get current balances including USDt.
 */
export async function getBalance() {
  if (!account) throw new Error('Wallet not initialized')

  const ethBalanceWei = await account.getBalance()
  const ethFormatted = (Number(ethBalanceWei) / 1e18).toFixed(4)

  // Check real USDt balance
  let usdtOnChain = { formatted: '0.00', source: 'not-checked' }
  if (walletAddress) {
    usdtOnChain = await checkUsdtBalance(walletAddress)
  }

  return {
    address: walletAddress,
    eth: ethFormatted,
    usdt: getSimulatedUSDT(),
    usdtOnChain: usdtOnChain.formatted,
    usdtSource: usdtOnChain.source,
    usdtContract: usdtOnChain.contract || null
  }
}

/**
 * Send a real ETH transaction on Sepolia testnet.
 */
export async function sendTransaction(toAddress, amountEth) {
  if (!account) throw new Error('Wallet not initialized')

  const valueWei = BigInt(Math.floor(amountEth * 1e18))

  console.log(`[Wallet] Sending ${amountEth} ETH on Base Sepolia to ${toAddress}...`)

  const { hash, fee } = await account.sendTransaction({
    to: toAddress,
    value: valueWei
  })

  console.log(`[Wallet] ✅ Transaction: ${EXPLORER_URL}/tx/${hash}`)

  const txRecord = { hash, fee: fee?.toString(), to: toAddress, amount: amountEth, network: 'base-sepolia', timestamp: new Date().toISOString() }
  transactionHistory.unshift(txRecord)

  return txRecord
}

export function getAddress() {
  return walletAddress
}

export function getTransactionHistory() {
  return transactionHistory
}

// Re-export simulated USDT functions from tokenManager
export function adjustSimulatedUSDT(amount) {
  _adjustUSDT(amount)
}
