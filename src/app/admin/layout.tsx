import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin Console | B.Tech PaperVault",
    template: "%s | Admin | B.Tech PaperVault",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
