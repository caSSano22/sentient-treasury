/**
 * aiAgent.js
 * The brain of Sentient Treasury.
 * Supports MULTIPLE AI providers — not locked to OpenAI!
 *
 * Supported providers (configured via .env):
 *   - openai     → GPT-4, GPT-4o, GPT-4o-mini (needs OPENAI_API_KEY)
 *   - gemini     → Gemini Pro/Flash (needs GEMINI_API_KEY)
 *   - ollama     → Local models like Llama3, Mistral (FREE, no API key!)
 *   - openrouter → Access 100+ models (needs OPENROUTER_API_KEY)
 *   - groq       → Llama3, Mixtral ultra-fast (needs GROQ_API_KEY)
 *   - custom     → Any OpenAI-compatible API (needs AI_BASE_URL + AI_API_KEY)
 *
 * Features:
 * - Persistent memory: remembers past decisions across restarts
 * - Gas cost-benefit analysis: only acts when profitable after gas
 * - Risk-aware: considers TVL, protocol reputation, and APY trends
 * - Structured JSON output with confidence scoring
 */

import OpenAI from 'openai'
import { formatYieldsForPrompt } from './yieldFetcher.js'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MEMORY_FILE = join(__dirname, '..', 'data', 'agent_memory.json')

/**
 * AI Provider configuration.
 * Uses OpenAI SDK with custom baseURL to support any OpenAI-compatible API.
 */
const AI_PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-mini',
    name: 'OpenAI'
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.0-flash',
    name: 'Google Gemini'
  },
  ollama: {
    baseURL: 'http://localhost:11434/v1',
    keyEnv: null, // no key needed
    defaultModel: 'llama3.2',
    name: 'Ollama (Local)'
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    keyEnv: 'OPENROUTER_API_KEY',
    defaultModel: 'meta-llama/llama-3-8b-instruct',
    name: 'OpenRouter'
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    keyEnv: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
    name: 'Groq'
  }
}

let _client
function getAIClient() {
  if (!_client) {
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
    const config = AI_PROVIDERS[provider]

    let baseURL, apiKey, model

    if (config) {
      baseURL = process.env.AI_BASE_URL || config.baseURL
      apiKey = config.keyEnv ? process.env[config.keyEnv] : 'ollama' // Ollama needs no key
      model = process.env.AI_MODEL || config.defaultModel
      console.log(`[AI] Provider: ${config.name} | Model: ${model}`)
    } else {
      // Custom provider
      baseURL = process.env.AI_BASE_URL || 'http://localhost:11434/v1'
      apiKey = process.env.AI_API_KEY || 'no-key'
      model = process.env.AI_MODEL || 'llama3.2'
      console.log(`[AI] Custom provider: ${baseURL} | Model: ${model}`)
    }

    if (!apiKey || apiKey === 'no-key') {
      console.warn(`[AI] ⚠️  No API key found. Set ${config?.keyEnv || 'AI_API_KEY'} in .env`)
    }

    _client = new OpenAI({ baseURL, apiKey })
    _client._model = model
    _client._providerName = config?.name || 'Custom'
  }
  return _client
}

// Track current position in memory
let currentPosition = {
  protocol: null,
  amount: 0,
  entryApy: 0,
  depositedAt: null
}

// Persistent memory — past decisions
let decisionHistory = []

/**
 * Load persistent memory from disk.
 */
function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) {
      const data = JSON.parse(readFileSync(MEMORY_FILE, 'utf-8'))
      if (data.position) currentPosition = data.position
      if (data.decisions) decisionHistory = data.decisions
      console.log(`[AI] Loaded memory: ${decisionHistory.length} past decisions`)
    }
  } catch (err) {
    console.warn(`[AI] Failed to load memory: ${err.message}`)
  }
}

/**
 * Save persistent memory to disk.
 */
function saveMemory() {
  try {
    const dataDir = dirname(MEMORY_FILE)
    if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
    writeFileSync(MEMORY_FILE, JSON.stringify({
      position: currentPosition,
      decisions: decisionHistory.slice(-20), // Keep last 20 decisions
      lastSaved: new Date().toISOString()
    }, null, 2))
  } catch (err) {
    console.warn(`[AI] Failed to save memory: ${err.message}`)
  }
}

// Load memory on module init
loadMemory()

/**
 * Estimate gas cost in USD for a transaction.
 * Uses current ETH price estimate.
 */
function estimateGasCost() {
  // Base L2 gas is extremely cheap: ~0.01 gwei, 60k gas, ETH ~$2500
  // Typical Base transaction costs < $0.01
  const gasPrice = 0.01 // gwei (Base L2 is very cheap)
  const gasLimit = 60_000
  const ethPrice = 2500 // USD
  const gasCostETH = (gasPrice * gasLimit) / 1e9
  const gasCostUSD = gasCostETH * ethPrice
  return {
    eth: gasCostETH,
    usd: parseFloat(Math.max(gasCostUSD, 0.01).toFixed(4)) // min $0.01
  }
}

/**
 * Get memory summary for AI context.
 */
function getMemorySummary() {
  if (decisionHistory.length === 0) return 'No previous decisions recorded.'

  const recent = decisionHistory.slice(-5)
  return recent.map(d =>
    `[${new Date(d.timestamp).toLocaleString()}] ${d.action}: ${d.reasoning?.substring(0, 80)}...`
  ).join('\n')
}

