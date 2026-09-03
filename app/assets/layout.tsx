import Link from "next/link"
import { signOut } from "@/lib/auth"
import { Button } from "@/components/ui/button"

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <span className="font-heading font-medium">NØRU — Assets</span>
          <Link href="/assets" className="text-muted-foreground hover:text-foreground">
            Explorar
          </Link>
          <Link href="/assets/upload" className="text-muted-foreground hover:text-foreground">
            Subir
          </Link>
        </nav>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            Cerrar sesión
          </Button>
        </form>
      </header>
      <main className="px-6 py-6">{children}</main>
    </div>
  )
}
