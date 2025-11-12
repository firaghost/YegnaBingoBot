---
description: Bingo Game Workflow
auto_execution_mode: 1
---

<workflows>
# Bingo Game Workflow

**Trigger:** /fix-bingo-logic

**Steps Cascade should follow:**

1. **Analyze Game Code**
   - Locate all game logic files related to Bingo.
   - Identify functions handling winner claims, player disconnects, and game end conditions.

2. **Check Edge Cases**
   - Detect multiple winners clicking “Bingo” simultaneously.
   - Detect scenarios where only one player remains after others disconnect.
   - Detect reconnection scenarios for players mid-game.

3. **Implement Fixes**
   - Add a queue system for winner claims to prevent stacking issues.
   - Implement a reconnect grace period for dropped players.
   - Add spectator mode to allow non-participating users to observe ongoing games.

4. **Add Logging**
   - Log winner claims, including timestamp and player ID.
   - Log player disconnects/reconnects.
   - Log game state transitions (waiting → in-progress → finished).

5. **Automated Simulation Testing**
   - Run multiple simulated players (2–10) to test winner detection.
   - Simulate disconnects and reconnects to ensure game state consistency.
   - Test spectator mode to ensure observers see correct game updates.

6. **Safety Checks**
   - Confirm no existing features are broken.
   - Verify that critical state handling and event listeners remain intact.
   - Ensure all fixes are backward-compatible.

7. **Generate Summary**
   - Provide a concise summary of changes.
   - Include which edge cases were fixed and improvements added.
   - Suggest any optional enhancements for future iterations.
</workflows>
