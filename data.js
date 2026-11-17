// Smart Roster Management System — sample data
// Datastraw AI + Tech Intern assessment, Krishna Jaiswal
// All names / brands are fictional sample data, as the brief allows.
// Data is plain JS so a manager can edit it in-app (holidays, leaves,
// day-status) or in this file without touching the scheduling logic.
//
// Model:
//   Pod (1 lead) 1──* Employee
//   Employee *──* Brand, through an Assignment (primary or backup)
//   Assignment carries the processes that employee covers for that brand.
//   Brand 1──* BrandProcess (one row per process, with its own working
//   rule and minimum staffing). A brand's operating calendar lives on
//   BrandProcess, an employee's working pattern lives on Employee —
//   the two are deliberately separate, as the brief requires.

const PROCESSES = ['CS', 'ACC', 'Retention', 'NDR'];
const PROCESS_LABELS = {
  CS: 'Customer Support',
  ACC: 'Abandoned Cart Conversions',
  Retention: 'Retention',
  NDR: 'Non-Delivery Report'
};

// Working rules, per brand + process (see README for the exact meaning).
//   '365'              — required every day, incl. Sundays + holidays
//   'daily_no_holiday' — required every day except public holidays
//   'sun_holiday_off'  — required Mon–Sat, except public holidays
const RULES = {
  '365': '365-day (incl. Sundays & holidays)',
  daily_no_holiday: 'Daily except public holidays',
  sun_holiday_off: 'Sundays & public holidays off'
};

const PODS = [
  { id: 'POD-A', name: 'Pod A', leadId: 'E01' },
  { id: 'POD-B', name: 'Pod B', leadId: 'E09' },
  { id: 'POD-C', name: 'Pod C', leadId: 'E17' },
  { id: 'POD-D', name: 'Pod D', leadId: 'E25' }
];

