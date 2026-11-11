"use client";

import { useState } from "react";
import { merchantLogoUrl } from "@/lib/merchants";

export function MerchantLogo({
  description,
  size = 20,
  className = "",
}: {
  description: string;
  size?: number;
  className?: string;
}) {
  const src = merchantLogoUrl(description, size * 2);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // Logo.dev: unoptimized / plain img — não passar pelo Image Optimization do Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`merchant-logo ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
