import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @ffmpeg-installer/ffmpeg y @ffprobe-installer/ffprobe (lib/video.ts)
  // resuelven el binario nativo por plataforma con un require() dinámico
  // que Turbopack no puede analizar estáticamente al empaquetar Route
  // Handlers — hay que dejarlos fuera del bundle y usar el require nativo
  // de Node. `sharp` ya viene externalizado por defecto por Next.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg", "@ffprobe-installer/ffprobe"],
};

export default nextConfig;
