"use client"

import { useActionState, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import {
  createBrandAction,
  createPhotographerAction,
  uploadAssetAction,
  type UploadAssetActionState,
} from "@/app/assets/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Brand } from "@/db/queries/brands"
import type { Photographer } from "@/db/queries/photographers"
import { CheckboxList } from "../../_components/checkbox-list"
import { CreateEntityDialog } from "./create-entity-dialog"

interface FormValues {
  objectType: string
  productUrl: string
  inspirationUrl: string
  shortDescription: string
  tags: string
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
}

const initialState: UploadAssetActionState = {}

export function UploadForm({
  brands: initialBrands,
  photographers: initialPhotographers,
}: {
  brands: Brand[]
  photographers: Photographer[]
}) {
  const [brands, setBrands] = useState(initialBrands)
  const [photographers, setPhotographers] = useState(initialPhotographers)
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [photographerIds, setPhotographerIds] = useState<string[]>([])
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, getValues, reset } = useForm<FormValues>({
    defaultValues: { objectType: "", productUrl: "", inspirationUrl: "", shortDescription: "", tags: "" },
  })

  const [state, formAction, pending] = useActionState(async (
    prev: UploadAssetActionState
  ): Promise<UploadAssetActionState> => {
    if (selectedFiles.length === 0) {
      return { error: "Selecciona al menos un archivo." }
    }
    const brandId = brandIds[0]
    if (!brandId) {
      return { error: "Elige una marca." }
    }

    const values = getValues()
    const fd = new FormData()
    for (const file of selectedFiles) fd.append("files", file)
    fd.append(
      "metadata",
      JSON.stringify({
        brandId,
        photographerIds,
        objectType: values.objectType,
        productUrl: values.productUrl || undefined,
        inspirationUrl: values.inspirationUrl || undefined,
        shortDescription: values.shortDescription,
        tags: parseTags(values.tags),
      })
    )

    const result = await uploadAssetAction(prev, fd)
    if (!result.error) {
      setSelectedFiles([])
      setBrandIds([])
      setPhotographerIds([])
      reset()
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    return result
  }, initialState)

  function addFiles(list: FileList | File[]) {
    setSelectedFiles((prev) => [...prev, ...Array.from(list)])
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="font-heading text-sm font-medium">Metadata de la ficha</h2>
        <p className="text-xs text-muted-foreground">
          Se aplica a todas las imágenes que subas en esta tanda — todas forman una sola ficha.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Marca</Label>
              <CreateEntityDialog
                label="Marca"
                action={createBrandAction}
                onCreated={(brand: Brand) => setBrands((prev) => [...prev, brand])}
              />
            </div>
            <CheckboxList
              name="brandId"
              items={brands}
              selectedIds={brandIds}
              onChange={setBrandIds}
              multiple={false}
              emptyLabel="No hay marcas dadas de alta todavía."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Fotógrafos</Label>
              <CreateEntityDialog
                label="Fotógrafo"
                action={createPhotographerAction}
                onCreated={(photographer: Photographer) =>
                  setPhotographers((prev) => [...prev, photographer])
                }
              />
            </div>
            <CheckboxList
              name="photographerIds"
              items={photographers}
              selectedIds={photographerIds}
              onChange={setPhotographerIds}
              multiple
              emptyLabel="No hay fotógrafos dados de alta todavía."
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="objectType">Tipo de objeto</Label>
            <Input id="objectType" {...register("objectType")} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tags">Tags (separados por coma)</Label>
            <Input id="tags" {...register("tags")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="productUrl">URL del producto</Label>
            <Input id="productUrl" type="url" {...register("productUrl")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inspirationUrl">URL de inspiración</Label>
            <Input id="inspirationUrl" type="url" {...register("inspirationUrl")} />
          </div>

          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="shortDescription">Descripción breve</Label>
            <Textarea id="shortDescription" {...register("shortDescription")} required />
          </div>
        </div>
      </section>

      <section
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-8 text-center text-sm text-muted-foreground transition-colors ${
          dragOver ? "border-ring bg-muted/50" : "border-input"
        }`}
      >
        <p>Arrastra las imágenes (o vídeos) de esta ficha aquí, o</p>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          Elegir archivos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files)
          }}
        />
      </section>

      {selectedFiles.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-heading text-sm font-medium">Archivos ({selectedFiles.length})</h2>
          <ul className="flex flex-col gap-1 rounded-xl border p-2">
            {selectedFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="flex items-center justify-between px-2 py-1 text-sm">
                <span>
                  {file.name}
                  {index === 0 ? <span className="ml-2 text-xs text-muted-foreground">(portada)</span> : null}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                  Quitar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.createdAssetId ? <p className="text-sm text-emerald-600">Ficha subida correctamente.</p> : null}

      <Button type="submit" disabled={pending || selectedFiles.length === 0} className="self-start">
        {pending
          ? "Subiendo…"
          : `Subir ficha (${selectedFiles.length || 0} archivo${selectedFiles.length === 1 ? "" : "s"})`}
      </Button>
    </form>
  )
}
