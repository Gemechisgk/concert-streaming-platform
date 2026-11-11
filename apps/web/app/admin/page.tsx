import Link from 'next/link';
import { AnalyticsService, TicketService, StreamService, EventService } from '@concert/business-logic';
import { formatCurrency, formatConcertDate } from '@concert/shared';
import {
  Users,
  DollarSign,
  Radio,
  Ticket,
  Gift,
  ArrowUpRight,
  Activity,
  PlusCircle,
  ExternalLink
} from 'lucide-react';

export default function AdminOverviewPage() {
  const metrics = AnalyticsService.getAdminMetrics();
  const recentOrders = TicketService.getAllOrders().slice(0, 5);
  const events = EventService.getEvents();
  const liveEvent = events.find(e => e.status === 'LIVE');

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Operational Overview
          </h1>
          <p className="text-xs text-muted mt-1">
            Real-time platform metrics, ticketing revenue, and live streaming capacity telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/events"
            className="flex items-center gap-1.5 rounded-full bg-polo-red px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-polo-red-dark transition-all shadow-lg"
          >
            <PlusCircle className="size-4" />
            <span>Create Concert</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Revenue */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Ticket Revenue</span>
            <DollarSign className="size-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-black text-white block">
            {formatCurrency(metrics.totalRevenueCents, 'ETB')}
          </span>
          <span className="text-[11px] text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="size-3" /> +24% vs last event cycle
          </span>
        </div>

        {/* Card 2: Active Viewers */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Active Live Audience</span>
            <Radio className="size-4 text-polo-red animate-pulse" />
          </div>
          <span className="text-2xl font-black text-white block">
            {metrics.activeViewersCount.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted font-semibold mt-1">
            Target capacity: 50,000–75,000
          </span>
        </div>

        {/* Card 3: Tickets Sold */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Total Passes Issued</span>
            <Ticket className="size-4 text-polo-red" />
          </div>
          <span className="text-2xl font-black text-white block">
            {metrics.ticketSalesTotal.toLocaleString()}
          </span>
          <span className="text-[11px] text-neutral-300 font-semibold mt-1">
            Across 5 Ticket Tiers
          </span>
        </div>

        {/* Card 4: Registered Users */}
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-center justify-between text-muted mb-3">
            <span className="text-xs font-bold uppercase tracking-wider">Registered Viewers</span>
            <Users className="size-4 text-blue-400" />
          </div>
          <span className="text-2xl font-black text-white block">
            {metrics.registeredViewers.toLocaleString()}
          </span>
          <span className="text-[11px] text-muted font-semibold mt-1">
            Global audience accounts
          </span>
        </div>
      </div>

      {/* Live Stream Stage Spotlight in Admin */}
      {liveEvent && (
        <div className="rounded-3xl border border-polo-red/40 bg-surface p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-polo-red/20 border border-polo-red flex items-center justify-center text-polo-red">
              <Radio className="size-7 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-polo-red text-white">
                  Live Stage Broadcasting
                </span>
                <span className="text-xs text-muted">{liveEvent.venueName}</span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">{liveEvent.title}</h2>
              <p className="text-xs text-muted">RTMP Ingest: <code className="text-neutral-300 font-mono">rtmp://localhost:1935/live</code></p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/streaming"
              className="px-4 py-2 rounded-xl bg-surface-raised border border-line hover:border-polo-red text-xs font-bold text-white transition-all"
            >
              Stream Telemetry
            </Link>
            <Link
              href={`/watch/${liveEvent.id}`}
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-polo-red text-xs font-bold text-white hover:bg-polo-red-dark transition-all"
            >
              <span>Monitor Watch Room</span>
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Recent Orders & Payments Table */}
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line pb-4 mb-4">
          <div>
            <h2 className="text-base font-extrabold text-white">Recent Ticket Orders</h2>
            <p className="text-xs text-muted">Real-time incoming purchases via Ethiopian & International payment gateways</p>
          </div>
          <Link href="/admin/finance" className="text-xs font-bold text-polo-red hover:underline">
            View All Orders
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Order #</th>
                <th className="py-3 px-3">Customer</th>
                <th className="py-3 px-3">Amount</th>
                <th className="py-3 px-3">Provider</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {recentOrders.map((ord) => (
                <tr key={ord.id} className="hover:bg-surface-raised/40 transition-colors">
                  <td className="py-3 px-3 font-mono font-bold text-white">{ord.orderNumber}</td>
                  <td className="py-3 px-3 text-neutral-300">{ord.userId}</td>
                  <td className="py-3 px-3 font-black text-white">
                    {formatCurrency(ord.totalAmountCents, ord.currency)}
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-raised border border-line text-neutral-300">
                      {ord.paymentProvider || 'TELEBIRR'}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {ord.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-muted">
                    {new Date(ord.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
