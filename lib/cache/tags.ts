export const cacheTags = {
  leaderboard: "leaderboard",
  feed: "feed",
  sources: "sources",
  agents: "agents",
  agent: (id: string) => `agent:${id}`,
  health: "health",
} as const
