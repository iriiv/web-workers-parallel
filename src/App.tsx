import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import CounterWorker from './counter.worker?worker'
import type { WorkerInput } from './counter.worker'

const CUBE = 48
const RAF_STEP = 1 // px per frame — slow and smooth

export default function App() {
  const measureRef = useRef<HTMLDivElement>(null)
  const [travelPx, setTravelPx] = useState(0)
  const [loopX, setLoopX] = useState(0)
  const [count, setCount] = useState(1)
  const [elapsedMs, setElapsedMs] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const cores = navigator.hardwareConcurrency ?? 1

  // Track width observer
  useEffect(() => {
    const el = measureRef.current
    if (!el) return
    const update = () => setTravelPx(Math.max(0, el.clientWidth - CUBE))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Infinite RAF loop — starts automatically
  useEffect(() => {
    if (travelPx === 0) return
    let cancelled = false

    const run = async () => {
      while (!cancelled) {
        for (let x = 0; x <= travelPx && !cancelled; x += RAF_STEP) {
          setLoopX(x)
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
        }
        if (!cancelled) setLoopX(0)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [travelPx])

  // Launch `count` workers in parallel, each gets a chunk of the task array
  const handleStart = () => {
    if (running) return
    setRunning(true)
    setElapsedMs(null)

    // Fixed total work — always the same regardless of worker count
    const TOTAL_TASKS = 1_000
    const ITERS_PER_TASK = 100_000_000
    const numbers: number[] = Array.from({ length: TOTAL_TASKS }, () => ITERS_PER_TASK)

    // Split into `count` roughly equal chunks
    const chunkSize = Math.ceil(numbers.length / count)
    const chunks: number[][] = []
    for (let i = 0; i < numbers.length; i += chunkSize) {
      chunks.push(numbers.slice(i, i + chunkSize) as number[])
    }

    const wallStart = performance.now()

    const promises = chunks.map(
      (chunk) =>
        new Promise<void>((resolve, reject) => {
          const w = new CounterWorker()
          w.postMessage({ numbers: chunk } satisfies WorkerInput)
          w.onmessage = () => { w.terminate(); resolve() }
          w.onerror = () => { w.terminate(); reject() }
        }),
    )

    Promise.all(promises)
      .then(() => setElapsedMs(Math.round(performance.now() - wallStart)))
      .catch(() => {})
      .finally(() => setRunning(false))
  }

  const trackVars = { '--travel': `${travelPx}px` } as CSSProperties

  const timeDisplay = elapsedMs !== null ? String(elapsedMs) : '—'

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="info-badge">
            <span className="info-value">{cores}</span>
            <span className="info-label">потоков</span>
            <span className="info-sub">hardwareConcurrency</span>
          </div>
        </div>

        <div className="sidebar-mid">
          <p className="control-label">Воркеры</p>
          <div className="stepper">
            <button
              className="stepper-btn"
              onClick={() => setCount((c) => Math.max(1, c - 1))}
              aria-label="Уменьшить"
            >
              −
            </button>
            <span className="stepper-value">{count}</span>
            <button
              className="stepper-btn"
              onClick={() => setCount((c) => c + 1)}
              aria-label="Увеличить"
            >
              +
            </button>
          </div>

          <button
            className={`start-btn${running ? ' start-btn--busy' : ''}`}
            type="button"
            onClick={handleStart}
            disabled={running}
          >
            {running ? 'Работает…' : 'Запустить'}
          </button>
        </div>

        <div className="sidebar-bot">
          <div className="info-badge">
            <span className={`info-value${elapsedMs === null ? ' info-value--dim' : ''}`}>
              {timeDisplay}
            </span>
            <span className="info-label">мс</span>
            <span className="info-sub">время выполнения</span>
          </div>
        </div>
      </aside>

      <main className="stage">
        <section className="row">
          <h2 className="row-title">
            <span className="row-badge row-badge--blue">CSS</span>
            animation · infinite alternate
          </h2>
          <div className="track" ref={measureRef} style={trackVars}>
            <div className="track-groove" />
            <div className="cube cube--css" />
          </div>
        </section>

        <section className="row">
          <h2 className="row-title">
            <span className="row-badge row-badge--emerald">RAF</span>
            loop · +{RAF_STEP}px / кадр
          </h2>
          <div className="track">
            <div className="track-groove" />
            <div
              className="cube cube--raf"
              style={{ transform: `translateX(${loopX}px)` }}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
