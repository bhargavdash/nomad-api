import type { ResearchDiscovery } from '../types/index.js';

/**
 * Mock AI service — returns hardcoded itinerary data.
 * Will be replaced with real Claude API integration in Phase 2.
 */

// Mock research phases (matches frontend RESEARCH_TICKER_PHASES)
export const MOCK_PHASES = [
  {
    phase: 1,
    delay: 0,
    progress: 22,
    message: 'SCANNING YOUTUBE VLOGS...',
    stats: { places: 4, tips: 6, photoStops: 2 },
  },
  {
    phase: 2,
    delay: 2000,
    progress: 44,
    message: 'READING REDDIT THREADS...',
    stats: { places: 12, tips: 14, photoStops: 5 },
  },
  {
    phase: 3,
    delay: 3800,
    progress: 66,
    message: 'PARSING GOOGLE RESULTS...',
    stats: { places: 22, tips: 22, photoStops: 10 },
  },
  {
    phase: 4,
    delay: 5600,
    progress: 85,
    message: 'ANALYZING TRAVEL BLOGS...',
    stats: { places: 30, tips: 28, photoStops: 14 },
  },
  {
    phase: 5,
    delay: 7400,
    progress: 97,
    message: 'BUILDING YOUR ITINERARY...',
    stats: { places: 38, tips: 34, photoStops: 17 },
  },
];

export const MOCK_DISCOVERIES: ResearchDiscovery[] = [
  {
    id: 'rd1',
    title: 'Found a hidden chai stall inside Jaisalmer Fort walls.',
    body: 'Multiple Reddit threads mention "Mama\'s Chai" has the best view of the sunset without the tourist crowds.',
    tags: ['#LocalFind', '#CuratedSpot'],
    source: 'reddit',
  },
  {
    id: 'rd2',
    title: 'Skip Nahargarh at noon — sunset is 10x better.',
    body: 'A vlogger with 2M subs says the light at 5 PM turns the walls gold. We moved it to your evening slot.',
    tags: ['#ProTip', '#GoldenHour'],
    source: 'youtube',
  },
  {
    id: 'rd3',
    title: '6 rooftop cafes with Mehrangarh Fort views mapped.',
    body: 'A travel blog ranked every rooftop in Jodhpur by vibe, Wi-Fi, and filter coffee quality.',
    tags: ['#CafeHop', '#FortViews'],
    source: 'blog',
  },
  {
    id: 'rd4',
    title: 'Secret textile market behind Johari Bazaar unlocked.',
    body: 'Google reviews reveal a back-alley block printing workshop that lets you make your own scarves.',
    tags: ['#Handicrafts', '#HiddenGem'],
    source: 'maps',
  },
  {
    id: 'rd5',
    title: 'Assembling your perfect 7-day desert route.',
    body: 'Cross-referencing 142 sources to lock in timing, travel distances, and rest days.',
    tags: ['#Itinerary', '#AlmostReady'],
    source: 'blog',
  },
];

export const MOCK_ITINERARY_DAYS = [
  {
    dayNumber: 1,
    city: 'Jaipur',
    title: 'Jaipur — The Pink City',
    description: 'Amber Fort at sunrise, Hawa Mahal, Johari Bazaar for handicrafts.',
    highlights: ['Amber Fort', 'Hawa Mahal', 'Johari Bazaar'],
    stopCount: 5,
  },
  {
    dayNumber: 2,
    city: 'Jaipur',
    title: 'Jaipur — Hidden Gems',
    description: 'Nahargarh Fort sunset, Bapu Bazaar, rooftop dinner with city views.',
    highlights: ['Nahargarh Fort', 'Bapu Bazaar'],
    stopCount: 4,
  },
  {
    dayNumber: 3,
    city: 'Jodhpur',
    title: 'Jodhpur — The Blue City',
    description: 'Mehrangarh Fort, spice markets, blue-washed old town lanes.',
    highlights: ['Mehrangarh Fort', 'Spice Market', 'Clock Tower'],
    stopCount: 5,
  },
  {
    dayNumber: 4,
    city: 'Jodhpur → Jaisalmer',
    title: 'Road to the Golden City',
    description: 'Scenic desert drive, Osian temples stop, arrive Jaisalmer by sunset.',
    highlights: ['Osian Temples', 'Desert Drive'],
    stopCount: 3,
  },
  {
    dayNumber: 5,
    city: 'Jaisalmer',
    title: 'Jaisalmer — Fort & Dunes',
    description: 'Living fort exploration, haveli carvings, camel ride at Sam Sand Dunes.',
    highlights: ['Jaisalmer Fort', 'Sam Sand Dunes', 'Patwon Haveli'],
    stopCount: 5,
  },
  {
    dayNumber: 6,
    city: 'Jaisalmer',
    title: 'Jaisalmer — Desert Slow Day',
    description: 'Desert sunrise, chai stall hidden in fort walls, kulhad lassi, stargazing.',
    highlights: ['Desert Sunrise', 'Hidden Chai Stall'],
    stopCount: 4,
  },
  {
    dayNumber: 7,
    city: 'Jaipur',
    title: 'Jaipur — Final Day',
    description: 'Last-minute shopping, City Palace museum, farewell rooftop dinner.',
    highlights: ['City Palace', 'Shopping'],
    stopCount: 3,
  },
];

export const MOCK_STOPS_DAY1 = [
  {
    sortOrder: 1,
    time: '7:00',
    ampm: 'AM',
    duration: '2 hrs',
    name: 'Amber Fort — sunrise',
    description: 'Empty fort, golden light. Go before 9 AM to beat crowds.',
    source: 'youtube',
    tags: ['📸 Photo stop', '🏛️ Heritage', 'Trending'],
    locked: true,
  },
  {
    sortOrder: 2,
    time: '9:30',
    ampm: 'AM',
    duration: '45 min',
    name: 'Lassiwala — Old City',
    description: 'Legendary lassi stall. Open from 8 AM, queue fast.',
    source: 'reddit',
    tags: ['🍜 Street food', "Locals' choice"],
    locked: false,
  },
  {
    sortOrder: 3,
    time: '11:00',
    ampm: 'AM',
    duration: '1.5 hrs',
    name: 'Johari Bazaar walk',
    description: 'Main handicrafts street. Back alleys have better prices.',
    source: 'blog',
    tags: ['🧵 Handicrafts', 'Shopping'],
    locked: false,
  },
  {
    sortOrder: 4,
    time: '1:30',
    ampm: 'PM',
    duration: '1 hr',
    name: 'Hawa Mahal exterior',
    description: 'Best shot from the cafe across the street. Avoid noon heat.',
    source: 'youtube',
    tags: ['📸 Photo stop', 'Trending'],
    locked: false,
  },
  {
    sortOrder: 5,
    time: '3:30',
    ampm: 'PM',
    duration: '1 hr',
    name: 'City Palace museum',
    description: 'Avoid weekends. Audio guide worth it, get the good one.',
    source: 'maps',
    tags: ['🏛️ Heritage', 'Museum'],
    locked: false,
  },
];

export function getMockEmoji(destination: string): string {
  const lower = destination.toLowerCase();
  if (lower.includes('rajasthan') || lower.includes('india')) return '🏰';
  if (lower.includes('tokyo') || lower.includes('japan')) return '🗼';
  if (lower.includes('bali')) return '🌴';
  if (lower.includes('morocco')) return '🕌';
  return '✈️';
}
