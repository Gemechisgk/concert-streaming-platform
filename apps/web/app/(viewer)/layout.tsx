'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ViewerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isWatchRoom = pathname?.startsWith('/watch');

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className={`flex-1 ${isWatchRoom ? 'pt-14 sm:pt-18' : 'pt-18'}`}>
        {children}
      </main>
      {!isWatchRoom && <Footer />}
    </div>
  );
}
