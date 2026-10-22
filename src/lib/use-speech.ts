"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// Web Speech API の最小限の型（TypeScript の DOM 型に含まれないため）
type SpeechResult = { isFinal: boolean; 0: { transcript: string } };
type SpeechEvent = { resultIndex: number; results: ArrayLike<SpeechResult> };
type SpeechErrorEvent = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const noopSubscribe = () => () => {};

export type SpeechStatus = "idle" | "listening" | "unsupported";

/**
 * 端末の音声認識で日本語を文字起こしする。
 * iOS Safari は無音が続くと認識を自動終了するため、停止ボタンが押されるまで再開し続ける。
 * 確定した文は onFinal で呼び出し側に渡し、未確定の文は interim として表示用に返す。
 * 音声データ自体はアプリ側では保存しない。
 */
export function useSpeech(onFinal: (text: string) => void) {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => !!getCtor(),
    () => true,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef(false);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    return () => {
      wantRef.current = false;
      recRef.current?.abort();
    };
  }, []);

  const startSession = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let pending = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) onFinalRef.current(r[0].transcript);
        else pending += r[0].transcript;
      }
      setInterim(pending);
    };
    rec.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      wantRef.current = false;
      setError(
        e.error === "not-allowed" || e.error === "service-not-allowed"
          ? "マイクの使用が許可されていません。設定から許可してください"
          : "音声を認識できませんでした。もう一度お試しください",
      );
    };
    rec.onend = () => {
      setInterim("");
      if (wantRef.current) {
        try {
          rec.start();
          return;
        } catch {
          wantRef.current = false;
        }
      }
      recRef.current = null;
      setListening(false);
    };

    recRef.current = rec;
    rec.start();
    setListening(true);
  }, []);

  const start = useCallback(() => {
    if (recRef.current) return;
    setError(null);
    wantRef.current = true;
    try {
      startSession();
    } catch {
      wantRef.current = false;
      setError("録音を開始できませんでした");
    }
  }, [startSession]);

  const stop = useCallback(() => {
    wantRef.current = false;
    recRef.current?.stop();
  }, []);

  const status: SpeechStatus = !supported ? "unsupported" : listening ? "listening" : "idle";
  return { status, interim, error, start, stop };
}
