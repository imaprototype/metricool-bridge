import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Next.js 16 renombró `middleware.ts` a `proxy.ts` (y `middleware` a `proxy`
// como nombre de función) — ver node_modules/next/dist/docs/.../version-16.md.
export const proxy = auth((req) => {
  if (!req.auth) {
    const loginUrl = new URL("/login", req.nextUrl)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  matcher: ["/assets/:path*"],
}
