import { AsyncLocalStorage } from 'node:async_hooks'

const storage = new AsyncLocalStorage<string[]>()

export const cookieStore = {
  run<T>(fn: () => Promise<T>): Promise<T> {
    return storage.run([], fn)
  },
  current(): readonly string[] {
    return storage.getStore() ?? []
  },
  append(line: string): void {
    const store = storage.getStore()
    if (!store) throw new Error('Cookie store is not active')
    store.push(line)
  }
}
