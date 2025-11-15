# YegnaBingoBot Backend Testing PRD

**Product:** YegnaBingoBot - Telegram-based Multiplayer Bingo Game  
**Version:** 1.0  
**Date:** November 15, 2025  
**Scope:** Backend API Testing with TestSprite  

---

## 1. Executive Summary

This PRD defines comprehensive backend API testing requirements for YegnaBingoBot. The backend consists of Next.js API routes that handle game logic, player management, leaderboards, and real-time game state management. TestSprite will generate and execute test cases to ensure reliability, correctness, and performance of all critical backend endpoints.

---

## 2. System Architecture Overview

### 2.1 Tech Stack
- **Framework:** Next.js 14 (TypeScript)
- **Database:** Supabase (PostgreSQL)
- **Real-time:** Socket.IO
- **Authentication:** Telegram Web App
- **Deployment:** Railway (Production)

### 2.2 Core Components
1. **Game Management** - Create, join, and manage game sessions
2. **Player Management** - Track player state, wins, losses, XP
3. **Leaderboard System** - Weekly and monthly rankings
4. **Game Tick System** - Atomic number calling and state progression
5. **Bingo Validation** - Atomic winner detection and claim validation

---

## 3. API Endpoints to Test

### 3.1 Game Management APIs

#### 3.1.1 POST `/api/game/join`
**Purpose:** Join an existing game or create a new one  
**Authentication:** None (userId provided in body)  
**Request Body:**
```json
{
  "roomId": "room_uuid",
  "userId": "user_uuid"
}
```

**Expected Responses:**
- **201 Created:** New game created
  ```json
  {
    "success": true,
    "gameId": "game_uuid",
    "game": { /* game object */ },
    "action": "created"
  }
  ```
- **200 OK:** Joined existing game
  ```json
  {
    "success": true,
    "gameId": "game_uuid",
    "game": { /* game object */ },
    "action": "joined"
  }
  ```
- **200 OK:** Already in game
  ```json
  {
    "success": true,
    "gameId": "game_uuid",
    "game": { /* game object */ },
    "action": "already_joined"
  }
  ```
- **400 Bad Request:** Missing required fields
- **404 Not Found:** Room not found
- **500 Internal Server Error:** Database error

**Test Cases:**
- TC-001: Join game with valid roomId and userId
- TC-002: Join game when game already exists
- TC-003: Rejoin game as existing player
- TC-004: Join with invalid roomId (404)
- TC-005: Join with missing userId (400)
- TC-006: Join with missing roomId (400)
- TC-007: Multiple players joining same game sequentially
- TC-008: Race condition - multiple players joining simultaneously
- TC-009: Join game with bot auto-fill
- TC-010: Join game and verify prize pool updates

**Success Criteria:**
- Game is created with correct initial state
- Players are added to game correctly
- Prize pool increases with each player join
- Bots are auto-filled when needed
- Race conditions are handled atomically

---

#### 3.1.2 POST `/api/game/tick`
**Purpose:** Advance game state by one step (countdown, number calling, game end)  
**Authentication:** None  
**Request Body:**
```json
{
  "gameId": "game_uuid"
}
```

**Expected Responses:**
- **200 OK:** Countdown in progress
  ```json
  {
    "success": true,
    "action": "countdown",
    "countdown_time": 9,
    "message": "Countdown: 9"
  }
  ```
- **200 OK:** Game started
  ```json
  {
    "success": true,
    "action": "start",
    "message": "Game started!",
    "sequence_hash": "abc123..."
  }
  ```
- **200 OK:** Number called
  ```json
  {
    "success": true,
    "action": "call_number",
    "latest_number": { "letter": "B", "number": 5 },
    "total_called": 1,
    "message": "Called B5"
  }
  ```
- **200 OK:** Game ended
  ```json
  {
    "success": true,
    "action": "end",
    "message": "Game has a winner"
  }
  ```
- **400 Bad Request:** Missing gameId
- **500 Internal Server Error:** Database error

