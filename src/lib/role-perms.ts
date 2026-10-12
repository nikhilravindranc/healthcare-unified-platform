/**
 * Role permission overrides. Pure functions, no browser access, so they can be tested.
 *
 * Only a person's changes are stored: `add` (granted beyond the defaults) and `remove` (taken away from the defaults).
 * Current permissions = defaults + overrides, so a later change to the defaults reaches every role that did not
 * customize that permission, and customizations are never overwritten. Frontend demo only, not security.
 */
export type Overrides = Record<string, { add: string[]; remove: string[] }>;
type Matrix = Record<string, string[]>;
const uniq = (a: string[]) => [...new Set(a)];

export function applyOverrides(defaults: Matrix, overrides: Overrides, locked: string[] = []): Matrix {
  const out: Matrix = {};
  for (const role of Object.keys(defaults)) {
    const o = locked.includes(role) ? undefined : overrides[role];
    out[role] = o ? uniq([...defaults[role].filter((p) => !o.remove.includes(p)), ...o.add]) : [...defaults[role]];
  }
  return out;
}

/** The differences between what is current and what the defaults say. */
export function diffOverrides(defaults: Matrix, current: Matrix, locked: string[] = []): Overrides {
  const out: Overrides = {};
  for (const role of Object.keys(defaults)) {
    if (locked.includes(role) || !current[role]) continue;
    const add = current[role].filter((p) => !defaults[role].includes(p));
    const remove = defaults[role].filter((p) => !current[role].includes(p));
    if (add.length || remove.length) out[role] = { add, remove };
  }
  return out;
}

/**
 * Converts an older saved snapshot (full lists per role) into overrides.
 * `known` lists the permissions that existed when it was saved. Permissions added later are not treated as
 * removed, so they follow the current defaults.
 */
export function migrateSnapshot(defaults: Matrix, saved: Matrix, known: string[], locked: string[] = []): Overrides {
  const out: Overrides = {};
  for (const role of Object.keys(saved)) {
    if (locked.includes(role) || !defaults[role]) continue;
    const add = saved[role].filter((p) => !defaults[role].includes(p));
    const remove = defaults[role].filter((p) => known.includes(p) && !saved[role].includes(p));
    if (add.length || remove.length) out[role] = { add, remove };
  }
  return out;
}
