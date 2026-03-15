/**
 * agentLoop.js
 * Orchestrates the full autonomous agent cycle:
 * 1. Check wallet balance
 * 2. Fetch yield opportunities
 * 3. Ask AI for decision
 * 4. Execute transaction if needed
 * 5. Log everything for dashboard
 *
 * This loop runs on a schedule (configurable via AGENT_INTERVAL_MINUTES).
 */

import { getBalance, sendTransaction, adjustSimulatedUSDT } from './walletManager.js'
import { fetchYields } from './yieldFetcher.js'
import { makeDecision, updatePosition, getCurrentPosition } from './aiAgent.js'

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
  console.log(`\n[Agent] === ${cycleId} starting ===`)

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
    console.log(`[Agent] Step 1: Wallet balance — $${balance.usdt} USDT`)

    // Step 2: Fetch yields (real data from DeFi Llama)
    const yields = await fetchYields()
    const best = yields[0]
    const dataSource = best.source || 'unknown'
    cycleEntry.steps.push({ step: 'Yields fetched', detail: `Best: ${best.name} at ${best.apy}% APY (source: ${dataSource})` })
    console.log(`[Agent] Step 2: Best yield — ${best.name} at ${best.apy}% [${dataSource}]`)

    // Step 3: AI decision
    const decision = await makeDecision(balance, yields)
    cycleEntry.steps.push({
      step: `AI decided: ${decision.action}`,
      detail: decision.reasoning,
      confidence: decision.confidence
    })
    console.log(`[Agent] Step 3: AI decision — ${decision.action}`)

    // Step 4: Execute if action is not HOLD
    if (decision.action !== 'HOLD' && decision.amount > 0) {
      console.log(`[Agent] Step 4: Executing ${decision.action}...`)

      // Send a real small ETH transaction as proof of autonomous execution
      // In production this would be a real USDT transfer to the protocol
      const demoAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e' // demo recipient
      let txResult = null

      try {
        // Send 0.0001 ETH as symbolic autonomous transaction
        txResult = await sendTransaction(demoAddress, 0.0001)
        console.log(`[Agent] Transaction hash: ${txResult.hash}`)
      } catch (txErr) {
        console.log(`[Agent] Testnet tx skipped (no gas): ${txErr.message}`)
        txResult = { hash: 'simulated-' + Date.now(), simulated: true }
      }

      // Update simulated USDT position
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
      console.log('[Agent] Step 4: No action needed — HOLD')
      cycleEntry.steps.push({ step: 'No transaction', detail: 'Agent decided to hold' })
    }

    cycleEntry.status = 'completed'
    cycleEntry.decision = decision
    cycleEntry.position = getCurrentPosition()

  } catch (err) {
    console.error(`[Agent] Cycle error: ${err.message}`)
    cycleEntry.status = 'error'
    cycleEntry.error = err.message
  }

  activityLog.unshift(cycleEntry)
  if (activityLog.length > 50) activityLog.pop() // keep last 50 cycles

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
