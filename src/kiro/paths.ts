import * as path from "node:path";

export type SupportedPlatform = "win32" | "darwin" | "linux";

export function getKiroAppDataRoots(
  home: string,
  platform: NodeJS.Platform = process.platform,
  appData = process.env.APPDATA
): string[] {
  if (platform === "win32") {
    return [
      ...new Set(
        [appData ? path.join(appData, "Kiro") : "", path.join(home, "AppData", "Roaming", "Kiro")].filter(Boolean)
      )
    ];
  }
  if (platform === "darwin") {
    return [path.join(home, "Library", "Application Support", "Kiro")];
  }
  return [path.join(home, ".config", "Kiro")];
}
