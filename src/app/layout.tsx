import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Korean Dictation Lab",
  description: "Luyen nghe chep chinh ta tieng Han voi luu tru database va Google login",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
