const DEFAULT_MEDIA_FALLBACK =
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=1920&auto=format&fit=crop";

const LOCAL_IMAGE_FALLBACKS: Record<string, string> = {
  "/images/bypass/snake-app.png":
    "https://images.unsplash.com/photo-1633419461186-7d40a38105ec?q=80&w=1920&auto=format&fit=crop",
};

const REMOTE_IMAGE_FALLBACKS = [
  {
    id: "photo-1518770660439-463619bfaf94",
    fallback:
      "https://images.unsplash.com/photo-1777672673948-d543ba5c1178?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "photo-1562976540-8e0b4d0e0a0e",
    fallback:
      "https://images.unsplash.com/photo-1540928349545-1baf2ae1ecbe?q=80&w=1200&auto=format&fit=crop",
  },
  {
    id: "photo-1587826080695-d3c2fcbb8b8b",
    fallback:
      "https://images.unsplash.com/photo-1670278458296-00ff8a63141e?q=80&w=1200&auto=format&fit=crop",
  },
];

export function resolveMediaUrl(
  url?: string | null,
  fallback: string = DEFAULT_MEDIA_FALLBACK,
): string {
  const trimmed = typeof url === "string" ? url.trim() : "";

  if (!trimmed) {
    return fallback;
  }

  if (LOCAL_IMAGE_FALLBACKS[trimmed]) {
    return LOCAL_IMAGE_FALLBACKS[trimmed];
  }

  const remoteFallback = REMOTE_IMAGE_FALLBACKS.find(({ id }) =>
    trimmed.includes(id),
  );

  if (remoteFallback) {
    return remoteFallback.fallback;
  }

  if (trimmed.startsWith("/images/") || trimmed.startsWith("/assets/")) {
    return fallback;
  }

  return trimmed;
}

export function normalizeCommerceLink(link?: string | null): string {
  if (!link?.trim()) {
    return "/products";
  }

  return link.trim().replace(/^\/productListing/i, "/products");
}
