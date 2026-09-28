import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnvironmentLab } from "@/components/environment/environment-lab";

export const metadata: Metadata = { title: "Environment lab", robots: { index: false } };

/** Development-only preview of the marble environment with a debug panel. 404 in production builds. */
export default function EnvironmentLabPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <EnvironmentLab />;
}
