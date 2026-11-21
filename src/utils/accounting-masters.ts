/**
 * Pure domain helpers for Anke Cloud OS Prompt 3:
 * Accounting Masters (Ledgers, Groups, Chart of Accounts & Alt+C Quick Master)
 *
 * Strictly zero demo data, deterministic group-to-final-accounts nature mapping,
 * parent-chain context resolution, duplicate prevention, and safe deletion guards.
 */

export type AccountNature = 'Assets' | 'Liabilities' | 'Income' | 'Expenses';

export type LedgerContextCategory =
  | 'PARTY'
  | 'DUTIES'
  | 'BANK'
  | 'TRADING_PL'
  | 'GENERAL';

export interface AccountGroupMaster {
  id: string;
  name: string;
  alias?: string;
  parent: string; // 'Primary' or another group's name
  nature: AccountNature;
  behavesLikeSubLedger?: boolean;
  usedForCalculation?: boolean;
  isSystem?: boolean;
}

export interface LedgerMasterRecord {
  id: string;
  name: string;
  alias?: string;
  group: string;
  openingBalance: number;
  balance?: number;
  balanceType: 'Dr' | 'Cr';
  openingType?: 'Dr' | 'Cr';
  isSystem?: boolean;
  // Party (Sundry Debtors / Creditors & sub-groups)
  maintainBillByBill?: boolean;
  creditDays?: number;
  address?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  regType?: 'Regular' | 'Composition' | 'Unregistered' | 'Consumer';
  gstin?: string;
  pan?: string;
  isMsmeRegistered?: boolean;
  msmeUdyam?: string;
  msmeEnterpriseType?: 'Micro' | 'Small' | 'Medium' | '';
  // Duties & Taxes
  dutyType?: 'GST' | 'TDS' | 'TCS' | 'Others';
  gstTaxHead?: 'CGST' | 'SGST / UTGST' | 'IGST' | 'Cess' | '';
  taxRate?: number;
  // Bank Accounts / Bank OD A/c
  bankHolder?: string;
  bankAccount?: string;
  ifsc?: string;
  bankName?: string;
  bankBranch?: string;
  // Sales / Purchase / Expenses / Incomes
  gstApplicable?: 'Applicable' | 'Not Applicable';
  hsnSac?: string;
  supplyType?: 'Goods' | 'Services';
}

export interface VoucherLikeRef {
  id?: string;
  partyId?: string;
  partyName?: string;
  debitAccount?: string;
  creditAccount?: string;
  cashBankLedgerId?: string;
  lines?: Array<{ ledgerId?: string; ledgerName?: string; accountId?: string; accountName?: string }>;
  entries?: Array<{ ledgerId?: string; ledgerName?: string; accountId?: string; accountName?: string }>;
}

export interface ChartOfAccountsTreeNode {
  type: 'group' | 'ledger';
  id: string;
  name: string;
  alias?: string;
  nature: AccountNature;
  depth: number;
  isSystem?: boolean;
  group?: string;
  gstin?: string;
  balance?: number;
  balanceType?: 'Dr' | 'Cr';
  children?: ChartOfAccountsTreeNode[];
  totalLedgerCount?: number;
}

