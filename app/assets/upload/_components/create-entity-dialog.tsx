"use client"

import { useActionState, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface CreateEntityDialogProps<T> {
  label: string
  action: (prevState: { error?: string; created?: T }, formData: FormData) => Promise<{ error?: string; created?: T }>
  onCreated: (entity: T) => void
}

export function CreateEntityDialog<T>({ label, action, onCreated }: CreateEntityDialogProps<T>) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(async (
    prev: { error?: string; created?: T },
    formData: FormData
  ) => {
    const result = await action(prev, formData)
    if (result.created) {
      onCreated(result.created)
      setOpen(false)
    }
    return result
  }, {})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm">
            + {label}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo {label.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`new-${label}-name`}>Nombre</Label>
            <Input id={`new-${label}-name`} name="name" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`new-${label}-instagram`}>Red social (Instagram, opcional)</Label>
            <Input id={`new-${label}-instagram`} name="instagramHandle" placeholder="@usuario" />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
