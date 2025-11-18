// Telegram Web App Types
declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string
        initDataUnsafe: {
          user?: {
            id: number
            first_name: string
            last_name?: string
            username?: string
            language_code?: string
            phone_number?: string // Add phone number field
          }
        }
        ready: () => void
        expand: () => void
        close: () => void
      }
    }
  }
}

export {}