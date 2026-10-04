#!/usr/bin/env node
// Checks that the TypeScript branch (new-clean-ts) and the JavaScript branch (new-clean) still run
// the same code after a feature / fix has been applied to both.
//
// For every .ts file, strips the types from it and from the .js file at the same path on the other
// branch (both through the same ts.transpileModule call, comments removed), normalizes relative
// module specifiers (./foo.js, ./foo.ts and ./foo all become ./foo) and compares the two.
//
// The side whose branch is checked out is read from the working tree (so uncommitted work is
// included); the other side is read from its branch with `git show <branch>:<path>`.
//
// Usage, from the repository root, on either branch:
//   node .claude/skills/cs-feature-webwowviewer/compare-branches.mjs            # every .ts file
//   node .claude/skills/cs-feature-webwowviewer/compare-branches.mjs <file.ts> [<file.ts> ...]
//   ... --ts new-clean-ts --js new-clean                                        # other branch names
//
// Paths are always given as the .ts path; the .js path is the same with .js, except the entry
// point (app_wow.ts <-> app_wowjs.js).
//
// Exit code: 0 when every file matches, 1 when any differs or is missing, 2 on usage / setup errors.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();
const ENTRY_TS = "src/application/angular/app_wow.ts";
const ENTRY_JS = "src/application/angular/app_wowjs.js";

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

let ts;
try {
  ts = createRequire(path.join(root, "package.json"))("typescript");
} catch {
  console.error("typescript is not installed in this repository - run `npm install` on new-clean-ts first.");
  process.exit(2);
}

const args = process.argv.slice(2);
let tsBranch = "new-clean-ts";
let jsBranch = "new-clean";
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--ts") tsBranch = args[++i];
  else if (args[i] === "--js") jsBranch = args[++i];
  else files.push(args[i]);
}

const current = git(["branch", "--show-current"]).trim();
if (current !== tsBranch && current !== jsBranch) {
  console.error(`checked out: '${current}' - expected ${tsBranch} or ${jsBranch}.`);
  process.exit(2);
}

// Read <file> from the working tree when its branch is checked out, else from the branch.
function read(branch, file) {
  if (branch === current) {
    return existsSync(path.join(root, file)) ? readFileSync(path.join(root, file), "utf8") : null;
  }
  try {
    return git(["show", `${branch}:${file}`]);
  } catch {
    return null;
  }
}

function list(branch, ext) {
  const out = branch === current
    ? git(["ls-files", "--cached", "--others", "--exclude-standard", "--", "src"])
    : git(["ls-tree", "-r", "--name-only", branch, "--", "src"]);
  return out.split("\n").filter((f) => f.endsWith(ext) && !f.endsWith(".d.ts")
    && (branch !== current || existsSync(path.join(root, f))));
}

const toJs = (f) => (f === ENTRY_TS ? ENTRY_JS : f.replace(/\.ts$/, ".js"));
const toTs = (f) => (f === ENTRY_JS ? ENTRY_TS : f.replace(/\.js$/, ".ts"));

const options = {
  module: ts.ModuleKind.ESNext,
  target: ts.ScriptTarget.ES2020,
  removeComments: true,
  useDefineForClassFields: false,
  verbatimModuleSyntax: true,
  resolveJsonModule: true,
};

const specifier = /(["'])(\.{1,2}\/[^"'\n]*?)(\.js|\.ts)?\1/g;

function strip(source, fileName) {
  return ts.transpileModule(source, { compilerOptions: options, fileName }).outputText
    .replace(specifier, (_m, q, spec) => `${q}${spec}${q}`)
    .replace(/'/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line !== "export {};");
}

const collapse = (lines) => lines.join("").replace(/\s+/g, "");

function diff(a, b) {
  // Small LCS line diff - files here are at most a few thousand lines.
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const lines = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push(`  - ${a[i++]}`);
    } else {
      lines.push(`  + ${b[j++]}`);
    }
  }
  while (i < n) lines.push(`  - ${a[i++]}`);
  while (j < m) lines.push(`  + ${b[j++]}`);
  return lines;
}

const all = files.length === 0;
const tsFiles = all ? list(tsBranch, ".ts") : files.map((f) => (f.endsWith(".js") ? toTs(f) : f));

let failed = 0;
for (const tsPath of tsFiles) {
  const jsPath = toJs(tsPath);
  const tsSource = read(tsBranch, tsPath);
  const jsSource = read(jsBranch, jsPath);
  if (tsSource === null) {
    console.log(`MISSING   ${tsPath} (not on ${tsBranch})`);
    failed++;
    continue;
  }
  const after = strip(tsSource, tsPath);
  if (jsSource === null) {
    if (after.length === 0) {
      console.log(`TYPE-ONLY ${tsPath} (emits nothing, no .js needed)`);
    } else {
      console.log(`MISSING   ${jsPath} (not on ${jsBranch})`);
      failed++;
    }
    continue;
  }
  const before = strip(jsSource, jsPath);
  if (collapse(before) === collapse(after)) {
    console.log(`SAME      ${tsPath}`);
    continue;
  }
  failed++;
  console.log(`DIFFERS   ${tsPath}  (- ${jsBranch}:${jsPath}, + ${tsBranch}:${tsPath})`);
  for (const line of diff(before, after)) {
    console.log(line);
  }
}

if (all) {
  const tsSet = new Set(tsFiles);
  for (const jsPath of list(jsBranch, ".js")) {
    if (!tsSet.has(toTs(jsPath))) {
      console.log(`JS-ONLY   ${jsPath} (no .ts on ${tsBranch})`);
    }
  }
}

process.exit(failed > 0 ? 1 : 0);
