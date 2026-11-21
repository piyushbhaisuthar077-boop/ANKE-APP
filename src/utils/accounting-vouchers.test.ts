import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterLedgersForVoucher,
  computeDoubleEntryTotals,
  buildSingleEntryPostingLines,
  simulateVoucherLedgerImpact,
  nextVoucherSerial,
  getOpenBillsForParty,
  formatVoucherDateWithWeekday,
  buildTallySelectionList,
  parseQuickVoucherDate,
  type LedgerLike,
  type AccountGroupLike,
} from './accounting-vouchers.ts';

const SAMPLE_GROUPS: AccountGroupLike[] = [
  { name: 'Cash-in-Hand', parent: 'Current Assets' },
  { name: 'Petty Cash Sub', parent: 'Cash-in-Hand' },
  { name: 'Bank Accounts', parent: 'Current Assets' },
  { name: 'Bank OD A/c', parent: 'Loans (Liability)' },
  { name: 'Sundry Debtors', parent: 'Current Assets' },
  { name: 'Sundry Creditors', parent: 'Current Liabilities' },
  { name: 'Indirect Expenses', parent: 'Primary' },
];

const SAMPLE_LEDGERS: LedgerLike[] = [
  { id: 'L1', name: 'Cash', group: 'Cash-in-Hand', balance: 5000, balanceType: 'Dr' },
  { id: 'L2', name: 'Petty Cash Counter', group: 'Petty Cash Sub', balance: 1200, balanceType: 'Dr' },
  { id: 'L3', name: 'HDFC Current A/c', group: 'Bank Accounts', balance: 25000, balanceType: 'Dr' },
  { id: 'L4', name: 'SBI OD Facility', group: 'Bank OD A/c', balance: 10000, balanceType: 'Cr' },
  { id: 'L5', name: 'Office Rent', group: 'Indirect Expenses', balance: 0, balanceType: 'Dr' },
  { id: 'L6', name: 'Apex Traders', group: 'Sundry Debtors', balance: 15000, balanceType: 'Dr', maintainBillByBill: true },
  { id: 'L7', name: 'Kaveri Metals', group: 'Sundry Creditors', balance: 12000, balanceType: 'Cr', maintainBillByBill: true },
];

test('Smart Tally ledger filtering enforces Contra, Payment/Receipt, and Journal rules', () => {
  const contra = filterLedgersForVoucher(SAMPLE_LEDGERS, 'CONTRA', 'particulars', {}, SAMPLE_GROUPS);
  assert.deepEqual(
    contra.map((l) => l.name),
    ['Cash', 'Petty Cash Counter', 'HDFC Current A/c', 'SBI OD Facility']
  );

  const pmtHeader = filterLedgersForVoucher(SAMPLE_LEDGERS, 'PAYMENT', 'header-account', {}, SAMPLE_GROUPS);
  assert.equal(pmtHeader.length, 4);

  const pmtPart = filterLedgersForVoucher(SAMPLE_LEDGERS, 'PAYMENT', 'particulars', {}, SAMPLE_GROUPS, 'L1');
  assert.equal(pmtPart.some((l) => l.id === 'L1'), false);
  assert.equal(pmtPart.some((l) => l.id === 'L5'), true);

  const jrnDefault = filterLedgersForVoucher(SAMPLE_LEDGERS, 'JOURNAL', 'particulars', { allowCashBankInJournal: false }, SAMPLE_GROUPS);
  assert.deepEqual(
    jrnDefault.map((l) => l.name),
    ['Office Rent', 'Apex Traders', 'Kaveri Metals']
  );

  const jrnAllowCB = filterLedgersForVoucher(SAMPLE_LEDGERS, 'JOURNAL', 'particulars', { allowCashBankInJournal: true }, SAMPLE_GROUPS);
  assert.equal(jrnAllowCB.length, SAMPLE_LEDGERS.length);
});

test('Double-entry totals compute auto-balancing next row sign and amount accurately', () => {
  const partial = computeDoubleEntryTotals([{ type: 'Dr', amount: 8500.5 }]);
  assert.equal(partial.isBalanced, false);
  assert.equal(partial.nextAutoSign, 'Cr');
  assert.equal(partial.nextAutoAmount, 8500.5);

  const splitBalanced = computeDoubleEntryTotals([
    { type: 'Dr', amount: 8500.5 },
    { type: 'Cr', amount: 5000 },
    { type: 'Cr', amount: 3500.5 },
  ]);
  assert.equal(splitBalanced.isBalanced, true);
  assert.equal(splitBalanced.absDifference, 0);
  assert.equal(splitBalanced.totalDebit, 8500.5);
  assert.equal(splitBalanced.totalCredit, 8500.5);
});

test('Single-entry builder converts Payment, Receipt, and Contra into balanced Dr/Cr posting lines', () => {
  const pmt = buildSingleEntryPostingLines('PAYMENT', SAMPLE_LEDGERS[2], [
    { ledgerId: 'L5', ledgerName: 'Office Rent', amount: 12000 },
    { ledgerId: 'L7', ledgerName: 'Kaveri Metals', amount: 3000 },
  ]);
  assert.equal(pmt.valid, true);
  assert.equal(pmt.totalAmount, 15000);
  const pmtTotals = computeDoubleEntryTotals(pmt.lines);
  assert.equal(pmtTotals.isBalanced, true);
  assert.equal(pmt.lines[2].type, 'Cr');
  assert.equal(pmt.lines[2].ledgerId, 'L3');

  const rcp = buildSingleEntryPostingLines('RECEIPT', SAMPLE_LEDGERS[0], [
    { ledgerId: 'L6', ledgerName: 'Apex Traders', amount: 6000 },
  ]);
  assert.equal(rcp.valid, true);
  assert.equal(rcp.lines[0].type, 'Cr');
  assert.equal(rcp.lines[1].type, 'Dr');

  const jrnInvalid = buildSingleEntryPostingLines('JOURNAL', SAMPLE_LEDGERS[0], [
    { ledgerId: 'L5', ledgerName: 'Office Rent', amount: 100 },
  ]);
  assert.equal(jrnInvalid.valid, false);
});

