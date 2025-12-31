"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const passwordKey = (code: string) => `room:${code}:pass`;
const tokenKey = (code: string) => `room:${code}:token`;

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
  const [error, setError] = useState<string | null>(null);
  const [forms, setForms] = useState({
    1: { name: "", description: "" },
    2: { name: "", description: "" },
  });
  const battleSectionRef = useRef<HTMLElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  useEffect(() => {
    const code = typeof params.roomCode === "string" ? params.roomCode : "";
    if (code) {
      setRoomCode(code.toUpperCase());
    }
  }, [params]);

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
  const canRevealOpponent = isSpectator || Boolean(battle);
  const slotClaimed = (slot: number) =>
    slotClaims.some((claim) => claim.slot === slot);

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
      const name = forms[slot].name || fallbackPlayer?.name || "";
      const description =
        forms[slot].description || fallbackPlayer?.description || "";
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
                  ? "生成完了"
                  : claimed
                    ? "入力中"
                    : "参加待ち";
                const showDetails = isMine || canRevealOpponent;
                return (
                  <div key={slot} className="glass rounded-3xl p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl">
                        プレイヤー {slot === 1 ? "A" : "B"}
                      </h3>
                      <span className="tag">{statusLabel}</span>
                    </div>
                    {player ? (
                      <div className="mt-4 space-y-3">
                        {showDetails ? (
                          <img
                            src={player.imageUrl}
                            alt={player.name}
                            className="h-72 w-full rounded-2xl object-contain bg-white/70"
                          />
                        ) : (
                          <div className="h-72 w-full rounded-2xl bg-white/70 text-sm text-neutral-500 flex items-center justify-center">
                            相手のキャラは非公開
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
                            <div className="mt-2 text-xs text-neutral-500">
                              絵柄：{player.styleLabel}
                            </div>
                          ) : null}
                        </div>
                        {isMine ? (
                          <button
                            className="btn-ghost w-full"
                            type="button"
                            disabled={loading}
                            onClick={() => submitPlayer(slot as 1 | 2, true)}
                          >
                            {loading ? "再生成中..." : "キャラ再生成"}
                          </button>
                        ) : null}
                      </div>
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
                          <img
                            src={loserPlayer.imageUrl}
                            alt={loserPlayer.name}
                            className="result-img"
                          />
                        </div>
                        <div className="result-name">{loserPlayer.name}</div>
                      </div>
                      <div className="result-card winner">
                        <div className="result-image">
                          <img
                            src={winnerPlayer.imageUrl}
                            alt={winnerPlayer.name}
                            className="result-img"
                          />
                        </div>
                        <div className="result-name">{winnerPlayer.name}</div>
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
                      {playerA ? (
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
                      {playerB ? (
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
                      {playerA && (canRevealOpponent || mySlot === 1) ? (
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
                      {playerB && (canRevealOpponent || mySlot === 2) ? (
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






















