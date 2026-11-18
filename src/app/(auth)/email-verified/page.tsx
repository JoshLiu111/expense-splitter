import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FormCard } from "@/components/form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Verify your email · Expense Splitter" };

/** Where the emailed verification link lands; `?error=` if it didn't work. */
export default function Page({ searchParams }: PageProps<"/email-verified">) {
  return (
    <section aria-labelledby="verified-heading" className="mx-auto flex max-w-md flex-col gap-6">
      <Suspense>
        <Outcome searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Outcome({ searchParams }: Pick<PageProps<"/email-verified">, "searchParams">) {
  const { error } = await searchParams;
  if (error) {
    return (
      <>
        <h1 id="verified-heading" className="text-2xl font-extrabold">
          That link didn&apos;t work
        </h1>
        <FormCard>
          <p role="alert">
            The verification link has expired or isn&apos;t valid. Sign in and send yourself a new
            one from Your Groups.
          </p>
          <Button asChild className="mt-4">
            <Link href="/dashboard">Go to Your Groups</Link>
          </Button>
        </FormCard>
      </>
    );
  }
  return (
    <>
      <h1 id="verified-heading" className="text-2xl font-extrabold">
        Email verified
      </h1>
      <FormCard>
        <p>Any Groups people added you to by this email now show up in Your Groups.</p>
        <Button asChild className="mt-4">
          <Link href="/dashboard">Go to Your Groups</Link>
        </Button>
      </FormCard>
    </>
  );
}
