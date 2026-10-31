// Roster = org chart. No foremen. Names/details unchanged from v1.
// drain: health drain multiplier (1 = normal). informant: bribes add extra exposure while alive.
const WORKERS = [
  { name: "Ivan Petrov",    detail: "has a sick daughter",              drain: 1.1 },
  { name: "Anna Volkova",   detail: "recently injured on the line",     drain: 1.3 },
  { name: "Sergei Kozlov",  detail: "keeps extra grain under his bunk", drain: 0.85 },
  { name: "Elena Moroz",    detail: "lost her husband last winter",     drain: 1.1 },
  { name: "Dmitri Orlov",   detail: "reports every shortfall",          drain: 1, informant: true },
  { name: "Natasha Belova", detail: "smuggles letters to her sister",   drain: 1 }
];
