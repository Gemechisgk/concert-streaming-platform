import { AnalyticsService } from '@concert/business-logic';
import { formatCurrency } from '@concert/shared';
import { BarChart3, TrendingUp, Globe, Clock, Download } from 'lucide-react';

export default function AdminReportsPage() {
  const metrics = AnalyticsService.getAdminMetrics();

  return (
    <div className="space-y-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">
            Audience & Revenue Telemetry
          </h1>
          <p className="text-xs text-muted mt-1">
            Historical broadcast analytics, geographic viewership distribution, and peak concurrent viewers (PCV).
          </p>
        </div>

        <button
          onClick={() => alert('Generating full analytics audit report...')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-polo-red text-xs font-bold text-white hover:bg-polo-red-dark transition-all"
        >
          <Download className="size-3.5" />
          <span>Export Analytics PDF</span>
        </button>
      </div>

      {/* Grid of Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Geographic Distribution */}
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl">
          <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
            <Globe className="size-4 text-polo-red" />
            Audience Geographic Breakdown
          </h2>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span className="font-bold">Ethiopia (Local In-Country)</span>
                <span className="font-mono text-white">68%</span>
              </div>
              <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden">
                <div className="bg-polo-red h-full rounded-full" style={{ width: '68%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span className="font-bold">United States & Canada (Diaspora)</span>
                <span className="font-mono text-white">18%</span>
              </div>
              <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '18%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span className="font-bold">Europe (UK, Germany, Sweden)</span>
                <span className="font-mono text-white">10%</span>
              </div>
              <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden">
                <div className="bg-amber-500 h-full rounded-full" style={{ width: '10%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span className="font-bold">Middle East & Rest of World</span>
                <span className="font-mono text-white">4%</span>
              </div>
              <div className="w-full bg-surface-raised h-2 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: '4%' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Viewership Telemetry */}
        <div className="rounded-3xl border border-line bg-surface p-6 shadow-xl">
          <h2 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
            <Clock className="size-4 text-polo-red" />
            Watch Time & Engagement Metrics
          </h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-surface-raised border border-line">
              <span className="text-[10px] uppercase font-bold text-muted block">Avg Watch Time</span>
              <span className="text-xl font-black text-white mt-1 block">1h 48m</span>
              <span className="text-[10px] text-emerald-400 mt-1 block">High retention rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-raised border border-line">
              <span className="text-[10px] uppercase font-bold text-muted block">Peak Concurrent (PCV)</span>
              <span className="text-xl font-black text-polo-red mt-1 block">42,890 Viewers</span>
              <span className="text-[10px] text-muted mt-1 block">Achieved during live climax</span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-raised border border-line">
              <span className="text-[10px] uppercase font-bold text-muted block">HLS Buffer Health</span>
              <span className="text-xl font-black text-white mt-1 block">99.4%</span>
              <span className="text-[10px] text-emerald-400 mt-1 block">Zero major buffer stalls</span>
            </div>

            <div className="p-4 rounded-2xl bg-surface-raised border border-line">
              <span className="text-[10px] uppercase font-bold text-muted block">CDN Egress Bandwidth</span>
              <span className="text-xl font-black text-white mt-1 block">184.2 TB</span>
              <span className="text-[10px] text-muted mt-1 block">Multi-region distributed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
