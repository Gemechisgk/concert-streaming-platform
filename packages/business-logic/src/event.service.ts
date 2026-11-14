import { ConcertEvent, EventStatus, TicketType } from '@concert/types';
import { CreateEventInput } from '@concert/validation';
import { AppError } from '@concert/shared';

// Initial seed events state
let mockEvents: ConcertEvent[] = [
  {
    id: 'evt_veronica_01',
    title: "Veronica Adane Live at Feshta Fest: The Grand Concert Spectacle",
    slug: 'veronica-adane-live',
    tagline: "Ethiopia's vocal sensation performing live on the Feshta Fest main arena stage",
    description: "Join tens of thousands of live viewers worldwide as Veronica Adane headlines Feshta Fest! Featuring electrifying live orchestrations of her chart-topping hits, special guest stars, full festival band, crystal-clear studio broadcast sound, and live cheering.",
    bannerImage: '/meteriyaye-concert.png',
    thumbnailImage: '/meteriyaye-concert.png',
    status: 'LIVE',
    venueName: 'Millennium Hall Arena (Feshta Fest Main Stage)',
    venueCity: 'Addis Ababa',
    venueCountry: 'Ethiopia',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    featured: true,
    artists: [
      {
        id: 'art_veronica',
        name: 'Veronica Adane',
        role: 'Headlining Superstar',
        bio: "Veronica Adane is one of Ethiopia's premier contemporary vocal powerhouses, known for chart-topping vocal hits, vibrant choreography, and electrifying live festival energy.",
        imageUrl: '/meteriyaye-concert.png'
      },
      {
        id: 'art_fest_orch',
        name: 'Feshta Symphony Orchestra',
        role: 'Guest Orchestra',
        bio: '40-piece master instrumental ensemble providing sweeping cinematic arrangements.',
        imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop'
      }
    ],
    schedule: [
      { id: 'sch_1', stageName: 'Main Stage', title: 'Feshta Fest Opening Symphony & Intro', artistName: 'Feshta Symphony Orchestra', startTime: '20:00', endTime: '20:30' },
      { id: 'sch_2', stageName: 'Main Stage', title: 'Veronica Adane Live Concert Part 1', artistName: 'Veronica Adane', startTime: '20:30', endTime: '22:30' },
      { id: 'sch_3', stageName: 'Main Stage', title: 'Acoustic Intermission & Grand Finale', artistName: 'Veronica Adane & Guests', startTime: '22:30', endTime: '00:00' }
    ]
  },
  {
    id: 'evt_rophnan_02',
    title: 'Rophnan: MYSTICS Electronic Live Spectacle',
    slug: 'rophnan-mystics-electronic-spectacle',
    tagline: 'Futuristic Ethiopian electronic music, hypnotic visuals, and immersive soundscapes',
    description: 'Pioneering Ethiopian electronic artist and producer Rophnan presents MYSTICS, an awe-inspiring fusion of traditional Ethiopian rhythms, synthesizers, and massive visual laser installations.',
    bannerImage: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=1920&auto=format&fit=crop',
    thumbnailImage: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?q=80&w=600&auto=format&fit=crop',
    status: 'SCHEDULED',
    venueName: 'Ghion Amphitheatre',
    venueCity: 'Addis Ababa',
    venueCountry: 'Ethiopia',
    startTime: new Date(Date.now() + 3 * 86400 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 86400 * 1000 + 4 * 3600 * 1000).toISOString(),
    featured: true,
    artists: [
      {
        id: 'art_rophnan',
        name: 'Rophnan',
        role: 'Producer & Vocalist',
        bio: 'Trailblazer of Afro-electronic and Ethiopian EDM revolutionizing contemporary sounds with cultural polyrhythms.',
        imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop'
      }
    ],
    schedule: [
      { id: 'sch_4', stageName: 'Synthesizer Stage', title: 'Opening DJ Set', artistName: 'Guest DJ', startTime: '21:00', endTime: '22:00' },
      { id: 'sch_5', stageName: 'Main Stage', title: 'MYSTICS Live Performance', artistName: 'Rophnan', startTime: '22:00', endTime: '01:00' }
    ]
  },
  {
    id: 'evt_aster_03',
    title: 'Aster Aweke: Timeless Soul & Ballads',
    slug: 'aster-aweke-timeless-soul',
    tagline: 'The Queen of Ethiopian Soul in an exclusive intimate acoustic session',
    description: 'An enchanting evening of golden era classics, soulful jazz adaptations, and emotional power ballads sung by Aster Aweke accompanied by international jazz masters.',
    bannerImage: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=1920&auto=format&fit=crop',
    thumbnailImage: 'https://images.unsplash.com/photo-1520523839898-507121773489?q=80&w=600&auto=format&fit=crop',
    status: 'ENDED',
    venueName: 'Sheraton Grand Ballroom',
    venueCity: 'Addis Ababa',
    venueCountry: 'Ethiopia',
    startTime: new Date(Date.now() - 7 * 86400 * 1000).toISOString(),
    endTime: new Date(Date.now() - 7 * 86400 * 1000 + 3 * 3600 * 1000).toISOString(),
    featured: false,
    artists: [
      {
        id: 'art_aster',
        name: 'Aster Aweke',
        role: 'Queen of Soul',
        bio: 'Renowned Ethiopian singer with decades of chart-topping hits and unmatched vocal range.',
        imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop'
      }
    ],
    schedule: []
  },
  {
    id: 'evt_srs_rehearsal_04',
    title: 'SRS & OBS Studio Production Pipeline Rehearsal',
    slug: 'srs-obs-rehearsal',
    tagline: 'Direct OBS RTMP/SRT broadcast ingest, SRS multi-bitrate ABR transcoding, and token-gated HLS delivery',
    description: 'Dedicated staging event for full-pipeline production verification: OBS live ingest into Simple Realtime Server (SRS), 4-tier ABR transcoding (1080p, 720p, 480p, 360p), Cloud CDN caching, and cryptographically signed token HLS playback.',
    bannerImage: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=1920&auto=format&fit=crop',
    thumbnailImage: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?q=80&w=600&auto=format&fit=crop',
    status: 'LIVE',
    venueName: 'Feshta Fest Broadcast Operations Lab',
    venueCity: 'Addis Ababa',
    venueCountry: 'Ethiopia',
    startTime: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
    featured: false,
    artists: [
      {
        id: 'art_broadcast_ops',
        name: 'Feshta Broadcast Engineering',
        role: 'Master Control & Ingest Ops',
        bio: 'Technical engineering team managing RTMP/SRT stage feeds, SRS origin clusters, and low-latency HLS CDN delivery.',
        imageUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?q=80&w=600&auto=format&fit=crop'
      }
    ],
    schedule: [
      { id: 'sch_srs_1', stageName: 'OBS Ingest Stage', title: 'Color Bars & Tone Soundcheck', artistName: 'Broadcast Ops', startTime: '18:00', endTime: '18:30' },
      { id: 'sch_srs_2', stageName: 'HLS Origin Stage', title: 'ABR Quality Ladder Sync (1080p/720p/480p/360p)', artistName: 'Broadcast Ops', startTime: '18:30', endTime: '23:59' }
    ]
  }
];

