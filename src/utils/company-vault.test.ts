import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STANDARD_INDIAN_ACCOUNT_GROUPS,
  buildKarmaCircleLogoSvg,
  canDeleteCompany,
  canExitSoftwareShell,
  createCompanyEntry,
  createInitialCompanyChartOfAccounts,
  extractPanFromGstin,
  extractStateFromGstin,
  formatFyPeriod,
  parseTallySmartDate,
  projectPrivacySafeCompanyList,
  resolveGatewayMode,
  resolveInitialCompanyRegistry,
  validateFinancialPeriod,
  validateGstinFormat,
} from './company-vault';

test('createCompanyEntry rejects empty or single-character company names', () => {
  assert.equal(createCompanyEntry({ name: '' }).ok, false);
  assert.equal(createCompanyEntry({ name: '   ' }).ok, false);
  assert.equal(createCompanyEntry({ name: 'A' }).ok, false);
});

test('createCompanyEntry validates GSTIN and auto-detects Indian state code', () => {
  const invalid = createCompanyEntry({ name: 'Apex Traders', gstin: 'INVALID123' });
  assert.equal(invalid.ok, false);

  const valid = createCompanyEntry(
    {
      name: 'Deccan Agro Exports Pvt Ltd',
      gstin: '27aaacp1234a1z5',
      fyFrom: '2026-04-01',
      fyTo: '2027-03-31',
      booksBeginningFrom: '2026-04-01',
    },
    '2026-10-24T09:00:00.000Z',
  );
  assert.equal(valid.ok, true);
  assert.equal(valid.entry?.gstin, '27AAACP1234A1Z5');
  assert.equal(valid.entry?.state, 'Maharashtra');
  assert.equal(valid.entry?.stateCode, '27');
  assert.equal(valid.entry?.periodLabel, '01-Apr-2026 to 31-Mar-2027');
});

test('createCompanyEntry validates financial year date bounds', () => {
  const badRange = createCompanyEntry({
    name: 'Test Entity',
    fyFrom: '2027-04-01',
    fyTo: '2026-03-31',
  });
  assert.equal(badRange.ok, false);

  const badBooks = createCompanyEntry({
    name: 'Test Entity',
    fyFrom: '2026-04-01',
    fyTo: '2027-03-31',
    booksBeginningFrom: '2025-12-01',
  });
  assert.equal(badBooks.ok, false);
});

test('projectPrivacySafeCompanyList strips balances, turnover, and voucher counts', () => {
  const projected = projectPrivacySafeCompanyList([
    {
      id: 'c1',
      name: 'Deccan Cotton Mills Pvt Ltd',
      gstin: '27AAACP1234A1Z5',
      state: 'Maharashtra',
      fyFrom: '2026-04-01',
      fyTo: '2027-03-31',
      cashBalance: 563500,
      turnover: 9850000,
      vouchersCount: 48,
    },
  ]);

  assert.equal(projected.length, 1);
  assert.deepEqual(Object.keys(projected[0]).sort(), ['gstin', 'id', 'name', 'periodLabel', 'state']);
  assert.equal(projected[0].name, 'Deccan Cotton Mills Pvt Ltd');
  assert.equal(projected[0].periodLabel, '01-Apr-2026 to 31-Mar-2027');
  assert.equal('cashBalance' in projected[0], false);
  assert.equal('turnover' in projected[0], false);
  assert.equal('vouchersCount' in projected[0], false);
});

test('Zero-Demo Policy: resolveInitialCompanyRegistry returns 0 companies on empty or demo-only storage and preserves real companies', () => {
  assert.deepEqual(resolveInitialCompanyRegistry(null, null), []);
  assert.equal(resolveGatewayMode([]), 'fresh-empty');

  const demoReg = JSON.stringify([
    { id: 'comp-default-banas', name: 'Banas Traders & Agro Products', gstin: '24AAAFK0142C1Z5' },
  ]);
  const demoState = JSON.stringify({ company: { name: 'Banas Traders & Agro Products' } });
  assert.deepEqual(resolveInitialCompanyRegistry(demoReg, demoState), []);

  const realReg = JSON.stringify([
    { id: 'comp-apex-1', name: 'Apex Cotton Mills Pvt Ltd', gstin: '27AAACP1234A1Z5', fyFrom: '2026-04-01', fyTo: '2027-03-31' },
  ]);
  const loaded = resolveInitialCompanyRegistry(realReg, null);
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].name, 'Apex Cotton Mills Pvt Ltd');
  assert.equal(resolveGatewayMode(loaded), 'existing-companies');

  const realLegacy = JSON.stringify({
    company: { name: 'Surya Textile Traders', gstin: '24AABCS9999A1Z1', currentPeriod: '01-Apr-2026 to 31-Mar-2027' },
  });
  const migrated = resolveInitialCompanyRegistry(null, realLegacy);
  assert.equal(migrated.length, 1);
  assert.equal(migrated[0].name, 'Surya Textile Traders');
});

