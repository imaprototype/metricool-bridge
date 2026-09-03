import type { NetworkAdapter } from "./types"
import { instagramAdapter } from "./instagram"

export const networkAdapters: Record<string, NetworkAdapter> = {
  instagram: instagramAdapter,
}

export function getNetworkAdapter(network: string): NetworkAdapter {
  const adapter = networkAdapters[network]
  if (!adapter) {
    throw new Error(`No hay adaptador registrado para la red "${network}".`)
  }
  return adapter
}

export type { NetworkAdapter } from "./types"
