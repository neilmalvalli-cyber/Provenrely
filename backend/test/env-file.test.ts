import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { replaceBetweenMarkers, updateEnvFile } from "../scripts/env-file.js";

const dir = mkdtempSync(join(tmpdir(), "provenrely-env-"));
const SECRET_LINE = "RELAYER_PK=0x" + "ab".repeat(32);

test("updates only the given keys; secret lines and comments stay byte-for-byte", () => {
  const f = join(dir, "a.env");
  writeFileSync(f, `# comment\n${SECRET_LINE}\nREGISTRY_ADDRESS=\nPORT=8000\n`);
  const keys = updateEnvFile(f, { REGISTRY_ADDRESS: "0x1111111111111111111111111111111111111111", DEPLOY_BLOCK: "42" });
  assert.deepEqual(keys, ["REGISTRY_ADDRESS", "DEPLOY_BLOCK"]);
  assert.equal(
    readFileSync(f, "utf8"),
    `# comment\n${SECRET_LINE}\nREGISTRY_ADDRESS=0x1111111111111111111111111111111111111111\nPORT=8000\n\nDEPLOY_BLOCK=42\n`,
  );
});

test("creates the file from a template when missing, and keeps CRLF files CRLF", () => {
  const tpl = join(dir, "tpl.env");
  writeFileSync(tpl, "A=\r\nB=keep\r\n");
  const f = join(dir, "new.env");
  updateEnvFile(f, { A: "1" }, tpl);
  assert.equal(readFileSync(f, "utf8"), "A=1\r\nB=keep\r\n");
});

test("replaceBetweenMarkers swaps only the marked section", () => {
  const f = join(dir, "README.md");
  writeFileSync(f, "top\n<!-- s -->\nold\n<!-- e -->\nbottom\n");
  assert.equal(replaceBetweenMarkers(f, "<!-- s -->", "<!-- e -->", "new"), true);
  assert.equal(readFileSync(f, "utf8"), "top\n<!-- s -->\nnew\n<!-- e -->\nbottom\n");
  assert.equal(replaceBetweenMarkers(f, "<!-- x -->", "<!-- y -->", "z"), false);
});