**Test Cases:**
- TC-011: Tick countdown from 10 to 0
- TC-012: Tick transitions from countdown to active
- TC-013: Tick calls numbers sequentially
- TC-014: Tick stops calling when winner exists
- TC-015: Tick handles all 75 numbers called
- TC-016: Tick with race condition (multiple simultaneous ticks)
- TC-017: Tick with invalid gameId (404)
- TC-018: Tick with missing gameId (400)
- TC-019: Verify number sequence is deterministic (hash matches)
- TC-020: Verify no duplicate numbers are called

**Success Criteria:**
- Countdown decrements correctly
- Game transitions to active at countdown 0
- Numbers are called in pre-shuffled sequence
- No duplicate numbers are called
- Race conditions are handled atomically
- Game ends when all numbers are called

---

#### 3.1.3 POST `/api/game/complete`
**Purpose:** Mark game as complete and update player stats  
**Authentication:** None  
**Request Body:**
```json
{
  "userId": "telegram_id",
  "result": "win|lose",
  "levelName": "easy|medium|hard",
  "gameId": "game_uuid"
}
```

**Expected Responses:**
- **200 OK:** Game completed (win)
  ```json
  {
    "success": true,
    "result": "win",
    "level": "easy",
    "xpGained": 100,
    "newXP": 500,
    "newWins": 5,
    "rankUp": true,
    "oldRank": 1,
    "newRank": 2,
    "leaderboard": { "weekly": 3, "monthly": 5 },
    "message": "🎉 You won on EASY level! +100 XP 🎊 RANK UP: 2!"
  }
  ```
- **200 OK:** Game completed (loss)
  ```json
  {
    "success": true,
    "result": "lose",
    "level": "easy",
    "message": "😔 You lost on easy level. Try again!"
  }
  ```
- **400 Bad Request:** Invalid result or level
- **404 Not Found:** User or level not found
- **500 Internal Server Error:** Stats update failed

**Test Cases:**
- TC-021: Complete game with win result
- TC-022: Complete game with loss result
- TC-023: Verify XP is awarded on win
- TC-024: Verify rank progression on win
- TC-025: Verify leaderboard positions updated
- TC-026: Complete with invalid result (400)
- TC-027: Complete with invalid level (400)
- TC-028: Complete with non-existent user (404)
- TC-029: Complete with non-existent level (404)
- TC-030: Verify games_played increments on loss

**Success Criteria:**
- XP is correctly awarded on win
- Rank progression is calculated correctly
- Leaderboard positions are updated
- Games played counter increments
- Invalid inputs are rejected with 400
- Missing resources return 404

---

### 3.2 Leaderboard APIs

#### 3.2.1 GET `/api/leaderboard`
**Purpose:** Retrieve leaderboard rankings  
**Authentication:** None  
**Query Parameters:**
- `limit` (optional, default: 10) - Number of results
- `period` (optional, default: "weekly") - "weekly" or "monthly"
- `userId` (optional) - Get user's position

**Expected Responses:**
- **200 OK:** Leaderboard retrieved
  ```json
  {
    "leaderboard": [
      {
        "rank": 1,
        "username": "player1",
        "xp": 1000,
        "wins": 50,
        "level_progress": 5
      }
    ],
    "userPosition": {
      "rank": 15,
      "username": "currentUser",
      "xp": 500,
      "wins": 25,
      "level_progress": 3
    },
    "totalParticipants": 150,
    "period": "weekly"
  }
  ```
- **400 Bad Request:** Invalid period
- **500 Internal Server Error:** Database error

**Test Cases:**
- TC-031: Get weekly leaderboard (default)
- TC-032: Get monthly leaderboard
- TC-033: Get leaderboard with custom limit
- TC-034: Get user position in leaderboard
- TC-035: Get leaderboard with invalid period (400)
- TC-036: Verify leaderboard is sorted by XP descending
- TC-037: Verify rank numbers are sequential
- TC-038: Get leaderboard with limit=1
- TC-039: Get leaderboard with limit=100
- TC-040: Verify totalParticipants count

**Success Criteria:**
- Leaderboard is sorted by XP (descending)
- Ranks are sequential and correct
- User position is accurate
- Invalid periods are rejected
- Limit parameter works correctly

---

