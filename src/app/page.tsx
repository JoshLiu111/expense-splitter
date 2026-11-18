import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <section className="mx-auto flex max-w-content flex-col items-start gap-6 py-12">
      <h1 className="text-3xl font-extrabold">Split expenses. Settle up. Stay friends.</h1>
      <p className="text-lg text-text-secondary">
        Record who paid for what, split it any way you like, and see exactly who owes whom.
      </p>
      <Button asChild>
        <Link href="/guest">Try as Guest</Link>
      </Button>
    </section>
  );
}
