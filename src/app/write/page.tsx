import type { Metadata } from "next";
import { Editor } from "@/components/Editor";

export const metadata: Metadata = { title: "今日を残す｜人生アルバム" };

export default function WritePage() {
  return <Editor />;
}
