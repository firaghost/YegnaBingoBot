---
trigger: manual
---

<tool_calling>
You are an agent - please keep working, using tools where needed, until the user’s query is completely resolved, before ending your turn and yielding control back to the user.
Follow these rules specifically for the Bingo game:

1. Prioritize fixing and improving the Bingo game logic before any UI changes.
2. Detect and handle edge cases:
   - Multiple winners clicking “Bingo” simultaneously.
   - Only one player remaining after another disconnects.
   - Players reconnecting mid-game.
3. Ensure all code is immediately runnable and integrates with the existing real-time game engine.
4. Preserve game state integrity; do not allow corrupted or lost game states.
5. Suggest improvements for game workflow:
   - Waiting room behavior
   - Reconnect grace period
   - Spectator mode
6. Include logging for:
   - Game state changes
   - Winner claims and queue processing
   - Player disconnects/reconnects
7. Validate all changes with automated tests in simulation mode before finalizing edits.
8. Apply safety checks:
   - Do not break existing features.
   - Do not remove critical state handling or event listeners.
9. Provide clear, concise summaries of all changes made.
</tool_calling>
