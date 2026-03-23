#!/usr/bin/env bash
set -euo pipefail

# Project Template Setup Script
# Usage: ./setup.sh <project-name> [target-directory]

PROJECT_NAME="${1:?Usage: ./setup.sh <project-name> [target-directory]}"
TARGET_DIR="${2:-./$PROJECT_NAME}"

echo "Creating new project: $PROJECT_NAME"
echo "Target directory: $TARGET_DIR"

# Create target directory
mkdir -p "$TARGET_DIR"

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy all template files
cp -r "$SCRIPT_DIR/.github" "$TARGET_DIR/"
cp -r "$SCRIPT_DIR/src" "$TARGET_DIR/"
cp "$SCRIPT_DIR/eslint.config.js" "$TARGET_DIR/"
cp "$SCRIPT_DIR/vite.config.ts" "$TARGET_DIR/"
cp "$SCRIPT_DIR/vitest.config.ts" "$TARGET_DIR/"
cp "$SCRIPT_DIR/vitest.build.config.ts" "$TARGET_DIR/"
cp "$SCRIPT_DIR/tsconfig.json" "$TARGET_DIR/"
cp "$SCRIPT_DIR/tsconfig.app.json" "$TARGET_DIR/"
cp "$SCRIPT_DIR/postcss.config.js" "$TARGET_DIR/"
cp "$SCRIPT_DIR/package.json" "$TARGET_DIR/"

# Make scripts executable
chmod +x "$TARGET_DIR/.github/scripts/check-test-coverage.sh"

# Update package.json with project name
if command -v sed &>/dev/null; then
  sed -i "s/\"name\": \"vite-react-template\"/\"name\": \"$PROJECT_NAME\"/" "$TARGET_DIR/package.json"
fi

# Create minimal source structure
mkdir -p "$TARGET_DIR/src/components/ui"
mkdir -p "$TARGET_DIR/src/pages"
mkdir -p "$TARGET_DIR/src/hooks"
mkdir -p "$TARGET_DIR/src/lib"
mkdir -p "$TARGET_DIR/public"

# Create minimal entry files if they don't exist
if [ ! -f "$TARGET_DIR/src/main.tsx" ]; then
  cat > "$TARGET_DIR/src/main.tsx" << 'MAIN'
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
MAIN
fi

if [ ! -f "$TARGET_DIR/src/App.tsx" ]; then
  cat > "$TARGET_DIR/src/App.tsx" << 'APP'
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Hello World</div>} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
APP
fi

if [ ! -f "$TARGET_DIR/src/index.css" ]; then
  cat > "$TARGET_DIR/src/index.css" << 'CSS'
@tailwind base;
@tailwind components;
@tailwind utilities;
CSS
fi

if [ ! -f "$TARGET_DIR/src/lib/utils.ts" ]; then
  cat > "$TARGET_DIR/src/lib/utils.ts" << 'UTILS'
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
UTILS
fi

if [ ! -f "$TARGET_DIR/src/vite-env.d.ts" ]; then
  echo '/// <reference types="vite/client" />' > "$TARGET_DIR/src/vite-env.d.ts"
fi

if [ ! -f "$TARGET_DIR/index.html" ]; then
  cat > "$TARGET_DIR/index.html" << 'HTML'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
HTML
fi

# Create .gitignore
if [ ! -f "$TARGET_DIR/.gitignore" ]; then
  cat > "$TARGET_DIR/.gitignore" << 'GITIGNORE'
node_modules
dist
dist-ssr
*.local
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
.claude/
GITIGNORE
fi

# Initialize git repo
cd "$TARGET_DIR"
if [ ! -d .git ]; then
  git init
  echo "Initialized git repository."
fi

echo ""
echo "Project '$PROJECT_NAME' created at $TARGET_DIR"
echo ""
echo "Next steps:"
echo "  cd $TARGET_DIR"
echo "  npm install"
echo "  npm run dev"
echo ""
echo "Quality commands:"
echo "  npm test          # Run unit tests"
echo "  npm run lint      # Run linter"
echo "  npm run typecheck # Type check"
echo "  npm run build     # Production build"
echo "  npm run test:build # Build verification tests"
