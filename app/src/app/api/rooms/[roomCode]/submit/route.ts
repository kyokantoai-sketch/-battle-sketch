import { NextResponse } from "next/server";
import { SAFE_CONTENT_RULES, STYLE_POOL } from "@/lib/constants";
import { generateImage } from "@/lib/gemini";
import { supabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/admin";
import { cleanText, pickRandom, verifyPassword } from "@/lib/utils";

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

function extensionForMime(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  return "png";
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
    const name = cleanText(body.name || "");
    const description = cleanText(body.description || "");
    const token = cleanText(body.token || "");
    const force = Boolean(body.force);

    if (![1, 2].includes(slot)) {
      return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
    }
    if (!name || !description) {
      return NextResponse.json(
        { error: "Name and description required" },
        { status: 400 }
      );
    }

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select("id,code,pass_hash,max_char_length")
      .eq("code", roomCode.toUpperCase())
      .single();

    if (error || !room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (!verifyPassword(password, room.pass_hash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    if (!token) {
      return NextResponse.json({ error: "Missing slot token" }, { status: 403 });
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

    if (description.length > room.max_char_length) {
      return NextResponse.json(
        { error: "Description too long" },
        { status: 400 }
      );
    }

    const { data: existing } = await supabaseAdmin
      .from("characters")
      .select("id,image_path")
      .eq("room_id", room.id)
      .eq("slot", slot)
      .maybeSingle();

    if (existing && !force) {
      return NextResponse.json({ error: "Slot already taken" }, { status: 409 });
    }
    if (existing && force) {
      if (existing.image_path) {
        await supabaseAdmin.storage
          .from(SUPABASE_BUCKET)
          .remove([existing.image_path]);
      }
      await supabaseAdmin.from("characters").delete().eq("id", existing.id);
    }

    const style = pickRandom(STYLE_POOL);
    const imageModel =
      process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

    const prompt = `Create a single character portrait for a fantasy battle game. ${SAFE_CONTENT_RULES} Style keywords: ${style.prompt}. Character description: ${description}. Do not render any text or letters. Keep the background clean.`;

    const image = await generateImage({
      model: imageModel,
      prompt,
    });

    const extension = extensionForMime(image.mimeType);
    const path = `characters/${room.code}/slot-${slot}-${Date.now()}.${extension}`;

    const uploadResult = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload(path, Buffer.from(image.base64, "base64"), {
        contentType: image.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      return NextResponse.json(
        { error: "Failed to upload character image" },
        { status: 500 }
      );
    }

    const publicUrl = supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(path).data.publicUrl;

    const { data: player, error: playerError } = await supabaseAdmin
      .from("characters")
      .insert({
        room_id: room.id,
        slot,
        player_name: name,
        description,
        style_id: style.id,
        style_label: style.label,
        image_path: path,
        image_url: publicUrl,
      })
      .select(
        "id,slot,player_name,description,style_id,style_label,image_url,created_at"
      )
      .single();

    if (playerError || !player) {
      return NextResponse.json(
        { error: "Failed to save player" },
        { status: 500 }
      );
    }

    const mappedPlayer = {
      id: player.id,
      slot: player.slot,
      name: player.player_name,
      description: player.description,
      styleId: player.style_id,
      styleLabel: player.style_label,
      imageUrl: player.image_url,
      createdAt: player.created_at,
    };

    return NextResponse.json({ player: mappedPlayer });
  } catch (error: any) {
    console.error("Room submit error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}

