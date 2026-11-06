# SDD

[Important rules for making changes](specs/index.md)

# Validation rules

Do not use Zod or add it as a dependency anywhere in the repository. Use class-validator/class-transformer for server request validation. Shared contracts use typed models directly, without runtime parsers or client validation.

# Function declaration rules

Separate function declarations from preceding code with a blank line (before their JSDoc, when present). Add a short JSDoc comment describing the purpose of every module-level function declaration, including non-exported helpers.

Require a blank line before function declarations (before attached JSDoc) and before `if` and `return` statements when another statement precedes them in the same block. Require a blank line after each complete `if` statement when another statement follows in the same block. Do not insert blank lines at the start of a block or between an unbraced `if` and its body. Enforce statement spacing with ESLint Stylistic alongside Prettier in format, format:check and the staged-file hook.

# Constant declaration rules

Keep large static lookup tables, configuration objects and arrays at module scope, outside functions, when they do not depend on function arguments or local state.

# Style rules

These rules apply to styles throughout the repository.

1. Keep mobile and other responsive overrides inside the corresponding selector block, alongside its base declarations. Do not collect mobile overrides in a separate media-query section at the end of the stylesheet.
2. Separate style groups with a blank line: between selector blocks, before nested selectors or media queries, and after nested blocks when another group follows.
3. Prefer class selectors over element selectors. Add descriptive classes to template elements instead of styling tags such as `h1`, `p`, or `button`. Use element selectors only when a class-based approach would be impractical, such as global resets or styling markup outside the application's control.

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

# Testing rules

Write tests only when they verify meaningful behavior or prevent regressions. Avoid redundant tests and tests that merely mirror the implementation.

Use primitive types (`string`, `number`, etc.) directly instead of branded types or aliases for individual IDs, timestamps, versions and cursors.
