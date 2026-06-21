import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { getKiroAppDataRoots } from "../src/kiro/paths";

describe("Kiro path detection", () => {
  it("uses APPDATA on Windows", () =>
    expect(getKiroAppDataRoots("C:\\Users\\dev", "win32", "D:\\Roaming")[0]).toBe(path.join("D:\\Roaming", "Kiro")));
  it("uses Application Support on macOS", () =>
    expect(getKiroAppDataRoots("/Users/dev", "darwin")).toEqual([
      path.join("/Users/dev", "Library", "Application Support", "Kiro")
    ]));
  it("uses .config on Linux", () =>
    expect(getKiroAppDataRoots("/home/dev", "linux")).toEqual([path.join("/home/dev", ".config", "Kiro")]));
});
