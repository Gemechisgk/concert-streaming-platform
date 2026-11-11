import Link from 'next/link';
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Users,
  MessageSquare,
  Activity,
  FileBarChart,
  Radio,
  ArrowLeft,
  ShieldCheck
} from 'lucide-react';

export default function AdminLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-line bg-surface/90 flex flex-col justify-between p-5 shrink-0 hidden md:flex">
        <div className="space-y-6">
          {/* Admin Header */}
          <div className="flex items-center gap-2.5 pb-6 border-b border-line">
            <div className="size-9 rounded-xl bg-polo-red flex items-center justify-center text-white shadow-lg shadow-polo-red/20">
              <Radio className="size-4 animate-pulse" />
            </div>
            <div>
              <span className="text-sm font-black uppercase tracking-wider text-white block">
                Polo<span className="text-polo-red">Admin</span>
              </span>
              <span className="text-[10px] uppercase font-bold text-muted flex items-center gap-1">
                <ShieldCheck className="size-3 text-emerald-400" />
                Staff Operations
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 text-xs font-bold">
            <Link
              href="/admin"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <LayoutDashboard className="size-4 text-polo-red" />
              <span>Overview</span>
            </Link>

            <Link
              href="/admin/events"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <Calendar className="size-4 text-polo-red" />
              <span>Concerts & Events</span>
            </Link>

            <Link
              href="/admin/streaming"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <Activity className="size-4 text-polo-red" />
              <span>SRS Live Ingest</span>
            </Link>

            <Link
              href="/admin/finance"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <DollarSign className="size-4 text-polo-red" />
              <span>Orders & Finance</span>
            </Link>

            <Link
              href="/admin/moderation"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <MessageSquare className="size-4 text-polo-red" />
              <span>Chat Moderation</span>
            </Link>

            <Link
              href="/admin/users"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <Users className="size-4 text-polo-red" />
              <span>Users & RBAC</span>
            </Link>

            <Link
              href="/admin/reports"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-neutral-300 hover:text-white hover:bg-surface-raised transition-colors"
            >
              <FileBarChart className="size-4 text-polo-red" />
              <span>Reports & Telemetry</span>
            </Link>
          </nav>
        </div>

        {/* Back to Viewer Site */}
        <div className="pt-6 border-t border-line">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-bold text-muted hover:text-white transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Return to Public Site</span>
          </Link>
        </div>
      </aside>

      {/* Main Admin Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-line bg-surface/50 px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">SRS Origin & Next.js Cluster Online</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted">Admin User: <strong className="text-white">admin@polostreaming.com</strong></span>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
