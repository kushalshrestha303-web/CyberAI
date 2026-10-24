import type { Metadata } from 'next';
import './globals.css';
import '@xyflow/react/dist/style.css';
export const metadata: Metadata = {
  title: 'CYBER AI · Living threat intelligence',
  description:
    'Learn cybersecurity by watching it work. Evidence-driven intelligence, replayable investigation and safe automation.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
