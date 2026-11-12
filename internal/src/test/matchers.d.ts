import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";

// `bun:test` ships its own `expect`, so the jest-dom matchers that
// `test/setup/index.ts` registers at runtime are invisible to the type checker.
// Merge their types into bun's `Matchers` so a test using `toBeInTheDocument`
// and friends type-checks, which `next build` requires.
declare module "bun:test" {
	interface Matchers<T> extends TestingLibraryMatchers<unknown, T> {}
	interface AsymmetricMatchers
		extends TestingLibraryMatchers<unknown, unknown> {}
}
