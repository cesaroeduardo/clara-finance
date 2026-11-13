import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { NextRequest } from "next/server";
import { isLocalNetworkHost, modeOf } from "../src/lib/http";
import {
  initializeMerchantAssets,
  listMerchantAssets,
} from "../src/lib/merchant-assets";
import { merchantAssetFor } from "../src/lib/merchants";

test("rede local exige opt-in explicito e preserva bloqueio de hosts publicos", () => {
  const previous = process.env.ALLOW_LAN_ACCESS;
  try {
    for (const value of [undefined, "false", "1"]) {
      if (value === undefined) delete process.env.ALLOW_LAN_ACCESS;
      else process.env.ALLOW_LAN_ACCESS = value;
      assert.equal(isLocalNetworkHost("127.0.0.1"), true);
      assert.equal(isLocalNetworkHost("localhost"), true);
      assert.equal(isLocalNetworkHost("::1"), true);
      assert.equal(isLocalNetworkHost("192.168.1.20"), false);
      assert.equal(isLocalNetworkHost("computador.local"), false);
      assert.throws(() =>
        modeOf(new NextRequest("http://192.168.1.20/api/data")),
      );
    }
    process.env.ALLOW_LAN_ACCESS = "true";
    assert.equal(
      modeOf(new NextRequest("http://192.168.1.20/api/data")),
      "personal",
    );
    assert.equal(isLocalNetworkHost("example.com"), false);
  } finally {
    if (previous === undefined) delete process.env.ALLOW_LAN_ACCESS;
    else process.env.ALLOW_LAN_ACCESS = previous;
  }
});

test("migra nomes e imagens uma vez, sem copiar para demo ou instalacoes novas", () => {
  fs.mkdirSync("work", { recursive: true });
  const directory = fs.mkdtempSync(
    path.join(process.cwd(), "work", "merchant-test-"),
  );
  const file = path.join(directory, "test.sqlite");
  const image = "data:image/png;base64,dGVzdA==";
  fs.writeFileSync(
    `${file}.legacy-merchants.json`,
    JSON.stringify([{ match: "Fornecedor privado ficticio", src: image }]),
  );
  const database = new Database(":memory:");
  const fresh = new Database(":memory:");
  try {
    for (const db of [database, fresh])
      db.exec("CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY)");
    initializeMerchantAssets(database, file);
    const assets = listMerchantAssets(database, "personal");
    assert.equal(
      merchantAssetFor("FORNECEDOR PRIVADO FICTICIO", assets),
      image,
    );
    assert.deepEqual(listMerchantAssets(database, "demo"), []);
    database.exec("DELETE FROM merchant_assets");
    initializeMerchantAssets(database, file);
    assert.deepEqual(listMerchantAssets(database, "personal"), []);
    initializeMerchantAssets(fresh, path.join(directory, "fresh.sqlite"));
    assert.deepEqual(listMerchantAssets(fresh, "personal"), []);
  } finally {
    database.close();
    fresh.close();
  }
});
