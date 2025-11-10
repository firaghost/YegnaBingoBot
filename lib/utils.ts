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

// Generate Bingo Card
export function generateBingoCard(): number[][] {
  const card: number[][] = []
  const used = new Set<number>()

  for (let row = 0; row < 5; row++) {
    card[row] = []
    for (let col = 0; col < 5; col++) {
      // Free space in center
      if (row === 2 && col === 2) {
        card[row][col] = 0
        continue
      }

      const min = col * 15 + 1
      const max = col * 15 + 15
      let num: number
      
      do {
        num = Math.floor(Math.random() * (max - min + 1)) + min
      } while (used.has(num))
      
      used.add(num)
      card[row][col] = num
    }
  }

  return card
}

// Check Bingo Win
export function checkBingoWin(marked: boolean[][]): boolean {
  // Check rows
  for (let row = 0; row < 5; row++) {
    if (marked[row].every(cell => cell)) return true
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    if (marked.every(row => row[col])) return true
  }

  // Check diagonals
  if (marked[0][0] && marked[1][1] && marked[2][2] && marked[3][3] && marked[4][4]) return true

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
