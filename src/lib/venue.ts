/**
 * Single source of truth for where and when the association meets.
 * Used by the UI (home, footer, contact), the FAQ copy and every JSON-LD block.
 */

export const VENUE = {
  name: "Centre Cívic Ca N'Aurell",
  streetAddress: "Plaça del Tint, 4",
  postalCode: "08224",
  locality: "Terrassa",
  region: "Barcelona",
  country: "ES",
  mapsUrl: "https://maps.google.com/?q=Plaça+del+Tint,4,Terrassa",
} as const;

export type SessionDay = "friday" | "saturday";

export const SESSIONS: readonly {
  day: SessionDay;
  schemaDay: "Friday" | "Saturday";
  opens: string;
  closes: string;
}[] = [
  { day: "friday", schemaDay: "Friday", opens: "16:00", closes: "20:30" },
  { day: "saturday", schemaDay: "Saturday", opens: "10:00", closes: "13:30" },
];

export function getSession(day: SessionDay) {
  return SESSIONS.find((s) => s.day === day)!;
}

/** ICU placeholder values for message strings that quote the session hours. */
export const SESSION_TIME_VALUES = {
  fridayOpens: getSession("friday").opens,
  fridayCloses: getSession("friday").closes,
  saturdayOpens: getSession("saturday").opens,
  saturdayCloses: getSession("saturday").closes,
};

/** Address block for schema.org (PostalAddress). */
export const VENUE_POSTAL_ADDRESS = {
  "@type": "PostalAddress",
  streetAddress: VENUE.streetAddress,
  addressLocality: VENUE.locality,
  addressRegion: VENUE.region,
  postalCode: VENUE.postalCode,
  addressCountry: VENUE.country,
} as const;

export const TRANSPORT_COLORS = {
  fgc: "#009A44",
  rodalies: "#E3000F",
  bus: "#003DA5",
} as const;

export type TransportStop = {
  id: string;
  badges: readonly string[];
  color: string;
  station: string;
  walkMinutes: number;
  /** `location.*` message key shown before the station name (bus). */
  stationLabelKey?: "bus_nearest_stop";
  /** `location.*` message key with a secondary note. */
  noteKey?: "rodalies_connection" | "bus_multiple_lines";
};

export const TRANSPORT: readonly TransportStop[] = [
  { id: "fgc-rambla", badges: ["S1"], color: TRANSPORT_COLORS.fgc, station: "Terrassa Rambla", walkMinutes: 7 },
  { id: "fgc-nord", badges: ["S1"], color: TRANSPORT_COLORS.fgc, station: "Estació del Nord", walkMinutes: 10, noteKey: "rodalies_connection" },
  { id: "rodalies-r4", badges: ["R4"], color: TRANSPORT_COLORS.rodalies, station: "Terrassa", walkMinutes: 10 },
  { id: "bus", badges: ["Bus"], color: TRANSPORT_COLORS.bus, station: "Ricard Camí", walkMinutes: 3, stationLabelKey: "bus_nearest_stop", noteKey: "bus_multiple_lines" },
];
