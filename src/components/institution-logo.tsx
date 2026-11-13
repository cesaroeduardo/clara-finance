"use client";

import { useState } from "react";
import { institutionLogoUrl } from "@/lib/accounts";

export function InstitutionLogo({
  institution,
  size = 38,
  className = "",
}: {
  institution: string;
  size?: number;
  className?: string;
}) {
  const src = institutionLogoUrl(institution, size * 2);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // Arquivo oficial local ou Logo.dev, sem otimização de imagem do Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={`institution-logo ${className}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
