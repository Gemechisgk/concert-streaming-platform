import Link from 'next/link';
import { TicketService, AuthService, GiftService } from '@concert/business-logic';
import { formatConcertDate, formatConcertTime } from '@concert/shared';
import { Ticket, Coins, Play, Calendar, MapPin, User, LogOut, Sparkles, QrCode } from 'lucide-react';

export default async function DashboardPage() {
  const users = AuthService.getAllUsers();
  const currentUser = users[1] || users[0]; // demo viewer
  const tickets = TicketService.getUserTickets(currentUser.id);
  const coinBalance = GiftService.getWalletBalance(currentUser.id);

  return (
    <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
      {/* Profile & Wallet Banner */}
      <div className="rounded-3xl border border-line bg-surface p-6 sm:p-8 mb-10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="size-16 rounded-2xl bg-polo-red/20 border border-polo-red/40 flex items-center justify-center text-polo-red font-black text-2xl">
            {currentUser.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white">{currentUser.name}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-raised border border-line text-neutral-300">
                Verified Viewer
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">{currentUser.email} · {currentUser.phoneNumber || '+251 91 123 4567'}</p>
          </div>
        </div>

        {/* Wallet & Stats */}
        <div className="flex items-center gap-4">
          <div className="rounded-2xl border border-line bg-surface-raised px-5 py-3 flex items-center gap-3">
            <Coins className="size-6 text-amber-400" />
            <div>
              <span className="block text-[10px] uppercase font-bold text-muted">Fan Wallet</span>
              <span className="text-base font-black text-white">{coinBalance} Coins</span>
            </div>
          </div>

          <Link
            href="/events"
            className="rounded-full bg-polo-red px-5 py-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all"
          >
            Browse Concerts
          </Link>
        </div>
      </div>

      {/* Tickets Section */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
            <Ticket className="size-6 text-polo-red" />
            My Digital Ticket Wallet
          </h2>
          <p className="text-xs text-muted mt-1">Your cryptographic stream access passes and live show tickets.</p>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-3xl border border-line bg-surface p-12 text-center">
          <Ticket className="size-12 text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-white">No active ticket passes found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Explore our lineup of live concert broadcasts and purchase a pass to begin streaming.
          </p>
          <Link
            href="/events"
            className="inline-block mt-4 rounded-full bg-polo-red px-6 py-2.5 text-xs font-bold text-white"
          >
            Find Live Shows
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((t) => {
            const isLive = t.event.status === 'LIVE';
            return (
              <div
                key={t.id}
                className="rounded-3xl border border-line bg-surface overflow-hidden hover:border-polo-red/50 transition-all flex flex-col justify-between shadow-2xl"
              >
                <div>
                  <div className="relative aspect-[21/9] w-full overflow-hidden bg-black">
                    <img
                      src={t.event.bannerImage}
                      alt={t.event.title}
                      className="size-full object-cover filter brightness-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface to-transparent" />
                    <div className="absolute top-3 left-3">
                      {isLive ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-polo-red text-white animate-live-badge">
                          <span className="size-1.5 rounded-full bg-white animate-ping" /> Live Right Now
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-surface/90 border border-line text-white">
                          Upcoming Show
                        </span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        {t.ticketType.displayName}
                      </span>
                    </div>
                  </div>

                  <div className="p-6">
                    <h3 className="text-lg font-black text-white">{t.event.title}</h3>
                    <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3.5 text-polo-red" />
                        {formatConcertDate(t.event.startTime)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 text-polo-red" />
                        {t.event.venueName}
                      </span>
                    </div>

                    <div className="mt-4 p-3 rounded-xl bg-surface-raised border border-line flex items-center justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-muted block">Ticket Pass Code</span>
                        <span className="font-mono text-xs font-bold text-white">{t.ticketCode}</span>
                      </div>
                      <img src={t.qrCodeUrl} alt="QR" className="size-10 rounded bg-white p-0.5" />
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <Link
                    href={`/watch/${t.event.id}`}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-polo-red hover:bg-polo-red-dark py-3 text-xs font-black uppercase tracking-wider text-white shadow-xl transition-all active:scale-95"
                  >
                    <Play className="size-3.5 fill-white" />
                    <span>{isLive ? 'Stream Live Concert Now' : 'Enter Waiting Room'}</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
