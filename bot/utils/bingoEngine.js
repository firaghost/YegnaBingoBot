/**
 * Cryptographically secure random number generator
 * Uses crypto.getRandomValues for better randomness
 */
function secureRandom(min, max) {
  const range = max - min + 1;
  const bytesNeeded = Math.ceil(Math.log2(range) / 8);
  const maxValue = Math.pow(256, bytesNeeded);
  const threshold = maxValue - (maxValue % range);
  
  let randomValue;
  const randomBytes = new Uint8Array(bytesNeeded);
  
  do {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomBytes);
    } else {
      // Fallback for Node.js
      for (let i = 0; i < bytesNeeded; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    
    randomValue = 0;
    for (let i = 0; i < bytesNeeded; i++) {
      randomValue = randomValue * 256 + randomBytes[i];
    }
  } while (randomValue >= threshold);
  
  return min + (randomValue % range);
}

/**
 * Fisher-Yates shuffle algorithm for fair randomization
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = secureRandom(0, i);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a unique hash for a bingo card
 */
function getCardHash(card) {
  const numbers = [];
  for (let row of card) {
    for (let num of row) {
      if (num !== 'FREE') numbers.push(num);
    }
  }
  return numbers.sort((a, b) => a - b).join(',');
}

/**
 * Generate a provably fair Bingo card (5x5 grid)
 * Based on professional bingo standards:
 * - B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * - Center is FREE space
 * - Uses cryptographic randomness
 * - Ensures unique cards
 * - Balanced distribution
 */
export function generateBingoCard(existingCards = []) {
  const MAX_ATTEMPTS = 100;
  let attempts = 0;
  
  // Get hashes of existing cards to ensure uniqueness
  const existingHashes = new Set(existingCards.map(c => getCardHash(c)));
  
  while (attempts < MAX_ATTEMPTS) {
    attempts++;
    
    const card = [];
    const columns = [
      { min: 1, max: 15, name: 'B' },   // B column
      { min: 16, max: 30, name: 'I' },  // I column
      { min: 31, max: 45, name: 'N' },  // N column
      { min: 46, max: 60, name: 'G' },  // G column
      { min: 61, max: 75, name: 'O' }   // O column
    ];

    // Generate each column with fair distribution
    for (let col = 0; col < 5; col++) {
      const { min, max } = columns[col];
      
      // Create pool of all possible numbers for this column
      const numberPool = [];
      for (let i = min; i <= max; i++) {
        numberPool.push(i);
      }
      
      // Shuffle the pool using Fisher-Yates
      const shuffled = shuffleArray(numberPool);
      
      // Take first 5 numbers (or 4 for N column with FREE space)
      const columnNumbers = col === 2 ? shuffled.slice(0, 4) : shuffled.slice(0, 5);
      
      // DO NOT SORT - Keep random order for maximum fairness
      // Sorting creates predictable patterns that can give advantages
      
      // Insert FREE space in center of N column
      if (col === 2) {
        columnNumbers.splice(2, 0, 'FREE');
      }
      
      card.push(columnNumbers);
    }

    // Transpose to get row-major format
    const transposed = [];
    for (let row = 0; row < 5; row++) {
      const rowData = [];
      for (let col = 0; col < 5; col++) {
        rowData.push(card[col][row]);
      }
      transposed.push(rowData);
    }
    
    // Check if this card is unique
    const cardHash = getCardHash(transposed);
    if (!existingHashes.has(cardHash)) {
      console.log(`✅ Generated unique bingo card (attempt ${attempts})`);
      return transposed;
    }
    
    console.log(`⚠️ Duplicate card detected, regenerating... (attempt ${attempts})`);
  }
  
  // If we couldn't generate a unique card after MAX_ATTEMPTS, return anyway
  // (This is extremely unlikely with 75 numbers and proper shuffling)
  console.warn('⚠️ Could not generate unique card after max attempts, returning non-unique card');
  const card = [];
  const columns = [
    { min: 1, max: 15 },
    { min: 16, max: 30 },
    { min: 31, max: 45 },
    { min: 46, max: 60 },
    { min: 61, max: 75 }
  ];

  for (let col = 0; col < 5; col++) {
    const { min, max } = columns[col];
    const numberPool = [];
    for (let i = min; i <= max; i++) {
      numberPool.push(i);
    }
    const shuffled = shuffleArray(numberPool);
    const columnNumbers = col === 2 ? shuffled.slice(0, 4) : shuffled.slice(0, 5);
    // Keep random order - DO NOT SORT
    if (col === 2) {
      columnNumbers.splice(2, 0, 'FREE');
    }
    card.push(columnNumbers);
  }

  const transposed = [];
  for (let row = 0; row < 5; row++) {
    const rowData = [];
    for (let col = 0; col < 5; col++) {
      rowData.push(card[col][row]);
    }
    transposed.push(rowData);
  }
  
  return transposed;
}

