import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How The Council Intelligence Exchange collects, uses, and protects your data.",
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-28 pb-24">
      <header className="mb-12 border-b border-graphite pb-8">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Legal · Demm LLC
        </p>
        <h1 className="font-display text-[32px] leading-[1.15] text-ink sm:text-[40px]">
          Privacy Policy
        </h1>
        <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-ink-body/80">
          This is a placeholder summary of our privacy commitments. The
          authoritative, full-text policy is under counsel review and will be
          published here when finalized.
        </p>
      </header>

      <section className="prose-council flex flex-col gap-8 text-[15px] leading-[1.75] text-ink-body/80">
        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            What we collect
          </h2>
          <p>
            Today we collect only the email address you voluntarily submit to
            our waitlist. We never store raw IP addresses or user-agents — only
            salted SHA-256 hashes for anti-abuse enforcement. We do not use
            tracking cookies or advertising pixels.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            How we use it
          </h2>
          <p>
            Your data is used only to deliver the service: responding to your
            waitlist inquiry, preventing abuse, and — when subscriptions launch
            — managing your account. We never sell, rent, or share your data
            for advertising.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">Your rights</h2>
          <p>
            You can request access to, correction of, or deletion of your data
            at any time. Contact{" "}
            <a
              href="mailto:antwannmitchell0@gmail.com"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              antwannmitchell0@gmail.com
            </a>
            . We respond within 30 days.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Infrastructure
          </h2>
          <p>
            The Council runs on Vercel (hosting), Supabase (database), and
            Alpaca (broker — paper trading only). All are SOC 2 Type II
            certified or equivalent. Data is encrypted in transit (TLS 1.2+)
            and at rest (AES-256). See{" "}
            <Link
              href="/security"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              Security
            </Link>{" "}
            for the full posture.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Full policy
          </h2>
          <p>
            The complete Privacy Policy (template pending counsel review) is
            available in the repository at{" "}
            <a
              href="https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/LEGAL/PRIVACY-POLICY.md"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/LEGAL/PRIVACY-POLICY.md
            </a>
            . The canonical, legally-reviewed version will replace this page
            before paid subscriber signup launches.
          </p>
        </div>
      </section>

      <footer className="mt-16 border-t border-graphite pt-6">
        <p className="mono text-[11px] uppercase tracking-[0.18em] text-ink-veiled">
          Last updated 2026-04-24 · Demm LLC
        </p>
      </footer>
    </main>
  )
}
