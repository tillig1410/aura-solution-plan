import { NextResponse, type NextRequest } from "next/server";

/**
 * GET /api/v1/places/details?id=...
 * Fetch detailed place info from Google Places (New API)
 */
export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("id");
  if (!placeId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 500 });
  }

  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "id,displayName,formattedAddress,nationalPhoneNumber,currentOpeningHours,googleMapsUri,photos",
    },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "api_error" }, { status: 502 });
  }

  const place = await res.json();

  // Build photo URL if available
  const photos = place.photos as { name: string }[] | undefined;
  let photoUrl: string | null = null;
  if (photos?.[0]?.name) {
    photoUrl = `https://places.googleapis.com/v1/${photos[0].name}/media?key=${apiKey}&maxWidthPx=400&maxHeightPx=300`;
  }

  return NextResponse.json({
    placeId: place.id,
    name: place.displayName?.text ?? "",
    address: place.formattedAddress ?? "",
    phone: place.nationalPhoneNumber ?? "",
    mapsUrl: place.googleMapsUri ?? "",
    openingHours: place.currentOpeningHours?.weekdayDescriptions ?? [],
    photoUrl,
  });
}
