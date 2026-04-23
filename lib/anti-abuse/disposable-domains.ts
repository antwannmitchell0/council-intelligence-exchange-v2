/**
 * Small, hand-curated blocklist of disposable / throwaway email providers.
 *
 * Intentionally narrow — this is defense-in-depth, NOT the primary gate.
 * Bots rotate domains faster than we can maintain a list. The combination
 * of honeypot + rate-limit + MX check + this set is what catches real abuse.
 *
 * Domains are lowercased. Match is exact on the hostname after `@`.
 */
export const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set<string>([
  // Mailinator family
  "mailinator.com",
  "mailinator.net",
  "mailinator.org",
  "mailinator2.com",
  "notmailinator.com",

  // Guerrilla Mail
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamailblock.com",
  "sharklasers.com",
  "grr.la",

  // 10minutemail / temp-mail family
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmailaddress.com",
  "tempmailo.com",
  "tempinbox.com",
  "temporarymail.com",
  "tmail.ws",
  "mintemail.com",
  "throwawaymail.com",
  "throwawayemailaddresses.com",
  "throwaway.email",

  // Trash / fake mail
  "trashmail.com",
  "trashmail.net",
  "trashmail.io",
  "trash-mail.com",
  "trash-mail.de",
  "trashmail.me",
  "mytrashmail.com",
  "fakeinbox.com",
  "fakemailgenerator.com",
  "fake-mail.com",

  // Yopmail family
  "yopmail.com",
  "yopmail.net",
  "yopmail.fr",
  "cool.fr.nf",
  "jetable.fr.nf",
  "nospam.ze.tc",
  "nomail.xl.cx",

  // Miscellaneous common disposables
  "dispostable.com",
  "maildrop.cc",
  "getairmail.com",
  "getnada.com",
  "nada.email",
  "mohmal.com",
  "emailondeck.com",
  "spamgourmet.com",
  "mytemp.email",
  "tempail.com",
  "wegwerfemail.de",
  "mailnesia.com",
  "mailcatch.com",
  "inboxbear.com",
  "harakirimail.com",
  "spam4.me",
  "moakt.com",
  "mailpoof.com",
  "mailforspam.com",
  "tempr.email",
  "discard.email",
  "anonymbox.com",
])
