/**
 * ESLint Rule Verification Tests
 *
 * These tests verify that the project's ESLint configuration correctly
 * catches code quality, accessibility, React, and TypeScript violations.
 * Each test lints a small code snippet and asserts that the expected
 * rule(s) fire.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { ESLint } from "eslint";
import path from "path";

let eslint: ESLint;

beforeAll(() => {
  eslint = new ESLint({
    cwd: path.resolve(import.meta.dirname, "../.."),
    // Don't apply fixes — we want to see violations
    fix: false,
  });
});

/**
 * Helper: lint a code string as if it were a .tsx file and return
 * the rule IDs of all reported messages.
 */
async function lintCode(code: string, filename = "test-file.tsx"): Promise<string[]> {
  const results = await eslint.lintText(code, { filePath: filename });
  return results.flatMap((r) => r.messages.map((m) => m.ruleId).filter(Boolean)) as string[];
}

// ---------------------------------------------------------------------------
// General Code Quality Rules
// ---------------------------------------------------------------------------
describe("General code quality rules", () => {
  it("flags console.log but allows console.warn and console.error", async () => {
    const rules = await lintCode(`
      console.log("debug");
      console.warn("ok");
      console.error("ok");
    `);
    expect(rules).toContain("no-console");
    // Only one violation — console.log, not warn/error
    expect(rules.filter((r) => r === "no-console")).toHaveLength(1);
  });

  it("flags debugger statements", async () => {
    const rules = await lintCode(`debugger;`);
    expect(rules).toContain("no-debugger");
  });

  it("flags var declarations (requires const/let)", async () => {
    const rules = await lintCode(`var x = 1;`);
    expect(rules).toContain("no-var");
  });

  it("flags == instead of ===", async () => {
    const rules = await lintCode(`
      const a = 1;
      if (a == 1) {}
    `);
    expect(rules).toContain("eqeqeq");
  });

  it("suggests const for variables that are never reassigned", async () => {
    const rules = await lintCode(`let x = 1; export default x;`);
    expect(rules).toContain("prefer-const");
  });
});

// ---------------------------------------------------------------------------
// TypeScript Rules
// ---------------------------------------------------------------------------
describe("TypeScript rules", () => {
  it("flags unused variables (without _ prefix)", async () => {
    const rules = await lintCode(`const unusedVar = 42;`);
    expect(rules).toContain("@typescript-eslint/no-unused-vars");
  });

  it("allows unused variables prefixed with _", async () => {
    const rules = await lintCode(`const _unused = 42; export default _unused;`);
    expect(rules).not.toContain("@typescript-eslint/no-unused-vars");
  });

  it("flags explicit any types", async () => {
    const rules = await lintCode(`export const fn = (x: any) => x;`);
    expect(rules).toContain("@typescript-eslint/no-explicit-any");
  });

  it("flags non-type imports used only as types", async () => {
    const rules = await lintCode(`
      import { ReactNode } from "react";
      export type Props = { children: ReactNode };
    `, "test-file.ts");
    expect(rules).toContain("@typescript-eslint/consistent-type-imports");
  });
});

// ---------------------------------------------------------------------------
// React Rules
// ---------------------------------------------------------------------------
describe("React rules", () => {
  it("flags missing keys in list rendering", async () => {
    const rules = await lintCode(`
      const List = () => <ul>{[1,2].map(i => <li>{i}</li>)}</ul>;
      export default List;
    `);
    expect(rules).toContain("react/jsx-key");
  });

  it("flags duplicate JSX props", async () => {
    const rules = await lintCode(`
      const C = () => <div className="a" className="b" />;
      export default C;
    `);
    expect(rules).toContain("react/jsx-no-duplicate-props");
  });

  it("flags passing children as a prop", async () => {
    const rules = await lintCode(`
      const C = () => <div children="hello" />;
      export default C;
    `);
    expect(rules).toContain("react/no-children-prop");
  });

  it("suggests self-closing tags for components without children", async () => {
    const rules = await lintCode(`
      const C = () => <div></div>;
      export default C;
    `);
    expect(rules).toContain("react/self-closing-comp");
  });
});

// ---------------------------------------------------------------------------
// Accessibility (jsx-a11y) Rules
// ---------------------------------------------------------------------------
describe("Accessibility rules", () => {
  it("flags images without alt text", async () => {
    const rules = await lintCode(`
      const C = () => <img src="photo.jpg" />;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/alt-text");
  });

  it("flags empty anchors (no content)", async () => {
    const rules = await lintCode(`
      const C = () => <a href="/page"></a>;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/anchor-has-content");
  });

  it("flags invalid ARIA attributes", async () => {
    const rules = await lintCode(`
      const C = () => <div aria-fakeprop="true">content</div>;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/aria-props");
  });

  it("flags invalid ARIA roles", async () => {
    const rules = await lintCode(`
      const C = () => <div role="fakeRole">content</div>;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/aria-role");
  });

  it("flags empty headings", async () => {
    const rules = await lintCode(`
      const C = () => <h1></h1>;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/heading-has-content");
  });

  it("flags redundant alt text on images", async () => {
    const rules = await lintCode(`
      const C = () => <img src="cat.jpg" alt="image of a cat" />;
      export default C;
    `);
    expect(rules).toContain("jsx-a11y/img-redundant-alt");
  });
});

// ---------------------------------------------------------------------------
// shadcn/ui Override: Relaxed Rules
// ---------------------------------------------------------------------------
describe("shadcn/ui overrides", () => {
  it("allows empty headings in ui/ components", async () => {
    const rules = await lintCode(
      `const C = () => <h1></h1>; export default C;`,
      "src/components/ui/card.tsx",
    );
    expect(rules).not.toContain("jsx-a11y/heading-has-content");
  });

  it("allows empty anchors in ui/ components", async () => {
    const rules = await lintCode(
      `const C = () => <a href="/page"></a>; export default C;`,
      "src/components/ui/pagination.tsx",
    );
    expect(rules).not.toContain("jsx-a11y/anchor-has-content");
  });

  it("still enforces heading content in non-ui components", async () => {
    const rules = await lintCode(
      `const C = () => <h1></h1>; export default C;`,
      "src/components/MyComponent.tsx",
    );
    expect(rules).toContain("jsx-a11y/heading-has-content");
  });
});

// ---------------------------------------------------------------------------
// Clean Code: Verify no false positives on correct code
// ---------------------------------------------------------------------------
describe("Clean code passes lint", () => {
  it("well-formed React component has no violations", async () => {
    const rules = await lintCode(`
      const Greeting = ({ name }: { name: string }) => (
        <div>
          <h1>Hello, {name}</h1>
          <img src="avatar.png" alt="User avatar" />
          <a href="/home">Go home</a>
          <ul>
            {["a", "b"].map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      );
      export default Greeting;
    `);
    expect(rules).toHaveLength(0);
  });

  it("proper use of const and === has no violations", async () => {
    const rules = await lintCode(`
      const x = 42;
      const isEqual = x === 42;
      export { isEqual };
    `);
    expect(rules).toHaveLength(0);
  });
});
