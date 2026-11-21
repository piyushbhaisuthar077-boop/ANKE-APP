import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_ACCOUNT_GROUPS_FULL,
  resolveGroupContextCategory,
  isCreditorGroup,
  resolveGroupNature,
  defaultOpeningBalanceType,
  isDuplicateLedgerName,
  isDuplicateGroupName,
  canDeleteLedger,
  canDeleteGroup,
  validateLedgerDraft,
  validateGroupDraft,
  buildChartOfAccountsTree,
  type AccountGroupMaster,
  type LedgerMasterRecord
} from './accounting-masters.ts';

test('resolveGroupContextCategory classifies direct groups and nested sub-groups accurately', () => {
  const groups: AccountGroupMaster[] = [
    ...STANDARD_ACCOUNT_GROUPS_FULL,
    { id: 'grp-north-debtors', name: 'North Zone Debtors', parent: 'Sundry Debtors', nature: 'Assets' },
    { id: 'grp-msme-creditors', name: 'MSME Suppliers', parent: 'Sundry Creditors', nature: 'Liabilities' },
    { id: 'grp-od', name: 'Bank OD A/c', parent: 'Loans (Liability)', nature: 'Liabilities' },
    { id: 'grp-gst-duties', name: 'Output GST', parent: 'Duties & Taxes', nature: 'Liabilities' }
  ];

  assert.equal(resolveGroupContextCategory('Sundry Debtors', groups), 'PARTY');
  assert.equal(resolveGroupContextCategory('North Zone Debtors', groups), 'PARTY');
  assert.equal(resolveGroupContextCategory('MSME Suppliers', groups), 'PARTY');
  assert.equal(isCreditorGroup('MSME Suppliers', groups), true);
  assert.equal(isCreditorGroup('North Zone Debtors', groups), false);

  assert.equal(resolveGroupContextCategory('Duties & Taxes', groups), 'DUTIES');
  assert.equal(resolveGroupContextCategory('Output GST', groups), 'DUTIES');
  assert.equal(resolveGroupContextCategory('Bank Accounts', groups), 'BANK');
  assert.equal(resolveGroupContextCategory('Bank OD A/c', groups), 'BANK');
  assert.equal(resolveGroupContextCategory('Sales Accounts', groups), 'TRADING_PL');
  assert.equal(resolveGroupContextCategory('Indirect Expenses', groups), 'TRADING_PL');
  assert.equal(resolveGroupContextCategory('Capital Account', groups), 'GENERAL');
});

test('resolveGroupNature and defaultOpeningBalanceType enforce Indian accounting rules', () => {
  const customGroups: AccountGroupMaster[] = [
    ...STANDARD_ACCOUNT_GROUPS_FULL,
    { id: 'grp-machinery', name: 'Plant & Machinery', parent: 'Fixed Assets', nature: 'Assets' }
  ];

  assert.equal(resolveGroupNature('Plant & Machinery', customGroups), 'Assets');
  assert.equal(defaultOpeningBalanceType('Assets'), 'Dr');
  assert.equal(defaultOpeningBalanceType('Expenses'), 'Dr');
  assert.equal(defaultOpeningBalanceType('Liabilities'), 'Cr');
  assert.equal(defaultOpeningBalanceType('Income'), 'Cr');
});

test('duplicate ledger and group detection is case-insensitive and respects excludeId', () => {
  const ledgers = [
    { id: 'l1', name: 'Cash' },
    { id: 'l2', name: 'HDFC Current A/c' }
  ];
  assert.equal(isDuplicateLedgerName('  hdfc current a/c ', ledgers), true);
  assert.equal(isDuplicateLedgerName('HDFC Current A/c', ledgers, 'l2'), false);
  assert.equal(isDuplicateLedgerName('ICICI Current A/c', ledgers), false);

  assert.equal(isDuplicateGroupName('sundry debtors', STANDARD_ACCOUNT_GROUPS_FULL), true);
  assert.equal(isDuplicateGroupName('Sundry Debtors', STANDARD_ACCOUNT_GROUPS_FULL, 'grp-sundry-debtors'), false);
});

test('canDeleteLedger protects system ledgers and ledgers with existing vouchers', () => {
  const cash = { id: 'sys-ledger-cash', name: 'Cash', isSystem: true };
  const pnl = { id: 'sys-ledger-pnl', name: 'Profit & Loss A/c', isSystem: false };
  const party = { id: 'led-101', name: 'Arjun Steel Traders', isSystem: false };
  const unused = { id: 'led-102', name: 'Unused Expense A/c', isSystem: false };

  assert.equal(canDeleteLedger(cash, []).allowed, false);
  assert.equal(canDeleteLedger(pnl, []).allowed, false);

  const vouchers = [
    { id: 'v1', partyId: 'led-101', partyName: 'Arjun Steel Traders' }
  ];
  const usedRes = canDeleteLedger(party, vouchers);
  assert.equal(usedRes.allowed, false);
  assert.match(usedRes.reason || '', /1 voucher/);

  assert.equal(canDeleteLedger(unused, vouchers).allowed, true);
});

