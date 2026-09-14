import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error, status } = await supabase
    .from("profiles")
    .select("id, email, rol, created_at");

  if (error) {
    return NextResponse.json(
      { ok: false, status, code: error.code, message: error.message },
      { status: status || 500 },
    );
  }

  return NextResponse.json({ ok: true, count: data.length, data });
}
