import Link from 'next/link';
import { TicketService } from '@concert/business-logic';
import { formatCurrency, formatConcertDate, formatConcertTime } from '@concert/shared';
import { CheckCircle2, Ticket, Play, Calendar, Download, QrCode, ArrowRight, Radio } from 'lucide-react';

export default async function PaymentConfirmationPage({
  params,
  searchParams
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ ref?: string; gateway?: string }>;
}) {
  const { orderId } = await params;
  const { ref, gateway } = await searchParams;

  const orders = TicketService.getAllOrders();
  const order = orders.find(o => o.id === orderId) || orders[0];
  const userTickets = TicketService.getUserTickets('user_viewer_01');
  const ticket = userTickets.find(t => t.orderId === order?.id) || userTickets[0];

  const isLive = ticket?.event.status === 'LIVE';

  return (
    <div className="mx-auto max-w-2xl px-5 sm:px-8 py-16">
      {/* Success Badge */}
      <div className="text-center mb-10">
        <div className="inline-flex size-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-4 animate-bounce">
          <CheckCircle2 className="size-8" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 block">Payment Verified</span>
        <h1 className="text-3xl font-black uppercase tracking-tight text-white mt-1">
          You're Ready to Stream!
        </h1>
        <p className="text-xs text-muted mt-2">
          Order <span className="font-mono text-white">{order?.orderNumber || 'ORD-2026-9921'}</span> confirmed via {gateway?.toUpperCase() || 'TELEBIRR'}.
        </p>
      </div>

      {/* Ticket Pass Card */}
      <div className="rounded-3xl border border-line bg-surface overflow-hidden shadow-2xl">
        {/* Ticket Header */}
        <div className="p-6 bg-gradient-to-r from-surface to-surface-raised border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-polo-red flex items-center justify-center text-white">
              <Radio className="size-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase text-white block">Official Broadcast Pass</span>
              <span className="text-[10px] text-muted">{ticket?.ticketType?.displayName || 'VIP Digital Pass'}</span>
            </div>
          </div>

          {isLive ? (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-polo-red text-white animate-live-badge">
              <span className="size-1.5 rounded-full bg-white animate-ping" /> Live
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-surface border border-line text-neutral-300">
              Pass Active
            </span>
          )}
        </div>

        {/* Ticket Details & QR */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
          <div className="sm:col-span-8 space-y-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted">Concert Event</span>
              <h3 className="text-base font-black text-white">{ticket?.event.title}</h3>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Date</span>
                <span className="font-bold text-white">{formatConcertDate(ticket?.event.startTime || new Date().toISOString())}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-muted block">Venue</span>
                <span className="font-bold text-white">{ticket?.event.venueName}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-muted block">Unique Ticket Code</span>
              <span className="font-mono text-xs font-black text-polo-red bg-polo-red/10 px-2.5 py-1 rounded border border-polo-red/30">
                {ticket?.ticketCode || 'TKT-TED-VIP-0001-9X8K2'}
              </span>
            </div>
          </div>

          <div className="sm:col-span-4 flex flex-col items-center justify-center p-3 rounded-2xl bg-white border border-neutral-300">
            <img
              src={ticket?.qrCodeUrl || 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TEST'}
              alt="Pass QR code"
              className="size-28 object-contain"
            />
            <span className="text-[9px] font-bold text-black uppercase tracking-wider mt-1">Scan for Fast Access</span>
          </div>
        </div>

        {/* Actions Bar */}
        <div className="p-6 bg-surface-raised border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="text-xs font-bold text-muted hover:text-white flex items-center gap-1.5"
          >
            <Ticket className="size-3.5" />
            <span>View In My Wallet</span>
          </Link>

          <Link
            href={`/watch/${ticket?.event.id}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-polo-red px-7 py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl shadow-polo-red/30 hover:bg-polo-red-dark active:scale-95 transition-all"
          >
            <Play className="size-3.5 fill-white" />
            <span>{isLive ? 'Watch Live Stream' : 'Enter Waiting Room'}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
