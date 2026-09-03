import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
  del: vi.fn(),
}))

import { del, put } from "@vercel/blob"
import { deleteAsset, uploadAsset } from "./blob"

beforeEach(() => {
  vi.mocked(put).mockReset()
  vi.mocked(del).mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("uploadAsset", () => {
  it("sube con access público y devuelve url + pathname", async () => {
    vi.mocked(put).mockResolvedValue({
      url: "https://blob.vercel-storage.com/foo-abc123.jpg",
      pathname: "foo-abc123.jpg",
      contentType: "image/jpeg",
      contentDisposition: "inline",
      downloadUrl: "https://blob.vercel-storage.com/foo-abc123.jpg?download=1",
    } as never)

    const result = await uploadAsset("foo.jpg", Buffer.from("data"), {
      contentType: "image/jpeg",
    })

    expect(result).toEqual({
      url: "https://blob.vercel-storage.com/foo-abc123.jpg",
      pathname: "foo-abc123.jpg",
    })
    expect(put).toHaveBeenCalledWith(
      "foo.jpg",
      Buffer.from("data"),
      expect.objectContaining({ access: "public", contentType: "image/jpeg" })
    )
  })
})

describe("deleteAsset", () => {
  it("delega en del() del SDK de Vercel Blob", async () => {
    vi.mocked(del).mockResolvedValue(undefined)

    await deleteAsset("https://blob.vercel-storage.com/foo-abc123.jpg")

    expect(del).toHaveBeenCalledWith(
      "https://blob.vercel-storage.com/foo-abc123.jpg",
      expect.objectContaining({})
    )
  })
})
