"use client"

import { useActionState, useState } from "react"
import { updateAssetAction, type UpdateAssetActionState } from "@/app/assets/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { Photographer } from "@/db/queries/photographers"
import type { AssetWithDetails } from "@/lib/assets"
import { CheckboxList } from "./checkbox-list"

const initialState: UpdateAssetActionState = {}

export function EditAssetSheet({
  asset,
  photographers,
}: {
  asset: AssetWithDetails
  photographers: Photographer[]
}) {
  const [open, setOpen] = useState(false)
  const [photographerIds, setPhotographerIds] = useState<string[]>(asset.photographerIds)
  const action = updateAssetAction.bind(null, asset.id)
  const [state, formAction, pending] = useActionState(async (prev: UpdateAssetActionState, fd: FormData) => {
    const result = await action(prev, fd)
    if (!result.error) setOpen(false)
    return result
  }, initialState)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm">
            Editar
          </Button>
        }
      />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar asset</SheetTitle>
          <SheetDescription>
            {asset.images.length} imagen{asset.images.length === 1 ? "" : "es"} — el conjunto de imágenes no se
            edita aquí todavía.
          </SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-col gap-4 overflow-y-auto px-4">
          {asset.images.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto">
              {asset.images.map((image) => {
                const variants = image.variants as Record<string, string>
                const thumb = variants.thumbnail ?? variants.FEED_POST ?? Object.values(variants)[0]
                return thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URLs de Vercel Blob, no requieren optimización de next/image aquí.
                  <img
                    key={image.id}
                    src={thumb}
                    alt=""
                    className="size-16 shrink-0 rounded-md object-cover ring-1 ring-border"
                  />
                ) : null
              })}
            </div>
          ) : null}
          <Field label="Tipo de objeto" name="objectType" defaultValue={asset.objectType} required />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="shortDescription">Descripción breve</Label>
            <Textarea
              id="shortDescription"
              name="shortDescription"
              defaultValue={asset.shortDescription}
              required
            />
          </div>
          <Field label="URL del producto" name="productUrl" defaultValue={asset.productUrl ?? ""} type="url" />
          <Field
            label="URL de inspiración"
            name="inspirationUrl"
            defaultValue={asset.inspirationUrl ?? ""}
            type="url"
          />
          <div className="flex flex-col gap-1.5">
            <Label>Fotógrafos</Label>
            <CheckboxList
              name="photographerIds"
              items={photographers}
              selectedIds={photographerIds}
              onChange={setPhotographerIds}
              multiple
              emptyLabel="No hay fotógrafos dados de alta todavía."
            />
          </div>
          <Field label="Tags (separados por coma)" name="tags" defaultValue={asset.tags.join(", ")} />
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <SheetFooter className="px-0">
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar cambios"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
}: {
  label: string
  name: string
  defaultValue: string
  required?: boolean
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} required={required} />
    </div>
  )
}
