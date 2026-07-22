import assert from "node:assert/strict";
import test from "node:test";
import {
  getContributionCategoryLanguages,
  getContributionCategoryRepositories
} from "./contributionCategories.js";

test("exposes every catalog language for code categories", () => {
  assert.deepEqual(
    getContributionCategoryLanguages("types"),
    ["JavaScript", "TypeScript", "HTML/CSS", "Python", "Java", "Kotlin", "Swift", "Go", "Rust"]
  );
  assert.deepEqual(
    getContributionCategoryLanguages("bugfix"),
    ["JavaScript", "TypeScript", "HTML/CSS", "Python", "Java", "Kotlin", "Swift", "Go", "Rust"]
  );
});

test("narrows category repositories before GitHub lookup", () => {
  assert.deepEqual(
    getContributionCategoryRepositories("types", "TypeScript"),
    ["colinhacks/zod", "TanStack/query", "testing-library/react-testing-library"]
  );
  assert.deepEqual(
    getContributionCategoryRepositories("feature", "Python"),
    ["pallets/click", "marshmallow-code/marshmallow"]
  );
});
