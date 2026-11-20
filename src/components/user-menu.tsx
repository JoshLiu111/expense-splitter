import Link from "next/link";
import { UserRoundCog } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";
import { getCurrentUser } from "@/auth/session";
import { Button } from "@/components/ui/button";

/**
 * Sign-in links, or the signed-in User with Account Settings and a sign-out
 * button. Reads the session.
 */
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <nav aria-label="User" className="flex items-center gap-1">
        <Button asChild variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Sign up</Link>
        </Button>
      </nav>
    );
  }

  return (
    <nav aria-label="User" className="flex items-center gap-1">
      <Button asChild variant="ghost">
        <Link href="/dashboard">Your Groups</Link>
      </Button>
      <span className="hidden max-w-40 truncate px-2 text-sm text-text-secondary sm:inline">
        {user.name}
      </span>
      <Button asChild variant="ghost" size="icon">
        <Link href="/account" aria-label="Account Settings" title="Account Settings">
          <UserRoundCog aria-hidden />
        </Link>
      </Button>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </nav>
  );
}
