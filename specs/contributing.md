# Contributing

## Workflow

1. Update the affected spec before you change the implementation.
2. Follow [Conventions](conventions.md) and the repository rules in [AGENTS.md](../AGENTS.md).
3. Run the relevant checks. Record the actual results in the [checklist](../implementation/requirement-checklist.md).

### Change size

- A bug fix, a refactor or a new test that keeps the documented behavior does not need a spec update or a checklist entry.
- Update the spec first when a change adds or changes behavior, a public API, a shared model or a database schema.
- Update the spec first when a change touches three or more files and changes behavior.

### Plan step workflow

Use these steps for any agent or person who delivers a step of the [implementation plan](../implementation/implementation-plan.md).

1. Read the step in the plan. Read the specs, code and tests that its context lists. Search other code only when the list is not sufficient.
2. Find conflicts between the specs and the open decisions. Ask the owner about each one. Do not resolve them silently.
3. Update the specs. Then implement the open items of the step.
4. Run the checks in [Local checks](#local-checks) that apply to the changed code.
5. Mark the done items in the plan. Record the status and the actual results in the checklist.
6. Update the context of the step when the specs, code or tests that it needs change.

### Local checks

| Check                      | Command                                      |
| -------------------------- | -------------------------------------------- |
| Format and lint            | `pnpm format:check`, or `pnpm format` to fix |
| Types                      | `pnpm typecheck`                             |
| Unit tests                 | `pnpm test`                                  |
| Package boundaries         | `pnpm check:boundaries`                      |
| Database integration tests | `pnpm test:integration`                      |
| Browser tests              | `pnpm test:e2e`                              |
| Live page rule checks      | `pnpm test:page-rules`                       |

Database integration tests need a dedicated PostgreSQL 17 test database. They do not read `apps/api/.env`.

1. Start PostgreSQL with `pnpm db:start`.
2. Create a test database once, for example `createdb filecab_test`.
3. Set `DATABASE_URL` to that database and set `NODE_ENV=test` in the shell.
4. Apply the migrations with `pnpm db:deploy`.
5. Run `pnpm test:integration`.

Live page rule checks load the real sites. They are not part of `pnpm test:e2e`. Run them manually after a change to `page-rules.json` or `apps/extension/src/page/extract-page.ts`, and before the merge of that change.

Some sites need a sign-in or a browser check. These cases use a local browser profile:

1. Set `FILECAB_PAGE_RULES_PROFILE` to a local directory outside the repository.
2. Run `pnpm test:page-rules:sign-in`, sign in on each tab, then close the browser.
3. Run `pnpm test:page-rules` with the same variable. Without the variable, the run skips these cases.

Every migration folder in `apps/api/prisma/migrations/` must contain `migration.sql`. An empty folder stops `pnpm db:deploy` with error P3015.

## Code rules

[AGENTS.md](../AGENTS.md) owns the code, model placement, validation, function, constant,
style and test rules. These rules add to it:

- Separate top-level `const`, `enum`, `type` and `interface` declarations with blank lines. Document interfaces.
- Prefer string enums to derived `as const` value sets. Use `Object.values(EnumName)`. Keep serialized values.
- Keep individual IDs, timestamps, versions and cursors as primitives.
- TypeScript checks unused local declarations and parameters. Remove unused imports and components that no application or test uses.
- Keep models that the documented public contract requires.

## Formatting and checks

- `pnpm format` and `pnpm format:check` run ESLint Stylistic and Prettier, including statement spacing and the nested-ternary ban.
- Exclude generated files, build output, lockfiles and local environment files.
- The root `prepare` script installs Husky. lint-staged formats staged files, keeps unstaged edits and blocks failures.
- CI runs the formatting check.
- Test meaningful behavior and regressions. Do not test copies of the implementation or third-party internals.

## Specification format

- Write specs in ASD-STE100: short sentences, one instruction in each sentence, active voice. Do not use slash lists such as "edit/delete".
- Give each file one responsibility. Link to shared rules. Do not repeat them.
- Start each feature spec with Purpose, then Requirements, then Verification. Use short headings.
- Write short, testable rules. Requirements are mandatory unless marked optional.
- Keep requirement IDs. Update links when headings move.
- Use tables for mappings, limits and comparisons.
- Technologies go in [Stack](stack.md). Engineering rules go in [Conventions](conventions.md). Product behavior goes in [Functionality](functionality.md). Provider differences go in integration specs. Optional ideas go in [Plans](plans.md).
- `specs/` holds all normative rules, including protocol and design decisions.
- `implementation/` holds only the delivery plan, the checklist with status and evidence, and check reports. Do not put rules there.
- Do not keep dated investigation logs in specs. Keep only the resulting rule. Record evidence in the checklist.
- Label assumptions and open decisions. Do not resolve conflicts silently. Fixtures do not prove live provider availability.
