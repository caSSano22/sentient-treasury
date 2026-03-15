/**
 * agentLoop.js
 * Orchestrates the full autonomous agent cycle:
 * 1. Check wallet balance
 * 2. Fetch yield opportunities
 * 3. Ask AI for decision
 * 4. Execute transaction if needed
 * 5. Log everything for dashboard
 */

import { getBalance, sendTransaction, adjustSimulatedUSDT } from './walletManager.js'
import { fetchYields } from './yieldFetcher.js'
import { makeDecision, updatePosition, getCurrentPosition } from './aiAgent.js'

// ANSI colors
const c = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m',
  magenta: '\x1b[35m', red: '\x1b[31m', blue: '\x1b[34m', white: '\x1b[37m',
}

// In-memory activity log (shown on dashboard)
const activityLog = []
let cycleCount = 0
let totalYieldEarned = 0

/**
 * Run one full agent cycle.
 */
export async function runCycle() {
  cycleCount++
  const cycleId = `CYCLE-${String(cycleCount).padStart(3, '0')}`
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  console.log(`  ${c.dim}┌─── ${c.reset}${c.cyan}${c.bold}${cycleId}${c.reset} ${c.dim}${'─'.repeat(30)} ${c.yellow}${time}${c.reset} ${c.dim}───┐${c.reset}`)

  const cycleEntry = {
    id: cycleId,
    timestamp: new Date().toISOString(),
    status: 'running',
    steps: []
  }

  try {
    // Step 1: Check wallet
    const balance = await getBalance()
    cycleEntry.steps.push({ step: 'Wallet checked', detail: `$${balance.usdt} USDT, ${balance.eth} ETH` })
    console.log(`  ${c.dim}│${c.reset}  ${c.blue}①${c.reset} ${c.dim}Wallet${c.reset}    ${c.bold}$${balance.usdt}${c.reset} USDT  ${c.dim}·${c.reset}  ${balance.eth} ETH`)

    // Step 2: Fetch yields (real data from DeFi Llama)
    const yields = await fetchYields()
    const best = yields[0]
    const dataSource = best.source || 'unknown'
    cycleEntry.steps.push({ step: 'Yields fetched', detail: `Best: ${best.name} at ${best.apy}% APY (source: ${dataSource})` })
    console.log(`  ${c.dim}│${c.reset}  ${c.blue}②${c.reset} ${c.dim}Yield${c.reset}     ${c.green}${c.bold}${best.apy}%${c.reset} ${c.dim}APY${c.reset}  ${c.dim}·${c.reset}  ${best.name}  ${c.dim}[${dataSource}]${c.reset}`)

    // Step 3: AI decision
    const decision = await makeDecision(balance, yields)
    cycleEntry.steps.push({
      step: `AI decided: ${decision.action}`,
      detail: decision.reasoning,
      confidence: decision.confidence
    })

    const actionColors = { HOLD: c.yellow, DEPOSIT: c.green, WITHDRAW: c.red, REBALANCE: c.magenta }
    const actionColor = actionColors[decision.action] || c.white
    const confBar = '█'.repeat(Math.round((decision.confidence || 0) * 10)) + c.dim + '░'.repeat(10 - Math.round((decision.confidence || 0) * 10)) + c.reset
    console.log(`  ${c.dim}│${c.reset}  ${c.blue}③${c.reset} ${c.dim}AI${c.reset}        ${actionColor}${c.bold}${decision.action}${c.reset}  ${c.dim}confidence${c.reset} ${confBar} ${((decision.confidence || 0) * 100).toFixed(0)}%`)

    // Step 4: Execute if action is not HOLD
    if (decision.action !== 'HOLD' && decision.amount > 0) {
      const demoAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
      let txResult = null

      try {
        txResult = await sendTransaction(demoAddress, 0.0001)
        console.log(`  ${c.dim}│${c.reset}  ${c.blue}④${c.reset} ${c.dim}Execute${c.reset}   ${c.green}✔ TX${c.reset}  ${c.dim}${txResult.hash.slice(0, 16)}...${c.reset}`)
      } catch (txErr) {
        txResult = { hash: 'simulated-' + Date.now(), simulated: true }
        console.log(`  ${c.dim}│${c.reset}  ${c.blue}④${c.reset} ${c.dim}Execute${c.reset}   ${c.yellow}⚡ Simulated${c.reset}  ${c.dim}(no gas)${c.reset}`)
      }

      if (decision.action === 'DEPOSIT') {
        adjustSimulatedUSDT(-decision.amount)
      } else if (decision.action === 'WITHDRAW') {
        const position = getCurrentPosition()
        const earned = position.amount * (position.entryApy / 100) / 365
        adjustSimulatedUSDT(position.amount + earned)
        totalYieldEarned += earned
      }

      updatePosition(decision.action, decision.targetProtocol, decision.amount, best.apy)

      cycleEntry.steps.push({
        step: 'Transaction executed',
        detail: `Hash: ${txResult.hash}`,
        txHash: txResult.hash,
        simulated: txResult.simulated || false
      })
    } else {
      console.log(`  ${c.dim}│${c.reset}  ${c.blue}④${c.reset} ${c.dim}Execute${c.reset}   ${c.dim}— No action (HOLD)${c.reset}`)
      cycleEntry.steps.push({ step: 'No transaction', detail: 'Agent decided to hold' })
    }

    // Show reasoning
    if (decision.reasoning) {
      const short = decision.reasoning.length > 70 ? decision.reasoning.slice(0, 70) + '...' : decision.reasoning
      console.log(`  ${c.dim}│${c.reset}  ${c.dim}💭 ${short}${c.reset}`)
    }

    cycleEntry.status = 'completed'
    cycleEntry.decision = decision
    cycleEntry.position = getCurrentPosition()

  } catch (err) {
    console.error(`  ${c.dim}│${c.reset}  ${c.red}✘ Error: ${err.message}${c.reset}`)
    cycleEntry.status = 'error'
    cycleEntry.error = err.message
  }

  console.log(`  ${c.dim}└${'─'.repeat(56)}┘${c.reset}`)

  activityLog.unshift(cycleEntry)
  if (activityLog.length > 50) activityLog.pop()

  return cycleEntry
}

export function getActivityLog() {
  return activityLog
}

export function getStats() {
  return {
    cycleCount,
    totalYieldEarned: parseFloat(totalYieldEarned.toFixed(4)),
    currentPosition: getCurrentPosition()
  }
}
