import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanText, verifyPassword } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const roomCode = cleanText(body.roomCode || "").toUpperCase();
    const password = cleanText(body.password || "");

    if (!roomCode || !password) {
      return NextResponse.json({ error: "Missing room code or password" }, { status: 400 });
    }

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select(
        "code,name,pass_hash,max_char_length,story_min_length,story_max_length"
      )
      .eq("code", roomCode)
      .single();

    if (error || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!verifyPassword(password, room.pass_hash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    return NextResponse.json({
      room: {
        code: room.code,
        name: room.name,
        charLimit: room.max_char_length,
        storyMin: room.story_min_length,
        storyMax: room.story_max_length,
      },
    });

  } catch (error: any) {
    console.error("Room join error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
