import { readFile, writeFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import assert from "node:assert/strict";
const manifest = JSON.parse(await readFile("dist/.vite/manifest.json", "utf8"));
const seen = new Set();
const visit = (key) => {
  if (seen.has(key)) return;
  seen.add(key);
  for (const child of manifest[key].imports || []) visit(child);
};
visit("index.html");
const files = [...seen]
  .map((key) => manifest[key].file)
  .filter((file) => file.endsWith(".js"));
let bytes = 0,
  gzipBytes = 0;
for (const file of files) {
  const content = await readFile(`dist/${file}`);
  bytes += content.length;
  gzipBytes += gzipSync(content).length;
}
assert.ok(
  gzipBytes < 180000,
  "Initial JS grew beyond the lazy-load budget",
);
assert.ok(
  !files.some((file) => /EntryForm|ProgressPage|heic|SettingsPage/.test(file)),
  "Optional features must not be eagerly downloaded",
);
const chunks = [];
for (const row of Object.values(manifest)) {
  if (row.file.endsWith(".js"))
    chunks.push({
      file: row.file,
      bytes: (await stat(`dist/${row.file}`)).size,
    });
}
const result = {
  checkedAt: new Date().toISOString(),
  initialFiles: files,
  initialJavaScriptBytes: bytes,
  initialJavaScriptGzipBytes: gzipBytes,
  previousInitialJavaScriptBytes: 728480,
  previousInitialJavaScriptGzipBytes: 205890,
  initialGzipReductionPercent: Math.round((1 - gzipBytes / 205890) * 1000) / 10,
  largestApplicationChunkBytes: Math.max(...chunks.map((r) => r.bytes)),
  note: "Static build byte comparison, not a measured device loading time. HEIC decoder is a separate on-demand worker.",
};
await writeFile(
  "artifacts/build-size.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(
  `PASS: initial JS ${Math.round(gzipBytes / 1024)} KiB gzip; ${result.initialGzipReductionPercent}% below previous build. Optional routes and HEIC remain deferred.`,
);
