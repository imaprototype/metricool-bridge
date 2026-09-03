import { listBrands } from "@/db/queries/brands"
import { listPhotographers } from "@/db/queries/photographers"
import { UploadForm } from "./_components/upload-form"

// Sin esto, Next prerenderiza esta página como estática en build (no lee
// searchParams ni cookies) y el catálogo de marcas/fotógrafos solo se
// refresca cuando revalidatePath() lo fuerza explícitamente — más seguro
// pedirla siempre en vivo en una página de subida.
export const dynamic = "force-dynamic"

export default async function UploadPage() {
  const [brands, photographers] = await Promise.all([listBrands(), listPhotographers()])

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-heading text-lg font-medium">Subir assets</h1>
      <UploadForm brands={brands} photographers={photographers} />
    </div>
  )
}
