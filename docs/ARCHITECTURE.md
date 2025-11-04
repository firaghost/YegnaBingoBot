# 🏗️ Bingo Vault - System Architecture

## 📊 High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM USERS                           │
│                    (Players using the bot)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Messages & Commands
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      TELEGRAM BOT API                            │
│                   (Telegram's servers)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Webhook/Polling
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    VERCEL SERVERLESS                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Bot Application (Telegraf)                 │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │ Commands │  │ Services │  │  Utils   │            │    │
│  │  └──────────┘  └──────────┘  └──────────┘            │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │         Admin Dashboard (Next.js + React)              │    │
│  │                                                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │    │
│  │  │  Pages   │  │Components│  │  Styles  │            │    │
│  │  └──────────┘  └──────────┘  └──────────┘            │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             │ Database Queries
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE (PostgreSQL)                         │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │  Users   │  │ Payments │  │  Games   │  │ Players  │       │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 Data Flow Diagrams

### User Registration Flow

```
┌──────┐     /start      ┌─────────┐    Check User    ┌──────────┐
│ User │ ───────────────>│   Bot   │ ───────────────> │ Database │
└──────┘                 └─────────┘                   └──────────┘
   │                          │                             │
   │                          │<─────────────────────────────┘
   │                          │     User exists?
   │                          │
   │    Welcome Message       │
   │<─────────────────────────┤
   │                          │
   │                          │     Create User
   │                          ├──────────────────────────> Database
   │                          │
   │    Account Created       │
   │<─────────────────────────┤
   │                          │
```

### Payment Approval Flow

```
┌──────┐   /receipt    ┌─────────┐   Save Payment   ┌──────────┐
│ User │ ────────────> │   Bot   │ ───────────────> │ Database │
└──────┘               └─────────┘                   └──────────┘
                            │                             │
                            │        Receipt Saved        │
                            │<─────────────────────────────┘
                            │
                            │     Confirmation
                            ├──────────────> User
                            │

┌───────┐   Login      ┌───────────┐   Get Pending   ┌──────────┐
│ Admin │ ───────────> │ Dashboard │ ──────────────> │ Database │
└───────┘              └───────────┘                  └──────────┘
   │                         │                             │
   │                         │<─────────────────────────────┘
   │                         │     Payment List
   │    Display Payments     │
   │<────────────────────────┤
   │                         │
   │    Approve Payment      │
   ├────────────────────────>│
   │                         │     Update Payment
   │                         ├──────────────────────────> Database
   │                         │     Update Balance
   │                         ├──────────────────────────> Database
   │                         │
   │    Success Message      │
   │<────────────────────────┤
```

### Game Flow

```
┌──────┐    /play     ┌─────────┐   Get Active    ┌──────────┐
│ User │ ───────────> │   Bot   │ ──────────────> │ Database │
└──────┘              └─────────┘                  └──────────┘
   │                       │                            │
   │                       │<────────────────────────────┘
   │                       │      Game Info
   │                       │
   │                       │    Generate Card
   │                       │    Join Game
   │                       ├─────────────────────────> Database
   │                       │
   │    Bingo Card         │
   │<──────────────────────┤
   │                       │

┌───────┐  Start Game  ┌───────────┐  Update Status  ┌──────────┐
│ Admin │ ───────────> │ Dashboard │ ──────────────> │ Database │
└───────┘              └───────────┘                  └──────────┘
                             │
                             │    Call Number
                             ├──────────────────────> Database
                             │
                             │    Check Winners
                             ├──────────────────────> Database
                             │
                             │    Winner Found?
                             │
                             │    End Game
                             ├──────────────────────> Database
                             │    Award Prize
                             ├──────────────────────> Database
```

## 🗂️ Component Architecture

### Bot Layer

```
bot/
├── index.js (Entry Point)
│   ├── Initialize Telegraf
│   ├── Register Commands
│   ├── Set up Middleware
│   └── Launch Bot
│
├── commands/ (Command Handlers)
│   ├── start.js
│   │   ├── Check if user exists
│   │   ├── Create user if new
│   │   └── Send welcome message
│   │
│   ├── balance.js
│   │   ├── Get user data
│   │   ├── Get pending payments
│   │   └── Display balance
│   │
│   ├── receipt.js
│   │   ├── Parse receipt data
│   │   ├── Save to database
│   │   └── Confirm submission
│   │
│   ├── play.js
│   │   ├── Check balance
│   │   ├── Get/create game
│   │   ├── Generate card
│   │   ├── Join game
│   │   └── Display card
│   │
│   └── help.js
│       └── Display help text
│
├── services/ (Business Logic)
│   ├── paymentService.js
│   │   ├── submitPayment()
│   │   ├── getUserByTelegramId()
│   │   ├── createUser()
│   │   ├── getPendingPayments()
│   │   └── updateUserBalance()
│   │
│   └── gameService.js
│       ├── getActiveGame()
│       ├── joinGame()
│       ├── getGamePlayersCount()
│       ├── startGame()
│       ├── checkForWinners()
│       └── endGame()
│
└── utils/ (Utilities)
    ├── supabaseClient.js
    │   └── Database connection
    │
    └── bingoEngine.js
        ├── generateBingoCard()
        ├── checkBingoWin()
        ├── formatBingoCard()
        ├── generateBingoNumber()
        └── getBingoLetter()
```

### Dashboard Layer

```
dashboard/
├── pages/ (Routes)
│   ├── _app.js (App wrapper)
│   ├── index.js (Dashboard home)
│   │   ├── Fetch statistics
│   │   ├── Display stats cards
│   │   └── Quick actions
│   │
│   ├── login.js (Admin login)
│   │   ├── Password input
│   │   ├── Validate password
│   │   └── Set auth token
│   │
│   ├── payments.js (Payment management)
│   │   ├── Fetch payments
│   │   ├── Filter by status
│   │   ├── Approve/reject
│   │   └── Update balances
│   │
│   └── games.js (Game management)
│       ├── Fetch games
│       ├── Filter by status
│       ├── Start/end games
│       └── Call numbers
│
├── components/ (Reusable UI)
│   ├── Navbar.jsx
│   │   ├── Navigation links
│   │   └── Logout button
│   │
│   ├── PaymentCard.jsx
│   │   ├── Display payment info
│   │   ├── Amount input
│   │   └── Approve/reject buttons
│   │
│   └── GameManager.jsx
│       ├── Display game info
│       ├── Call number button
│       └── End game button
│
├── lib/ (Utilities)
│   └── supabaseClient.js
│       └── Database connection
│
└── styles/ (Styling)
    └── globals.css
        └── Tailwind + custom styles
```

### Database Layer

```
Supabase (PostgreSQL)
│
├── users
│   ├── id (uuid, PK)
│   ├── telegram_id (text, unique)
│   ├── username (text)
│   ├── balance (numeric)
│   ├── status (text)
│   └── created_at (timestamp)
│
├── payments
│   ├── id (uuid, PK)
│   ├── user_id (uuid, FK → users)
│   ├── receipt_number (text)
│   ├── image_url (text)
│   ├── amount (numeric)
│   ├── status (text)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── games
│   ├── id (uuid, PK)
│   ├── status (text)
│   ├── prize_pool (numeric)
│   ├── called_numbers (jsonb)
│   ├── winner_id (uuid, FK → users)
│   ├── created_at (timestamp)
│   ├── started_at (timestamp)
│   └── ended_at (timestamp)
│
└── game_players
    ├── id (uuid, PK)
    ├── game_id (uuid, FK → games)
    ├── user_id (uuid, FK → users)
    ├── card (jsonb)
    ├── marked_numbers (jsonb)
    ├── is_winner (boolean)
    └── joined_at (timestamp)
```

## 🔐 Security Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. Transport Layer (HTTPS)                             │
│     ├── All communications encrypted                    │
│     └── Webhook uses HTTPS only                         │
│                                                          │
│  2. Authentication Layer                                │
│     ├── Admin: Password-based                           │
│     ├── Bot: Telegram user verification                 │
│     └── Database: Service role key                      │
│                                                          │
│  3. Authorization Layer                                 │
│     ├── Row Level Security (RLS)                        │
│     ├── Admin-only dashboard access                     │
│     └── User-specific data access                       │
│                                                          │
│  4. Data Layer                                          │
│     ├── Environment variables                           │
│     ├── No hardcoded secrets                            │
│     └── Encrypted at rest (Supabase)                    │
│                                                          │
│  5. Application Layer                                   │
│     ├── Input validation                                │
│     ├── Error handling                                  │
│     └── SQL injection prevention                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📊 State Management

### Bot State

```
User Session State (Telegram)
├── User ID (from Telegram)
├── Username (from Telegram)
└── Message context (from Telegram)

Application State (Database)
├── User balance
├── Payment status
├── Game participation
└── Game cards
```

### Dashboard State

```
Client State (React)
├── Authentication status
├── Current page
├── Filter selections
└── Form inputs

Server State (Supabase)
├── User data
├── Payment records
├── Game records
└── Player records
```

## 🔄 Event Flow

### Bot Events

```
Telegram Update
    │
    ├─> Message Event
    │   ├─> Command (/start, /play, etc.)
    │   ├─> Text (receipt submission)
    │   └─> Photo (receipt image)
    │
    ├─> Callback Query Event
    │   └─> (Future: inline buttons)
    │
    └─> Error Event
        └─> Log and notify user
```

### Dashboard Events

```
User Action
    │
    ├─> Page Navigation
    │   ├─> Check authentication
    │   ├─> Fetch data
    │   └─> Render page
    │
    ├─> Form Submission
    │   ├─> Validate input
    │   ├─> Update database
    │   ├─> Refresh data
    │   └─> Show feedback
    │
    └─> Real-time Update
        ├─> Database change
        ├─> Trigger re-fetch
        └─> Update UI
```

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Production Setup                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Vercel (Bot + Dashboard)                               │
│  ├── Serverless Functions                               │
│  │   └── /api/webhook.js (Bot handler)                  │
│  ├── Static Site                                        │
│  │   └── Dashboard pages                                │
│  └── Environment Variables                              │
│      ├── BOT_TOKEN                                      │
│      ├── SUPABASE_URL                                   │
│      └── SUPABASE_KEY                                   │
│                                                          │
│  Supabase (Database)                                    │
│  ├── PostgreSQL Database                                │
│  ├── Authentication (future)                            │
│  ├── Storage (future)                                   │
│  └── Edge Functions (future)                            │
│                                                          │
│  Telegram (Bot Platform)                                │
│  ├── Bot API                                            │
│  ├── Webhook endpoint                                   │
│  └── Message delivery                                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 📈 Scalability Considerations

### Current Capacity

```
Free Tier Limits:
├── Supabase
│   ├── 500MB database
│   ├── 2GB bandwidth/month
│   └── 50,000 MAU
│
└── Vercel
    ├── 100GB bandwidth/month
    ├── 100 deployments/day
    └── 100GB-hours functions
```

### Scaling Strategy

```
Phase 1 (Current): Free Tier
├── ~10,000 users
├── ~100,000 games
└── ~1,000,000 messages

Phase 2: Paid Tier
├── Database upgrade
├── CDN integration
└── Caching layer

Phase 3: Distributed
├── Load balancing
├── Database sharding
└── Microservices
```

## 🔧 Technology Stack

```
Frontend
├── Next.js 14 (React framework)
├── React 18 (UI library)
├── Tailwind CSS 3 (Styling)
└── JavaScript ES6+ (Language)

Backend
├── Node.js 18+ (Runtime)
├── Telegraf 4 (Bot framework)
├── Supabase JS (Database client)
└── Vercel (Hosting)

Database
├── PostgreSQL (via Supabase)
├── JSONB (Flexible data)
└── Row Level Security (RLS)

DevOps
├── Git (Version control)
├── Vercel CLI (Deployment)
├── npm (Package management)
└── Environment variables (Config)
```

---

**For more details, see:**
- [PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md) - Complete overview
- [docs/API.md](API.md) - API documentation
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment guide
