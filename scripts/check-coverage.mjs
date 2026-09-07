#!/usr/bin/env node
// CI gate: coverage.json must agree with the Elm exports, the JS protocol's
// OUTGOING_TAGS tuple, the JS dispatch table, and the Elm resource records.
// See CLAUDE.md ("Adding a tag or field...") and SPEC.md section 7.
//
// No dependencies: everything here is a small hand-rolled scanner, not a
// full Elm/TS parser. It is deliberately tolerant of formatting (multi-line
// elm-format exposing lists, trailing commas, comments) rather than exact.

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

function readMaybe(relPath) {
  try {
    return readFileSync(path.join(root, relPath), 'utf8')
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Generic scanners
// ---------------------------------------------------------------------------

/** Find the index of `openChar` at or after `fromIndex`, then walk forward
 * to the matching `closeChar`, respecting nesting of ( [ { and skipping over
 * string/char literals so brackets inside strings don't confuse depth. */
function extractBalanced(source, fromIndex, openChar, closeChar) {
  const start = source.indexOf(openChar, fromIndex)
  if (start === -1) return null
  let depth = 0
  let inString = null
  for (let i = start; i < source.length; i++) {
    const ch = source[i]
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      continue
    }
    if (ch === openChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        return { content: source.slice(start + 1, i), start, end: i }
      }
    }
  }
  return null
}

/** Split `content` on `separator` only at nesting depth 0, ignoring
 * separators inside ()/[]/{} or string literals. */
function splitTopLevel(content, separator = ',') {
  const parts = []
  let depth = 0
  let current = ''
  let inString = null
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      current += ch
      if (ch === '\\') {
        current += content[++i] ?? ''
        continue
      }
      if (ch === inString) inString = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch
      current += ch
      continue
    }
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    if (ch === separator && depth === 0) {
      parts.push(current)
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim() !== '') parts.push(current)
  return parts
}

function stripLineComments(source) {
  return source
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

// ---------------------------------------------------------------------------
// Elm: module Clerk exposing ( ... )
// ---------------------------------------------------------------------------

function parseElmExposing(source, moduleName) {
  const cleaned = stripLineComments(source)
  const marker = new RegExp(`module\\s+${moduleName}\\s+exposing`)
  const m = marker.exec(cleaned)
  if (!m) return null
  const balanced = extractBalanced(cleaned, m.index + m[0].length, '(', ')')
  if (!balanced) return null
  return splitTopLevel(balanced.content)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      // "State(..)" / "State(Loading, SignedOut)" -> "State"
      const parenIdx = item.indexOf('(')
      const name = parenIdx === -1 ? item : item.slice(0, parenIdx)
      return name.trim()
    })
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Elm: type alias Foo = { field : Type, ... }
// ---------------------------------------------------------------------------

function parseElmRecordFields(source, aliasName) {
  const cleaned = stripLineComments(source)
  const marker = new RegExp(`type\\s+alias\\s+${aliasName}\\s*=`)
  const m = marker.exec(cleaned)
  if (!m) return null
  const balanced = extractBalanced(cleaned, m.index + m[0].length, '{', '}')
  if (!balanced) return null
  return splitTopLevel(balanced.content)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => item.split(':')[0].trim())
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// TS: export const OUTGOING_TAGS = [ 'a', 'b', ... ] as const
// ---------------------------------------------------------------------------

