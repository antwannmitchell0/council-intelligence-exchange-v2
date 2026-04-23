export type VerificationStatus = "verified" | "pending" | "unverified"

export type VerifiedField<T> = {
  status: VerificationStatus
  value: T
}

export const BLANK = "—" as const

export function renderIfVerified<T>(field: VerifiedField<T>): T | typeof BLANK {
  return field.status === "verified" ? field.value : BLANK
}

export function isBlank(rendered: unknown): rendered is typeof BLANK {
  return rendered === BLANK
}
