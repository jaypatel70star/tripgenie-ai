import type { Metadata } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "TripGenie AI — 3D Travel Expedition Studio",
  description:
    "AI-powered travel planning chatbot with an interactive 3D WebGL globe, 3D sky scene, live weather, street maps, multi-language support, and itemized ₹ expense tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased selection:bg-amber-400/30 selection:text-amber-100">
        <div className="aurora-bg" aria-hidden="true">
          <div className="aurora-orb absolute -top-24 left-1/5 h-[28rem] w-[28rem] rounded-full bg-teal-400/12 blur-3xl" />
          <div className="aurora-orb absolute top-1/4 right-1/6 h-[24rem] w-[24rem] rounded-full bg-amber-400/12 blur-3xl" />
          <div className="aurora-orb absolute bottom-0 left-1/2 h-[22rem] w-[22rem] rounded-full bg-rose-400/10 blur-3xl" />
        </div>
        {children}
      </body>
    </html>
  );
}
