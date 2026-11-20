"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A Member's avatar image, laid over their initials. It stays invisible
 * until it has loaded and is dropped if it fails, so the initials show
 * instead of a blank or broken image. It has no alt text of its own: the
 * avatar around it is named for the Member, or is decorative.
 */
export function MemberAvatarImage({ src }: { src: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return null;
  return (
    // Avatar URLs come from the avatar store, not a configured image host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      // An image cached before hydration has loaded with no event to say so.
      ref={(img) => {
        if (img?.complete) setStatus(img.naturalWidth > 0 ? "loaded" : "failed");
      }}
      onLoad={() => setStatus("loaded")}
      onError={() => setStatus("failed")}
      className={cn(
        "absolute inset-0 size-full rounded-full object-cover",
        status === "loaded" ? "opacity-100" : "opacity-0",
      )}
    />
  );
}
