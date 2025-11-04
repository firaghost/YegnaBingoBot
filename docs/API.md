# 📡 API Documentation

## Telegram Bot API

### Commands

#### `/start`
Register a new user or return existing user info.

**Response:**
- New user: Welcome message with instructions
- Existing user: Balance and status

**Example:**
```
User: /start
Bot: 🎮 Welcome to Bingo Vault!
     Your account has been created.
     Current balance: 💰 0 Birr
```

---

#### `/balance`
Check current balance and account status.

**Response:**
- Current balance
- Account status
- Pending payments count

**Example:**
```
User: /balance
Bot: 💰 Your Balance: 100 Birr
     📊 Account Status: active
     💡 Tip: Each game costs 10 Birr to play.
```

---

#### `/receipt <receipt_number> [amount]`
Submit a payment receipt for verification.

**Parameters:**
- `receipt_number` (required): Receipt identifier
- `amount` (optional): Payment amount in Birr

**Response:**
- Success confirmation
- Receipt number
- Pending status

**Example:**
```
User: /receipt REC123456 100
Bot: ✅ Receipt submitted successfully!
     📄 Receipt Number: REC123456
     💵 Amount: 100 Birr
     ⏳ Status: Pending approval
```

---

#### `/play`
Join or create a Bingo game.

**Requirements:**
- Minimum balance: 10 Birr
- Entry fee: 10 Birr

**Response:**
- Game joined confirmation
- Bingo card
- Current players count
- Game status

**Example:**
```
User: /play
Bot: 🎉 You've joined the game!
     💰 Entry fee: 10 Birr
     💵 New balance: 90 Birr
     👥 Players in game: 3
     
     🎲 Your Bingo Card:
     [Card display]
```

---

#### `/status`
Check current game status.

**Response:**
- Game status (waiting/active/completed)
- Number of players
- Prize pool
- Called numbers (if active)

**Example:**
```
User: /status
Bot: 📊 Current Game Status
     🎮 Status: 🎲 In Progress
     👥 Players: 5
     💰 Prize Pool: 50 Birr
     🔢 Numbers called: 12
     📍 Last numbers: 23, 45, 67, 12, 89
```

---

#### `/help`
Display help information and available commands.

**Response:**
- List of all commands
- How to play instructions
- Game rules
- Support information

---

## Supabase Database API

### Tables

#### `users`

**Schema:**
```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  telegram_id text UNIQUE NOT NULL,
  username text,
  balance numeric DEFAULT 0,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now()
);
```

**Operations:**

**Create User:**
```javascript
const { data, error } = await supabase
  .from('users')
  .insert({
    telegram_id: '123456789',
    username: 'john_doe',
    balance: 0,
    status: 'pending'
  })
  .select()
  .single();
```

**Get User by Telegram ID:**
```javascript
const { data, error } = await supabase
  .from('users')
  .select('*')
  .eq('telegram_id', '123456789')
  .single();
```

**Update Balance:**
```javascript
const { data, error } = await supabase
  .from('users')
  .update({ balance: 100 })
  .eq('id', userId)
  .select()
  .single();
```

---

#### `payments`

**Schema:**
```sql
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES users(id),
  receipt_number text NOT NULL,
  image_url text,
  amount numeric,
  status text DEFAULT 'pending',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

**Operations:**

**Submit Payment:**
```javascript
const { data, error } = await supabase
  .from('payments')
  .insert({
    user_id: userId,
    receipt_number: 'REC123',
    amount: 100,
    status: 'pending'
  })
  .select()
  .single();
