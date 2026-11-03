# Contributing

This repository follows spec-driven development.
Before implementing any change, update the relevant specification files, then implement the change according to the updated specifications.

Do not use Zod or add it as a dependency anywhere in the repository. Use class-validator/class-transformer for server request validation and framework-independent validation functions for shared domain rules and client runtime validation.

Write tests only when they verify meaningful behavior or prevent regressions. Avoid redundant tests and tests that merely mirror the implementation.
