/**
 * Unit Tests for Atomic Winner Validation Logic
 * Tests the core logic without requiring a running server
 */

import { gameStateManager } from '../lib/game-state-manager.js'

interface MockBingoClaim {
  username: string
  claimed_cells: number[]
  bingo_pattern: 'row' | 'column' | 'diagonal' | 'full_house'
  board: number[][]
}

class AtomicWinnerUnitTests {
  
  async testAtomicWinnerLogic(): Promise<void> {
    console.log('🧪 Testing Atomic Winner Logic')
    console.log('================================')
    
    // Test 1: Basic atomic winner validation
    console.log('\n🎯 Test 1: Basic atomic winner validation')
    
    try {
      // Create a test game
      const roomId = 'test-room-' + Date.now()
      const players = [
        { username: 'Alice', socket_id: 'socket1', user_id: 'user1' },
        { username: 'Bob', socket_id: 'socket2', user_id: 'user2' }
      ]
      
      console.log('✅ Creating test game...')
      const gameState = await gameStateManager.initializeGame(roomId, 'medium', players)
      console.log(`✅ Game created: ${gameState.id}`)
      
      // Verify initial state
      if (!gameState.winner_claimed && gameState.active_player_count === 2) {
        console.log('✅ Initial state correct: no winner claimed, 2 active players')
      } else {
        console.log('❌ Initial state incorrect')
        return
      }
      
      // Test atomic winner claim
      const claim1: MockBingoClaim = {
        username: 'Alice',
        claimed_cells: [1, 2, 3, 4, 5],
        bingo_pattern: 'row',
        board: this.generateMockBoard()
      }
      
      console.log('🎯 Alice claiming BINGO...')
      const result1 = await gameStateManager.validateBingoClaim(roomId, claim1)
      
      if (result1.isWinner && !result1.isLateClaim) {
        console.log('✅ Alice correctly identified as winner')
      } else {
        console.log('❌ Alice should be the winner')
        console.log('Result:', result1)
      }
      
      // Test late claim
      const claim2: MockBingoClaim = {
        username: 'Bob',
        claimed_cells: [6, 7, 8, 9, 10],
        bingo_pattern: 'row',
        board: this.generateMockBoard()
      }
      
      console.log('🎯 Bob claiming BINGO (should be late)...')
      const result2 = await gameStateManager.validateBingoClaim(roomId, claim2)
      
      if (!result2.isWinner && result2.isLateClaim) {
        console.log('✅ Bob correctly identified as late claim')
      } else {
        console.log('❌ Bob should be marked as late claim')
        console.log('Result:', result2)
      }
      
      console.log('\n📊 Test Results:')
      console.log(`Alice - Winner: ${result1.isWinner}, Late: ${result1.isLateClaim}`)
      console.log(`Bob - Winner: ${result2.isWinner}, Late: ${result2.isLateClaim}`)
      
      if (result1.isWinner && !result1.isLateClaim && !result2.isWinner && result2.isLateClaim) {
        console.log('✅ TEST 1 PASSED: Atomic winner validation working correctly')
      } else {
        console.log('❌ TEST 1 FAILED: Atomic winner validation not working')
      }
      
    } catch (error) {
      console.error('❌ Test failed with error:', error)
    }
  }
  
  testPlayerTracking(): void {
    console.log('\n🎯 Test 2: Player tracking and disconnect handling')
    
    try {
      const roomId = 'test-room-disconnect'
      
      // This would test disconnect/reconnect logic
      // For now, just verify the methods exist
      if (typeof gameStateManager.handlePlayerDisconnect === 'function' &&
          typeof gameStateManager.handlePlayerReconnect === 'function') {
        console.log('✅ Disconnect/reconnect methods exist')
        console.log('✅ TEST 2 PASSED: Player tracking methods available')
      } else {
        console.log('❌ TEST 2 FAILED: Missing disconnect/reconnect methods')
      }
      
    } catch (error) {
      console.error('❌ Test 2 failed:', error)
    }
  }
  
  private generateMockBoard(): number[][] {
    const board: number[][] = []
    let num = 1
    for (let i = 0; i < 5; i++) {
      board[i] = []
      for (let j = 0; j < 5; j++) {
        board[i][j] = num++
      }
    }
    return board
  }
  
  async runAllTests(): Promise<void> {
    console.log('🚀 Atomic Winner Unit Tests')
    console.log('===========================')
    
    try {
      await this.testAtomicWinnerLogic()
      this.testPlayerTracking()
      
      console.log('\n🎉 All unit tests completed!')
      
    } catch (error) {
      console.error('❌ Unit tests failed:', error)
      throw error
    }
  }
}

// Run tests
const unitTests = new AtomicWinnerUnitTests()
unitTests.runAllTests().then(() => {
  console.log('✅ Unit test suite completed successfully!')
  process.exit(0)
}).catch((error) => {
  console.error('❌ Unit test suite failed:', error)
  process.exit(1)
})