test('canExitSoftwareShell blocks unconfirmed exits while inside software shell', () => {
  assert.equal(canExitSoftwareShell(true, false), false);
  assert.equal(canExitSoftwareShell(true, true), true);
  assert.equal(canExitSoftwareShell(false, false), true);
});

test('extractStateFromGstin, extractPanFromGstin, and formatFyPeriod work accurately', () => {
  assert.deepEqual(extractStateFromGstin('24AAAFK0142C1Z5'), { stateCode: '24', stateName: 'Gujarat' });
  assert.equal(extractPanFromGstin('24AAAFK0142C1Z5'), 'AAAFK0142C');
  assert.equal(extractPanFromGstin('INVALID'), '');
  assert.equal(extractStateFromGstin('99INVALID'), null);
  assert.equal(validateGstinFormat('24AAAFK0142C1Z5'), true);
  assert.equal(validateGstinFormat(''), true);
  assert.equal(formatFyPeriod('2026-04-01', '2027-03-31'), '01-Apr-2026 to 31-Mar-2027');
});

test('createInitialCompanyChartOfAccounts initializes exactly 18 standard Indian groups and 2 zero-balance system ledgers', () => {
  const coa = createInitialCompanyChartOfAccounts();
  assert.equal(coa.groups.length, 18);
  assert.equal(STANDARD_INDIAN_ACCOUNT_GROUPS.length, 18);
  assert.equal(coa.groups.some((g) => g.name === 'Capital Account'), true);
  assert.equal(coa.groups.some((g) => g.name === 'Duties & Taxes'), true);
  assert.equal(coa.groups.some((g) => g.name === 'Sundry Debtors'), true);
  assert.equal(coa.groups.some((g) => g.name === 'Stock-in-Hand'), true);

  assert.equal(coa.ledgers.length, 2);
  assert.deepEqual(
    coa.ledgers.map((l) => ({ name: l.name, group: l.group, balance: l.balance })),
    [
      { name: 'Cash', group: 'Cash-in-Hand', balance: 0 },
      { name: 'Profit & Loss A/c', group: 'Primary', balance: 0 },
    ],
  );
});

test('parseTallySmartDate handles Tally DD-MM shorthand, slashes, full dates, and weekdays within active FY', () => {
  const octDash = parseTallySmartDate('15-10', '2026-04-01', '2027-03-31');
  assert.equal(octDash.ok, true);
  assert.equal(octDash.iso, '2026-10-15');
  assert.equal(octDash.ddmmyyyy, '15-10-2026');
  assert.equal(octDash.weekday, 'Thursday');

  const octSlash = parseTallySmartDate('15/10', '2026-04-01', '2027-03-31');
  assert.equal(octSlash.ok, true);
  assert.equal(octSlash.iso, '2026-10-15');

  const febNextCalYear = parseTallySmartDate('15-02', '2026-04-01', '2027-03-31');
  assert.equal(febNextCalYear.ok, true);
  assert.equal(febNextCalYear.iso, '2027-02-15');
  assert.equal(febNextCalYear.weekday, 'Monday');

  const fullDate = parseTallySmartDate('01-04-2026', '2026-04-01', '2027-03-31');
  assert.equal(fullDate.ok, true);
  assert.equal(fullDate.iso, '2026-04-01');
  assert.equal(fullDate.weekday, 'Wednesday');

  const invalidCalendar = parseTallySmartDate('31-02-2026', '2026-04-01', '2027-03-31');
  assert.equal(invalidCalendar.ok, false);
});

test('validateFinancialPeriod and canDeleteCompany enforce strict statutory guards', () => {
  assert.equal(validateFinancialPeriod('2026-04-01', '2027-03-31').ok, true);
  assert.equal(validateFinancialPeriod('2027-04-01', '2026-03-31').ok, false);

  assert.equal(canDeleteCompany('DELETE'), true);
  assert.equal(canDeleteCompany('delete'), false);
  assert.equal(canDeleteCompany('DEL'), false);
  assert.equal(canDeleteCompany(''), false);
});

test('buildKarmaCircleLogoSvg renders transparent maroon & gold interlocking arcs without background rect', () => {
  const svg = buildKarmaCircleLogoSvg(52);
  assert.match(svg, /width="52"/);
  assert.match(svg, /fill="#800000"/);
  assert.match(svg, /fill="#D4AF37"/);
  assert.equal(svg.includes('<rect'), false);
});
