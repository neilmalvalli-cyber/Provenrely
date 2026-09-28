import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Sets KEY=value lines in a dotenv file without touching (or ever printing) any other line.
 * Existing keys are replaced in place; missing keys are appended. Creates the file (optionally from a
 * template) when it doesn't exist. Returns the keys it wrote.
 */
export function updateEnvFile(path: string, values: Record<string, string>, templatePath?: string): string[] {
  const original = existsSync(path) ? readFileSync(path, "utf8") : templatePath && existsSync(templatePath) ? readFileSync(templatePath, "utf8") : "";
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  const lines = original.length ? original.split(/\r?\n/) : [];
  const pending = new Map(Object.entries(values));

  const out = lines.map((line) => {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (!m || !pending.has(m[1]!)) return line;
    const key = m[1]!;
    const value = pending.get(key)!;
    pending.delete(key);
    return `${key}=${value}`;
  });
  if (pending.size) {
    if (out.length && out[out.length - 1] !== "") out.push("");
    for (const [k, v] of pending) out.push(`${k}=${v}`);
  }
  let text = out.join(eol);
  if (!text.endsWith(eol)) text += eol;
  writeFileSync(path, text);
  return Object.keys(values);
}

/** Replaces the text between two HTML comment markers in a file. Returns false if the markers are missing. */
export function replaceBetweenMarkers(path: string, start: string, end: string, body: string): boolean {
  const text = readFileSync(path, "utf8");
  const i = text.indexOf(start);
  const j = text.indexOf(end);
  if (i < 0 || j < i) return false;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(path, text.slice(0, i + start.length) + eol + body.replace(/\n/g, eol) + eol + text.slice(j));
  return true;
}
