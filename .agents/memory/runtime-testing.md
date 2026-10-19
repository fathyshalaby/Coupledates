---
name: Node test runner scratch outputs
description: A Node 24 discovery exclusion that can look like a missing generated file.
---

Node's `--test` runner excludes files inside `node_modules` even when a bundled test file is passed explicitly. An existing file there can be reported as not found.

**Why:** This workspace uses Node 24, and its discovery rules produced misleading missing-file errors for an otherwise successfully generated test bundle.

**How to apply:** Keep test-runner entry points outside dependency directories, or directly execute a bundled `node:test` module with Node; it runs the registered tests and reports failures.
