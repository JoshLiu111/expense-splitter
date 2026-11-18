import { GuestSignUpPrompt } from "@/components/guest-sign-up-prompt";

export default function GuestLayout({ children }: LayoutProps<"/guest">) {
  return (
    <>
      <GuestSignUpPrompt />
      {children}
    </>
  );
}
