export const council = {
  color: {
    void: "#0A0B0F",
    obsidian: "#12131A",
    graphite: "#1C1E28",

    violet: "#7C5CFF",
    violetGlow: "#9D82FF",
    violetDeep: "#4A2FD6",

    cyan: "#29E6D1",

    amber: "#F5A524",
    danger: "#FF4D6D",
    success: "#4ADE80",

    ink: "#F8F9FB",
    inkBody: "#E6E7EB",
    inkMuted: "#8A8D9A",
    inkVeiled: "#4F5260",
  },

  agent: [
    { id: "aether", name: "Aether UI/UX Architect", hex: "#7C5CFF" },
    { id: "telemetry", name: "Telemetry & Response", hex: "#29E6D1" },
    { id: "cost-sentinel", name: "Quantum Cost Sentinel", hex: "#F5A524" },
    { id: "oracle", name: "Oracle Grant Seeker", hex: "#4ADE80" },
    { id: "cyber-sentinels", name: "Cyber-Sentinels", hex: "#FF4D6D" },
    { id: "nexus", name: "Nexus Architect", hex: "#60A5FA" },
    { id: "chronos", name: "Chronos Orchestrator", hex: "#C084FC" },
    { id: "momentum", name: "Momentum Marketing Conduit", hex: "#FB923C" },
    { id: "evolutionary", name: "Evolutionary Architect", hex: "#E879F9" },
  ] as const,

  ease: {
    council: "cubic-bezier(0.4, 0, 0.2, 1)",
    out: "cubic-bezier(0.0, 0, 0.2, 1)",
    sharp: "cubic-bezier(0.4, 0, 0.6, 1)",
  },

  duration: {
    micro: 120,
    base: 240,
    hero: 480,
  },

  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    card: 8,
    cardHero: 12,
  },

  space: [4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128] as const,
} as const

export type AgentId = (typeof council.agent)[number]["id"]

export function agentColor(id: AgentId): string {
  return council.agent.find((a) => a.id === id)?.hex ?? council.color.inkMuted
}
