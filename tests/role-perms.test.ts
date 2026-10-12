import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOverrides, diffOverrides, migrateSnapshot } from "../src/lib/role-perms";

const defaults = { Owner: ["a", "b", "c"], Staff: ["a", "b"], Marketing: ["c"] };

test("overrides are applied on top of the defaults", () => {
  const out = applyOverrides(defaults, { Staff: { add: ["c"], remove: ["b"] } }, ["Owner"]);
  assert.deepEqual(out.Staff.sort(), ["a", "c"]);
  assert.deepEqual(out.Owner, ["a", "b", "c"]);
});

test("a new default reaches roles that did not customize it, and never overwrites a custom choice", () => {
  const saved = diffOverrides(defaults, { Owner: defaults.Owner, Staff: ["a"], Marketing: ["c"] }, ["Owner"]); // Staff removed b
  const nextDefaults = { Owner: ["a", "b", "c", "d"], Staff: ["a", "b", "d"], Marketing: ["c", "d"] };         // "d" is a new default
  const out = applyOverrides(nextDefaults, saved, ["Owner"]);
  assert.deepEqual(out.Staff.sort(), ["a", "d"]);       // custom removal of b kept, new default d applied
  assert.deepEqual(out.Marketing.sort(), ["c", "d"]);   // untouched role follows the new defaults
});

test("Owner can never be overridden", () => {
  assert.deepEqual(applyOverrides(defaults, { Owner: { add: [], remove: ["a"] } }, ["Owner"]).Owner, ["a", "b", "c"]);
  assert.deepEqual(diffOverrides(defaults, { Owner: [], Staff: ["a", "b"], Marketing: ["c"] }, ["Owner"]), {});
});

test("legacy snapshots keep customizations and do not treat later permissions as removed", () => {
  const known = ["a", "b"];                                  // "c" did not exist when the snapshot was saved
  const o = migrateSnapshot(defaults, { Staff: ["a"], Marketing: [] }, known, ["Owner"]);
  assert.deepEqual(o.Staff, { add: [], remove: ["b"] });
  assert.equal(o.Marketing, undefined);                      // "c" is unknown to the snapshot, so the default still applies
});
