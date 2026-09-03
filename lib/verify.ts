import { updatePublication as updatePublicationRow } from "@/db/queries/publications"
import { recordSyncLog } from "@/db/queries/syncLogs"
import { listPublicationsWithTargets, networkClientFor } from "@/lib/publications"
import { toMetricoolDateTimeInfo, type MetricoolDateTimeInfo, type MetricoolPost } from "@/lib/networks/instagram"

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
  expected: { publicationDate: MetricoolDateTimeInfo; text: string }
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
 * ARCHITECTURE.md §5).
 */
export async function verifyPublications(filters: VerifyFilters): Promise<VerifyResult> {
  const publicationsWithTargets = await listPublicationsWithTargets({
    from: filters.from,
    to: filters.to,
    network: filters.network,
  })

  const drifts: TargetDrift[] = []

  for (const publication of publicationsWithTargets) {
    const expectedDateTime = toMetricoolDateTimeInfo(publication.publicationDate, publication.timezone)

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

      const actualDateTime = actual ? parseDateTimeInfo(actual.publicationDate) : null
      const driftDetected = !actualDateTime || !sameMinute(expectedDateTime, actualDateTime)

      await recordSyncLog({
        entityType: "PUBLICATION",
        entityId: publication.id,
        action: "VERIFY",
        beforeState: { publicationDate: expectedDateTime, text: publication.text },
        afterState: actual,
        driftDetected,
      })

      await updatePublicationRow(publication.id, {
        lastSyncedAt: new Date(),
        lastDriftNote: driftDetected
          ? `Drift en target ${target.network} (metricoolId ${target.metricoolId}): esperado ${JSON.stringify(expectedDateTime)}, encontrado ${actualDateTime ? JSON.stringify(actualDateTime) : "post no encontrado"}.`
          : null,
      })

      drifts.push({
        publicationId: publication.id,
        targetId: target.id,
        network: target.network,
        metricoolId: target.metricoolId,
        driftDetected,
        expected: { publicationDate: expectedDateTime, text: publication.text },
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

/**
 * Metricool devuelve `publicationDate` como `{ dateTime, timezone }`
 * (confirmado contra la API real, ver toMetricoolDateTimeInfo en
 * lib/networks/instagram.ts) — no como string.
 */
function parseDateTimeInfo(value: unknown): MetricoolDateTimeInfo | null {
  if (
    value &&
    typeof value === "object" &&
    typeof (value as Partial<MetricoolDateTimeInfo>).dateTime === "string" &&
    typeof (value as Partial<MetricoolDateTimeInfo>).timezone === "string"
  ) {
    return value as MetricoolDateTimeInfo
  }
  return null
}

/** Metricool trunca los segundos al guardar — comparar hasta el minuto evita falsos positivos de drift. */
function sameMinute(a: MetricoolDateTimeInfo, b: MetricoolDateTimeInfo): boolean {
  return a.timezone === b.timezone && a.dateTime.slice(0, 16) === b.dateTime.slice(0, 16)
}
