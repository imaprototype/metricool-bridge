import { listBrands } from "@/db/queries/brands"
import { listPhotographers } from "@/db/queries/photographers"
import { listAssetsWithFilters } from "@/lib/assets"
import { AssetCard } from "./_components/asset-card"
import { AssetFilters } from "./_components/asset-filters"

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AssetsPage(props: PageProps<"/assets">) {
  const searchParams = await props.searchParams

  const brand = firstParam(searchParams.brand)
  const photographer = firstParam(searchParams.photographer)
  const category = firstParam(searchParams.category)
  const objectType = firstParam(searchParams.objectType)
  const tag = firstParam(searchParams.tag)
  const kindParam = firstParam(searchParams.kind)
  const kind = kindParam === "IMAGE" || kindParam === "VIDEO" ? kindParam : undefined
  const neverUsed = firstParam(searchParams.neverUsed) === "true"

  const [brands, photographers, result] = await Promise.all([
    listBrands(),
    listPhotographers(),
    listAssetsWithFilters({
      brandId: brand,
      photographerId: photographer,
      category,
      objectType,
      tag,
      kind,
      neverUsed,
      pageSize: 60,
    }),
  ])

  const brandsById = new Map(brands.map((b) => [b.id, b.name]))

  return (
    <div>
      <AssetFilters
        brands={brands}
        photographers={photographers}
        current={{ brand, photographer, category, objectType, tag, kind, neverUsed: neverUsed ? "true" : undefined }}
      />

      <p className="mb-4 text-sm text-muted-foreground">{result.total} assets</p>

      {result.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay assets con estos filtros.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {result.data.map((asset) => (
            <AssetCard key={asset.id} asset={asset} brandName={brandsById.get(asset.brandId) ?? "—"} />
          ))}
        </div>
      )}
    </div>
  )
}
