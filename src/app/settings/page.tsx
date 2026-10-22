"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSettings, saveSettings } from "@/lib/store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

const PRONOUNS = ["僕", "私", "俺", "自分", "うち", "わたし"];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .finally(() => setLoaded(true));
  }, []);

  const change = (patch: Partial<Settings>) => {
    setSaved(false);
    setSettings((s) => ({ ...s, ...patch }));
  };

  const save = async () => {
    await saveSettings({ ...settings, narrativePronoun: settings.narrativePronoun.trim() || "僕" });
    setSaved(true);
  };

  return (
    <main className="mx-auto min-h-dvh max-w-xl bg-paper px-4 pb-10">
      <header className="flex items-center justify-between py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/" className="py-2 pr-4 text-sm text-ink-soft">
          ← アルバム
        </Link>
        <h1 className="text-sm font-semibold">設定</h1>
        <span className="w-16" />
      </header>

      {loaded && (
        <>
          <section className="pt-4">
            <h2 className="font-serif text-lg font-semibold">物語の一人称</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRONOUNS.map((p) => (
                <button
                  key={p}
                  onClick={() => change({ narrativePronoun: p })}
                  className={`rounded-full border px-5 py-2 ${
                    settings.narrativePronoun === p ? "border-accent bg-accent text-white" : "border-line"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              value={settings.narrativePronoun}
              onChange={(e) => change({ narrativePronoun: e.target.value })}
              maxLength={10}
              placeholder="その他（自由入力）"
              className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3"
            />
          </section>

          <section className="pt-8">
            <h2 className="font-serif text-lg font-semibold">文体の希望（任意）</h2>
            <textarea
              value={settings.styleNote}
              onChange={(e) => change({ styleNote: e.target.value })}
              maxLength={500}
              rows={3}
              placeholder="例：短めに。関西弁の語り口を残してほしい。"
              className="mt-3 w-full rounded-xl border border-line bg-paper px-4 py-3"
            />
          </section>

          <button onClick={save} className="mt-8 w-full rounded-xl bg-accent py-4 font-semibold text-white active:opacity-80">
            {saved ? "保存しました" : "保存"}
          </button>

          <section className="mt-10 rounded-xl bg-paper-deep p-4 text-sm leading-relaxed text-ink-soft">
            <h2 className="font-semibold text-ink">データの扱い</h2>
            <p className="mt-2">
              記録と写真はこの端末のブラウザ内にだけ保存されます。AIで物語を作るときだけ、文字起こしとメモが文章生成のためにサーバー経由でAIに送られます。音声そのものは保存しません。
            </p>
          </section>
        </>
      )}
    </main>
  );
}
