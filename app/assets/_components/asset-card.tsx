import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import type { Photographer } from "@/db/queries/photographers"
import type { AssetWithDetails } from "@/lib/assets"
import { archiveAssetAction } from "@/app/assets/actions"
import { EditAssetSheet } from "./edit-asset-sheet"

export function AssetCard({
  asset,
  brandName,
  photographers,
}: {
  asset: AssetWithDetails
  brandName: string
  photographers: Photographer[]
}) {
  const cover = asset.images[0]
  const coverVariants = (cover?.variants ?? {}) as Record<string, string>
  const thumbnailUrl = coverVariants.thumbnail ?? coverVariants.FEED_POST ?? Object.values(coverVariants)[0]
  const photographerNames = photographers
    .filter((p) => asset.photographerIds.includes(p.id))
    .map((p) => p.name)
    .join(", ")

  return (
    <Card size="sm" className="overflow-hidden">
      <div className="relative">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URLs de Vercel Blob, no requieren optimización de next/image aquí.
          <img src={thumbnailUrl} alt={asset.shortDescription} className="aspect-square w-full object-cover" />
        ) : (
          <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
            Sin variante
          </div>
        )}
        {asset.images.length > 1 ? (
          <Badge className="absolute top-2 right-2 text-xs" variant="secondary">
            {asset.images.length} imágenes
          </Badge>
        ) : null}
      </div>
      <CardHeader>
        <CardTitle className="line-clamp-1">{asset.objectType}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {brandName}
          {photographerNames ? ` · ${photographerNames}` : ""}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="line-clamp-2 text-xs text-muted-foreground">{asset.shortDescription}</p>
        <div className="flex flex-wrap gap-1">
          {asset.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {asset.usages.length === 0 ? "Nunca usado" : `Usado ${asset.usages.length}×`}
        </p>
      </CardContent>
      <CardFooter className="flex justify-between gap-2">
        <EditAssetSheet asset={asset} photographers={photographers} />
        <form action={archiveAssetAction.bind(null, asset.id)}>
          <Button variant="destructive" size="sm" type="submit">
            Archivar
          </Button>
        </form>
      </CardFooter>
    </Card>
  )
}