test('simulateVoucherLedgerImpact enforces Debit === Credit, updates signed balances, and flags negative Cash', () => {
  const unbalanced = simulateVoucherLedgerImpact(
    SAMPLE_LEDGERS,
    [
      { type: 'Dr', ledgerId: 'L5', amount: 1000 },
      { type: 'Cr', ledgerId: 'L1', amount: 500 },
    ],
    SAMPLE_GROUPS
  );
  assert.equal(unbalanced.valid, false);

  const negativeCash = simulateVoucherLedgerImpact(
    SAMPLE_LEDGERS,
    [
      { type: 'Dr', ledgerId: 'L5', amount: 7500 },
      { type: 'Cr', ledgerId: 'L1', amount: 7500 },
    ],
    SAMPLE_GROUPS
  );
  assert.equal(negativeCash.valid, true);
  assert.equal(negativeCash.updatedBalances.get('L1')?.balance, 2500);
  assert.equal(negativeCash.updatedBalances.get('L1')?.balanceType, 'Cr');
  assert.equal(negativeCash.negativeCashLedgers.length, 1);
  assert.equal(negativeCash.negativeCashLedgers[0].name, 'Cash');
});

test('nextVoucherSerial starts cleanly at 001 (Zero-Demo) and auto-increments per voucher type', () => {
  assert.equal(nextVoucherSerial('PAYMENT', [], '26-27'), 'PMT/26-27/001');
  assert.equal(
    nextVoucherSerial(
      'PAYMENT',
      [
        { type: 'PAYMENT', number: 'PMT/26-27/001' },
        { type: 'RECEIPT', number: 'RCP/26-27/005' },
        { type: 'PAYMENT', number: 'PMT/26-27/002' },
      ],
      '26-27'
    ),
    'PMT/26-27/003'
  );
});

test('getOpenBillsForParty tracks pending invoice balances after Agst Ref receipts', () => {
  const bills = getOpenBillsForParty(
    [
      {
        type: 'SALES',
        number: 'SA/26-27/001',
        date: '2026-11-10',
        partyLedgerId: 'L6',
        partyName: 'Apex Traders',
        summary: { grandTotal: 15000 },
      },
      {
        type: 'RECEIPT',
        number: 'RCP/26-27/001',
        date: '2026-11-15',
        lines: [
          {
            ledgerId: 'L6',
            ledgerName: 'Apex Traders',
            billAllocations: [{ method: 'Agst Ref', refName: 'SA/26-27/001', amount: 6000 }],
          },
        ],
      },
    ],
    'L6',
    'Apex Traders'
  );
  assert.equal(bills.length, 1);
  assert.equal(bills[0].refName, 'SA/26-27/001');
  assert.equal(bills[0].pendingAmount, 9000);
});

test('formatVoucherDateWithWeekday formats ISO date and computes accurate weekday', () => {
  const res = formatVoucherDateWithWeekday('2026-11-21');
  assert.equal(res.formatted, '21-Nov-2026');
  assert.equal(res.weekday, 'Saturday');
});

test('buildTallySelectionList pins and highlights ♦ End of List on blank Row 2+ and filters immediately on typing', () => {
  const blankRow2 = buildTallySelectionList(SAMPLE_LEDGERS, '', true);
  assert.equal(blankRow2.defaultActiveIndex, 0);
  assert.equal(blankRow2.entries[0].isEndOfList, true);
  assert.equal(blankRow2.entries[0].name, '♦ End of List');
  assert.equal(blankRow2.entries.length, SAMPLE_LEDGERS.length + 1);

  const typedRow2 = buildTallySelectionList(SAMPLE_LEDGERS, 'hdfc', true);
  assert.equal(typedRow2.defaultActiveIndex, 0);
  assert.equal(typedRow2.entries[0].isEndOfList, false);
  assert.equal(typedRow2.entries[0].name, 'HDFC Current A/c');
  assert.equal(typedRow2.entries.length, 1);

  const row1 = buildTallySelectionList(SAMPLE_LEDGERS, '', false);
  assert.equal(row1.entries[0].isEndOfList, false);
  assert.equal(row1.entries[0].name, 'Cash');
});

test('parseQuickVoucherDate parses Tally DD-MMM-YYYY, DD-MM-YYYY, and ISO formats cleanly', () => {
  assert.equal(parseQuickVoucherDate('21-Nov-2026', '2026-04-01'), '2026-11-21');
  assert.equal(parseQuickVoucherDate('05-12-2026', '2026-04-01'), '2026-12-05');
  assert.equal(parseQuickVoucherDate('5/4/26', '2026-04-01'), '2026-04-05');
  assert.equal(parseQuickVoucherDate('2026-11-21', '2026-04-01'), '2026-11-21');
  assert.equal(parseQuickVoucherDate('invalid', '2026-04-01'), '2026-04-01');
});

