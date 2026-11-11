import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PoloStreaming | Live Concerts, Events & Shows Worldwide',
  description: 'Experience premier stadium and arena live concert broadcasts with studio sound, adaptive multi-bitrate video, interactive live chat, and virtual gifting.',
  icons: {
    icon: '/favicon.ico'
  }
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-foreground antialiased selection:bg-polo-red selection:text-white">
        {children}
      </body>
    </html>
  );
}
