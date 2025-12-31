"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const PAGE_SIZE = 36;

type GalleryItem = {
  id: string;
  name: string;
  description: string;
  styleLabel: string;
  imageUrl: string;
  createdAt: string;
  roomCode: string | null;
};

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const loadItems = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const currentOffset = reset ? 0 : offset;
      const res = await fetch(
        `/api/gallery?limit=${PAGE_SIZE}&offset=${currentOffset}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load");
      }
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setOffset(currentOffset + PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems(true);
  }, []);

  return (
    <main className="min-h-screen px-5 py-10 md:px-16">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link className="text-sm text-neutral-600" href="/">
              ← 戻る
            </Link>
            <h1 className="mt-2 text-3xl">キャラクター図鑑</h1>
          </div>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => loadItems(true)}
          >
            最新を読み込み
          </button>
        </header>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="card-grid cols-3">
          {items.map((item) => (
            <div key={item.id} className="glass rounded-3xl p-4">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="h-56 w-full rounded-2xl object-contain bg-white/70"
              />
              <div className="mt-3">
                <div className="text-lg font-semibold">{item.name}</div>
                <div className="text-xs text-neutral-500">
                  絵柄：{item.styleLabel}
                </div>
                <p className="mt-2 text-xs text-neutral-600">
                  {item.description}
                </p>
                {item.roomCode ? (
                  <Link
                    href={`/room/${item.roomCode}`}
                    className="mt-3 inline-flex text-xs text-neutral-500 underline"
                  >
                    このルームを見る
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </section>

        <div className="flex justify-center">
          <button
            className="btn-primary"
            type="button"
            onClick={() => loadItems(false)}
            disabled={loading}
          >
            {loading ? "読み込み中..." : "さらに読み込む"}
          </button>
        </div>
      </div>
    </main>
  );
}
