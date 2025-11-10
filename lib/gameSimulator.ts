// Game Simulator for multiplayer experience
export type GameStatus = 'countdown' | 'waiting' | 'active' | 'finished'

export interface CalledNumber {
  letter: string
  number: number
}

export interface GameState {
  status: GameStatus
  countdownTime: number
  calledNumbers: number[]
  latestNumber: CalledNumber | null
  players: number
  prizePool: number
  stake: number
}

export class GameSimulator {
  private state: GameState
  private countdownInterval: NodeJS.Timeout | null = null
  private gameInterval: NodeJS.Timeout | null = null
  private listeners: ((state: GameState) => void)[] = []

  constructor(stake: number = 10) {
    this.state = {
      status: 'countdown',
      countdownTime: 10,
      calledNumbers: [],
      latestNumber: null,
      players: Math.floor(Math.random() * 50) + 100,
      prizePool: stake * 100,
      stake
    }
  }

  start() {
    this.startCountdown()
  }

  private startCountdown() {
    this.state.status = 'countdown'
    this.state.countdownTime = 10
    this.notifyListeners()

    this.countdownInterval = setInterval(() => {
      this.state.countdownTime--
      this.notifyListeners()

      if (this.state.countdownTime <= 0) {
        this.stopCountdown()
        this.startGame()
      }
    }, 1000)
  }

  private startGame() {
    this.state.status = 'active'
    this.state.calledNumbers = []
    this.notifyListeners()

    // Call numbers every 3 seconds
    this.gameInterval = setInterval(() => {
      this.callNextNumber()
    }, 3000)
  }

  private callNextNumber() {
    if (this.state.calledNumbers.length >= 75) {
      this.endGame()
      return
    }

    let num: number
    do {
      num = Math.floor(Math.random() * 75) + 1
    } while (this.state.calledNumbers.includes(num))

    const letter = this.getLetterForNumber(num)
    this.state.calledNumbers.push(num)
    this.state.latestNumber = { letter, number: num }
    this.notifyListeners()

    // Simulate bot winning after 20-35 numbers (5% chance each call)
    if (this.state.calledNumbers.length > 20 && Math.random() < 0.05) {
      setTimeout(() => this.endGame(), 2000)
    }
  }

  private getLetterForNumber(num: number): string {
    if (num <= 15) return 'B'
    if (num <= 30) return 'I'
    if (num <= 45) return 'N'
    if (num <= 60) return 'G'
    return 'O'
  }

  private endGame() {
    this.state.status = 'finished'
    this.cleanup()
    this.notifyListeners()
  }

  private stopCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval)
      this.countdownInterval = null
    }
  }

  subscribe(listener: (state: GameState) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener({ ...this.state }))
  }

  getState(): GameState {
    return { ...this.state }
  }

  cleanup() {
    this.stopCountdown()
    if (this.gameInterval) {
      clearInterval(this.gameInterval)
      this.gameInterval = null
    }
  }
}
