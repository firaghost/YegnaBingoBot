export async function handleHelp(ctx) {
  const helpMessage = `
🎮 **Bingo Vault - Help**

**Available Commands:**

/start - Register or view your account
/balance - Check your current balance
/receipt <number> [amount] - Submit payment receipt
/play - Join or create a Bingo game
/status - Check current game status
/help - Show this help message

**How to Play:**

1️⃣ **Register**: Use /start to create your account

2️⃣ **Deposit**: Send your payment receipt using /receipt
   Example: \`/receipt REC123456 100\`
   You can also send a photo with the receipt number

3️⃣ **Wait**: Admin will verify and approve your payment

4️⃣ **Play**: Use /play to join a game (10 Birr per game)

5️⃣ **Win**: Get BINGO by completing a row, column, or diagonal!

**Game Rules:**

• Entry fee: 10 Birr per game
• Winner takes the entire prize pool
• Numbers are called automatically
• First player to get BINGO wins
• Winning patterns: any row, column, or diagonal

**Need Help?**

Contact support if you have any questions or issues.

Good luck! 🍀
`;

  return ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}
