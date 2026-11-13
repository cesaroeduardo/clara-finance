"use client";

import { createContext, useContext, useState } from "react";
import { merchantLogoUrl, type MerchantAsset } from "@/lib/merchants";

export const MerchantAssetsContext = createContext<readonly MerchantAsset[]>(
  [],
);
export function useMerchantLogoUrl() {
  const assets = useContext(MerchantAssetsContext);
  return (description: string, size = 64) =>
    merchantLogoUrl(description, size, assets);
}

export function MerchantLogo({
  description,
  size = 20,
  className = "",
}: {
  description: string;
  size?: number;
  className?: string;
}) {
  const logoUrl = useMerchantLogoUrl();
  const src = logoUrl(description, size * 2);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    // Imagem local do banco ou Logo.dev, sem otimizacao do Next.
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
