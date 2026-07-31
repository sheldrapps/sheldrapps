import { extname, sep } from "node:path";

import type { TextIntegrityConfig } from "./types.ts";

export const DEFAULT_TEXT_INTEGRITY_CONFIG: TextIntegrityConfig = {
  include: [
    "apps/**/*.{json,md,xml,ts,js,html,yml,yaml}",
    "packages/**/*.{json,md,xml,ts,js,html,yml,yaml}",
    "plugins/**/*.{json,md,xml,ts,js,html,yml,yaml}",
    "scripts/**/*.{js,cjs,mjs}",
    "tools/**/*.{json,md,xml,ts,js,html,yml,yaml,mjs,cjs}",
    "docs/**/*.{md,xml,json,yml,yaml}",
    "*.{md,json,yml,yaml}",
  ],
  excludeContains: [
    `${sep}node_modules${sep}`,
    `${sep}.git${sep}`,
    `${sep}dist${sep}`,
    `${sep}build${sep}`,
    `${sep}coverage${sep}`,
    `${sep}.angular${sep}`,
    `${sep}.gradle${sep}`,
    `${sep}www${sep}`,
    `${sep}android${sep}app${sep}src${sep}main${sep}assets${sep}public${sep}`,
    `${sep}tools${sep}text-integrity${sep}`,
    `${sep}package-lock.json`,
  ],
  textExtensions: [".json", ".md", ".xml", ".ts", ".js", ".html", ".yml", ".yaml"],
  bomMode: "warn",
  allowC1ByPath: [],
  maxFixPasses: 3,
};

export function isExcludedByConfig(
  filePath: string,
  config: TextIntegrityConfig
): boolean {
  return config.excludeContains.some((snippet) => filePath.includes(snippet));
}

export function isSupportedTextExtension(
  filePath: string,
  config: TextIntegrityConfig
): boolean {
  return config.textExtensions.includes(extname(filePath).toLowerCase());
}

export function isJsonFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".json";
}

export function isXmlFile(filePath: string): boolean {
  return extname(filePath).toLowerCase() === ".xml";
}

export function allowsC1Controls(
  filePath: string,
  config: TextIntegrityConfig
): boolean {
  return config.allowC1ByPath.some((snippet) => filePath.includes(snippet));
}
