import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Security",
  description:
    "The Council's public security posture and responsible-disclosure policy.",
}

export default function SecurityPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-28 pb-24">
      <header className="mb-12 border-b border-graphite pb-8">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Security · Demm LLC
        </p>
        <h1 className="font-display text-[32px] leading-[1.15] text-ink sm:text-[40px]">
          Security
        </h1>
        <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-ink-body/80">
          The Council is built integrity-first. Every claim is auditable; every
          access path is gated; every vendor we inherit carries SOC 2 Type II
          certification.
        </p>
      </header>

      <section className="prose-council flex flex-col gap-8 text-[15px] leading-[1.75] text-ink-body/80">
        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Responsible disclosure
          </h2>
          <p>
            If you believe you&apos;ve found a security vulnerability, email{" "}
            <a
              href="mailto:antwannmitchell0@gmail.com"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              antwannmitchell0@gmail.com
            </a>
            {" "}with a description and reproduction steps. We acknowledge within
            48 hours and keep you updated through remediation. Good-faith
            research is welcomed — we won&apos;t pursue legal action against
            researchers who follow our{" "}
            <a
              href="https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/SECURITY.md"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              disclosure policy
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Inherited compliance
          </h2>
          <p>
            Our stack runs entirely on vendors with active SOC 2 Type II (or
            equivalent) certifications:
          </p>
          <ul className="ml-5 mt-3 list-disc space-y-1 text-ink-body/70">
            <li>Vercel — hosting, edge, TLS</li>
            <li>Supabase — database, realtime</li>
            <li>Alpaca — broker (paper only; live trading blocked pending RIA)</li>
            <li>Clerk — identity (when subscriber auth launches)</li>
            <li>Stripe — payments (PCI-DSS Level 1; when subscriptions launch)</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Data protection
          </h2>
          <p>
            All data is encrypted in transit (TLS 1.2+) and at rest (AES-256).
            Database backups run daily with a 7-day retention window. Secrets
            never appear in logs or browser bundles — they live only in
            Vercel&apos;s encrypted environment variable store.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Integrity architecture
          </h2>
          <p>
            The product&apos;s security-relevant differentiator: an{" "}
            <strong className="text-ink">append-only integrity audit log</strong>
            {" "}that records every stage transition, order outcome, and admin
            action. The table has no UPDATE or DELETE policy — rows are
            immutable once written, even for the operator. Every performance
            claim on this site can be independently verified by any observer
            via documented SQL queries.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Full posture
          </h2>
          <p>
            The complete security posture, incident response runbook, and
            responsible disclosure policy are published at{" "}
            <a
              href="https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/SECURITY.md"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/SECURITY.md
            </a>
            {" "}in our public repository. For a complete system architecture
            and due-diligence packet, see{" "}
            <a
              href="https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/OPERATING-MANUAL.md"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/OPERATING-MANUAL.md
            </a>
            .
          </p>
        </div>
      </section>

      <footer className="mt-16 border-t border-graphite pt-6">
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          Last updated 2026-04-24 · Demm LLC · See also{" "}
          <Link
            href="/legal/privacy"
            className="text-ink-muted underline decoration-ink-veiled underline-offset-[3px]"
          >
            Privacy
          </Link>{" "}
          ·{" "}
          <Link
            href="/legal/terms"
            className="text-ink-muted underline decoration-ink-veiled underline-offset-[3px]"
          >
            Terms
          </Link>
        </p>
      </footer>
    </main>
  )
}
