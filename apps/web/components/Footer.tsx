import Link from 'next/link';
import { Radio, ShieldCheck, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface/40 mt-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-polo-red text-white">
                <Radio className="size-4" />
              </div>
              <span className="font-black tracking-wider uppercase text-base">
                POLO<span className="text-polo-red">STREAMING</span>
              </span>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              The premier live concert streaming platform broadcasting legendary Ethiopian and international musical experiences worldwide with studio-quality sound and ultra-low latency.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Concerts</h4>
            <ul className="space-y-2 text-xs text-muted">
              <li><Link href="/events" className="hover:text-white transition-colors">Live Concerts</Link></li>
              <li><Link href="/events" className="hover:text-white transition-colors">Upcoming Tours</Link></li>
              <li><Link href="/replays" className="hover:text-white transition-colors">VOD Replays</Link></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">My Ticket Wallet</Link></li>
            </ul>
          </div>

          {/* Support & Legal */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Legal & Support</h4>
            <ul className="space-y-2 text-xs text-muted">
              <li><Link href="/contact" className="hover:text-white transition-colors">Help & Contact</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/admin" className="hover:text-white transition-colors">Staff Login</Link></li>
            </ul>
          </div>

          {/* Accepted Payments */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">Accepted Gateways</h4>
            <div className="flex flex-wrap gap-2 text-[11px] font-bold">
              <span className="px-2.5 py-1 rounded bg-surface border border-line text-muted">Telebirr</span>
              <span className="px-2.5 py-1 rounded bg-surface border border-line text-muted">CBE Birr</span>
              <span className="px-2.5 py-1 rounded bg-surface border border-line text-muted">Chapa</span>
              <span className="px-2.5 py-1 rounded bg-surface border border-line text-muted">Arifpay</span>
              <span className="px-2.5 py-1 rounded bg-surface border border-line text-muted">Stripe</span>
            </div>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck className="size-4 shrink-0" />
              <span>256-bit SSL Cryptographic Checkout</span>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-line/50 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-muted gap-4">
          <p>© {new Date().getFullYear()} PoloStreaming Platform. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Engineered for high-capacity live broadcasting <Heart className="size-3 text-polo-red inline fill-polo-red" />
          </p>
        </div>
      </div>
    </footer>
  );
}
