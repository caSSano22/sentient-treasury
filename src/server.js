/**
 * server.js
 * Express server that exposes agent state via REST API.
 * The dashboard (public/index.html) polls these endpoints.
 *
 * Includes token portfolio, decision history, and Tether token info.
 */

import express from 'express'
import { getBalance, getAddress, sendTransaction, getTransactionHistory } from './walletManager.js'
import { fetchYields, getYieldHistory } from './yieldFetcher.js'
import { getActivityLog, getStats, runCycle } from './agentLoop.js'
import { getCurrentPosition, getDecisionHistory } from './aiAgent.js'
import { getSwapQuote, executeSwap, getSupportedTokens, getSwapHistory, syncEthBalance } from './swapManager.js'
import { getPortfolio, getTetherTokens, getTokenHistory } from './tokenManager.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

// GET /api/status — full agent status for dashboard
app.get('/api/status', async (req, res) => {
  try {
    const balance = await getBalance()
    const yields = await fetchYields()
    const stats = getStats()
    const log = getActivityLog()
    const portfolio = getPortfolio()

    res.json({
      wallet: balance,
      yields: yields.slice(0, 8),
      position: getCurrentPosition(),
      stats,
      recentActivity: log.slice(0, 10),
      yieldHistory: getYieldHistory(),
      portfolio,
      tetherTokens: getTetherTokens(),
      agentRunning: true,
      timestamp: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/trigger — manually trigger one agent cycle (for demo)
app.post('/api/trigger', async (req, res) => {
  try {
    console.log('[Server] Manual cycle trigger requested')
    const result = await runCycle()
    res.json({ success: true, cycle: result })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/wallet — wallet info only
app.get('/api/wallet', async (req, res) => {
  try {
    const balance = await getBalance()
    res.json(balance)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/yields — current yield data
app.get('/api/yields', async (req, res) => {
  try {
    const yields = await fetchYields()
    res.json(yields)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/yield-history — yield history for charts
app.get('/api/yield-history', (req, res) => {
  res.json(getYieldHistory())
})

// GET /api/log — activity log
app.get('/api/log', (req, res) => {
  res.json(getActivityLog())
})

// POST /api/send — send ETH to an address
app.post('/api/send', async (req, res) => {
  try {
    const { to, amount } = req.body
    if (!to || !amount) {
      return res.status(400).json({ error: 'Missing "to" address or "amount"' })
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
      return res.status(400).json({ error: 'Invalid Ethereum address format' })
    }
    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ error: 'Amount must be a positive number' })
    }
    console.log(`[Server] Send request: ${amountNum} ETH to ${to}`)
    const result = await sendTransaction(to, amountNum)
    res.json({ success: true, transaction: result })
  } catch (err) {
    console.error('[Server] Send error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/transactions — transaction history
app.get('/api/transactions', (req, res) => {
  res.json(getTransactionHistory())
})

// GET /api/portfolio — Tether token portfolio
app.get('/api/portfolio', (req, res) => {
  res.json(getPortfolio())
})

// GET /api/tether-tokens — info about Tether tokens (USDt, XAUt)
app.get('/api/tether-tokens', (req, res) => {
  res.json(getTetherTokens())
})

// GET /api/decision-history — AI decision history with reasoning
app.get('/api/decision-history', (req, res) => {
  res.json(getDecisionHistory())
})

// GET /api/tokens — supported tokens with balances
app.get('/api/tokens', async (req, res) => {
  try {
    const balance = await getBalance()
    syncEthBalance(balance.eth)
    res.json(getSupportedTokens())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/swap/quote — get swap quote
app.post('/api/swap/quote', (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.body
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ error: 'Missing fromToken, toToken, or amount' })
    }
    const quote = getSwapQuote(fromToken, toToken, parseFloat(amount))
    res.json(quote)
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /api/swap — execute swap
app.post('/api/swap', (req, res) => {
  try {
    const { fromToken, toToken, amount } = req.body
    if (!fromToken || !toToken || !amount) {
      return res.status(400).json({ error: 'Missing fromToken, toToken, or amount' })
    }
    console.log(`[Server] Swap request: ${amount} ${fromToken} → ${toToken}`)
    const result = executeSwap(fromToken, toToken, parseFloat(amount))
    res.json({ success: true, swap: result })
  } catch (err) {
    console.error('[Server] Swap error:', err.message)
    res.status(400).json({ error: err.message })
  }
})

// GET /api/swap/history — swap history
app.get('/api/swap/history', (req, res) => {
  res.json(getSwapHistory())
})

// ===== ADVANCED AGENT FEATURES =====

// POST /api/ask-ai — natural language AI assistant for portfolio questions
app.post('/api/ask-ai', async (req, res) => {
  try {
    const { question } = req.body
    if (!question) return res.status(400).json({ error: 'Missing question' })

    console.log(`[Server] AI Question: ${question}`)

    const balance = await getBalance()
    const yields = await fetchYields()
    const position = getCurrentPosition()
    const history = getDecisionHistory()

    // Use the same AI provider as the agent
    const OpenAI = (await import('openai')).default
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()
    const providers = {
      openai: { baseURL: 'https://api.openai.com/v1', key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' },
      gemini: { baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai', key: process.env.GEMINI_API_KEY, model: 'gemini-2.0-flash' },
      ollama: { baseURL: 'http://localhost:11434/v1', key: 'ollama', model: 'llama3.2' },
      groq: { baseURL: 'https://api.groq.com/openai/v1', key: process.env.GROQ_API_KEY, model: 'llama-3.3-70b-versatile' },
      openrouter: { baseURL: 'https://openrouter.ai/api/v1', key: process.env.OPENROUTER_API_KEY, model: 'meta-llama/llama-3-8b-instruct' },
    }
    const p = providers[provider] || providers.openai
    const client = new OpenAI({ baseURL: process.env.AI_BASE_URL || p.baseURL, apiKey: p.key })
    const model = process.env.AI_MODEL || p.model

    const contextPrompt = `You are Sentient Treasury AI Assistant. Answer questions about the user's DeFi portfolio concisely.

Current state:
- USDt balance: $${balance.usdt}
- ETH balance: ${balance.eth}
- Position: ${position.protocol ? `$${position.amount} in ${position.protocol} at ${position.entryApy}% APY` : 'No active position'}
- Best yield: ${yields[0]?.name} at ${yields[0]?.apy}% APY
- Recent decisions: ${history.slice(0, 3).map(d => d.action).join(', ') || 'None'}
- Network: Base Sepolia (testnet)

Answer in 2-3 sentences max. Be specific with numbers.`

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: contextPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.5,
      max_tokens: 200
    })

    const answer = response.choices[0].message.content.trim()
    console.log(`[Server] AI Answer: ${answer}`)
    res.json({ answer, model, provider })
  } catch (err) {
    console.error('[Server] AI question error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/prices — live crypto prices
app.get('/api/prices', async (req, res) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,tether,tether-gold,bitcoin&vs_currencies=usd&include_24hr_change=true',
      { signal: controller.signal }
    )
    clearTimeout(timeout)
    const data = await response.json()
    res.json({
      ETH: { price: data.ethereum?.usd || 0, change24h: data.ethereum?.usd_24h_change || 0 },
      USDt: { price: data.tether?.usd || 1, change24h: data.tether?.usd_24h_change || 0 },
      XAUt: { price: data['tether-gold']?.usd || 0, change24h: data['tether-gold']?.usd_24h_change || 0 },
      BTC: { price: data.bitcoin?.usd || 0, change24h: data.bitcoin?.usd_24h_change || 0 },
      fetchedAt: new Date().toISOString()
    })
  } catch (err) {
    res.json({
      ETH: { price: 2500, change24h: 0 },
      USDt: { price: 1, change24h: 0 },
      XAUt: { price: 3000, change24h: 0 },
      BTC: { price: 85000, change24h: 0 },
      fetchedAt: new Date().toISOString(),
      fallback: true
    })
  }
})

// Smart Rules (in-memory for demo)
const smartRules = []

// GET /api/rules — list smart rules
app.get('/api/rules', (req, res) => {
  res.json(smartRules)
})

// POST /api/rules — create a smart rule
app.post('/api/rules', (req, res) => {
  try {
    const { condition, action, label } = req.body
    if (!condition || !action) return res.status(400).json({ error: 'Missing condition or action' })
    const rule = {
      id: 'rule-' + Date.now(),
      condition,
      action,
      label: label || `${condition} → ${action}`,
      active: true,
      createdAt: new Date().toISOString(),
      triggeredCount: 0
    }
    smartRules.push(rule)
    console.log(`[Rules] Created: ${rule.label}`)
    res.json({ success: true, rule })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// DELETE /api/rules/:id — delete a rule
app.delete('/api/rules/:id', (req, res) => {
  const idx = smartRules.findIndex(r => r.id === req.params.id)
  if (idx === -1) return res.status(404).json({ error: 'Rule not found' })
  smartRules.splice(idx, 1)
  res.json({ success: true })
})

export function startServer(port = 3000) {
  app.listen(port, () => {
    console.log(`[Server] Dashboard running at http://localhost:${port}`)
  })
}
