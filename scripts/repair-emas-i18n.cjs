const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const sourceLocaleDir = path.join(
  path.join(
    repoRoot,
    "apps",
    "epub-merger-and-splitter",
    "src",
    "assets",
    "i18n"
  )
);
const mirrorLocaleDirs = [
  path.join(
    repoRoot,
    "apps",
    "epub-merger-and-splitter",
    "www",
    "assets",
    "i18n"
  ),
  path.join(
    repoRoot,
    "apps",
    "epub-merger-and-splitter",
    "android",
    "app",
    "src",
    "main",
    "assets",
    "public",
    "assets",
    "i18n"
  ),
];
const legacyMyEpubsKeys = new Set([
  "ERROR_LOAD",
  "ERROR_PREVIEW",
  "ERROR_OPEN",
  "ERROR_SHARE",
  "ERROR_DELETE",
]);
const removedCommonKeys = new Set([
  "REMOVE_ADS_BUY",
  "REMOVE_ADS_DESCRIPTION",
  "REMOVE_ADS_PURCHASED",
  "REMOVE_ADS_RESTORE",
  "REMOVE_ADS_RESTORED",
  "REMOVE_ADS_TITLE",
  "REMOVE_ADS_CTA_TITLE",
  "REMOVE_ADS_CTA_SUBTITLE",
  "REMOVE_ADS_CTA_SUBTITLE_WITH_PRICE",
  "REMOVE_ADS_MODAL_PRICE",
]);

function collectLocaleFiles(rootDir) {
  return fs
    .readdirSync(rootDir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(rootDir, name))
    .sort();
}

const localeFiles = collectLocaleFiles(sourceLocaleDir);

function flattenLeafPaths(value, pathParts = [], into = []) {
  if (typeof value === "string") {
    into.push({ path: pathParts.join("."), value });
    return into;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      flattenLeafPaths(item, [...pathParts, String(index)], into);
    });
    return into;
  }

  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      flattenLeafPaths(item, [...pathParts, key], into);
    }
  }

  return into;
}

function readGitHeadJson(file) {
  const relative = path.relative(repoRoot, file).split(path.sep).join("/");
  const source = execFileSync("git", ["show", `HEAD:${relative}`], {
    cwd: repoRoot,
    encoding: "utf8",
  }).replace(/^\uFEFF/, "");

  return JSON.parse(source);
}

function encodeWindows1252(value) {
  const reverseMap = new Map([
    [0x20ac, 0x80],
    [0x201a, 0x82],
    [0x0192, 0x83],
    [0x201e, 0x84],
    [0x2026, 0x85],
    [0x2020, 0x86],
    [0x2021, 0x87],
    [0x02c6, 0x88],
    [0x2030, 0x89],
    [0x0160, 0x8a],
    [0x2039, 0x8b],
    [0x0152, 0x8c],
    [0x017d, 0x8e],
    [0x2018, 0x91],
    [0x2019, 0x92],
    [0x201c, 0x93],
    [0x201d, 0x94],
    [0x2022, 0x95],
    [0x2013, 0x96],
    [0x2014, 0x97],
    [0x02dc, 0x98],
    [0x2122, 0x99],
    [0x0161, 0x9a],
    [0x203a, 0x9b],
    [0x0153, 0x9c],
    [0x017e, 0x9e],
    [0x0178, 0x9f],
  ]);
  const bytes = [];

  for (const char of value) {
    const code = char.codePointAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }

    if (reverseMap.has(code)) {
      bytes.push(reverseMap.get(code));
      continue;
    }

    return null;
  }

  return Buffer.from(bytes);
}

function decodeLatin1(value) {
  return Buffer.from(value, "latin1").toString("utf8");
}

function decodeWindows1252(value) {
  const buffer = encodeWindows1252(value);
  return buffer ? buffer.toString("utf8") : null;
}

function badSequenceCount(value) {
  const codePoints = Array.from(value, (char) => char.codePointAt(0));
  let bad = 0;

  for (let index = 0; index < codePoints.length; index += 1) {
    const current = codePoints[index];
    const next = codePoints[index + 1];
    const third = codePoints[index + 2];

    if (current === 0xfffd) {
      bad += 1;
    }

    if (
      (current >= 0x00 && current <= 0x08) ||
      current === 0x0b ||
      current === 0x0c ||
      (current >= 0x0e && current <= 0x1f) ||
      (current >= 0x7f && current <= 0x9f)
    ) {
      bad += 1;
    }

    if (current === 0x00c3 || current === 0x00c2) {
      bad += 1;
    }

    if (current === 0x00e0 && (next === 0x00a4 || next === 0x00a5)) {
      bad += 1;
    }

    if (
      current === 0x00e2 &&
      (next === 0x0080 ||
        next === 0x20ac ||
        next === 0x201a ||
        next === 0x201e)
    ) {
      if (
        third === 0x00a2 ||
        third === 0x0099 ||
        third === 0x009c ||
        third === 0x009d ||
        third === 0x00a1 ||
        third === 0x00a6
      ) {
        bad += 1;
      }
    }

    if (
      current === 0x00c2 &&
      (next === 0x0080 ||
        next === 0x20ac ||
        next === 0x201a ||
        next === 0x201e)
    ) {
      bad += 1;
    }

    if (current === 0x00ef && next === 0x00bf && third === 0x00bd) {
      bad += 1;
    }
  }

  return bad;
}