export const STANDARD_ACCOUNT_GROUPS_FULL: ReadonlyArray<AccountGroupMaster> = [
  { id: 'grp-capital', name: 'Capital Account', parent: 'Primary', nature: 'Liabilities', isSystem: true },
  { id: 'grp-current-assets', name: 'Current Assets', parent: 'Primary', nature: 'Assets', isSystem: true },
  { id: 'grp-current-liabilities', name: 'Current Liabilities', parent: 'Primary', nature: 'Liabilities', isSystem: true },
  { id: 'grp-fixed-assets', name: 'Fixed Assets', parent: 'Primary', nature: 'Assets', isSystem: true },
  { id: 'grp-investments', name: 'Investments', parent: 'Primary', nature: 'Assets', isSystem: true },
  { id: 'grp-loans-liability', name: 'Loans (Liability)', parent: 'Primary', nature: 'Liabilities', isSystem: true },
  { id: 'grp-direct-expenses', name: 'Direct Expenses', parent: 'Primary', nature: 'Expenses', isSystem: true },
  { id: 'grp-direct-incomes', name: 'Direct Incomes', parent: 'Primary', nature: 'Income', isSystem: true },
  { id: 'grp-indirect-expenses', name: 'Indirect Expenses', parent: 'Primary', nature: 'Expenses', isSystem: true },
  { id: 'grp-indirect-incomes', name: 'Indirect Incomes', parent: 'Primary', nature: 'Income', isSystem: true },
  { id: 'grp-sales-accounts', name: 'Sales Accounts', parent: 'Primary', nature: 'Income', isSystem: true },
  { id: 'grp-purchase-accounts', name: 'Purchase Accounts', parent: 'Primary', nature: 'Expenses', isSystem: true },
  { id: 'grp-duties-taxes', name: 'Duties & Taxes', parent: 'Current Liabilities', nature: 'Liabilities', usedForCalculation: true, isSystem: true },
  { id: 'grp-bank-accounts', name: 'Bank Accounts', parent: 'Current Assets', nature: 'Assets', isSystem: true },
  { id: 'grp-cash-in-hand', name: 'Cash-in-Hand', parent: 'Current Assets', nature: 'Assets', isSystem: true },
  { id: 'grp-sundry-debtors', name: 'Sundry Debtors', parent: 'Current Assets', nature: 'Assets', behavesLikeSubLedger: true, isSystem: true },
  { id: 'grp-sundry-creditors', name: 'Sundry Creditors', parent: 'Current Liabilities', nature: 'Liabilities', behavesLikeSubLedger: true, isSystem: true },
  { id: 'grp-stock-in-hand', name: 'Stock-in-Hand', parent: 'Current Assets', nature: 'Assets', isSystem: true }
];

const PROTECTED_SYSTEM_LEDGER_NAMES = new Set(['cash', 'profit & loss a/c']);

