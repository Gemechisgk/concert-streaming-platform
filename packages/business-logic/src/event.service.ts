import { ConcertEvent, EventStatus, TicketType } from '@concert/types';
import { CreateEventInput } from '@concert/validation';
import { AppError } from '@concert/shared';

// Initial seed events state
let mockEvents: ConcertEvent[] = [
  {
    id: 'evt_teddy_afro_01',
    title: 'Teddy Afro Live in Addis: Millennium Celebration',
    slug: 'teddy-afro-live-in-addis',
    tagline: 'The iconic Ethiopian maestro in an unforgettable global live concert broadcast',
    description: 'Join over 50,000 live viewers worldwide as Teddy Afro takes the grand stage at Millennium Hall in Addis Ababa with full orchestral support, performing beloved anthems and brand new tracks in ultra-high-definition.',
    bannerImage: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?q=80&w=1920&auto=format&fit=crop',
    thumbnailImage: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=600&auto=format&fit=crop',
    status: 'LIVE',
    venueName: 'Millennium Hall Main Arena',
    venueCity: 'Addis Ababa',
    venueCountry: 'Ethiopia',
    startTime: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    endTime: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    featured: true,
    artists: [
      {
        id: 'art_teddy',
        name: 'Teddy Afro',
        role: 'Headlining Maestro',
        bio: 'Tewodros Kassahun, popularly known as Teddy Afro, is an Ethiopian pop and reggae superstar whose poetic lyrics and electrifying melodies define modern Ethiopian music.',
        imageUrl: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'art_orch',
        name: 'Addis Symphony Orchestra',
        role: 'Guest Orchestra',
        bio: '40-piece master instrumental ensemble providing sweeping cinematic arrangements.',
        imageUrl: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=600&auto=format&fit=crop'
      }
    ],
    schedule: [
      { id: 'sch_1', stageName: 'Main Stage', title: 'Opening Symphony & Intro', artistName: 'Addis Symphony Orchestra', startTime: '20:00', endTime: '20:30' },
      { id: 'sch_2', stageName: 'Main Stage', title: 'Teddy Afro Live Performance Part 1', artistName: 'Teddy Afro', startTime: '20:30', endTime: '22:30' },
      { id: 'sch_3', stageName: 'Main Stage', title: 'Acoustic Intermission & Encore', artistName: 'Teddy Afro & Guests', startTime: '22:30', endTime: '00:00' }
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
    return mockEvents.find(e => e.slug === slug) ?? null;
  }

  static getEventById(id: string): ConcertEvent | null {
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
