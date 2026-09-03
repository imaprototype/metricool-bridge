import { NextResponse } from "next/server"
import { isValidApiKey } from "@/lib/apiKey"
import { auth } from "@/lib/auth"

// Next.js 16 renombró `middleware.ts` a `proxy.ts` (y `middleware` a `proxy`
// como nombre de función) — ver node_modules/next/dist/docs/.../version-16.md.
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api/")) {
    // Rutas propias de next-auth (usadas por el login de la UI web) y
    // /api/health quedan abiertas — el resto exige x-api-key.
    if (pathname.startsWith("/api/auth/") || pathname === "/api/health") {
      return
    }
    if (!isValidApiKey(req.headers.get("x-api-key"))) {
      return NextResponse.json({ error: "x-api-key inválida o ausente." }, { status: 401 })
    }
    return
  }

  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/assets/:path*", "/api/:path*"],
}
