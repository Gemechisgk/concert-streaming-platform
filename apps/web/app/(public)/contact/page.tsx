export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 sm:px-8 py-16">
      <div className="border-b border-line pb-6 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Support & Assistance</span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
          Contact Customer Care
        </h1>
        <p className="text-xs text-muted mt-2">
          Have an inquiry regarding ticket delivery, streaming playback, or payment reconciliation? Our 24/7 team is ready to assist.
        </p>
      </div>

      <div className="rounded-3xl border border-line bg-surface p-8 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Your Name</label>
            <input
              type="text"
              placeholder="e.g. Abebe Bikila"
              className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-muted mb-1.5">Email Address</label>
            <input
              type="email"
              placeholder="you@domain.com"
              className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Subject / Order Number</label>
          <input
            type="text"
            placeholder="e.g. Inquiry regarding Order ORD-2026-9921"
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-muted mb-1.5">Message</label>
          <textarea
            rows={4}
            placeholder="Describe your inquiry in detail..."
            className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
          />
        </div>

        <button
          onClick={() => alert('Support ticket received! Our team will respond shortly.')}
          className="rounded-full bg-polo-red px-7 py-3 text-xs font-black uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all"
        >
          Send Message
        </button>
      </div>
    </div>
  );
}
