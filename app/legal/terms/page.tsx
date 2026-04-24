import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms governing your use of The Council Intelligence Exchange.",
}

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 pt-28 pb-24">
      <header className="mb-12 border-b border-graphite pb-8">
        <p className="mono mb-3 text-[11px] uppercase tracking-[0.24em] text-ink-muted">
          Legal · Demm LLC
        </p>
        <h1 className="font-display text-[32px] leading-[1.15] text-ink sm:text-[40px]">
          Terms of Service
        </h1>
        <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.7] text-ink-body/80">
          Placeholder summary of the terms governing your use of this service.
          The authoritative full-text Terms are under counsel review and will
          be published here when finalized.
        </p>
      </header>

      <section className="prose-council flex flex-col gap-8 text-[15px] leading-[1.75] text-ink-body/80">
        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Not investment advice
          </h2>
          <p>
            The Council Intelligence Exchange is a{" "}
            <strong className="text-ink">publishing platform</strong>, operating
            under the publisher&apos;s exemption to the Investment Advisers Act
            of 1940. We do not provide individualized investment advice, manage
            money on your behalf, or recommend specific positions to you.
            Signals are information; they are not recommendations. Every
            investment decision is your own. Consult a qualified advisor before
            acting on anything you read here.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            What every claim carries
          </h2>
          <p>
            Every performance claim on this site is <em>stage-tagged</em> per
            our integrity contract:{" "}
            <Link
              href="/intelligence"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              pending / backtest-verified / broker-paper-tracking /
              live-verified / live-trading
            </Link>
            . Read the stage before interpreting the claim. Unverified claims
            are rendered blank, not fabricated.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Past performance
          </h2>
          <p>
            Past performance does not guarantee future results. Trading
            securities involves substantial risk of loss. You could lose some or
            all of your invested capital.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Acceptable use
          </h2>
          <p>
            You may read and use our content for personal, non-commercial
            purposes. You may not scrape, reverse-engineer, or bypass our
            access controls. You may not republish our signals as a competing
            publication without attribution and license.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Limitation of liability
          </h2>
          <p>
            The service is provided &quot;as-is.&quot; To the maximum extent
            permitted by law, Demm LLC is not liable for indirect, incidental,
            or consequential damages, or for investment losses arising from
            your use of the service.
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">Contact</h2>
          <p>
            Questions?{" "}
            <a
              href="mailto:antwannmitchell0@gmail.com"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              antwannmitchell0@gmail.com
            </a>
            . Legal process, security disclosures, and compliance inquiries
            follow the routing in{" "}
            <Link
              href="/security"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
            >
              Security
            </Link>
            .
          </p>
        </div>

        <div>
          <h2 className="mb-3 font-display text-[20px] text-ink">
            Full terms
          </h2>
          <p>
            The complete Terms of Service (template pending counsel review) are
            in the repository at{" "}
            <a
              href="https://github.com/antwannmitchell0/council-intelligence-exchange-v2/blob/main/docs/LEGAL/TERMS-OF-SERVICE.md"
              className="text-ink underline decoration-ink-veiled underline-offset-[3px]"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/LEGAL/TERMS-OF-SERVICE.md
            </a>
            . The canonical version will replace this page before paid
            subscriber signup launches.
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
