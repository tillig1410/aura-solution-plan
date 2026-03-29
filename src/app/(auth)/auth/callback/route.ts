import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectUrl } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const requestOrigin = request.nextUrl.origin;

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          },
        },
      },
    );

    await supabase.auth.exchangeCodeForSession(code);

    // Check if merchant exists → redirect to dashboard or onboarding
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (merchant) {
        return NextResponse.redirect(safeRedirectUrl("/agenda", requestOrigin));
      }
      return NextResponse.redirect(safeRedirectUrl("/onboarding", requestOrigin));
    }
  }

  return NextResponse.redirect(safeRedirectUrl("/login", requestOrigin));
}
