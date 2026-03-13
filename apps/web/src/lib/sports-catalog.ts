export type SupportedSport = {
  name: string;
  slug: string;
  coverage: "live" | "full";
};

export const supportedSports: SupportedSport[] = [
  { name: "Esports", slug: "esports", coverage: "live" },
  { name: "Football", slug: "football", coverage: "full" },
  { name: "Tennis", slug: "tennis", coverage: "live" },
  { name: "Basketball", slug: "basketball", coverage: "live" },
  { name: "Baseball", slug: "baseball", coverage: "live" },
  { name: "Volleyball", slug: "volleyball", coverage: "live" },
  { name: "American Football", slug: "american-football", coverage: "live" },
  { name: "Handball", slug: "handball", coverage: "live" },
  { name: "Table Tennis", slug: "table-tennis", coverage: "live" },
  { name: "Ice Hockey", slug: "ice-hockey", coverage: "live" },
  { name: "Darts", slug: "darts", coverage: "live" },
  { name: "Motorsport", slug: "motorsport", coverage: "live" },
  { name: "Cycling", slug: "cycling", coverage: "live" },
  { name: "Cricket", slug: "cricket", coverage: "live" },
  { name: "MMA", slug: "mma", coverage: "live" },
  { name: "Rugby", slug: "rugby", coverage: "live" },
  { name: "Futsal", slug: "futsal", coverage: "live" },
  { name: "Badminton", slug: "badminton", coverage: "live" },
  { name: "Water polo", slug: "waterpolo", coverage: "live" },
  { name: "Snooker", slug: "snooker", coverage: "live" },
  { name: "Aussie Rules", slug: "aussie-rules", coverage: "live" },
  { name: "Beach Volleyball", slug: "beach-volley", coverage: "live" },
  { name: "Minifootball", slug: "minifootball", coverage: "live" },
  { name: "Floorball", slug: "floorball", coverage: "live" },
  { name: "Bandy", slug: "bandy", coverage: "live" },
];
