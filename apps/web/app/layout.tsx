import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Feshta Fest | Live Concerts, Festivals & Shows Worldwide',
  description: 'Experience premier live concert and festival broadcasts on Feshta Fest with studio-grade sound, adaptive multi-bitrate video, interactive live chat, and virtual gifting.',
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
