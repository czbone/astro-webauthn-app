import { validateRuntimeEnv } from './env.ts'

try {
  validateRuntimeEnv()
} catch (error) {
  const message = error instanceof Error ? error.message : 'environment check failed'
  console.error(message)
  process.exit(1)
}
