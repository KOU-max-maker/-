"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateJa } from "@/lib/date";
import { invalidateDay } from "@/lib/day-cache";
import { compressImage } from "@/lib/image";
import {
  clearDraft,
  deleteEntry,
  getDraft,
  getEntry,
  getPhoto,
  getSettings,
  saveDraft,
  saveEntry,
} from "@/lib/store";
import { DEFAULT_SETTINGS, type Draft, type Settings, type Song } from "@/lib/types";
import { useHashDate } from "@/lib/use-hash-date";
import { useSpeech } from "@/lib/use-speech";

type Fields = {
  transcript: string;
  memo: string;
  title: string;
  story: string;
  photo: Blob | null;
  songTitle: string;
  songArtist: string;
};

const EMPTY: Fields = { transcript: "", memo: "", title: "", story: "", photo: null, songTitle: "", songArtist: "" };

function toSong(f: Fields): Song | undefined {
  const title = f.songTitle.trim();
  return title ? { provider: "manual", title, artist: f.songArtist.trim() } : undefined;
}

export function Editor() {
  const router = useRouter();
  const date = useHashDate();
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [hasEntry, setHasEntry] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [genState, setGenState] = useState<"idle" | "loading" | "error">("idle");
  const [genError, setGenError] = useState("");
  const [previousStory, setPreviousStory] = useState<{ title: string; story: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const dirty = useRef(false);
  const fieldsRef = useRef(fields);

  useEffect(() => {
    fieldsRef.current = fields;
  }, [fields]);

  const update = useCallback((patch: Partial<Fields>) => {
    dirty.current = true;
    setFields((f) => ({ ...f, ...patch }));
  }, []);

  // 初期読み込み：下書きがあれば下書き、なければ保存済みの記録
  useEffect(() => {
    if (!date) return;
    const d = date;
    dirty.current = false;
    (async () => {
      const [draft, entry, s] = await Promise.all([getDraft(d), getEntry(d), getSettings()]);
      setSettings(s);
      setHasEntry(!!entry);
      if (draft) {
        setFields({
          transcript: draft.transcript,
          memo: draft.memo,
          title: draft.title,
          story: draft.story,
          photo: draft.photo ?? null,
          songTitle: draft.song?.title ?? "",
          songArtist: draft.song?.artist ?? "",
        });
        setNotice("保存前の下書きを復元しました");
      } else if (entry) {
        const photo = entry.hasPhoto ? ((await getPhoto(d)) ?? null) : null;
        setFields({
          transcript: entry.transcript,
          memo: "",
          title: entry.title,
          story: entry.story,
          photo,
          songTitle: entry.song?.title ?? "",
          songArtist: entry.song?.artist ?? "",
        });
      }
    })().catch(() => setNotice("読み込みに失敗しました"));
  }, [date]);

  // 写真のプレビューURL
  useEffect(() => {
    if (!fields.photo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Object URL の生成と破棄を写真に同期させる
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(fields.photo);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fields.photo]);

  // 下書きの自動保存（入力が止まって0.6秒後、画面を離れるとき）
  const flushDraft = useCallback(async () => {
    if (!date || !dirty.current) return;
    const f = fieldsRef.current;
    const draft: Draft = {
      transcript: f.transcript,
      memo: f.memo,
      title: f.title,
      story: f.story,
      photo: f.photo,
      song: toSong(f),
      savedAt: new Date().toISOString(),
    };
    await saveDraft(date, draft);
  }, [date]);

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(() => void flushDraft(), 600);
    return () => clearTimeout(timer);
  }, [fields, flushDraft]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushDraft();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [flushDraft]);

  // 音声入力：確定した文を文字起こし欄の末尾に足していく
  const appendTranscript = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      dirty.current = true;
      setFields((f) => ({ ...f, transcript: f.transcript ? `${f.transcript}${t}` : t }));
    },
    [],
  );
  const speech = useSpeech(appendTranscript);
  const listening = speech.status === "listening";

  const generate = async () => {
    if (!date || !fields.transcript.trim()) return;
    if (fields.story.trim() && !confirm("今の本文を、新しく生成した文章で置き換えます。よろしいですか？")) return;
    if (listening) speech.stop();
    setGenState("loading");
    setGenError("");
    try {
      const res = await fetch("/api/story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          transcript: fields.transcript,
          memo: fields.memo,
          pronoun: settings.narrativePronoun,
          styleNote: settings.styleNote,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { title?: string; story?: string; error?: string };
      if (!res.ok || !body.story) throw new Error(body.error ?? "文章の生成に失敗しました");
      setPreviousStory(fields.story.trim() ? { title: fields.title, story: fields.story } : null);
      update({ story: body.story, title: fields.title.trim() ? fields.title : (body.title ?? "") });
      setGenState("idle");
    } catch (e) {
      setGenError(e instanceof Error && e.message !== "Failed to fetch" ? e.message : "通信に失敗しました");
      setGenState("error");
    }
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      update({ photo: await compressImage(file) });
    } catch {
      setNotice("この画像は読み込めませんでした。別の写真を選んでください");
    }
  };

  const canSave = !!(fields.story.trim() || fields.title.trim() || fields.photo);

  const save = async () => {
    if (!date || !canSave || saving) return;
    setSaving(true);
    try {
      await saveEntry(
        {
          entryDate: date,
          title: fields.title.trim(),
          transcript: fields.transcript,
          story: fields.story,
          song: toSong(fields),
        },
        fields.photo,
      );
      dirty.current = false;
      await clearDraft(date);
      invalidateDay(date);
      router.push(`/#${date}`);
    } catch {
      setNotice("保存に失敗しました。内容は下書きに残っています");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!date || !confirm(`${formatDateJa(date)}の記録を削除します。元に戻せません。`)) return;
    dirty.current = false;
    await deleteEntry(date);
    invalidateDay(date);
    router.push(`/#${date}`);
  };

  const discardDraft = async () => {
    if (!date || !confirm("下書きを破棄して、保存済みの内容に戻しますか？")) return;
    dirty.current = false;
    await clearDraft(date);
    location.reload();
  };

  if (!date) return <div className="min-h-dvh bg-paper" />;

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-paper pb-[calc(6rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md">
        <Link href={`/#${date}`} className="py-2 pr-4 text-sm text-ink-soft">
          ← アルバム
        </Link>
        <h1 className="text-sm font-semibold">{formatDateJa(date)}</h1>
        <span className="w-16" />
      </header>

      {notice && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-xl bg-paper-deep px-4 py-3 text-sm">
          <p className="flex-1">{notice}</p>
          {notice.startsWith("保存前の下書き") && hasEntry && (
            <button onClick={discardDraft} className="shrink-0 text-accent underline">
              破棄
            </button>
          )}
          <button onClick={() => setNotice(null)} aria-label="閉じる" className="shrink-0 text-ink-soft">
            ×
          </button>
        </div>
      )}

      {/* 1. 話す */}
      <section className="px-4 pt-6">
        <h2 className={sectionTitle}>今日のことを話す</h2>
        <p className="mt-1 text-sm text-ink-soft">出来事、会った人、感じたこと、幸せだった瞬間などを自由に。</p>

        <div className="mt-5 flex flex-col items-center gap-3">
          {speech.status === "unsupported" ? (
            <p className="rounded-xl bg-paper-deep p-4 text-sm text-ink-soft">
              このブラウザは音声認識に対応していません。下の欄に入力するか、キーボードのマイク（音声入力）を使ってください。
            </p>
          ) : (
            <>
              <button
                onClick={listening ? speech.stop : speech.start}
                aria-label={listening ? "録音を止める" : "録音を始める"}
                className={`flex h-24 w-24 items-center justify-center rounded-full shadow-md transition active:scale-95 ${
                  listening ? "bg-accent text-white" : "bg-ink text-paper"
                }`}
              >
                {listening ? (
                  <span className="h-8 w-8 rounded-md bg-white" />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-2.08A7 7 0 0 0 19 12h-2Z" />
                  </svg>
                )}
              </button>
              <p className="text-sm text-ink-soft" aria-live="polite">
                {listening ? "聞いています… 話し終えたら停止" : fields.transcript ? "続けて話すこともできます" : "タップして話し始める"}
              </p>
            </>
          )}
          {speech.error && <p className="text-sm text-accent">{speech.error}</p>}
        </div>

        <label className="mt-5 block">
          <span className="flex items-center justify-between text-xs text-ink-soft">
            <span>文字起こし（直接編集できます）</span>
            {fields.transcript && !listening && (
              <button
                onClick={() => confirm("文字起こしを消して、話し直しますか？") && update({ transcript: "" })}
                className="text-accent"
              >
                話し直す
              </button>
            )}
          </span>
          <textarea
            value={fields.transcript + (speech.interim ? speech.interim : "")}
            onChange={(e) => update({ transcript: e.target.value })}
            readOnly={listening}
            rows={6}
            placeholder="ここに話した内容が入ります"
            className={`${input} mt-1`}
          />
        </label>

        <label className="mt-3 block">
          <span className="text-xs text-ink-soft">メモ（任意・AIへの補足）</span>
          <input
            value={fields.memo}
            onChange={(e) => update({ memo: e.target.value })}
            placeholder="例：友達の名前は「ゆうき」"
            className={`${input} mt-1`}
          />
        </label>
      </section>

      {/* 2. 物語にする */}
      <section className="px-4 pt-8">
        <h2 className={sectionTitle}>物語にする</h2>
        <button
          onClick={generate}
          disabled={!fields.transcript.trim() || genState === "loading"}
          className="mt-3 w-full rounded-xl bg-ink py-4 font-semibold text-paper active:opacity-80 disabled:opacity-40"
        >
          {genState === "loading" ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-t-transparent" />
              物語を綴っています…
            </span>
          ) : fields.story.trim() ? (
            "AIで書き直す"
          ) : (
            `AIで「${settings.narrativePronoun}」の物語にする`
          )}
        </button>
        {genState === "error" && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-paper-deep px-4 py-3 text-sm">
            <span className="text-accent">{genError}</span>
            <button onClick={generate} className="font-semibold underline">
              再試行
            </button>
          </div>
        )}
        {previousStory && (
          <button
            onClick={() => {
              update(previousStory);
              setPreviousStory(null);
            }}
            className="mt-2 text-sm text-ink-soft underline"
          >
            生成前の文章に戻す
          </button>
        )}

        <label className="mt-4 block">
          <span className="text-xs text-ink-soft">タイトル（任意）</span>
          <input
            value={fields.title}
            onChange={(e) => update({ title: e.target.value })}
            className={`${input} mt-1 font-serif text-lg`}
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs text-ink-soft">本文（自由に直せます）</span>
          <textarea
            value={fields.story}
            onChange={(e) => update({ story: e.target.value })}
            rows={10}
            placeholder="生成された物語がここに入ります。自分で書いても構いません。"
            className={`${input} mt-1 font-serif leading-loose`}
          />
        </label>
      </section>

      {/* 3. 写真 */}
      <section className="px-4 pt-8">
        <h2 className={sectionTitle}>今日の一枚</h2>
        <div className="mt-3 overflow-hidden rounded-xl bg-paper-deep">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 端末内Blobのプレビュー
            <img src={photoUrl} alt="選んだ写真" className="aspect-[4/3] w-full object-cover" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center text-sm text-ink-soft">写真はまだありません</div>
          )}
        </div>
        <div className="mt-3 flex gap-3">
          <label className="flex-1 cursor-pointer rounded-xl border border-line py-3 text-center text-sm active:bg-paper-deep">
            {photoUrl ? "写真を差し替える" : "写真を選ぶ"}
            <input type="file" accept="image/*" onChange={onPickPhoto} className="sr-only" />
          </label>
          {photoUrl && (
            <button onClick={() => update({ photo: null })} className="rounded-xl border border-line px-4 text-sm text-ink-soft">
              外す
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-ink-soft">アルバムでは上半分いっぱいに表示されます（中央を基準に切り抜き）。</p>
      </section>

      {/* 4. 曲 */}
      <section className="px-4 pt-8">
        <h2 className={sectionTitle}>思い出の曲（任意）</h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input
            value={fields.songTitle}
            onChange={(e) => update({ songTitle: e.target.value })}
            placeholder="曲名"
            className={input}
          />
          <input
            value={fields.songArtist}
            onChange={(e) => update({ songArtist: e.target.value })}
            placeholder="アーティスト"
            className={input}
          />
        </div>
        <p className="mt-2 text-xs text-ink-soft">曲の検索と再生は、配信サービスの利用条件を確認してから対応します。</p>
      </section>

      {hasEntry && (
        <section className="px-4 pt-10">
          <button onClick={remove} className="w-full rounded-xl py-3 text-sm text-accent active:bg-paper-deep">
            この日の記録を削除
          </button>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto max-w-xl">
          <button
            onClick={save}
            disabled={!canSave || saving || genState === "loading"}
            className="w-full rounded-xl bg-accent py-4 font-semibold text-white active:opacity-80 disabled:opacity-40"
          >
            {saving ? "保存しています…" : "アルバムに保存"}
          </button>
        </div>
      </div>
    </main>
  );
}

const sectionTitle = "font-serif text-lg font-semibold";
const input =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-ink-soft/60 focus:border-accent focus:outline-none";
