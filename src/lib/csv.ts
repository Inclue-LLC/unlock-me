export function toCsv(header: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: unknown) => {
    let s = v === null || v === undefined ? "" : String(v);
    // CSVインジェクション対策
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // Excelで文字化けしないようBOM付きUTF-8
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(",")).join("\r\n") + "\r\n";
}
