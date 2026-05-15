import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// This endpoint is called by a cron job (e.g. GitHub Actions) once per day
// to prevent the free-tier Supabase project from being paused due to inactivity.
export async function GET(request: Request) {
  // Optional: protect the endpoint with a secret token
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // A lightweight query — just checks the connection is alive
    const { error } = await supabase
      .from("products")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[keep-alive] Supabase ping failed:", error.message);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 }
      );
    }

    console.log("[keep-alive] Supabase ping successful");
    return NextResponse.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[keep-alive] Unexpected error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
