import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiro Stat Leaderboard",
  description: "Global rankings for Kiro Stat profiles: tokens, credits, streaks, sessions, and active days.",
  metadataBase: new URL("https://kiro-profile-leaderboard-brown.vercel.app"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Kiro Stat Leaderboard",
    description: "Global rankings for Kiro Stat profiles: tokens, credits, streaks, sessions, and active days.",
    url: "/",
    siteName: "Kiro Stat Leaderboard",
    images: [
      {
        url: "/kiro-leaderboard-og.png",
        width: 1254,
        height: 1254,
        alt: "Kiro Stat leaderboard preview"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Kiro Stat Leaderboard",
    description: "Global rankings for Kiro Stat profiles: tokens, credits, streaks, sessions, and active days.",
    images: ["/kiro-leaderboard-og.png"]
  },
  icons: {
    icon: "/kiro-icon.png",
    apple: "/kiro-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
