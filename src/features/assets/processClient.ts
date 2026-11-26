/**
 * Runs raster processing in a Web Worker (BLUEPRINT §6) so large photos never
 * freeze the UI, and falls back to the main thread where the worker can't draw.
 */
import { domEnv, processRaster, type ProcessRequest, type ProcessResult } from './process'

let worker: Worker | null | undefined
let seq = 0
const waiting = new Map<number, { resolve: (r: ProcessResult) => void; reject: (e: Error) => void }>()

function getWorker(): Worker | null {
  if (worker !== undefined) return worker
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return (worker = null)
  try {
    worker = new Worker(new URL('./imageWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: ProcessResult; error?: string }>) => {
      const w = waiting.get(e.data.id)
      if (!w) return
      waiting.delete(e.data.id)
      if (e.data.ok) w.resolve(e.data.result!)
      else w.reject(new Error(e.data.error))
    }
    worker.onerror = () => {
      // The worker itself failed to start: send everything to the main thread.
      worker?.terminate()
      worker = null
      for (const w of waiting.values()) w.reject(new Error('worker-failed'))
      waiting.clear()
    }
  } catch {
    worker = null
  }
  return worker
}

function inWorker(w: Worker, req: ProcessRequest): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const id = ++seq
    waiting.set(id, { resolve, reject })
    w.postMessage({ id, req })
  })
}

export async function processImage(req: ProcessRequest): Promise<ProcessResult> {
  const w = getWorker()
  if (w) {
    try {
      return await inWorker(w, req)
    } catch (e) {
      // Decoding problems are the file's fault; anything else gets a second try here.
      if (e instanceof Error && /could not be opened/.test(e.message)) throw e
    }
  }
  return processRaster(req, domEnv)
}
