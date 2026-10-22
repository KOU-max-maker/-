"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateJa } from "@/lib/date";
import { loadDay, type DayData } from "@/lib/day-cache";

type Props = { date: string; isFuture: boolean };

export function DayPage({ date, isFuture }: Props) {
  const [data, setData] = useState<{ date: string; day: DayData } | null>(null);

  useEffect(() => {
    let alive = true;
    loadDay(date)
      .then((day) => alive && setData({ date, day }))
      .catch(() => alive && setData({ date, day: {} }));
    return () => {
      alive = false;
    };
  }, [date]);

  const loading = data?.date !== date;
  const entry = loading ? undefined : data.day.entry;
  const photoUrl = loading ? undefined : data.day.photoUrl;

  return (
    <article className="flex h-full w-full shrink-0 flex-col overflow-hidden bg-paper">
      {/* 上半分：写真 */}
      <div className="relative h-[50%] w-full shrink-0 overflow-hidden bg-paper-deep">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 端末内Blobのため next/image は使えない
          <img src={photoUrl} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-ink-soft/50">
            {!loading && !entry && <PhotoPlaceholder />}
          </div>
        )}
      </div>

      {/* 下半分：日付・タイトル・物語 */}
      <div className="flex min-h-0 flex-1 flex-col px-6 pt-5">
        <p className="text-xs tracking-widest text-ink-soft">{formatDateJa(date)}</p>

        {loading ? null : entry ? (
          <>
            {entry.title && <h2 className="mt-1 font-serif text-xl font-semibold leading-snug">{entry.title}</h2>}
            {/* 長文時はこの領域だけ縦スクロール。横スワイプは親が担当する */}
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
              <p className="whitespace-pre-wrap font-serif text-[17px] leading-[2] tracking-wide">{entry.story}</p>
            </div>
            <footer className="flex items-center gap-3 border-t border-line py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">
                {entry.song ? (
                  <>
                    <span aria-hidden>♪ </span>
                    {entry.song.title}
                    {entry.song.artist && <span className="opacity-70"> — {entry.song.artist}</span>}
                  </>
                ) : null}
              </p>
              <Link
                href={`/write#${date}`}
                className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft active:bg-paper-deep"
              >
                編集
              </Link>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
            {isFuture ? (
              <p className="font-serif text-ink-soft">まだ来ていない日です</p>
            ) : (
              <>
                <p className="font-serif text-ink-soft">この日の記録はまだありません</p>
                <Link
                  href={`/write#${date}`}
                  className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm active:opacity-80"
                >
                  この日の思い出を残す
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function PhotoPlaceholder() {
  return (
    <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M21 16l-5-5-8 8" />
    </svg>
  );
}
