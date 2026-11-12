export default function TermsPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-16 text-neutral-300 leading-relaxed text-xs space-y-6">
      <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Terms and Conditions</h1>
      <p>Last updated: November 2026</p>

      <h2 className="text-base font-bold text-white pt-4">1. Digital Broadcast Passes</h2>
      <p>Digital tickets purchased through Feshta Fest grant a non-exclusive, non-transferable, single-concurrent-stream license to view the designated live concert broadcast. Each ticket is secured with a cryptographically signed stream token.</p>

      <h2 className="text-base font-bold text-white pt-4">2. Single-Device Session Enforcement</h2>
      <p>To preserve broadcast integrity and artist intellectual property rights, each digital ticket code permits only one active stream playback session at any given moment. Initiating playback on a second device automatically invalidates the prior session.</p>

      <h2 className="text-base font-bold text-white pt-4">3. Payments & Ethiopian Currency Settlement</h2>
      <p>All local transactions processed via Telebirr, CBE Birr, Chapa, and Arifpay are denominated in Ethiopian Birr (ETB) and stored strictly in integer minor units (santims). International transactions are processed via Stripe in USD.</p>

      <h2 className="text-base font-bold text-white pt-4">4. Chat Moderation & Community Guidelines</h2>
      <p>Audience participation in live chat rooms is subject to automated word filters and active moderator oversight. Hate speech, harassment, spam, and unapproved commercial promotions result in immediate temporary or permanent bans.</p>
    </div>
  );
}
