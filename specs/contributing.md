# Contributing

This repository follows spec-driven development.
Before implementing any change, update the relevant specification files, then implement the change according to the updated specifications.

Follow [Conventions](conventions.md) for package boundaries, UI composition, state management, authentication and translations.

Keep one React component per source file. Place each component in its own file and import it where needed.

Keep component styles in separate stylesheets alongside the components that use them, and import those styles from the corresponding component. Keep shared and global styles in dedicated stylesheets. Avoid duplicating rules and remove styles and imports that are no longer used. Preserve existing styling, responsive behavior, CSS specificity, cascade order, and style precedence when moving rules.

### Component Style Colocation

- Keep component-specific styles colocated with their React components.
- Each component should have its own stylesheet (e.g., `ComponentName.tsx` → `ComponentName.scss`) imported directly into the component.
- Do not place component-specific styles in global stylesheets.
- Global stylesheets should contain only resets, typography, design tokens, CSS variables, and truly application-wide styles.
- When refactoring, move existing component-specific CSS rules into the corresponding component stylesheets.
- Avoid duplicating CSS rules. Extract genuinely shared styles into dedicated shared stylesheets when necessary.
- Preserve existing appearance, responsive behavior, and functionality, including CSS specificity, cascade order, and style precedence.
- Prefer locally scoped class names to avoid collisions. Importing a regular CSS or SCSS file does not automatically scope its styles.

Do not use Zod or add it as a dependency anywhere in the repository. Use class-validator/class-transformer for server request validation. Shared contracts use typed models directly, without runtime parsers or client validation.

Separate top-level `const` (including `declare const`), `enum`, `type`, and `interface` declarations from the next declaration with a blank line. Add a short JSDoc comment before each interface explaining its purpose.

Separate function declarations from preceding code with a blank line (before their JSDoc, when present). Add a short JSDoc comment describing the purpose of every module-level function declaration, including non-exported helpers.

Require a blank line before function declarations (before attached JSDoc) and before `if` and `return` statements when another statement precedes them in the same block. Require a blank line after each complete `if` statement when another statement follows in the same block. Do not insert blank lines at the start of a block or between an unbraced `if` and its body. Enforce statement spacing with ESLint Stylistic alongside Prettier in format, format:check and the staged-file hook.

Keep large static lookup tables, configuration objects and arrays at module scope, outside functions, when they do not depend on function arguments or local state.

Prefer module-level constant lookup maps over nested ternary operators when selecting values by a fixed key. Use explicit `if` statements for ordered conditions or predicates that do not fit a lookup map. Do not use nested ternary operators; enforce this with ESLint in formatting checks and the staged-file hook.

Prefer string enums over `as const` arrays with derived union types for named sets of values. Use `Object.values(EnumName)` when an array is needed for validation; preserve existing serialized values.

Use Prettier for supported source, configuration and documentation files. Run `pnpm format` to format the repository and `pnpm format:check` to check it. Exclude generated files, build output, dependency lockfiles and local environment files. Install Git hooks through the root `prepare` script; the pre-commit hook must format staged files with lint-staged, preserving unstaged changes and blocking commits on formatting failures. CI must run the formatting check.

Write tests only when they verify meaningful behavior or prevent regressions. Avoid redundant tests and tests that merely mirror the implementation.

Use primitive types (`string`, `number`, etc.) directly instead of branded types or aliases for individual IDs, timestamps, versions and cursors.
