export type SupportedSport = {
  name: string;
  slug: string;
  coverage: "live" | "full";
};

export const supportedSports: SupportedSport[] = [
  { name: "Esports", slug: "esports", coverage: "full" },
  { name: "Football", slug: "football", coverage: "full" },
  { name: "Tennis", slug: "tennis", coverage: "full" },
  { name: "Basketball", slug: "basketball", coverage: "full" },
  { name: "Baseball", slug: "baseball", coverage: "full" },
  { name: "Volleyball", slug: "volleyball", coverage: "full" },
  { name: "American Football", slug: "american-football", coverage: "full" },
  { name: "Handball", slug: "handball", coverage: "full" },
  { name: "Table Tennis", slug: "table-tennis", coverage: "full" },
  { name: "Ice Hockey", slug: "ice-hockey", coverage: "full" },
  { name: "Darts", slug: "darts", coverage: "full" },
  { name: "Motorsport", slug: "motorsport", coverage: "full" },
  { name: "Cycling", slug: "cycling", coverage: "full" },
  { name: "Cricket", slug: "cricket", coverage: "full" },
  { name: "MMA", slug: "mma", coverage: "full" },
  { name: "Rugby", slug: "rugby", coverage: "full" },
  { name: "Futsal", slug: "futsal", coverage: "full" },
  { name: "Badminton", slug: "badminton", coverage: "full" },
  { name: "Water polo", slug: "waterpolo", coverage: "full" },
  { name: "Snooker", slug: "snooker", coverage: "full" },
  { name: "Aussie Rules", slug: "aussie-rules", coverage: "full" },
  { name: "Beach Volleyball", slug: "beach-volley", coverage: "full" },
  { name: "Minifootball", slug: "minifootball", coverage: "full" },
  { name: "Floorball", slug: "floorball", coverage: "full" },
  { name: "Bandy", slug: "bandy", coverage: "full" },
];
