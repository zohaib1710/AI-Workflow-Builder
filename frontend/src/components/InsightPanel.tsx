import { useId } from "react"

interface InsightPanelProps {
  title: string
  items: string[]
  emptyMessage: string
}

function InsightPanel({ title, items, emptyMessage }: InsightPanelProps) {
  const headingId = useId()

  return (
    <section className="insight-panel" aria-labelledby={headingId}>
      <h3 id={headingId} className="insight-panel__heading">{title}</h3>
      {items.length > 0 ? (
        <ul className="insight-panel__list">
          {items.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="insight-panel__empty">{emptyMessage}</p>
      )}
    </section>
  )
}

export default InsightPanel
