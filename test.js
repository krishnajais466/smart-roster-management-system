// Headless checks for the roster logic — run: node test.js
// No browser needed. Every check prints PASS/FAIL; the process
// exits non-zero if any check fails. Results are real, not invented.
const A = require('./app.js');
const assert = require('assert');
let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); console.log('PASS — ' + name); pass++; }
  catch (e) { console.log('FAIL — ' + name + ' — ' + e.message); fail++; }
}

const ctx = A.defaultCtx();
const r = A.generateRoster(ctx);

check('32 employees, 10 brands, 4 pods, 40 brand/process rows', () => {
  assert.strictEqual(A.DATA.EMPLOYEES.length, 32);
  assert.strictEqual(A.DATA.BRANDS.length, 10);
  assert.strictEqual(A.DATA.PODS.length, 4);
  assert.strictEqual(r.rows.length, 40);
});
check('8 of 10 brands are single-resource, 2 have 3 primaries each', () => {
  const single = A.DATA.BRANDS.filter(b => {
    const prim = new Set();
    A.DATA.EMPLOYEES.forEach(e => e.primary.forEach(a => { if (a.brandId === b.id) prim.add(e.id); }));
    return prim.size === 1;
  });
  assert.strictEqual(single.length, 8);
  for (const b of ['B09', 'B10']) {
    const prim = new Set();
    A.DATA.EMPLOYEES.forEach(e => e.primary.forEach(a => { if (a.brandId === b) prim.add(e.id); }));
    assert.strictEqual(prim.size, 3, b);
  }
});
check('every required day is covered OR flagged as a conflict (no silent invalid roster)', () => {
  let required = 0, ok = 0;
  for (const row of r.rows) for (const c of row.cells) {
    if (!c.required) continue;
    required++;
    if (c.covered) ok++;
    else {
      const flagged = r.conflicts.some(x => x.severity === 'mandatory' && x.brandId === row.brandId && x.process === row.process && x.date === c.date);
      assert.ok(flagged, 'unflagged gap ' + row.brandId + ' ' + row.process + ' ' + c.date);
    }
  }
  assert.ok(required > 500, 'required slots ' + required);
  console.log('      required slots=' + required + ', covered=' + ok + ', coverage=' + r.summary.coveragePct + '%');
});
check('baseline has mandatory conflicts with explanations and (mostly) backups', () => {
  assert.ok(r.summary.mandatory > 0, 'expected seeded gaps, got 0');
  for (const c of r.conflicts.filter(x => x.severity === 'mandatory')) {
    assert.ok(c.explanation && c.explanation.length > 40, 'short explanation ' + c.id);
  }
  const withBackup = r.conflicts.filter(x => x.severity === 'mandatory' && x.backup).length;
  console.log('      mandatory=' + r.summary.mandatory + ', preference=' + r.summary.preference + ', with backup suggested=' + withBackup);
  assert.ok(withBackup > 0);
});
check('simulate sole employee on leave produces a gap (B01, E02, 2026-12-07)', () => {
  const s = A.simulateSoleEmployeeLeave(ctx, 'B01', 'E02', '2026-12-07');
  assert.ok(/Gap flagged/.test(s.message), s.message);
  assert.ok(s.roster.conflicts.some(c => c.brandId === 'B01' && c.date === '2026-12-07' && c.severity === 'mandatory'));
  console.log('      ' + s.message);
});
check('simulate 3-employee brand losing one person: remaining coverage is sufficient (B09 CS, E20, 2026-12-07)', () => {
  const s = A.simulateMultiEmployeeLeave(ctx, 'B09', 'CS', 'E20', '2026-12-07');
  assert.ok(/Coverage holds/.test(s.message), s.message);
  assert.ok(!s.roster.conflicts.some(c => c.severity === 'mandatory' && c.brandId === 'B09' && c.process === 'CS' && c.date === '2026-12-07'));
  console.log('      ' + s.message);
});
check('manager edit re-validates: E02 Leave on 2026-12-07 creates a B01 gap', () => {
  const c2 = A.defaultCtx(); c2.overrides['E02|2026-12-07'] = 'Leave';
  const r2 = A.generateRoster(c2);
  assert.ok(r2.conflicts.some(c => c.brandId === 'B01' && c.date === '2026-12-07'));
});
check('assigning the suggested backup resolves that gap', () => {
  const c2 = A.defaultCtx(); c2.overrides['E02|2026-12-07'] = 'Leave';
  const r2 = A.generateRoster(c2);
  const gap = r2.conflicts.find(c => c.brandId === 'B01' && c.process === 'CS' && c.date === '2026-12-07');
  assert.ok(gap && gap.backup, 'no backup for B01 CS 2026-12-07');
  const key = 'B01|CS|2026-12-07';
  c2.extraAssignments[key] = [gap.backup.id];
  const r3 = A.generateRoster(c2);
  assert.ok(!r3.conflicts.some(c => c.severity === 'mandatory' && c.brandId === 'B01' && c.process === 'CS' && c.date === '2026-12-07'), 'gap not resolved by backup ' + gap.backup.id);
  console.log('      backup used: ' + gap.backup.name + ' (' + gap.backup.id + ')');
});
check('CSV export returns a header + one row per brand/process/day', () => {
  const csv = A.buildCSV(r, 'company', {});
  const lines = csv.split('\n');
  assert.ok(lines[0].includes('Brand') && lines[0].includes('Covered'));
  assert.strictEqual(lines.length, 1 + 40 * 31, 'lines ' + lines.length);
});
check('double-booking detection works on synthetic data', () => {
  const c2 = A.defaultCtx();
  // Make E02 primary for a second brand as well, for this test only.
  c2.employees = JSON.parse(JSON.stringify(A.DATA.EMPLOYEES));
  const e02 = c2.employees.find(e => e.id === 'E02');
  e02.primary.push({ brandId: 'B02', processes: ['CS'] });
  const r2 = A.generateRoster(c2);
  const dbl = r2.conflicts.filter(c => c.type === 'double_booked' && c.id.startsWith('D-E02-'));
  assert.ok(dbl.length > 0, 'expected double-booked conflicts for E02, got 0');
  console.log('      double-booked days flagged for E02: ' + dbl.length);
});
check('regeneration is deterministic (same input, same coverage)', () => {
  const r2 = A.generateRoster(A.defaultCtx());
  assert.strictEqual(r2.summary.coveragePct, r.summary.coveragePct);
  assert.strictEqual(r2.summary.mandatory, r.summary.mandatory);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