const PARTY_ANCHORS = new Set(['sundry debtors', 'sundry creditors']);
const DUTIES_ANCHORS = new Set(['duties & taxes']);
const BANK_ANCHORS = new Set(['bank accounts', 'bank od a/c', 'bank occ a/c']);
const TRADING_PL_ANCHORS = new Set([
  'sales accounts',
  'purchase accounts',
  'direct expenses',
  'indirect expenses',
  'direct incomes',
  'indirect incomes'
]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Walks up the group parent hierarchy (cycle-safe) returning the ancestry chain
 * starting with the target group name.
 */
export function getGroupAncestryChain(
  groupName: string,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>>
): string[] {
  const byName = new Map<string, Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>>();
  for (const g of groups) {
    byName.set(g.name.trim().toLowerCase(), g);
  }

  const chain: string[] = [];
  const visited = new Set<string>();
  let cursor = String(groupName || '').trim();

  while (cursor && cursor.toLowerCase() !== 'primary') {
    const key = cursor.toLowerCase();
    if (visited.has(key)) break;
    visited.add(key);
    chain.push(cursor);
    const rec = byName.get(key);
    if (!rec || !rec.parent) break;
    cursor = rec.parent.trim();
  }

  return chain;
}

/**
 * Resolves which progressive-disclosure context section should be displayed
 * for a Ledger based on its selected group (or any parent in its hierarchy).
 */
export function resolveGroupContextCategory(
  groupName: string,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>> = STANDARD_ACCOUNT_GROUPS_FULL
): LedgerContextCategory {
  const chain = getGroupAncestryChain(groupName, groups);
  for (const name of chain) {
    const key = name.trim().toLowerCase();
    if (PARTY_ANCHORS.has(key)) return 'PARTY';
    if (DUTIES_ANCHORS.has(key)) return 'DUTIES';
    if (BANK_ANCHORS.has(key)) return 'BANK';
    if (TRADING_PL_ANCHORS.has(key)) return 'TRADING_PL';
  }
  return 'GENERAL';
}

/**
 * Checks whether a group or any of its ancestors is Sundry Creditors
 * (used to surface MSME / Udyam Section 43B(h) guidance).
 */
export function isCreditorGroup(
  groupName: string,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>> = STANDARD_ACCOUNT_GROUPS_FULL
): boolean {
  const chain = getGroupAncestryChain(groupName, groups);
  return chain.some((n) => n.trim().toLowerCase() === 'sundry creditors');
}

/**
 * Resolves the accounting Nature ('Assets' | 'Liabilities' | 'Income' | 'Expenses')
 * for a given group name by inspecting the group or traversing up to its Primary ancestor.
 */
export function resolveGroupNature(
  groupName: string,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>> = STANDARD_ACCOUNT_GROUPS_FULL
): AccountNature {
  const byName = new Map<string, Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>>();
  for (const g of groups) {
    byName.set(g.name.trim().toLowerCase(), g);
  }
  const chain = getGroupAncestryChain(groupName, groups);
  for (const name of chain) {
    const rec = byName.get(name.trim().toLowerCase());
    if (rec && rec.nature) return rec.nature;
  }
  return 'Assets';
}

/**
 * Standard Indian double-entry default opening balance side:
 * Assets & Expenses -> 'Dr'; Liabilities & Income -> 'Cr'.
 */
export function defaultOpeningBalanceType(nature: AccountNature): 'Dr' | 'Cr' {
  return nature === 'Assets' || nature === 'Expenses' ? 'Dr' : 'Cr';
}

/**
 * Case-insensitive duplicate name check within the active company's ledgers.
 */
export function isDuplicateLedgerName(
  name: string,
  ledgers: ReadonlyArray<Pick<LedgerMasterRecord, 'id' | 'name'>>,
  excludeId?: string | null
): boolean {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return false;
  return ledgers.some(
    (l) => l.id !== excludeId && String(l.name || '').trim().toLowerCase() === target
  );
}

/**
 * Case-insensitive duplicate name check within the active company's account groups.
 */
export function isDuplicateGroupName(
  name: string,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'id' | 'name'>>,
  excludeId?: string | null
): boolean {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return false;
  return groups.some(
    (g) => g.id !== excludeId && String(g.name || '').trim().toLowerCase() === target
  );
}

/**
 * Evaluates whether a ledger can be safely deleted.
 * Blocks protected system ledgers (Cash, Profit & Loss A/c) and any ledger referenced by vouchers.
 */
export function canDeleteLedger(
  ledger: Pick<LedgerMasterRecord, 'id' | 'name' | 'isSystem'> | null | undefined,
  vouchers: ReadonlyArray<VoucherLikeRef> = []
): { allowed: boolean; reason?: string } {
  if (!ledger) return { allowed: false, reason: 'Ledger not found.' };
  const nameLower = String(ledger.name || '').trim().toLowerCase();
  if (ledger.isSystem || PROTECTED_SYSTEM_LEDGER_NAMES.has(nameLower)) {
    return {
      allowed: false,
      reason: `"${ledger.name}" is a protected system ledger and cannot be deleted.`
    };
  }

  let refCount = 0;
  for (const v of vouchers) {
    if (!v || typeof v !== 'object') continue;
    let matched = false;
    if (v.partyId && v.partyId === ledger.id) matched = true;
    if (!matched && v.partyName && v.partyName.trim().toLowerCase() === nameLower) matched = true;
    if (!matched && v.cashBankLedgerId && v.cashBankLedgerId === ledger.id) matched = true;
    if (!matched && v.debitAccount && (v.debitAccount === ledger.id || v.debitAccount.trim().toLowerCase() === nameLower)) matched = true;
    if (!matched && v.creditAccount && (v.creditAccount === ledger.id || v.creditAccount.trim().toLowerCase() === nameLower)) matched = true;

    const lineCollections = [v.lines, v.entries];
    for (const coll of lineCollections) {
      if (matched || !Array.isArray(coll)) continue;
      for (const item of coll) {
        if (!item) continue;
        if (item.ledgerId === ledger.id || item.accountId === ledger.id) {
          matched = true;
          break;
        }
        if (
          (item.ledgerName && item.ledgerName.trim().toLowerCase() === nameLower) ||
          (item.accountName && item.accountName.trim().toLowerCase() === nameLower)
        ) {
          matched = true;
          break;
        }
      }
    }
    if (matched) refCount++;
  }

  if (refCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete "${ledger.name}" because ${refCount} voucher${refCount === 1 ? '' : 's'} exist against this ledger.`
    };
  }

  return { allowed: true };
}

/**
 * Evaluates whether an Account Group can be safely deleted.
 */
export function canDeleteGroup(
  group: Pick<AccountGroupMaster, 'id' | 'name' | 'isSystem'> | null | undefined,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'id' | 'name' | 'parent'>>,
  ledgers: ReadonlyArray<Pick<LedgerMasterRecord, 'id' | 'group'>>
): { allowed: boolean; reason?: string } {
  if (!group) return { allowed: false, reason: 'Group not found.' };
  if (group.isSystem) {
    return {
      allowed: false,
      reason: `"${group.name}" is a standard Indian Primary Account Group and cannot be deleted.`
    };
  }
  const nameLower = group.name.trim().toLowerCase();
  const hasChildren = groups.some(
    (g) => g.id !== group.id && String(g.parent || '').trim().toLowerCase() === nameLower
  );
  if (hasChildren) {
    return {
      allowed: false,
      reason: `Cannot delete "${group.name}" while sub-groups exist under it.`
    };
  }
  const hasLedgers = ledgers.some(
    (l) => String(l.group || '').trim().toLowerCase() === nameLower
  );
  if (hasLedgers) {
    return {
      allowed: false,
      reason: `Cannot delete "${group.name}" while ledgers are assigned to it.`
    };
  }
  return { allowed: true };
}

/**
 * Validates a Ledger creation/alteration draft.
 */
export function validateLedgerDraft(
  draft: Partial<LedgerMasterRecord>,
  existingLedgers: ReadonlyArray<Pick<LedgerMasterRecord, 'id' | 'name'>>,
  groups: ReadonlyArray<Pick<AccountGroupMaster, 'name' | 'parent' | 'nature'>> = STANDARD_ACCOUNT_GROUPS_FULL
): { valid: boolean; error?: string; extractedStateCode?: string; extractedPan?: string } {
  const name = String(draft.name || '').trim();
  if (name.length < 2) {
    return { valid: false, error: 'Ledger Name is required (minimum 2 characters).' };
  }
  if (isDuplicateLedgerName(name, existingLedgers, draft.id || null)) {
    return { valid: false, error: `A ledger named "${name}" already exists in this company.` };
  }
  const group = String(draft.group || '').trim();
  if (!group) {
    return { valid: false, error: 'Select an Account Group under "Under".' };
  }

  const category = resolveGroupContextCategory(group, groups);
  let extractedStateCode: string | undefined;
  let extractedPan: string | undefined;

  if (category === 'PARTY') {
    const regType = draft.regType || 'Regular';
    const gstin = String(draft.gstin || '').trim().toUpperCase();
    if (regType !== 'Unregistered' && regType !== 'Consumer' && gstin) {
      if (!GSTIN_REGEX.test(gstin)) {
        return {
          valid: false,
          error: 'Enter a valid 15-character GSTIN (e.g. 24AAAFK0142C1Z5) or leave blank.'
        };
      }
      extractedStateCode = gstin.substring(0, 2);
      extractedPan = gstin.substring(2, 12);
    }
    const pin = String(draft.pincode || '').trim();
    if (pin && !/^[0-9]{6}$/.test(pin)) {
      return { valid: false, error: 'Pincode must be a valid 6-digit Indian postal code.' };
    }
  }

  return { valid: true, extractedStateCode, extractedPan };
}

/**
 * Validates an Account Group creation/alteration draft.
 */
export function validateGroupDraft(
  draft: Partial<AccountGroupMaster>,
  existingGroups: ReadonlyArray<Pick<AccountGroupMaster, 'id' | 'name' | 'parent'>>
): { valid: boolean; error?: string } {
  const name = String(draft.name || '').trim();
  if (name.length < 2) {
    return { valid: false, error: 'Group Name is required (minimum 2 characters).' };
  }
  if (name.toLowerCase() === 'primary') {
    return { valid: false, error: '"Primary" is reserved for top-level classification.' };
  }
  if (isDuplicateGroupName(name, existingGroups, draft.id || null)) {
    return { valid: false, error: `An Account Group named "${name}" already exists.` };
  }
  const parent = String(draft.parent || 'Primary').trim();
  if (draft.id) {
    const self = existingGroups.find((g) => g.id === draft.id);
    if (self && self.name.trim().toLowerCase() === parent.toLowerCase()) {
      return { valid: false, error: 'A group cannot be placed under itself.' };
    }
  }
  return { valid: true };
}

/**
 * Builds a clean hierarchical Chart of Accounts tree (Primary Groups -> Sub-Groups -> Ledgers)
 * with optional search filtering by group/ledger name, alias, or GSTIN.
 */
export function buildChartOfAccountsTree(
  groups: ReadonlyArray<AccountGroupMaster>,
  ledgers: ReadonlyArray<LedgerMasterRecord>,
  searchQuery = ''
): ChartOfAccountsTreeNode[] {
  const query = String(searchQuery || '').trim().toLowerCase();
  const normalizedGroups: AccountGroupMaster[] = groups.map((g) => ({
    ...g,
    parent: g.parent && g.parent.trim() ? g.parent.trim() : 'Primary',
    nature: g.nature || resolveGroupNature(g.name, groups)
  }));

  const groupNamesLower = new Set(normalizedGroups.map((g) => g.name.trim().toLowerCase()));

  function matchesText(val?: string): boolean {
    if (!query) return true;
    return String(val || '').toLowerCase().includes(query);
  }

  function buildGroupNode(group: AccountGroupMaster, depth: number, visited: Set<string>): ChartOfAccountsTreeNode | null {
    const key = group.name.trim().toLowerCase();
    if (visited.has(key)) return null;
    const nextVisited = new Set(visited);
    nextVisited.add(key);

    const groupMatches = matchesText(group.name) || matchesText(group.alias);

    const childGroups = normalizedGroups
      .filter((g) => g.parent.trim().toLowerCase() === key)
      .sort((a, b) => a.name.localeCompare(b.name));

    const directLedgers = ledgers
      .filter((l) => String(l.group || '').trim().toLowerCase() === key)
      .sort((a, b) => a.name.localeCompare(b.name));

    const children: ChartOfAccountsTreeNode[] = [];
    let totalLedgerCount = 0;

    for (const cg of childGroups) {
      const subNode = buildGroupNode(cg, depth + 1, nextVisited);
      if (subNode) {
        children.push(subNode);
        totalLedgerCount += subNode.totalLedgerCount || 0;
      }
    }

    for (const l of directLedgers) {
      const ledgerMatches =
        groupMatches ||
        matchesText(l.name) ||
        matchesText(l.alias) ||
        matchesText(l.gstin);
      if (!ledgerMatches) continue;
      children.push({
        type: 'ledger',
        id: l.id,
        name: l.name,
        alias: l.alias,
        nature: group.nature,
        depth: depth + 1,
        isSystem: l.isSystem,
        group: group.name,
        gstin: l.gstin,
        balance: l.balance !== undefined ? l.balance : l.openingBalance,
        balanceType: l.balanceType || l.openingType || defaultOpeningBalanceType(group.nature)
      });
      totalLedgerCount += 1;
    }

    if (query && !groupMatches && children.length === 0) {
      return null;
    }

    return {
      type: 'group',
      id: group.id,
      name: group.name,
      alias: group.alias,
      nature: group.nature,
      depth,
      isSystem: group.isSystem,
      children,
      totalLedgerCount
    };
  }

  const rootGroups = normalizedGroups
    .filter(
      (g) =>
        g.parent.trim().toLowerCase() === 'primary' ||
        !groupNamesLower.has(g.parent.trim().toLowerCase())
    )
    .sort((a, b) => {
      const order: Record<AccountNature, number> = {
        Assets: 0,
        Liabilities: 1,
        Income: 2,
        Expenses: 3
      };
      const diff = (order[a.nature] ?? 9) - (order[b.nature] ?? 9);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });

  const tree: ChartOfAccountsTreeNode[] = [];
  for (const rg of rootGroups) {
    const node = buildGroupNode(rg, 0, new Set());
    if (node) tree.push(node);
  }

  // Include system ledgers directly under Primary (e.g. Profit & Loss A/c)
  const primaryLedgers = ledgers.filter((l) => {
    const grp = String(l.group || '').trim().toLowerCase();
    return grp === 'primary' || !groupNamesLower.has(grp);
  });

  for (const pl of primaryLedgers) {
    const matches = !query || matchesText(pl.name) || matchesText(pl.alias);
    if (!matches) continue;
    tree.push({
      type: 'ledger',
      id: pl.id,
      name: pl.name,
      alias: pl.alias,
      nature: 'Liabilities',
      depth: 0,
      isSystem: pl.isSystem,
      group: pl.group || 'Primary',
      balance: pl.balance !== undefined ? pl.balance : pl.openingBalance,
      balanceType: pl.balanceType || pl.openingType || 'Cr'
    });
  }

  return tree;
}