#### 3.2.2 POST `/api/leaderboard` (Admin)
**Purpose:** Admin operations on leaderboard (reset, recalculate)  
**Authentication:** Admin API key required  
**Request Body:**
```json
{
  "action": "reset|recalculate",
  "period": "weekly|monthly",
  "adminKey": "admin_api_key"
}
```

**Expected Responses:**
- **200 OK:** Operation successful
  ```json
  {
    "success": true,
    "message": "weekly leaderboard reset successfully"
  }
  ```
- **400 Bad Request:** Invalid action or period
- **401 Unauthorized:** Invalid admin key
- **500 Internal Server Error:** Operation failed

**Test Cases:**
- TC-041: Reset weekly leaderboard (admin)
- TC-042: Reset monthly leaderboard (admin)
- TC-043: Recalculate weekly leaderboard (admin)
- TC-044: Recalculate monthly leaderboard (admin)
- TC-045: Admin operation with invalid key (401)
- TC-046: Admin operation with invalid action (400)
- TC-047: Admin operation with invalid period (400)
- TC-048: Verify leaderboard is empty after reset
- TC-049: Verify ranks are recalculated correctly
- TC-050: Admin operations don't affect game data

**Success Criteria:**
- Admin operations require valid API key
- Reset clears leaderboard data
- Recalculate updates ranks correctly
- Invalid inputs are rejected
- Operations are atomic

---

## 4. Test Scenarios

### 4.1 Happy Path Scenarios

**Scenario 1: Complete Game Flow**
1. Create new game via `/api/game/join`
2. Verify game is in "waiting" status
3. Tick game 10 times to countdown
4. Verify game transitions to "active"
5. Tick game 75 times to call all numbers
6. Complete game via `/api/game/complete` with win
7. Verify player XP increased
8. Verify leaderboard updated

**Scenario 2: Multiple Players Joining**
1. Player 1 joins game (creates new game)
2. Player 2 joins same game
3. Player 3 joins same game
4. Verify all players in game
5. Verify prize pool = 3 × stake
6. Verify bots are auto-filled

**Scenario 3: Leaderboard Progression**
1. Player wins 5 games
2. Verify XP increases by 5 × xp_reward
3. Verify rank progresses
4. Verify leaderboard position updates
5. Get leaderboard and verify player is ranked

### 4.2 Edge Cases

**Scenario 4: Race Conditions**
1. 10 players simultaneously join same game
2. Verify all players are added atomically
3. Verify no duplicate players
4. Verify prize pool is correct

**Scenario 5: Simultaneous Ticks**
1. Start game
2. Send 5 tick requests simultaneously
3. Verify only one number is called
4. Verify no duplicate numbers

**Scenario 6: Game State Transitions**
1. Verify game cannot transition from active to waiting
2. Verify game cannot be completed twice
3. Verify completed game cannot accept new players

### 4.3 Error Scenarios

**Scenario 7: Invalid Inputs**
1. Join with missing roomId (400)
2. Join with missing userId (400)
3. Complete with invalid result (400)
4. Complete with invalid level (400)
5. Get leaderboard with invalid period (400)

**Scenario 8: Not Found Errors**
1. Join non-existent room (404)
2. Complete for non-existent user (404)
3. Complete for non-existent level (404)

---

## 5. Performance Requirements

### 5.1 Response Time SLAs
- **Game Join:** < 500ms (p95)
- **Game Tick:** < 200ms (p95)
- **Game Complete:** < 500ms (p95)
- **Leaderboard Get:** < 300ms (p95)

### 5.2 Throughput Requirements
- **Concurrent Players:** Support 1000+ simultaneous connections
- **Requests/Second:** 100+ RPS per endpoint
- **Database Connections:** Connection pooling with max 20 connections

### 5.3 Reliability Requirements
- **Availability:** 99.9% uptime
- **Error Rate:** < 0.1% (5xx errors)
- **Race Condition Handling:** 100% atomic operations

---

## 6. Data Validation Rules

### 6.1 Game State Validation
- Game status must be one of: "waiting", "countdown", "active", "finished"
- Countdown time must be 0-10
- Called numbers must be 1-75
- Called numbers must be unique
- Players array must not have duplicates
- Prize pool must equal sum of all player stakes

