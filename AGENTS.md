# SDD

[Important rules for making changes](specs/index.md)

# Validation rules

Do not use Zod or add it as a dependency anywhere in the repository. Use class-validator/class-transformer for server request validation. Shared contracts use typed models directly, without runtime parsers or client validation.

# Function declaration rules

Separate function declarations from preceding code with a blank line (before their JSDoc, when present). Add a short JSDoc comment describing the purpose of every module-level function declaration, including non-exported helpers.

Require a blank line before function declarations (before attached JSDoc) and before `if` and `return` statements when another statement precedes them in the same block. Require a blank line after each complete `if` statement when another statement follows in the same block. Do not insert blank lines at the start of a block or between an unbraced `if` and its body. Enforce statement spacing with ESLint Stylistic alongside Prettier in format, format:check and the staged-file hook.

# Constant declaration rules

Keep large static lookup tables, configuration objects and arrays at module scope, outside functions, when they do not depend on function arguments or local state.

Prefer module-level constant lookup maps over nested ternary operators when selecting values by a fixed key. Use explicit `if` statements for ordered conditions or predicates that do not fit a lookup map. Do not use nested ternary operators; enforce this with ESLint in formatting checks and the staged-file hook.

# Style rules

Place each React component in its own named folder, with a source file named for the component (for example, `library-browser/library-browser.tsx`). Never declare a React component in an `index.ts` or `index.tsx` file; use index files only to re-export modules. Put shared model declarations (enums, model constants, interfaces, and types used across modules) in a `models/` directory. Put a model used by only one component in that component's folder in a file prefixed with `model-` (for example, `model-library-browser.ts`).

These rules apply to styles throughout the repository.

1. Keep mobile and other responsive overrides inside the corresponding selector block, alongside its base declarations. Do not collect mobile overrides in a separate media-query section at the end of the stylesheet.
2. Separate style groups with a blank line: between selector blocks, before nested selectors or media queries, and after nested blocks when another group follows.
3. Prefer class selectors over element selectors. Add descriptive classes to template elements instead of styling tags such as `h1`, `p`, or `button`. Use element selectors only when a class-based approach would be impractical, such as global resets or styling markup outside the application's control.
4. Keep component styles in separate stylesheets alongside the components that use them, and import those styles from the corresponding component. Keep shared and global styles in dedicated stylesheets. Avoid duplicating rules and remove styles and imports that are no longer used. Preserve existing styling, responsive behavior, CSS specificity, cascade order, and style precedence when moving rules.

For example:

```scss
.brand {
  display: flex;
  align-items: center;
  gap: 26px;
  margin-bottom: 40px;

  @media (max-width: 600px) {
    gap: 18px;
    margin-bottom: 30px;
  }

  &-title {
    margin: 0 0 3px;
    font-size: 36px;
    line-height: 1.2;
    letter-spacing: -1px;

    @media (max-width: 600px) {
      font-size: 30px;
    }
  }

  &-description {
    margin: 0;
    color: #818896;
    font-size: 20px;

    @media (max-width: 600px) {
      font-size: 17px;
    }
  }
}
```

### Component Style Colocation

- Keep component-specific styles colocated with their React components.
- Each component should have its own stylesheet (e.g., `ComponentName.tsx` → `ComponentName.scss`) imported directly into the component.
- Do not place component-specific styles in global stylesheets.
- Global stylesheets should contain only resets, typography, design tokens, CSS variables, and truly application-wide styles.
- When refactoring, move existing component-specific CSS rules into the corresponding component stylesheets.
- Avoid duplicating CSS rules. Extract genuinely shared styles into dedicated shared stylesheets when necessary.
- Preserve existing appearance, responsive behavior, and functionality, including CSS specificity, cascade order, and style precedence.
- Prefer locally scoped class names to avoid collisions. Importing a regular CSS or SCSS file does not automatically scope its styles.

# Testing rules

Write tests only when they verify meaningful behavior or prevent regressions. Avoid redundant tests and tests that merely mirror the implementation.

Use primitive types (`string`, `number`, etc.) directly instead of branded types or aliases for individual IDs, timestamps, versions and cursors.
