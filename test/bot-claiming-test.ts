/**
 * Bot Claiming Test
 * Tests the complete bot autofill and claiming flow
 */

import { supabaseAdmin } from '../lib/supabase'

async function testBotAutofillAndClaiming() {
  console.log('\n🧪 Starting Bot Autofill & Claiming Test\n')

  try {
    // Step 1: Check if bots exist
    console.log('📋 Step 1: Checking available bots...')
    const { data: bots, error: botsError } = await supabaseAdmin
      .from('bots')
      .select('id, name, difficulty, active')
      .eq('active', true)
      .limit(5)

    if (botsError) {
      console.error('❌ Error fetching bots:', botsError)
      return
    }

    console.log(`✅ Found ${bots?.length || 0} active bots:`)
    bots?.forEach((bot: any) => {
      console.log(`   - ${bot.name} (${bot.id}) - difficulty: ${bot.difficulty}`)
    })

    if (!bots || bots.length === 0) {
      console.error('❌ No active bots found. Please create some bots first.')
      return
    }

    // Step 2: Get a test room
    console.log('\n📋 Step 2: Getting test room...')
    const { data: rooms, error: roomsError } = await supabaseAdmin
      .from('rooms')
      .select('id, name, max_players, stake')
      .limit(1)

    if (roomsError || !rooms || rooms.length === 0) {
      console.error('❌ Error fetching rooms:', roomsError)
      return
    }

    const room = rooms[0]
    console.log(`✅ Using room: ${room.name} (max ${room.max_players} players, stake: ${room.stake})`)

    // Step 3: Create a test game
    console.log('\n📋 Step 3: Creating test game...')
    const { data: createResult, error: createError } = await supabaseAdmin
      .rpc('create_game_safe', {
        p_room_id: room.id,
        p_creator_id: 'test-user-' + Date.now(),
        p_stake: room.stake
      })

    if (createError || !createResult || !createResult[0]?.success) {
      console.error('❌ Error creating game:', createError || createResult?.[0]?.message)
      return
    }

    const gameId = createResult[0].game_id
    console.log(`✅ Created game: ${gameId}`)

    // Step 4: Fetch the game and check bots array
    console.log('\n📋 Step 4: Checking game state...')
    const { data: game, error: gameError } = await supabaseAdmin
      .from('games')
      .select('id, status, players, bots, called_numbers, prize_pool')
      .eq('id', gameId)
      .single()

    if (gameError || !game) {
      console.error('❌ Error fetching game:', gameError)
      return
    }

    console.log(`✅ Game state:`)
    console.log(`   - Status: ${game.status}`)
    console.log(`   - Players: ${game.players?.length || 0}`)
    console.log(`   - Bots: ${game.bots?.length || 0}`)
    console.log(`   - Prize pool: ${game.prize_pool}`)
    console.log(`   - Called numbers: ${game.called_numbers?.length || 0}`)

    if (!game.bots || game.bots.length === 0) {
      console.error('❌ Game has no bots! Autofill may not be working.')
      return
    }

    // Step 5: Manually add some numbers to test bot detection
    console.log('\n📋 Step 5: Simulating number calling...')
    const testNumbers = [1, 2, 3, 4, 5, 16, 17, 18, 19, 20]
    const { error: updateError } = await supabaseAdmin
      .from('games')
      .update({ called_numbers: testNumbers })
      .eq('id', gameId)

    if (updateError) {
      console.error('❌ Error updating called numbers:', updateError)
      return
    }

    console.log(`✅ Added ${testNumbers.length} test numbers: ${testNumbers.join(', ')}`)

    // Step 6: Check game_players table for bots
    console.log('\n📋 Step 6: Checking game_players table...')
    const { data: players, error: playersError } = await supabaseAdmin
      .from('game_players')
      .select('id, username, is_bot, bot_id, status')
      .eq('session_id', gameId)

    if (playersError) {
      console.error('❌ Error fetching game_players:', playersError)
      return
    }

    console.log(`✅ Found ${players?.length || 0} players in game:`)
    players?.forEach((player: any) => {
      console.log(`   - ${player.username} (${player.id}) - is_bot: ${player.is_bot}, bot_id: ${player.bot_id}, status: ${player.status}`)
    })

    // Step 7: Verify bot claim endpoint exists
    console.log('\n📋 Step 7: Testing bot claim endpoint...')
    try {
      const claimResponse = await fetch('http://localhost:3000/api/game/claim-bingo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          userId: game.bots[0],
          card: [
            [1, 2, 3, 4, 5],
            [16, 17, 18, 19, 20],
            [31, 32, 0, 34, 35],
            [46, 47, 48, 49, 50],
            [61, 62, 63, 64, 65]
          ],
          marked: [
            [true, true, true, true, true],
            [true, true, true, true, true],
            [true, true, true, true, true],
            [false, false, false, false, false],
            [false, false, false, false, false]
          ]
        })
      })

      const claimResult = await claimResponse.json()
      console.log(`✅ Claim endpoint response:`, claimResult)
    } catch (err) {
      console.error('❌ Error calling claim endpoint:', err)
    }

    console.log('\n✅ Bot Autofill & Claiming Test Complete!\n')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Run the test
testBotAutofillAndClaiming()
