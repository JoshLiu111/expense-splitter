"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A Member's avatar image, laid over their initials. It stays invisible
 * until it has loaded and is dropped if it fails, so the initials show
 * instead of a blank or broken image.
 */
export function MemberAvatarImage({ src, name }: { src: string; name: string }) {
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  if (status === "failed") return null;
  return (
    // Avatar URLs come from the avatar store, not a configured image host.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
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
