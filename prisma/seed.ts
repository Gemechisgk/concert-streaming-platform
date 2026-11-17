import { PrismaClient, RoleType, EventStatus, TicketTierType } from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_DATA = {
  roles: [
    { name: RoleType.SUPER_ADMIN, description: 'Full system privileges' },
    { name: RoleType.EVENT_ADMIN, description: 'Manage concert events and broadcast schedule' },
    { name: RoleType.EVENT_MANAGER, description: 'Operate concert events and line-ups' },
    { name: RoleType.FINANCE_MANAGER, description: 'Access financial transactions, payouts and reconciliation' },
    { name: RoleType.CUSTOMER_SUPPORT, description: 'Assist ticket holders and resolve payment queries' },
    { name: RoleType.CHAT_MODERATOR, description: 'Moderate real-time audience chat and pin announcements' },
    { name: RoleType.VIEWER, description: 'Standard audience member and ticket purchaser' }
  ],
  gifts: [
    { name: 'Rose', emoji: '🌹', coins: 10, priceCents: 1000, animationType: 'heart' },
    { name: 'Applause', emoji: '👏', coins: 25, priceCents: 2500, animationType: 'sparkle' },
    { name: 'Golden Mic', emoji: '🎤', coins: 50, priceCents: 5000, animationType: 'sparkle' },
    { name: 'Electric Guitar', emoji: '🎸', coins: 100, priceCents: 10000, animationType: 'guitar' },
    { name: 'Fireworks', emoji: '🎆', coins: 250, priceCents: 25000, animationType: 'fireworks' },
    { name: 'Crown', emoji: '👑', coins: 500, priceCents: 50000, animationType: 'crown' }
  ],
  events: [
    {
      title: 'Teddy Afro Live in Addis: Millennium Celebration',
      slug: 'teddy-afro-live-in-addis',
      tagline: 'The iconic Ethiopian maestro in an unforgettable global live concert broadcast',
      description: 'Join over 50,000 live viewers worldwide as Teddy Afro takes the grand stage at Millennium Hall in Addis Ababa with full orchestral support, performing beloved anthems and brand new tracks in ultra-high-definition.',
      bannerImage: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1920&auto=format&fit=crop',
      thumbnailImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
      status: EventStatus.LIVE,
      venueName: 'Millennium Hall Main Arena',
      venueCity: 'Addis Ababa',
      venueCountry: 'Ethiopia',
      startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
      featured: true,
      artists: [
        {
          name: 'Teddy Afro',
          role: 'Headlining Artist',
          bio: 'Tewodros Kassahun, popularly known as Teddy Afro, is an Ethiopian pop and reggae superstar whose poetic lyrics and electrifying melodies define modern Ethiopian music.',
          imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop'
        },
        {
          name: 'Addis Symphony Orchestra',
          role: 'Guest Orchestra',
          bio: '40-piece master instrumental ensemble providing sweeping cinematic arrangements.',
          imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop'
        }
      ],
      schedules: [
        { stageName: 'Main Stage', title: 'Opening Symphony & Intro', performerName: 'Addis Symphony Orchestra', startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(), endTime: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
        { stageName: 'Main Stage', title: 'Teddy Afro Live Performance Part 1', performerName: 'Teddy Afro', startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), endTime: new Date(Date.now() + 90 * 60 * 1000).toISOString() },
        { stageName: 'Main Stage', title: 'Acoustic Intermission & Encore', performerName: 'Teddy Afro & Guests', startTime: new Date(Date.now() + 90 * 60 * 1000).toISOString(), endTime: new Date(Date.now() + 180 * 60 * 1000).toISOString() }
      ],
      ticketTypes: [
        { tier: TicketTierType.EARLY_BIRD, displayName: 'Early Bird Live Pass', description: 'Access to 1080p live stream + 24hr replay', priceInCents: 25000, currency: 'ETB', capacity: 5000, soldCount: 5000 },
        { tier: TicketTierType.STANDARD, displayName: 'Standard Live Pass', description: 'Full live stream access in HD with live chat participation', priceInCents: 40000, currency: 'ETB', capacity: 25000, soldCount: 18450 },
        { tier: TicketTierType.VIP, displayName: 'VIP Backstage Digital Pass', description: 'Ultra-low latency stream, VIP live chat badge, exclusive backstage camera feeds + 30-day VOD replay', priceInCents: 90000, currency: 'ETB', capacity: 3000, soldCount: 2210 }
      ],
      streamChannel: {
        primaryIngestKey: 'live_teddy_afro_secret_key_prim',
        backupIngestKey: 'live_teddy_afro_secret_key_back',
        streamStatus: 'LIVE',
        hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        fps: 60,
        bitrateKbps: 4500
      }
    },
    {
      title: 'Rophnan: MYSTICS Electronic Live Spectacle',
      slug: 'rophnan-mystics-electronic-spectacle',
      tagline: 'Futuristic Ethiopian electronic music, hypnotic visuals, and immersive soundscapes',
      description: 'Pioneering Ethiopian electronic artist and producer Rophnan presents MYSTICS, an awe-inspiring fusion of traditional Ethiopian rhythms, synthesizers, and massive visual laser installations.',
      bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1920&auto=format&fit=crop',
      thumbnailImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop',
      status: EventStatus.SCHEDULED,
      venueName: 'Ghion Amphitheatre',
      venueCity: 'Addis Ababa',
      venueCountry: 'Ethiopia',
      startTime: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
      endTime: new Date(Date.now() + 3 * 86400 * 1000 + 4 * 3600 * 1000).toISOString(),
      featured: true,
      artists: [
        {
          name: 'Rophnan',
          role: 'Producer & Performer',
          bio: 'Trailblazer of Afro-electronic and Ethiopian EDM revolutionizing contemporary sounds with cultural polyrhythms.',
          imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'
        }
      ],
      schedules: [
        { stageName: 'Synthesizer Stage', title: 'Electronic Warmup', performerName: 'Guest DJ', startTime: new Date(Date.now() + 3 * 86400 * 1000).toISOString(), endTime: new Date(Date.now() + 3 * 86400 * 1000 + 3600 * 1000).toISOString() },
        { stageName: 'Main Electronic Arena', title: 'MYSTICS Live Performance', performerName: 'Rophnan', startTime: new Date(Date.now() + 3 * 86400 * 1000 + 3600 * 1000).toISOString(), endTime: new Date(Date.now() + 3 * 86400 * 1000 + 3 * 3600 * 1000).toISOString() }
      ],
      ticketTypes: [
        { tier: TicketTierType.STANDARD, displayName: 'General Admission Live Stream', description: 'Standard 1080p stream access + chat', priceInCents: 35000, currency: 'ETB', capacity: 15000, soldCount: 4200 },
        { tier: TicketTierType.VIP, displayName: 'VIP Virtual Experience', description: 'Spatial audio mix feed, multi-angle camera selector, digital souvenir badge', priceInCents: 75000, currency: 'ETB', capacity: 2000, soldCount: 1100 }
      ],
      streamChannel: {
        primaryIngestKey: 'live_rophnan_mystics_key_prim',
        backupIngestKey: 'live_rophnan_mystics_key_back',
        streamStatus: 'OFFLINE',
        hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        fps: 60,
        bitrateKbps: 4500
      }
    },
    {
      title: 'Aster Aweke: Timeless Soul & Ballads',
      slug: 'aster-aweke-timeless-soul',
      tagline: 'The Queen of Ethiopian Soul in an exclusive intimate acoustic session',
      description: 'An enchanting evening of golden era classics, soulful jazz adaptations, and emotional power ballads sung by Aster Aweke accompanied by international jazz masters.',
      bannerImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1920&auto=format&fit=crop',
      thumbnailImage: 'https://images.unsplash.com/photo-1520523839898-507121773489?q=80&w=600&auto=format&fit=crop',
      status: EventStatus.ENDED,
      venueName: 'Sheraton Grand Ballroom',
      venueCity: 'Addis Ababa',
      venueCountry: 'Ethiopia',
      startTime: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
      endTime: new Date(Date.now() - 7 * 86400 * 1000 + 3 * 3600 * 1000).toISOString(),
      featured: false,
      artists: [
        {
          name: 'Aster Aweke',
          role: 'Vocalist',
          bio: 'Renowned Ethiopian singer with decades of chart-topping hits and unmatched vocal range.',
          imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'
        }
      ],
      schedules: [],
      ticketTypes: [
        { tier: TicketTierType.STANDARD, displayName: 'Replay VOD Pass', description: 'Unlimited 4K replay access', priceInCents: 30000, currency: 'ETB', capacity: 50000, soldCount: 8900 }
      ],
      streamChannel: {
        primaryIngestKey: 'live_aster_aweke_key',
        backupIngestKey: 'live_aster_aweke_back',
        streamStatus: 'ENDED',
        hlsMasterUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        fps: 60,
        bitrateKbps: 4500
      }
    }
  ]
};

