'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TicketType, ConcertEvent, PaymentProviderType } from '@concert/types';
import { formatCurrency } from '@concert/shared';
import { ShieldCheck, Ticket, CreditCard, Smartphone, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const tierId = params?.tierId as string;

  const [tier, setTier] = useState<TicketType | null>(null);
  const [event, setEvent] = useState<ConcertEvent | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [provider, setProvider] = useState<PaymentProviderType>('TELEBIRR');
  const [name, setName] = useState('Abebe Bikila');
  const [email, setEmail] = useState('abebe@example.com');
  const [phone, setPhone] = useState('+251911234567');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch tier & event
    fetch('/api/v1/events')
      .then(res => res.json())
      .then(data => {
        if (data.events) {
          for (const ev of data.events) {
            fetch(`/api/v1/events/${ev.slug}`)
              .then(res => res.json())
              .then(detail => {
                const found = detail.ticketTypes?.find((t: TicketType) => t.id === tierId);
                if (found) {
                  setTier(found);
                  setEvent(detail.event);
                }
              });
          }
        }
      });
  }, [tierId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tier || !event) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event.id,
          items: [{ ticketTypeId: tier.id, quantity }],
          currency: tier.currency,
          paymentProvider: provider,
          customerEmail: email,
          customerName: name,
          customerPhone: phone,
          idempotencyKey: `chk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Route to confirmation / receipt page
      router.push(`/payment-confirmation/${data.order.id}?ref=${data.payment.reference}&gateway=${provider.toLowerCase()}`);
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  const totalCents = (tier?.priceInCents ?? 40000) * quantity;

  return (
    <div className="mx-auto max-w-4xl px-5 sm:px-8 py-12">
      {/* Page Header */}
      <div className="border-b border-line pb-6 mb-8">
        <span className="text-xs font-bold uppercase tracking-widest text-polo-red">Secure Ticket Purchase</span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
          Complete Your Order
        </h1>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-950/60 border border-red-800 p-4 text-xs text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Left: Customer Info & Payment Method */}
        <div className="md:col-span-7 space-y-8">
          {/* Customer Details */}
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-base font-extrabold text-white mb-4">1. Attendee Contact Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">Email Address (for ticket pass delivery)</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-muted mb-1.5">Mobile Phone (optional for SMS pass)</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface-raised px-4 py-2.5 text-xs text-white focus:border-polo-red focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="rounded-3xl border border-line bg-surface p-6">
            <h2 className="text-base font-extrabold text-white mb-4">2. Select Payment Gateway</h2>

            <div className="space-y-3">
              {/* Telebirr */}
              <label
                onClick={() => setProvider('TELEBIRR')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  provider === 'TELEBIRR'
                    ? 'border-polo-red bg-polo-red/10'
                    : 'border-line bg-surface-raised hover:border-line/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-black text-xs">
                    TB
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Telebirr SuperApp</span>
                    <span className="text-[11px] text-muted">Pay with Ethio Telecom mobile wallet</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === 'TELEBIRR'}
                  onChange={() => setProvider('TELEBIRR')}
                  className="accent-polo-red"
                />
              </label>

              {/* CBE Birr */}
              <label
                onClick={() => setProvider('CBE_BIRR')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  provider === 'CBE_BIRR'
                    ? 'border-polo-red bg-polo-red/10'
                    : 'border-line bg-surface-raised hover:border-line/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-black text-xs">
                    CBE
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Commercial Bank of Ethiopia (CBE Birr)</span>
                    <span className="text-[11px] text-muted">Direct bank mobile transfer</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === 'CBE_BIRR'}
                  onChange={() => setProvider('CBE_BIRR')}
                  className="accent-polo-red"
                />
              </label>

              {/* Chapa / Arifpay */}
              <label
                onClick={() => setProvider('CHAPA')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  provider === 'CHAPA'
                    ? 'border-polo-red bg-polo-red/10'
                    : 'border-line bg-surface-raised hover:border-line/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center font-black text-xs">
                    CHP
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">Chapa / Arifpay</span>
                    <span className="text-[11px] text-muted">Local cards, Awash, Dashen & M-PESA</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === 'CHAPA'}
                  onChange={() => setProvider('CHAPA')}
                  className="accent-polo-red"
                />
              </label>

              {/* Stripe */}
              <label
                onClick={() => setProvider('STRIPE')}
                className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                  provider === 'STRIPE'
                    ? 'border-polo-red bg-polo-red/10'
                    : 'border-line bg-surface-raised hover:border-line/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                    <CreditCard className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white text-xs block">International Credit/Debit Card</span>
                    <span className="text-[11px] text-muted">Visa, MasterCard, Apple Pay via Stripe</span>
                  </div>
                </div>
                <input
                  type="radio"
                  name="provider"
                  checked={provider === 'STRIPE'}
                  onChange={() => setProvider('STRIPE')}
                  className="accent-polo-red"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="md:col-span-5">
          <div className="rounded-3xl border border-line bg-surface p-6 sticky top-24 shadow-2xl">
            <h2 className="text-base font-extrabold text-white mb-4">Order Summary</h2>

            <div className="p-4 rounded-2xl bg-surface-raised border border-line mb-6">
              <span className="text-[10px] uppercase font-bold text-polo-red">{event?.venueCity || 'Addis Ababa'} Concert</span>
              <h3 className="text-sm font-black text-white mt-0.5">{event?.title || 'Concert Live Stream'}</h3>
              <div className="mt-3 flex items-center justify-between text-xs text-muted">
                <span>Tier:</span>
                <span className="font-bold text-white">{tier?.displayName || 'Live Stream Pass'}</span>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pb-4 border-b border-line mb-4 text-xs">
              <span className="font-bold text-muted">Number of Passes:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="size-7 rounded-lg bg-surface-raised border border-line text-white font-bold hover:bg-line"
                >
                  -
                </button>
                <span className="font-mono font-bold text-white w-4 text-center">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(4, quantity + 1))}
                  className="size-7 rounded-lg bg-surface-raised border border-line text-white font-bold hover:bg-line"
                >
                  +
                </button>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm font-bold text-muted">Total Amount:</span>
              <span className="text-xl font-black text-white">
                {formatCurrency(totalCents, tier?.currency || 'ETB')}
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-full bg-polo-red hover:bg-polo-red-dark text-white font-black text-xs uppercase tracking-wider transition-all shadow-xl shadow-polo-red/25 flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>Pay & Secure Ticket</span>
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>

            <div className="mt-6 flex items-center gap-2 text-[11px] text-muted">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0" />
              <span>Encrypted payment processing. Your stream ticket is issued immediately upon confirmation.</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
