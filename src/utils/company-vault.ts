/**
 * Privacy-First Multi-Company Vault & Brand Asset Utilities
 * Pure, deterministic helpers decoupled from DOM rendering.
 */

export interface CompanyRegistryEntry {
  id: string;
  name: string;
  gstin: string;
  state: string;
  stateCode: string;
  fyFrom: string;
  fyTo: string;
  booksBeginningFrom: string;
  periodLabel: string;
  createdAt: string;
}

export interface PrivacySafeCompanySummary {
  id: string;
  name: string;
  periodLabel: string;
  gstin: string;
  state: string;
}

export interface CreateCompanyInput {
  name: string;
  gstin?: string;
  state?: string;
  fyFrom?: string;
  fyTo?: string;
  booksBeginningFrom?: string;
}

export interface CreateCompanyResult {
  ok: boolean;
  error?: string;
  entry?: CompanyRegistryEntry;
}

export const INDIAN_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatIsoToIndianDate(isoDate: string): string {
  const parts = String(isoDate || '').trim().split('-');
  if (parts.length !== 3) return isoDate;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parts[2].padStart(2, '0');
  if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${day}-${MONTHS_SHORT[monthIdx]}-${year}`;
}

export function formatFyPeriod(fyFrom: string, fyTo: string): string {
  const start = formatIsoToIndianDate(fyFrom || '2026-04-01');
  const end = formatIsoToIndianDate(fyTo || '2027-03-31');
  return `${start} to ${end}`;
}

export function extractStateFromGstin(gstin: string): { stateCode: string; stateName: string } | null {
  const clean = String(gstin || '').trim().toUpperCase();
  if (clean.length < 2) return null;
  const code = clean.substring(0, 2);
  const stateName = INDIAN_STATE_CODE_MAP[code];
  if (!stateName) return null;
  return { stateCode: code, stateName };
}

export function validateGstinFormat(gstin: string): boolean {
  const clean = String(gstin || '').trim().toUpperCase();
  if (!clean) return true; // Optional for unregistered businesses
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

export function createCompanyEntry(input: CreateCompanyInput, nowIso?: string): CreateCompanyResult {
  const name = String(input.name || '').trim();
  if (name.length < 2) {
    return { ok: false, error: 'Company Name is required (minimum 2 characters).' };
  }

  const gstin = String(input.gstin || '').trim().toUpperCase();
  if (gstin && !validateGstinFormat(gstin)) {
    return {
      ok: false,
      error: 'Invalid 15-character GSTIN format (e.g. 24AAAFK0142C1Z5), or leave blank if unregistered.',
    };
  }

  const fyFrom = String(input.fyFrom || '2026-04-01').trim();
  const fyTo = String(input.fyTo || '2027-03-31').trim();
  const booksBeginningFrom = String(input.booksBeginningFrom || fyFrom).trim();

  if (fyFrom > fyTo) {
    return { ok: false, error: 'Financial Year start date cannot be after end date.' };
  }
  if (booksBeginningFrom < fyFrom || booksBeginningFrom > fyTo) {
    return { ok: false, error: 'Books Beginning From must fall within the Financial Year.' };
  }

  const detected = extractStateFromGstin(gstin);
  const resolvedState = detected?.stateName || String(input.state || 'Gujarat').trim() || 'Gujarat';
  const resolvedCode =
    detected?.stateCode ||
    Object.entries(INDIAN_STATE_CODE_MAP).find(([, s]) => s.toLowerCase() === resolvedState.toLowerCase())?.[0] ||
    '24';

  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
  const stamp = (nowIso || new Date().toISOString()).replace(/[^0-9]/g, '').slice(0, 14);

  return {
    ok: true,
    entry: {
      id: `comp-${slug || 'entity'}-${stamp}`,
      name,
      gstin: gstin || 'UNREGISTERED',
      state: resolvedState,
      stateCode: resolvedCode,
      fyFrom,
      fyTo,
      booksBeginningFrom,
      periodLabel: formatFyPeriod(fyFrom, fyTo),
      createdAt: nowIso || new Date().toISOString(),
    },
  };
}

/**
 * Projects any raw company record (even one containing legacy financial metrics)
 * into a strictly privacy-safe summary with zero balances, turnover, or voucher counts.
 */
export function projectPrivacySafeCompanyList(
  companies: Array<Record<string, unknown>>,
): PrivacySafeCompanySummary[] {
  if (!Array.isArray(companies)) return [];
  return companies
    .filter((c) => c && typeof c === 'object' && typeof c.name === 'string' && c.name.trim().length > 0)
    .map((c, idx) => ({
      id: typeof c.id === 'string' && c.id ? c.id : `comp-${idx + 1}`,
      name: String(c.name).trim(),
      periodLabel:
        typeof c.periodLabel === 'string' && c.periodLabel
          ? c.periodLabel
          : typeof c.currentPeriod === 'string' && c.currentPeriod
            ? c.currentPeriod
            : formatFyPeriod(String(c.fyFrom || '2026-04-01'), String(c.fyTo || '2027-03-31')),
      gstin: typeof c.gstin === 'string' && c.gstin.trim() ? c.gstin.trim().toUpperCase() : 'UNREGISTERED',
      state: typeof c.state === 'string' && c.state.trim() ? c.state.trim() : 'Gujarat',
    }));
}

/**
 * Zero-Demo Policy: Resolves initial company list from storage.
 * Returns an empty array (0 companies) when storage is empty or only contains
 * legacy hardcoded demo entries. Preserves all real user-created companies.
 */
export const LEGACY_DEMO_COMPANY_NAMES = new Set([
  'banas traders & agro products',
]);

export function resolveInitialCompanyRegistry(
  rawRegistryJson: string | null | undefined,
  rawLegacyStateJson?: string | null,
): PrivacySafeCompanySummary[] {
  let list: Array<Record<string, unknown>> = [];
  if (rawRegistryJson) {
    try {
      const parsed = JSON.parse(rawRegistryJson);
      if (Array.isArray(parsed)) {
        list = parsed;
      }
    } catch {
      list = [];
    }
  }

  // Filter out legacy auto-seeded demo company entry if present
  list = list.filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const id = String(item.id || '');
    const name = String(item.name || '').trim().toLowerCase();
    if (id === 'comp-default-banas' && LEGACY_DEMO_COMPANY_NAMES.has(name)) {
      return false;
    }
    return name.length > 0;
  });

  // Preserve an existing real company from legacy ANKE_ERP_STATE_V1 if registry is empty
  if (list.length === 0 && rawLegacyStateJson) {
    try {
      const legacy = JSON.parse(rawLegacyStateJson);
      const comp = legacy && typeof legacy === 'object' ? legacy.company : null;
      const compName = comp && typeof comp.name === 'string' ? comp.name.trim() : '';
      if (compName && !LEGACY_DEMO_COMPANY_NAMES.has(compName.toLowerCase())) {
        list = [
          {
            id: `comp-migrated-${compName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`,
            name: compName,
            gstin: comp.gstin || 'UNREGISTERED',
            state: comp.state || 'Gujarat',
            periodLabel: comp.currentPeriod || formatFyPeriod('2026-04-01', '2027-03-31'),
          },
        ];
      }
    } catch {
      // Ignore malformed legacy state
    }
  }

  return projectPrivacySafeCompanyList(list);
}

/**
 * Determines which progressive-disclosure Entry Gateway view to show:
 * - 'fresh-empty' when 0 companies exist locally (Case A)
 * - 'existing-companies' when 1 or more real companies exist (Case B)
 */
export function resolveGatewayMode(
  companies: ReadonlyArray<PrivacySafeCompanySummary>,
): 'fresh-empty' | 'existing-companies' {
  return Array.isArray(companies) && companies.length > 0 ? 'existing-companies' : 'fresh-empty';
}

/**
 * Enforces strict Website vs Software Shell isolation:
 * Transitioning from the Software Shell back to the Public Website is ONLY permitted
 * when explicitly confirmed by the user.
 */
export function canExitSoftwareShell(isInsideSoftware: boolean, explicitConfirmed: boolean): boolean {
  if (!isInsideSoftware) return true;
  return Boolean(explicitConfirmed);
}

export type GstRegistrationType = 'Regular' | 'Composition' | 'Unregistered / Exempt';

export interface AccountGroupDefinition {
  id: string;
  name: string;
  nature: 'Assets' | 'Liabilities' | 'Income' | 'Expenses';
  parent: string;
  isPrimary: boolean;
}

export interface SystemLedgerDefinition {
  id: string;
  name: string;
  group: string;
  balance: number;
  balanceType: 'Dr' | 'Cr';
  isSystem: boolean;
}

/**
 * Standard Tally-compatible Indian Primary Account Groups (18 groups)
 */
export const STANDARD_INDIAN_ACCOUNT_GROUPS: ReadonlyArray<AccountGroupDefinition> = [
  { id: 'grp-capital', name: 'Capital Account', nature: 'Liabilities', parent: 'Primary', isPrimary: true },
  { id: 'grp-current-assets', name: 'Current Assets', nature: 'Assets', parent: 'Primary', isPrimary: true },
  { id: 'grp-current-liabilities', name: 'Current Liabilities', nature: 'Liabilities', parent: 'Primary', isPrimary: true },
  { id: 'grp-fixed-assets', name: 'Fixed Assets', nature: 'Assets', parent: 'Primary', isPrimary: true },
  { id: 'grp-investments', name: 'Investments', nature: 'Assets', parent: 'Primary', isPrimary: true },
  { id: 'grp-loans-liability', name: 'Loans (Liability)', nature: 'Liabilities', parent: 'Primary', isPrimary: true },
  { id: 'grp-direct-expenses', name: 'Direct Expenses', nature: 'Expenses', parent: 'Primary', isPrimary: true },
  { id: 'grp-direct-incomes', name: 'Direct Incomes', nature: 'Income', parent: 'Primary', isPrimary: true },
  { id: 'grp-indirect-expenses', name: 'Indirect Expenses', nature: 'Expenses', parent: 'Primary', isPrimary: true },
  { id: 'grp-indirect-incomes', name: 'Indirect Incomes', nature: 'Income', parent: 'Primary', isPrimary: true },
  { id: 'grp-sales', name: 'Sales Accounts', nature: 'Income', parent: 'Primary', isPrimary: true },
  { id: 'grp-purchase', name: 'Purchase Accounts', nature: 'Expenses', parent: 'Primary', isPrimary: true },
  { id: 'grp-duties-taxes', name: 'Duties & Taxes', nature: 'Liabilities', parent: 'Current Liabilities', isPrimary: false },
  { id: 'grp-bank-accounts', name: 'Bank Accounts', nature: 'Assets', parent: 'Current Assets', isPrimary: false },
  { id: 'grp-cash-in-hand', name: 'Cash-in-Hand', nature: 'Assets', parent: 'Current Assets', isPrimary: false },
  { id: 'grp-sundry-debtors', name: 'Sundry Debtors', nature: 'Assets', parent: 'Current Assets', isPrimary: false },
  { id: 'grp-sundry-creditors', name: 'Sundry Creditors', nature: 'Liabilities', parent: 'Current Liabilities', isPrimary: false },
  { id: 'grp-stock-in-hand', name: 'Stock-in-Hand', nature: 'Assets', parent: 'Current Assets', isPrimary: false },
];

/**
 * Clean Chart of Accounts initialization for a newly created company:
 * ONLY the 18 standard Indian Account Groups and 2 zero-balance system ledgers
 * ('Cash' under Cash-in-Hand, 'Profit & Loss A/c' under Primary). Zero fake parties or items.
 */
export function createInitialCompanyChartOfAccounts(): {
  groups: AccountGroupDefinition[];
  ledgers: SystemLedgerDefinition[];
} {
  return {
    groups: STANDARD_INDIAN_ACCOUNT_GROUPS.map((g) => ({ ...g })),
    ledgers: [
      {
        id: 'sys-ledger-cash',
        name: 'Cash',
        group: 'Cash-in-Hand',
        balance: 0,
        balanceType: 'Dr',
        isSystem: true,
      },
      {
        id: 'sys-ledger-pnl',
        name: 'Profit & Loss A/c',
        group: 'Primary',
        balance: 0,
        balanceType: 'Cr',
        isSystem: true,
      },
    ],
  };
}

/**
 * Extracts 10-character PAN from characters 3–12 of a valid 15-character GSTIN.
 */
export function extractPanFromGstin(gstin: string): string {
  const clean = String(gstin || '').trim().toUpperCase();
  if (!validateGstinFormat(clean) || clean.length !== 15) return '';
  return clean.substring(2, 12);
}

/**
 * Two-step permanent company deletion guard: requires exact uppercase "DELETE".
 */
export function canDeleteCompany(typedConfirmation: string): boolean {
  return String(typedConfirmation || '').trim() === 'DELETE';
}

export interface FinancialPeriodValidationResult {
  ok: boolean;
  error?: string;
  fromIso?: string;
  toIso?: string;
  periodLabel?: string;
}

export function validateFinancialPeriod(fromIso: string, toIso: string): FinancialPeriodValidationResult {
  const from = String(fromIso || '').trim();
  const to = String(toIso || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return { ok: false, error: 'Enter valid From and To dates.' };
  }
  if (from > to) {
    return { ok: false, error: 'Period From Date cannot be later than To Date.' };
  }
  return {
    ok: true,
    fromIso: from,
    toIso: to,
    periodLabel: formatFyPeriod(from, to),
  };
}

export interface ParsedTallyDate {
  ok: boolean;
  iso?: string;
  ddmmyyyy?: string;
  displayShort?: string;
  weekday?: string;
  error?: string;
}

const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function buildValidDateObject(year: number, month: number, day: number): Date | null {
  if (year < 1950 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/**
 * Tally-grade smart date parser supporting:
 * - DD-MM-YYYY or DD/MM/YYYY (e.g., 15-10-2026)
 * - DD-MM or DD/MM (auto-completes year inside active Financial Year, e.g. 15-10 -> 2026-10-15, 15-02 -> 2027-02-15)
 * - YYYY-MM-DD (ISO)
 */
export function parseTallySmartDate(
  rawInput: string,
  fyFromIso = '2026-04-01',
  fyToIso = '2027-03-31',
): ParsedTallyDate {
  const clean = String(rawInput || '').trim();
  if (!clean) {
    return { ok: false, error: 'Enter a date in DD-MM-YYYY or shorthand DD-MM format.' };
  }

  let year: number;
  let month: number;
  let day: number;

  const fyStartYear = parseInt(String(fyFromIso || '2026-04-01').slice(0, 4), 10) || 2026;
  const fyStartMonth = parseInt(String(fyFromIso || '2026-04-01').slice(5, 7), 10) || 4;
  const fyEndYear = parseInt(String(fyToIso || '2027-03-31').slice(0, 4), 10) || fyStartYear + 1;

  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const fullMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  const shortMatch = clean.match(/^(\d{1,2})[-/.](\d{1,2})$/);

  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10);
    day = parseInt(isoMatch[3], 10);
  } else if (fullMatch) {
    day = parseInt(fullMatch[1], 10);
    month = parseInt(fullMatch[2], 10);
    const yrRaw = parseInt(fullMatch[3], 10);
    year = fullMatch[3].length === 2 ? 2000 + yrRaw : yrRaw;
  } else if (shortMatch) {
    day = parseInt(shortMatch[1], 10);
    month = parseInt(shortMatch[2], 10);
    // Resolve year intelligently inside active Indian Financial Year (e.g. Apr-Dec -> fyStartYear, Jan-Mar -> fyEndYear)
    year = month >= fyStartMonth ? fyStartYear : fyEndYear;
  } else {
    return { ok: false, error: 'Use DD-MM-YYYY (e.g. 15-10-2026) or shorthand DD-MM (e.g. 15-10).' };
  }

  const dateObj = buildValidDateObject(year, month, day);
  if (!dateObj) {
    return { ok: false, error: 'Invalid calendar date. Please check day and month.' };
  }

  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  const yyyy = String(year);
  const iso = `${yyyy}-${mm}-${dd}`;
  return {
    ok: true,
    iso,
    ddmmyyyy: `${dd}-${mm}-${yyyy}`,
    displayShort: `${day}-${MONTHS_SHORT[month - 1]}-${yyyy}`,
    weekday: WEEKDAYS_FULL[dateObj.getDay()],
  };
}

/**
 * Generates the Karma Circle Logo inline SVG:
 * Four interlocking crescent arcs forming a circular ring alternating between
 * Rich Maroon (#800000) and Soft Matte Gold (#D4AF37) on a transparent background.
 */
export function buildKarmaCircleLogoSvg(size = 32): string {
  const px = Math.max(16, Math.round(Number(size) || 32));
  return `<svg width="${px}" height="${px}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Karma Accounts Circle Emblem">
  <g transform="translate(50 50)">
    <path d="M -2,-44 A 44,44 0 0,0 -35,28 C -25,40 -10,43 9,33 A 31,31 0 0,1 -31,1 A 31,31 0 0,1 -6,-31 C -4,-36 -3,-40 -2,-44 Z" fill="#800000"/>
    <path d="M 3,-44 A 44,44 0 0,1 38,-18 A 34,34 0 0,0 -6,-31 L -9,-38 A 42,42 0 0,1 3,-44 Z" fill="#800000"/>
    <path d="M -10,-39 A 39,39 0 0,0 -29,8 A 32,32 0 0,1 -6,-29 Z" fill="#D4AF37"/>
    <path d="M -11,-28 A 31,31 0 0,1 31,0 A 31,31 0 0,1 -1,31 L 5,44 A 44,44 0 0,0 44,0 A 44,44 0 0,0 13,-32 C 5,-33 -4,-31 -11,-28 Z" fill="#D4AF37"/>
    <path d="M -37,24 A 44,44 0 0,0 11,42 L 6,31 A 33,33 0 0,1 -28,18 Z" fill="#D4AF37"/>
    <path d="M 29,-4 A 31,31 0 0,1 8,32 L 13,41 A 41,41 0 0,0 31,5 Z" fill="#800000"/>
  </g>
</svg>`;
}
