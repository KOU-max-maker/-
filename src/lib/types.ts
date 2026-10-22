/** 曲のメタデータ。MVPでは保存と表示のみ（再生は正規の試聴音源が確認できてから）。 */
export type Song = {
  provider: "manual";
  title: string;
  artist: string;
  /** 再生区間の開始秒。正規APIで区間指定が許される場合のみ使う。 */
  segmentStartSeconds?: number;
};

/** 1日1ページの記録。entryDate (YYYY-MM-DD) が一意キー。 */
export type Entry = {
  entryDate: string;
  title: string;
  transcript: string;
  story: string;
  /** 写真は Blob として別キーに保存し、ここには有無だけ持つ。 */
  hasPhoto: boolean;
  song?: Song;
  createdAt: string;
  updatedAt: string;
};

/** 作成途中の下書き。写真も含めて丸ごと保持する。 */
export type Draft = {
  title: string;
  transcript: string;
  memo: string;
  story: string;
  photo?: Blob | null;
  song?: Song;
  savedAt: string;
};

export type Settings = {
  /** 物語の一人称（僕・私・俺 など） */
  narrativePronoun: string;
  /** 文体の希望（自由記述） */
  styleNote: string;
};

export const DEFAULT_SETTINGS: Settings = {
  narrativePronoun: "僕",
  styleNote: "",
};