function nonAsciiLetterCount(value) {
  let count = 0;

  for (const char of value) {
    const code = char.codePointAt(0);
    if (code > 0x7f && /\p{Letter}/u.test(char)) {
      count += 1;
    }
  }

  return count;
}

function suspiciousSymbolCount(value) {
  let count = 0;

  for (const char of value) {
    const code = char.codePointAt(0);
    if (code > 0x7f && /\p{Symbol}/u.test(char)) {
      count += 1;
    }
  }

  return count;
}

function scoreCandidate(value) {
  return (
    nonAsciiLetterCount(value) * 10 -
    badSequenceCount(value) * 25 -
    suspiciousSymbolCount(value) * 6
  );
}

function generateCandidates(value) {
  const seen = new Set();
  const queue = [{ value, depth: 0 }];
  const candidates = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (seen.has(current.value)) {
      continue;
    }
    seen.add(current.value);
    candidates.push(current.value);

    if (current.depth >= 3) {
      continue;
    }

    const latin1 = decodeLatin1(current.value);
    if (!seen.has(latin1)) {
      queue.push({ value: latin1, depth: current.depth + 1 });
    }

    const win1252 = decodeWindows1252(current.value);
    if (win1252 && !seen.has(win1252)) {
      queue.push({ value: win1252, depth: current.depth + 1 });
    }
  }

  return candidates;
}

function repairString(value) {
  if (typeof value !== "string") {
    return value;
  }

  const candidates = generateCandidates(value);
  let bestValue = value;
  let bestScore = scoreCandidate(value);

  for (const candidate of candidates) {
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      bestScore = score;
      bestValue = candidate;
    }
  }

  return bestValue;
}

function deepRepair(value) {
  if (typeof value === "string") {
    return repairString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepRepair(item));
  }

  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      output[key] = deepRepair(item);
    }
    return output;
  }

  return value;
}

function setAtPath(root, pathParts, value) {
  let cursor = root;
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const key = pathParts[index];
    if (!cursor[key] || typeof cursor[key] !== "object") {
      cursor[key] = {};
    }
    cursor = cursor[key];
  }

  cursor[pathParts[pathParts.length - 1]] = value;
}

function mergeCurrentOnly(base, current) {
  const basePaths = new Set(flattenLeafPaths(base).map((entry) => entry.path));
  const currentLeaves = flattenLeafPaths(current);
  const merged = structuredClone(base);

  for (const entry of currentLeaves) {
    if (!basePaths.has(entry.path)) {
      setAtPath(
        merged,
        entry.path.split("."),
        repairString(entry.value)
      );
    }
  }

  return merged;
}

function removeLegacyMyEpubAliases(data) {
  const keys = data?.MY_EPUBS && typeof data.MY_EPUBS === "object"
    ? Object.keys(data.MY_EPUBS)
    : [];

  for (const key of keys) {
    if (legacyMyEpubsKeys.has(key)) {
      delete data.MY_EPUBS[key];
    }
  }

  return data;
}

function removeFixFlowStrings(data) {
  if (data && typeof data === "object") {
    if (data.FIX && typeof data.FIX === "object") {
      delete data.FIX;
    }

    if (data.COMMON && typeof data.COMMON === "object") {
      for (const key of removedCommonKeys) {
        delete data.COMMON[key];
      }
    }
  }

  return data;
}

for (const filePath of localeFiles) {
  const localeFile = path.basename(filePath);
  const headData = deepRepair(readGitHeadJson(filePath));
  const currentData = JSON.parse(
    fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")
  );
  const repaired = removeLegacyMyEpubAliases(
    removeFixFlowStrings(mergeCurrentOnly(headData, currentData))
  );

  fs.writeFileSync(filePath, `${JSON.stringify(repaired, null, 2)}\n`, "utf8");
  for (const mirrorDir of mirrorLocaleDirs) {
    const mirrorPath = path.join(mirrorDir, localeFile);
    if (fs.existsSync(mirrorPath)) {
      fs.writeFileSync(
        mirrorPath,
        `${JSON.stringify(repaired, null, 2)}\n`,
        "utf8"
      );
    }
  }
  console.log(`repaired ${localeFile}`);
}
