"use client";

import { CategoryImage, FinanceIcon } from "./finance-icons";
import { MerchantLogo, useMerchantLogoUrl } from "./merchant-logo";
import { colorForCategory, imageForCategory } from "@/lib/categorize";
import type { Category, Transaction } from "@/lib/types";

export function TransactionAvatar({
  transaction,
  categories,
}: {
  transaction: Pick<Transaction, "description" | "category">;
  categories?: Category[];
}) {
  const merchantLogoUrl = useMerchantLogoUrl();
  const category = transaction.category || "Sem categoria";
  const image = imageForCategory(category, categories);
  const color = colorForCategory(category, 0, categories);
  const merchant = Boolean(merchantLogoUrl(transaction.description));
  return (
    <span
      aria-hidden="true"
      className={`transaction-symbol${merchant || image ? " has-image" : ""}${merchant ? " has-merchant" : ""}`}
      style={
        merchant
          ? undefined
          : {
              color,
              background: `color-mix(in srgb, ${color} 16%, transparent)`,
            }
      }
    >
      {merchant ? (
        <MerchantLogo description={transaction.description} size={31} />
      ) : image ? (
        <CategoryImage name={image} size={28} />
      ) : (
        <FinanceIcon name="layers" size={17} />
      )}
    </span>
  );
}
