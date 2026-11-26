/// <reference lib="webworker" />
import { offscreenEnv, processRaster, type ProcessRequest } from './process'

self.onmessage = async (e: MessageEvent<{ id: number; req: ProcessRequest }>) => {
  const { id, req } = e.data
  try {
    const result = await processRaster(req, offscreenEnv)
    self.postMessage({ id, ok: true, result })
  } catch (err) {
    self.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
