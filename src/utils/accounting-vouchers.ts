export type AccountingVoucherType = 'CONTRA' | 'PAYMENT' | 'RECEIPT' | 'JOURNAL';
export type VoucherEntryMode = 'double' | 'single';
export type DrCrSign = 'Dr' | 'Cr';
export type BankTransactionMode = 'Cheque' | 'NEFT / RTGS' | 'UPI' | 'IMPS' | 'Card';
export type BillAdjMethod = 'Agst Ref' | 'New Ref' | 'Advance' | 'On Account';

export interface VoucherF12Config {
  defaultEntryMode: VoucherEntryMode;
  useDrCr: boolean;
  showCurrentBalance: boolean;
  provideBankDetails: boolean;
  enableBillWise: boolean;
  warnNegativeCash: boolean;
  allowCashBankInJournal: boolean;
}

export const DEFAULT_VOUCHER_F12_CONFIG: VoucherF12Config = {
  defaultEntryMode: 'double',
  useDrCr: true,
  showCurrentBalance: true,
  provideBankDetails: true,
  enableBillWise: true,
  warnNegativeCash: true,
  allowCashBankInJournal: false,
};

export interface AccountGroupLike {
  name: string;
  parent?: string;
}

export interface LedgerLike {
  id: string;
  name: string;
  group: string;
  balance?: number;
  balanceType?: DrCrSign;
  maintainBillByBill?: boolean;
}

export interface BankAllocation {
  mode: BankTransactionMode;
  instrumentNo: string;
  instrumentDate: string;
  remarks?: string;
}

export interface BillAllocationRow {
  method: BillAdjMethod;
  refName: string;
  amount: number;
}

export interface VoucherPostingLine {
  type: DrCrSign;
  ledgerId: string;
  ledgerName?: string;
  amount: number;
  bankAllocation?: BankAllocation | null;
  billAllocations?: BillAllocationRow[];
}

export interface DoubleEntryTotals {
  totalDebit: number;
  totalCredit: number;
  difference: number; // totalDebit - totalCredit
  absDifference: number;
  isBalanced: boolean;
  nextAutoSign: DrCrSign;
  nextAutoAmount: number;
}

export interface OpenPartyBill {
  refName: string;
  date: string;
  originalAmount: number;
  pendingAmount: number;
  voucherType: string;
}

const CASH_BANK_ROOTS = new Set(['cash-in-hand', 'bank accounts', 'bank od a/c']);
const CASH_ONLY_ROOTS = new Set(['cash-in-hand']);
const BANK_ONLY_ROOTS = new Set(['bank accounts', 'bank od a/c']);
const PARTY_ROOTS = new Set(['sundry debtors', 'sundry creditors']);

const VOUCHER_PREFIXES: Record<AccountingVoucherType, string> = {
  CONTRA: 'CNT',
  PAYMENT: 'PMT',
  RECEIPT: 'RCP',
  JOURNAL: 'JRN',
};

