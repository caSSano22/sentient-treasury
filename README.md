# 🤖 Sentient Treasury

> **Autonomous AI Agent for On-Chain Capital Management** — Built with [WDK by Tether](https://github.com/nicholasgasior/wdk)

Sentient Treasury is an autonomous AI-powered agent that manages **USDt (Tether) capital** across DeFi protocols on Ethereum. It fetches **real-time yield data** from DeFi Llama, uses GPT-4 to analyze opportunities, and makes intelligent decisions to maximize returns — all without human intervention.

Built for **Tether Hackathon Galactica: WDK Edition 1**.

---

## ✨ Features

- **🧠 AI Decision Engine** — GPT-4 analyzes real market data and makes autonomous investment decisions (DEPOSIT, WITHDRAW, REBALANCE, HOLD) with gas cost-benefit analysis
- **💰 WDK Wallet Integration** — Real Ethereum wallet operations via `@tetherto/wdk` + `@tetherto/wdk-wallet-evm`
- **₮ USDt/XAUt Token Management** — ERC-20 integration with Tether's USDt stablecoin, portfolio tracking, and on-chain balance checking
- **📊 Live Yield Data** — Real-time APY data from [DeFi Llama API](https://yields.llama.fi/) across Aave, Compound, Morpho, Spark, Fluid, and more
- **📈 Yield History Chart** — Visual chart showing real APY trends over time
- **🧠 Persistent Memory** — Agent remembers past decisions across restarts for long-term strategy
- **💸 Gas Cost Analysis** — Only acts when economically profitable after transaction costs
- **🔄 Token Swap** — Swap between tokens (ETH, USDT, USDC, DAI, WBTC) with live quotes, fees, and price impact
- **💸 Send ETH** — Send ETH transactions directly from the dashboard
- **🔄 Autonomous Loop** — Agent runs every configurable interval, making decisions autonomously via `node-cron`
- **🖥️ Premium Dashboard** — Glassmorphism-styled real-time monitoring dashboard with Tether portfolio view

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Dashboard UI                    │
│          (public/index.html @ :3000)             │
├─────────────────────────────────────────────────┤
│                  Express API                     │
│               (src/server.js)                    │
├──────────┬──────────┬───────────┬───────────────┤
│  Agent   │    AI    │  Yield    │   Token        │
│  Loop    │  Agent   │  Fetcher  │   Manager      │
│ (cycle)  │ (GPT-4)  │(DeFi     │  (USDt/XAUt)   │
│          │ +Memory  │  Llama)   │  (ERC-20)      │
├──────────┴──────────┴───────────┴───────────────┤
│            WDK Wallet (Ethereum)                 │
│         (@tetherto/wdk-wallet-evm)               │
├─────────────────────────────────────────────────┤
│            Ethereum Sepolia Testnet              │
└─────────────────────────────────────────────────┘
```

**Data Flow:**
1. Agent wakes up on schedule (configurable interval)
2. Checks WDK wallet balance (ETH + USDt ERC-20)
3. Fetches **real** yield data from DeFi Llama API
4. GPT-4 analyzes data with persistent memory & gas cost analysis
5. Executes autonomous action (or holds) based on AI decision
6. Dashboard reflects all state in real-time

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** v18+ (tested on v25.5.0)
- **OpenAI API Key** — [Get one here](https://platform.openai.com/api-keys)

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_USERNAME/sentient-treasury.git
cd sentient-treasury

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env and add your OpenAI API key
```

### Configure `.env`

```env
OPENAI_API_KEY=sk-your-key-here
WALLET_SEED_PHRASE=           # Leave empty for auto-generation, or set your own
NETWORK=testnet
PORT=3000
YIELD_THRESHOLD=1.0           # Min APY difference to trigger action (%)
AGENT_INTERVAL_MINUTES=1      # How often the agent runs
```

### Run

```bash
npm start
```

Open **http://localhost:3000** in your browser to see the dashboard.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Full agent status (wallet, yields, position, portfolio, logs) |
| `GET` | `/api/wallet` | Wallet balance and address |
| `GET` | `/api/yields` | Current yield opportunities (from DeFi Llama) |
| `GET` | `/api/yield-history` | Historical yield data for charts |
| `GET` | `/api/portfolio` | USDt/XAUt portfolio with on-chain data |
| `GET` | `/api/tether-tokens` | Tether token info (USDt, XAUt contracts) |
| `GET` | `/api/decision-history` | AI decision history with reasoning |
| `GET` | `/api/log` | Agent activity log |
| `GET` | `/api/transactions` | Transaction history |
| `POST` | `/api/trigger` | Manually trigger one agent cycle |
| `POST` | `/api/send` | Send ETH to an address (`{ to, amount }`) |

---

## 🔌 Third-Party Disclosure

As required by hackathon rules, here are all third-party services and components used:

| Component | Purpose | Type |
|-----------|---------|------|
| **@tetherto/wdk** | Wallet Development Kit by Tether | Core dependency |
| **@tetherto/wdk-wallet-evm** | EVM wallet module for WDK | Core dependency |
| **OpenAI GPT-4** | AI decision engine for yield analysis | API service |
| **DeFi Llama API** | **Real** yield data from DeFi protocols | Public API (free) |
| **Express.js** | HTTP server for dashboard API | npm package |
| **bip39** | Mnemonic seed phrase generation | npm package |
| **node-cron** | Scheduling agent cycles | npm package |
| **dotenv** | Environment variable management | npm package |
| **Yield data** | **Real** — from DeFi Llama `yields.llama.fi/pools` | Live API |
| **USDt balance** | **Hybrid** — on-chain ERC-20 check + simulated for demo | On-chain + sim |
| **ETH transactions** | **Real** on Sepolia testnet via WDK | On-chain |

> ⚠️ **Note:** USDt portfolio tracking combines on-chain ERC-20 balance checks with simulated positions for demo purposes. ETH transactions on Sepolia testnet are real and verifiable on [Etherscan](https://sepolia.etherscan.io). Yield data is fetched live from DeFi Llama.

---

## 📁 Project Structure

```
sentient-treasury/
├── public/
│   └── index.html          # Dashboard UI (glassmorphism + Tether portfolio)
├── src/
│   ├── index.js            # Entry point + boot sequence
│   ├── server.js           # Express API server
│   ├── walletManager.js    # WDK wallet operations
│   ├── aiAgent.js          # GPT-4 AI decision engine + persistent memory
│   ├── agentLoop.js        # Autonomous cycle orchestrator
│   ├── yieldFetcher.js     # DeFi Llama yield data fetcher
│   ├── tokenManager.js     # USDt/XAUt ERC-20 token management
│   └── swapManager.js      # Token swap engine
├── data/
│   └── agent_memory.json   # Persistent AI decision memory (auto-created)
├── .env.example            # Environment template
├── package.json
├── LICENSE                 # Apache 2.0
└── README.md
```

---

## 🧠 How the AI Agent Works

The agent follows a structured decision loop:

1. **Observe**: Check wallet balance (ETH + USDt) and fetch real yield data
2. **Analyze**: GPT-4 receives wallet state, yield opportunities, gas costs, and past decisions
3. **Decide**: AI outputs structured JSON with action, reasoning, confidence, risk assessment, and strategy
4. **Execute**: If economically viable (profitable after gas), the agent acts autonomously
5. **Learn**: Decision is saved to persistent memory for future context

The AI considers:
- **Real APY rates** from live DeFi protocols (Aave, Compound, Morpho, etc.)
- **Gas costs** — only acts when the yield gain exceeds transaction costs
- **TVL & protocol reputation** — prefers battle-tested protocols with >$100M TVL
- **APY trends** — considers 7-day changes to detect declining yields
- **Past decisions** — uses memory to avoid repeated unprofitable actions

---

## 🔮 Future Integrations & Roadmap

Sentient Treasury's modular architecture makes it easy to integrate with other AI agent frameworks:

| Framework | Integration Path |
|-----------|-----------------|
| **Eliza** (ai16z) | Register yield fetcher + wallet ops as Eliza plugin actions |
| **LangChain / LangGraph** | Wrap `makeDecision()` and `fetchYields()` as LangChain Tools |
| **CrewAI** | Sentient Treasury becomes a specialized "DeFi Analyst" crew member |
| **AutoGPT** | Connect via REST API endpoints (`/api/yields`, `/api/trigger`) |
| **OLAS / OpenServ** | Deploy as autonomous on-chain service |

**Roadmap:**
- 🔜 Real Aave/Compound supply & withdraw via smart contract calls
- 🔜 Multi-chain support (Arbitrum, Optimism, Polygon)
- 🔜 XAUt (Tether Gold) portfolio diversification
- 🔜 Slippage protection & MEV-aware execution
- 🔜 Multi-agent collaboration (risk analyst + executor + auditor)

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).
