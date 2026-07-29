import { getEnvOptional } from "./env";

// Geocoding for the nearest-pickup-store recommendation.
//
// Demo safety: every coordinate we resolve is cached on the row that owns it,
// so a stage demo never waits on Google. When the API is unreachable or the
// address is too vague, we fall back to a loose keyword match against a table
// of Nigerian places, which is enough to rank stores sensibly.

export type Point = { lat: number; lng: number };
export type GeoResult = Point & { label: string; source: "google" | "keyword" };

/** Loose fallback gazetteer: Lagos areas first, then major cities. */
const PLACES: { keys: string[]; label: string; lat: number; lng: number }[] = [
  { keys: ["mile 12", "mile12", "ketu", "ojota"], label: "Mile 12, Lagos", lat: 6.6015, lng: 3.3969 },
  { keys: ["lekki", "chevron", "ikate"], label: "Lekki, Lagos", lat: 6.4478, lng: 3.4723 },
  { keys: ["ajah", "sangotedo", "abraham adesanya"], label: "Ajah, Lagos", lat: 6.4667, lng: 3.5667 },
  { keys: ["victoria island", "\bvi\b", "adeola odeku", "oniru"], label: "Victoria Island, Lagos", lat: 6.4281, lng: 3.4219 },
  { keys: ["ikoyi", "banana island"], label: "Ikoyi, Lagos", lat: 6.4528, lng: 3.4348 },
  { keys: ["yaba", "sabo", "akoka"], label: "Yaba, Lagos", lat: 6.5095, lng: 3.3711 },
  { keys: ["surulere", "ojuelegba", "aguda"], label: "Surulere, Lagos", lat: 6.4969, lng: 3.3481 },
  { keys: ["ikeja", "allen avenue", "opebi", "alausa"], label: "Ikeja, Lagos", lat: 6.6018, lng: 3.3515 },
  { keys: ["agege", "pen cinema"], label: "Agege, Lagos", lat: 6.6152, lng: 3.3225 },
  { keys: ["oshodi", "bolade"], label: "Oshodi, Lagos", lat: 6.5556, lng: 3.3439 },
  { keys: ["mushin", "papa ajao"], label: "Mushin, Lagos", lat: 6.5278, lng: 3.3494 },
  { keys: ["festac", "amuwo", "satellite town"], label: "Festac, Lagos", lat: 6.4667, lng: 3.2833 },
  { keys: ["alaba", "ojo"], label: "Alaba, Lagos", lat: 6.4561, lng: 3.1858 },
  { keys: ["apapa", "tin can"], label: "Apapa, Lagos", lat: 6.4483, lng: 3.3594 },
  { keys: ["gbagada", "anthony", "maryland"], label: "Gbagada, Lagos", lat: 6.5583, lng: 3.3875 },
  { keys: ["magodo", "ojodu", "berger"], label: "Magodo, Lagos", lat: 6.6231, lng: 3.3706 },
  { keys: ["ilupeju", "palmgrove"], label: "Ilupeju, Lagos", lat: 6.5539, lng: 3.3583 },
  { keys: ["isolo", "ejigbo", "egbeda", "idimu"], label: "Isolo, Lagos", lat: 6.5344, lng: 3.3239 },
  { keys: ["ikorodu"], label: "Ikorodu, Lagos", lat: 6.6194, lng: 3.5106 },
  { keys: ["epe"], label: "Epe, Lagos", lat: 6.5844, lng: 3.9836 },
  { keys: ["badagry"], label: "Badagry, Lagos", lat: 6.4315, lng: 2.8876 },
  { keys: ["lagos island", "balogun", "idumota", "marina"], label: "Lagos Island", lat: 6.4549, lng: 3.3958 },
  { keys: ["lagos"], label: "Lagos", lat: 6.5244, lng: 3.3792 },
  { keys: ["abuja", "wuse", "garki", "maitama", "gwarinpa", "kubwa"], label: "Abuja", lat: 9.0765, lng: 7.3986 },
  { keys: ["port harcourt", "\bphc\b", "rumuokoro"], label: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
  { keys: ["ibadan", "bodija", "dugbe"], label: "Ibadan", lat: 7.3775, lng: 3.947 },
  { keys: ["kano"], label: "Kano", lat: 12.0022, lng: 8.592 },
  { keys: ["kaduna"], label: "Kaduna", lat: 10.5222, lng: 7.4383 },
  { keys: ["benin city", "benin"], label: "Benin City", lat: 6.335, lng: 5.6037 },
  { keys: ["enugu"], label: "Enugu", lat: 6.5244, lng: 7.5186 },
  { keys: ["onitsha"], label: "Onitsha", lat: 6.1667, lng: 6.7833 },
  { keys: ["aba"], label: "Aba", lat: 5.1167, lng: 7.3667 },
  { keys: ["jos"], label: "Jos", lat: 9.8965, lng: 8.8583 },
  { keys: ["abeokuta"], label: "Abeokuta", lat: 7.1557, lng: 3.3451 },
  { keys: ["warri"], label: "Warri", lat: 5.5167, lng: 5.75 },
  { keys: ["calabar"], label: "Calabar", lat: 4.9757, lng: 8.3417 },
  { keys: ["uyo"], label: "Uyo", lat: 5.0377, lng: 7.9128 },
  { keys: ["owerri"], label: "Owerri", lat: 5.4836, lng: 7.0333 },
  { keys: ["ilorin"], label: "Ilorin", lat: 8.4966, lng: 4.5421 },
  { keys: ["maiduguri"], label: "Maiduguri", lat: 11.8311, lng: 13.151 },
  { keys: ["sokoto"], label: "Sokoto", lat: 13.0059, lng: 5.2476 },
  { keys: ["zaria"], label: "Zaria", lat: 11.0855, lng: 7.7199 },
];

/** Loose match: find the most specific place name mentioned in the address. */
export function keywordMatch(address: string): GeoResult | null {
  const haystack = ` ${address.toLowerCase().replace(/[^a-z0-9\s]/g, " ")} `;
  for (const place of PLACES) {
    for (const key of place.keys) {
      const pattern = key.startsWith("\\b") ? new RegExp(key) : null;
      const hit = pattern ? pattern.test(haystack) : haystack.includes(key);
      if (hit) {
        return { lat: place.lat, lng: place.lng, label: place.label, source: "keyword" };
      }
    }
  }
  return null;
}

type GoogleGeocodeResponse = {
  status: string;
  results?: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
};

/**
 * Resolve a free-text Nigerian address to coordinates. Google first (biased
 * to Nigeria), keyword gazetteer second, null if nothing matches. Never
 * throws: callers treat a null as "no distance available".
 */
export async function geocodeAddress(address: string): Promise<GeoResult | null> {
  const clean = address?.trim();
  if (!clean || clean.length < 3) return null;

  const key = getEnvOptional("GOOGLE_MAPS_API_KEY");
  if (key) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
      url.searchParams.set("address", clean);
      url.searchParams.set("region", "ng");
      url.searchParams.set("components", "country:NG");
      url.searchParams.set("key", key);
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const json = (await res.json()) as GoogleGeocodeResponse;
        const top = json.results?.[0];
        if (json.status === "OK" && top) {
          return {
            lat: top.geometry.location.lat,
            lng: top.geometry.location.lng,
            label: top.formatted_address,
            source: "google",
          };
        }
      }
    } catch {
      // fall through to the keyword gazetteer
    }
  }
  return keywordMatch(clean);
}

const EARTH_KM = 6371;

/** Great-circle distance in kilometres. */
export function distanceKm(a: Point, b: Point): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "1.2 km away" / "850 m away" */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m away`;
  if (km < 10) return `${km.toFixed(1)} km away`;
  return `${Math.round(km)} km away`;
}

export type StoreOption<T> = {
  store: T;
  distanceKm: number | null;
};

/**
 * Rank stores by distance from a point. Stores without coordinates sort last
 * rather than disappearing, so the picker is never empty.
 */
export function rankByDistance<T extends { lat: number | null; lng: number | null }>(
  stores: T[],
  from: Point | null
): StoreOption<T>[] {
  return stores
    .map((store) => ({
      store,
      distanceKm:
        from && store.lat != null && store.lng != null
          ? distanceKm(from, { lat: store.lat, lng: store.lng })
          : null,
    }))
    .sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
}
