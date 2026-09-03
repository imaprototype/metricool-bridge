import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { describe, expect, it } from "vitest"
import { extractThumbnail, getVideoMetadata } from "./video"

const execFileAsync = promisify(execFile)

/** Genera un vídeo de prueba sintético (patrón de color) sin depender de un fixture en disco. */
async function makeTestVideo(durationSeconds: number, width: number, height: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "metricool-bridge-test-video-"))
  const outPath = join(dir, "out.mp4")
  try {
    await execFileAsync(ffmpegInstaller.path, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `testsrc=duration=${durationSeconds}:size=${width}x${height}:rate=10`,
      "-pix_fmt",
      "yuv420p",
      outPath,
    ])
    return await readFile(outPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

describe("getVideoMetadata", () => {
  it(
    "lee duración y dimensiones reales del vídeo",
    async () => {
      const video = await makeTestVideo(2, 64, 48)
      const metadata = await getVideoMetadata(video)

      expect(metadata.width).toBe(64)
      expect(metadata.height).toBe(48)
      expect(metadata.durationSeconds).toBeGreaterThan(1.5)
      expect(metadata.durationSeconds).toBeLessThan(2.5)
    },
    20000
  )
})

describe("extractThumbnail", () => {
  it(
    "extrae un frame como JPEG válido",
    async () => {
      const video = await makeTestVideo(1, 64, 48)
      const thumbnail = await extractThumbnail(video, 0)

      // Magic bytes de un JPEG: FF D8 FF
      expect(thumbnail.subarray(0, 3)).toEqual(Buffer.from([0xff, 0xd8, 0xff]))
      expect(thumbnail.length).toBeGreaterThan(0)
    },
    20000
  )
})
