import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seed() {
  console.log('Seeding trending destinations...');

  await prisma.trendingDestination.deleteMany();
  await prisma.trendingDestination.createMany({
    data: [
      {
        name: 'Tokyo',
        country: 'Japan',
        duration: '5–10 days',
        signal: '🔥 Trending this week',
        emoji: '🗼',
        bgColors: ['#1a1a2e', '#16213e'],
        sortOrder: 1,
      },
      {
        name: 'Bali',
        country: 'Indonesia',
        duration: '7–14 days',
        signal: '🔥 4.2k trips planned',
        emoji: '🌴',
        bgColors: ['#134e5e', '#71b280'],
        sortOrder: 2,
      },
      {
        name: 'Morocco',
        country: 'Africa',
        duration: '8–12 days',
        signal: '⬆ Up 34% this month',
        emoji: '🕌',
        bgColors: ['#c94b4b', '#4b134f'],
        sortOrder: 3,
      },
      {
        name: 'Kyoto',
        country: 'Japan',
        duration: '4–7 days',
        signal: '🌸 Cherry blossom',
        emoji: '⛩️',
        bgColors: ['#2c3e50', '#4ca1af'],
        sortOrder: 4,
      },
      {
        name: 'Colombia',
        country: 'South America',
        duration: '10–14 days',
        signal: '✦ Hidden gem pick',
        emoji: '☕',
        bgColors: ['#1c6758', '#d4c483'],
        sortOrder: 5,
      },
    ],
  });

  console.log('Seeding insights...');

  await prisma.insight.deleteMany();
  await prisma.insight.createMany({
    data: [
      {
        title: 'Best sunrise spot at Amber Fort',
        body: 'Go before 9 AM to beat crowds. The east-facing walls catch golden light perfectly.',
        source: 'youtube',
        icon: '🌅',
        destinationTag: 'Jaipur',
        tags: ['Photo spots', 'Heritage'],
      },
      {
        title: 'Lassiwala — the real one',
        body: 'There are 3 fake Lassiwalas on MI Road. The original has no signage, just a crowd.',
        source: 'reddit',
        icon: '🥛',
        destinationTag: 'Jaipur',
        tags: ['Street food', "Locals' choice"],
      },
      {
        title: 'Johari Bazaar hidden workshops',
        body: 'Skip the main street. Turn into the second alley for block-printing workshops and better prices.',
        source: 'blog',
        icon: '🧵',
        destinationTag: 'Jaipur',
        tags: ['Handicrafts', 'Hidden gems'],
      },
      {
        title: 'Sam Sand Dunes — skip the camel mafia',
        body: 'Book through your hotel, not the touts at the entrance. Sunset camps are worth it.',
        source: 'reddit',
        icon: '🐪',
        destinationTag: 'Jaisalmer',
        tags: ['Pro tips', 'Desert'],
      },
      {
        title: 'Mehrangarh Fort rooftop cafes ranked',
        body: 'Stepwell Cafe has the best filter coffee. Nirvana for the best view. Jharokha for sunset.',
        source: 'blog',
        icon: '☕',
        destinationTag: 'Jodhpur',
        tags: ['Cafe hop', 'Fort views'],
      },
    ],
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