function parseOutgoingTags(source) {
  const marker = /OUTGOING_TAGS\s*(?::[^=]+)?=/
  const m = marker.exec(source)
  if (!m) return null
  const balanced = extractBalanced(source, m.index + m[0].length, '[', ']')
  if (!balanced) return null
  const tags = []
  const re = /['"`]([^'"`]+)['"`]/g
  let mm
  while ((mm = re.exec(balanced.content))) {
    tags.push(mm[1])
  }
  return tags
}

// ---------------------------------------------------------------------------
// TS: const handlers: Record<OutgoingTag, ...> = { signOut: ..., ... }
// ---------------------------------------------------------------------------

function parseHandlerKeys(source) {
  const marker = /\bhandlers\s*(?::[^=]+)?=/
  const m = marker.exec(source)
  if (!m) return null
  const balanced = extractBalanced(source, m.index + m[0].length, '{', '}')
  if (!balanced) return null
  const keys = []
  for (const part of splitTopLevel(balanced.content)) {
    const keyMatch = /^\s*([A-Za-z_$][A-Za-zA-Z0-9_$]*)\s*:/.exec(part)
    if (keyMatch) keys.push(keyMatch[1])
  }
  return keys
}

// ---------------------------------------------------------------------------
// semver helpers (major.minor.patch only)
// ---------------------------------------------------------------------------

function parseSemver(v) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(v)
  if (!m) return null
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) }
}

function semverGte(a, b) {
  if (a.major !== b.major) return a.major > b.major
  if (a.minor !== b.minor) return a.minor > b.minor
  return a.patch >= b.patch
}

// ---------------------------------------------------------------------------
// Load inputs
// ---------------------------------------------------------------------------

const coverageRaw = readMaybe('coverage.json')
if (!coverageRaw) {
  console.error('FAIL coverage.json not found at repo root')
  process.exit(1)
}
const coverage = JSON.parse(coverageRaw)

const clerkElmSource = readMaybe('elm/src/Clerk.elm')
const protocolTsSource = readMaybe('js/src/protocol.ts')
const indexTsSource = readMaybe('js/src/index.ts')
const jsPackageRaw = readMaybe('js/package.json')

const resourceFiles = {
  User: 'elm/src/Clerk/User.elm',
  Session: 'elm/src/Clerk/Session.elm',
  Organization: 'elm/src/Clerk/Organization.elm',
}

let missingSource = false
for (const [label, src] of [
  ['elm/src/Clerk.elm', clerkElmSource],
  ['js/src/protocol.ts', protocolTsSource],
  ['js/src/index.ts', indexTsSource],
  ['js/package.json', jsPackageRaw],
]) {
  if (src === null) {
    fail(`missing source file: ${label}`)
    missingSource = true
  }
}
for (const [name, relPath] of Object.entries(resourceFiles)) {
  if (readMaybe(relPath) === null) {
    fail(`missing source file: ${relPath} (needed to check resources.${name})`)
    missingSource = true
  }
}

if (missingSource) {
  printReport()
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Parse everything
// ---------------------------------------------------------------------------

const exposedByClerkElm = new Set(parseElmExposing(clerkElmSource, 'Clerk') ?? [])
if (exposedByClerkElm.size === 0) {
  fail('could not parse `module Clerk exposing (...)` from elm/src/Clerk.elm')
}

const outgoingTags = new Set(parseOutgoingTags(protocolTsSource) ?? [])
if (outgoingTags.size === 0) {
  fail('could not parse `OUTGOING_TAGS` tuple from js/src/protocol.ts')
}

const handlerKeys = new Set(parseHandlerKeys(indexTsSource) ?? [])
if (handlerKeys.size === 0) {
  fail('could not parse `handlers` object keys from js/src/index.ts')
}

const jsPackage = JSON.parse(jsPackageRaw)

// ---------------------------------------------------------------------------
// Check: methods appear in exactly one of implemented/deferred/wontImplement
// ---------------------------------------------------------------------------

const methods = coverage.methods ?? {}
const implemented = methods.implemented ?? []
const deferred = methods.deferred ?? []
const wontImplement = methods.wontImplement ?? []

const lists = { implemented, deferred, wontImplement }
const membership = new Map() // method -> [listNames]
for (const [listName, items] of Object.entries(lists)) {
  for (const item of items) {
    if (!membership.has(item)) membership.set(item, [])
    membership.get(item).push(listName)
  }
}
let duplicateFound = false
for (const [item, listNames] of membership) {
  if (listNames.length > 1) {
    fail(`method "${item}" appears in more than one list: ${listNames.join(', ')}`)
    duplicateFound = true
  }
}
if (!duplicateFound) pass('every method appears in exactly one of implemented/deferred/wontImplement')

// ---------------------------------------------------------------------------
// Check: every wontImplement entry has a notes string
// ---------------------------------------------------------------------------

const notes = coverage.notes ?? {}
let notesOk = true
for (const item of wontImplement) {
  if (typeof notes[item] !== 'string' || notes[item].trim() === '') {
    fail(`wontImplement entry "${item}" has no non-empty string in notes`)
    notesOk = false
  }
}
if (notesOk) pass('every wontImplement entry has a notes string')

// ---------------------------------------------------------------------------
// Check: every implemented method has a valid bindings entry
// ---------------------------------------------------------------------------

const bindings = coverage.bindings ?? {}
let bindingsOk = true
for (const method of implemented) {
  const binding = bindings[method]
  if (!binding) {
    fail(`implemented method "${method}" has no entry in coverage.bindings`)
    bindingsOk = false
    continue
  }
  if (!binding.elm || !exposedByClerkElm.has(binding.elm)) {
    fail(
      `bindings.${method}.elm ("${binding.elm}") is not exposed by ` +
        `\`module Clerk exposing (...)\` in elm/src/Clerk.elm`
    )
    bindingsOk = false
  }
  if (!binding.tag || !outgoingTags.has(binding.tag)) {
    fail(`bindings.${method}.tag ("${binding.tag}") is not in OUTGOING_TAGS (js/src/protocol.ts)`)
    bindingsOk = false
  }
  if (!binding.tag || !handlerKeys.has(binding.tag)) {
    fail(`bindings.${method}.tag ("${binding.tag}") is not a key of \`handlers\` (js/src/index.ts)`)
    bindingsOk = false
  }
}
if (bindingsOk) pass('every implemented method has a valid bindings entry (elm export + tag in OUTGOING_TAGS + handlers)')

