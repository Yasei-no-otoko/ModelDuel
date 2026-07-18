import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ASSET_NAME = "_clientMiddlewareManifest.js";
const GENERATED_SUFFIX =
  "self.__MIDDLEWARE_MATCHERS_CB && self.__MIDDLEWARE_MATCHERS_CB()";

async function findGeneratedAssets(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const matches = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      matches.push(...(await findGeneratedAssets(entryPath)));
    } else if (entry.isFile() && entry.name === ASSET_NAME) {
      matches.push(entryPath);
    }
  }

  return matches;
}

export function normalizeClientMiddlewareManifest(source) {
  if (source.endsWith(`${GENERATED_SUFFIX};`)) return source;
  if (!source.endsWith(GENERATED_SUFFIX)) {
    throw new Error(`Unexpected ${ASSET_NAME} contents; refusing to rewrite the build output.`);
  }
  return `${source};`;
}

export async function prepareCloudflareAssets(
  assetsRoot = path.resolve(".open-next/assets"),
) {
  const matches = await findGeneratedAssets(assetsRoot);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${ASSET_NAME} in ${assetsRoot}; found ${matches.length}.`);
  }

  const [manifestPath] = matches;
  const source = await readFile(manifestPath, "utf8");
  const normalized = normalizeClientMiddlewareManifest(source);
  if (normalized !== source) await writeFile(manifestPath, normalized, "utf8");

  console.log(
    normalized === source
      ? `Cloudflare asset manifest already normalized: ${manifestPath}`
      : `Normalized Cloudflare asset manifest: ${manifestPath}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await prepareCloudflareAssets();
}
