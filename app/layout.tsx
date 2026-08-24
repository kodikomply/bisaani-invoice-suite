import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Bisaani Invoice Suite", description: "Professional logistics invoicing for Bisaani Logistics Company Limited", icons: { icon: "/favicon.svg" } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