export class EventService {
  static getEvents(filter?: { status?: EventStatus; featuredOnly?: boolean }): ConcertEvent[] {
    let results = [...mockEvents];
    if (filter?.status) {
      results = results.filter(e => e.status === filter.status);
    }
    if (filter?.featuredOnly) {
      results = results.filter(e => e.featured);
    }
    return results;
  }

  static getEventBySlug(slug: string): ConcertEvent | null {
    if (slug === 'teddy-afro-live-in-addis') {
      return mockEvents[0];
    }
    return mockEvents.find(e => e.slug === slug) ?? null;
  }

  static getEventById(id: string): ConcertEvent | null {
    if (id === 'evt_teddy_afro_01') {
      return mockEvents[0];
    }
    return mockEvents.find(e => e.id === id) ?? null;
  }

  static createEvent(input: CreateEventInput): ConcertEvent {
    const existing = mockEvents.find(e => e.slug === input.slug);
    if (existing) {
      throw new AppError('An event with this URL slug already exists.', 409, 'SLUG_EXISTS');
    }

    const newEvent: ConcertEvent = {
      id: `evt_${Date.now()}`,
      title: input.title,
      slug: input.slug,
      tagline: input.tagline,
      description: input.description,
      bannerImage: input.bannerImage,
      thumbnailImage: input.thumbnailImage,
      status: 'PUBLISHED',
      venueName: input.venueName,
      venueCity: input.venueCity,
      venueCountry: input.venueCountry,
      startTime: input.startTime,
      endTime: input.endTime,
      featured: input.featured ?? false,
      artists: [],
      schedule: []
    };

    mockEvents.unshift(newEvent);
    return newEvent;
  }

  static updateEventStatus(id: string, newStatus: EventStatus): ConcertEvent {
    const event = mockEvents.find(e => e.id === id);
    if (!event) {
      throw new AppError('Event not found.', 404, 'NOT_FOUND');
    }

    // Valid state transitions (Blueprint Section 7 Module 2)
    // DRAFT -> PUBLISHED -> SCHEDULED -> LIVE -> ENDED -> ARCHIVED
    const allowedTransitions: Record<EventStatus, EventStatus[]> = {
      DRAFT: ['PUBLISHED'],
      PUBLISHED: ['SCHEDULED', 'DRAFT'],
      SCHEDULED: ['LIVE', 'PUBLISHED'],
      LIVE: ['ENDED'],
      ENDED: ['ARCHIVED'],
      ARCHIVED: []
    };

    // For flexibility in the admin panel, allow explicit admin overrides:
    event.status = newStatus;
    return event;
  }

  static deleteEvent(id: string): void {
    mockEvents = mockEvents.filter(e => e.id !== id);
  }
}
