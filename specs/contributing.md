# Contributing

## Workflow

1. Update the affected specification before changing implementation.
2. Follow [Conventions](conventions.md) and the repository [coding rules](../AGENTS.md).
3. Run relevant checks and record actual evidence in the [checklist](../implementation/requirement-checklist.md).

## Code conventions

Keep one named React component per folder/file; index files only re-export.
Use the model placement, validation, function documentation, spacing and constant
rules in [AGENTS.md](../AGENTS.md). Never add Zod.

Separate top-level const/enum/type/interface declarations with blank lines and document
interfaces. Prefer string enums over derived `as const` value sets; use
`Object.values(EnumName)` and preserve serialized values. Keep individual IDs,
timestamps, versions and cursors as primitives.

### Component Style Colocation

Import component-specific styles directly from a neighboring stylesheet. Globals
contain resets, typography, tokens and truly application-wide styles only.
Extract genuinely shared styles without duplication; regular CSS/SCSS imports do
not scope classes. Refactors preserve appearance, responsive behavior, specificity,
cascade and functionality. See [style rules](../AGENTS.md#style-rules).

## Formatting and checks

Use `pnpm format` and `pnpm format:check` for ESLint Stylistic and Prettier checks,
including statement spacing and the ban on nested ternaries. Exclude generated files,
build output, lockfiles and local environment files. The root `prepare` script installs
Husky; lint-staged formats staged files, preserves unstaged edits and blocks failures.
CI runs the formatting check. Test meaningful behavior/regressions, not copies of the
implementation or third-party internals.

## Specification format

- Give each file one responsibility; link to shared rules instead of restating them.
- Start feature specs with Purpose, then Requirements and Verification. Use short headings without repeated “Capability” or “Requirement” prefixes.
- Write short, testable rules in plain language. Requirements are mandatory unless explicitly optional.
- Preserve existing requirement IDs and update links when headings move.
- Use tables for mappings, limits and comparisons; keep independent rules in short paragraphs or lists.
- Keep technologies in Stack, engineering rules in Conventions, product behavior in Functionality, and provider differences in integration specs.
- Keep protocol/design decisions under `implementation/`, delivery evidence in its checklist, and optional ideas in Plans.
- Label assumptions/open decisions. Do not silently resolve conflicts or claim fixtures prove live provider availability.
