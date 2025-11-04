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
 * Winning conditions: any row, column, or diagonal
 */
export function checkBingoWin(card, calledNumbers) {
  const calledSet = new Set(calledNumbers);
  
  const isComplete = (line) => {
    return line.every(n => n === 'FREE' || calledSet.has(n));
  };

  // Check rows
  for (let i = 0; i < 5; i++) {
    if (isComplete(card[i])) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    const column = card.map(row => row[col]);
    if (isComplete(column)) return true;
  }

  // Check diagonals
  const diagonal1 = card.map((row, i) => row[i]);
  const diagonal2 = card.map((row, i) => row[4 - i]);
  
  if (isComplete(diagonal1) || isComplete(diagonal2)) return true;

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
