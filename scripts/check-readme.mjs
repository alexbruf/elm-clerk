#!/usr/bin/env node
// Doc-driven test from SPEC.md section 12: the README's code samples must
// stay honest. No dependencies.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

const failures = []
const passes = []

function fail(message) {
  failures.push(message)
}

function pass(message) {
  passes.push(message)
}

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8')
}

function normalize(text) {
  // Trailing-newline tolerant, byte-for-byte otherwise.
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '')
}

/** Find a fenced code block whose info string is exactly `lang title=name`
 * (e.g. "elm title=Ports.elm"), tolerating extra whitespace. Returns the
 * block's inner text, or null if not found. */
function extractFencedBlock(markdown, lang, title) {
  const infoString = `${lang} title=${title}`
  const lines = markdown.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const fenceMatch = /^(```+)\s*(.*)$/.exec(lines[i].trim())
    if (!fenceMatch) continue
    const info = fenceMatch[2].replace(/\s+/g, ' ').trim()
    if (info !== infoString) continue
    const fence = fenceMatch[1]
    const closeIndex = lines.findIndex(
      (line, j) => j > i && line.trim().startsWith(fence)
    )
    if (closeIndex === -1) return null
    return lines.slice(i + 1, closeIndex).join('\n')
  }
  return null
}

const readmePath = 'README.md'
let readme
try {
  readme = read(readmePath)
} catch {
  fail(`${readmePath} not found at repo root`)
  printReport()
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Ports.elm block == example/src/Ports.elm, byte-for-byte (trailing newline
// tolerant).
// ---------------------------------------------------------------------------

const portsBlock = extractFencedBlock(readme, 'elm', 'Ports.elm')
if (portsBlock === null) {
  fail('README.md has no fenced ```elm title=Ports.elm code block')
} else {
  let portsFile
  try {
    portsFile = read('example/src/Ports.elm')
  } catch {
    fail('example/src/Ports.elm not found')
    portsFile = null
  }
  if (portsFile !== null) {
    if (normalize(portsBlock) === normalize(portsFile)) {
      pass('README.md\'s Ports.elm block matches example/src/Ports.elm byte-for-byte')
    } else {
      fail(
        "README.md's ```elm title=Ports.elm block does not match example/src/Ports.elm.\n" +
          '--- README block ---\n' +
          portsBlock +
          '\n--- example/src/Ports.elm ---\n' +
          portsFile
      )
    }
  }
}

// ---------------------------------------------------------------------------
// main.ts block: every line containing `attachClerk` must also appear
// (verbatim) in example/src/main.ts.
// ---------------------------------------------------------------------------

const mainTsBlock = extractFencedBlock(readme, 'ts', 'main.ts')
if (mainTsBlock === null) {
  fail('README.md has no fenced ```ts title=main.ts code block')
} else {
  let mainTsFile
  try {
    mainTsFile = read('example/src/main.ts')
  } catch {
    fail('example/src/main.ts not found')
    mainTsFile = null
  }
  if (mainTsFile !== null) {
    const fileLines = new Set(mainTsFile.split('\n').map((l) => l.trim()))
    const relevantLines = mainTsBlock
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('attachClerk'))
    if (relevantLines.length === 0) {
      fail("README.md's ```ts title=main.ts block has no line containing `attachClerk`")
    } else {
      const missing = relevantLines.filter((l) => !fileLines.has(l))
      if (missing.length === 0) {
        pass("every `attachClerk` line in README.md's main.ts block appears in example/src/main.ts")
      } else {
        fail(
          "README.md's ```ts title=main.ts block has attachClerk line(s) not found verbatim " +
            'in example/src/main.ts:\n' +
            missing.map((l) => `  ${l}`).join('\n')
        )
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Install commands mentioned.
// ---------------------------------------------------------------------------

if (readme.includes('elm install alexbruf/elm-clerk')) {
  pass('README.md mentions `elm install alexbruf/elm-clerk`')
} else {
  fail('README.md does not mention `elm install alexbruf/elm-clerk`')
}

if (readme.includes('bun add @viewengine/elm-clerk')) {
  pass('README.md mentions `bun add @viewengine/elm-clerk`')
} else {
  fail('README.md does not mention `bun add @viewengine/elm-clerk`')
}

function printReport() {
  for (const message of passes) {
    console.log(`PASS ${message}`)
  }
  for (const message of failures) {
    console.error(`FAIL ${message}`)
  }
  console.log(`\n${passes.length} passed, ${failures.length} failed`)
}

printReport()
process.exit(failures.length > 0 ? 1 : 0)
