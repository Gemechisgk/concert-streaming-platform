import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

export default function ViewerLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1 pt-18">{children}</main>
      <Footer />
    </div>
  );
}
