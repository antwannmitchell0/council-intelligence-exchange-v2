// FloorHeader — top bar of /floor.
//
// Mirrors v1's "Council Trading Floor" header but in v2's violet/dark
// palette. Live status pill, instruction strip with mouse / drag / scroll
// affordances, and the title with violet gradient on the second word.

export function FloorHeader({
  agentCount,
  liveCount,
}: {
  agentCount: number
  liveCount: number
}) {
  return (
    <div className="border-b border-graphite bg-void/80 backdrop-blur-md">
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-md border p-2"
            style={{
              borderColor: "rgba(201,168,76,0.3)",
              backgroundColor: "rgba(201,168,76,0.08)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ color: "#c9a84c" }}
              aria-hidden
            >
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </div>
          <div>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink sm:text-[20px]">
              THE COUNCIL{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #c9a84c, #f59e0b)",
                }}
              >
                TRADING FLOOR
              </span>
            </h1>
            <p className="mono mt-0.5 text-[11px] uppercase tracking-[0.14em] text-ink-veiled">
              {agentCount} agents · click any desk to inspect
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-1.5">
            <span
              aria-hidden
              className="relative inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-50" />
            </span>
            <span className="mono text-[11px] uppercase tracking-[0.18em] text-emerald-300">
              Live
            </span>
          </div>
        </div>
      </div>

      {/* Instruction strip — gold-tinted (v1 council-exchange aesthetic) */}
      <div
        className="flex flex-wrap gap-x-6 gap-y-1 border-t border-graphite px-6 py-2.5 sm:px-8"
        style={{ backgroundColor: "rgba(201,168,76,0.05)" }}
      >
        <span
          className="mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(201,168,76,0.8)" }}
        >
          🖱️ click a desk to inspect
        </span>
        <span
          className="mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(201,168,76,0.8)" }}
        >
          🔄 drag to rotate
        </span>
        <span
          className="mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(201,168,76,0.8)" }}
        >
          🔍 scroll to zoom
        </span>
        <span
          className="mono text-[11px] uppercase tracking-[0.12em]"
          style={{ color: "rgba(201,168,76,0.8)" }}
        >
          ✋ right-click drag to pan
        </span>
        <span className="mono ml-auto text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          {liveCount} active · 90-day verification window
        </span>
      </div>
    </div>
  )
}