```

**Get Pending Payments:**
```javascript
const { data, error } = await supabase
  .from('payments')
  .select(`
    *,
    users (
      username,
      telegram_id,
      balance
    )
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

**Approve Payment:**
```javascript
const { error } = await supabase
  .from('payments')
  .update({
    status: 'approved',
    amount: 100,
    updated_at: new Date().toISOString()
  })
  .eq('id', paymentId);
```

---

#### `games`

**Schema:**
```sql
CREATE TABLE games (
  id uuid PRIMARY KEY,
  status text DEFAULT 'waiting',
  prize_pool numeric DEFAULT 0,
  called_numbers jsonb DEFAULT '[]'::jsonb,
  winner_id uuid REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  started_at timestamp,
  ended_at timestamp
);
```

**Operations:**

**Create Game:**
```javascript
const { data, error } = await supabase
  .from('games')
  .insert({
    status: 'waiting',
    prize_pool: 0,
    called_numbers: []
  })
  .select()
  .single();
```

**Get Active Game:**
```javascript
const { data, error } = await supabase
  .from('games')
  .select('*')
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

**Update Game Status:**
```javascript
const { error } = await supabase
  .from('games')
  .update({
    status: 'active',
    started_at: new Date().toISOString()
  })
  .eq('id', gameId);
```

**Call Number:**
```javascript
const { data: game } = await supabase
  .from('games')
  .select('called_numbers')
  .eq('id', gameId)
  .single();

const updatedNumbers = [...game.called_numbers, newNumber];

const { error } = await supabase
  .from('games')
  .update({ called_numbers: updatedNumbers })
  .eq('id', gameId);
```

---

#### `game_players`

**Schema:**
```sql
CREATE TABLE game_players (
  id uuid PRIMARY KEY,
  game_id uuid REFERENCES games(id),
  user_id uuid REFERENCES users(id),
  card jsonb NOT NULL,
  marked_numbers jsonb DEFAULT '[]'::jsonb,
  is_winner boolean DEFAULT false,
  joined_at timestamp DEFAULT now(),
  UNIQUE(game_id, user_id)
);
```

**Operations:**

**Join Game:**
```javascript
const { data, error } = await supabase
  .from('game_players')
  .insert({
    game_id: gameId,
    user_id: userId,
    card: bingoCard,
    marked_numbers: []
  })
  .select()
  .single();
```

**Get Game Players:**
```javascript
const { data, error } = await supabase
  .from('game_players')
  .select(`
    *,
    users (
      username,
      telegram_id
    )
  `)
  .eq('game_id', gameId);
```

**Mark Winner:**
```javascript
const { error } = await supabase
  .from('game_players')
  .update({ is_winner: true })
  .eq('game_id', gameId)
  .eq('user_id', winnerId);
```

---

## Admin Dashboard API

### Authentication

**Login:**
```javascript
// Simple password check
if (password === process.env.ADMIN_PASSWORD) {
  localStorage.setItem('adminAuth', 'true');
  // Redirect to dashboard
}
```

**Logout:**
```javascript
localStorage.removeItem('adminAuth');
// Redirect to login
```

**Check Auth:**
```javascript
const isAuth = localStorage.getItem('adminAuth');
if (!isAuth) {
  router.push('/login');
}
```

---

### Payment Management

**Get Payments:**
```javascript
const { data, error } = await supabase
  .from('payments')
  .select(`
    *,
    users (
      id,
      username,
      telegram_id,
      balance
    )
  `)
  .eq('status', 'pending')
  .order('created_at', { ascending: false });
```

**Approve Payment:**
```javascript
// Update payment
await supabase
  .from('payments')
  .update({
    status: 'approved',
    amount: amount,
    updated_at: new Date().toISOString()
  })
  .eq('id', paymentId);

// Update user balance
await supabase
  .from('users')
  .update({
    balance: newBalance,
    status: 'active'
  })
  .eq('id', userId);
```

**Reject Payment:**
```javascript
await supabase
  .from('payments')
  .update({
    status: 'rejected',
    updated_at: new Date().toISOString()
  })
  .eq('id', paymentId);
```

---

### Game Management

**Get Games:**
```javascript
const { data, error } = await supabase
  .from('games')
  .select('*')
  .in('status', ['waiting', 'active'])
  .order('created_at', { ascending: false });
```

**Start Game:**
```javascript
await supabase
  .from('games')
  .update({
    status: 'active',
    started_at: new Date().toISOString()
  })
  .eq('id', gameId);
```

**End Game:**
```javascript
await supabase
  .from('games')
  .update({
    status: 'completed',
    ended_at: new Date().toISOString()
  })
  .eq('id', gameId);
```

---

## Webhook API (Vercel)

### Endpoint: `/api/webhook`

**Method:** POST

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
Telegram Update object

**Response:**
```json
{
  "ok": true
}
```

**Example:**
```javascript
// Telegram sends updates to this endpoint
POST https://your-app.vercel.app/api/webhook
{
  "update_id": 123456789,
  "message": {
    "message_id": 1,
    "from": {
      "id": 123456789,
      "username": "john_doe"
    },
    "text": "/start"
  }
}
```

---

## Error Handling

### Common Errors

**Database Errors:**
```javascript
{
  success: false,
  error: "Database connection failed"
}
```

**Validation Errors:**
```javascript
{
  success: false,
  error: "Invalid receipt number"
}
```

**Authentication Errors:**
```javascript
{
  success: false,
  error: "Unauthorized access"
}
```

### Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 500 | Server Error |

---

## Rate Limits

**Telegram Bot:**
- 30 messages/second per chat
- 20 messages/minute to same user

**Supabase:**
- Free tier: No hard limits
- Recommended: <100 requests/second

**Best Practices:**
- Implement retry logic
- Cache frequently accessed data
- Batch operations when possible

---

## Webhooks

### Set Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/webhook",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### Get Webhook Info

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

### Delete Webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

---

## Testing

### Test Bot Locally

```javascript
// Use polling instead of webhook
bot.launch({
  dropPendingUpdates: true
});
```

### Test Database

```javascript
// Run test query
const { data, error } = await supabase
  .from('users')
  .select('count')
  .limit(1);

console.log('Database connected:', !error);
```

### Test Webhook

```bash
# Send test update
curl -X POST "https://your-app.vercel.app/api/webhook" \
  -H "Content-Type: application/json" \
  -d '{"message": {"text": "/start"}}'
```

---

## SDK Examples

### Node.js (Bot)

```javascript
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

const bot = new Telegraf(process.env.BOT_TOKEN);
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

bot.start(async (ctx) => {
  const user = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', ctx.from.id)
    .single();
    
  ctx.reply(`Welcome! Balance: ${user.data.balance}`);
});

bot.launch();
```

### React (Dashboard)

```javascript
import { supabase } from '../lib/supabaseClient';

function PaymentsList() {
  const [payments, setPayments] = useState([]);
  
  useEffect(() => {
    fetchPayments();
  }, []);
  
  async function fetchPayments() {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('status', 'pending');
    setPayments(data);
  }
  
  return (
    <div>
      {payments.map(payment => (
        <PaymentCard key={payment.id} payment={payment} />
      ))}
    </div>
  );
}
```

---

**For more information, see the main [README.md](../README.md)**
