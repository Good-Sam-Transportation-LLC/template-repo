import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const DIST_DIR = path.resolve(import.meta.dirname, "../../dist");
const ASSETS_DIR = path.join(DIST_DIR, "assets");

function getAssetFiles(extension: string): string[] {
  if (!fs.existsSync(ASSETS_DIR)) return [];
  return fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith(extension));
}

function getTotalSize(dir: string, extension: string): number {
  return getAssetFiles(extension).reduce((sum, file) => {
    return sum + fs.statSync(path.join(dir, file)).size;
  }, 0);
}

describe("Build Output Structure", () => {
  it("dist/ directory exists", () => {
    expect(fs.existsSync(DIST_DIR)).toBe(true);
  });

  it("dist/index.html exists", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "index.html"))).toBe(true);
  });

  it("dist/assets/ directory exists", () => {
    expect(fs.existsSync(ASSETS_DIR)).toBe(true);
  });

  it("at least one .js file in dist/assets/", () => {
    expect(getAssetFiles(".js").length).toBeGreaterThanOrEqual(1);
  });

  it("at least one .css file in dist/assets/", () => {
    expect(getAssetFiles(".css").length).toBeGreaterThanOrEqual(1);
  });

  it("favicon.ico exists in dist/", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "favicon.ico"))).toBe(true);
  });

  it("robots.txt exists in dist/", () => {
    expect(fs.existsSync(path.join(DIST_DIR, "robots.txt"))).toBe(true);
  });
});

describe("Bundle Size Guards", () => {
  it("JS bundle total size is under 1.5 MB", () => {
    const totalJs = getTotalSize(ASSETS_DIR, ".js");
    expect(totalJs).toBeLessThan(1_500_000);
  });

  it("JS bundle total size is over 100 KB — not empty", () => {
    const totalJs = getTotalSize(ASSETS_DIR, ".js");
    expect(totalJs).toBeGreaterThan(100_000);
  });

  it("CSS bundle total size is under 150 KB", () => {
    const totalCss = getTotalSize(ASSETS_DIR, ".css");
    expect(totalCss).toBeLessThan(150_000);
  });

  it("CSS bundle total size is over 10 KB — not empty", () => {
    const totalCss = getTotalSize(ASSETS_DIR, ".css");
    expect(totalCss).toBeGreaterThan(10_000);
  });
});

describe("HTML Integrity", () => {
  const html = fs.existsSync(path.join(DIST_DIR, "index.html"))
    ? fs.readFileSync(path.join(DIST_DIR, "index.html"), "utf-8")
    : "";

  it('index.html contains <div id="root">', () => {
    expect(html).toContain('<div id="root"');
  });

  it("index.html contains a <script tag referencing an asset JS file", () => {
    expect(html).toMatch(/<script[^>]+src="[^"]*\/assets\/[^"]*\.js"/);
  });

  it("index.html contains a <link tag referencing an asset CSS file", () => {
    expect(html).toMatch(/<link[^>]+href="[^"]*\/assets\/[^"]*\.css"/);
  });

  it('index.html contains a <meta name="viewport" tag', () => {
    expect(html).toMatch(/<meta\s+name="viewport"/);
  });

  it("index.html contains <title> tag", () => {
    expect(html).toMatch(/<title>/);
  });
});

describe("Production Build Quality", () => {
  it("no .map source map files in dist/assets/", () => {
    const mapFiles = getAssetFiles(".map");
    expect(mapFiles).toHaveLength(0);
  });

  it("JS bundle content is minified (line count < 500)", () => {
    const jsFiles = getAssetFiles(".js");
    for (const file of jsFiles) {
      const content = fs.readFileSync(path.join(ASSETS_DIR, file), "utf-8");
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThan(500);
    }
  });

  it("CSS bundle content is minified (line count < 50)", () => {
    const cssFiles = getAssetFiles(".css");
    for (const file of cssFiles) {
      const content = fs.readFileSync(path.join(ASSETS_DIR, file), "utf-8");
      const lineCount = content.split("\n").length;
      expect(lineCount).toBeLessThan(50);
    }
  });

  it("JS filename contains a content hash", () => {
    const jsFiles = getAssetFiles(".js");
    expect(jsFiles.length).toBeGreaterThan(0);
    for (const file of jsFiles) {
      expect(file).toMatch(/index-[a-zA-Z0-9_-]+\.js$/);
    }
  });

  it("CSS filename contains a content hash", () => {
    const cssFiles = getAssetFiles(".css");
    expect(cssFiles.length).toBeGreaterThan(0);
    for (const file of cssFiles) {
      expect(file).toMatch(/index-[a-zA-Z0-9_-]+\.css$/);
    }
  });
});
