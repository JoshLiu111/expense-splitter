import { PageFrame } from "@/components/page-frame";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PageFrame>{children}</PageFrame>;
}
