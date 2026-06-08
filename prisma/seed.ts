import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SA-8: trending is LLM-driven, refreshed seasonally by nomad-agent.
// This seed inserts a single "bootstrap" cache row so the first deploy
// has something to serve while the agent populates the real season key.
// Production traffic will trigger an async refresh on first hit.
async function seed() {
  console.log('Seeding bootstrap trending_cache row...');

  await prisma.trendingCache.deleteMany();
  await prisma.trendingCache.create({
    data: {
      seasonKey: 'bootstrap',
      season: 'bootstrap',
      year: 0,
      payload: {
        season: 'bootstrap',
        year: 0,
        india: [
          {
            name: 'Goa',
            country: 'Goa',
            duration: '4-6 days',
            blurb: 'Beach bars, Portuguese churches, and motorbike sunsets.',
            vibe_tags: ['beach', 'nightlife'],
          },
          {
            name: 'Jaipur',
            country: 'Rajasthan',
            duration: '3-5 days',
            blurb: 'Pink City forts and bazaars steeped in Rajput history.',
            vibe_tags: ['heritage', 'culture'],
          },
          {
            name: 'Manali',
            country: 'Himachal Pradesh',
            duration: '5-7 days',
            blurb: 'Snow peaks, riverside cafes, and trails into the Beas valley.',
            vibe_tags: ['mountains', 'adventure'],
          },
          {
            name: 'Udaipur',
            country: 'Rajasthan',
            duration: '3-4 days',
            blurb: 'Lake palaces, rooftop dinners, and Mewar painting workshops.',
            vibe_tags: ['romance', 'heritage'],
          },
          {
            name: 'Rishikesh',
            country: 'Uttarakhand',
            duration: '4-6 days',
            blurb: 'Ganga ghats, yoga, and rafting through Himalayan foothills.',
            vibe_tags: ['spiritual', 'adventure'],
          },
          {
            name: 'Hampi',
            country: 'Karnataka',
            duration: '3-5 days',
            blurb: 'Ruined Vijayanagara temples scattered through boulder-strewn hills.',
            vibe_tags: ['heritage', 'offbeat'],
          },
          {
            name: 'Pondicherry',
            country: 'Puducherry',
            duration: '3-4 days',
            blurb: 'French quarters, surf breaks, and slow Tamil-Mediterranean food.',
            vibe_tags: ['coastal', 'food'],
          },
          {
            name: 'Spiti',
            country: 'Himachal Pradesh',
            duration: '7-9 days',
            blurb: 'High-altitude desert monasteries above the tree line.',
            vibe_tags: ['offbeat', 'adventure'],
          },
          {
            name: 'Munnar',
            country: 'Kerala',
            duration: '4-5 days',
            blurb: 'Tea estates, mist-cooled hill stations, and Western Ghats trails.',
            vibe_tags: ['nature', 'romance'],
          },
          {
            name: 'Andaman Islands',
            country: 'Andaman & Nicobar Islands',
            duration: '6-8 days',
            blurb: 'Reef dives, white-sand beaches, and slow island-hopping.',
            vibe_tags: ['beach', 'diving'],
          },
        ],
        international: [
          {
            name: 'Bali',
            country: 'Indonesia',
            duration: '7-10 days',
            blurb: 'Ubud rice terraces, Uluwatu sunsets, and reef-snorkelling islets.',
            vibe_tags: ['beach', 'wellness'],
          },
          {
            name: 'Bangkok',
            country: 'Thailand',
            duration: '4-6 days',
            blurb: 'Street-food canals, rooftop bars, and weekend megamarkets.',
            vibe_tags: ['food', 'nightlife'],
          },
          {
            name: 'Singapore',
            country: 'Singapore',
            duration: '3-5 days',
            blurb: 'Hawker stalls, Gardens by the Bay, and a Universal Studios layover.',
            vibe_tags: ['family', 'food'],
          },
          {
            name: 'Dubai',
            country: 'UAE',
            duration: '4-6 days',
            blurb: 'Desert dunes, skyline brunches, and souks of old Deira.',
            vibe_tags: ['luxury', 'family'],
          },
          {
            name: 'Vietnam',
            country: 'Vietnam',
            duration: '10-14 days',
            blurb: 'Hanoi pho, Ha Long Bay junks, and Mekong delta home-stays.',
            vibe_tags: ['food', 'culture'],
          },
          {
            name: 'Sri Lanka',
            country: 'Sri Lanka',
            duration: '8-10 days',
            blurb: 'Hill-country trains, Sigiriya, and southern surf beaches.',
            vibe_tags: ['nature', 'culture'],
          },
          {
            name: 'Turkey',
            country: 'Turkey',
            duration: '8-12 days',
            blurb: 'Istanbul bazaars and Cappadocia balloon dawns.',
            vibe_tags: ['heritage', 'romance'],
          },
          {
            name: 'Georgia',
            country: 'Georgia',
            duration: '7-10 days',
            blurb: 'Caucasus peaks, Tbilisi wine bars, and ancient cave cities.',
            vibe_tags: ['offbeat', 'mountains'],
          },
          {
            name: 'Japan',
            country: 'Japan',
            duration: '10-14 days',
            blurb: 'Tokyo neon, Kyoto temples, and shinkansen between them.',
            vibe_tags: ['heritage', 'food'],
          },
          {
            name: 'Maldives',
            country: 'Maldives',
            duration: '5-7 days',
            blurb: 'Overwater villas, atoll diving, and pure-blue lagoon time.',
            vibe_tags: ['beach', 'luxury'],
          },
        ],
      },
    },
  });

  console.log('Seed complete!');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
