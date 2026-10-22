"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { addDays, dateFromHash, todayKey } from "@/lib/date";
import { DayPage } from "./DayPage";

const TURN_MS = 280;
/** 画面幅に対するこの割合以上ドラッグしたらページをめくる */
const TURN_RATIO = 0.22;
/** これ以上の速さ(px/ms)で払ったら距離が短くてもめくる */
const FLICK_VELOCITY = 0.45;

type Drag = { id: number; x: number; y: number; t: number; axis: "x" | "y" | null };

export function Album() {
  const [date, setDate] = useState<string | null>(null);
  const [today, setToday] = useState<string>("");
  const [offset, setOffset] = useState(0);
  const [phase, setPhase] = useState<"idle" | "drag" | "settle">("idle");
  const pendingDir = useRef(0);
  const drag = useRef<Drag | null>(null);
  const viewport = useRef<HTMLDivElement>(null);

  // 表示日は URL ハッシュ（#2026-10-22）で持つ。ブラウザの戻る・リロードでも同じページに戻れる。
  useEffect(() => {
    const sync = () => {
      setToday(todayKey());
      setDate(dateFromHash(location.hash) ?? todayKey());
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (date) history.replaceState(null, "", `#${date}`);
  }, [date]);

  const canGo = useCallback((dir: number) => !!date && (dir < 0 || date < today), [date, today]);

  const turn = useCallback(
    (dir: number) => {
      if (phase === "settle" || !canGo(dir)) return;
      const width = viewport.current?.clientWidth ?? window.innerWidth;
      pendingDir.current = dir;
      setPhase("settle");
      setOffset(-dir * width);
    },
    [phase, canGo],
  );

  const finishTurn = useCallback(() => {
    const dir = pendingDir.current;
    pendingDir.current = 0;
    // 日付の切替とオフセットの戻しを同じ描画で行い、ちらつきを防ぐ
    if (dir !== 0) setDate((d) => (d ? addDays(d, dir) : d));
    setOffset(0);
    setPhase("idle");
  }, []);

  const onTransitionEnd = (e: React.TransitionEvent) => {
    if (e.target === e.currentTarget && phase === "settle") finishTurn();
  };

  // transitionend が来ない場合（移動量ゼロ、タブ非表示など）でも必ず確定させる
  useEffect(() => {
    if (phase !== "settle") return;
    const timer = setTimeout(finishTurn, TURN_MS + 120);
    return () => clearTimeout(timer);
  }, [phase, finishTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") turn(-1);
      if (e.key === "ArrowRight") turn(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (phase === "settle" || (e.pointerType === "mouse" && e.button !== 0)) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "x") {
        e.currentTarget.setPointerCapture(e.pointerId);
        setPhase("drag");
      }
    }
    if (d.axis !== "x") return;
    // 進めない方向（未来・未読み込み）はゴムのように抵抗をかける
    const blocked = (dx < 0 && !canGo(1)) || (dx > 0 && !canGo(-1));
    setOffset(blocked ? dx / 4 : dx);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (d.axis !== "x") return;

    const dx = e.clientX - d.x;
    const width = viewport.current?.clientWidth ?? window.innerWidth;
    const velocity = dx / Math.max(1, performance.now() - d.t);
    const dir =
      dx < -width * TURN_RATIO || velocity < -FLICK_VELOCITY
        ? 1
        : dx > width * TURN_RATIO || velocity > FLICK_VELOCITY
          ? -1
          : 0;

    if (dir !== 0 && canGo(dir)) {
      pendingDir.current = dir;
      setPhase("settle");
      setOffset(-dir * width);
    } else if (offset !== 0) {
      pendingDir.current = 0;
      setPhase("settle");
      setOffset(0);
    } else {
      setPhase("idle");
    }
  };

  if (!date) return <div className="h-dvh bg-paper" />;

  const pages = [addDays(date, -1), date, addDays(date, 1)];

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-paper">
      <div
        ref={viewport}
        className="h-full w-full touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translate3d(calc(-100% + ${offset}px), 0, 0)`,
            transition: phase === "settle" ? `transform ${TURN_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)` : "none",
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {pages.map((d) => (
            <div key={d} className="h-full w-full shrink-0">
              <DayPage date={d} isFuture={d > today} />
            </div>
          ))}
        </div>
      </div>

      <nav className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto flex gap-2">
          {date !== today && (
            <button onClick={() => setDate(today)} className={chip}>
              今日へ
            </button>
          )}
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Link href="/settings" className={chip} aria-label="設定">
            設定
          </Link>
          {date === today && (
            <Link href={`/write#${today}`} className={`${chip} !bg-accent !text-white`}>
              今日を残す
            </Link>
          )}
        </div>
      </nav>
    </main>
  );
}

const chip =
  "rounded-full bg-paper/80 px-4 py-2 text-sm text-ink shadow-sm backdrop-blur-md active:opacity-70 dark:bg-paper/70";
