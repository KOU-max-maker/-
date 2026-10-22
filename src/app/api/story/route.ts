import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { formatDateJa, isDateKey } from "@/lib/date";

const RequestSchema = z.object({
  date: z.string().refine(isDateKey, "日付が不正です"),
  transcript: z.string().trim().min(1, "話した内容が空です").max(20000),
  memo: z.string().max(2000).default(""),
  pronoun: z.string().trim().min(1).max(10).default("僕"),
  styleNote: z.string().max(500).default(""),
});

const StorySchema = z.object({
  title: z.string().describe("その日を表す短いタイトル（20文字以内が目安）"),
  story: z.string().describe("一人称の物語本文。段落は改行で区切る"),
});

const SYSTEM_PROMPT = `あなたは、ある人の日記を、本人の一人称で小説のように読める文章へ編集する編集者です。
本人がその夜に話した内容（音声の文字起こし）をもとに、その日の物語を書きます。

守ること:
- 本人の一人称（指定された一人称）で書く。
- 情景と感情が伝わる文章にするが、過剰に脚色しない。
- 話に出てこない出来事・人物・発言・場所・固有名詞を付け加えない。会話文は本人が実際に話した内容に基づく場合だけ書く。
- 本人の語り口や感情の温度を尊重する。楽しかった日は楽しく、平凡な日は平凡に。無理に感動的な結末や教訓を作らない。
- 情報が少ない日は短くてよい。文字起こしの量を大きく超えて膨らませない。
- 文字起こしの言い間違い・フィラー（えーと、あの）・重複は自然に整える。
- 本文は日本語の地の文。見出しや箇条書き、絵文字は使わない。段落は改行で区切る。`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json(
      { error: "サーバーにAIのAPIキーが設定されていません（ANTHROPIC_API_KEY）" },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "入力が不正です" }, { status: 400 });
  }
  const { date, transcript, memo, pronoun, styleNote } = parsed.data;

  const userContent = [
    `日付: ${formatDateJa(date)}`,
    `一人称: ${pronoun}`,
    styleNote && `文体の希望: ${styleNote}`,
    memo && `本人のメモ:\n${memo}`,
    `話した内容（文字起こし）:\n${transcript}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const client = new Anthropic();

  try {
    // 費用を抑えるため Haiku＋effort low。日記の編集なら深い思考は不要。
    const response = await client.messages.parse({
      model: "claude-haiku-5-5",
      max_tokens: 16000,
      output_config: { effort: "low", format: zodOutputFormat(StorySchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "この内容では文章を生成できませんでした" }, { status: 422 });
    }
    if (!response.parsed_output) {
      return Response.json({ error: "文章の生成に失敗しました。もう一度お試しください" }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "混み合っています。少し待ってから再試行してください" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return Response.json({ error: "AIに接続できませんでした。通信状況を確認してください" }, { status: 502 });
    }
    if (error instanceof Anthropic.APIError) {
      console.error("story generation failed", error.status, error.message);
      return Response.json({ error: "文章の生成に失敗しました。もう一度お試しください" }, { status: 502 });
    }
    throw error;
  }
}
