import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 48, 120);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const { data, error } = await supabaseAdmin
    .from("characters")
    .select(
      "id,player_name,description,style_label,image_url,created_at,rooms(code)"
    )
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: "Failed to load gallery" }, { status: 500 });
  }

  const items = (data || []).map((player: any) => ({
    id: player.id,
    name: player.player_name,
    description: player.description,
    styleLabel: player.style_label,
    imageUrl: player.image_url,
    createdAt: player.created_at,
    roomCode: player.rooms?.code || null,
  }));

  return NextResponse.json({ items });
}
