import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const activeShareConsumers = [
  "apps/epub-cover-changer/src/app/services/file.service.ts",
  "apps/cover-creator-for-kindle/src/app/services/file.service.ts",
  "apps/epub-fixer/src/app/services/epub-library.service.ts",
  "apps/epub-merger-and-splitter/src/app/services/epub-library.service.ts",
  "apps/pdf-cover-maker/src/app/services/file.service.ts",
];

test("regression: active consumers use the shared file-share service", () => {
  const missingShareCalls = activeShareConsumers.filter((file) => {
    const source = readFileSync(file, "utf8");
    return !source.includes("fileKit.share");
  });

  assert.deepEqual(
    missingShareCalls,
    [],
    `Active file consumers must share through file-kit:\n${missingShareCalls.join("\n")}`,
  );
});

test("regression: native file-share adapters always pass files", () => {
  const fileKitAdapter = readFileSync(
    "packages/file-kit/src/lib/adapters/capacitor/capacitor-share.adapter.ts",
    "utf8",
  );
  const imageWorkflowAdapter = readFileSync(
    "packages/image-workflow/src/lib/adapters/capacitor/share-adapter.ts",
    "utf8",
  );

  assert.match(
    fileKitAdapter,
    /Filesystem\.readFile\(\{\s*path:\s*ref\.uri\s*\}\)/u,
    "file-kit must materialize content URIs before sharing them",
  );
  assert.match(
    fileKitAdapter,
    /Share\.share\(\{[\s\S]*files:\s*\[shareUri\]/u,
    "file-kit must pass the normalized file URI as a shared file",
  );
  assert.match(
    imageWorkflowAdapter,
    /Share\.share\(\{[\s\S]*files:\s*options\.files/u,
    "image-workflow must pass its file list to the native share adapter",
  );
});
