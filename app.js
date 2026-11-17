// Smart Roster Management System — scheduling logic + UI
// Plain JavaScript, no build step, no backend, no external API.
// The scheduling logic is pure functions (generateRoster, findBackup,
// buildCSV, …) so it can be tested from Node as well as in the browser:
//   node -e "const a=require('./app.js'); …"
// In the browser the same functions drive the UI at the bottom of file.

(function (root) {
  const DATA = (typeof window !== 'undefined' && window.ROSTER_DATA)
    ? window.ROSTER_DATA
    : (typeof require === 'function' ? require('./data.js') : null);
  if (!DATA) throw new Error('ROSTER_DATA not loaded — include data.js before app.js');

  // ---------- date helpers (all dates are local 'YYYY-MM-DD' strings) ----------
  function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysInMonth(year, month) { // month 1–12
    const days = []; const n = new Date(year, month, 0).getDate();
    for (let d = 1; d <= n; d++) days.push(new Date(year, month - 1, d));
    return days;
  }
  function inRange(dateStr, from, to) { return dateStr >= from && dateStr <= to; }
  const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------- working rules ----------
  // A brand/process is *required* on a day only if its rule says so.
  // This is the brand's operating calendar — separate from any one
  // employee's working pattern (see employeeStatus below).
  function isRequired(rule, date, holidays) {
    const isHoliday = holidays.some(h => h.date === iso(date));
    const dow = date.getDay(); // 0 = Sunday
    if (rule === '365') return true;
    if (rule === 'daily_no_holiday') return !isHoliday;
    // sun_holiday_off
    return dow !== 0 && !isHoliday;
  }

  function holidayOn(date, holidays) {
    return holidays.find(h => h.date === iso(date)) || null;
  }

  // ---------- employee availability, per assignment ----------
  // Returns { status, reason }. Only 'Working' counts towards coverage.
  // Priority: manager override > planned leave > comp-off > weekly off >
  // Sunday / holiday off under the brand's rule > Working.
  function employeeStatus(emp, brandProcess, date, ctx) {
    const d = iso(date);
    const key = emp.id + '|' + d;
    if (ctx.overrides[key]) {
      return { status: ctx.overrides[key], reason: 'Manager override' };
    }
    if (ctx.leaves.some(l => l.empId === emp.id && inRange(d, l.from, l.to))) {
      return { status: 'Leave', reason: 'Planned leave' };
    }
    if (ctx.compOffs.some(c => c.empId === emp.id && c.date === d)) {
      return { status: 'Comp-off', reason: 'Approved comp-off' };
    }
    if (date.getDay() === emp.weeklyOff) {
      return { status: 'Weekly Off', reason: 'Weekly off (' + WEEKDAY[emp.weeklyOff] + ')' };
    }
    const hol = holidayOn(date, ctx.holidays);
    if (hol && brandProcess && brandProcess.rule !== '365') {
      return { status: 'Holiday Off', reason: hol.name };
    }
    if (date.getDay() === 0 && brandProcess && brandProcess.rule === 'sun_holiday_off') {
      return { status: 'Sunday Off', reason: 'Sundays off for this process' };
    }
    return { status: 'Working', reason: hol ? 'Working on a public holiday (' + hol.name + ')' : 'Scheduled working day' };
  }

  function primariesFor(brandId, process, employees) {
    return employees.filter(e =>
      e.primary.some(a => a.brandId === brandId && a.processes.includes(process)));
  }
  function backupsFor(brandId, process, employees) {
    return employees.filter(e =>
      e.backupFor.some(a => a.brandId === brandId && a.processes.includes(process)));
  }

  // ---------- roster generation ----------
  // generateRoster never silently produces an invalid roster: every
  // required brand/process/day is either covered, or appears in
  // conflicts with an explanation and (where one exists) a backup.
  function generateRoster(ctx) {
    const [year, month] = ctx.month.split('-').map(Number);
    const days = daysInMonth(year, month);
    const rows = [];
    const conflicts = [];
    let requiredSlots = 0, coveredSlots = 0;

    for (const bp of DATA.BRAND_PROCESSES) {
      const primaries = primariesFor(bp.brandId, bp.process, ctx.employees);
      const row = { brandId: bp.brandId, process: bp.process, rule: bp.rule, minStaff: bp.minStaff, primaries, cells: [] };
      for (const date of days) {
        const d = iso(date);
        const required = isRequired(bp.rule, date, ctx.holidays);
        const cell = { date: d, dow: date.getDay(), required, working: [], statuses: [], covered: false, count: 0 };
        if (!required) { row.cells.push(cell); continue; }
        requiredSlots++;
        // Primary employees, plus any backup the manager has assigned
        // for this exact brand/process/day (human-approved, see assignBackup).
        const extraKey = bp.brandId + '|' + bp.process + '|' + d;
        const extraIds = ctx.extraAssignments[extraKey] || [];
        const assigned = primaries.concat(extraIds.map(id => ctx.employees.find(e => e.id === id)).filter(Boolean));
        for (const emp of assigned) {
          const st = employeeStatus(emp, bp, date, ctx);
          cell.statuses.push({ empId: emp.id, name: emp.name, status: st.status, reason: st.reason });
          if (st.status === 'Working') cell.working.push(emp.name);
        }
        cell.count = cell.working.length;
        cell.covered = cell.count >= bp.minStaff;
        if (cell.covered) coveredSlots++;
        row.cells.push(cell);

        if (!cell.covered) {
          const missing = bp.minStaff - cell.count;
          const type = cell.count === 0 ? 'no_coverage' : 'insufficient_staffing';
          const conflict = {
            id: 'C-' + bp.brandId + '-' + bp.process + '-' + d,
            date: d, brandId: bp.brandId, process: bp.process, rule: bp.rule,
            type, severity: 'mandatory', minStaff: bp.minStaff, count: cell.count, missing,
            people: cell.statuses,
            explanation: explainConflict({ type, brandId: bp.brandId, process: bp.process, date: d, minStaff: bp.minStaff, count: cell.count, statuses: cell.statuses }),
            backup: null
          };
          conflict.backup = findBackup(conflict, ctx, date, bp);
          if (conflict.backup) {
            conflict.explanation += ' Suggested backup: ' + conflict.backup.name + ' (' + conflict.backup.id + ', ' + conflict.backup.podId + ') — ' + conflict.backup.why + '. Assigning a backup is a manager decision; the app does not do it automatically.';
          } else {
            conflict.explanation += ' No available backup with this process skill was found for this day — the pod lead will need to reassign someone or change a weekly off / leave.';
          }
          conflicts.push(conflict);
        } else {
          // Preference, not a blocker: someone is working a public
          // holiday because this process is 365-day.
          const hol = holidayOn(date, ctx.holidays);
          if (hol && bp.rule === '365') {
            conflicts.push({
              id: 'P-' + bp.brandId + '-' + bp.process + '-' + d,
              date: d, brandId: bp.brandId, process: bp.process, rule: bp.rule,
              type: 'holiday_working', severity: 'preference', minStaff: bp.minStaff, count: cell.count, missing: 0,
              people: cell.statuses,
              explanation: 'Coverage is fine, but ' + cell.working.join(', ') + ' is working on a public holiday (' + hol.name + ') because ' + brandName(bp.brandId) + ' ' + bp.process + ' is a 365-day process. Consider a comp-off afterwards — this is a preference, not a coverage failure.',
              backup: null
            });
          }
        }
      }
      rows.push(row);
    }

    // Double-booking: one employee Working for two different brands
    // on the same required day. In the sample data primaries are
    // single-brand, so this fires only if a manager assigns a backup
    // who is already working elsewhere that day — which is exactly
    // when it matters.
    for (const date of days) {
      const d = iso(date);
      const byEmp = {};
      for (const row of rows) {
        const cell = row.cells.find(c => c.date === d);
        if (!cell || !cell.required) continue;
        for (const s of cell.statuses) {
          if (s.status !== 'Working') continue;
          (byEmp[s.empId] = byEmp[s.empId] || []).push(row.brandId + ' ' + row.process);
        }
      }
      for (const [empId, jobs] of Object.entries(byEmp)) {
        const brands = [...new Set(jobs.map(j => j.split(' ')[0]))];
        if (brands.length > 1) {
          const emp = ctx.employees.find(e => e.id === empId);
          conflicts.push({
            id: 'D-' + empId + '-' + d, date: d, brandId: brands[0], process: jobs[0].split(' ')[1],
            type: 'double_booked', severity: 'mandatory', minStaff: 0, count: jobs.length, missing: 0,
            people: [], explanation: emp.name + ' (' + empId + ') is scheduled Working for ' + jobs.join(' and ') + ' on ' + d + '. One person cannot cover two brands at the same time — move one of these assignments to a backup.',
            backup: null
          });
        }
      }
    }

    const summary = {
      month: ctx.month, days: days.length, requiredSlots, coveredSlots,
      coveragePct: requiredSlots ? Math.round(100 * coveredSlots / requiredSlots) : 100,
      mandatory: conflicts.filter(c => c.severity === 'mandatory').length,
      preference: conflicts.filter(c => c.severity === 'preference').length,
      totalConflicts: conflicts.length
    };
    return { days, rows, conflicts, summary };
  }

  function brandName(id) {
    const b = DATA.BRANDS.find(x => x.id === id);
    return b ? b.name : id;
  }
  function empName(id, employees) {
    const e = (employees || DATA.EMPLOYEES).find(x => x.id === id);
    return e ? e.name : id;
  }

  // Deterministic, templated plain-language explanations.
  // No external API is called — the text is built from the facts
  // of the conflict (who, what day, why they are unavailable).
  function explainConflict(c) {
    const brand = brandName(c.brandId);
    const label = DATA.PROCESS_LABELS[c.process] || c.process;
    const who = (c.statuses || []).map(s => s.name + ' (' + s.status.toLowerCase() + (s.reason ? ' — ' + s.reason : '') + ')').join('; ') || 'no employee is assigned';
    if (c.type === 'no_coverage') {
      return brand + ' — ' + label + ' has no one available on ' + c.date + ', but this is a required working day (minimum ' + c.minStaff + '). Assigned: ' + who + '. This brand/process will be uncovered unless a backup is assigned or a weekly off / leave is moved.';
    }
    return brand + ' — ' + label + ' has only ' + c.count + ' of the required ' + c.minStaff + ' people on ' + c.date + '. Assigned: ' + who + '. Coverage is short by ' + (c.minStaff - c.count) + ' — assign a backup or the process will run short-staffed.';
  }

  // Backup = same process skill, available (Working) for this
  // brand/process on this day, and NOT already working as a primary
  // for another brand that day (assigning them would just move the
  // gap and create a double-booking). Same pod first (they know
  // the brand), then any pod. Pod leads and floaters, who have no
  // primary brand, are the natural first choice.
  function findBackup(conflict, ctx, date, bp) {
    const d = iso(date);
    const candidates = ctx.employees.filter(e => {
      if (primariesFor(bp.brandId, bp.process, ctx.employees).some(p => p.id === e.id)) return false;
      const hasSkill = e.skills.includes(bp.process) ||
        e.backupFor.some(a => a.brandId === bp.brandId && a.processes.includes(bp.process));
      if (!hasSkill) return false;
      const st = employeeStatus(e, bp, date, ctx);
      if (st.status !== 'Working') return false;
      // Already working as a primary for another brand today?
      const busyElsewhere = DATA.BRAND_PROCESSES.some(other => {
        if (other.brandId === bp.brandId) return false;
        if (!e.primary.some(a => a.brandId === other.brandId && a.processes.includes(other.process))) return false;
        if (!isRequired(other.rule, date, ctx.holidays)) return false;
        return employeeStatus(e, other, date, ctx).status === 'Working';
      });
      return !busyElsewhere;
    });
    if (!candidates.length) return null;
    const primaryPod = (primariesFor(bp.brandId, bp.process, ctx.employees)[0] || {}).podId;
    candidates.sort((a, b) => {
      const aSame = a.podId === primaryPod ? 0 : 1;
      const bSame = b.podId === primaryPod ? 0 : 1;
      if (aSame !== bSame) return aSame - bSame;
      return a.role === 'Pod Lead' ? 1 : 0;
    });
    const best = candidates[0];
    return {
      id: best.id, name: best.name, podId: best.podId,
      why: best.podId === primaryPod
        ? 'same pod as the assigned team and has the ' + bp.process + ' skill'
        : 'has the ' + bp.process + ' skill (different pod — cross-pod cover, check with their pod lead)'
    };
  }

  // ---------- change handling ----------
  // Simulate 1: the sole employee of a single-resource brand on leave
  // on a required day. Returns the new roster + a plain-language result.
  function simulateSoleEmployeeLeave(ctx, brandId, empId, dateStr) {
    const next = cloneCtx(ctx);
    next.overrides[empId + '|' + dateStr] = 'Leave';
    const roster = generateRoster(next);
    const gaps = roster.conflicts.filter(c => c.severity === 'mandatory' && c.brandId === brandId && c.date === dateStr);
    return {
      ctx: next, roster,
      message: gaps.length
        ? 'Gap flagged: ' + empName(empId, ctx.employees) + ' is the sole employee for ' + brandName(brandId) + '. On ' + dateStr + ' the brand has ' + gaps.length + ' uncovered process(es) — ' + gaps.map(g => g.process + ' (' + (g.backup ? 'backup suggested: ' + g.backup.name : 'no backup found') + ')').join('; ') + '. A manager must assign a backup or move the leave.'
        : 'No gap on ' + dateStr + ' for ' + brandName(brandId) + ' — check that the date is a required working day for those processes.'
    };
  }

  // Simulate 2: one of three employees on a multi-employee brand
  // takes leave. The remaining staff should still cover the process
  // they shared — the system must say so, not invent a gap.
  function simulateMultiEmployeeLeave(ctx, brandId, process, empId, dateStr) {
    const next = cloneCtx(ctx);
    next.overrides[empId + '|' + dateStr] = 'Leave';
    const roster = generateRoster(next);
    const row = roster.rows.find(r => r.brandId === brandId && r.process === process);
    const cell = row && row.cells.find(c => c.date === dateStr);
    const gaps = roster.conflicts.filter(c => c.severity === 'mandatory' && c.brandId === brandId && c.process === process && c.date === dateStr);
    return {
      ctx: next, roster,
      message: gaps.length
        ? 'Still a gap: even after ' + empName(empId, ctx.employees) + ' takes leave on ' + dateStr + ', ' + brandName(brandId) + ' ' + process + ' is short (' + (cell ? cell.count : 0) + ' of ' + (row ? row.minStaff : 1) + '). ' + (gaps[0].backup ? 'Backup suggested: ' + gaps[0].backup.name + '.' : 'No backup found.')
        : 'Coverage holds: ' + empName(empId, ctx.employees) + ' is on leave on ' + dateStr + ', but ' + brandName(brandId) + ' ' + process + ' still has ' + (cell ? cell.count : 0) + ' of ' + (row ? row.minStaff : 1) + ' required people working (' + (cell ? cell.working.join(', ') : '—') + '). No new mandatory conflict — this is the multi-employee brand working as designed.'
    };
  }

  function cloneCtx(ctx) {
    return {
      month: ctx.month, employees: ctx.employees,
      holidays: JSON.parse(JSON.stringify(ctx.holidays)),
      leaves: JSON.parse(JSON.stringify(ctx.leaves)),
      compOffs: JSON.parse(JSON.stringify(ctx.compOffs)),
      overrides: Object.assign({}, ctx.overrides),
      extraAssignments: JSON.parse(JSON.stringify(ctx.extraAssignments))
    };
  }

  // ---------- CSV export (current view) ----------
  function buildCSV(roster, view, filter) {
    const lines = [['Brand', 'Process', 'Rule', 'Min staff', 'Date', 'Required', 'Working count', 'Working employees', 'Covered']];
    for (const row of roster.rows) {
      if (filter && filter.brandId && row.brandId !== filter.brandId) continue;
      if (filter && filter.process && row.process !== filter.process) continue;
      for (const cell of row.cells) {
        lines.push([brandName(row.brandId), row.process, row.rule, row.minStaff, cell.date,
          cell.required ? 'Yes' : 'No', cell.count, cell.working.join('; '), cell.required ? (cell.covered ? 'Yes' : 'NO — GAP') : 'Not required']);
      }
    }
    return lines.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n');
  }

  // ---------- default state ----------
  function defaultCtx() {
    return {
      month: '2026-12',
      employees: DATA.EMPLOYEES,
      holidays: JSON.parse(JSON.stringify(DATA.HOLIDAYS)),
      leaves: JSON.parse(JSON.stringify(DATA.LEAVES)),
      compOffs: JSON.parse(JSON.stringify(DATA.COMP_OFFS)),
      overrides: {},
      extraAssignments: {}
    };
  }

  // ---------- browser UI (skipped under Node) ----------
  let state = null; let roster = null; let view = 'company'; let filter = {};
  let log = [];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function initUI() {
    state = defaultCtx();
    $('monthInput').value = state.month;
    buildSelects();
    $('generateBtn').addEventListener('click', regenerate);
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => {
      view = b.dataset.view; filter = {};
      document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b));
      $('filterBar').style.display = view === 'company' ? 'none' : 'flex';
      buildSelects(); regenerate();
    }));
    $('filterSelect').addEventListener('change', () => { applyFilter(); regenerate(); });
    $('exportBtn').addEventListener('click', exportCSV);
    $('resetBtn').addEventListener('click', () => { state = defaultCtx(); log = []; $('monthInput').value = state.month; buildSelects(); regenerate(); note('Roster reset to the seeded December data.'); });
    $('applyEditBtn').addEventListener('click', applyEdit);
    $('addHolidayBtn').addEventListener('click', addHoliday);
    $('addEmployeeBtn').addEventListener('click', addEmployee);
    $('addBrandBtn').addEventListener('click', addBrand);
    $('simSoleBtn').addEventListener('click', simSole);
    $('simMultiBtn').addEventListener('click', simMulti);
    regenerate();
  }

  function buildSelects() {
    const empSel = $('editEmp'), filterSel = $('filterSelect');
    empSel.innerHTML = DATA.EMPLOYEES.map(e => '<option value="' + e.id + '">' + e.id + ' — ' + esc(e.name) + ' (' + e.podId + ')</option>').join('');
    if (view === 'pod') filterSel.innerHTML = DATA.PODS.map(p => '<option value="' + p.id + '">' + p.name + ' — lead ' + esc(empName(p.leadId)) + '</option>').join('');
    else if (view === 'brand') filterSel.innerHTML = DATA.BRANDS.map(b => '<option value="' + b.id + '">' + b.id + ' — ' + esc(b.name) + '</option>').join('');
    else if (view === 'process') filterSel.innerHTML = DATA.PROCESSES.map(p => '<option value="' + p + '">' + p + ' — ' + DATA.PROCESS_LABELS[p] + '</option>').join('');
    else if (view === 'employee') filterSel.innerHTML = DATA.EMPLOYEES.map(e => '<option value="' + e.id + '">' + e.id + ' — ' + esc(e.name) + '</option>').join('');
    if (view !== 'company') applyFilter();
  }
  function applyFilter() {
    const v = $('filterSelect').value;
    filter = view === 'pod' ? { podId: v } : view === 'brand' ? { brandId: v } : view === 'process' ? { process: v } : view === 'employee' ? { empId: v } : {};
  }

  function regenerate() {
    state.month = $('monthInput').value || '2026-12';
    roster = generateRoster(state);
    renderSummary(); renderConflicts(); renderTable(); renderHolidays();
  }
  function note(msg) { log.unshift(new Date().toLocaleTimeString() + ' — ' + msg); $('changeLog').innerHTML = log.slice(0, 8).map(esc).map(x => '<li>' + x + '</li>').join('') || '<li>No changes yet.</li>'; }

  function renderSummary() {
    const s = roster.summary;
    $('summary').innerHTML =
      '<div class="stat"><b>' + s.coveragePct + '%</b><span>coverage (' + s.coveredSlots + ' / ' + s.requiredSlots + ' required slots)</span></div>' +
      '<div class="stat bad"><b>' + s.mandatory + '</b><span>mandatory conflicts</span></div>' +
      '<div class="stat warn"><b>' + s.preference + '</b><span>preference notes</span></div>' +
      '<div class="stat"><b>' + DATA.EMPLOYEES.length + '</b><span>employees · ' + DATA.BRANDS.length + ' brands · ' + DATA.PODS.length + ' pods</span></div>';
    $('conflictBadge').textContent = s.mandatory ? s.mandatory + ' mandatory conflict' + (s.mandatory > 1 ? 's' : '') : 'No mandatory conflicts';
    $('conflictBadge').className = 'badge ' + (s.mandatory ? 'bad' : 'good');
  }

  function renderConflicts() {
    const list = roster.conflicts;
    if (!list.length) { $('conflictList').innerHTML = '<p class="ok">No conflicts for this month. Every required day is covered.</p>'; return; }
    $('conflictList').innerHTML = list.map(c => {
      const b = c.backup ? '<p><b>Backup:</b> ' + esc(c.backup.name) + ' (' + c.backup.id + ', ' + c.backup.podId + ') — ' + esc(c.backup.why) + ' <button data-assign="' + c.id + '">Assign this backup</button></p>' : '';
      return '<div class="conflict ' + c.severity + '"><b>[' + c.severity.toUpperCase() + '] ' + esc(brandName(c.brandId)) + ' — ' + c.process + ' · ' + c.date + '</b><p>' + esc(c.explanation) + '</p>' + b + '</div>';
    }).join('');
    document.querySelectorAll('[data-assign]').forEach(btn => btn.addEventListener('click', () => assignBackup(btn.dataset.assign)));
  }

  function assignBackup(conflictId) {
    const c = roster.conflicts.find(x => x.id === conflictId);
    if (!c || !c.backup) return;
    const key = c.brandId + '|' + c.process + '|' + c.date;
    state.extraAssignments[key] = state.extraAssignments[key] || [];
    if (!state.extraAssignments[key].includes(c.backup.id)) state.extraAssignments[key].push(c.backup.id);
    note('Assigned backup ' + c.backup.name + ' to ' + brandName(c.brandId) + ' ' + c.process + ' on ' + c.date + ' (manager decision).');
    regenerate();
  }

  function renderTable() {
    const days = roster.days;
    let head = '<tr><th>' + (view === 'employee' ? 'Employee' : 'Brand — Process') + '</th>' +
      days.map(d => '<th class="' + (d.getDay() === 0 ? 'sun' : '') + '">' + d.getDate() + '<br><small>' + WEEKDAY[d.getDay()] + '</small></th>').join('') + '</tr>';
    let body = '';
    if (view === 'employee') {
      const emps = DATA.EMPLOYEES.filter(e => !filter.empId || e.id === filter.empId);
      for (const emp of emps) {
        body += '<tr><td><b>' + esc(emp.name) + '</b><br><small>' + emp.id + ' · ' + emp.podId + ' · ' + emp.role + '</small></td>' +
          days.map(d => {
            const st = employeeStatus(emp, null, d, state);
            // Employee view uses the default (Sun/holiday off) pattern;
            // brand/process cells are authoritative for coverage.
            const cls = st.status === 'Working' ? 'work' : st.status === 'Leave' ? 'leave' : st.status === 'Comp-off' ? 'comp' : 'off';
            return '<td class="' + cls + '" data-emp="' + emp.id + '" data-date="' + iso(d) + '" title="' + esc(st.reason) + '">' + shortStatus(st.status) + '</td>';
          }).join('') + '</tr>';
      }
    } else {
      let rows = roster.rows;
      if (view === 'brand' && filter.brandId) rows = rows.filter(r => r.brandId === filter.brandId);
      if (view === 'process' && filter.process) rows = rows.filter(r => r.process === filter.process);
      if (view === 'pod' && filter.podId) {
        const ids = DATA.EMPLOYEES.filter(e => e.podId === filter.podId).map(e => e.id);
        rows = rows.filter(r => r.primaries.some(p => ids.includes(p.id)));
      }
      for (const row of rows) {
        body += '<tr><td><b>' + esc(brandName(row.brandId)) + ' — ' + row.process + '</b><br><small>' + DATA.RULES[row.rule] + ' · min ' + row.minStaff + ' · ' + row.primaries.map(p => esc(p.name)).join(', ') + '</small></td>' +
          row.cells.map(cell => {
            if (!cell.required) return '<td class="na" title="Not required">–</td>';
            const cls = cell.covered ? 'work' : 'gap';
            return '<td class="' + cls + '" title="' + esc(cell.working.join(', ') || 'No one working') + '">' + cell.count + '/' + row.minStaff + '</td>';
          }).join('') + '</tr>';
      }
    }
    $('rosterTable').innerHTML = head + body;
    document.querySelectorAll('#rosterTable td[data-emp]').forEach(td => td.addEventListener('click', () => {
      $('editEmp').value = td.dataset.emp; $('editDate').value = td.dataset.date; $('editDate').focus();
    }));
  }

  function shortStatus(s) { return { 'Working': 'W', 'Weekly Off': 'WO', 'Leave': 'L', 'Comp-off': 'CO', 'Sunday Off': 'Off', 'Holiday Off': 'H' }[s] || s; }

  function renderHolidays() {
    $('holidayList').innerHTML = state.holidays.map((h, i) =>
      '<li>' + h.date + ' — ' + esc(h.name) + ' <button data-hol="' + i + '">Remove</button></li>').join('') || '<li>No public holidays in this list.</li>';
    document.querySelectorAll('[data-hol]').forEach(b => b.addEventListener('click', () => {
      const removed = state.holidays.splice(Number(b.dataset.hol), 1)[0];
      note('Removed public holiday ' + removed.date + ' (' + removed.name + ').'); regenerate();
    }));
  }

  function applyEdit() {
    const empId = $('editEmp').value, date = $('editDate').value, status = $('editStatus').value;
    if (!date) { alert('Pick a date first.'); return; }
    state.overrides[empId + '|' + date] = status;
    note(empName(empId) + ' set to ' + status + ' on ' + date + ' (manager edit — roster re-validated).');
    regenerate();
  }
  function addHoliday() {
    const date = $('holDate').value, name = $('holName').value.trim();
    if (!date || !name) { alert('Enter a date and a holiday name.'); return; }
    state.holidays.push({ date, name }); note('Added public holiday ' + date + ' (' + name + ').'); regenerate();
  }
  function addEmployee() {
    const name = $('newEmpName').value.trim(); if (!name) { alert('Enter a name.'); return; }
    const id = 'E' + String(DATA.EMPLOYEES.length + 1).padStart(2, '0');
    const emp = { id, name, podId: $('newEmpPod').value, role: 'Executive', weeklyOff: Number($('newEmpOff').value), skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [] };
    DATA.EMPLOYEES.push(emp); buildSelects(); note('Added employee ' + name + ' (' + id + '). Assign them to a brand in data.js or via the day editor.'); regenerate();
  }
  function addBrand() {
    const name = $('newBrandName').value.trim(); if (!name) { alert('Enter a brand name.'); return; }
    const id = 'B' + String(DATA.BRANDS.length + 1).padStart(2, '0');
    DATA.BRANDS.push({ id, name, category: 'New brand' });
    DATA.BRAND_PROCESSES.push({ brandId: id, process: 'CS', rule: 'sun_holiday_off', minStaff: 1 });
    note('Added brand ' + name + ' (' + id + ') with CS, Sundays & holidays off, min 1. Edit data.js to add more processes.'); regenerate();
  }

  function simSole() {
    // B01 AuraSkin, sole employee Kavya Sharma (E02), Mon 7 Dec 2026
    // (a required day: CS is 365-day, and Monday is not her weekly off).
    const r = simulateSoleEmployeeLeave(state, 'B01', 'E02', '2026-12-07');
    state = r.ctx; regenerate();
    $('simResult').textContent = r.message; note('Simulated change: E02 on leave 2026-12-07 (sole employee, B01).');
  }
  function simMulti() {
    // B09 UrbanNest CS: Pooja Yadav (E18) and Riya Shah (E20) both cover
    // CS. E20 on leave on Mon 7 Dec 2026 — E18 still covers it.
    const r = simulateMultiEmployeeLeave(state, 'B09', 'CS', 'E20', '2026-12-07');
    state = r.ctx; regenerate();
    $('simResult').textContent = r.message; note('Simulated change: E20 on leave 2026-12-07 (B09 CS, shared process).');
  }

  function exportCSV() {
    const csv = buildCSV(roster, view, filter);
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roster-' + state.month + '-' + view + '.csv';
    a.click(); URL.revokeObjectURL(a.href);
    note('Exported CSV for the current ' + view + ' view (' + state.month + ').');
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initUI);
  }

  // Node / test exports
  const api = { DATA, parseDate, iso, daysInMonth, isRequired, employeeStatus, primariesFor, backupsFor, generateRoster, explainConflict, findBackup, simulateSoleEmployeeLeave, simulateMultiEmployeeLeave, buildCSV, defaultCtx, brandName, empName };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RosterApp = api;
})(typeof window !== 'undefined' ? window : globalThis);
