import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer/ffmpeg y @ffprobe-installer/ffprobe (lib/video.ts)
  // resuelven el binario nativo por plataforma con un require() dinámico
  // que Turbopack no puede analizar estáticamente al empaquetar Route
  // Handlers — hay que dejarlos fuera del bundle y usar el require nativo
  // de Node. `sharp` ya viene externalizado por defecto por Next.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
  experimental: {
    // Una ficha ahora puede llevar varias imágenes originales sin
    // comprimir subidas de golpe desde /assets/upload (Server Action) —
    // el límite de 1MB por defecto de Next revienta enseguida. Hay que
    // subir también el límite de proxy.ts (Next 16 renombró
    // middlewareClientMaxBodySize a proxyClientMaxBodySize), porque
    // intercepta la request antes de llegar al Server Action.
    serverActions: {
      bodySizeLimit: "50mb",
    },
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
