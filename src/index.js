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

// ===== ANSI Color Helpers =====
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  bgCyan: '\x1b[46m',
  bgGreen: '\x1b[42m',
  bgMagenta: '\x1b[45m',
}

function line(char = '─', len = 56) { return c.dim + char.repeat(len) + c.reset }
function box(text) {
  const pad = Math.max(0, 54 - text.length)
  return `${c.dim}│${c.reset} ${text}${' '.repeat(pad)} ${c.dim}│${c.reset}`
}

async function boot() {
  console.log('')
  console.log(`  ${c.dim}╭${'─'.repeat(56)}╮${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.bold}${c.cyan}⬡  SENTIENT TREASURY${c.reset}                                ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}Autonomous AI Agent for DeFi Capital Management${c.reset}     ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}Network:${c.reset}  ${c.yellow}Base Sepolia${c.reset}  ${c.dim}│${c.reset}  ${c.dim}Agent:${c.reset}  ${c.green}Every ${INTERVAL}m${c.reset}          ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}AI:${c.reset}       ${c.magenta}${(process.env.AI_PROVIDER || 'openai')}${c.reset}       ${c.dim}│${c.reset}  ${c.dim}Model:${c.reset}  ${c.magenta}${process.env.AI_MODEL || 'default'}${c.reset}          ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}╰${'─'.repeat(56)}╯${c.reset}`)
  console.log('')

  // Step 1: Initialize WDK wallet
  process.stdout.write(`  ${c.yellow}◆${c.reset} ${c.bold}Wallet${c.reset}  ${c.dim}Initializing WDK wallet...${c.reset}`)
  try {
    const address = await initWallet(process.env.WALLET_SEED_PHRASE || null)
    console.log(`\r  ${c.green}✔${c.reset} ${c.bold}Wallet${c.reset}  ${c.green}${address.slice(0, 6)}...${address.slice(-4)}${c.reset}  ${c.dim}on Base Sepolia${c.reset}`)
  } catch (err) {
    console.log(`\r  ${c.red}✘${c.reset} ${c.bold}Wallet${c.reset}  ${c.red}Init failed${c.reset} ${c.dim}(demo mode)${c.reset}`)
    console.log(`  ${c.dim}  └─ ${err.message}${c.reset}`)
  }

  // Step 2: Start dashboard server
  process.stdout.write(`  ${c.yellow}◆${c.reset} ${c.bold}Server${c.reset}  ${c.dim}Starting dashboard...${c.reset}`)
  startServer(PORT)
  console.log(`\r  ${c.green}✔${c.reset} ${c.bold}Server${c.reset}  ${c.cyan}http://localhost:${PORT}${c.reset}`)

  // Step 3: Run first cycle
  console.log(`  ${c.yellow}◆${c.reset} ${c.bold}Agent${c.reset}   ${c.dim}Running initial cycle...${c.reset}`)
  console.log('')
  await runCycle()

  // Step 4: Schedule agent loop
  const cronExpression = `*/${INTERVAL} * * * *`
  cron.schedule(cronExpression, async () => {
    await runCycle()
  })

  console.log('')
  console.log(`  ${c.dim}╭${'─'.repeat(56)}╮${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.green}${c.bold}●  SENTIENT TREASURY IS LIVE${c.reset}                          ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}Dashboard${c.reset}  ${c.cyan}${c.bold}http://localhost:${PORT}${c.reset}                      ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}Schedule${c.reset}   Every ${c.green}${INTERVAL} minute(s)${c.reset} autonomously           ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}   ${c.dim}Provider${c.reset}   ${c.magenta}${process.env.AI_PROVIDER || 'openai'}${c.reset}                              ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}│${c.reset}                                                        ${c.dim}│${c.reset}`)
  console.log(`  ${c.dim}╰${'─'.repeat(56)}╯${c.reset}`)
  console.log('')
}

boot().catch(err => {
  console.error(`\n  ${c.red}✘ Fatal error:${c.reset} ${err.message}`)
  process.exit(1)
})