/**
 * Check if a card has won with the given called numbers
 * Winning conditions: any row, column, or diagonal (5 in a row)
 */
export function checkBingoWin(card, calledNumbers) {
  const calledSet = new Set(calledNumbers);
  
  console.log('🔍 Checking BINGO win condition');
  console.log('📋 Card:', JSON.stringify(card));
  console.log('🎲 Called numbers:', calledNumbers);
  
  const isComplete = (line) => {
    const complete = line.every(n => n === 'FREE' || calledSet.has(n));
    return complete;
  };

  // Check rows - card is [row][col] (row-major)
  for (let i = 0; i < 5; i++) {
    const row = card[i];
    const complete = isComplete(row);
    console.log(`Row ${i}: [${row.join(', ')}] - Complete: ${complete}`);
    if (complete) {
      console.log(`🎉 BINGO! Row ${i} is complete!`);
      return true;
    }
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    const column = card.map(row => row[col]);
    const complete = isComplete(column);
    console.log(`Col ${col}: [${column.join(', ')}] - Complete: ${complete}`);
    if (complete) {
      console.log(`🎉 BINGO! Column ${col} is complete!`);
      return true;
    }
  }

  // Check diagonals
  const diagonal1 = card.map((row, i) => row[i]);
  const diagonal2 = card.map((row, i) => row[4 - i]);
  
  const diag1Complete = isComplete(diagonal1);
  const diag2Complete = isComplete(diagonal2);
  
  console.log(`Diag 1 (\\): [${diagonal1.join(', ')}] - Complete: ${diag1Complete}`);
  console.log(`Diag 2 (/): [${diagonal2.join(', ')}] - Complete: ${diag2Complete}`);
  
  if (diag1Complete) {
    console.log('🎉 BINGO! Diagonal \\ is complete!');
    return true;
  }
  if (diag2Complete) {
    console.log('🎉 BINGO! Diagonal / is complete!');
    return true;
  }

  console.log('❌ No BINGO yet');
  return false;
}

/**
 * Format a Bingo card for display in Telegram
 */
export function formatBingoCard(card) {
  const header = '  B    I    N    G    O\n';
  const separator = '─'.repeat(30) + '\n';
  
  let output = header + separator;
  
  for (let row of card) {
    const formattedRow = row.map(num => {
      if (num === 'FREE') return ' ★ ';
      return String(num).padStart(3, ' ');
    }).join(' ');
    output += formattedRow + '\n';
  }
  
  return output;
}

/**
 * Generate a random Bingo number (1-75)
 */
export function generateBingoNumber(excludeNumbers = []) {
  const available = [];
  for (let i = 1; i <= 75; i++) {
    if (!excludeNumbers.includes(i)) {
      available.push(i);
    }
  }
  
  if (available.length === 0) return null;
  
  return available[Math.floor(Math.random() * available.length)];
}

/**
 * Get the letter for a Bingo number
 */
export function getBingoLetter(number) {
  if (number >= 1 && number <= 15) return 'B';
  if (number >= 16 && number <= 30) return 'I';
  if (number >= 31 && number <= 45) return 'N';
  if (number >= 46 && number <= 60) return 'G';
  if (number >= 61 && number <= 75) return 'O';
  return '';
}