test('canDeleteGroup blocks system groups, groups with children, and groups with ledgers', () => {
  const customParent: AccountGroupMaster = {
    id: 'grp-custom-1',
    name: 'West Zone Debtors',
    parent: 'Sundry Debtors',
    nature: 'Assets'
  };
  const customChild: AccountGroupMaster = {
    id: 'grp-custom-2',
    name: 'Gujarat Debtors',
    parent: 'West Zone Debtors',
    nature: 'Assets'
  };
  const groups = [...STANDARD_ACCOUNT_GROUPS_FULL, customParent, customChild];

  assert.equal(canDeleteGroup(STANDARD_ACCOUNT_GROUPS_FULL[0], groups, []).allowed, false);
  assert.equal(canDeleteGroup(customParent, groups, []).allowed, false);
  assert.equal(
    canDeleteGroup(customChild, groups, [{ id: 'l1', group: 'Gujarat Debtors' }]).allowed,
    false
  );
  assert.equal(canDeleteGroup(customChild, groups, []).allowed, true);
});

test('validateLedgerDraft validates GSTIN format, extracts state & PAN, and checks duplicates', () => {
  const existing = [{ id: 'sys-ledger-cash', name: 'Cash' }];

  const badGstin = validateLedgerDraft(
    { name: 'Patel Traders', group: 'Sundry Debtors', regType: 'Regular', gstin: 'INVALID123' },
    existing,
    STANDARD_ACCOUNT_GROUPS_FULL
  );
  assert.equal(badGstin.valid, false);

  const okParty = validateLedgerDraft(
    { name: 'Patel Traders', group: 'Sundry Debtors', regType: 'Regular', gstin: '24AAACP1234A1Z5', pincode: '380001' },
    existing,
    STANDARD_ACCOUNT_GROUPS_FULL
  );
  assert.equal(okParty.valid, true);
  assert.equal(okParty.extractedStateCode, '24');
  assert.equal(okParty.extractedPan, 'AAACP1234A');

  const dup = validateLedgerDraft(
    { name: 'cash', group: 'Cash-in-Hand' },
    existing,
    STANDARD_ACCOUNT_GROUPS_FULL
  );
  assert.equal(dup.valid, false);
});

test('validateGroupDraft blocks Primary name and self-parenting', () => {
  assert.equal(validateGroupDraft({ name: 'Primary', parent: 'Primary' }, STANDARD_ACCOUNT_GROUPS_FULL).valid, false);
  assert.equal(
    validateGroupDraft(
      { id: 'grp-1', name: 'Export Debtors', parent: 'Export Debtors' },
      [{ id: 'grp-1', name: 'Export Debtors', parent: 'Sundry Debtors' }]
    ).valid,
    false
  );
  assert.equal(
    validateGroupDraft({ name: 'Export Debtors', parent: 'Sundry Debtors', nature: 'Assets' }, STANDARD_ACCOUNT_GROUPS_FULL).valid,
    true
  );
});

test('buildChartOfAccountsTree builds nested Primary -> Sub-Group -> Ledger tree and filters cleanly', () => {
  const groups: AccountGroupMaster[] = [
    ...STANDARD_ACCOUNT_GROUPS_FULL,
    { id: 'grp-guj', name: 'Gujarat Debtors', parent: 'Sundry Debtors', nature: 'Assets' }
  ];
  const ledgers: LedgerMasterRecord[] = [
    { id: 'sys-ledger-cash', name: 'Cash', group: 'Cash-in-Hand', openingBalance: 0, balanceType: 'Dr', isSystem: true },
    { id: 'sys-ledger-pnl', name: 'Profit & Loss A/c', group: 'Primary', openingBalance: 0, balanceType: 'Cr', isSystem: true },
    { id: 'l-1', name: 'Narmada Agro Mills', alias: 'NAM', group: 'Gujarat Debtors', openingBalance: 25000, balanceType: 'Dr', gstin: '24AAACN1234A1Z5' }
  ];

  const fullTree = buildChartOfAccountsTree(groups, ledgers, '');
  const currentAssets = fullTree.find((n) => n.name === 'Current Assets');
  assert.ok(currentAssets);
  const debtors = currentAssets.children?.find((c) => c.name === 'Sundry Debtors');
  assert.ok(debtors);
  const gujDebtors = debtors.children?.find((c) => c.name === 'Gujarat Debtors');
  assert.ok(gujDebtors);
  assert.equal(gujDebtors.children?.length, 1);
  assert.equal(gujDebtors.children?.[0].name, 'Narmada Agro Mills');

  const filtered = buildChartOfAccountsTree(groups, ledgers, 'NAM');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Current Assets');
  assert.equal(filtered[0].totalLedgerCount, 1);
});
