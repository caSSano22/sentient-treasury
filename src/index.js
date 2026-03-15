/**
 * index.js
 * Main entry point for Sentient Treasury.
 *
 * Boot sequence:
 * 1. Load environment variables
 * 2. Initialize WDK wallet
 * 3. Start Express dashboard server
 * 4. Start autonomous agent loop (runs on schedule)
 */

import 'dotenv/config'
import cron from 'node-cron'
import { initWallet } from './walletManager.js'
import { runCycle } from './agentLoop.js'
import { startServer } from './server.js'

const PORT = process.env.PORT || 3000
const INTERVAL = parseInt(process.env.AGENT_INTERVAL_MINUTES || '1')

async function boot() {
  console.log('='.repeat(50))
  console.log('  SENTIENT TREASURY — Booting...')
  console.log('  Autonomous AI Agent for On-Chain Capital Management')
  console.log('='.repeat(50))

  // Step 1: Initialize WDK wallet
  console.log('\n[Boot] Initializing WDK wallet...')
  try {
    const address = await initWallet(process.env.WALLET_SEED_PHRASE || null)
    console.log(`[Boot] Wallet ready: ${address}`)
  } catch (err) {
    console.warn(`[Boot] WDK wallet init failed (running in demo mode): ${err.message}`)
    console.warn('[Boot] To use real wallet, ensure WDK packages are installed correctly.')
  }

  // Step 2: Start dashboard server
  console.log('\n[Boot] Starting dashboard server...')
  startServer(PORT)

  // Step 3: Run first cycle immediately
  console.log('\n[Boot] Running initial agent cycle...')
  await runCycle()

  // Step 4: Schedule agent loop
  const cronExpression = `*/${INTERVAL} * * * *`
  console.log(`\n[Boot] Agent loop scheduled every ${INTERVAL} minute(s)`)
  console.log(`[Boot] Cron: ${cronExpression}`)

  cron.schedule(cronExpression, async () => {
    await runCycle()
  })

  console.log('\n' + '='.repeat(50))
  console.log(`  Sentient Treasury is LIVE`)
  console.log(`  Dashboard: http://localhost:${PORT}`)
  console.log(`  Agent runs every ${INTERVAL} minute(s) autonomously`)
  console.log('='.repeat(50) + '\n')
}

boot().catch(err => {
  console.error('[Boot] Fatal error:', err)
  process.exit(1)
})
