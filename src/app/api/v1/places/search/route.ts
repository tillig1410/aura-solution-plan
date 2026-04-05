import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/v1/places/search?q=...
 * Proxy for Google Places Text Search (New API)
 * Server-side only — keeps API key secret
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.length < 3) {
    return NextResponse.json({ results: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ results: [], error: "no_api_key" });
  }

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.currentOpeningHours,places.types",
    },
    body: JSON.stringify({
      textQuery: query,
      languageCode: "fr",
      regionCode: "FR",
      includedType: "beauty_salon",
      maxResultCount: 5,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ results: [], error: "api_error" });
  }

  const data = await res.json();
  const results = (data.places ?? []).map((place: Record<string, unknown>) => ({
    placeId: place.id,
    name: (place.displayName as Record<string, string>)?.text ?? "",
    address: place.formattedAddress ?? "",
    phone: place.nationalPhoneNumber ?? "",
  }));

  return NextResponse.json({ results });
}
