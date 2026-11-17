const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const roles = await prisma.role.count();
  const gifts = await prisma.giftCatalog.count();
  const events = await prisma.event.findMany({ select: { id: true, title: true, status: true, slug: true } });
  const channels = await prisma.streamChannel.count();
  const ticketTypes = await prisma.ticketType.count();
  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true, roles: { include: { role: true } } } });
  const tickets = await prisma.ticket.findMany({ select: { id: true, ticketCode: true, status: true, user: { select: { email: true } } } });
  const cameras = await prisma.cameraFeed.findMany({ select: { id: true, name: true, streamKey: true, isDefault: true, isActiveLive: true, status: true } });
  
  console.log('=== SUPABASE DATABASE VERIFICATION ===');
  console.log(`Roles in Supabase: ${roles}`);
  console.log(`Gifts in Supabase: ${gifts}`);
  console.log(`Events in Supabase: ${events.length}`);
  console.log(`Stream Channels in Supabase: ${channels}`);
  console.log(`Ticket Types in Supabase: ${ticketTypes}`);
  console.log(`Users in Supabase: ${users.length}`);
  users.forEach(u => console.log(`  - User: ${u.email} (${u.name}) Roles: [${u.roles.map(r => r.role.name).join(', ')}]`));
  console.log(`Tickets in Supabase: ${tickets.length}`);
  tickets.forEach(t => console.log(`  - Ticket: ${t.ticketCode} (${t.status}) for ${t.user.email}`));
  console.log(`Camera Feeds in Supabase: ${cameras.length}`);
  cameras.forEach(c => console.log(`  - Cam: ${c.name} [${c.streamKey}] Default: ${c.isDefault}, Active: ${c.isActiveLive}, Status: ${c.status}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
