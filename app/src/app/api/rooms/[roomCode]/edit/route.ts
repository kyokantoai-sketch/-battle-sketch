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
    const slot = Number(body.slot || 0);
    const token = cleanText(body.token || "");
    const name = cleanText(body.name || "");
    const description = cleanText(body.description || "");
    const editing =
      typeof body.editing === "boolean" ? Boolean(body.editing) : null;

    if (![1, 2].includes(slot)) {
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "Missing slot token" }, { status: 403 });
    }

    if (editing === null && (!name || !description)) {
      return NextResponse.json(
        { error: "Name and description required" },
        { status: 400 }
      );
    }

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select("id,pass_hash,max_char_length")
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

    const { data: claim } = await supabaseAdmin
      .from("room_slots")
      .select("slot")
      .eq("room_id", room.id)
      .eq("token", token)
      .maybeSingle();

    if (!claim || claim.slot !== slot) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    if (description && description.length > room.max_char_length) {
      return NextResponse.json(
        { error: "Description too long" },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (editing !== null) {
      updates.is_editing = editing;
    }
    if (name && description) {
      updates.player_name = name;
      updates.description = description;
      updates.is_editing = false;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("characters")
      .update(updates)
      .eq("room_id", room.id)
      .eq("slot", slot)
      .select(
        "id,slot,player_name,description,style_id,style_label,image_url,attack,defense,magic,mana,speed,summary,is_editing,created_at"
      )
      .single();

    if (updateError || !updated) {
      return NextResponse.json(
        { error: "Failed to update character" },
        { status: 500 }
      );
    }

    const mappedPlayer = {
      id: updated.id,
      slot: updated.slot,
      name: updated.player_name,
      description: updated.description,
      styleId: updated.style_id,
      styleLabel: updated.style_label,
      imageUrl: updated.image_url,
      attack: updated.attack,
      defense: updated.defense,
      magic: updated.magic,
      mana: updated.mana,
      speed: updated.speed,
      summary: updated.summary,
      isEditing: updated.is_editing,
      createdAt: updated.created_at,
    };

    return NextResponse.json({ player: mappedPlayer });
  } catch (error: any) {
    console.error("Room edit error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
