# 人生アルバム

自分の人生を一冊の物語に。夜に今日のことを話すと、AIが一人称の物語に編集し、写真1枚と思い出の曲と一緒に「1日1ページ」のアルバムに残る個人用Webアプリ（iPhone向け・モバイルファースト）。

## いまできること（要件定義書 v0.3 の実装順序 1〜3）

| ID | 機能 | 状態 |
|---|---|---|
| F01/F02 | 音声入力・日本語文字起こし | ✅ 端末の音声認識（Web Speech API, `ja-JP`）。非対応ブラウザでは手入力／キーボード音声入力 |
| F03 | AIストーリー生成 | ✅ `/api/story`（サーバー経由。事実を足さない・脚色しすぎない指示つき） |
| F04 | 文章編集 | ✅ タイトル・本文を自由に編集。再生成は明示操作のみ、生成前の文章に戻せる |
| F05 | 写真アップロード | ✅ 1日1枚。長辺1600pxのJPEGに縮小して保存 |
| F06 | 日付別保存 | ✅ 端末内（IndexedDB）。再起動後も残る |
| F07 | 横スワイプ閲覧 | ✅ 前日・翌日へ。本文だけ縦スクロール。未来日へはめくれない |
| F08 | 曲の紐づけ | 🟡 曲名・アーティストの手入力のみ（検索APIは規約確認後） |
| F09 | ページ連動の曲再生 | ⬜ 未着手 |
| F10 | 非公開アクセス | 🟡 暫定でBasic認証（`src/proxy.ts`）。データは端末内のみ |
| F11 | 編集・削除 | ✅ |

そのほか：下書きの自動保存（入力0.6秒後・画面を離れたとき。写真も含む）、一人称と文体の設定、PWAマニフェストとアイコン。

## 開発

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY を設定
npm run dev                  # http://localhost:3000
```

- 開発時（`npm run dev`）は Basic 認証の設定がなければ認証なしで動く。本番では `BASIC_AUTH_USER` / `BASIC_AUTH_PASSWORD` が未設定だと 503 を返す（記録やAI APIを誤って公開しないため）。
- iPhone実機で試すときは、マイクとPWAにHTTPSが必要。Vercelにデプロイするか、`next dev --experimental-https` を使う。

## 構成

```
src/app/page.tsx            アルバム（1日1ページ、表示日は #YYYY-MM-DD）
src/app/write/page.tsx      記録作成・編集（/write#YYYY-MM-DD）
src/app/settings/page.tsx   一人称・文体の設定
src/app/api/story/route.ts  文字起こし → 物語（Claude API、構造化出力で {title, story}）
src/components/Album.tsx    横スワイプ（Pointer Events + touch-action: pan-y）
src/components/Editor.tsx   録音・生成・写真・曲・保存・削除・下書き
src/lib/store.ts            保存層（IndexedDB）。Supabaseに置き換える境界
src/proxy.ts                暫定のBasic認証
```

## 設計メモ・次の一歩

- **文字起こし**：Claude は音声を直接受け付けないため、MVPは端末の音声認識を使う。音声は保存しない（要件8「生成後削除を推奨」に沿う）。iOS Safari は無音で認識が止まるので、停止を押すまで自動で再開する。精度が足りなければ、サーバー側の文字起こしAPIに差し替える。
- **保存先**：いまは端末のブラウザ内だけなので、機種変更・Safariのデータ消去で消える。実装順序4で Supabase（Auth＋RLS付きテーブル＋非公開Storage）へ移すとき、`src/lib/store.ts` の関数だけを置き換えればよい。
- **写真のトリミング**：いまは中央基準で自動の切り抜きのみ。
- **音楽**：検索結果に試聴URLが付くAPIもあるが、表示の条件や区間指定の可否を規約で確かめてから F08/F09 に進む。
