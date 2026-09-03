import { updatePublication as updatePublicationRow } from "@/db/queries/publications"
import { recordSyncLog } from "@/db/queries/syncLogs"
import { listPublicationsWithTargets, networkClientFor } from "@/lib/publications"
import type { MetricoolPost } from "@/lib/networks/instagram"

export interface VerifyFilters {
  from: Date
  to: Date
  network?: string
}

export interface TargetDrift {
  publicationId: string
  targetId: string
  network: string
  metricoolId: number
  driftDetected: boolean
  expected: { publicationDate: string; text: string }
  /** null si Metricool ya no tiene el post (posible re-programación con otro id que no seguimos). */
  actual: MetricoolPost | null
}

export interface VerifyResult {
  checked: number
  driftCount: number
  drifts: TargetDrift[]
}

/**
 * Re-consulta cada red para las publicaciones del rango y compara contra
 * lo que tenemos guardado — mitigación del "quirk" de Metricool que más
 * costó detectar esta sesión: tras un POST/PUT puede recolocar la hora (o
 * el día) de un post pendiente sin avisar en la respuesta (ver
 * ARCHITECTURE.md §5). El campo exacto que Metricool usa para la fecha en
 * su respuesta no está confirmado contra la API real esta sesión — ajustar
 * `actualPublicationDateOf` si el nombre de campo real difiere.
 */
export async function verifyPublications(filters: VerifyFilters): Promise<VerifyResult> {
  const publicationsWithTargets = await listPublicationsWithTargets({
    from: filters.from,
    to: filters.to,
    network: filters.network,
  })

  const drifts: TargetDrift[] = []

  for (const publication of publicationsWithTargets) {
    for (const target of publication.targets) {
      if (target.metricoolId == null) continue
      if (filters.network && target.network !== filters.network) continue

      const client = networkClientFor(target.network)
      let actual: MetricoolPost | null = null
      try {
        actual = await client.getPost(target.metricoolId)
      } catch {
        actual = null
      }

      const expectedDate = publication.publicationDate.toISOString()
      const actualDate = actual ? actualPublicationDateOf(actual) : null
      const driftDetected = !actual || actualDate !== expectedDate

      await recordSyncLog({
        entityType: "PUBLICATION",
        entityId: publication.id,
        action: "VERIFY",
        beforeState: { publicationDate: expectedDate, text: publication.text },
        afterState: actual,
        driftDetected,
      })

      await updatePublicationRow(publication.id, {
        lastSyncedAt: new Date(),
        lastDriftNote: driftDetected
          ? `Drift en target ${target.network} (metricoolId ${target.metricoolId}): esperado ${expectedDate}, encontrado ${actualDate ?? "post no encontrado"}.`
          : null,
      })

      drifts.push({
        publicationId: publication.id,
        targetId: target.id,
        network: target.network,
        metricoolId: target.metricoolId,
        driftDetected,
        expected: { publicationDate: expectedDate, text: publication.text },
        actual,
      })
    }
  }

  return {
    checked: drifts.length,
    driftCount: drifts.filter((d) => d.driftDetected).length,
    drifts,
  }
}

function actualPublicationDateOf(post: MetricoolPost): string | null {
  const value = post.publicationDate
  return typeof value === "string" ? value : null
}
