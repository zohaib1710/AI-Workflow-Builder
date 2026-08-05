function Header() {
  return (
    <header className="space-y-4">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-700">
        AI Workflow Builder
      </p>
      <div className="max-w-3xl space-y-3">
        <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
          Turn natural-language process requirements into visual workflow diagrams.
        </h1>
        <p className="text-lg leading-8 text-slate-600">
          Describe the process you have in mind and get a structured workflow ready for review.
        </p>
      </div>
    </header>
  )
}

export default Header