/**
 * Main decision function.
 * Takes wallet balance + yield data, returns AI decision.
 */
export async function makeDecision(walletBalance, yields) {
  const yieldSummary = formatYieldsForPrompt(yields)
  const bestYield = yields[0]
  const threshold = parseFloat(process.env.YIELD_THRESHOLD || '1.0')
  const gasCost = estimateGasCost()
  const memorySummary = getMemorySummary()

  // Calculate if action is economically viable
  const potentialAnnualYield = (walletBalance.usdt * bestYield.apy) / 100
  const dailyYield = potentialAnnualYield / 365
  const daysToCoverGas = gasCost.usd / (dailyYield || 0.01)

  const systemPrompt = `You are Sentient Treasury, an autonomous AI agent that manages USDT capital across DeFi protocols on Ethereum.
Your goal is to maximize yield while managing risk — all decisions must be economically sound.

CRITICAL: All yield data is REAL, fetched live from DeFi Llama API. These are actual, current rates from real DeFi protocols.

You must respond ONLY with valid JSON in this exact format:
{
  "action": "DEPOSIT" | "WITHDRAW" | "REBALANCE" | "HOLD",
  "targetProtocol": "protocol name or null",
  "amount": number,
  "reasoning": "2-3 sentence explanation with specific data points justifying your decision",
  "confidence": number between 0 and 1,
  "riskAssessment": "brief risk analysis including TVL, protocol maturity, and APY stability",
  "gasCostAnalysis": "whether this trade is profitable after estimated gas costs",
  "strategy": "brief 1-sentence forward-looking strategy note"
}

Decision Rules:
- DEPOSIT: deploy idle USDT into a protocol when opportunity is good AND profitable after gas
- WITHDRAW: pull funds out when risk increases, APY drops below threshold, or better option exists
- REBALANCE: move from current protocol to a better one (only if APY difference > ${threshold}% AND profitable after gas)
- HOLD: maintain current position — this is often the best choice when differences are marginal
- Never risk more than 80% of total USDT balance in one protocol
- Consider gas costs: estimated $${gasCost.usd} per transaction
- It takes ~${daysToCoverGas.toFixed(0)} days of yield to cover one gas cost at current rates
- Only act when the economic benefit clearly outweighs transaction costs
- Prefer protocols with TVL > $100M (proven and battle-tested)
- Consider 7-day APY trends when available — declining APY may signal risk`

  const userPrompt = `Current wallet state:
- USDT balance: $${walletBalance.usdt}
- ETH balance: ${walletBalance.eth} ETH (for gas)
- Current position: ${currentPosition.protocol ? `$${currentPosition.amount} in ${currentPosition.protocol} at ${currentPosition.entryApy}% APY (since ${currentPosition.depositedAt})` : 'No active position (idle funds)'}

Available yield opportunities (REAL data from DeFi Llama):
${yieldSummary}

Best available: ${bestYield.name} at ${bestYield.apy}% APY (${bestYield.risk} risk, TVL: $${((bestYield.tvl || 0) / 1e6).toFixed(0)}M)

Gas cost estimate: ~$${gasCost.usd} per transaction
Yield threshold to act: ${threshold}%
Days to recoup gas at best rate: ${daysToCoverGas.toFixed(1)} days

Recent decision history:
${memorySummary}

Analyze the situation considering:
1. Is there a profitable opportunity after gas costs?
2. What are the risks of the best available protocol?
3. Should we change our current position or hold?
4. What is the forward-looking strategy?`

  const client = getAIClient()
  console.log(`[AI] Calling ${client._providerName} (${client._model}) for decision...`)

  const response = await client.chat.completions.create({
    model: client._model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.3,
    max_tokens: 500
  })

  const raw = response.choices[0].message.content.trim()

  let decision
  try {
    // Handle cases where GPT wraps JSON in markdown code blocks
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    decision = JSON.parse(jsonStr)
  } catch {
    console.error('[AI] Failed to parse GPT response:', raw)
    decision = {
      action: 'HOLD',
      targetProtocol: null,
      amount: 0,
      reasoning: 'Unable to parse AI response. Holding current position as safe default.',
      confidence: 0,
      riskAssessment: 'Unknown — defaulting to safe HOLD',
      gasCostAnalysis: 'N/A',
      strategy: 'Will retry analysis on next cycle'
    }
  }

  // Save to persistent memory
  decisionHistory.push({
    ...decision,
    timestamp: new Date().toISOString(),
    walletState: { usdt: walletBalance.usdt, eth: walletBalance.eth },
    bestAvailableApy: bestYield.apy,
    gasCostUsd: gasCost.usd
  })
  if (decisionHistory.length > 50) decisionHistory.shift()
  saveMemory()

  console.log(`[AI] Decision: ${decision.action} | Confidence: ${decision.confidence} | ${decision.reasoning}`)
  return decision
}

/**
 * Update current position after agent executes an action.
 */
export function updatePosition(action, protocol, amount, apy) {
  if (action === 'DEPOSIT' || action === 'REBALANCE') {
    currentPosition = {
      protocol,
      amount,
      entryApy: apy,
      depositedAt: new Date().toISOString()
    }
  } else if (action === 'WITHDRAW') {
    currentPosition = { protocol: null, amount: 0, entryApy: 0, depositedAt: null }
  }
  saveMemory()
}

export function getCurrentPosition() {
  return currentPosition
}

export function getDecisionHistory() {
  return decisionHistory.slice(-10)
}
