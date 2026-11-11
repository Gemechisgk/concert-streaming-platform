export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-16 text-neutral-300 leading-relaxed text-xs space-y-6">
      <h1 className="text-3xl font-black uppercase tracking-tight text-white mb-6">Privacy Policy</h1>
      <p>Last updated: November 2026</p>

      <h2 className="text-base font-bold text-white pt-4">1. Data Collection</h2>
      <p>PoloStreaming collects minimal user information strictly necessary for ticket pass fulfillment, payment verification, and stream quality telemetry (bitrate, frame drops, buffer health).</p>

      <h2 className="text-base font-bold text-white pt-4">2. Cookies & Session Security</h2>
      <p>We utilize HttpOnly, Secure, SameSite cookies for authentication tokens. We do not sell user data or share attendee records with third-party advertising networks.</p>

      <h2 className="text-base font-bold text-white pt-4">3. Payment Information</h2>
      <p>Credit card details and mobile wallet credentials are never stored on our application servers. All payment flows are handled through direct PCI-DSS compliant gateways.</p>
    </div>
  );
}
