"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_LIMITS } from "@/lib/constants";

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    roomName: "",
    password: "",
    charLimit: DEFAULT_LIMITS.charLimit,
    storyMin: DEFAULT_LIMITS.storyMin,
    storyMax: DEFAULT_LIMITS.storyMax,
  });

  const [joinForm, setJoinForm] = useState({
    roomCode: "",
    password: "",
  });

  const handleCreate = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rooms/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Room create failed");
      }
      router.push(`/room/${data.roomCode}`);
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomCode: joinForm.roomCode.trim().toUpperCase(),
          password: joinForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Room join failed");
      }
      router.push(`/room/${data.room.code}`);
    } catch (err: any) {
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-5 py-10 md:px-16">
      <section className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <span className="tag">描写バトル</span>
            <h1 className="text-4xl md:text-5xl">描写で生まれたモンスターが戦う。</h1>
            <p className="text-base text-neutral-700 md:text-lg">
              2人で名前と短い描写を入力 → 画像生成 → 画像だけで勝敗判定。
              小学生も見られる、やさしいバトル体験をつくろう。
            </p>
          </div>
          <div className="glass w-full rounded-3xl p-6 md:w-80">
            <div className="flex gap-2">
              <button
                className={`flex-1 rounded-full px-4 py-2 text-sm ${
                  mode === "create"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300"
                }`}
                onClick={() => setMode("create")}
                type="button"
              >
                ルーム作成
              </button>
              <button
                className={`flex-1 rounded-full px-4 py-2 text-sm ${
                  mode === "join"
                    ? "bg-neutral-900 text-white"
                    : "border border-neutral-300"
                }`}
                onClick={() => setMode("join")}
                type="button"
              >
                参加
              </button>
            </div>
            <div className="mt-5 space-y-4">
              {mode === "create" ? (
                <>
                  <label className="block text-sm">
                    ルーム名（任意）
                    <input
                      value={createForm.roomName}
                      onChange={(event) =>
                        setCreateForm({
                          ...createForm,
                          roomName: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                      placeholder="たとえば：森の奥バトル"
                    />
                  </label>
                  <label className="block text-sm">
                    パスワード
                    <input
                      type="password"
                      value={createForm.password}
                      onChange={(event) =>
                        setCreateForm({
                          ...createForm,
                          password: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                      placeholder="4文字以上"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block text-sm">
                      描写文字数上限
                      <input
                        type="number"
                        min={10}
                        max={80}
                        value={createForm.charLimit}
                        onChange={(event) =>
                          setCreateForm({
                            ...createForm,
                            charLimit: Number(event.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm">
                      物語文字数（最小）
                      <input
                        type="number"
                        min={200}
                        max={6000}
                        value={createForm.storyMin}
                        onChange={(event) =>
                          setCreateForm({
                            ...createForm,
                            storyMin: Number(event.target.value),
                          })
                        }
                        className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                      />
                    </label>
                  </div>
                  <label className="block text-sm">
                    物語文字数（最大）
                    <input
                      type="number"
                      min={createForm.storyMin}
                      max={6000}
                      value={createForm.storyMax}
                      onChange={(event) =>
                        setCreateForm({
                          ...createForm,
                          storyMax: Number(event.target.value),
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <button
                    className="btn-primary w-full"
                    type="button"
                    disabled={loading}
                    onClick={handleCreate}
                  >
                    {loading ? "作成中..." : "ルームを作成"}
                  </button>
                </>
              ) : (
                <>
                  <label className="block text-sm">
                    ルームコード
                    <input
                      value={joinForm.roomCode}
                      onChange={(event) =>
                        setJoinForm({
                          ...joinForm,
                          roomCode: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2 uppercase"
                      placeholder="例: A8K2QM"
                    />
                  </label>
                  <label className="block text-sm">
                    パスワード
                    <input
                      type="password"
                      value={joinForm.password}
                      onChange={(event) =>
                        setJoinForm({
                          ...joinForm,
                          password: event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-neutral-300 px-3 py-2"
                    />
                  </label>
                  <button
                    className="btn-primary w-full"
                    type="button"
                    disabled={loading}
                    onClick={handleJoin}
                  >
                    {loading ? "入室中..." : "ルームに入る"}
                  </button>
                </>
              )}
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-12 card-grid cols-2">
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl">進め方</h2>
            <ol className="mt-4 space-y-3 text-sm text-neutral-700">
              <li>1. ルームを作成し、相手にURLとパスを共有</li>
              <li>2. 各プレイヤーが名前と短い描写を入力</li>
              <li>3. 画像生成 → 画像だけで勝敗を判定</li>
              <li>4. 勝者と物語、バトル画像が完成</li>
            </ol>
          </div>
          <div className="glass rounded-3xl p-6">
            <h2 className="text-2xl">図鑑を見る</h2>
            <p className="mt-3 text-sm text-neutral-700">
              これまで生まれたキャラクターを一覧で眺めよう。
            </p>
            <Link className="btn-ghost mt-6 inline-flex" href="/gallery">
              図鑑へ
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