async function main() {
  console.log('Starting seed process...');
  // Upsert roles
  for (const role of SEED_DATA.roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description }
    });
  }
  console.log('Roles seeded successfully.');

  // Upsert gift catalog
  for (const gift of SEED_DATA.gifts) {
    const existing = await prisma.giftCatalog.findFirst({ where: { name: gift.name } });
    if (!existing) {
      await prisma.giftCatalog.create({ data: gift });
    }
  }
  console.log('Gift catalog seeded.');

  // Upsert events
  for (const ev of SEED_DATA.events) {
    const event = await prisma.event.upsert({
      where: { slug: ev.slug },
      update: {
        title: ev.title,
        status: ev.status,
        startTime: new Date(ev.startTime),
        endTime: new Date(ev.endTime)
      },
      create: {
        title: ev.title,
        slug: ev.slug,
        tagline: ev.tagline,
        description: ev.description,
        bannerImage: ev.bannerImage,
        thumbnailImage: ev.thumbnailImage,
        status: ev.status,
        venueName: ev.venueName,
        venueCity: ev.venueCity,
        venueCountry: ev.venueCountry,
        startTime: new Date(ev.startTime),
        endTime: new Date(ev.endTime),
        featured: ev.featured,
        artists: {
          create: ev.artists
        },
        schedules: {
          create: ev.schedules.map(s => ({
            stageName: s.stageName,
            title: s.title,
            performerName: s.performerName,
            startTime: new Date(s.startTime),
            endTime: new Date(s.endTime)
          }))
        },
        ticketTypes: {
          create: ev.ticketTypes.map(t => ({
            tier: t.tier,
            displayName: t.displayName,
            description: t.description,
            priceInCents: t.priceInCents,
            currency: t.currency,
            capacity: t.capacity,
            soldCount: t.soldCount,
            salesStartTime: new Date(Date.now() - 14 * 86400 * 1000),
            salesEndTime: new Date(Date.now() + 14 * 86400 * 1000)
          }))
        },
        streamChannel: {
          create: {
            primaryIngestKey: ev.streamChannel.primaryIngestKey,
            backupIngestKey: ev.streamChannel.backupIngestKey,
            streamStatus: ev.streamChannel.streamStatus as any,
            hlsMasterUrl: ev.streamChannel.hlsMasterUrl,
            fps: ev.streamChannel.fps,
            bitrateKbps: ev.streamChannel.bitrateKbps
          }
        },
        chatRoom: {
          create: {
            isLocked: false,
            slowModeSeconds: 3
          }
        }
      }
    });
    console.log(`Event seeded: ${event.title}`);
  }

  // --------------------------------------------------------------------------
  // Seed Default Administrative and Viewer Accounts
  // --------------------------------------------------------------------------
  const superAdminRole = await prisma.role.findUnique({ where: { name: RoleType.SUPER_ADMIN } });
  const eventAdminRole = await prisma.role.findUnique({ where: { name: RoleType.EVENT_ADMIN } });
  const viewerRole = await prisma.role.findUnique({ where: { name: RoleType.VIEWER } });

  // Standard demo password hash: Admin@1234 / Viewer@1234
  const demoPasswordHash = '$2a$10$wN31c0hJcskE86m.7v2/n.xL2nJz5h1gYj1wK9sW9y4qXf5kS2o1y';

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@feshtafest.com' },
    update: { name: 'Feshta Fest Administrator', isActive: true },
    create: {
      id: 'usr_admin_01',
      email: 'admin@feshtafest.com',
      name: 'Feshta Fest Administrator',
      passwordHash: demoPasswordHash,
      isActive: true
    }
  });

  if (superAdminRole && eventAdminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: superAdminRole.id }
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: eventAdminRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: eventAdminRole.id }
    });
  }
  console.log(`Admin user verified: ${adminUser.email}`);

  const viewerUser = await prisma.user.upsert({
    where: { email: 'viewer@feshtafest.com' },
    update: { name: 'Abebe Bikila', isActive: true },
    create: {
      id: 'usr_viewer_01',
      email: 'viewer@feshtafest.com',
      name: 'Abebe Bikila',
      phoneNumber: '+251911234567',
      passwordHash: demoPasswordHash,
      isActive: true
    }
  });

  if (viewerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: viewerUser.id, roleId: viewerRole.id } },
      update: {},
      create: { userId: viewerUser.id, roleId: viewerRole.id }
    });
  }

  // Create or update viewer wallet
  await prisma.walletAccount.upsert({
    where: { userId: viewerUser.id },
    update: { balanceCoins: 5000 },
    create: { userId: viewerUser.id, balanceCoins: 5000 }
  });
  console.log(`Viewer user & wallet verified: ${viewerUser.email}`);

  // --------------------------------------------------------------------------
  // Seed Default Cameras and Entitlements for the Live Concert
  // --------------------------------------------------------------------------
  const liveEvent = await prisma.event.findUnique({
    where: { slug: 'teddy-afro-live-in-addis' },
    include: { streamChannel: true, ticketTypes: true }
  });

  if (liveEvent && liveEvent.streamChannel) {
    const channelId = liveEvent.streamChannel.id;
    const defaultCameras = [
      {
        streamChannelId: channelId,
        name: 'Main Stage',
        description: 'Wide master stage camera capturing the full band performance',
        cameraIndex: 0,
        streamKey: 'live_teddy_afro_cam1_master',
        backupStreamKey: 'live_teddy_afro_cam1_master_back',
        ingestProtocol: 'RTMP' as const,
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/live_teddy_afro_cam1_master',
        hlsMasterUrl: '/api/v1/cdn/live/abr/live_teddy_afro_cam1_master/master.m3u8',
        isDefault: true,
        isActiveLive: true,
        status: 'LIVE' as const,
        fps: 60,
        bitrateKbps: 4500
      },
      {
        streamChannelId: channelId,
        name: 'Front Close-up',
        description: 'Tight framing on lead vocalist and center soloists',
        cameraIndex: 1,
        streamKey: 'live_teddy_afro_cam2_closeup',
        backupStreamKey: 'live_teddy_afro_cam2_closeup_back',
        ingestProtocol: 'RTMP' as const,
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/live_teddy_afro_cam2_closeup',
        hlsMasterUrl: '/api/v1/cdn/live/abr/live_teddy_afro_cam2_closeup/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE' as const,
        fps: 60,
        bitrateKbps: 4500
      },
      {
        streamChannelId: channelId,
        name: 'Side Stage',
        description: 'Profile angle showing keyboardists, percussion, and guitarists',
        cameraIndex: 2,
        streamKey: 'live_teddy_afro_cam3_sidestage',
        backupStreamKey: 'live_teddy_afro_cam3_sidestage_back',
        ingestProtocol: 'SRT' as const,
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/live_teddy_afro_cam3_sidestage',
        srtIngestUrl: 'srt://origin.feshtafest.com:10080?streamid=live_teddy_afro_cam3_sidestage',
        hlsMasterUrl: '/api/v1/cdn/live/abr/live_teddy_afro_cam3_sidestage/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE' as const,
        fps: 60,
        bitrateKbps: 4500
      },
      {
        streamChannelId: channelId,
        name: 'Audience',
        description: 'Atmospheric wide angle of crowd energy and venue lights',
        cameraIndex: 3,
        streamKey: 'live_teddy_afro_cam4_audience',
        backupStreamKey: 'live_teddy_afro_cam4_audience_back',
        ingestProtocol: 'RTMP' as const,
        rtmpIngestUrl: 'rtmp://origin.feshtafest.com:1935/live/live_teddy_afro_cam4_audience',
        hlsMasterUrl: '/api/v1/cdn/live/abr/live_teddy_afro_cam4_audience/master.m3u8',
        isDefault: false,
        isActiveLive: false,
        status: 'LIVE' as const,
        fps: 60,
        bitrateKbps: 4500
      }
    ];

    for (const cam of defaultCameras) {
      await prisma.cameraFeed.upsert({
        where: { streamKey: cam.streamKey },
        update: {
          name: cam.name,
          description: cam.description,
          hlsMasterUrl: cam.hlsMasterUrl,
          isDefault: cam.isDefault,
          isActiveLive: cam.isActiveLive,
          status: cam.status
        },
        create: cam
      });
    }
    console.log(`Multi-camera feeds seeded for channel: ${channelId}`);

    // Seed viewer tickets
    const vipTicketType = liveEvent.ticketTypes.find(t => t.tier === 'VIP') || liveEvent.ticketTypes[0];
    if (vipTicketType) {
      const order = await prisma.order.upsert({
        where: { orderNumber: 'ORD-TED-2026-0001' },
        update: {},
        create: {
          id: 'ord_demo_viewer_01',
          userId: viewerUser.id,
          orderNumber: 'ORD-TED-2026-0001',
          totalAmountCents: vipTicketType.priceInCents,
          currency: 'ETB',
          status: 'COMPLETED',
          idempotencyKey: 'idemp_demo_viewer_order_01',
          items: {
            create: {
              ticketTypeId: vipTicketType.id,
              quantity: 1,
              unitPriceCents: vipTicketType.priceInCents
            }
          }
        }
      });

      await prisma.ticket.upsert({
        where: { ticketCode: 'TKT-TED-VIP-0001-9X8K2' },
        update: { status: 'ACTIVE' },
        create: {
          id: 'tkt_demo_viewer_vip_01',
          orderId: order.id,
          userId: viewerUser.id,
          ticketTypeId: vipTicketType.id,
          ticketCode: 'TKT-TED-VIP-0001-9X8K2',
          qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=TKT-TED-VIP-0001-9X8K2',
          status: 'ACTIVE'
        }
      });
      console.log('Viewer VIP Ticket verified in Supabase: TKT-TED-VIP-0001-9X8K2');
    }
  }

  console.log('Database seed completed successfully.');
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
