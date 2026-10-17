import type { NetworkAdapter } from "./types"
import { facebookAdapter } from "./facebook"
import { instagramAdapter } from "./instagram"
import { pinterestAdapter } from "./pinterest"

export const networkAdapters: Record<string, NetworkAdapter> = {
  instagram: instagramAdapter,
  pinterest: pinterestAdapter,
  facebook: facebookAdapter,
}

export function getNetworkAdapter(network: string): NetworkAdapter {
  const adapter = networkAdapters[network]
  if (!adapter) {
    throw new Error(`No hay adaptador registrado para la red "${network}".`)
  }
  return adapter
}

export type { NetworkAdapter } from "./types"
