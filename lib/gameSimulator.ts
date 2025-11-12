// Game Simulator for multiplayer experience with difficulty levels
export type GameStatus = 'countdown' | 'waiting' | 'active' | 'finished'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface CalledNumber {
  letter: string
  number: number
}

export interface LevelSettings {
  name: DifficultyLevel
  callInterval: number
  winThreshold: number
  xpReward: number
  description: string
}

export interface GameState {
  status: GameStatus
  countdownTime: number
  calledNumbers: number[]
  latestNumber: CalledNumber | null
  players: number
  prizePool: number
  stake: number
  level: DifficultyLevel
  levelSettings: LevelSettings
}

export class GameSimulator {
  private state: GameState
  private countdownInterval: NodeJS.Timeout | null = null
  private gameInterval: NodeJS.Timeout | null = null
  private listeners: ((state: GameState) => void)[] = []

  constructor(stake: number = 10, level: DifficultyLevel = 'medium') {
    const levelSettings = this.getLevelSettings(level)
    
    this.state = {
      status: 'countdown',
      countdownTime: 10,
      calledNumbers: [],
      latestNumber: null,
      players: Math.floor(Math.random() * 50) + 100,
      prizePool: stake * 100,
      stake,
      level,
      levelSettings
    }
  }

  private getLevelSettings(level: DifficultyLevel): LevelSettings {
    const settings = {
      easy: {
        name: 'easy' as DifficultyLevel,
        callInterval: 1000,
        winThreshold: 3,
        xpReward: 10,
        description: 'Quick, easy round - perfect for beginners'
      },
      medium: {
        name: 'medium' as DifficultyLevel,
        callInterval: 2000,
        winThreshold: 5,
        xpReward: 25,
        description: 'Balanced challenge with moderate rewards'
      },
      hard: {
        name: 'hard' as DifficultyLevel,
        callInterval: 3000,
        winThreshold: 7,
        xpReward: 50,
        description: 'Longer, strategic game with high rewards'
      }
    }
    
    return settings[level]
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

    // Call numbers based on level difficulty
    this.gameInterval = setInterval(() => {
      this.callNextNumber()
    }, this.state.levelSettings.callInterval)
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

    // Simulate bot winning based on difficulty level
    const minNumbers = this.state.levelSettings.winThreshold + 10
    const winChance = this.state.level === 'easy' ? 0.08 : 
                     this.state.level === 'medium' ? 0.05 : 0.03
    
    if (this.state.calledNumbers.length > minNumbers && Math.random() < winChance) {
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
