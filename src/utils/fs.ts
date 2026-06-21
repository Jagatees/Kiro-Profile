import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Dirent } from "node:fs";

export type ScanLimits = {
  maxFiles: number;
  maxDepth: number;
  maxTotalBytes: number;
  maxFileBytes: number;
};

export type ScanResult = {
  files: string[];
  skippedFiles: number;
  totalBytes: number;
  limited: boolean;
};

export const DEFAULT_SCAN_LIMITS: ScanLimits = {
  maxFiles: 2_000,
  maxDepth: 8,
  maxTotalBytes: 50 * 1024 * 1024,
  maxFileBytes: 5 * 1024 * 1024
};

export async function listFilesBounded(root: string, limits: Partial<ScanLimits> = {}): Promise<ScanResult> {
  const resolved = { ...DEFAULT_SCAN_LIMITS, ...limits };
  const result: ScanResult = { files: [], skippedFiles: 0, totalBytes: 0, limited: false };
  const stack = [{ directory: root, depth: 0 }];

  while (stack.length > 0 && result.files.length < resolved.maxFiles && result.totalBytes < resolved.maxTotalBytes) {
    const current = stack.pop()!;
    if (current.depth > resolved.maxDepth) {
      result.limited = true;
      continue;
    }
    let entries: Dirent<string>[];
    try {
      entries = await fs.readdir(current.directory, { withFileTypes: true, encoding: "utf8" });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(current.directory, entry.name);
      if (entry.isSymbolicLink()) {
        result.skippedFiles += 1;
      } else if (entry.isDirectory()) {
        stack.push({ directory: fullPath, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        try {
          const stat = await fs.stat(fullPath);
          if (stat.size > resolved.maxFileBytes || result.totalBytes + stat.size > resolved.maxTotalBytes) {
            result.skippedFiles += 1;
            result.limited = true;
            continue;
          }
          result.files.push(fullPath);
          result.totalBytes += stat.size;
        } catch {
          result.skippedFiles += 1;
        }
      }
      if (result.files.length >= resolved.maxFiles) {
        result.limited = true;
        break;
      }
    }
  }
  return result;
}
