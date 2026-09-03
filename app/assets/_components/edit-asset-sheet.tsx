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
import type { AssetWithUsages } from "@/lib/assets"

const initialState: UpdateAssetActionState = {}

export function EditAssetSheet({ asset }: { asset: AssetWithUsages }) {
  const [open, setOpen] = useState(false)
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
          <SheetDescription>{asset.sourceFilename}</SheetDescription>
        </SheetHeader>
        <form action={formAction} className="flex flex-col gap-4 overflow-y-auto px-4">
          <Field label="Tipo de objeto" name="objectType" defaultValue={asset.objectType} required />
          <Field label="Categoría" name="category" defaultValue={asset.category} required />
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
          <Field
            label="Público objetivo"
            name="targetAudience"
            defaultValue={asset.targetAudience ?? ""}
          />
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
