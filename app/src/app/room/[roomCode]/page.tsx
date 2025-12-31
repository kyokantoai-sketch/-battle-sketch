"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const passwordKey = (code: string) => `room:${code}:pass`;
const tokenKey = (code: string) => `room:${code}:token`;

const DEFAULT_VOLUME = 0.5;
const formatStat = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : "--";
const cleanFormValue = (value: string) => value.trim();

type Room = {
  code: string;
  name: string | null;
  charLimit: number;
  storyMin: number;
  storyMax: number;
};

type Player = {
  id: string;
  slot: number;
  name: string;
  description: string;
  styleLabel: string;
  imageUrl: string;
  attack?: number | null;
  defense?: number | null;
  magic?: number | null;
  mana?: number | null;
  speed?: number | null;
  summary?: string | null;
  isEditing?: boolean;
  createdAt: string;
};

type Battle = {
  id: string;
  winnerSlot: number;
  story: string;
  battleImageUrl: string;
  resultImageUrl?: string | null;
  createdAt: string;
};

type SlotClaim = {
  slot: number;
  createdAt: string;
};

export default function RoomPage() {
  const params = useParams();
  const [roomCode, setRoomCode] = useState<string>("");
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [slotClaims, setSlotClaims] = useState<SlotClaim[]>([]);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [battleLoading, setBattleLoading] = useState(false);
  const [battleStatus, setBattleStatus] = useState<"idle" | "generating" | "done">("idle");
  const [claiming, setClaiming] = useState(false);
  const [mySlot, setMySlot] = useState<number | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [viewerToken, setViewerToken] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState({
    1: { name: "", description: "" },
    2: { name: "", description: "" },
  });
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const seReadyRef = useRef<HTMLAudioElement | null>(null);
  const seBattleStartRef = useRef<HTMLAudioElement | null>(null);
  const seWinRef = useRef<HTMLAudioElement | null>(null);
  const seLoseRef = useRef<HTMLAudioElement | null>(null);
  const seKoRef = useRef<HTMLAudioElement | null>(null);
  const battleSectionRef = useRef<HTMLElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const readySlotsRef = useRef<Set<number> | null>(null);
  const prevBattleStatusRef = useRef<"idle" | "generating" | "done">("idle");
  const seenBattleIdRef = useRef<string | null>(null);

  useEffect(() => {
    const code = typeof params.roomCode === "string" ? params.roomCode : "";
    if (code) {
      setRoomCode(code.toUpperCase());
    }
  }, [params]);

  const initAudio = () => {
    if (bgmRef.current) return;
    bgmRef.current = new Audio("/audio/bgm.mp3");
    bgmRef.current.loop = true;
    bgmRef.current.volume = DEFAULT_VOLUME;

    seReadyRef.current = new Audio("/audio/se_ready.mp3");
    seBattleStartRef.current = new Audio("/audio/se_battle_start.mp3");
    seWinRef.current = new Audio("/audio/se_win.mp3");
    seLoseRef.current = new Audio("/audio/se_lose.mp3");
    seKoRef.current = new Audio("/audio/se_ko.mp3");

    [
      seReadyRef.current,
      seBattleStartRef.current,
      seWinRef.current,
      seLoseRef.current,
      seKoRef.current,
    ].forEach(
      (audio) => {
        if (audio) {
          audio.volume = DEFAULT_VOLUME;
        }
      }
    );
  };

  useEffect(() => {
    initAudio();
    return () => {
      bgmRef.current?.pause();
    };
  }, []);

  const ensureAudioReady = async () => {
    initAudio();
    if (audioReady) return true;
    const bgm = bgmRef.current;
    if (!bgm) return false;
    try {
      const prevMuted = bgm.muted;
      const prevVolume = bgm.volume;
      bgm.muted = true;
      bgm.volume = 0;
      await bgm.play();
      bgm.pause();
      bgm.currentTime = 0;
      bgm.muted = prevMuted;
      bgm.volume = prevVolume;
      setAudioReady(true);
      return true;
    } catch (err) {
      return false;
    }
  };

  const startBgm = async (forcePlay = false) => {
    if (!forcePlay && isMuted) return;
    const ok = await ensureAudioReady();
    if (!ok) return;
    const bgm = bgmRef.current;
    if (!bgm) return;
    bgm.loop = true;
    bgm.play().catch(() => null);
  };

  const playSe = async (ref: { current: HTMLAudioElement | null }) => {
    initAudio();
    if (isMuted) return;
    const ok = await ensureAudioReady();
    if (!ok) return;
    const audio = ref.current;
    if (!audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => null);
  };

  const toggleMute = async () => {
    if (isMuted) {
      setIsMuted(false);
      await startBgm(true);
      return;
    }
    setIsMuted(true);
  };

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    const volume = isMuted ? 0 : DEFAULT_VOLUME;
    bgm.volume = volume;
    bgm.muted = isMuted;
    if (isMuted) {
      bgm.pause();
    } else if (audioReady) {
      bgm.play().catch(() => null);
    }
    [
      seReadyRef.current,
      seBattleStartRef.current,
      seWinRef.current,
      seLoseRef.current,
      seKoRef.current,
    ].forEach(
      (audio) => {
        if (!audio) return;
        audio.volume = volume;
        audio.muted = isMuted;
      }
    );
  }, [isMuted, audioReady]);

  useEffect(() => {
    if (!unlocked) return;
    const handler = () => {
      startBgm();
    };
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, [unlocked]);

  const refreshStatus = async (pass = password) => {
    if (!roomCode || !pass) return;
    const res = await fetch(`/api/rooms/${roomCode}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Failed to load room");
    }
    setRoom(data.room);
    setPlayers(data.players || []);
    setSlotClaims(data.slots || []);
    const incomingBattle =
      data.battleStatus === "generating" ? null : data.battle || null;
    setBattle(incomingBattle);
    const nextBattleStatus =
      data.battleStatus || (incomingBattle ? "done" : "idle");
    setBattleStatus(nextBattleStatus);
    setBattleLoading(nextBattleStatus === "generating");
  };

  const claimSlot = async (pass = password) => {
    if (!roomCode || !pass) return;
    setClaiming(true);
    try {
      const storedToken = localStorage.getItem(tokenKey(roomCode)) || "";
      const res = await fetch(`/api/rooms/${roomCode}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pass, token: storedToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to claim slot");
      }
      if (data.spectator) {
        setIsSpectator(true);
        setMySlot(null);
        setViewerToken(storedToken);
        return;
      }
      setIsSpectator(false);
      setMySlot(data.slot);
      setViewerToken(data.token);
      localStorage.setItem(tokenKey(roomCode), data.token);
    } catch (err: any) {
      setError(err.message || "Failed to claim slot");
    } finally {
      setClaiming(false);
    }
  };

  const unlockRoom = async (pass = password) => {
    setLoading(true);
    setError(null);
    try {
      await refreshStatus(pass);
      await claimSlot(pass);
      setUnlocked(true);
      localStorage.setItem(passwordKey(roomCode), pass);
      await startBgm();
    } catch (err: any) {
      setError(err.message || "Failed to unlock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    const saved = localStorage.getItem(passwordKey(roomCode));
    if (saved) {
      setPassword(saved);
      unlockRoom(saved);
    }
  }, [roomCode]);

  useEffect(() => {
    if (!unlocked) return;
    const interval = setInterval(() => {
      refreshStatus().catch(() => null);
    }, 5000);
    return () => clearInterval(interval);
  }, [unlocked, password, roomCode]);

  useEffect(() => {
    if (battle) {
      setBattleLoading(false);
      setBattleStatus("done");
    }
  }, [battle]);

  const playerA = useMemo(
    () => players.find((player) => player.slot === 1) || null,
    [players]
  );
  const playerB = useMemo(
    () => players.find((player) => player.slot === 2) || null,
    [players]
  );

  const winnerPlayer = battle
    ? battle.winnerSlot === 1
      ? playerA
      : playerB
    : null;
  const loserPlayer = battle
    ? battle.winnerSlot === 1
      ? playerB
      : playerA
    : null;

  const bothReady = Boolean(playerA && playerB);
  const canRevealOpponent = isSpectator || bothReady || Boolean(battle);
  const slotClaimed = (slot: number) =>
    slotClaims.some((claim) => claim.slot === slot);

  const canShowCharacter = (player: Player | null) => {
    if (!player || player.isEditing) return false;
    return player.slot === mySlot || canRevealOpponent;
  };

  useEffect(() => {
    if (!audioReady || isMuted) return;
    const readySlots = new Set<number>();
    if (playerA) readySlots.add(1);
    if (playerB) readySlots.add(2);

    if (!readySlotsRef.current) {
      readySlotsRef.current = readySlots;
      return;
    }

    readySlots.forEach((slot) => {
      if (!readySlotsRef.current?.has(slot)) {
        void playSe(seReadyRef);
      }
    });
    readySlotsRef.current = readySlots;
  }, [playerA?.id, playerB?.id, audioReady, isMuted]);

  useEffect(() => {
    const prev = prevBattleStatusRef.current;
    if (prev !== "generating" && battleStatus === "generating") {
      void playSe(seBattleStartRef);
    }
    prevBattleStatusRef.current = battleStatus;
  }, [battleStatus]);

  useEffect(() => {
    if (!battle || battleStatus === "generating") return;
    if (seenBattleIdRef.current === battle.id) return;
    seenBattleIdRef.current = battle.id;
    void playSe(seKoRef);
    const timeoutId = window.setTimeout(() => {
      if (mySlot) {
        if (battle.winnerSlot === mySlot) {
          void playSe(seWinRef);
        } else {
          void playSe(seLoseRef);
        }
      } else {
        void playSe(seWinRef);
      }
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [battle?.id, battleStatus, mySlot]);

  useEffect(() => {
    if (bothReady && !hasAutoScrolledRef.current) {
      battleSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      hasAutoScrolledRef.current = true;
    }
    if (!bothReady) {
      hasAutoScrolledRef.current = false;
    }
  }, [bothReady]);

  useEffect(() => {
    if (playerA && mySlot === 1) {
      setForms((prev) => {
        if (prev[1].name || prev[1].description) return prev;
        return { ...prev, 1: { name: playerA.name, description: playerA.description } };
      });
    }
  }, [playerA, mySlot]);

  useEffect(() => {
    if (playerB && mySlot === 2) {
      setForms((prev) => {
        if (prev[2].name || prev[2].description) return prev;
        return { ...prev, 2: { name: playerB.name, description: playerB.description } };
      });
    }
  }, [playerB, mySlot]);

  const submitPlayer = async (slot: 1 | 2, force = false) => {
    setLoading(true);
    setError(null);
    try {
      if (isSpectator || mySlot !== slot) {
        throw new Error("この枠は操作できません");
      }
      const fallbackPlayer = slot === 1 ? playerA : playerB;
      const name = cleanFormValue(
        forms[slot].name || fallbackPlayer?.name || ""
      );
      const description = cleanFormValue(
        forms[slot].description || fallbackPlayer?.description || ""
      );
      if (!name || !description) {
        throw new Error("名前と描写を入力してください");
      }
      const payload = {
        password,
        slot,
        name,
        description,
        token: viewerToken,
        force,
      };
      const res = await fetch(`/api/rooms/${roomCode}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }
      await refreshStatus();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const setEditingState = async (slot: 1 | 2, editing: boolean) => {
    setLoading(true);
    setError(null);
    try {
      if (isSpectator || mySlot !== slot) {
        throw new Error("この枠は操作できません");
      }
      const res = await fetch(`/api/rooms/${roomCode}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          slot,
          token: viewerToken,
          editing,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update editing");
      }
      await refreshStatus();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startEdit = async (slot: 1 | 2) => {
    const player = slot === 1 ? playerA : playerB;
    if (player) {
      setForms((prev) => ({
        ...prev,
        [slot]: {
          name: player.name,
          description: player.description,
        },
      }));
    }
    await setEditingState(slot, true);
  };

  const cancelEdit = async (slot: 1 | 2) => {
    await setEditingState(slot, false);
    const player = slot === 1 ? playerA : playerB;
    if (player) {
      setForms((prev) => ({
        ...prev,
        [slot]: {
          name: player.name,
          description: player.description,
        },
      }));
    }
  };

  const saveEdit = async (slot: 1 | 2) => {
    setLoading(true);
    setError(null);
    try {
      if (isSpectator || mySlot !== slot) {
        throw new Error("この枠は操作できません");
      }
      const name = cleanFormValue(forms[slot].name);
      const description = cleanFormValue(forms[slot].description);
      if (!name || !description) {
        throw new Error("名前と描写を入力してください");
      }
      const res = await fetch(`/api/rooms/${roomCode}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          slot,
          token: viewerToken,
          name,
          description,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save edit");
      }
      await refreshStatus();
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const startBattle = async (force?: boolean) => {
    const shouldForce = typeof force === "boolean" ? force : false;
    setLoading(true);
    setBattleLoading(true);
    setError(null);
    setBattleStatus("generating");
    if (shouldForce) {
      setBattle(null);
    }
    try {
      const res = await fetch(`/api/rooms/${roomCode}/battle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, force: shouldForce }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start battle");
      }
      if (data.battle) {
        setBattle(data.battle);
      }
      if (data.battleStatus) {
        setBattleStatus(data.battleStatus);
        setBattleLoading(data.battleStatus === "generating");
      }
    } catch (err: any) {
      setError(err.message || "Failed");
      setBattleLoading(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-10 md:px-16">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm text-neutral-600" href="/">
              ← 戻る
            </Link>
            <h1 className="mt-2 text-3xl">
              ルーム {roomCode}
              {room?.name ? `：${room.name}` : ""}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-ghost"
              type="button"
              onClick={() => toggleMute()}
              title={isMuted ? "ミュート解除" : "ミュート"}
              aria-label={isMuted ? "ミュート解除" : "ミュート"}
            >
              {isMuted ? "🔇" : "🔊"}
            </button>
            <button
              className="btn-ghost"
              type="button"
              onClick={() => refreshStatus()}
            >
              更新
            </button>
            <Link className="btn-ghost" href="/gallery">
              図鑑
            </Link>
          </div>
        </header>

        {!unlocked ? (
          <section className="glass rounded-3xl p-6">
            <h2 className="text-2xl">パスワード入力</h2>
            <p className="mt-2 text-sm text-neutral-700">
              ルームのパスワードを入力してください。
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-neutral-300 px-3 py-2"
              />
              <button
                className="btn-primary"
                type="button"
                disabled={loading}
                onClick={() => unlockRoom()}
              >
                {loading ? "確認中..." : "入室"}
              </button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </section>
        ) : (
          <>
            <section className="glass rounded-3xl p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl">ルーム設定</h2>
                  <p className="text-sm text-neutral-600">
                    描写上限 {room?.charLimit} 文字 / 物語 {room?.storyMin}〜
                    {room?.storyMax} 文字
                  </p>
                </div>
                <div className="text-sm text-neutral-500 text-right">
                  <div>パスワードはブラウザに保存中</div>
                  <div>
                    {isSpectator
                      ? "観戦中"
                      : mySlot
                        ? `あなたはプレイヤー ${mySlot === 1 ? "A" : "B"}`
                        : "参加枠を確認中..."}
                  </div>
                </div>
              </div>
            </section>

            {isSpectator ? (
              <section className="glass rounded-3xl p-6">
                <h2 className="text-2xl">観戦モード</h2>
                <p className="mt-2 text-sm text-neutral-600">
                  このルームは2人まで参加できます。あなたは観戦中です。
                </p>
              </section>
            ) : null}

            <section className="card-grid cols-2">
              {[1, 2].map((slot) => {
                const player = slot === 1 ? playerA : playerB;
                const isMine = mySlot === slot;
                const claimed = slotClaimed(slot);
                const statusLabel = player
                  ? player.isEditing
                    ? "修正中"
                    : "生成完了"
                  : claimed
                    ? "入力中"
                    : "参加待ち";
                const isEditing = Boolean(player?.isEditing);
                const showDetails = canShowCharacter(player);
                return (
                  <div key={slot} className="glass rounded-3xl p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl">
                        プレイヤー {slot === 1 ? "A" : "B"}
                      </h3>
                      <span className="tag">{statusLabel}</span>
                    </div>
                    {player ? (
                      isMine && isEditing ? (
                        <div className="mt-4 space-y-3">
                          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 p-4 text-sm text-neutral-600">
                            修正中のため画像は非表示です。
                          </div>
                          <label className="block text-sm">
                            名前
                            <input
                              value={forms[slot as 1 | 2].name}
                              onChange={(event) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [slot]: {
                                    ...prev[slot as 1 | 2],
                                    name: event.target.value,
                                  },
                                }))
                              }
                              className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                            />
                          </label>
                          <label className="block text-sm">
                            描写（{room?.charLimit}文字まで）
                            <textarea
                              value={forms[slot as 1 | 2].description}
                              onChange={(event) =>
                                setForms((prev) => ({
                                  ...prev,
                                  [slot]: {
                                    ...prev[slot as 1 | 2],
                                    description: event.target.value,
                                  },
                                }))
                              }
                              maxLength={room?.charLimit}
                              rows={3}
                              className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                            />
                            <div className="mt-1 text-xs text-neutral-500">
                              {forms[slot as 1 | 2].description.length} / {room?.charLimit}
                            </div>
                          </label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <button
                              className="btn-primary w-full"
                              type="button"
                              disabled={loading}
                              onClick={() => saveEdit(slot as 1 | 2)}
                            >
                              {loading ? "保存中..." : "修正を保存"}
                            </button>
                            <button
                              className="btn-ghost w-full"
                              type="button"
                              disabled={loading}
                              onClick={() => cancelEdit(slot as 1 | 2)}
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {showDetails ? (
                            <img
                              src={player.imageUrl}
                              alt={player.name}
                              className="h-72 w-full rounded-2xl object-contain bg-white/70"
                            />
                          ) : (
                            <div className="h-72 w-full rounded-2xl bg-white/70 text-sm text-neutral-500 flex items-center justify-center">
                              {player.isEditing
                                ? "修正中のため非公開"
                                : "相手のキャラは非公開"}
                            </div>
                          )}
                          <div>
                            <div className="text-lg font-semibold">
                              {showDetails ? player.name : "？？？"}
                            </div>
                            <div className="text-sm text-neutral-600">
                              {showDetails ? player.description : "生成完了"}
                            </div>
                            {showDetails ? (
                              <>
                                <div className="mt-2 text-xs text-neutral-500">
                                  絵柄：{player.styleLabel}
                                </div>
                                <div className="stat-grid mt-3">
                                  {[
                                    { label: "こうげき", value: player.attack },
                                    { label: "まもり", value: player.defense },
                                    { label: "まほう", value: player.magic },
                                    { label: "まりょく", value: player.mana },
                                    { label: "はやさ", value: player.speed },
                                  ].map((stat) => (
                                    <div key={stat.label} className="stat-pill">
                                      <span className="stat-label">{stat.label}</span>
                                      <span className="stat-value">
                                        {formatStat(stat.value)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <p className="summary-card">
                                  {player.summary || "画像解析中..."}
                                </p>
                              </>
                            ) : null}
                          </div>
                          {isMine ? (
                            <div className="flex flex-col gap-2">
                              <button
                                className="btn-ghost w-full"
                                type="button"
                                disabled={loading}
                                onClick={() => submitPlayer(slot as 1 | 2, true)}
                              >
                                {loading ? "再生成中..." : "キャラ再生成"}
                              </button>
                              <button
                                className="btn-primary w-full"
                                type="button"
                                disabled={loading}
                                onClick={() => startEdit(slot as 1 | 2)}
                              >
                                名前と描写を修正
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )
                    ) : isMine ? (
                      <div className="mt-4 space-y-3">
                        <label className="block text-sm">
                          名前
                          <input
                            value={forms[slot as 1 | 2].name}
                            onChange={(event) =>
                              setForms((prev) => ({
                                ...prev,
                                [slot]: {
                                  ...prev[slot as 1 | 2],
                                  name: event.target.value,
                                },
                              }))
                            }
                            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                          />
                        </label>
                        <label className="block text-sm">
                          描写（{room?.charLimit}文字まで）
                          <textarea
                            value={forms[slot as 1 | 2].description}
                            onChange={(event) =>
                              setForms((prev) => ({
                                ...prev,
                                [slot]: {
                                  ...prev[slot as 1 | 2],
                                  description: event.target.value,
                                },
                              }))
                            }
                            maxLength={room?.charLimit}
                            rows={3}
                            className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                          />
                          <div className="mt-1 text-xs text-neutral-500">
                            {forms[slot as 1 | 2].description.length} / {room?.charLimit}
                          </div>
                        </label>
                        <button
                          className="btn-primary w-full"
                          type="button"
                          disabled={loading || claiming}
                          onClick={() => submitPlayer(slot as 1 | 2)}
                        >
                          {loading ? "生成中..." : "キャラ生成"}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl border border-neutral-200 bg-white/60 p-4 text-sm text-neutral-600">
                        {claimed
                          ? "相手が入力中です。完了通知を待っています。"
                          : "参加待ちです。空いている枠は先着2名のみです。"}
                      </div>
                    )}
                  </div>
                );
              })}
            </section>

            <section ref={battleSectionRef} className="glass rounded-3xl p-6">
              <h2 className="text-2xl">バトル結果</h2>
              {battle && battleStatus !== "generating" ? (
                <div className="mt-4 space-y-4">
                  <div className="result-banner">
                    <div className="result-label">Winner</div>
                    <div className="result-winner">
                      プレイヤー {battle.winnerSlot === 1 ? "A" : "B"}
                      {winnerPlayer ? `: ${winnerPlayer.name}` : ""}
                    </div>
                  </div>
                  {winnerPlayer && loserPlayer ? (
                    <div className="result-stage">
                      <div className="result-card loser">
                        <div className="result-image">
                          {canShowCharacter(loserPlayer) ? (
                            <img
                              src={loserPlayer.imageUrl}
                              alt={loserPlayer.name}
                              className="result-img"
                            />
                          ) : (
                            <div className="result-img result-placeholder">
                              非公開
                            </div>
                          )}
                        </div>
                        <div className="result-name">
                          {canShowCharacter(loserPlayer)
                            ? loserPlayer.name
                            : "？？？"}
                        </div>
                      </div>
                      <div className="result-card winner">
                        <div className="result-image">
                          {canShowCharacter(winnerPlayer) ? (
                            <img
                              src={winnerPlayer.imageUrl}
                              alt={winnerPlayer.name}
                              className="result-img"
                            />
                          ) : (
                            <div className="result-img result-placeholder">
                              非公開
                            </div>
                          )}
                        </div>
                        <div className="result-name">
                          {canShowCharacter(winnerPlayer)
                            ? winnerPlayer.name
                            : "？？？"}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <button
                    className="btn-primary w-full sm:w-auto"
                    type="button"
                    disabled={loading}
                    onClick={() => startBattle(true)}
                  >
                    {loading ? "再戦生成中..." : "もう一度戦う"}
                  </button>
                  <div className="battle-image-grid">
                    <div className="space-y-2">
                      <div className="image-label">戦闘シーン</div>
                      <img
                        src={battle.battleImageUrl}
                        alt="battle"
                        className="h-96 w-full rounded-2xl object-contain bg-white/70"
                      />
                    </div>
                    {battle.resultImageUrl ? (
                      <div className="space-y-2">
                        <div className="image-label">決着シーン</div>
                        <img
                          src={battle.resultImageUrl}
                          alt="result"
                          className="h-96 w-full rounded-2xl object-contain bg-white/70"
                        />
                      </div>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-neutral-700">
                    {battle.story}
                  </p>
                </div>
              ) : battleLoading ? (
                <div className="mt-5 space-y-4">
                  <div className="versus-stage">
                    <div className="versus-card left">
                      {playerA && canShowCharacter(playerA) ? (
                        <img
                          src={playerA.imageUrl}
                          alt={playerA.name}
                          className="versus-img"
                        />
                      ) : (
                        <div className="versus-placeholder">A</div>
                      )}
                    </div>
                    <div className="versus-card right">
                      {playerB && canShowCharacter(playerB) ? (
                        <img
                          src={playerB.imageUrl}
                          alt={playerB.name}
                          className="versus-img"
                        />
                      ) : (
                        <div className="versus-placeholder">B</div>
                      )}
                    </div>
                    <div className="versus-burst" />
                    <div className="versus-text">VS</div>
                  </div>
                  <p className="text-sm text-neutral-600">
                    バトル生成中… 結果が出るまで少し待ってね。
                  </p>
                </div>
              ) : bothReady ? (
                <div className="mt-5 space-y-4">
                  <div className="versus-stage">
                    <div className="versus-card left">
                      {playerA && canShowCharacter(playerA) ? (
                        <img
                          src={playerA.imageUrl}
                          alt={playerA.name}
                          className="versus-img"
                        />
                      ) : (
                        <div className="versus-placeholder">A</div>
                      )}
                    </div>
                    <div className="versus-card right">
                      {playerB && canShowCharacter(playerB) ? (
                        <img
                          src={playerB.imageUrl}
                          alt={playerB.name}
                          className="versus-img"
                        />
                      ) : (
                        <div className="versus-placeholder">B</div>
                      )}
                    </div>
                    <div className="versus-burst" />
                    <div className="versus-text">VS</div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <p className="text-sm text-neutral-600">
                      両方のキャラクターが生成完了しました。バトルを開始できます。
                    </p>
                    <button
                      className="btn-primary"
                      type="button"
                      disabled={loading}
                      onClick={() => startBattle(false)}
                    >
                      {loading ? "生成中..." : "バトル開始"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <p className="text-sm text-neutral-600">
                    どちらかのキャラ生成がまだです。完了を待っています。
                  </p>
                  <button
                    className="btn-primary"
                    type="button"
                    disabled={loading || !playerA || !playerB}
                    onClick={() => startBattle(false)}
                  >
                    {loading ? "生成中..." : "バトル開始"}
                  </button>
                </div>
              )}
            </section>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </>
        )}
      </div>
    </main>
  );
}






















