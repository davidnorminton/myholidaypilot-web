// Sample journal posts. Replace with a CMS / markdown loader later.
export const POSTS = [
  {
    slug: 'travel-region-by-region',
    title: 'Why we travel region by region',
    date: '2026-05-18',
    tag: 'Field notes',
    author: 'The Pilot',
    cover: 'https://images.unsplash.com/photo-1476362174823-3a23f4aa6d76?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    excerpt: 'Countries are too big to “see”. Regions are the right unit — small enough to feel, large enough to surprise.',
    body: [
      'Ask someone about their trip to Italy and you’ll usually get a list of cities. But the things people remember are smaller and stranger than that: a hill town that smelled of woodsmoke, a single plate of pasta, a road that bent around one more impossible view.',
      'That’s why myholidaypilot is built around regions, not countries. Each one has its own colour, its own kitchen, its own way of talking. Twenty of them in Italy alone — and once you start seeing the map that way, a country stops being a checklist and becomes a collection of places worth slowing down for.',
      'Start with one region. Learn its towns, eat its food, read its history. Then pick the next.',
    ],
  },
  {
    slug: 'eat-like-a-local',
    title: 'How to eat like a local (without the guesswork)',
    date: '2026-05-04',
    tag: 'Food',
    author: 'The Pilot',
    cover: 'https://images.unsplash.com/photo-1612698093158-e07ac200d44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    excerpt: 'Every place has a dish it’s quietly proud of. Order that, and the rest of the meal takes care of itself.',
    body: [
      'The fastest way into a region is through its “must order” — the one dish a place makes better than anywhere else. In Bologna it’s the ragù; on the Amalfi coast it’s the lemons in everything; in Sicily it’s the street food you eat standing up.',
      'We list a must-order for every restaurant for exactly this reason. Skip the menu paralysis, point at the local hero, and let the kitchen show off.',
    ],
  },
  {
    slug: 'shoulder-season',
    title: 'In praise of the shoulder season',
    date: '2026-04-21',
    tag: 'Planning',
    author: 'The Pilot',
    cover: 'https://images.unsplash.com/photo-1514890547357-a9ee288728e0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    excerpt: 'May and September are the sweet spot: warm light, open kitchens, and room to breathe.',
    body: [
      'Peak summer is loud and hot and booked solid. The shoulder season — roughly May–June and September–October — gives you the same light without the crush, and locals who still have time to talk.',
      'Every region page lists its best time to visit. More often than not, it points at the shoulder.',
    ],
  },
]

export const getPost = (slug) => POSTS.find((p) => p.slug === slug)
