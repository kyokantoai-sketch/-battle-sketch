import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { cleanText, verifyPassword } from "@/lib/utils";

export const runtime = "nodejs";

function resolveRoomCode(
  params: Record<string, string> | undefined,
  request: Request
) {
  const fromParams = params?.roomCode || (params as any)?.roomcode;
  if (fromParams) return fromParams;
  const pathname = new URL(request.url).pathname;
  const parts = pathname.split("/").filter(Boolean);
  const roomsIndex = parts.indexOf("rooms");
  if (roomsIndex >= 0 && parts.length > roomsIndex + 1) {
    return parts[roomsIndex + 1];
  }
  return "";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const awaitedParams = await params;
    const roomCode = resolveRoomCode(awaitedParams as any, request);
    if (!roomCode) {
      return NextResponse.json({ error: "Missing room code" }, { status: 400 });
    }
    const password = cleanText(body.password || "");

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select(
        "id,code,name,pass_hash,max_char_length,story_min_length,story_max_length,battle_status,battle_started_at"
      )
      .eq("code", roomCode.toUpperCase())
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Room query failed", detail: error.message },
        { status: 500 }
      );
    }

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!verifyPassword(password, room.pass_hash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const { data: players } = await supabaseAdmin
      .from("characters")
      .select(
        "id,slot,player_name,description,style_id,style_label,image_url,created_at"
      )
      .eq("room_id", room.id)
      .order("slot", { ascending: true });

    const { data: battle } = await supabaseAdmin
      .from("battles")
      .select("id,winner_slot,story,battle_image_url,result_image_url,created_at,room_id")
      .eq("room_id", room.id)
      .maybeSingle();

    const { data: slots } = await supabaseAdmin
      .from("room_slots")
      .select("slot,created_at")
      .eq("room_id", room.id);

    const mappedPlayers = (players || []).map((player) => ({
      id: player.id,
      slot: player.slot,
      name: player.player_name,
      description: player.description,
      styleId: player.style_id,
      styleLabel: player.style_label,
      imageUrl: player.image_url,
      createdAt: player.created_at,
    }));

    const battleStatus =
      room.battle_status === "generating"
        ? "generating"
        : battle
          ? "done"
          : "idle";

    const battlePayload =
      battleStatus === "generating" || !battle
        ? null
        : {
            id: battle.id,
            winnerSlot: battle.winner_slot,
            story: battle.story,
            battleImageUrl: battle.battle_image_url,
            resultImageUrl: battle.result_image_url,
            createdAt: battle.created_at,
          };

    return NextResponse.json({
      room: {
        code: room.code,
        name: room.name,
        charLimit: room.max_char_length,
        storyMin: room.story_min_length,
        storyMax: room.story_max_length,
      },
      players: mappedPlayers,
      battleStatus,
      slots: (slots || []).map((slot) => ({
        slot: slot.slot,
        createdAt: slot.created_at,
      })),
      battle: battlePayload,
    });
  } catch (error: any) {
    console.error("Room status error:", error);
    return NextResponse.json(
      {
        error: "Internal error",
        detail: error?.message || String(error),
      },
      { status: 500 }
    );
  }
}


