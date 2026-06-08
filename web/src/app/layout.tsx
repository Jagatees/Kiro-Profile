import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiro World Leaderboard",
  description: "A small leaderboard for Kiro Activity Insights profiles.",
  metadataBase: new URL("https://kiro-profile-leaderboard-brown.vercel.app"),
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Kiro World Leaderboard",
    description: "A small leaderboard for Kiro Activity Insights profiles.",
    url: "/",
    siteName: "Kiro World Leaderboard",
    images: [
      {
        url: "/kiro-leaderboard-og.png",
        width: 1254,
        height: 1254,
        alt: "Kiro Activity Insights leaderboard preview"
      }
    ],
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Kiro World Leaderboard",
    description: "A small leaderboard for Kiro Activity Insights profiles.",
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
