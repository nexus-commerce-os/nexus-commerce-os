import React from "react";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEXUS Commerce OS — the buyer's side of shopping",
  description:
    "An AI buying agent that finds the genuinely best price across authorized merchants, hands you off to check out directly, and counts a saving only once it's verified. Ranking is by value — never by who pays us most.",
  applicationName: "NEXUS Commerce OS",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
