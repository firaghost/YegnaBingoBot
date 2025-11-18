/**
 * Utility functions for testing race condition fixes
 */

import { supabaseAdmin } from './supabase';

/**
 * Simulate concurrent game ticks to test race condition handling
 */
export async function simulateConcurrentGameTicks(gameId: string, concurrentTicks: number = 5): Promise<void> {
  console.log(`🧪 Simulating ${concurrentTicks} concurrent game ticks for game ${gameId}`);
  
  const promises: Promise<any>[] = [];
  
  for (let i = 0; i < concurrentTicks; i++) {
    promises.push(fetch('/api/game/tick', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ gameId }),
    }));
  }
  
  try {
    const results = await Promise.all(promises);
    console.log(`✅ Completed ${concurrentTicks} concurrent game ticks`);
    return results as any;
  } catch (error) {
    console.error(`❌ Error in concurrent game ticks simulation:`, error);
    throw error;
  }
}

/**
 * Simulate concurrent bingo claims to test race condition handling
 */
export async function simulateConcurrentBingoClaims(
  gameId: string, 
  claims: Array<{ userId: string; card: number[][]; marked: boolean[][] }>,
  delayMs: number = 10
): Promise<void> {
  console.log(`🧪 Simulating ${claims.length} concurrent bingo claims for game ${gameId}`);
  
  const promises: Promise<any>[] = [];
  
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    
    // Add slight delay between requests to simulate realistic concurrent access
    promises.push(
      new Promise(resolve => setTimeout(resolve, i * delayMs)).then(() =>
        fetch('/api/game/claim-bingo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            gameId,
            userId: claim.userId,
            card: claim.card,
            marked: claim.marked,
          }),
        })
      )
    );
  }
  
  try {
    const results = await Promise.all(promises);
    console.log(`✅ Completed ${claims.length} concurrent bingo claims`);
    return results as any;
  } catch (error) {
    console.error(`❌ Error in concurrent bingo claims simulation:`, error);
    throw error;
  }
}

/**
 * Validate that only one winner exists for a game
 */
export async function validateSingleWinner(gameId: string): Promise<{ 
  isValid: boolean; 
  winnerCount: number; 
  winners: string[] 
}> {
  try {
    const { data: game, error } = await supabaseAdmin
      .from('games')
      .select('winner_id, players, bots')
      .eq('id', gameId)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch game: ${error.message}`);
    }
    
    if (!game) {
      return { isValid: false, winnerCount: 0, winners: [] };
    }
    
    const winners: string[] = [];
    
    // Check if there's a winner_id
    if (game.winner_id) {
      winners.push(game.winner_id);
    }
    
    return {
      isValid: winners.length <= 1,
      winnerCount: winners.length,
      winners
    };
  } catch (error) {
    console.error(`❌ Error validating single winner:`, error);
    throw error;
  }
}

/**
 * Validate that numbers are called only once
 */
export async function validateUniqueNumberCalls(gameId: string): Promise<{ 
  isValid: boolean; 
  duplicateNumbers: number[] 
}> {
  try {
    const { data: game, error } = await supabaseAdmin
      .from('games')
      .select('called_numbers')
      .eq('id', gameId)
      .single();
    
    if (error) {
      throw new Error(`Failed to fetch game: ${error.message}`);
    }
    
    if (!game || !game.called_numbers) {
      return { isValid: true, duplicateNumbers: [] };
    }
    
    const calledNumbers = game.called_numbers;
    const numberCounts: Record<number, number> = {};
    const duplicates: number[] = [];
    
    // Count occurrences of each number
    for (const num of calledNumbers) {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
      if (numberCounts[num] === 2) {
        // First time we see a duplicate
        duplicates.push(num);
      }
    }
    
    return {
      isValid: duplicates.length === 0,
      duplicateNumbers: duplicates
    };
  } catch (error) {
    console.error(`❌ Error validating unique number calls:`, error);
    throw error;
  }
}