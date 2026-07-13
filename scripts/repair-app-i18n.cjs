const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const appsRoot = path.join(repoRoot, "apps");

function collectLocaleFiles(rootDir) {
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (
          entry.name === "dist" ||
          entry.name === "build" ||
          entry.name === "node_modules"
        ) {
          continue;
        }

        walk(fullPath);
        continue;
      }

      const normalized = fullPath.split(path.sep).join("/");
      if (
        entry.isFile() &&
        entry.name.endsWith(".json") &&
        normalized.includes("/assets/i18n/")
      ) {
        files.push(fullPath);
      }
    }
  }

  walk(rootDir);
  return files.sort();
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

if (require.main === module) {
  const localeFiles = collectLocaleFiles(appsRoot);

  for (const filePath of localeFiles) {
    const raw = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
    const data = JSON.parse(raw);
    const repaired = deepRepair(data);
    fs.writeFileSync(filePath, `${JSON.stringify(repaired, null, 2)}\n`, "utf8");
    console.log(`repaired ${path.relative(repoRoot, filePath).split(path.sep).join("/")}`);
  }
}

module.exports = {
  deepRepair,
  repairString,
};
