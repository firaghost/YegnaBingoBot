import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface TestResult {
  name: string
  status: 'passed' | 'failed' | 'skipped'
  duration: number
  error?: string
}

class TestRunner {
  private results: TestResult[] = []
  private startTime: number = Date.now()

  private tests = [
    {
      name: 'Waiting Room (Simple)',
      command: 'npm',
      args: ['run', 'test:waiting-room-simple'],
      timeout: 30000,
      required: false
    },
    {
      name: 'Atomic Winner Unit Tests',
      command: 'npm',
      args: ['run', 'test:atomic-unit'],
      timeout: 30000,
      required: true
    },
    {
      name: 'Atomic Winner Tests',
      command: 'npm',
      args: ['run', 'test:atomic-winner'],
      timeout: 90000,
      required: false
    },
    {
      name: 'In-Game Tests',
      command: 'npm',
      args: ['run', 'test:ingame'],
      timeout: 60000,
      required: false
    },
    {
      name: 'Waiting Room Tests',
      command: 'npm',
      args: ['run', 'test:waiting-room'],
      timeout: 60000,
      required: false
    }
  ]

  async run(): Promise<void> {
    console.log('\n')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║          🎮 YegnaBingoBot - Complete Test Suite            ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('\n')

    for (const test of this.tests) {
      await this.runTest(test)
    }

    this.printSummary()
  }

  private async runTest(test: {
    name: string
    command: string
    args: string[]
    timeout: number
    required: boolean
  }): Promise<void> {
    const testStartTime = Date.now()
    console.log(`\n📋 Running: ${test.name}`)
    console.log('─'.repeat(60))

    return new Promise((resolve) => {
      const process = spawn(test.command, test.args, {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit',
        shell: true
      })

      const timeout = setTimeout(() => {
        process.kill()
        this.results.push({
          name: test.name,
          status: 'failed',
          duration: Date.now() - testStartTime,
          error: 'Test timeout'
        })
        console.error(`\n❌ ${test.name} - TIMEOUT (${test.timeout}ms)`)
        resolve()
      }, test.timeout)

      process.on('close', (code) => {
        clearTimeout(timeout)
        const duration = Date.now() - testStartTime

        if (code === 0) {
          this.results.push({
            name: test.name,
            status: 'passed',
            duration
          })
          console.log(`\n✅ ${test.name} - PASSED (${duration}ms)`)
        } else {
          this.results.push({
            name: test.name,
            status: 'failed',
            duration,
            error: `Exit code: ${code}`
          })
          console.error(`\n❌ ${test.name} - FAILED (${duration}ms)`)
          if (!test.required) {
            console.log('   ⚠️  This test is optional, continuing...')
          }
        }
        resolve()
      })

      process.on('error', (err) => {
        clearTimeout(timeout)
        const duration = Date.now() - testStartTime
        this.results.push({
          name: test.name,
          status: 'failed',
          duration,
          error: err.message
        })
        console.error(`\n❌ ${test.name} - ERROR: ${err.message}`)
        resolve()
      })
    })
  }

  private printSummary(): void {
    const totalDuration = Date.now() - this.startTime
    const passed = this.results.filter((r) => r.status === 'passed').length
    const failed = this.results.filter((r) => r.status === 'failed').length
    const requiredFailed = this.results.filter(
      (r) => r.status === 'failed' && this.tests.find((t) => t.name === r.name)?.required
    ).length

    console.log('\n')
    console.log('╔════════════════════════════════════════════════════════════╗')
    console.log('║                      📊 TEST SUMMARY                       ║')
    console.log('╚════════════════════════════════════════════════════════════╝')
    console.log('\n')

    this.results.forEach((result) => {
      const icon = result.status === 'passed' ? '✅' : '❌'
      const status = result.status.toUpperCase()
      console.log(`${icon} ${result.name.padEnd(40)} ${status.padEnd(10)} ${result.duration}ms`)
      if (result.error) {
        console.log(`   └─ Error: ${result.error}`)
      }
    })

    console.log('\n' + '─'.repeat(60))
    console.log(`\n📈 Results: ${passed} passed, ${failed} failed out of ${this.results.length} tests`)
    console.log(`⏱️  Total time: ${(totalDuration / 1000).toFixed(2)}s`)

    if (requiredFailed > 0) {
      console.log(`\n❌ ${requiredFailed} required test(s) failed!`)
      console.log('\n')
      process.exit(1)
    } else {
      console.log(`\n✅ All required tests passed!`)
      console.log('\n')
      process.exit(0)
    }
  }
}

// Run the test suite
const runner = new TestRunner()
runner.run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
