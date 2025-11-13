import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Bingo Letter Assignment (Extracted from original)
export function getBingoLetter(number: number): string {
  if (number >= 1 && number <= 15) return 'B'
  if (number >= 16 && number <= 30) return 'I'
  if (number >= 31 && number <= 45) return 'N'
  if (number >= 46 && number <= 60) return 'G'
  if (number >= 61 && number <= 75) return 'O'
  return ''
}

/**
 * Fisher-Yates shuffle algorithm (Knuth shuffle)
 * International standard for fair random shuffling
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    // Use crypto.getRandomValues for better randomness in browser
    const randomBuffer = new Uint32Array(1)
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(randomBuffer)
      const j = randomBuffer[0] % (i + 1)
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    } else {
      // Fallback for server-side
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
  }
  return shuffled
}

/**
 * Generate Bingo Card using international standard
 * B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Uses Fisher-Yates shuffle for provably fair distribution
 */
export function generateBingoCard(): number[][] {
  const card: number[][] = Array(5).fill(null).map(() => Array(5).fill(0))
  
  // Generate numbers for each column using Fisher-Yates shuffle
  for (let col = 0; col < 5; col++) {
    const min = col * 15 + 1
    const max = col * 15 + 15
    
    // Create array of all possible numbers for this column
    const columnNumbers = Array.from({ length: 15 }, (_, i) => min + i)
    
    // Shuffle using Fisher-Yates
    const shuffled = shuffleArray(columnNumbers)
    
    // Take first 5 numbers for this column
    for (let row = 0; row < 5; row++) {
      // Free space in center (N column, middle row)
      if (row === 2 && col === 2) {
        card[row][col] = 0
        continue
      }
      
      card[row][col] = shuffled[row]
    }
  }

  return card
}

// Check Bingo Win
export function checkBingoWin(marked: boolean[][]): boolean {
  // Safety check: ensure marked array exists and has proper structure
  if (!marked || !Array.isArray(marked) || marked.length !== 5) {
    return false
  }

  // Ensure all rows exist and have proper length
  for (let i = 0; i < 5; i++) {
    if (!marked[i] || !Array.isArray(marked[i]) || marked[i].length !== 5) {
      return false
    }
  }

  // Check rows
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(cell => cell)) return true
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (marked.every(row => row[col])) return true
  }

  // Check diagonals
  // Top-left to bottom-right diagonal
  if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) return true
  
  // Top-right to bottom-left diagonal  
  if (marked[0][4] && marked[1][3] && marked[2][2] && marked[3][1] && marked[4][0]) return true

  return false
}

// Format currency
export function formatCurrency(amount: number | null | undefined, currency: string = 'ETB'): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0 ${currency}`
  }
  return `${amount.toLocaleString()} ${currency}` 
}

// Random bot name generator
export function generateBotName(): string {
  const names = [
    'Player', 'Gamer', 'Winner', 'Lucky', 'Star', 'Champion', 'Pro', 'Master',
    'Ace', 'King', 'Queen', 'Knight', 'Ninja', 'Dragon', 'Phoenix', 'Eagle',
    'Warrior', 'Hunter', 'Mage', 'Priest', 'Rogue', 'Paladin', 'Shaman', 'Druid'
  ]
  const name = names[Math.floor(Math.random() * names.length)]
  const number = Math.floor(Math.random() * 9999) + 1
  return `${name}_${number}`
}
