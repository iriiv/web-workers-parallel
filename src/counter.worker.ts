/// <reference lib="webworker" />

export type WorkerInput = {
  numbers: number[]
}

export type WorkerOutput =
  | { type: 'done'; totalCount: number; elapsedMs: number }
  | { type: 'error'; message: string }

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { numbers } = e.data

  const start = performance.now()
  let totalCount = 0

  for (const n of numbers) {
    let curr = 0
    while (curr < n) curr++
    totalCount += curr
  }

  const elapsedMs = performance.now() - start

  self.postMessage({ type: 'done', totalCount, elapsedMs } satisfies WorkerOutput)
}
