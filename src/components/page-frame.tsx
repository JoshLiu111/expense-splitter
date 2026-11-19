/**
 * The padded, centred column every page sits in. The root layout's <main>
 * has no padding of its own, so a full-width band (like the Guest sign-up
 * bar) can sit flush under the header, above the frame.
 */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-page px-4 py-8">{children}</div>;
}
