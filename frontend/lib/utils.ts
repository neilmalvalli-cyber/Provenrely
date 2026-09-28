import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 0x71C7656E…8976F style shortening for addresses and hashes. */
export function shortHash(value: string, head = 6, tail = 4) {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

export function formatUtc(iso: string) {
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** Deterministic pseudo-hash so mock data stays stable between renders. */
export function mockHash(seed: string, bytes = 32) {
  // FNV-1a over the whole seed, then xorshift32 to stream bytes.
  let s = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
  let out = "";
  while (out.length < bytes * 2) {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    out += (s & 0xff).toString(16).padStart(2, "0");
  }
  return `0x${out}`;
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