// weeklyOff: 1=Mon … 6=Sat. Sunday is handled by the brand/process rule,
// not by weeklyOff — an employee on a 365-day process works Sundays and
// takes their weekly off on a weekday instead.
// skills: processes the employee can cover as a backup.
// primary: [{brandId, processes}] — the employee's dedicated brand(s).
// backupFor: [{brandId, processes}] — brands they can cover when asked.
const EMPLOYEES = [
  // Pod A — single-resource brands B01–B04
  { id: 'E01', name: 'Aarav Mehta', podId: 'POD-A', role: 'Pod Lead', weeklyOff: 1, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B01', processes: ['CS', 'ACC'] }, { brandId: 'B02', processes: ['CS'] }] },
  { id: 'E02', name: 'Kavya Sharma', podId: 'POD-A', role: 'Executive', weeklyOff: 2, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B01', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E03', name: 'Arjun Patel', podId: 'POD-A', role: 'Executive', weeklyOff: 3, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B02', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E04', name: 'Meera Iyer', podId: 'POD-A', role: 'Executive', weeklyOff: 4, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B03', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E05', name: 'Vikram Singh', podId: 'POD-A', role: 'Executive', weeklyOff: 5, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B04', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E06', name: 'Ananya Gupta', podId: 'POD-A', role: 'Executive', weeklyOff: 6, skills: ['CS', 'ACC'], primary: [], backupFor: [{ brandId: 'B01', processes: ['CS', 'ACC'] }, { brandId: 'B02', processes: ['ACC'] }] },
  { id: 'E07', name: 'Nikhil Joshi', podId: 'POD-A', role: 'Executive', weeklyOff: 1, skills: ['CS', 'Retention'], primary: [], backupFor: [{ brandId: 'B03', processes: ['CS', 'Retention'] }, { brandId: 'B04', processes: ['Retention'] }] },
  { id: 'E08', name: 'Ishita Rao', podId: 'POD-A', role: 'Executive', weeklyOff: 2, skills: ['NDR', 'CS'], primary: [], backupFor: [{ brandId: 'B01', processes: ['NDR'] }, { brandId: 'B04', processes: ['NDR', 'CS'] }] },
  // Pod B — single-resource brands B05–B08
  { id: 'E09', name: 'Priya Nair', podId: 'POD-B', role: 'Pod Lead', weeklyOff: 3, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B05', processes: ['CS'] }, { brandId: 'B06', processes: ['CS', 'ACC'] }] },
  { id: 'E10', name: 'Rohit Verma', podId: 'POD-B', role: 'Executive', weeklyOff: 4, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B05', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E11', name: 'Divya Menon', podId: 'POD-B', role: 'Executive', weeklyOff: 5, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B06', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E12', name: 'Karan Malhotra', podId: 'POD-B', role: 'Executive', weeklyOff: 6, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B07', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E13', name: 'Tanvi Bhatt', podId: 'POD-B', role: 'Executive', weeklyOff: 1, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [{ brandId: 'B08', processes: ['CS', 'ACC', 'Retention', 'NDR'] }], backupFor: [] },
  { id: 'E14', name: 'Aditya Rao', podId: 'POD-B', role: 'Executive', weeklyOff: 2, skills: ['CS', 'NDR'], primary: [], backupFor: [{ brandId: 'B05', processes: ['CS', 'NDR'] }, { brandId: 'B06', processes: ['NDR'] }] },
  { id: 'E15', name: 'Neha Kapoor', podId: 'POD-B', role: 'Executive', weeklyOff: 3, skills: ['ACC', 'Retention'], primary: [], backupFor: [{ brandId: 'B07', processes: ['ACC', 'Retention'] }, { brandId: 'B08', processes: ['ACC'] }] },
  { id: 'E16', name: 'Sahil Khan', podId: 'POD-B', role: 'Executive', weeklyOff: 4, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B05', processes: ['CS', 'ACC', 'Retention', 'NDR'] }] },
  // Pod C — multi-employee brands B09 and B10
  { id: 'E17', name: 'Rohan Desai', podId: 'POD-C', role: 'Pod Lead', weeklyOff: 5, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B09', processes: ['CS'] }, { brandId: 'B10', processes: ['CS'] }] },
  { id: 'E18', name: 'Pooja Yadav', podId: 'POD-C', role: 'Executive', weeklyOff: 6, skills: ['CS', 'ACC'], primary: [{ brandId: 'B09', processes: ['CS', 'ACC'] }], backupFor: [] },
  { id: 'E19', name: 'Aman Gupta', podId: 'POD-C', role: 'Executive', weeklyOff: 1, skills: ['Retention', 'NDR'], primary: [{ brandId: 'B09', processes: ['Retention', 'NDR'] }], backupFor: [] },
  { id: 'E20', name: 'Riya Shah', podId: 'POD-C', role: 'Executive', weeklyOff: 2, skills: ['CS'], primary: [{ brandId: 'B09', processes: ['CS'] }], backupFor: [] },
  { id: 'E21', name: 'Kabir Singh', podId: 'POD-C', role: 'Executive', weeklyOff: 3, skills: ['CS', 'Retention'], primary: [{ brandId: 'B10', processes: ['CS', 'Retention'] }], backupFor: [] },
  { id: 'E22', name: 'Nisha Verma', podId: 'POD-C', role: 'Executive', weeklyOff: 4, skills: ['ACC', 'NDR'], primary: [{ brandId: 'B10', processes: ['ACC', 'NDR'] }], backupFor: [] },
  { id: 'E23', name: 'Dev Patel', podId: 'POD-C', role: 'Executive', weeklyOff: 5, skills: ['CS', 'ACC'], primary: [{ brandId: 'B10', processes: ['CS', 'ACC'] }], backupFor: [] },
  { id: 'E24', name: 'Zara Khan', podId: 'POD-C', role: 'Executive', weeklyOff: 6, skills: ['ACC', 'NDR'], primary: [], backupFor: [{ brandId: 'B09', processes: ['ACC', 'NDR'] }, { brandId: 'B10', processes: ['NDR'] }] },
  // Pod D — backup / float pool for B09 and B10
  { id: 'E25', name: 'Sneha Kulkarni', podId: 'POD-D', role: 'Pod Lead', weeklyOff: 1, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B09', processes: ['CS', 'Retention'] }, { brandId: 'B10', processes: ['CS'] }] },
  { id: 'E26', name: 'Yash Thakur', podId: 'POD-D', role: 'Executive', weeklyOff: 2, skills: ['CS'], primary: [], backupFor: [{ brandId: 'B09', processes: ['CS'] }] },
  { id: 'E27', name: 'Aisha Khan', podId: 'POD-D', role: 'Executive', weeklyOff: 3, skills: ['ACC'], primary: [], backupFor: [{ brandId: 'B09', processes: ['ACC'] }] },
  { id: 'E28', name: 'Rahul Nair', podId: 'POD-D', role: 'Executive', weeklyOff: 4, skills: ['Retention'], primary: [], backupFor: [{ brandId: 'B10', processes: ['Retention'] }] },
  { id: 'E29', name: 'Simran Kaur', podId: 'POD-D', role: 'Executive', weeklyOff: 5, skills: ['NDR'], primary: [], backupFor: [{ brandId: 'B10', processes: ['NDR'] }] },
  { id: 'E30', name: 'Varun Agarwal', podId: 'POD-D', role: 'Executive', weeklyOff: 6, skills: ['CS', 'Retention'], primary: [], backupFor: [{ brandId: 'B09', processes: ['CS', 'Retention'] }, { brandId: 'B10', processes: ['CS'] }] },
  { id: 'E31', name: 'Ankit Sharma', podId: 'POD-D', role: 'Executive', weeklyOff: 1, skills: ['ACC', 'NDR'], primary: [], backupFor: [{ brandId: 'B09', processes: ['ACC', 'NDR'] }] },
  { id: 'E32', name: 'Diya Patel', podId: 'POD-D', role: 'Executive', weeklyOff: 2, skills: ['CS', 'ACC', 'Retention', 'NDR'], primary: [], backupFor: [{ brandId: 'B10', processes: ['CS', 'ACC', 'Retention', 'NDR'] }] }
];

const BRANDS = [
  { id: 'B01', name: 'AuraSkin', category: 'Skincare' },
  { id: 'B02', name: 'FreshKart', category: 'Groceries' },
  { id: 'B03', name: 'TechNest', category: 'Electronics' },
  { id: 'B04', name: 'FitFuel', category: 'Supplements' },
  { id: 'B05', name: 'HomeHaven', category: 'Home decor' },
  { id: 'B06', name: 'StyleStreet', category: 'Fashion' },
  { id: 'B07', name: 'PetPals', category: 'Pet supplies' },
  { id: 'B08', name: 'BookNook', category: 'Books & stationery' },
  { id: 'B09', name: 'UrbanNest', category: 'Furniture' },
  { id: 'B10', name: 'GlowMart', category: 'Beauty marketplace' }
];

// One row per brand + process. This is where a brand's operating
// calendar and minimum staffing live — different processes in the
// same brand can (and do) have different rules here.
const BRAND_PROCESSES = [
  { brandId: 'B01', process: 'CS', rule: '365', minStaff: 1 },
  { brandId: 'B01', process: 'ACC', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B01', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B01', process: 'NDR', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B02', process: 'CS', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B02', process: 'ACC', rule: '365', minStaff: 1 },
  { brandId: 'B02', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B02', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B03', process: 'CS', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B03', process: 'ACC', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B03', process: 'Retention', rule: '365', minStaff: 1 },
  { brandId: 'B03', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B04', process: 'CS', rule: '365', minStaff: 1 },
  { brandId: 'B04', process: 'ACC', rule: '365', minStaff: 1 },
  { brandId: 'B04', process: 'Retention', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B04', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B05', process: 'CS', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B05', process: 'ACC', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B05', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B05', process: 'NDR', rule: '365', minStaff: 1 },
  { brandId: 'B06', process: 'CS', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B06', process: 'ACC', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B06', process: 'Retention', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B06', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B07', process: 'CS', rule: '365', minStaff: 1 },
  { brandId: 'B07', process: 'ACC', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B07', process: 'Retention', rule: '365', minStaff: 1 },
  { brandId: 'B07', process: 'NDR', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B08', process: 'CS', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B08', process: 'ACC', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B08', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B08', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 },
  // Multi-employee brands. B09 CS has two primaries (overlap);
  // B10 CS has two primaries and a minimum of 2 on some days is
  // deliberately NOT set — see README Q3. Min staffing stays 1
  // except B10 CS, which needs 2 people on 365-day coverage.
  { brandId: 'B09', process: 'CS', rule: '365', minStaff: 1 },
  { brandId: 'B09', process: 'ACC', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B09', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B09', process: 'NDR', rule: 'daily_no_holiday', minStaff: 1 },
  { brandId: 'B10', process: 'CS', rule: 'daily_no_holiday', minStaff: 2 },
  { brandId: 'B10', process: 'ACC', rule: '365', minStaff: 1 },
  { brandId: 'B10', process: 'Retention', rule: 'sun_holiday_off', minStaff: 1 },
  { brandId: 'B10', process: 'NDR', rule: 'sun_holiday_off', minStaff: 1 }
];

// Public holidays — editable in the app (add / remove in the UI).
const HOLIDAYS = [
  { date: '2026-12-25', name: 'Christmas Day' }
];

// Planned leaves and comp-offs, seeded so the December roster
// already contains realistic gaps to investigate.
const LEAVES = [
  { empId: 'E05', from: '2026-12-08', to: '2026-12-09', type: 'Leave', note: 'Planned leave — sole employee for FitFuel (B04)' },
  { empId: 'E11', from: '2026-12-14', to: '2026-12-14', type: 'Leave', note: 'Planned leave — sole employee for StyleStreet (B06)' },
  { empId: 'E10', from: '2026-12-21', to: '2026-12-22', type: 'Leave', note: 'Planned leave — sole employee for HomeHaven (B05)' }
];
const COMP_OFFS = [
  { empId: 'E13', date: '2026-12-05', note: 'Comp-off for Sunday work in November' },
  { empId: 'E02', date: '2026-12-12', note: 'Comp-off for Christmas-week cover' }
];

const DATA = { PROCESSES, PROCESS_LABELS, RULES, PODS, EMPLOYEES, BRANDS, BRAND_PROCESSES, HOLIDAYS, LEAVES, COMP_OFFS };

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
if (typeof window !== 'undefined') window.ROSTER_DATA = DATA;
