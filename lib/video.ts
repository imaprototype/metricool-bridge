import ffmpegInstaller from "@ffmpeg-installer/ffmpeg"
import ffprobeInstaller from "@ffprobe-installer/ffprobe"
import { execFile } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface VideoMetadata {
  durationSeconds: number
  width: number
  height: number
}

interface FfprobeStream {
  codec_type?: string
  width?: number
  height?: number
}

interface FfprobeOutput {
  format?: { duration?: string }
  streams?: FfprobeStream[]
}

export async function getVideoMetadata(input: Buffer): Promise<VideoMetadata> {
  return withTempFile(input, async (filePath) => {
    const { stdout } = await execFileAsync(ffprobeInstaller.path, [
      "-v",
      "error",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      filePath,
    ])

    const probe = JSON.parse(stdout) as FfprobeOutput
    const videoStream = probe.streams?.find((stream) => stream.codec_type === "video")
    if (!videoStream?.width || !videoStream?.height) {
      throw new Error("No se pudo leer el stream de vídeo (¿archivo corrupto o sin pista de vídeo?).")
    }

    return {
      durationSeconds: Number(probe.format?.duration ?? 0),
      width: videoStream.width,
      height: videoStream.height,
    }
  })
}

/** Extrae un único frame como miniatura JPEG, en el segundo `atSeconds`. */
export async function extractThumbnail(input: Buffer, atSeconds = 0): Promise<Buffer> {
  return withTempFile(input, async (filePath, dir) => {
    const outPath = join(dir, "thumb.jpg")
    await execFileAsync(ffmpegInstaller.path, [
      "-y",
      "-ss",
      String(atSeconds),
      "-i",
      filePath,
      "-frames:v",
      "1",
      "-q:v",
      "2",
      outPath,
    ])
    return readFile(outPath)
  })
}

async function withTempFile<T>(
  input: Buffer,
  fn: (filePath: string, dir: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "metricool-bridge-video-"))
  const filePath = join(dir, "input")
  try {
    await writeFile(filePath, input)
    return await fn(filePath, dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
