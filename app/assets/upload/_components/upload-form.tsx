"use client"

import { useActionState, useRef, useState } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import {
  createBrandAction,
  createPhotographerAction,
  uploadAssetsAction,
  type UploadAssetsActionState,
} from "@/app/assets/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Brand } from "@/db/queries/brands"
import type { Photographer } from "@/db/queries/photographers"
import { CheckboxList } from "../../_components/checkbox-list"
import { CreateEntityDialog } from "./create-entity-dialog"

interface SharedFields {
  tags: string
}

interface FileFields {
  objectType: string
  productUrl: string
  inspirationUrl: string
  shortDescription: string
  tags: string
}

interface FormValues {
  shared: SharedFields
  files: FileFields[]
}

function mergeTags(shared: string, own: string): string[] {
  const parse = (value: string) =>
    value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
  return Array.from(new Set([...parse(shared), ...parse(own)]))
}

const initialState: UploadAssetsActionState = {}

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

  const { register, control, getValues, reset } = useForm<FormValues>({
    defaultValues: {
      shared: { tags: "" },
      files: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: "files" })

  const [state, formAction, pending] = useActionState(async (
    prev: UploadAssetsActionState
  ): Promise<UploadAssetsActionState> => {
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
      JSON.stringify(
        values.files.map((f) => ({
          brandId,
          photographerIds,
          objectType: f.objectType,
          productUrl: f.productUrl || undefined,
          inspirationUrl: f.inspirationUrl || undefined,
          shortDescription: f.shortDescription,
          tags: mergeTags(values.shared.tags, f.tags),
        }))
      )
    )

    const result = await uploadAssetsAction(prev, fd)
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
    const files = Array.from(list)
    setSelectedFiles((prev) => [...prev, ...files])
    for (const file of files) {
      append({
        objectType: "",
        productUrl: "",
        inspirationUrl: "",
        shortDescription: "",
        tags: "",
      })
      void file // el File en sí vive en selectedFiles, no en el form
    }
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    remove(index)
  }

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="font-heading text-sm font-medium">Metadata compartida</h2>
        <p className="text-xs text-muted-foreground">
          Se aplica a todos los archivos de esta tanda.
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

          <div className="col-span-1 flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="shared-tags">Tags (separados por coma)</Label>
            <Input id="shared-tags" {...register("shared.tags")} />
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
        <p>Arrastra fotos o vídeos aquí, o</p>
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

      {fields.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="font-heading text-sm font-medium">Archivos ({fields.length})</h2>
          {fields.map((field, index) => (
            <div key={field.id} className="flex flex-col gap-3 rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{selectedFiles[index]?.name}</span>
                <Button type="button" variant="ghost" size="sm" onClick={() => removeFile(index)}>
                  Quitar
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`files.${index}.objectType`}>Tipo de objeto</Label>
                  <Input id={`files.${index}.objectType`} {...register(`files.${index}.objectType`)} required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`files.${index}.productUrl`}>URL del producto</Label>
                  <Input
                    id={`files.${index}.productUrl`}
                    type="url"
                    {...register(`files.${index}.productUrl`)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`files.${index}.inspirationUrl`}>URL de inspiración</Label>
                  <Input
                    id={`files.${index}.inspirationUrl`}
                    type="url"
                    {...register(`files.${index}.inspirationUrl`)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`files.${index}.tags`}>Tags adicionales</Label>
                  <Input id={`files.${index}.tags`} {...register(`files.${index}.tags`)} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label htmlFor={`files.${index}.shortDescription`}>Descripción breve</Label>
                  <Textarea
                    id={`files.${index}.shortDescription`}
                    {...register(`files.${index}.shortDescription`)}
                    required
                  />
                </div>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.successCount ? (
        <p className="text-sm text-emerald-600">
          {state.successCount} asset{state.successCount === 1 ? "" : "s"} subido{state.successCount === 1 ? "" : "s"}.
        </p>
      ) : null}

      <Button type="submit" disabled={pending || fields.length === 0} className="self-start">
        {pending ? "Subiendo…" : `Subir ${fields.length || ""} archivo${fields.length === 1 ? "" : "s"}`}
      </Button>
    </form>
  )
}
