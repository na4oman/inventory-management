'use client'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex h-0 items-center justify-between px-6">
        {/* Left side - empty for now, can add breadcrumbs */}
        <div className="flex-1" />

        {/* Right side - empty, icons moved to sidebar */}
        <div className="flex items-center gap-4" />
      </div>
    </header>
  )
}