function norm(s: string | undefined | null): string {
  return String(s || '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Walks up the account group hierarchy (cycle-safe) and checks if a group
 * matches any target root group name (case-insensitive).
 */
export function groupInheritsFrom(
  groupName: string,
  targetRoots: Set<string>,
  accountGroups: AccountGroupLike[] = []
): boolean {
  let cur = norm(groupName);
  if (!cur) return false;
  const visited = new Set<string>();
  const parentMap = new Map<string, string>();
  for (const g of accountGroups) {
    if (g && g.name) {
      parentMap.set(norm(g.name), norm(g.parent || ''));
    }
  }
  while (cur && !visited.has(cur)) {
    if (targetRoots.has(cur)) return true;
    visited.add(cur);
    cur = parentMap.get(cur) || '';
  }
  return false;
}

export function isCashOrBankGroup(groupName: string, accountGroups: AccountGroupLike[] = []): boolean {
  return groupInheritsFrom(groupName, CASH_BANK_ROOTS, accountGroups);
}

export function isCashGroup(groupName: string, accountGroups: AccountGroupLike[] = []): boolean {
  return groupInheritsFrom(groupName, CASH_ONLY_ROOTS, accountGroups);
}

export function isBankGroup(groupName: string, accountGroups: AccountGroupLike[] = []): boolean {
  return groupInheritsFrom(groupName, BANK_ONLY_ROOTS, accountGroups);
}

export function isPartyLedger(ledger: LedgerLike | null | undefined, accountGroups: AccountGroupLike[] = []): boolean {
  if (!ledger) return false;
  return groupInheritsFrom(ledger.group, PARTY_ROOTS, accountGroups);
}

/**
 * Smart Tally accounting group filtering per voucher type & field context.
 */
export function filterLedgersForVoucher(
  ledgers: LedgerLike[],
  voucherType: AccountingVoucherType,
  context: 'header-account' | 'particulars',
  config: Partial<VoucherF12Config> = {},
  accountGroups: AccountGroupLike[] = [],
  excludeLedgerId?: string
): LedgerLike[] {
  const allowCashBankInJournal = Boolean(config.allowCashBankInJournal);
  return (ledgers || []).filter((l) => {
    if (!l || !l.id || !l.name) return false;
    if (excludeLedgerId && l.id === excludeLedgerId) return false;
    const isCB = isCashOrBankGroup(l.group, accountGroups);

    if (voucherType === 'CONTRA') {
      return isCB;
    }
    if (voucherType === 'PAYMENT' || voucherType === 'RECEIPT') {
      if (context === 'header-account') {
        return isCB;
      }
      return true;
    }
    if (voucherType === 'JOURNAL') {
      return allowCashBankInJournal ? true : !isCB;
    }
    return true;
  });
}

/**
 * Computes live Debit/Credit totals, balance difference, and auto-balancing suggestion.
 */
export function computeDoubleEntryTotals(lines: Array<{ type: DrCrSign; amount: number }>): DoubleEntryTotals {
  let dr = 0;
  let cr = 0;
  for (const row of lines || []) {
    const amt = Math.max(0, round2(Number(row.amount) || 0));
    if (row.type === 'Dr') dr += amt;
    else cr += amt;
  }
  const totalDebit = round2(dr);
  const totalCredit = round2(cr);
  const difference = round2(totalDebit - totalCredit);
  const absDifference = round2(Math.abs(difference));
  const isBalanced = totalDebit > 0 && absDifference < 0.005;
  const nextAutoSign: DrCrSign = difference > 0 ? 'Cr' : 'Dr';
  return {
    totalDebit,
    totalCredit,
    difference,
    absDifference,
    isBalanced,
    nextAutoSign,
    nextAutoAmount: absDifference,
  };
}

/**
 * Converts a Single Entry voucher (top Cash/Bank account + particulars rows)
 * into strictly balanced Double-Entry Dr/Cr posting lines.
 */
export function buildSingleEntryPostingLines(
  voucherType: AccountingVoucherType,
  headerLedger: LedgerLike | null | undefined,
  particularsRows: Array<{
    ledgerId: string;
    ledgerName?: string;
    amount: number;
    bankAllocation?: BankAllocation | null;
    billAllocations?: BillAllocationRow[];
  }>,
  headerBankAllocation?: BankAllocation | null
): { valid: boolean; error?: string; lines: VoucherPostingLine[]; totalAmount: number } {
  if (voucherType === 'JOURNAL') {
    return { valid: false, error: 'Journal vouchers require Double Entry (Dr/Cr) mode.', lines: [], totalAmount: 0 };
  }
  if (!headerLedger || !headerLedger.id) {
    return { valid: false, error: 'Select a Cash or Bank Account in the header.', lines: [], totalAmount: 0 };
  }

  const cleanRows = (particularsRows || []).filter((r) => r.ledgerId && round2(r.amount) > 0);
  if (cleanRows.length === 0) {
    return { valid: false, error: 'Enter at least one Particulars ledger with an amount greater than ₹0.00.', lines: [], totalAmount: 0 };
  }
  if (cleanRows.some((r) => r.ledgerId === headerLedger.id)) {
    return { valid: false, error: 'Particulars ledger cannot be identical to the top Account ledger.', lines: [], totalAmount: 0 };
  }

  const totalAmount = round2(cleanRows.reduce((acc, r) => acc + round2(r.amount), 0));
  // PAYMENT: Particulars = Dr, Header Account = Cr
  // RECEIPT: Particulars = Cr, Header Account = Dr
  // CONTRA (TallyPrime Single Entry): Header Account = Dr (receiving), Particulars = Cr (source)
  const particularsSign: DrCrSign = voucherType === 'PAYMENT' ? 'Dr' : 'Cr';
  const headerSign: DrCrSign = voucherType === 'PAYMENT' ? 'Cr' : 'Dr';

  const lines: VoucherPostingLine[] = [
    ...cleanRows.map((r) => ({
      type: particularsSign,
      ledgerId: r.ledgerId,
      ledgerName: r.ledgerName,
      amount: round2(r.amount),
      bankAllocation: r.bankAllocation || null,
      billAllocations: r.billAllocations || [],
    })),
    {
      type: headerSign,
      ledgerId: headerLedger.id,
      ledgerName: headerLedger.name,
      amount: totalAmount,
      bankAllocation: headerBankAllocation || null,
      billAllocations: [],
    },
  ];

  return { valid: true, lines, totalAmount };
}

/**
 * Validates and computes new ledger balances after posting balanced Dr/Cr lines.
 * Also reports if any Cash-in-Hand ledger will drop into a negative (Credit) balance.
 */
export function simulateVoucherLedgerImpact(
  ledgers: LedgerLike[],
  postingLines: VoucherPostingLine[],
  accountGroups: AccountGroupLike[] = []
): {
  valid: boolean;
  error?: string;
  totals: DoubleEntryTotals;
  updatedBalances: Map<string, { balance: number; balanceType: DrCrSign }>;
  negativeCashLedgers: Array<{ id: string; name: string; projectedBalance: number }>;
} {
  const cleanLines = (postingLines || []).filter((l) => l && l.ledgerId && round2(l.amount) > 0);
  const totals = computeDoubleEntryTotals(cleanLines);

  if (cleanLines.length < 2) {
    return {
      valid: false,
      error: 'A voucher must have at least two valid ledger lines (one Debit and one Credit).',
      totals,
      updatedBalances: new Map(),
      negativeCashLedgers: [],
    };
  }
  if (!totals.isBalanced) {
    return {
      valid: false,
      error: `Voucher is out of balance by ₹${totals.absDifference.toFixed(2)}. Total Debit must equal Total Credit.`,
      totals,
      updatedBalances: new Map(),
      negativeCashLedgers: [],
    };
  }

  const netMap = new Map<string, number>();
  const ledgerById = new Map<string, LedgerLike>();
  for (const l of ledgers || []) {
    ledgerById.set(l.id, l);
    const signed = (l.balanceType || 'Dr') === 'Dr' ? Number(l.balance || 0) : -Number(l.balance || 0);
    netMap.set(l.id, round2(signed));
  }

  for (const line of cleanLines) {
    if (!ledgerById.has(line.ledgerId)) {
      return {
        valid: false,
        error: `Ledger "${line.ledgerName || line.ledgerId}" was not found in the company ledger list.`,
        totals,
        updatedBalances: new Map(),
        negativeCashLedgers: [],
      };
    }
    const prev = netMap.get(line.ledgerId) || 0;
    const delta = line.type === 'Dr' ? round2(line.amount) : -round2(line.amount);
    netMap.set(line.ledgerId, round2(prev + delta));
  }

  const updatedBalances = new Map<string, { balance: number; balanceType: DrCrSign }>();
  const negativeCashLedgers: Array<{ id: string; name: string; projectedBalance: number }> = [];

  for (const line of cleanLines) {
    const net = netMap.get(line.ledgerId) || 0;
    const balance = round2(Math.abs(net));
    const balanceType: DrCrSign = net >= 0 ? 'Dr' : 'Cr';
    updatedBalances.set(line.ledgerId, { balance, balanceType });

    const ledger = ledgerById.get(line.ledgerId);
    if (
      ledger &&
      isCashGroup(ledger.group, accountGroups) &&
      net < -0.005 &&
      !negativeCashLedgers.some((x) => x.id === ledger.id)
    ) {
      negativeCashLedgers.push({ id: ledger.id, name: ledger.name, projectedBalance: balance });
    }
  }

  return { valid: true, totals, updatedBalances, negativeCashLedgers };
}

/**
 * Computes the next sequential voucher number for a voucher type & financial year.
 * Strictly starts at 001 when no prior vouchers of that type exist (Zero-Demo policy).
 */
export function nextVoucherSerial(
  voucherType: AccountingVoucherType,
  existingVouchers: Array<{ type?: string; number?: string }> = [],
  fyShort = '26-27'
): string {
  const prefix = VOUCHER_PREFIXES[voucherType] || 'VCH';
  let maxSeq = 0;
  for (const v of existingVouchers || []) {
    if (norm(v.type) !== norm(voucherType)) continue;
    const num = String(v.number || '');
    const m = num.match(/(\d+)\s*$/);
    if (m) {
      const parsed = parseInt(m[1], 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    } else {
      maxSeq += 1;
    }
  }
  return `${prefix}/${fyShort}/${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Extracts open unpaid party bills (from Sales/Purchase invoices & prior New Ref entries)
 * minus prior Agst Ref settlements for the Tally Bill-wise Details modal.
 */
export function getOpenBillsForParty(
  vouchers: Array<{
    type?: string;
    number?: string;
    date?: string;
    partyLedgerId?: string;
    partyName?: string;
    summary?: { grandTotal?: number; totalAmount?: number };
    lines?: Array<{
      ledgerId?: string;
      ledgerName?: string;
      billAllocations?: BillAllocationRow[];
    }>;
  }>,
  ledgerId: string,
  ledgerName?: string
): OpenPartyBill[] {
  const billMap = new Map<string, OpenPartyBill>();
  const targetName = norm(ledgerName);

  for (const v of vouchers || []) {
    const vType = String(v.type || '').toUpperCase();
    const isPartyMatch =
      (v.partyLedgerId && v.partyLedgerId === ledgerId) ||
      (targetName && v.partyName && norm(v.partyName) === targetName);

    if ((vType === 'SALES' || vType === 'PURCHASE') && isPartyMatch && v.number) {
      const amt = round2(Number(v.summary?.grandTotal ?? v.summary?.totalAmount ?? 0));
      if (amt > 0) {
        billMap.set(v.number, {
          refName: v.number,
          date: v.date || '',
          originalAmount: amt,
          pendingAmount: amt,
          voucherType: vType,
        });
      }
    }

    for (const ln of v.lines || []) {
      const lineMatch =
        (ln.ledgerId && ln.ledgerId === ledgerId) ||
        (targetName && ln.ledgerName && norm(ln.ledgerName) === targetName);
      if (!lineMatch || !Array.isArray(ln.billAllocations)) continue;

      for (const alloc of ln.billAllocations) {
        const ref = String(alloc.refName || '').trim();
        const amt = round2(Number(alloc.amount) || 0);
        if (!ref || amt <= 0) continue;

        if (alloc.method === 'New Ref') {
          if (!billMap.has(ref)) {
            billMap.set(ref, {
              refName: ref,
              date: v.date || '',
              originalAmount: amt,
              pendingAmount: amt,
              voucherType: vType || 'REF',
            });
          }
        } else if (alloc.method === 'Agst Ref') {
          const existing = billMap.get(ref);
          if (existing) {
            existing.pendingAmount = round2(Math.max(0, existing.pendingAmount - amt));
          }
        }
      }
    }
  }

  return Array.from(billMap.values()).filter((b) => b.pendingAmount > 0.005);
}

/**
 * Formats an ISO YYYY-MM-DD date into TallyPrime display format (e.g. "21-Nov-2026")
 * along with its live weekday label ("Saturday").
 */
export function formatVoucherDateWithWeekday(isoDate: string): { formatted: string; weekday: string } {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const clean = String(isoDate || '').trim();
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    const now = new Date();
    return {
      formatted: `${String(now.getDate()).padStart(2, '0')}-${MONTHS[now.getMonth()]}-${now.getFullYear()}`,
      weekday: DAYS[now.getDay()],
    };
  }
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const d = parseInt(m[3], 10);
  const dt = new Date(Date.UTC(y, mo, d));
  return {
    formatted: `${String(d).padStart(2, '0')}-${MONTHS[mo] || 'Jan'}-${y}`,
    weekday: DAYS[dt.getUTCDay()] || '',
  };
}

export interface TallySelectionOption<T = unknown> {
  isEndOfList?: boolean;
  id: string;
  name: string;
  subtitle?: string;
  item?: T;
}

/**
 * Builds the Right-Side Tally Selection Drawer option list with smart
 * "♦ End of List" pinning on blank Row 2+ inputs.
 * - When `allowEndOfList` is true and `query` is empty, pins "♦ End of List" at index 0
 *   and highlights index 0 by default so a second Enter jumps directly to Narration.
 * - As soon as the user types any search characters, filters matching items and highlights
 *   the top matching account/item at index 0.
 */
export function buildTallySelectionList<T extends { id: string; name: string }>(
  items: T[],
  query: string,
  allowEndOfList: boolean
): { entries: Array<TallySelectionOption<T>>; defaultActiveIndex: number } {
  const q = norm(query);
  const entries: Array<TallySelectionOption<T>> = [];

  if (allowEndOfList && q === '') {
    entries.push({
      isEndOfList: true,
      id: '__END_OF_LIST__',
      name: '♦ End of List',
      subtitle: 'Jump to Narration [Enter]',
    });
  }

  for (const item of items || []) {
    if (!item || !item.name) continue;
    if (!q || norm(item.name).includes(q)) {
      entries.push({
        isEndOfList: false,
        id: item.id,
        name: item.name,
        item,
      });
    }
  }

  return { entries, defaultActiveIndex: 0 };
}

/**
 * Parses Tally-style voucher dates ("21-Nov-2026", "21-11-2026", "21/11/2026", "2026-11-21")
 * into canonical ISO YYYY-MM-DD, falling back cleanly if unparseable.
 */
export function parseQuickVoucherDate(raw: string, fallbackIso: string): string {
  const s = String(raw || '').trim();
  if (!s) return fallbackIso;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const MONTHS_MAP: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };

  const dmyText = s.match(/^(\d{1,2})[-/\s]([a-zA-Z]{3,9})[-/\s](\d{2,4})$/);
  if (dmyText) {
    const d = parseInt(dmyText[1], 10);
    const m = MONTHS_MAP[dmyText[2].slice(0, 3).toLowerCase()];
    let y = parseInt(dmyText[3], 10);
    if (y < 100) y += 2000;
    if (m && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  const dmyNum = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (dmyNum) {
    const d = parseInt(dmyNum[1], 10);
    const m = parseInt(dmyNum[2], 10);
    let y = parseInt(dmyNum[3], 10);
    if (y < 100) y += 2000;
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }

  return fallbackIso;
}

