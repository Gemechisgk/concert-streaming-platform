import Link from 'next/link';
import { Radio } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link href="/" className="inline-flex items-center gap-2 group">
          <div className="flex size-10 items-center justify-center rounded-xl bg-polo-red text-white shadow-lg shadow-polo-red/20 group-hover:scale-105 transition-transform">
            <Radio className="size-5 animate-pulse" />
          </div>
          <span className="text-xl font-black tracking-wider uppercase leading-none">
            <span className="text-white">POLO</span>
            <span className="text-polo-red">STREAMING</span>
          </span>
        </Link>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md px-4">{children}</div>
    </div>
  );
}
