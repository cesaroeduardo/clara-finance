import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountChannelLabel,
  cleanAccountName,
  displayInstitution,
  formatAccountLabel,
  resolveInstitution,
} from "../src/lib/accounts";

test("resolveInstitution prefere a conexão do usuário ao MeuPluggy", () => {
  assert.equal(resolveInstitution("MeuPluggy", "Nubank"), "Nubank");
  assert.equal(resolveInstitution("MeuPluggy", "Sicredi"), "Sicredi");
  assert.equal(resolveInstitution("Itaú", "Minha conta"), "Minha conta");
  assert.equal(resolveInstitution("Nubank", undefined), "Nubank");
});

test("cleanAccountName distingue cartão, conta e poupança", () => {
  assert.equal(
    cleanAccountName(
      {
        name: "ultraviolet-black",
        type: "CREDIT",
        subtype: "CREDIT_CARD",
      },
      "Nubank",
    ),
    "Ultravioleta",
  );
  assert.equal(
    cleanAccountName(
      {
        name: "Nu Pagamentos S.A. - Instituição de Pagamento",
        marketingName:
          "Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)",
        type: "BANK",
        subtype: "CHECKING_ACCOUNT",
      },
      "Nubank",
    ),
    "Conta",
  );
  assert.equal(
    cleanAccountName(
      { name: "Sicredi", type: "BANK", subtype: "CHECKING_ACCOUNT" },
      "Sicredi",
    ),
    "Conta corrente",
  );
  assert.equal(
    cleanAccountName(
      { name: "Sicredi", type: "BANK", subtype: "SAVINGS_ACCOUNT" },
      "Sicredi",
    ),
    "Poupança",
  );
  assert.equal(
    cleanAccountName(
      { name: "Visa Internacional", type: "CREDIT", subtype: "CREDIT_CARD" },
      "Sicredi",
    ),
    "Visa Internacional",
  );
});

test("formatAccountLabel mostra banco e canal", () => {
  assert.equal(
    formatAccountLabel({
      institution: "MeuPluggy",
      name: "ultraviolet-black",
      type: "CREDIT",
      itemId: "item-nu",
    }, [{ id: "item-nu", name: "Nubank" }]),
    "Nubank · Cartão",
  );
  assert.equal(
    formatAccountLabel({
      institution: "Nubank",
      name: "Conta",
      type: "BANK",
      itemId: "item-nu",
    }),
    "Nubank · Conta",
  );
  assert.equal(
    accountChannelLabel({ type: "BANK", name: "Poupança" }),
    "Poupança",
  );
  assert.equal(
    displayInstitution(
      {
        institution: "MeuPluggy",
        name: "Nu Pagamentos S.A.",
        itemId: null,
      },
      [],
    ),
    "Nubank",
  );
});
