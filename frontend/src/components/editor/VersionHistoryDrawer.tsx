import { useEffect, useState } from "react"
import { listWorkflowVersions, type WorkflowVersionSummary } from "../../editor/workflowRepository"

interface VersionHistoryDrawerProps {
  workflowId: string
  latestVersionNumber: number
  currentFingerprint: string | null
  savedFingerprint: string | null
  restoredVersion: { versionNumber: number; fingerprint: string } | null
  refreshKey: number
  isRestoring: boolean
  onClose: () => void
  onRestore: (versionNumber: number) => void
}

function VersionHistoryDrawer({ workflowId, latestVersionNumber, currentFingerprint, savedFingerprint, restoredVersion, refreshKey, isRestoring, onClose, onRestore }: VersionHistoryDrawerProps) {
  const [versions, setVersions] = useState<WorkflowVersionSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadVersions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      setVersions(await listWorkflowVersions(workflowId))
    } catch {
      setError("We couldn't load version history. Check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { void loadVersions() }, [workflowId, refreshKey])

  return (
    <>
      <button type="button" className="version-history__scrim" aria-label="Close version history" onClick={onClose} disabled={isRestoring} />
      <aside className="version-history" aria-labelledby="version-history-title" aria-busy={isLoading || isRestoring}>
        <header className="version-history__header">
          <div><p>Saved workflow</p><h2 id="version-history-title">Version history</h2></div>
          <button type="button" className="inspector-panel__close" onClick={onClose} aria-label="Close version history" disabled={isRestoring}>×</button>
        </header>
        {isLoading && <p className="version-history__status" role="status">Loading versions...</p>}
        {error && <div className="version-history__error" role="alert"><span>{error}</span><button type="button" onClick={() => void loadVersions()} disabled={isLoading}>Retry</button></div>}
        {!isLoading && !error && versions.length === 0 && <p className="version-history__status">No saved versions yet.</p>}
        {!isLoading && !error && versions.length > 0 && (
          <ol className="version-history__list">
            {versions.map((version) => {
              const isLatest = version.versionNumber === latestVersionNumber
              const isCurrent = (isLatest && (currentFingerprint === savedFingerprint || (currentFingerprint === null && savedFingerprint !== null))) || (restoredVersion?.versionNumber === version.versionNumber && restoredVersion.fingerprint === currentFingerprint)
              return (
                <li className="version-history__item" key={version.versionNumber}>
                  <div className="version-history__item-copy">
                    <div className="version-history__item-title"><strong>Version {version.versionNumber}</strong>{isLatest && <span>Latest</span>}</div>
                    <p>{version.name}</p>
                    <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString()}</time>
                  </div>
                  <button type="button" onClick={() => onRestore(version.versionNumber)} disabled={isRestoring || isCurrent} aria-label={`Restore version ${version.versionNumber}`}>
                    {isRestoring ? "Loading..." : isCurrent ? "Current" : "Restore"}
                  </button>
                </li>
              )
            })}
          </ol>
        )}
      </aside>
    </>
  )
}

export default VersionHistoryDrawer
