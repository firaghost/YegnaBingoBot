/**
 * Generate a random Bingo card (5x5 grid)
 * B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Center is FREE space
 */
export function generateBingoCard() {
  const card = [];
  const columns = [
    { min: 1, max: 15 },   // B
    { min: 16, max: 30 },  // I
    { min: 31, max: 45 },  // N
    { min: 46, max: 60 },  // G
    { min: 61, max: 75 }   // O
  ];

  for (let col = 0; col < 5; col++) {
    const usedNumbers = new Set();
    const column = [];
    
    for (let row = 0; row < 5; row++) {
      // Center space is FREE
      if (col === 2 && row === 2) {
        column.push('FREE');
        continue;
      }
      
      let num;
      do {
        num = Math.floor(Math.random() * (columns[col].max - columns[col].min + 1)) + columns[col].min;
      } while (usedNumbers.has(num));
      
      usedNumbers.add(num);
      column.push(num);
    }
    
    card.push(column);
  }

  // Transpose to get rows
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
