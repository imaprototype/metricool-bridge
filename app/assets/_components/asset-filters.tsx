import type { Brand } from "@/db/queries/brands"
import type { Photographer } from "@/db/queries/photographers"

const fieldClassName =
  "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

export function AssetFilters({
  brands,
  photographers,
  current,
}: {
  brands: Brand[]
  photographers: Photographer[]
  current: Record<string, string | undefined>
}) {
  return (
    // Formulario GET nativo, sin JS: la navegación recarga /assets con los
    // nuevos query params y el Server Component los lee de `searchParams`.
    <form method="GET" className="mb-6 flex flex-wrap items-end gap-3">
      <Field label="Marca">
        <select name="brand" defaultValue={current.brand ?? ""} className={fieldClassName}>
          <option value="">Todas</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Fotógrafo">
        <select name="photographer" defaultValue={current.photographer ?? ""} className={fieldClassName}>
          <option value="">Todos</option>
          {photographers.map((photographer) => (
            <option key={photographer.id} value={photographer.id}>
              {photographer.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Categoría">
        <input
          type="text"
          name="category"
          defaultValue={current.category ?? ""}
          className={fieldClassName}
        />
      </Field>

      <Field label="Tipo de objeto">
        <input
          type="text"
          name="objectType"
          defaultValue={current.objectType ?? ""}
          className={fieldClassName}
        />
      </Field>

      <Field label="Tag">
        <input type="text" name="tag" defaultValue={current.tag ?? ""} className={fieldClassName} />
      </Field>

      <Field label="Tipo">
        <select name="kind" defaultValue={current.kind ?? ""} className={fieldClassName}>
          <option value="">Imagen y vídeo</option>
          <option value="IMAGE">Imagen</option>
          <option value="VIDEO">Vídeo</option>
        </select>
      </Field>

      <label className="flex h-8 items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          name="neverUsed"
          value="true"
          defaultChecked={current.neverUsed === "true"}
          className="size-4"
        />
        Nunca usados
      </label>

      <button
        type="submit"
        className="h-8 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/80"
      >
        Filtrar
      </button>
      {Object.values(current).some(Boolean) ? (
        <a href="/assets" className="text-sm text-muted-foreground hover:text-foreground">
          Limpiar
        </a>
      ) : null}
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
