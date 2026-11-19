import { GuestSignUpPrompt } from "@/components/guest-sign-up-prompt";
import { PageFrame } from "@/components/page-frame";

export default function GuestLayout({ children }: LayoutProps<"/guest">) {
  return (
    <>
      <GuestSignUpPrompt />
      <PageFrame>{children}</PageFrame>
    </>
  );
}
