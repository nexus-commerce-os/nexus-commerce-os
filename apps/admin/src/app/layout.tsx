import React from 'react';
import type { Metadata } from 'next';
import '@nexus/ui/styles.css';

export const metadata: Metadata = {
  title: 'NEXUS Admin — operator console',
  description: 'Internal operator console for NEXUS Commerce OS.',
  applicationName: 'NEXUS Admin',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