// ---------------------------------------------------------------------------
// Check: no tag in OUTGOING_TAGS/handlers lacks a binding
// ---------------------------------------------------------------------------

const boundTags = new Set(Object.values(bindings).map((b) => b.tag))
let undocumentedFound = false
for (const tag of outgoingTags) {
  if (!boundTags.has(tag)) {
    fail(`tag "${tag}" is in OUTGOING_TAGS but has no coverage.bindings entry (undocumented surface)`)
    undocumentedFound = true
  }
}
for (const tag of handlerKeys) {
  if (!boundTags.has(tag)) {
    fail(`tag "${tag}" is a key of \`handlers\` but has no coverage.bindings entry (undocumented surface)`)
    undocumentedFound = true
  }
}
if (!undocumentedFound) pass('every tag in OUTGOING_TAGS and handlers has a coverage.bindings entry')

// ---------------------------------------------------------------------------
// Check: resource field lists equal the Elm record fields
// ---------------------------------------------------------------------------

for (const [name, relPath] of Object.entries(resourceFiles)) {
  const src = readMaybe(relPath)
  const elmFields = parseElmRecordFields(src, name)
  if (!elmFields) {
    fail(`could not parse \`type alias ${name} = { ... }\` from ${relPath}`)
    continue
  }
  const manifestFields = coverage.resources?.[name]?.fields
  if (!Array.isArray(manifestFields)) {
    fail(`coverage.json has no resources.${name}.fields array`)
    continue
  }
  const elmSet = new Set(elmFields)
  const manifestSet = new Set(manifestFields)
  const onlyInElm = [...elmSet].filter((f) => !manifestSet.has(f))
  const onlyInManifest = [...manifestSet].filter((f) => !elmSet.has(f))
  if (onlyInElm.length || onlyInManifest.length) {
    fail(
      `resources.${name}.fields disagrees with ${relPath}: ` +
        `only in Elm record [${onlyInElm.join(', ')}], ` +
        `only in coverage.json [${onlyInManifest.join(', ')}]`
    )
  } else {
    pass(`resources.${name}.fields matches the Elm record in ${relPath}`)
  }
}

// ---------------------------------------------------------------------------
// Check: clerkJsVersion is satisfied by the caret range in js/package.json
// ---------------------------------------------------------------------------

const pinnedRange = jsPackage.dependencies?.['@clerk/clerk-js']
if (!pinnedRange) {
  fail('js/package.json has no dependencies["@clerk/clerk-js"]')
} else {
  const caretMatch = /^\^(\d+\.\d+\.\d+)/.exec(pinnedRange.trim())
  if (!caretMatch) {
    fail(`js/package.json's @clerk/clerk-js range ("${pinnedRange}") is not a caret range; expected "^X.Y.Z"`)
  } else {
    const floor = parseSemver(caretMatch[1])
    const manifestVersion = parseSemver(coverage.clerkJsVersion ?? '')
    if (!manifestVersion) {
      fail(`coverage.json's clerkJsVersion ("${coverage.clerkJsVersion}") is not a valid semver`)
    } else if (manifestVersion.major !== floor.major) {
      fail(
        `coverage.json's clerkJsVersion ("${coverage.clerkJsVersion}") has a different major ` +
          `version than js/package.json's @clerk/clerk-js range ("${pinnedRange}")`
      )
    } else if (!semverGte(manifestVersion, floor)) {
      fail(
        `coverage.json's clerkJsVersion ("${coverage.clerkJsVersion}") is below the floor of ` +
          `js/package.json's @clerk/clerk-js range ("${pinnedRange}")`
      )
    } else {
      pass(`clerkJsVersion ("${coverage.clerkJsVersion}") satisfies js/package.json's range ("${pinnedRange}")`)
    }
  }
}

// ---------------------------------------------------------------------------
// Check 7: clerkUiMajor matches the major the shim asks the CDN for
// ---------------------------------------------------------------------------

{
  const uiSource = readMaybe('js/src/ui.ts')
  const match = uiSource ? /export const CLERK_UI_MAJOR\s*=\s*(\d+)/.exec(uiSource) : null
  if (!match) {
    fail('could not find `export const CLERK_UI_MAJOR = <n>` in js/src/ui.ts')
  } else if (Number(match[1]) !== Number(coverage.clerkUiMajor)) {
    fail(
      `coverage.json's clerkUiMajor (${coverage.clerkUiMajor}) differs from CLERK_UI_MAJOR ` +
        `(${match[1]}) in js/src/ui.ts`
    )
  } else {
    pass(`clerkUiMajor (${coverage.clerkUiMajor}) matches CLERK_UI_MAJOR in js/src/ui.ts`)
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

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
