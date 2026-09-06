"use client"

export interface CheckboxListItem {
  id: string
  name: string
  instagramHandle?: string | null
}

/**
 * Checklist de selección única o múltiple. Los `<input type="checkbox">`
 * llevan `name`/`value` propios, así que funcionan tanto controlados
 * (onChange) como dentro de un <form action={serverAction}> nativo, donde
 * `formData.getAll(name)` recoge los marcados sin más.
 */
export function CheckboxList({
  name,
  items,
  selectedIds,
  onChange,
  multiple = true,
  emptyLabel = "Ninguno todavía.",
}: {
  name: string
  items: CheckboxListItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  multiple?: boolean
  emptyLabel?: string
}) {
  function toggle(id: string, checked: boolean) {
    if (!multiple) {
      onChange(checked ? [id] : [])
      return
    }
    onChange(checked ? [...selectedIds, id] : selectedIds.filter((existing) => existing !== id))
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto rounded-lg border border-input p-2">
      {items.map((item) => (
        <label key={item.id} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={name}
            value={item.id}
            checked={selectedIds.includes(item.id)}
            onChange={(e) => toggle(item.id, e.target.checked)}
            className="size-4"
          />
          <span>
            {item.name}
            {item.instagramHandle ? (
              <span className="text-muted-foreground"> (@{item.instagramHandle.replace(/^@/, "")})</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  )
}
