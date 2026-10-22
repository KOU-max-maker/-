import { ImageResponse } from "next/og";

/** 本の形をした簡素なアプリアイコン（文字を使わずフォント取得を不要にする）。 */
export function renderIcon(size: number) {
  const u = size / 32;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f6f1e7",
        }}
      >
        <div style={{ display: "flex", width: 22 * u, height: 16 * u }}>
          <div style={{ flex: 1, background: "#b5562f", borderRadius: `${2 * u}px 0 0 ${2 * u}px` }} />
          <div style={{ width: 1.5 * u, background: "#2b2620" }} />
          <div style={{ flex: 1, background: "#d98a5f", borderRadius: `0 ${2 * u}px ${2 * u}px 0` }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
