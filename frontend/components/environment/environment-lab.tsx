"use client";

import { useEffect, useMemo, useState } from "react";
import type { QualityTier } from "./config";
import type { EnvironmentHandle, EnvironmentSettings, ToneMappingName } from "./environment";
import { MarbleEnvironment } from "./marble-environment";

const DEFAULTS: EnvironmentSettings = {
  exposure: 1, toneMapping: "agx", sunAzimuth: 0, sunElevation: 0, wind: 1, sun: 1, ambient: 1, view: "scene",
};

function Slider({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="text-right tabular-nums">{value.toFixed(2)}</span>
    </label>
  );
}

/** Lab: the environment fullscreen, a debug panel, and hooks for automated screenshots (window.__marbleEnv). */
export function EnvironmentLab() {
  const params = useMemo(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search)), []);
  const [settings, setSettings] = useState<EnvironmentSettings>(() => ({
    ...DEFAULTS,
    ...(params?.get("exposure") ? { exposure: Number(params.get("exposure")) } : {}),
    ...(params?.get("tone") ? { toneMapping: params.get("tone") as ToneMappingName } : {}),
    ...(params?.get("sun") ? { sun: Number(params.get("sun")) } : {}),
    ...(params?.get("ambient") ? { ambient: Number(params.get("ambient")) } : {}),
    ...(params?.get("view") === "mask" ? { view: "mask" as const } : {}),
  }));
  const [tier, setTier] = useState<QualityTier>((params?.get("tier") as QualityTier) || "high");
  const [mounted, setMounted] = useState(true);
  const [panel, setPanel] = useState(params?.get("panel") !== "0");
  const [handle, setHandle] = useState<EnvironmentHandle | null>(null);
  const [status, setStatus] = useState("…");
  const [info, setInfo] = useState("");
  const startTime = params?.get("t") ? Number(params.get("t")) : undefined;

  useEffect(() => {
    const w = window as unknown as Record<string, unknown>;
    w.__marbleEnv = { handle, status, setMounted };
    if (!handle) return;
    const id = window.setInterval(() => {
      const i = handle.info();
      setInfo(`${i.tier} · ${i.fps} fps · t=${i.time.toFixed(1)}s · geo ${i.memory.geometries} · tex ${i.memory.textures} · prog ${i.programs} · leaves ${i.leaves}`);
    }, 500);
    return () => window.clearInterval(id);
  }, [handle, status]);

  const set = (patch: Partial<EnvironmentSettings>) => setSettings((s) => ({ ...s, ...patch }));

  return (
    <div className="fixed inset-0 bg-[#dcdad8]">
      {mounted && (
        <MarbleEnvironment
          key={tier}
          tier={tier}
          settings={settings}
          startTime={startTime}
          onHandle={setHandle}
          onStatus={setStatus}
        />
      )}
      {panel && (
        <div className="absolute right-3 top-3 w-80 space-y-2 rounded-lg bg-black/70 p-3 font-mono text-[11px] text-white backdrop-blur">
          <div className="flex items-center justify-between">
            <strong>Environment lab</strong>
            <button className="underline" onClick={() => setPanel(false)}>hide</button>
          </div>
          <div className="text-white/70">{status} {info && `· ${info}`}</div>
          <Slider label="Exposure" value={settings.exposure} min={0.3} max={2.5} step={0.01} onChange={(v) => set({ exposure: v })} />
          <Slider label="Sun azimuth" value={settings.sunAzimuth} min={-15} max={15} step={0.5} onChange={(v) => set({ sunAzimuth: v })} />
          <Slider label="Sun elevation" value={settings.sunElevation} min={-10} max={10} step={0.5} onChange={(v) => set({ sunElevation: v })} />
          <Slider label="Sun" value={settings.sun} min={0} max={3} step={0.01} onChange={(v) => set({ sun: v })} />
          <Slider label="Ambient" value={settings.ambient} min={0} max={3} step={0.01} onChange={(v) => set({ ambient: v })} />
          <Slider label="Wind" value={settings.wind} min={0} max={4} step={0.05} onChange={(v) => set({ wind: v })} />
          <label className="flex items-center justify-between">
            <span>Tone mapping</span>
            <select className="bg-black" value={settings.toneMapping} onChange={(e) => set({ toneMapping: e.target.value as ToneMappingName })}>
              <option value="agx">AgX</option>
              <option value="neutral">Khronos PBR Neutral</option>
              <option value="aces">ACES Filmic</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span>View</span>
            <select className="bg-black" value={settings.view} onChange={(e) => set({ view: e.target.value as EnvironmentSettings["view"] })}>
              <option value="scene">scene</option>
              <option value="mask">leaf mask</option>
            </select>
          </label>
          <label className="flex items-center justify-between">
            <span>Quality tier</span>
            <select className="bg-black" value={tier} onChange={(e) => setTier(e.target.value as QualityTier)}>
              <option value="high">high</option>
              <option value="medium">medium</option>
              <option value="poster">poster</option>
            </select>
          </label>
          <button className="w-full rounded bg-white/15 py-1" onClick={() => setMounted((m) => !m)}>
            {mounted ? "Unmount" : "Mount"} (disposal check)
          </button>
        </div>
      )}
    </div>
  );
}
