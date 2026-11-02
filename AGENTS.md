# SDD
[Important rules for making changes](specs/index.md)

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