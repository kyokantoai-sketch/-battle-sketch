import { NextResponse } from "next/server";
import { DEFAULT_LIMITS } from "@/lib/constants";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clampNumber, cleanText, generateRoomCode, hashPassword } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const roomName = cleanText(body.roomName || "");
    const password = cleanText(body.password || "");
    if (password.length < 4) {
      return NextResponse.json({ error: "Password must be 4+ characters" }, { status: 400 });
    }

    const charLimit = clampNumber(
      Number(body.charLimit) || DEFAULT_LIMITS.charLimit,
      10,
      80
    );
    const storyMin = clampNumber(
      Number(body.storyMin) || DEFAULT_LIMITS.storyMin,
      200,
      4000
    );
    const storyMax = clampNumber(
      Number(body.storyMax) || DEFAULT_LIMITS.storyMax,
      storyMin,
      6000
    );

    const passHash = hashPassword(password);

    let attempt = 0;
    while (attempt < 5) {
      const code = generateRoomCode();
      const { data, error } = await supabaseAdmin
        .from("rooms")
        .insert({
          code,
          name: roomName || null,
          art_style: "random",
          pass_hash: passHash,
          max_char_length: charLimit,
          story_min_length: storyMin,
          story_max_length: storyMax,
        })
        .select("code")
        .single();

      if (!error && data?.code) {
        return NextResponse.json({ roomCode: data.code });
      }

      attempt += 1;
    }

    return NextResponse.json(
      { error: "Failed to create room. Please retry." },
      { status: 500 }
    );

  } catch (error: any) {
    console.error("Room create error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
