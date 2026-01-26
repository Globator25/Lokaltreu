import type { Metadata } from "next";
import { PwaShell } from "./PwaShell";

type PwaLayoutProps = {
  children: React.ReactNode;
};

export const metadata: Metadata = {
  manifest: "/pwa/manifest.webmanifest",
};

export default function PwaLayout({ children }: PwaLayoutProps) {
  return <PwaShell>{children}</PwaShell>;
}
