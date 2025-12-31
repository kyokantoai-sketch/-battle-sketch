import crypto from "crypto";
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

function generateToken() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
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
    const providedToken = cleanText(body.token || "");

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select("id,pass_hash")
      .eq("code", roomCode.toUpperCase())
      .single();

    if (error || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!verifyPassword(password, room.pass_hash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (providedToken) {
      const { data: existingSlot } = await supabaseAdmin
        .from("room_slots")
        .select("slot,token")
        .eq("room_id", room.id)
        .eq("token", providedToken)
        .maybeSingle();

      if (existingSlot) {
        return NextResponse.json({
          slot: existingSlot.slot,
          token: existingSlot.token,
          spectator: false,
        });
      }
    }

    const { data: slots } = await supabaseAdmin
      .from("room_slots")
      .select("slot")
      .eq("room_id", room.id);

    const { data: existingPlayers } = await supabaseAdmin
      .from("characters")
      .select("slot")
      .eq("room_id", room.id);

    const taken = new Set([
      ...(slots || []).map((slot) => slot.slot),
      ...(existingPlayers || []).map((player) => player.slot),
    ]);
    if (taken.size >= 2) {
      return NextResponse.json({ spectator: true });
    }

    const slotToClaim = taken.has(1) ? 2 : 1;
    const token = generateToken();

    const { data: created, error: createError } = await supabaseAdmin
      .from("room_slots")
      .insert({ room_id: room.id, slot: slotToClaim, token })
      .select("slot,token")
      .single();

    if (createError || !created) {
      return NextResponse.json(
        { error: "Failed to claim slot" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      slot: created.slot,
      token: created.token,
      spectator: false,
    });
  } catch (error: any) {
    console.error("Room claim error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