### 6.2 Player Data Validation
- User ID must be valid UUID
- XP must be non-negative integer
- Wins must be non-negative integer
- Level progress must be 1-10

### 6.3 Leaderboard Data Validation
- Rank must be sequential starting from 1
- XP must be sorted descending
- Period must be "weekly" or "monthly"

---

## 7. Security Requirements

### 7.1 Authentication
- Game join endpoints do not require auth (userId in body)
- Admin endpoints require valid API key
- All endpoints use Supabase RLS policies

### 7.2 Authorization
- Players can only complete their own games
- Admin operations require admin key
- No direct database access from client

### 7.3 Data Protection
- All sensitive data encrypted in transit (HTTPS)
- Database uses RLS policies
- Admin API key not logged or exposed

---

## 8. Monitoring & Observability

### 8.1 Logging
- Log all API requests with timestamp and duration
- Log game state transitions
- Log error details with stack traces
- Log race condition detections

### 8.2 Metrics
- Request latency (p50, p95, p99)
- Error rate by endpoint
- Database query performance
- Cache hit rates

### 8.3 Alerts
- Alert on error rate > 1%
- Alert on latency p95 > 1s
- Alert on database connection pool exhaustion
- Alert on 5xx errors

---

## 9. Test Execution Strategy

### 9.1 Test Phases
1. **Unit Tests** - Individual endpoint logic
2. **Integration Tests** - Multi-endpoint workflows
3. **Load Tests** - Performance under load
4. **Chaos Tests** - Race conditions and failures

### 9.2 Test Environment
- **Database:** Supabase staging environment
- **Server:** Local dev server on port 3001
- **Test Runner:** TestSprite with Jest/Vitest

### 9.3 Test Data
- Pre-seeded users (10 test users)
- Pre-seeded rooms (5 test rooms)
- Pre-seeded levels (easy, medium, hard)

---

## 10. Success Criteria

### 10.1 Test Coverage
- **Endpoint Coverage:** 100% of critical endpoints
- **Scenario Coverage:** All happy path, edge case, and error scenarios
- **Code Coverage:** > 80% of backend code

### 10.2 Quality Gates
- All tests must pass
- No flaky tests (100% pass rate on 3 runs)
- Error rate < 0.1%
- Latency p95 < 500ms

### 10.3 Documentation
- Test plan with all test cases
- Test results report
- Coverage report
- Performance report

---

## 11. Deliverables

1. **Test Plan** - Detailed test cases for all endpoints
2. **Test Suite** - Automated tests in Jest/Vitest
3. **Test Results** - Pass/fail report with metrics
4. **Coverage Report** - Code coverage analysis
5. **Performance Report** - Latency and throughput metrics
6. **Recommendations** - Improvements and optimizations

---

## 12. Timeline

- **Phase 1 (Week 1):** Test plan creation and endpoint analysis
- **Phase 2 (Week 2):** Test case generation and implementation
- **Phase 3 (Week 3):** Test execution and debugging
- **Phase 4 (Week 4):** Performance testing and optimization

---

## 13. Appendix

### 13.1 API Endpoint Summary Table

| Endpoint | Method | Purpose | Auth | Status |
|----------|--------|---------|------|--------|
| `/api/game/join` | POST | Join/create game | None | Ready |
| `/api/game/tick` | POST | Advance game state | None | Ready |
| `/api/game/complete` | POST | Complete game | None | Ready |
| `/api/game/start` | POST | Start game loop | None | Deprecated |
| `/api/leaderboard` | GET | Get leaderboard | None | Ready |
| `/api/leaderboard` | POST | Admin operations | Admin Key | Ready |

### 13.2 Database Schema References
- `games` table - Game sessions
- `users` table - Player data
- `rooms` table - Game rooms
- `levels` table - Game difficulty levels
- `current_leaderboard` view - Leaderboard rankings

### 13.3 Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_KEY` - Supabase service role key
- `ADMIN_API_KEY` - Admin API key for protected endpoints

---

**Document Version:** 1.0  
**Last Updated:** November 15, 2025  
**Author:** YegnaBingoBot Development Team  
**Status:** Ready for TestSprite Implementation
