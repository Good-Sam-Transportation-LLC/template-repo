import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), "utf-8"));
}

function readText(filePath: string) {
  return fs.readFileSync(path.join(ROOT, filePath), "utf-8");
}

describe("Package.json Validation", () => {
  const pkg = readJson("package.json");

  it("requires Node >= 20", () => {
    expect(pkg.engines?.node).toContain(">=20");
  });

  it("has all expected scripts", () => {
    const required = ["dev", "build", "lint", "test", "typecheck", "lint:fix", "test:build"];
    for (const script of required) {
      expect(pkg.scripts).toHaveProperty(script);
    }
  });

  it("react and react-dom have the same version string", () => {
    expect(pkg.dependencies.react).toBe(pkg.dependencies["react-dom"]);
  });

  it("type is set to module (ESM)", () => {
    expect(pkg.type).toBe("module");
  });

  it("vite version is pinned without caret", () => {
    const viteVersion = pkg.devDependencies.vite;
    expect(viteVersion).not.toMatch(/^\^/);
    expect(viteVersion).toMatch(/^5\.\d+\.\d+$/);
  });
});

describe("TypeScript Configuration", () => {
  const tsconfig = readJson("tsconfig.app.json");
  const opts = tsconfig.compilerOptions;

  it("target is ES2020", () => {
    expect(opts.target).toBe("ES2020");
  });

  it("jsx is react-jsx", () => {
    expect(opts.jsx).toBe("react-jsx");
  });

  it("noEmit is true", () => {
    expect(opts.noEmit).toBe(true);
  });

  it("path alias @/* maps to ./src/*", () => {
    expect(opts.paths["@/*"]).toEqual(["./src/*"]);
  });

  it("include array contains src", () => {
    expect(tsconfig.include).toContain("src");
  });
});

describe("Vite Configuration", () => {
  const viteConfig = readText("vite.config.ts");

  it("contains port 8080", () => {
    expect(viteConfig).toContain("8080");
  });

  it("contains @ alias configuration", () => {
    expect(viteConfig).toContain('"@"');
  });

  it("contains plugin-react-swc import", () => {
    expect(viteConfig).toContain("plugin-react-swc");
  });

  it("contains resolve section with alias", () => {
    expect(viteConfig).toContain("resolve");
    expect(viteConfig).toContain("alias");
  });
});

describe("Vitest Configuration", () => {
  const vitestConfig = readText("vitest.config.ts");

  it("environment is jsdom", () => {
    expect(vitestConfig).toContain("jsdom");
  });

  it("globals is true", () => {
    expect(vitestConfig).toContain("globals: true");
  });

  it("setup file references setup.ts", () => {
    expect(vitestConfig).toContain("setup.ts");
  });

  it("test include pattern covers .test. and .spec. files", () => {
    // The glob pattern {test,spec} covers both .test. and .spec. extensions
    expect(vitestConfig).toMatch(/\{test,spec\}|\btest\b.*\bspec\b/);
  });

  it("build-verification.test.ts is excluded", () => {
    expect(vitestConfig).toContain("build-verification.test.ts");
  });
});

describe("HTML Entry Point", () => {
  const html = readText("index.html");

  it("contains root mount point", () => {
    expect(html).toContain('<div id="root">');
  });

  it("contains /src/main.tsx script reference", () => {
    expect(html).toContain("/src/main.tsx");
  });

  it("contains Google Fonts preconnect links", () => {
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("fonts.gstatic.com");
  });

  it("contains Open Graph meta tags", () => {
    expect(html).toContain("og:title");
  });
});
