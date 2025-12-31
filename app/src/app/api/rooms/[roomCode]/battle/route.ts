import { NextResponse } from "next/server";
import { SAFE_CONTENT_RULES } from "@/lib/constants";
import { generateImage, generateText } from "@/lib/gemini";
import { supabaseAdmin, SUPABASE_BUCKET } from "@/lib/supabase/admin";
import { cleanText, safeJsonParse, toBase64, verifyPassword } from "@/lib/utils";

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

type BattleJson = {
  winner: "A" | "B";
  story: string;
};

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

async function downloadImage(path: string) {
  const { data, error } = await supabaseAdmin.storage
    .from(SUPABASE_BUCKET)
    .download(path);

  if (error || !data) {
    throw new Error("Failed to download image");
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    base64: toBase64(arrayBuffer),
    mimeType: data.type || "image/png",
  };
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
  let lockAcquired = false;
  let roomId: string | null = null;

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
    const force = Boolean(body.force);

    const { data: room, error } = await supabaseAdmin
      .from("rooms")
      .select(
        "id,code,pass_hash,story_min_length,story_max_length,battle_status,battle_started_at"
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

    roomId = room.id;

    if (!verifyPassword(password, room.pass_hash)) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const { data: existingBattle } = await supabaseAdmin
      .from("battles")
      .select(
        "id,winner_slot,story,battle_image_url,battle_image_path,result_image_url,result_image_path,created_at"
      )
      .eq("room_id", room.id)
      .maybeSingle();

    if (existingBattle && !force) {
      return NextResponse.json({
        battle: {
          id: existingBattle.id,
          winnerSlot: existingBattle.winner_slot,
          story: existingBattle.story,
          battleImageUrl: existingBattle.battle_image_url,
          resultImageUrl: existingBattle.result_image_url,
          createdAt: existingBattle.created_at,
        },
        battleStatus: "done",
      });
    }

    if (room.battle_status === "generating") {
      if (!force) {
        return NextResponse.json({ battleStatus: "generating" });
      }
      await supabaseAdmin
        .from("rooms")
        .update({ battle_status: null, battle_started_at: null })
        .eq("id", room.id);
    }

    const { data: lockRow, error: lockError } = await supabaseAdmin
      .from("rooms")
      .update({
        battle_status: "generating",
        battle_started_at: new Date().toISOString(),
      })
      .eq("id", room.id)
      .is("battle_status", null)
      .select("id")
      .maybeSingle();

    if (lockError) {
      return NextResponse.json(
        { error: "Failed to lock battle", detail: lockError.message },
        { status: 500 }
      );
    }

    if (!lockRow) {
      return NextResponse.json({ battleStatus: "generating" });
    }

    lockAcquired = true;

    if (existingBattle && force) {
      if (existingBattle.battle_image_path) {
        await supabaseAdmin.storage
          .from(SUPABASE_BUCKET)
          .remove([existingBattle.battle_image_path]);
      }
      if (existingBattle.result_image_path) {
        await supabaseAdmin.storage
          .from(SUPABASE_BUCKET)
          .remove([existingBattle.result_image_path]);
      }
      await supabaseAdmin.from("battles").delete().eq("id", existingBattle.id);
    }

    const { data: players } = await supabaseAdmin
      .from("characters")
      .select(
        "id,slot,player_name,image_path,image_url,style_label,description,created_at"
      )
      .eq("room_id", room.id)
      .order("slot", { ascending: true });

    if (!players || players.length < 2) {
      return NextResponse.json(
        { error: "Both players are required" },
        { status: 400 }
      );
    }

    const playerA = players.find((player) => player.slot === 1);
    const playerB = players.find((player) => player.slot === 2);

    if (!playerA || !playerB || !playerA.image_path || !playerB.image_path) {
      return NextResponse.json(
        { error: "Both player images are required" },
        { status: 400 }
      );
    }

    const [imageA, imageB] = await Promise.all([
      downloadImage(playerA.image_path),
      downloadImage(playerB.image_path),
    ]);

    const textModel = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
    const battleModel =
      process.env.GEMINI_BATTLE_IMAGE_MODEL || "gemini-2.5-flash-image";

    const judgePrompt = `You are an impartial battle judge. Use only the visuals from the two images. Do not invent names or use any text hints. Output strict JSON in Japanese with keys: {"winner":"A"|"B","story":"..."}. The story must be ${room.story_min_length}-${room.story_max_length} Japanese characters, use placeholders {A} and {B} for names, and must be safe for elementary school kids. ${SAFE_CONTENT_RULES}`;

    const judgeRaw = await generateText({
      model: textModel,
      prompt: judgePrompt,
      images: [imageA, imageB],
    });

    const jsonText = extractJson(judgeRaw) || judgeRaw;
    let battleJson = safeJsonParse<BattleJson>(jsonText);

    if (!battleJson) {
      battleJson = {
        winner: "A",
        story: judgeRaw.trim(),
      };
    }

    const winnerSlot = battleJson.winner === "B" ? 2 : 1;
    const story = battleJson.story
      .replace(/\{A\}/g, playerA.player_name)
      .replace(/\{B\}/g, playerB.player_name)
      .trim();

    const winnerLabel = winnerSlot === 1 ? "A" : "B";
    const loserLabel = winnerSlot === 1 ? "B" : "A";

    const battlePrompt = `Create a dynamic, close and evenly matched battle scene featuring the two provided characters. The first reference image is Character A and the second reference image is Character B. Neither character should look clearly winning yet; make it a tight clash with both pushing back. Use the reference images only for character identity (colors, clothing, species, silhouettes) and ignore their original pose or facial expression. Choose fresh, original poses and expressions from scratch that fit the scene. Keep it kid-safe. ${SAFE_CONTENT_RULES} No text or logos. Both characters must be visible.`;

    const battleImage = await generateImage({
      model: battleModel,
      prompt: battlePrompt,
      images: [imageA, imageB],
    });

    const battleExtension = extensionForMime(battleImage.mimeType);
    const battlePath = `battles/${room.code}/battle-${Date.now()}.${battleExtension}`;

    const uploadBattle = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload(battlePath, Buffer.from(battleImage.base64, "base64"), {
        contentType: battleImage.mimeType,
        upsert: true,
      });

    if (uploadBattle.error) {
      return NextResponse.json(
        { error: "Failed to upload battle image" },
        { status: 500 }
      );
    }

    const battleUrl = supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(battlePath).data.publicUrl;

    const resultPrompt = `Create a decisive victory scene featuring the two provided characters. The first reference image is Character A and the second reference image is Character B. Character ${winnerLabel} must be the winner, centered and triumphant. Character ${loserLabel} must look clearly defeated (e.g., staggered, disarmed, or on the ground), while remaining kid-safe. Use the reference images only for character identity (colors, clothing, species, silhouettes) and ignore their original pose or facial expression. Choose fresh, original poses and expressions from scratch that fit the scene. ${SAFE_CONTENT_RULES} No text or logos. Both characters must be visible.`;

    const resultImage = await generateImage({
      model: battleModel,
      prompt: resultPrompt,
      images: [imageA, imageB],
    });

    const resultExtension = extensionForMime(resultImage.mimeType);
    const resultPath = `battles/${room.code}/result-${Date.now()}.${resultExtension}`;

    const uploadResult = await supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .upload(resultPath, Buffer.from(resultImage.base64, "base64"), {
        contentType: resultImage.mimeType,
        upsert: true,
      });

    if (uploadResult.error) {
      return NextResponse.json(
        { error: "Failed to upload result image" },
        { status: 500 }
      );
    }

    const resultUrl = supabaseAdmin.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(resultPath).data.publicUrl;

    const { data: battleRow, error: battleError } = await supabaseAdmin
      .from("battles")
      .insert({
        room_id: room.id,
        winner_slot: winnerSlot,
        winner_id: winnerSlot === 1 ? playerA.id : playerB.id,
        story,
        battle_image_path: battlePath,
        battle_image_url: battleUrl,
        result_image_path: resultPath,
        result_image_url: resultUrl,
      })
      .select("id,winner_slot,story,battle_image_url,result_image_url,created_at")
      .single();

    if (battleError || !battleRow) {
      return NextResponse.json(
        { error: "Failed to save battle" },
        { status: 500 }
      );
    }

    await supabaseAdmin
      .from("rooms")
      .update({ battle_status: null, battle_started_at: null })
      .eq("id", room.id);

    return NextResponse.json({
      battle: {
        id: battleRow.id,
        winnerSlot: battleRow.winner_slot,
        story: battleRow.story,
        battleImageUrl: battleRow.battle_image_url,
        resultImageUrl: battleRow.result_image_url,
        createdAt: battleRow.created_at,
      },
      battleStatus: "done",
    });
  } catch (error: any) {
    if (lockAcquired && roomId) {
      await supabaseAdmin
        .from("rooms")
        .update({ battle_status: null, battle_started_at: null })
        .eq("id", roomId);
    }

    console.error("Room battle error:", error);
    return NextResponse.json(
      { error: "Internal error", detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}



