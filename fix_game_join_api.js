// ============================================
// FIX GAME JOIN API TO USE NEW BOT SYSTEM FORMAT
// ============================================

// The current API creates games with players: [userId] array format
// But the bot system uses individual game records with user_id field
// This creates incompatibility

// CURRENT API CODE (BROKEN):
/*
const { data: newGame, error: createError } = await supabase
  .from('games')
  .insert({
    room_id: roomId,
    status: 'waiting',
    players: [userId],  // ❌ OLD FORMAT
    bots: [],
    called_numbers: [],
    stake: room.stake,
    prize_pool: room.stake
  })
*/

// FIXED API CODE (COMPATIBLE WITH BOT SYSTEM):
const { data: newGame, error: createError } = await supabase
  .from('games')
  .insert({
    room_id: roomId,
    user_id: userId,     // ✅ NEW FORMAT - individual record per player
    status: 'waiting',
    stake: room.stake,
    game_level: 'medium'
  })

// EXPLANATION:
// 1. Remove players array - use user_id field instead
// 2. Create individual game record for each player
// 3. This matches the bot system format exactly
// 4. Frontend will now find your game record

// ADDITIONAL CHANGES NEEDED:
// 1. Update the "join existing game" logic
// 2. Remove players array updates
// 3. Use user_id based queries consistently

console.log('🔧 Game Join API needs to be updated to use bot system format')
console.log('📝 Replace players array with individual user_id records')
console.log('✅ This will make real players compatible with bot system')
