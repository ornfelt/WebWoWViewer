#!/usr/bin/env node
// Runtime-equivalence check for the js-ts-webwowviewer port.
//
// For every ported .ts file, strips the types from it and from the original .js it replaced
// (both through the same ts.transpileModule call, comments removed), normalizes relative
// module specifiers (./foo.js, ./foo.ts and ./foo all become ./foo) and compares the two.
// Identical output means the port added types and nothing else.
//
// Usage, from the repository root:
//   node .claude/skills/js-ts-webwowviewer/compare-emit.mjs <file.ts> [<file.ts> ...]
//   node .claude/skills/js-ts-webwowviewer/compare-emit.mjs <new.ts>=<old.js>   # renamed file
//   node .claude/skills/js-ts-webwowviewer/compare-emit.mjs --all               # every ported file
//
// The original .js is read from the working tree if it still exists, else from HEAD, else from
// the parent of the last commit that touched it (the commit that deleted it).
//
// Exit code: 0 when every file matches, 1 when any differs, 2 on usage / setup errors.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = process.cwd();

function loadTypeScript() {
  const candidates = [process.env.TYPESCRIPT_PATH, path.join(root, "package.json")].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const req = createRequire(candidate.endsWith(".json") ? candidate : path.join(candidate, "x.js"));
      return req("typescript");
    } catch {
      // try the next candidate
    }
  }
  console.error("typescript is not installed in this repository - run the skill's setup mode first.");
  process.exit(2);
}

const ts = loadTypeScript();
if (!ts.transpileModule) {
  console.error(`typescript ${ts.version} has no transpileModule - pin typescript to ^5 (see SKILL.md).`);
  process.exit(2);
}

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function readOriginal(jsPath) {
  if (existsSync(path.join(root, jsPath))) {
    return readFileSync(path.join(root, jsPath), "utf8");
  }
  try {
    return git(["show", `HEAD:${jsPath}`]);
  } catch {
    // deleted before HEAD - fall through
  }
  const last = git(["log", "-1", "--format=%H", "--", jsPath]).trim();
  if (!last) {
    return null;
  }
  try {
    return git(["show", `${last}^:${jsPath}`]);
  } catch {
    return null;
  }
}

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
  const out = ts.transpileModule(source, { compilerOptions: options, fileName }).outputText;
  return out
    .replace(specifier, (_m, q, spec) => `${q}${spec}${q}`)
    .replace(/'/g, '"')
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function collapse(lines) {
  return lines.join("").replace(/\s+/g, "");
}

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

let pairs = process.argv.slice(2);
if (pairs.length === 0) {
  console.error("usage: compare-emit.mjs <file.ts>[=<original.js>] ... | --all");
  process.exit(2);
}
if (pairs.includes("--all")) {
  pairs = git(["ls-files", "--cached", "--others", "--exclude-standard", "--", "src"])
    .split("\n")
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".d.ts"));
}

let failed = 0;
for (const pair of pairs) {
  const [tsPath, fromArg] = pair.split("=");
  const jsPath = fromArg ?? tsPath.replace(/\.ts$/, ".js");
  if (!existsSync(path.join(root, tsPath))) {
    console.log(`MISSING   ${tsPath}`);
    failed++;
    continue;
  }
  const original = readOriginal(jsPath);
  if (original === null) {
    console.log(`NO-ORIGIN ${tsPath} (no ${jsPath} in the tree or history - pass <new.ts>=<old.js>)`);
    continue;
  }
  const before = strip(original, jsPath);
  const after = strip(readFileSync(path.join(root, tsPath), "utf8"), tsPath);
  if (collapse(before) === collapse(after)) {
    console.log(`SAME      ${tsPath}`);
    continue;
  }
  failed++;
  console.log(`DIFFERS   ${tsPath}  (vs ${jsPath}; - original, + port)`);
  for (const line of diff(before, after)) {
    console.log(line);
  }
}
process.exit(failed > 0 ? 1 : 0);
