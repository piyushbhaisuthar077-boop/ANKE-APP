import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGstDistribution,
  formatIndianCurrency,
  transitionViewState,
  getShortcutDetails,
  getVoucherMode,
  numberToIndianEnglishWords,
  calculateSimulatorInvoice,
  VOUCHER_TYPE_DEFINITIONS,
  VOUCHER_MODE_DEFINITIONS,
  generateVoucherSerial,
  extractStateCodeFromGstin,
  filterPartyLedgersForVoucher,
  SAC_CODES_CATALOG,
  TDS_SECTIONS,
  calculateAccountingInvoiceSummary,
  applyAccountingLedgerEffect,
  filterDaybookVouchers,
  calculateDaybookMetrics,
  exportDaybookToCsv,
  createKarmaAuditBundle,
  normalizeDateToIso,
  formatBytes,
  calculateStorageQuota,
  calculateTelemetryBreakdown,
  validateBackupPayload,
  generateGoogleDriveMultipartPayload,
  encryptAnkeVault,
  decryptAnkeVault,
  PRINT_TEMPLATE_FAMILIES,
  generateWhatsAppShareText,
  generateWhatsAppShareUrl,
  calculatePrintStudioModel,
  STATUTORY_28_INDIAN_GROUPS,
  buildChartOfAccountsTree,
  calculateLedgerMonthlySummary,
  exportChartOfAccountsToCsv,
  calculateItemValuation,
  calculateStockSummary,
  calculateItemMonthlyMovement,
  exportStockSummaryToCsv,
} from './tax-logic';





test('calculateGstDistribution intra-state splits equally into CGST and SGST', () => {
  const result = calculateGstDistribution(100000, 18, false);
  assert.equal(result.cgst, 9000);
  assert.equal(result.sgst, 9000);
  assert.equal(result.igst, 0);
  assert.equal(result.totalTax, 18000);
  assert.equal(result.totalAmount, 118000);
});

test('calculateGstDistribution inter-state charges full rate to IGST', () => {
  const result = calculateGstDistribution(250000, 18, true);
  assert.equal(result.cgst, 0);
  assert.equal(result.sgst, 0);
  assert.equal(result.igst, 45000);
  assert.equal(result.totalTax, 45000);
  assert.equal(result.totalAmount, 295000);
});

test('formatIndianCurrency formats numbers according to Indian lakh numbering system', () => {
  assert.equal(formatIndianCurrency(1845200), '₹18,45,200.00');
  assert.equal(formatIndianCurrency(10000000), '₹1,00,00,000.00');
  assert.equal(formatIndianCurrency(45210.5), '₹45,210.50');
});

test('transitionViewState toggles between website and anke view states cleanly', () => {
  assert.equal(transitionViewState('website', 'open_anke'), 'anke');
  assert.equal(transitionViewState('anke', 'open_website'), 'website');
  assert.equal(transitionViewState('website', 'toggle'), 'anke');
  assert.equal(transitionViewState('anke', 'toggle'), 'website');
});

test('calculateLiveInvoice math correctly yields 29,500 for 100 qty @ 250 with 18% tax', () => {
  const qty = 100;
  const price = 250;
  const rate = 18;
  const taxable = qty * price;
  const result = calculateGstDistribution(taxable, rate, false);
  assert.equal(taxable, 25000);
  assert.equal(result.cgst, 2250);
  assert.equal(result.sgst, 2250);
  assert.equal(result.totalTax, 4500);
  assert.equal(result.totalAmount, 29500);
});

test('SHORTCUT_CATALOG provides complete metadata for F4-F9 and essential combos', () => {
  const f4 = getShortcutDetails('F4');
  assert.ok(f4);
  assert.equal(f4.voucherType, 'Contra');
  assert.equal(f4.name, 'Contra Voucher');

  const f8 = getShortcutDetails('F8');
  assert.ok(f8);
  assert.equal(f8.voucherType, 'Sales');

  const ctrlH = getShortcutDetails('Ctrl+H');
  assert.ok(ctrlH);
  assert.equal(ctrlH.category, 'navigation');

  const unknown = getShortcutDetails('INVALID_KEY');
  assert.equal(unknown, null);
});

test('VOUCHER_MODES contains all 4 distinct accounting workflows with sample entries', () => {
  const itemMode = getVoucherMode('item');
  assert.equal(itemMode.name, 'Item Invoice Mode');
  assert.equal(itemMode.sampleEntry.columns.length, 6);

  const accountingMode = getVoucherMode('accounting');
  assert.equal(accountingMode.name, 'Accounting Invoice Mode');

  const asVoucherMode = getVoucherMode('asVoucher');
  assert.equal(asVoucherMode.name, 'As Voucher Mode (Double Entry Dr / Cr)');

  const singleEntryMode = getVoucherMode('singleEntry');
  assert.equal(singleEntryMode.name, 'Single Entry Mode');

  // Fallback defaults to item mode
  const fallback = getVoucherMode('non_existent');
  assert.equal(fallback.id, 'item');
});

test('numberToIndianEnglishWords converts currency numbers accurately', () => {
  assert.equal(numberToIndianEnglishWords(0), 'Rupees Zero Only');
  assert.equal(numberToIndianEnglishWords(35400), 'Rupees Thirty-Five Thousand Four Hundred Only');
  assert.equal(numberToIndianEnglishWords(29500), 'Rupees Twenty-Nine Thousand Five Hundred Only');
  assert.equal(numberToIndianEnglishWords(1845200), 'Rupees Eighteen Lakh Forty-Five Thousand Two Hundred Only');
});

test('calculateSimulatorInvoice intra-state computes 25 qty @ 1200 with 18% tax accurately', () => {
  const sim = calculateSimulatorInvoice(25, 1200, 18, false);
  assert.equal(sim.taxableValue, 30000);
  assert.equal(sim.cgstAmount, 2700);
  assert.equal(sim.sgstAmount, 2700);
  assert.equal(sim.igstAmount, 0);
  assert.equal(sim.totalTax, 5400);
  assert.equal(sim.grandTotal, 35400);
  assert.equal(sim.amountInWords, 'Rupees Thirty-Five Thousand Four Hundred Only');
});

test('calculateSimulatorInvoice inter-state routes 100% tax to IGST', () => {
  const sim = calculateSimulatorInvoice(
    25,
    1200,
    18,
    true,
    'Apex Horizon Technologies Pvt Ltd',
    'Maharashtra (27) — Inter-State (IGST)'
  );
  assert.equal(sim.taxableValue, 30000);
  assert.equal(sim.cgstAmount, 0);
  assert.equal(sim.sgstAmount, 0);
  assert.equal(sim.igstAmount, 5400);
  assert.equal(sim.grandTotal, 35400);
  assert.equal(sim.isInterState, true);
});

test('INVOICE_TEMPLATES contains exactly 50 uniquely numbered templates across 5 categories', async () => {
  const { INVOICE_TEMPLATES, getTemplateById, filterInvoiceTemplates } = await import('./tax-logic');
  assert.equal(INVOICE_TEMPLATES.length, 50);

  const ids = new Set<string>();
  const numbers = new Set<number>();
  const categoryCounts: Record<string, number> = {
    traditional: 0,
    corporate: 0,
    retail: 0,
    modern: 0,
    specialized: 0,
  };

  INVOICE_TEMPLATES.forEach((tmpl) => {
    assert.ok(tmpl.id, 'Template must have an id');
    assert.ok(!ids.has(tmpl.id), `Duplicate ID found: ${tmpl.id}`);
    ids.add(tmpl.id);

    assert.ok(!numbers.has(tmpl.number), `Duplicate number found: ${tmpl.number}`);
    numbers.add(tmpl.number);

    assert.ok(tmpl.name.length > 0);
    assert.ok(tmpl.badge.length > 0);
    assert.ok(tmpl.description.length > 0);
    assert.ok(tmpl.industry.length > 0);
    assert.ok(tmpl.keyFeatures.length >= 3);
    assert.ok(tmpl.sampleClient.length > 0);
    assert.ok(tmpl.sampleItem.length > 0);

    assert.ok(categoryCounts[tmpl.category] !== undefined, `Unknown category ${tmpl.category}`);
    categoryCounts[tmpl.category]++;
  });

  // Verify 10 templates per category
  assert.equal(categoryCounts.traditional, 10);
  assert.equal(categoryCounts.corporate, 10);
  assert.equal(categoryCounts.retail, 10);
  assert.equal(categoryCounts.modern, 10);
  assert.equal(categoryCounts.specialized, 10);

  // Test getTemplateById
  const tmpl15 = getTemplateById('tmpl-15');
  assert.equal(tmpl15.name, 'Karma Accounts Signature B2B');
  assert.equal(tmpl15.badge, 'FLAGSHIP DESIGN');

  // Test filterInvoiceTemplates
  const allTemplates = filterInvoiceTemplates(INVOICE_TEMPLATES, 'all', '');
  assert.equal(allTemplates.length, 50);

  const corporateOnly = filterInvoiceTemplates(INVOICE_TEMPLATES, 'corporate', '');
  assert.equal(corporateOnly.length, 10);

  const searchThermal = filterInvoiceTemplates(INVOICE_TEMPLATES, 'all', 'thermal');
  assert.ok(searchThermal.length >= 4);

  const searchMandi = filterInvoiceTemplates(INVOICE_TEMPLATES, 'all', 'mandi');
  assert.equal(searchMandi.length, 1);
  assert.equal(searchMandi[0].id, 'tmpl-41');
});

test('calculatePresumptiveTax 44AD computes 6% on digital and 8% on cash turnover', async () => {
  const { calculatePresumptiveTax } = await import('./tax-logic');
  // ₹50,00,000 turnover with 80% digital (₹40,00,000) and 20% cash (₹10,00,000)
  // Deemed profit = (40,00,000 * 0.06) + (10,00,000 * 0.08) = 2,40,000 + 80,000 = 3,20,000
  const result = calculatePresumptiveTax('44AD', 5000000, 80);
  assert.equal(result.digitalTurnover, 4000000);
  assert.equal(result.cashTurnover, 1000000);
  assert.equal(result.deemedProfit, 320000);
  assert.equal(result.effectiveProfitRate, 6.4);
  assert.equal(result.isAuditExempt, true);
  // Profit is <= 7,00,000, so Section 87A rebate makes net tax 0
  assert.equal(result.estimatedTax, 0);
  assert.ok(result.whatsAppLink.includes('wa.me/919104253142'));
});

test('calculatePresumptiveTax 44ADA computes 50% deemed profit on professional receipts', async () => {
  const { calculatePresumptiveTax } = await import('./tax-logic');
  // ₹20,00,000 professional receipts -> 50% deemed profit = ₹10,00,000
  const result = calculatePresumptiveTax('44ADA', 2000000);
  assert.equal(result.deemedProfit, 1000000);
  assert.equal(result.effectiveProfitRate, 50);
  // Tax on ₹10,00,000:
  // 3-7L: 4,00,000 * 5% = 20,000
  // 7-10L: 3,00,000 * 10% = 30,000
  // Basic tax = 50,000 + 4% cess = 52,000
  assert.equal(result.estimatedTax, 52000);
  assert.equal(result.advanceTaxPayable, 52000);
});

test('calculateGstLateFeeAndInterest computes 18% annual interest and Section 47 daily fee', async () => {
  const { calculateGstLateFeeAndInterest } = await import('./tax-logic');
  // Net cash tax ₹75,000 delayed by 30 days on tax liability return (₹50/day)
  // Interest = (75,000 * 0.18 * 30) / 365 = 1109.589... -> 1109.59
  // Late fee = 30 * 50 = 1500
  const result = calculateGstLateFeeAndInterest(75000, 30, false);
  assert.equal(result.interestPayable, 1109.59);
  assert.equal(result.lateFeePayable, 1500);
  assert.equal(result.totalPayable, 2609.59);
  assert.ok(result.whatsAppLink.includes('919104253142'));

  // Nil return for 40 days (₹20/day capped at ₹500)
  const nilResult = calculateGstLateFeeAndInterest(0, 40, true);
  assert.equal(nilResult.interestPayable, 0);
  assert.equal(nilResult.lateFeePayable, 500); // capped at 500
  assert.equal(nilResult.totalPayable, 500);
});

test('COMPARISON_METRICS contains all 10 key operational criteria with pure professional English', async () => {
  const { COMPARISON_METRICS } = await import('./tax-logic');
  assert.equal(COMPARISON_METRICS.length, 10);

  const expectedIds = [
    'licensing-fee',
    'keyboard-velocity',
    'installation-os',
    'data-privacy',
    'invoice-gallery',
    'ca-bridge',
    'gst-engine',
    'multilingual-support',
    'thermal-pos',
    'offline-cdn',
  ];

  COMPARISON_METRICS.forEach((metric, idx) => {
    assert.equal(metric.metricNumber, idx + 1);
    assert.equal(metric.id, expectedIds[idx]);
    assert.ok(metric.feature.length > 5);
    assert.ok(metric.anke.value.length > 5);
    assert.ok(metric.anke.detail.length > 10);
    assert.ok(metric.desktopSoftware.value.length > 5);
    assert.ok(metric.cloudApps.value.length > 5);
    assert.equal(metric.anke.isAdvantage, true);
  });
});

test('VIRAL_LOOP_STEPS defines 3 authentic growth stages in professional English', async () => {
  const { VIRAL_LOOP_STEPS } = await import('./tax-logic');
  assert.equal(VIRAL_LOOP_STEPS.length, 3);
  assert.equal(VIRAL_LOOP_STEPS[0].title, 'Merchant Creates Professional Bill');
  assert.equal(VIRAL_LOOP_STEPS[1].title, 'Organic Network Distribution');
  assert.equal(VIRAL_LOOP_STEPS[2].title, 'Direct Advisory Conversion');
  assert.ok(VIRAL_LOOP_STEPS[1].description.includes('Generated via Anke'));
});

test('validateOnboardingForm enforces business name and 10-digit phone number', async () => {
  const { validateOnboardingForm, generateActivationCode, generateWhatsAppActivationUrl } = await import('./tax-logic');

  // Invalid empty submission
  const emptyRes = validateOnboardingForm({});
  assert.equal(emptyRes.isValid, false);
  assert.ok(emptyRes.errors.businessName);
  assert.ok(emptyRes.errors.mobile);

  // Valid submission
  const validRes = validateOnboardingForm({
    businessName: 'Banas Agro Commodities Corp',
    mobile: '9825012345',
  });
  assert.equal(validRes.isValid, true);
  assert.equal(Object.keys(validRes.errors).length, 0);

  // Activation code format
  const code = generateActivationCode('Banas Agro');
  assert.ok(code.startsWith('ANKE-BANA-'));

  // WhatsApp activation URL
  const waUrl = generateWhatsAppActivationUrl({
    businessName: 'Banas Agro Commodities Corp',
    proprietorName: 'Rajesh Patel',
    businessCategory: 'Wholesale Trading / APMC Mandi',
    activationCode: code,
  });
  assert.ok(waUrl.includes('https://wa.me/919104253142'));
  assert.ok(waUrl.includes('Banas%20Agro%20Commodities%20Corp'));
});

test('FAQ_ITEMS contains 6 comprehensive questions addressing data privacy and compliance', async () => {
  const { FAQ_ITEMS } = await import('./tax-logic');
  assert.equal(FAQ_ITEMS.length, 6);
  assert.ok(FAQ_ITEMS.every((item) => item.question.endsWith('?')));
  assert.ok(FAQ_ITEMS.every((item) => item.answer.length > 50));
  assert.ok(FAQ_ITEMS[1].answer.includes('zero-knowledge'));
  assert.ok(FAQ_ITEMS[1].answer.includes('Google Drive'));
});

test('CASE_STUDIES and SECURITY_GUARANTEES provide verified B2B proofs', async () => {
  const { CASE_STUDIES, SECURITY_GUARANTEES } = await import('./tax-logic');
  assert.equal(CASE_STUDIES.length, 3);
  assert.equal(SECURITY_GUARANTEES.length, 4);
  assert.equal(CASE_STUDIES[0].entity, 'Banas Agro Commodities');
  assert.equal(CASE_STUDIES[1].entity, 'Metro Supermart & Provisions');
  assert.equal(CASE_STUDIES[2].entity, 'Western Engineering Components');
});

test('PRACTICE_AREAS and ANKE_ECOSYSTEM_LINKS contain verified corporate resources', async () => {
  const { PRACTICE_AREAS, ANKE_ECOSYSTEM_LINKS, OFFICE_METADATA } = await import('./tax-logic');
  assert.equal(PRACTICE_AREAS.length, 7);
  assert.equal(ANKE_ECOSYSTEM_LINKS.length, 6);
  assert.equal(OFFICE_METADATA.phone, '+91 9104253142');
  assert.ok(OFFICE_METADATA.headquarters.includes('Banaskantha'));
  assert.ok(OFFICE_METADATA.founder.includes('Piyush Suthar'));
});

test('ANKE_INITIAL_STATE and ANKE_LOCALIZATION provide verified enterprise ERP defaults', async () => {
  const { ANKE_INITIAL_STATE, ANKE_LOCALIZATION } = await import('./tax-logic');
  assert.equal(ANKE_INITIAL_STATE.company.name, 'Banas Traders & Agro Products');
  assert.equal(ANKE_INITIAL_STATE.company.gstin, '24AAAFK0142C1Z5');
  assert.equal(ANKE_INITIAL_STATE.vouchersCount, 48);
  assert.equal(ANKE_INITIAL_STATE.ledgers.length, 9);
  assert.equal(ANKE_INITIAL_STATE.stockItems.length, 4);

  // Localization checks
  assert.ok(ANKE_LOCALIZATION.en.create.includes('Create'));
  assert.ok(ANKE_LOCALIZATION.en_gu.create.includes('બનાવો'));
  assert.ok(ANKE_LOCALIZATION.en_hi.create.includes('निर्माण'));
  assert.ok(ANKE_LOCALIZATION.en_gu.sales.includes('વેચાણ'));
  assert.ok(ANKE_LOCALIZATION.en_hi.sales.includes('बिक्री'));
});

test('extractPanFromGstin and validateGstin handle Indian tax identities accurately', async () => {
  const { extractPanFromGstin, validateGstin, INDIAN_STATES_UTS } = await import('./tax-logic');
  assert.equal(INDIAN_STATES_UTS.length, 36);
  const gujarat = INDIAN_STATES_UTS.find(s => s.code === '24');
  assert.ok(gujarat);
  assert.equal(gujarat.name, 'Gujarat');

  // Valid GSTIN test
  const validGstin = '24AAAFK0142C1Z5';
  assert.equal(extractPanFromGstin(validGstin), 'AAAFK0142C');
  const validRes = validateGstin(validGstin);
  assert.equal(validRes.isValid, true);
  assert.equal(validRes.stateCode, '24');
  assert.equal(validRes.pan, 'AAAFK0142C');

  // Invalid GSTIN test
  const invalidGstin = '123INVALID';
  const invalidRes = validateGstin(invalidGstin);
  assert.equal(invalidRes.isValid, false);
});

test('CHART_OF_ACCOUNT_GROUPS and validateLedgerCreation enforce standard double-entry rules', async () => {
  const { CHART_OF_ACCOUNT_GROUPS, validateLedgerCreation } = await import('./tax-logic');
  assert.ok(CHART_OF_ACCOUNT_GROUPS.includes('Sundry Debtors'));
  assert.ok(CHART_OF_ACCOUNT_GROUPS.includes('Sundry Creditors'));
  assert.ok(CHART_OF_ACCOUNT_GROUPS.includes('Duties & Taxes'));
  assert.ok(CHART_OF_ACCOUNT_GROUPS.includes('Bank Accounts'));

  // Valid ledger
  const valid = validateLedgerCreation({
    name: 'Patan Oil Mill Corporation',
    group: 'Sundry Creditors',
    openingBalance: 45000,
    balanceType: 'Cr',
  });
  assert.equal(valid.isValid, true);

  // Missing name
  const missingName = validateLedgerCreation({
    name: '',
    group: 'Sundry Debtors',
  });
  assert.equal(missingName.isValid, false);
  assert.equal(missingName.error, 'Ledger name is required');

  // Missing group
  const missingGroup = validateLedgerCreation({
    name: 'Test Ledger',
    group: '',
  });
  assert.equal(missingGroup.isValid, false);
});

test('GST_UQC_UNITS and DEFAULT_DEMO_STOCK_ITEMS provide official GST measurement units and demo inventory', async () => {
  const { GST_UQC_UNITS, DEFAULT_DEMO_STOCK_ITEMS, calculateStockValuation, evaluateReorderStatus, validateStockItemCreation } = await import('./tax-logic');
  
  // Verify 12 standard GST UQC units
  assert.equal(GST_UQC_UNITS.length, 12);
  const uqcCodes = GST_UQC_UNITS.map(u => u.code);
  assert.ok(uqcCodes.includes('KGS'));
  assert.ok(uqcCodes.includes('QTL'));
  assert.ok(uqcCodes.includes('BOX'));
  assert.ok(uqcCodes.includes('PCS'));
  assert.ok(uqcCodes.includes('NOS'));
  assert.ok(uqcCodes.includes('BAG'));

  // Valuation calculation
  assert.equal(calculateStockValuation(2500, 260), 650000);
  assert.equal(calculateStockValuation(12.5, 84.5), 1056.25);

  // Reorder status
  assert.equal(evaluateReorderStatus(600, 500), 'In Stock');
  assert.equal(evaluateReorderStatus(500, 500), 'Low Stock');
  assert.equal(evaluateReorderStatus(120, 500), 'Low Stock');
  assert.equal(evaluateReorderStatus(0, 500), 'Critical');

  // Stock item validation
  const validItem = validateStockItemCreation({
    name: 'Cumin Seeds - Grade A Premium',
    unit: 'KGS - KILOGRAMS',
    hsn: '0909'
  });
  assert.equal(validItem.isValid, true);

  const missingName = validateStockItemCreation({
    name: '',
    unit: 'KGS - KILOGRAMS'
  });
  assert.equal(missingName.isValid, false);

  const invalidHsn = validateStockItemCreation({
    name: 'Hardware Bolts',
    unit: 'PCS - PIECES',
    hsn: 'INVALID12'
  });
  assert.equal(invalidHsn.isValid, false);

  // Verify demo items have valid structure and pure English naming
  assert.equal(DEFAULT_DEMO_STOCK_ITEMS.length, 4);
  DEFAULT_DEMO_STOCK_ITEMS.forEach(item => {
    assert.ok(item.name.length > 0);
    assert.ok(item.hsn.length >= 4);
    assert.ok(item.openingQty > 0);
    assert.ok(item.openingRate > 0);
    assert.equal(item.openingValue, item.openingQty * item.openingRate);
  });
});

test('Universal Voucher Shell definitions and serial generation (Prompt 16)', () => {
  // Test all 6 core voucher types exist with required shortcuts and colors
  const types = ['CONTRA', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'SALES', 'PURCHASE'] as const;
  types.forEach(t => {
    const config = VOUCHER_TYPE_DEFINITIONS[t];
    assert.ok(config);
    assert.ok(config.shortcut.startsWith('F'));
    assert.ok(config.badgeLabel.length > 0);
    assert.ok(config.serialPrefix.length > 0);
    assert.ok(config.allowedModes.length > 0);
  });

  // Verify function keys mapping
  assert.equal(VOUCHER_TYPE_DEFINITIONS.CONTRA.shortcut, 'F4');
  assert.equal(VOUCHER_TYPE_DEFINITIONS.PAYMENT.shortcut, 'F5');
  assert.equal(VOUCHER_TYPE_DEFINITIONS.RECEIPT.shortcut, 'F6');
  assert.equal(VOUCHER_TYPE_DEFINITIONS.JOURNAL.shortcut, 'F7');
  assert.equal(VOUCHER_TYPE_DEFINITIONS.SALES.shortcut, 'F8');
  assert.equal(VOUCHER_TYPE_DEFINITIONS.PURCHASE.shortcut, 'F9');

  // Verify all 4 modes exist with numeric keys 1 to 4
  const modes = ['item-invoice', 'accounting-invoice', 'as-voucher', 'single-entry'] as const;
  modes.forEach(m => {
    const def = VOUCHER_MODE_DEFINITIONS[m];
    assert.ok(def);
    assert.ok(['1', '2', '3', '4'].includes(def.numberKey));
    assert.ok(def.title.length > 0);
    assert.ok(def.pillLabel.length > 0);
  });

  // Test serial generator
  assert.equal(generateVoucherSerial('SALES', 1, '26-27'), 'SA/26-27/001');
  assert.equal(generateVoucherSerial('PURCHASE', 4, '26-27'), 'PUR/26-27/004');
  assert.equal(generateVoucherSerial('PAYMENT', 42), 'PMT/2026/042');
  assert.equal(generateVoucherSerial('RECEIPT', 28), 'RCP/2026/028');
  assert.equal(generateVoucherSerial('CONTRA', 15), 'CNT/2026/015');
  assert.equal(generateVoucherSerial('JOURNAL', 19), 'JRN/2026/019');

  // Test GSTIN state code extraction
  assert.equal(extractStateCodeFromGstin('24AAAFK0142C1Z5'), '24');
  assert.equal(extractStateCodeFromGstin('27AAAAA0000A1Z5'), '27');
  assert.equal(extractStateCodeFromGstin('INVALID_GSTIN'), null);
  assert.equal(extractStateCodeFromGstin(''), null);

  // Test party ledger filtering for Sales, Purchase, Contra
  const testLedgers = [
    { id: '1', name: 'Apex Horizon Tech', group: 'Sundry Debtors' },
    { id: '2', name: 'Narmada Agro Spares', group: 'Sundry Creditors' },
    { id: '3', name: 'Cash-in-Hand', group: 'Cash-in-Hand' },
    { id: '4', name: 'HDFC Bank Current A/c', group: 'Bank Accounts' },
    { id: '5', name: 'Electricity Expense', group: 'Indirect Expenses' }
  ];

  const salesParties = filterPartyLedgersForVoucher(testLedgers, 'SALES');
  assert.equal(salesParties.length, 3);
  assert.ok(salesParties.some(p => p.name === 'Apex Horizon Tech'));
  assert.ok(salesParties.some(p => p.name === 'Cash-in-Hand'));
  assert.ok(salesParties.some(p => p.name === 'HDFC Bank Current A/c'));
  assert.ok(!salesParties.some(p => p.name === 'Narmada Agro Spares'));

  const purchaseParties = filterPartyLedgersForVoucher(testLedgers, 'PURCHASE');
  assert.equal(purchaseParties.length, 3);
  assert.ok(purchaseParties.some(p => p.name === 'Narmada Agro Spares'));
  assert.ok(purchaseParties.some(p => p.name === 'Cash-in-Hand'));
  assert.ok(purchaseParties.some(p => p.name === 'HDFC Bank Current A/c'));

  const contraParties = filterPartyLedgersForVoucher(testLedgers, 'CONTRA');
  assert.equal(contraParties.length, 2);
  assert.ok(contraParties.some(p => p.name === 'Cash-in-Hand'));
  assert.ok(contraParties.some(p => p.name === 'HDFC Bank Current A/c'));
});

test('calculateItemRow calculates gross, discount, taxable, and GST distribution correctly', async () => {
  const { calculateItemRow } = await import('./tax-logic');

  // Test 1: Intra-state 5% on 100 qty @ 260 with 0% discount
  const intra5 = calculateItemRow(100, 260, 0, 5, false);
  assert.equal(intra5.grossAmount, 26000);
  assert.equal(intra5.discountAmount, 0);
  assert.equal(intra5.taxableAmount, 26000);
  assert.equal(intra5.cgstAmount, 650);
  assert.equal(intra5.sgstAmount, 650);
  assert.equal(intra5.igstAmount, 0);
  assert.equal(intra5.taxAmount, 1300);
  assert.equal(intra5.lineTotal, 27300);

  // Test 2: Intra-state with 10% trade discount
  const withDisc = calculateItemRow(100, 260, 10, 5, false);
  assert.equal(withDisc.grossAmount, 26000);
  assert.equal(withDisc.discountAmount, 2600);
  assert.equal(withDisc.taxableAmount, 23400);
  assert.equal(withDisc.cgstAmount, 585);
  assert.equal(withDisc.sgstAmount, 585);
  assert.equal(withDisc.taxAmount, 1170);
  assert.equal(withDisc.lineTotal, 24570);

  // Test 3: Inter-state 18% on 50 qty @ 1000 with 0% discount
  const inter18 = calculateItemRow(50, 1000, 0, 18, true);
  assert.equal(inter18.taxableAmount, 50000);
  assert.equal(inter18.cgstAmount, 0);
  assert.equal(inter18.sgstAmount, 0);
  assert.equal(inter18.igstAmount, 9000);
  assert.equal(inter18.taxAmount, 9000);
  assert.equal(inter18.lineTotal, 59000);
});

test('calculateItemInvoiceTotals aggregates multi-line items, handles additional charges and round-off', async () => {
  const { calculateItemInvoiceTotals } = await import('./tax-logic');

  const lines = [
    {
      id: 'l1',
      itemId: 'itm-1',
      itemName: 'Cumin Seeds (Jeera)',
      hsnCode: '0909',
      qty: 100,
      unit: 'KGS',
      rate: 260,
      discountPercent: 0,
      gstRate: 5,
    },
    {
      id: 'l2',
      itemId: 'itm-2',
      itemName: 'Mustard Seeds (Raydo)',
      hsnCode: '1207',
      qty: 200,
      unit: 'KGS',
      rate: 75,
      discountPercent: 0,
      gstRate: 5,
    },
  ];

  // Intra-state totals
  const intraTotals = calculateItemInvoiceTotals(lines, false, [{ id: 'frt', name: 'Freight Charges', amount: 500 }]);
  assert.equal(intraTotals.taxableSubtotal, 41000); // 26000 + 15000
  assert.equal(intraTotals.cgstTotal, 1025); // 2.5% of 41000
  assert.equal(intraTotals.sgstTotal, 1025);
  assert.equal(intraTotals.igstTotal, 0);
  assert.equal(intraTotals.taxTotal, 2050);
  assert.equal(intraTotals.additionalChargesTotal, 500);
  assert.equal(intraTotals.preRoundTotal, 43550);
  assert.equal(intraTotals.grandTotal, 43550);
  assert.equal(intraTotals.roundOff, 0);
  assert.equal(intraTotals.amountInWords, 'Rupees Forty-Three Thousand Five Hundred and Fifty Only');

  // Inter-state totals
  const interTotals = calculateItemInvoiceTotals(lines, true);
  assert.equal(interTotals.taxableSubtotal, 41000);
  assert.equal(interTotals.cgstTotal, 0);
  assert.equal(interTotals.sgstTotal, 0);
  assert.equal(interTotals.igstTotal, 2050);
  assert.equal(interTotals.grandTotal, 43050);
});

test('generateUpiPaymentString formats official UPI URI with payee name and amount', async () => {
  const { generateUpiPaymentString } = await import('./tax-logic');
  const uri = generateUpiPaymentString({
    upiId: 'accounts@okaxis',
    payeeName: 'Anke OS ERP',
    amount: 43050,
    transactionNote: 'INV-2026-001',
  });
  assert.ok(uri.startsWith('upi://pay?'));
  assert.ok(uri.includes('pa=accounts%40okaxis') || uri.includes('pa=accounts@okaxis'));
  assert.ok(uri.includes('am=43050.00'));
});

test('applyInventoryAndLedgerEffect updates stock and debtor/creditor ledger balances deterministically', async () => {
  const { applyInventoryAndLedgerEffect, calculateItemInvoiceTotals } = await import('./tax-logic');

  const stock = [
    { id: 'itm-1', name: 'Cumin Seeds', hsn: '0909', unit: 'KGS', gstRate: 5, openingStockQty: 500 }
  ];
  const ledgers = [
    { id: 'cust-1', name: 'Apex Horizon', group: 'Sundry Debtors', balance: 10000, balanceType: 'Dr' as const }
  ];

  const lines = [
    {
      id: 'l1',
      itemId: 'itm-1',
      itemName: 'Cumin Seeds',
      hsnCode: '0909',
      qty: 100,
      unit: 'KGS',
      rate: 260,
      discountPercent: 0,
      gstRate: 5,
    }
  ];
  const totals = calculateItemInvoiceTotals(lines, false);

  // SALES: Stock decreases by 100 (500 -> 400), Debtor increases by 27300 (10000 + 27300 -> 37300 Dr)
  const salesResult = applyInventoryAndLedgerEffect(stock, ledgers, {
    voucherType: 'SALES',
    voucherNumber: 'SA/26-27/001',
    date: '2026-10-26',
    partyId: 'cust-1',
    placeOfSupply: '24',
    lines: lines.map(l => ({ ...l, taxableAmount: 26000, taxAmount: 1300, lineTotal: 27300 })),
    summary: totals
  });

  assert.equal(salesResult.updatedStockItems[0].openingStockQty, 400);
  assert.equal(salesResult.updatedLedgers[0].balance, 37300);
  assert.equal(salesResult.updatedLedgers[0].balanceType, 'Dr');
  assert.equal(salesResult.voucherRecord.number, 'SA/26-27/001');

  // PURCHASE: Stock increases by 50 (500 -> 550)
  const purchaseResult = applyInventoryAndLedgerEffect(stock, ledgers, {
    voucherType: 'PURCHASE',
    voucherNumber: 'PUR/26-27/001',
    date: '2026-10-26',
    partyId: 'cust-1',
    placeOfSupply: '24',
    lines: lines.map(l => ({ ...l, qty: 50, taxableAmount: 13000, taxAmount: 650, lineTotal: 13650 })),
    summary: { ...totals, grandTotal: 13650 }
  });

  assert.equal(purchaseResult.updatedStockItems[0].openingStockQty, 550);
});

test('SAC_CODES_CATALOG contains valid statutory codes and rates', () => {
  assert.ok(SAC_CODES_CATALOG['9982']);
  assert.equal(SAC_CODES_CATALOG['9982'].defaultGstRate, 18);
  assert.equal(SAC_CODES_CATALOG['9982'].recommendedTdsSection, '194J');

  assert.ok(SAC_CODES_CATALOG['9965']);
  assert.equal(SAC_CODES_CATALOG['9965'].defaultGstRate, 5);
  assert.equal(SAC_CODES_CATALOG['9965'].recommendedTdsSection, '194C');

  assert.ok(SAC_CODES_CATALOG['9983']);
  assert.equal(SAC_CODES_CATALOG['9983'].defaultGstRate, 18);
});

test('TDS_SECTIONS contains statutory sections with accurate rates', () => {
  assert.equal(TDS_SECTIONS['194J_prof'].rate, 10);
  assert.equal(TDS_SECTIONS['194J_tech'].rate, 2);
  assert.equal(TDS_SECTIONS['194C_ind'].rate, 1);
  assert.equal(TDS_SECTIONS['194C_corp'].rate, 2);
  assert.equal(TDS_SECTIONS['194I_rent'].rate, 10);
  assert.equal(TDS_SECTIONS['none'].rate, 0);
});

test('calculateAccountingInvoiceSummary calculates intra-state CGST+SGST split and TDS properly', () => {
  const lines = [
    { taxableAmount: 50000, gstRate: 18 }, // Legal / Accounting
    { taxableAmount: 30000, gstRate: 18 }, // IT Consulting
  ];

  const summary = calculateAccountingInvoiceSummary(lines, {
    isInterState: false,
    tdsSectionKey: '194J_prof', // 10% on 80,000 = 8,000
    addlChargeAmount: 500,
  });

  assert.equal(summary.grossTaxable, 80000);
  assert.equal(summary.totalTax, 14400);
  assert.equal(summary.cgst, 7200);
  assert.equal(summary.sgst, 7200);
  assert.equal(summary.igst, 0);
  assert.equal(summary.tdsRate, 10);
  assert.equal(summary.tdsAmount, 8000);
  assert.equal(summary.addlChargeAmount, 500);
  // subtotalWithTax = 80000 + 14400 + 500 = 94900
  assert.equal(summary.subtotalWithTax, 94900);
  assert.equal(summary.grandTotal, 94900);
  assert.equal(summary.roundOff, 0);
});

test('calculateAccountingInvoiceSummary handles inter-state IGST and auto round-off', () => {
  const lines = [
    { taxableAmount: 33333.33, gstRate: 18 }, // Tax = 5999.9994 -> 6000.00
  ];

  const summary = calculateAccountingInvoiceSummary(lines, {
    isInterState: true,
    tdsSectionKey: 'none',
    addlChargeAmount: 10.45,
  });

  assert.equal(summary.grossTaxable, 33333.33);
  assert.equal(summary.totalTax, 6000.00);
  assert.equal(summary.cgst, 0);
  assert.equal(summary.sgst, 0);
  assert.equal(summary.igst, 6000.00);
  // 33333.33 + 6000.00 + 10.45 = 39343.78
  assert.equal(summary.subtotalWithTax, 39343.78);
  assert.equal(summary.grandTotal, 39344);
  assert.equal(summary.roundOff, 0.22);
});

test('applyAccountingLedgerEffect updates party balance and service ledgers correctly', () => {
  const ledgers = [
    { id: 'client-1', name: 'Global Tech Corp', group: 'Sundry Debtors', balance: 50000, balanceType: 'Dr' as const },
    { id: 'serv-1', name: 'Consultancy Charges', group: 'Direct Incomes', balance: 120000, balanceType: 'Cr' as const },
  ];

  const payload = {
    voucherType: 'SALES' as const,
    voucherNumber: 'SRV/26-27/001',
    date: '2026-10-26',
    partyId: 'client-1',
    placeOfSupply: '24',
    lines: [
      {
        ledgerId: 'serv-1',
        ledgerName: 'Consultancy Charges',
        sacCode: '9983',
        taxableAmount: 40000,
        gstRate: 18,
        taxAmount: 7200,
        lineTotal: 47200,
      },
    ],
    summary: {
      grossTaxable: 40000,
      totalTax: 7200,
      cgst: 3600,
      sgst: 3600,
      igst: 0,
      isInterState: false,
      tdsSection: 'none',
      tdsRate: 0,
      tdsAmount: 0,
      addlChargeType: '',
      addlChargeAmount: 0,
      subtotalWithTax: 47200,
      roundOff: 0,
      grandTotal: 47200,
    },
  };

  const result = applyAccountingLedgerEffect(ledgers, payload);
  // Party Debtor balance increases by 47200 (50000 + 47200 = 97200 Dr)
  assert.equal(result.updatedLedgers[0].balance, 97200);
  assert.equal(result.updatedLedgers[0].balanceType, 'Dr');

  // Service Income balance increases by 40000 (120000 + 40000 = 160000 Cr)
  assert.equal(result.updatedLedgers[1].balance, 160000);
  assert.equal(result.updatedLedgers[1].balanceType, 'Cr');

  assert.equal(result.voucherRecord.number, 'SRV/26-27/001');
  assert.equal(result.voucherRecord.mode, 'accounting-invoice');
});

test('calculateAsVoucherTotals computes debits, credits, difference and status accurately', async () => {
  const { calculateAsVoucherTotals } = await import('./tax-logic');

  // 1. Balanced Entry
  const balancedLines = [
    { type: 'Dr' as const, amount: 75000 },
    { type: 'Cr' as const, amount: 50000 },
    { type: 'Cr' as const, amount: 25000 },
  ];
  const balancedRes = calculateAsVoucherTotals(balancedLines);
  assert.equal(balancedRes.totalDebit, 75000);
  assert.equal(balancedRes.totalCredit, 75000);
  assert.equal(balancedRes.difference, 0);
  assert.equal(balancedRes.isBalanced, true);
  assert.equal(balancedRes.status, 'BALANCED');
  assert.equal(balancedRes.amountInWords, 'Rupees Seventy-Five Thousand Only');

  // 2. Excess Debit (Out of Balance)
  const drExcessLines = [
    { type: 'Dr' as const, amount: 100000 },
    { type: 'Cr' as const, amount: 65000 },
  ];
  const drRes = calculateAsVoucherTotals(drExcessLines);
  assert.equal(drRes.totalDebit, 100000);
  assert.equal(drRes.totalCredit, 65000);
  assert.equal(drRes.difference, 35000);
  assert.equal(drRes.isBalanced, false);
  assert.equal(drRes.status, 'OUT_OF_BALANCE');
  assert.ok(drRes.statusMessage.includes('Excess Debit of ₹35,000.00'));

  // 3. Excess Credit (Out of Balance)
  const crExcessLines = [
    { type: 'Dr' as const, amount: 40000 },
    { type: 'Cr' as const, amount: 48500 },
  ];
  const crRes = calculateAsVoucherTotals(crExcessLines);
  assert.equal(crRes.difference, -8500);
  assert.equal(crRes.isBalanced, false);
  assert.ok(crRes.statusMessage.includes('Excess Credit of ₹8,500.00'));

  // 4. Empty lines
  const emptyRes = calculateAsVoucherTotals([]);
  assert.equal(emptyRes.status, 'EMPTY');
  assert.equal(emptyRes.isBalanced, false);
});

test('getOppositeBalancingEntry suggests accurate counter-balancing row', async () => {
  const { getOppositeBalancingEntry } = await import('./tax-logic');

  // Debit exceeds Credit by 25,000 -> suggests Credit of 25,000
  const bal1 = getOppositeBalancingEntry(100000, 75000);
  assert.equal(bal1.type, 'Cr');
  assert.equal(bal1.amount, 25000);

  // Credit exceeds Debit by 12,500 -> suggests Debit of 12,500
  const bal2 = getOppositeBalancingEntry(50000, 62500);
  assert.equal(bal2.type, 'Dr');
  assert.equal(bal2.amount, 12500);

  // Perfectly balanced -> returns 0
  const bal3 = getOppositeBalancingEntry(50000, 50000);
  assert.equal(bal3.amount, 0);
});

test('validateDoubleEntryEquilibrium enforces structural integrity and mathematical equilibrium', async () => {
  const { validateDoubleEntryEquilibrium } = await import('./tax-logic');

  // Valid compound entry
  const validEntry = [
    { type: 'Dr' as const, ledgerId: 'bank-1', amount: 50000 },
    { type: 'Cr' as const, ledgerId: 'debtor-1', amount: 48000 },
    { type: 'Cr' as const, ledgerId: 'disc-1', amount: 2000 },
  ];
  const resValid = validateDoubleEntryEquilibrium(validEntry);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);

  // Invalid: missing ledger
  const missingLedger = [
    { type: 'Dr' as const, ledgerId: '', amount: 50000 },
    { type: 'Cr' as const, ledgerId: 'debtor-1', amount: 50000 },
  ];
  const resMissing = validateDoubleEntryEquilibrium(missingLedger);
  assert.equal(resMissing.valid, false);
  assert.ok(resMissing.errors.some(e => e.includes('Please select a valid Ledger')));

  // Invalid: unbalanced amounts
  const unbalanced = [
    { type: 'Dr' as const, ledgerId: 'bank-1', amount: 50000 },
    { type: 'Cr' as const, ledgerId: 'debtor-1', amount: 40000 },
  ];
  const resUnbalanced = validateDoubleEntryEquilibrium(unbalanced);
  assert.equal(resUnbalanced.valid, false);
  assert.ok(resUnbalanced.errors.some(e => e.includes('Equilibrium violation')));

  // Invalid: all debits, no credit
  const allDebits = [
    { type: 'Dr' as const, ledgerId: 'bank-1', amount: 50000 },
    { type: 'Dr' as const, ledgerId: 'cash-1', amount: 50000 },
  ];
  const resAllDebits = validateDoubleEntryEquilibrium(allDebits);
  assert.equal(resAllDebits.valid, false);
  assert.ok(resAllDebits.errors.some(e => e.includes('Credit (Cr) entry')));
});

test('applyDoubleEntryLedgerEffect updates multiple ledger balances according to double-entry algebra', async () => {
  const { applyDoubleEntryLedgerEffect } = await import('./tax-logic');

  const ledgers = [
    { id: 'bank-1', name: 'HDFC Bank Ltd', group: 'Bank Accounts', balance: 100000, balanceType: 'Dr' as const },
    { id: 'debtor-1', name: 'Sunrise Impex', group: 'Sundry Debtors', balance: 60000, balanceType: 'Dr' as const },
    { id: 'discount-1', name: 'Discount Allowed', group: 'Indirect Expenses', balance: 5000, balanceType: 'Dr' as const },
  ];

  // Journal entry: Bank Dr 48,000, Discount Allowed Dr 2,000, Sunrise Impex Cr 50,000
  const payload = {
    voucherType: 'RECEIPT' as const,
    voucherNumber: 'RCP/2026/043',
    date: '2026-10-26',
    narration: 'Being full and final settlement from Sunrise Impex with cash discount allowed',
    lines: [
      { id: 'l1', type: 'Dr' as const, ledgerId: 'bank-1', ledgerName: 'HDFC Bank Ltd', amount: 48000 },
      { id: 'l2', type: 'Dr' as const, ledgerId: 'discount-1', ledgerName: 'Discount Allowed', amount: 2000 },
      { id: 'l3', type: 'Cr' as const, ledgerId: 'debtor-1', ledgerName: 'Sunrise Impex', amount: 50000 },
    ],
  };

  const result = applyDoubleEntryLedgerEffect(ledgers, payload);

  // Bank: 100,000 Dr + 48,000 Dr = 148,000 Dr
  const bank = result.updatedLedgers.find(l => l.id === 'bank-1')!;
  assert.equal(bank.balance, 148000);
  assert.equal(bank.balanceType, 'Dr');

  // Discount: 5,000 Dr + 2,000 Dr = 7,000 Dr
  const disc = result.updatedLedgers.find(l => l.id === 'discount-1')!;
  assert.equal(disc.balance, 7000);
  assert.equal(disc.balanceType, 'Dr');

  // Sunrise Impex: 60,000 Dr - 50,000 Cr = 10,000 Dr
  const debtor = result.updatedLedgers.find(l => l.id === 'debtor-1')!;
  assert.equal(debtor.balance, 10000);
  assert.equal(debtor.balanceType, 'Dr');

  // Voucher record check
  assert.equal(result.voucherRecord.type, 'RECEIPT');
  assert.equal(result.voucherRecord.number, 'RCP/2026/043');
  assert.equal(result.voucherRecord.summary.totalDebit, 50000);
  assert.equal(result.voucherRecord.summary.totalCredit, 50000);
  assert.equal(result.voucherRecord.summary.amountInWords, 'Rupees Fifty Thousand Only');
});





test("calculateSingleEntryClosingBalance computes projected cash/bank balance accurately", async () => {
  const { calculateSingleEntryClosingBalance } = await import("./tax-logic");

  // 1. Payment: 3,42,150 Dr - 42,000 = 3,00,150 Dr
  const pmt = calculateSingleEntryClosingBalance(342150, "Dr", 42000, "PAYMENT");
  assert.equal(pmt.closingBalance, 300150);
  assert.equal(pmt.closingBalanceType, "Dr");

  // 2. Receipt: 48,500 Dr + 15,000 = 63,500 Dr
  const rcpt = calculateSingleEntryClosingBalance(48500, "Dr", 15000, "RECEIPT");
  assert.equal(rcpt.closingBalance, 63500);
  assert.equal(rcpt.closingBalanceType, "Dr");

  // 3. Overdraft transition: 10,000 Dr - 25,000 Payment = 15,000 Cr (Overdrawn)
  const od = calculateSingleEntryClosingBalance(10000, "Dr", 25000, "PAYMENT");
  assert.equal(od.closingBalance, 15000);
  assert.equal(od.closingBalanceType, "Cr");
});

test("calculateSingleEntryTotals aggregates line items and generates words and closing balance", async () => {
  const { calculateSingleEntryTotals } = await import("./tax-logic");

  const lines = [
    { amount: 50000 },
    { amount: 25000 },
    { amount: 0 },
  ];
  const totals = calculateSingleEntryTotals(lines, 200000, "Dr", "PAYMENT");
  assert.equal(totals.totalAmount, 75000);
  assert.equal(totals.amountInWords, "Rupees Seventy-Five Thousand Only");
  assert.equal(totals.expectedClosingBalance, 125000);
  assert.equal(totals.expectedClosingBalanceType, "Dr");
});

test("validateSingleEntryVoucher enforces header account, non-zero amount, and distinct target ledgers", async () => {
  const { validateSingleEntryVoucher } = await import("./tax-logic");

  // Missing header account
  const resNoHeader = validateSingleEntryVoucher("", [{ ledgerId: "exp-1", amount: 5000 }]);
  assert.equal(resNoHeader.valid, false);
  assert.ok(resNoHeader.errors.some(e => e.includes("Header Account")));

  // Zero amount
  const resZeroAmt = validateSingleEntryVoucher("bank-1", [{ ledgerId: "exp-1", amount: 0 }]);
  assert.equal(resZeroAmt.valid, false);
  assert.ok(resZeroAmt.errors.some(e => e.includes("greater than ₹0.00")));

  // Target ledger same as header
  const resSame = validateSingleEntryVoucher("bank-1", [{ ledgerId: "bank-1", amount: 5000 }]);
  assert.equal(resSame.valid, false);
  assert.ok(resSame.errors.some(e => e.includes("Target ledger cannot be the same")));

  // Valid voucher
  const resValid = validateSingleEntryVoucher("bank-1", [
    { ledgerId: "exp-1", amount: 15000 },
    { ledgerId: "creditor-1", amount: 25000 },
  ]);
  assert.equal(resValid.valid, true);
  assert.equal(resValid.errors.length, 0);
});

test("applySingleEntryLedgerEffect applies double-entry mirror posting to Cash/Bank and line ledgers", async () => {
  const { applySingleEntryLedgerEffect } = await import("./tax-logic");

  const ledgers: Array<{ id: string; name: string; group: string; balance: number; balanceType: 'Dr' | 'Cr' }> = [
    { id: "bank-1", name: "State Bank of India", group: "Bank Accounts", balance: 250000, balanceType: "Dr" },
    { id: "supp-1", name: "Patan Mustard Mills", group: "Sundry Creditors", balance: 80000, balanceType: "Cr" },
    { id: "exp-1", name: "Freight Charges", group: "Direct Expenses", balance: 12000, balanceType: "Dr" },
  ];

  const payload = {
    voucherType: "PAYMENT" as const,
    voucherNumber: "PMT/2026/043",
    date: "2026-10-26",
    headerAccountId: "bank-1",
    narration: "Being vendor payment and freight paid via NEFT",
    lines: [
      { id: "l1", ledgerId: "supp-1", ledgerName: "Patan Mustard Mills", amount: 30000 },
      { id: "l2", ledgerId: "exp-1", ledgerName: "Freight Charges", amount: 5000 },
    ],
  };

  const result = applySingleEntryLedgerEffect(ledgers, payload);

  const bank = result.updatedLedgers.find(l => l.id === "bank-1")!;
  assert.equal(bank.balance, 215000);
  assert.equal(bank.balanceType, "Dr");

  const supp = result.updatedLedgers.find(l => l.id === "supp-1")!;
  assert.equal(supp.balance, 50000);
  assert.equal(supp.balanceType, "Cr");

  const exp = result.updatedLedgers.find(l => l.id === "exp-1")!;
  assert.equal(exp.balance, 17000);
  assert.equal(exp.balanceType, "Dr");

  assert.equal(result.voucherRecord.type, "PAYMENT");
  assert.equal(result.voucherRecord.mode, "single-entry");
  assert.equal(result.voucherRecord.summary.totalAmount, 35000);
  assert.equal(result.voucherRecord.summary.lineCount, 2);
  assert.equal(result.voucherRecord.summary.amountInWords, "Rupees Thirty-Five Thousand Only");
});


// -------------------------------------------------------------------------
// Prompt 21: Daybook & Chronological Audit Hub Test Suite
// -------------------------------------------------------------------------

test('normalizeDateToIso converts DD-MMM-YYYY and ISO correctly', () => {
  assert.equal(normalizeDateToIso('2026-10-26'), '2026-10-26');
  assert.equal(normalizeDateToIso('26-Oct-2026'), '2026-10-26');
  assert.equal(normalizeDateToIso('01-Apr-2026'), '2026-04-01');
  assert.equal(normalizeDateToIso('31-Mar-2027'), '2027-03-31');
});

test('filterDaybookVouchers filters by type, mode, date range, and text search', () => {
  const sampleVouchers = [
    {
      id: 'v-1',
      type: 'SALES' as const,
      number: 'SA/26-27/001',
      date: '26-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Patidar Agro Exports',
      debitAmount: 0,
      creditAmount: 47250,
      narration: 'Being goods dispatched to Mundra port'
    },
    {
      id: 'v-2',
      type: 'PURCHASE' as const,
      number: 'PUR/26-27/001',
      date: '25-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Shree Ambica Oil Mills',
      debitAmount: 39375,
      creditAmount: 0,
      narration: 'Being raw mustard inward'
    },
    {
      id: 'v-3',
      type: 'PAYMENT' as const,
      number: 'PMT/26-27/042',
      date: '24-Oct-2026',
      mode: 'single-entry' as const,
      partyName: 'UGVCL Power Electricity',
      debitAmount: 12450,
      creditAmount: 0,
      narration: 'Being monthly tariff payment'
    },
    {
      id: 'v-4',
      type: 'RECEIPT' as const,
      number: 'REC/26-27/028',
      date: '26-Oct-2026',
      mode: 'single-entry' as const,
      partyName: 'Patidar Agro Exports',
      debitAmount: 0,
      creditAmount: 40000,
      narration: 'Being NEFT advance received'
    }
  ];

  // 1. Filter by voucherType
  const salesOnly = filterDaybookVouchers(sampleVouchers, { voucherType: 'SALES' });
  assert.equal(salesOnly.length, 1);
  assert.equal(salesOnly[0].number, 'SA/26-27/001');

  // 2. Filter by mode
  const singleEntryOnly = filterDaybookVouchers(sampleVouchers, { mode: 'single-entry' });
  assert.equal(singleEntryOnly.length, 2);

  // 3. Filter by search query
  const patidarOnly = filterDaybookVouchers(sampleVouchers, { searchQuery: 'Patidar' });
  assert.equal(patidarOnly.length, 2);

  // 4. Filter by date range
  const dateRangeFiltered = filterDaybookVouchers(sampleVouchers, {
    fromDate: '2026-10-25',
    toDate: '2026-10-26'
  });
  assert.equal(dateRangeFiltered.length, 3);
});

test('calculateDaybookMetrics computes live dynamic totals accurately', () => {
  const sampleVouchers = [
    {
      id: 'v-1',
      type: 'SALES' as const,
      number: 'SA/26-27/001',
      date: '26-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Patidar Agro Exports',
      debitAmount: 0,
      creditAmount: 47250,
    },
    {
      id: 'v-2',
      type: 'PURCHASE' as const,
      number: 'PUR/26-27/001',
      date: '25-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Shree Ambica Oil Mills',
      debitAmount: 39375,
      creditAmount: 0,
    },
    {
      id: 'v-3',
      type: 'PAYMENT' as const,
      number: 'PMT/26-27/042',
      date: '24-Oct-2026',
      mode: 'single-entry' as const,
      partyName: 'UGVCL Power',
      debitAmount: 12450,
      creditAmount: 0,
    }
  ];

  const metrics = calculateDaybookMetrics(sampleVouchers);
  assert.equal(metrics.totalCount, 3);
  assert.equal(metrics.totalInflowCredits, 47250);
  assert.equal(metrics.totalOutflowDebits, 51825);
  assert.equal(metrics.netTurnover, 4575);
  assert.equal(metrics.typeDistribution.SALES, 1);
  assert.equal(metrics.typeDistribution.PURCHASE, 1);
  assert.equal(metrics.typeDistribution.PAYMENT, 1);
});

test('exportDaybookToCsv generates formatted RFC 4180 CSV with escaped quotes', () => {
  const sample = [
    {
      id: 'v-1',
      type: 'SALES' as const,
      number: 'SA/26-27/001',
      date: '26-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Patidar "Premium" Agro',
      debitAmount: 0,
      creditAmount: 47250,
      narration: 'Being goods sold, Mundra port'
    }
  ];

  const csv = exportDaybookToCsv(sample);
  assert.match(csv, /"Date","Voucher No","Voucher Type"/);
  assert.match(csv, /"Patidar ""Premium"" Agro"/);
  assert.match(csv, /"47250.00"/);
});

test('createKarmaAuditBundle produces complete CA audit JSON for Piyush Suthar', () => {
  const company = { name: 'Banas Agro Processors', gstin: '24AAACB1234A1Z5' };
  const vouchers = [
    {
      id: 'v-1',
      type: 'SALES' as const,
      number: 'SA/26-27/001',
      date: '26-Oct-2026',
      mode: 'item-invoice' as const,
      partyName: 'Patidar Agro Exports',
      debitAmount: 0,
      creditAmount: 47250,
    }
  ];
  const ledgers = [{ id: 'l-1', name: 'Patidar Agro', group: 'Sundry Debtors', balance: 47250, balanceType: 'Dr' }];
  const stock = [{ id: 's-1', name: 'Cumin Seeds', hsn: '0909', stock: 900, unit: 'KGS', salesRate: 280 }];

  const bundle = createKarmaAuditBundle(company, vouchers, ledgers, stock) as any;
  assert.equal(bundle.auditHeader.firm, 'Karma Accounts & Tax Consultants, Ahmedabad & Deesa');
  assert.equal(bundle.auditHeader.leadAuditor, 'Piyush Suthar, Chief Tax Consultant');
  assert.equal(bundle.transactions.length, 1);
  assert.equal(bundle.ledgerClosingBalances.length, 1);
  assert.equal(bundle.inventoryValuation.length, 1);
  assert.equal(bundle.inventoryValuation[0].totalValue, 252000);
});

test('calculateClosingStockValuation accurately computes valuation across multiple items', async () => {
  const { calculateClosingStockValuation } = await import('./tax-logic');
  const items = [
    { id: '1', name: 'Cumin Seeds', stock: 100, purchaseCost: 260 },
    { id: '2', name: 'Mustard Seeds', stock: 200, purchaseCost: 75 },
    { id: '3', name: 'Packing Boxes', stock: 50, purchaseCost: 35 }
  ];
  // 100*260 = 26000; 200*75 = 15000; 50*35 = 1750; Total = 42750
  assert.equal(calculateClosingStockValuation(items), 42750);
});

test('calculateTradingAccount and calculateProfitAndLoss compute Gross and Net Profit correctly', async () => {
  const { calculateTradingAccount, calculateProfitAndLoss } = await import('./tax-logic');
  const stockItems = [
    { id: '1', name: 'Cumin Seeds', stock: 100, purchaseCost: 200 } // Closing stock = 20000
  ];
  const ledgers = [
    { id: 'p1', name: 'Purchase A/c', group: 'Purchase Accounts', balance: 50000, balanceType: 'Dr' },
    { id: 'de1', name: 'Freight Inward', group: 'Direct Expenses', balance: 5000, balanceType: 'Dr' },
    { id: 's1', name: 'Sales A/c', group: 'Sales Accounts', balance: 90000, balanceType: 'Cr' },
    { id: 'ie1', name: 'Office Rent', group: 'Indirect Expenses', balance: 8000, balanceType: 'Dr' },
    { id: 'ie2', name: 'Audit Fees', group: 'Indirect Expenses', balance: 5000, balanceType: 'Dr' },
    { id: 'ii1', name: 'Discount Received', group: 'Indirect Incomes', balance: 1500, balanceType: 'Cr' }
  ];

  // Trading: Opening (10000) + Purchases (50000) + Direct Exp (5000) = 65000 Debits
  // Credits: Sales (90000) + Closing Stock (20000) = 110000 Credits
  // Gross Profit = 110000 - 65000 = 45000
  const trading = calculateTradingAccount(ledgers, stockItems, 10000);
  assert.equal(trading.grossProfit, 45000);
  assert.equal(trading.isGrossLoss, false);

  // P&L: GP (45000) + Incomes (1500) = 46500
  // Expenses: 8000 + 5000 = 13000
  // Net Profit = 46500 - 13000 = 33500
  const pnl = calculateProfitAndLoss(ledgers, stockItems, 10000);
  assert.equal(pnl.netProfit, 33500);
  assert.equal(pnl.isNetLoss, false);
});

test('calculateBalanceSheet aggregates liabilities & equity vs assets and checks equilibrium', async () => {
  const { calculateBalanceSheet } = await import('./tax-logic');
  const stock = [{ id: '1', stock: 100, purchaseCost: 100 }]; // Closing stock = 10000
  const ledgers = [
    // Capital & Liabilities
    { id: 'c1', name: 'Capital Account', group: 'Capital Account', balance: 100000, balanceType: 'Cr' },
    { id: 'l1', name: 'Bank Loan', group: 'Loans (Liability)', balance: 50000, balanceType: 'Cr' },
    { id: 'cr1', name: 'Sundry Creditors', group: 'Sundry Creditors', balance: 25000, balanceType: 'Cr' },
    // Assets
    { id: 'fa1', name: 'Plant & Machinery', group: 'Fixed Assets', balance: 80000, balanceType: 'Dr' },
    { id: 'd1', name: 'Sundry Debtors', group: 'Sundry Debtors', balance: 35000, balanceType: 'Dr' },
    { id: 'b1', name: 'Bank Account', group: 'Bank Accounts', balance: 50000, balanceType: 'Dr' }
    // Stock-in-Hand = 10000 (Current Asset)
    // Total Assets = 80000 + 35000 + 50000 + 10000 = 175000
    // Total Liabilities = 100000 + 50000 + 25000 + 0 (Net profit) = 175000
  ];

  const bs = calculateBalanceSheet(ledgers, stock, 10000);
  assert.equal(bs.liabilities.totalLiabilitiesAndCapital, 175000);
  assert.equal(bs.assets.totalAssets, 175000);
  assert.equal(bs.difference, 0);
  assert.equal(bs.isBalanced, true);
});

test('calculateTrialBalance computes exact debits and credits and validates Dr = Cr', async () => {
  const { calculateTrialBalance } = await import('./tax-logic');
  const ledgers = [
    { id: '1', name: 'Cash', group: 'Cash-in-Hand', balance: 15000, balanceType: 'Dr' },
    { id: '2', name: 'Bank', group: 'Bank Accounts', balance: 85000, balanceType: 'Dr' },
    { id: '3', name: 'Capital', group: 'Capital Account', balance: 100000, balanceType: 'Cr' }
  ];

  const tb = calculateTrialBalance(ledgers);
  assert.equal(tb.totalDebit, 100000);
  assert.equal(tb.totalCredit, 100000);
  assert.equal(tb.difference, 0);
  assert.equal(tb.isBalanced, true);
});

test('exportFinancialReportToCsv generates RFC 4180 CSV for Balance Sheet and P&L', async () => {
  const { exportFinancialReportToCsv } = await import('./tax-logic');
  const mockBsData = {
    liabilities: {
      capitalAccount: { amount: 100000 },
      reservesAndSurplus: { amount: 25000 },
      loansLiability: { amount: 50000 },
      currentLiabilities: {
        sundryCreditors: { amount: 20000 },
        dutiesAndTaxes: { amount: 5000 },
        otherCurrentLiabilities: { amount: 0 }
      },
      totalLiabilitiesAndCapital: 200000
    },
    assets: {
      fixedAssets: { amount: 80000 },
      investments: { amount: 20000 },
      currentAssets: {
        stockInHand: 40000,
        sundryDebtors: { amount: 30000 },
        cashInHand: { amount: 10000 },
        bankAccounts: { amount: 20000 },
        otherCurrentAssets: { amount: 0 }
      },
      totalAssets: 200000
    }
  };

  const csv = exportFinancialReportToCsv('BALANCE_SHEET', mockBsData);
  assert.match(csv, /"Liabilities & Capital","Amount \(INR\)","Assets","Amount \(INR\)"/);
  assert.match(csv, /"Capital Account","100000"/);
  assert.match(csv, /"Total Liabilities & Capital","200000"/);
});

test('computeGstr1Breakdown categorizes B2B, B2C Large, B2C Small and HSN data accurately', async () => {
  const { computeGstr1Breakdown } = await import('./tax-logic');
  const mockVouchers = [
    // B2B intra-state
    {
      type: 'SALES',
      number: 'INV-001',
      date: '15-Oct-2026',
      partyName: 'Gujarat Agro Syndicate',
      partyGstin: '24AAACG1234F1Z9',
      placeOfSupply: '24',
      taxableAmount: 100000,
      cgstAmount: 9000,
      sgstAmount: 9000,
      igstAmount: 0,
      grandTotal: 118000,
      items: [
        { hsn: '0909', name: 'Cumin Seeds', uqc: 'KGS', quantity: 400, taxableValue: 100000, cgst: 9000, sgst: 9000, igst: 0, cess: 0 }
      ]
    },
    // B2C Large inter-state (> 2.5L)
    {
      type: 'SALES',
      number: 'INV-002',
      date: '20-Oct-2026',
      partyName: 'Rajasthan Wholesaler',
      partyGstin: '',
      placeOfSupply: '08', // Rajasthan
      taxableAmount: 300000,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 15000,
      grandTotal: 315000,
      items: [
        { hsn: '1207', name: 'Mustard Seeds', uqc: 'KGS', quantity: 2000, taxableValue: 300000, cgst: 0, sgst: 0, igst: 15000, cess: 0 }
      ]
    },
    // B2C Small intra-state
    {
      type: 'SALES',
      number: 'INV-003',
      date: '22-Oct-2026',
      partyName: 'Local Retailer',
      partyGstin: '',
      placeOfSupply: '24',
      taxableAmount: 20000,
      cgstAmount: 500,
      sgstAmount: 500,
      igstAmount: 0,
      grandTotal: 21000,
      items: [
        { hsn: '1207', name: 'Mustard Seeds', uqc: 'KGS', quantity: 200, taxableValue: 20000, cgst: 500, sgst: 500, igst: 0, cess: 0 }
      ]
    }
  ];

  const summary = computeGstr1Breakdown(mockVouchers, '24AAAFK0142C1Z5');
  assert.equal(summary.b2b.length, 1);
  assert.equal(summary.b2b[0].ctin, '24AAACG1234F1Z9');
  assert.equal(summary.b2b[0].txval, 100000);

  assert.equal(summary.b2cl.length, 1);
  assert.equal(summary.b2cl[0].pos, '08');
  assert.equal(summary.b2cl[0].val, 315000);

  assert.equal(summary.b2cs.length, 1);
  assert.equal(summary.b2cs[0].txval, 20000);

  assert.equal(summary.totalTurnover, 454000);
  assert.equal(summary.totalTaxLiability, 34000);
  assert.equal(summary.hsn.length, 2);
});

test('computeGstr3bSummary computes Table 3.1, Table 4 ITC and Table 6.1 cash payment correctly', async () => {
  const { computeGstr3bSummary } = await import('./tax-logic');
  const mockVouchers = [
    // Sales
    {
      type: 'SALES',
      taxableAmount: 100000,
      cgstAmount: 9000,
      sgstAmount: 9000,
      igstAmount: 0,
      placeOfSupply: '24'
    },
    // Purchase (ITC)
    {
      type: 'PURCHASE',
      taxableAmount: 60000,
      cgstAmount: 5400,
      sgstAmount: 5400,
      igstAmount: 0,
      placeOfSupply: '24'
    }
  ];

  const gstr3b = computeGstr3bSummary(mockVouchers, '24AAAFK0142C1Z5');
  assert.equal(gstr3b.table3_1.a_outward_taxable.txval, 100000);
  assert.equal((gstr3b.table3_1.a_outward_taxable as any).cgst, undefined);
  assert.equal(gstr3b.table3_1.a_outward_taxable.camt, 9000);
  assert.equal(gstr3b.table3_1.a_outward_taxable.samt, 9000);

  assert.equal(gstr3b.table4_itc.net_itc.camt, 5400);
  assert.equal(gstr3b.table4_itc.net_itc.samt, 5400);

  // Table 6.1 Net Tax Payable in Cash
  assert.equal(gstr3b.table6_1_payment.paid_in_cash.camt, 3600); // 9000 - 5400
  assert.equal(gstr3b.table6_1_payment.paid_in_cash.samt, 3600);
});

test('generateGstr1JSONPayload generates valid GSTN offline upload json format', async () => {
  const { generateGstr1JSONPayload } = await import('./tax-logic');
  const mockCompany = {
    name: 'Banas Traders & Agro Products',
    gstin: '24AAAFK0142C1Z5'
  };
  const mockVouchers = [
    {
      type: 'SALES',
      number: 'INV-101',
      date: '24-10-2026',
      partyGstin: '24AAACG1234F1Z9',
      placeOfSupply: '24',
      taxableAmount: 50000,
      cgstAmount: 2500,
      sgstAmount: 2500,
      igstAmount: 0,
      grandTotal: 55000
    }
  ];

  const jsonStr = generateGstr1JSONPayload(mockVouchers, mockCompany, 10, 2026);
  const parsed = JSON.parse(jsonStr);

  assert.equal(parsed.gstin, '24AAAFK0142C1Z5');
  assert.equal(parsed.fp, '102026');
  assert.equal(parsed.version, 'GSTR1_V2.0');
  assert.ok(Array.isArray(parsed.b2b));
  assert.equal(parsed.b2b[0].ctin, '24AAACG1234F1Z9');
  assert.equal(parsed.b2b[0].inv[0].inum, 'INV-101');
});

test('formatBytes and calculateStorageQuota accurately measure byte allocations', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  assert.equal(formatBytes(5242880), '5 MB');

  const quota = calculateStorageQuota(2621440, 5242880);
  assert.equal(quota.percentage, 50);
  assert.equal(quota.isWarning, false);

  const warnQuota = calculateStorageQuota(4500000, 5242880);
  assert.equal(warnQuota.isWarning, true);
});

test('calculateTelemetryBreakdown computes byte weights and record counts', () => {
  const dummyState = {
    company: { name: 'Test Corp', gstin: '24AAACG1234F1Z9' },
    ledgers: [{ id: '1', name: 'Cash' }, { id: '2', name: 'Bank' }],
    stock_items: [{ id: '1', name: 'Wheat' }],
    vouchers: [{ id: 'v1', number: 'INV-1' }, { id: 'v2', number: 'INV-2' }, { id: 'v3', number: 'INV-3' }]
  };

  const telemetry = calculateTelemetryBreakdown(dummyState);
  assert.ok(telemetry.companyBytes > 0);
  assert.ok(telemetry.ledgersBytes > 0);
  assert.ok(telemetry.stockBytes > 0);
  assert.ok(telemetry.vouchersBytes > 0);
  assert.equal(telemetry.ledgersCount, 2);
  assert.equal(telemetry.stockCount, 1);
  assert.equal(telemetry.vouchersCount, 3);
  assert.ok(telemetry.totalBytes >= telemetry.vouchersBytes + telemetry.ledgersBytes);
});

test('validateBackupPayload validates structure and detects corrupted payloads', () => {
  assert.equal(validateBackupPayload(null).isValid, false);
  assert.equal(validateBackupPayload('string').isValid, false);
  assert.equal(validateBackupPayload({ company: {} }).isValid, false);

  const validPayload = {
    company: { legal_name: 'Banas Traders', gstin: '24AAAFK0142C1Z5' },
    ledgers: [{ name: 'Cash' }],
    stock_items: [{ name: 'Cumin' }],
    vouchers: []
  };

  const validation = validateBackupPayload(validPayload);
  assert.equal(validation.isValid, true);
  assert.equal(validation.metadata?.companyName, 'Banas Traders');
  assert.equal(validation.metadata?.gstin, '24AAAFK0142C1Z5');
  assert.equal(validation.metadata?.ledgersCount, 1);
  assert.equal(validation.metadata?.stockCount, 1);
});

test('generateGoogleDriveMultipartPayload builds valid RFC multipart boundary payload', () => {
  const meta = { name: 'backup.json', mimeType: 'application/json' };
  const content = JSON.stringify({ hello: 'world' });
  const result = generateGoogleDriveMultipartPayload(meta, content);

  assert.ok(result.boundary.length > 0);
  assert.ok(result.body.includes(result.boundary));
  assert.ok(result.body.includes('backup.json'));
  assert.ok(result.body.includes('{"hello":"world"}'));
});

test('encryptAnkeVault and decryptAnkeVault roundtrip and reject wrong passphrase', async () => {
  const secretData = JSON.stringify({ company: 'Banas Traders', secretKey: 'top_secret_audit_data_123' });
  const passphrase = 'UltraSecureCharteredPassphrase#2026';

  const encryptedJson = await encryptAnkeVault(secretData, passphrase);
  assert.ok(encryptedJson.includes('AES-256-GCM'));
  assert.ok(encryptedJson.includes('salt'));
  assert.ok(encryptedJson.includes('iv'));
  assert.ok(encryptedJson.includes('data'));

  // Successful decryption
  const decrypted = await decryptAnkeVault(encryptedJson, passphrase);
  assert.equal(decrypted, secretData);

  // Failed decryption with bad password
  await assert.rejects(async () => {
    await decryptAnkeVault(encryptedJson, 'wrong_passphrase_here');
  }, /Decryption failed/);
});

test('PRINT_TEMPLATE_FAMILIES contains all 5 core families and templates', () => {
  const families = Object.keys(PRINT_TEMPLATE_FAMILIES);
  assert.ok(families.includes('traditional'));
  assert.ok(families.includes('corporate'));
  assert.ok(families.includes('thermal'));
  assert.ok(families.includes('minimal'));
  assert.ok(families.includes('specialized'));

  assert.ok(PRINT_TEMPLATE_FAMILIES.traditional.templates.some(t => t.id === 'trad-chopda'));
  assert.ok(PRINT_TEMPLATE_FAMILIES.corporate.templates.some(t => t.id === 'corp-b2b'));
  assert.ok(PRINT_TEMPLATE_FAMILIES.thermal.templates.some(t => t.id === 'pos-80mm'));
  assert.ok(PRINT_TEMPLATE_FAMILIES.thermal.templates.some(t => t.id === 'pos-58mm'));
  assert.ok(PRINT_TEMPLATE_FAMILIES.minimal.templates.some(t => t.id === 'min-service'));
  assert.ok(PRINT_TEMPLATE_FAMILIES.specialized.templates.some(t => t.id === 'spec-transport'));
});

test('generateWhatsAppShareText formats professional English bill summary with mandatory attribution', () => {
  const mockCompany = { legal_name: 'Banas Traders & Agro Products', upi_id: '9104253142@upi' };
  const mockVoucher = {
    number: 'INV-2026-089',
    date: '24-Oct-2026',
    partyName: 'Saraswati Agro Commodities',
    grandTotal: 125400
  };

  const text = generateWhatsAppShareText(mockVoucher, mockCompany);
  assert.ok(text.includes('Banas Traders & Agro Products'));
  assert.ok(text.includes('INV-2026-089'));
  assert.ok(text.includes('Saraswati Agro Commodities'));
  assert.ok(text.includes('₹1,25,400.00'));
  assert.ok(text.includes('9104253142@upi'));
  assert.ok(text.includes('KARMA ACCOUNTS (+91 9104253142)'));

  const url = generateWhatsAppShareUrl(mockVoucher, mockCompany, '919104253142');
  assert.ok(url.startsWith('https://wa.me/919104253142?text='));
});

test('calculatePrintStudioModel derives accurate line items, tax breakdowns, and UPI payment URI', () => {
  const mockCompany = {
    legal_name: 'Banas Traders & Agro Products',
    gstin: '24AAAFK0142C1Z5',
    pan: 'AAAFK0142C',
    upi_id: '9104253142@upi'
  };
  const mockVoucher = {
    number: 'INV-101',
    date: '24-Oct-2026',
    partyName: 'Apex Retails Ltd',
    partyGstin: '24AAACX9876K1Z2',
    items: [
      {
        id: '1',
        name: 'Jeera (Cumin Seeds)',
        hsn: '0909',
        quantity: 10,
        unit: 'BAG',
        rate: 5000,
        taxableAmount: 50000,
        cgstAmount: 1250,
        sgstAmount: 1250,
        igstAmount: 0,
        totalAmount: 52500
      }
    ]
  };

  const model = calculatePrintStudioModel(mockVoucher, mockCompany, {
    accentColor: 'navy',
    paperSize: 'a4',
    showUpiQr: true
  });

  assert.equal(model.invoiceNo, 'INV-101');
  assert.equal(model.totals.taxableAmount, 50000);
  assert.equal(model.totals.totalCgst, 1250);
  assert.equal(model.totals.totalSgst, 1250);
  assert.equal(model.totals.grandTotal, 52500);
  assert.ok(model.upiPaymentUri.includes('upi://pay?pa=9104253142%40upi'));
  assert.ok(model.upiPaymentUri.includes('am=52500.00'));
  assert.equal(model.options.accentColor, 'navy');
  assert.ok(model.attribution.includes('KARMA ACCOUNTS (+91 9104253142)'));
});

// =========================================================================
// Prompt 26: Chart of Accounts (CoA) & Hierarchical Ledger Explorer Tests
// =========================================================================

test('STATUTORY_28_INDIAN_GROUPS contains all 28 statutory groups with 15 primary roots', () => {
  assert.equal(STATUTORY_28_INDIAN_GROUPS.length, 28);
  const primaryGroups = STATUTORY_28_INDIAN_GROUPS.filter(g => g.isPrimary);
  const subGroups = STATUTORY_28_INDIAN_GROUPS.filter(g => !g.isPrimary);

  assert.equal(primaryGroups.length, 15);
  assert.equal(subGroups.length, 13);

  // Check 4 fundamental categories
  const categories = new Set(STATUTORY_28_INDIAN_GROUPS.map(g => g.category));
  assert.ok(categories.has('ASSETS'));
  assert.ok(categories.has('LIABILITIES'));
  assert.ok(categories.has('INCOME'));
  assert.ok(categories.has('EXPENSES'));

  // Verify key statutory parent-child relationships
  const debtors = STATUTORY_28_INDIAN_GROUPS.find(g => g.name === 'Sundry Debtors');
  assert.ok(debtors);
  assert.equal(debtors.parentName, 'Current Assets');
  assert.equal(debtors.normalBalance, 'Dr');

  const creditors = STATUTORY_28_INDIAN_GROUPS.find(g => g.name === 'Sundry Creditors');
  assert.ok(creditors);
  assert.equal(creditors.parentName, 'Current Liabilities');
  assert.equal(creditors.normalBalance, 'Cr');

  const reserves = STATUTORY_28_INDIAN_GROUPS.find(g => g.name === 'Reserves & Surplus');
  assert.ok(reserves);
  assert.equal(reserves.parentName, 'Capital Account');
});

test('buildChartOfAccountsTree rolls up debit/credit balances and dynamic closing stock', () => {
  const mockLedgers = [
    { id: 'bank-1', name: 'HDFC Bank Current A/c', group: 'Bank Accounts', balance: 50000, balanceType: 'Dr' },
    { id: 'cash-1', name: 'Cash-in-Hand A/c', group: 'Cash-in-Hand', balance: 25000, balanceType: 'Dr' },
    { id: 'debtor-1', name: 'Apex Agro Corp', group: 'Sundry Debtors', balance: 120000, balanceType: 'Dr' },
    { id: 'creditor-1', name: 'Narmada Spares Ltd', group: 'Sundry Creditors', balance: 80000, balanceType: 'Cr' },
    { id: 'sales-1', name: 'General Sales Account', group: 'Sales Accounts', balance: 350000, balanceType: 'Cr' },
  ];

  const mockVouchers = [
    {
      number: 'SA/26-27/001',
      type: 'SALES',
      date: '2026-10-15',
      partyId: 'debtor-1',
      grandTotal: 50000,
    },
    {
      number: 'PMT/2026/001',
      type: 'PAYMENT',
      date: '2026-10-18',
      partyId: 'creditor-1',
      grandTotal: 30000,
    }
  ];

  const mockStock = [
    { id: 'item-1', name: 'Cumin Seeds', stock: 100, purchaseRate: 250 } // ₹25,000 valuation
  ];

  const result = buildChartOfAccountsTree(mockLedgers, mockVouchers, mockStock);

  assert.equal(result.totalGroups, 28);
  assert.ok(result.totalLedgers >= 5);
  assert.equal(result.tree.length, 15); // 15 primary roots

  // Check Current Assets rollup: Bank (50k) + Cash (25k) + Debtor (120k + 50k sales = 170k) + Closing Stock (25k) = 270k Dr
  const curAssetsRoot = result.tree.find(n => n.name === 'Current Assets');
  assert.ok(curAssetsRoot);
  assert.equal(curAssetsRoot.isPrimary, true);
  assert.ok(curAssetsRoot.children.length > 0);
  assert.equal(curAssetsRoot.balanceType, 'Dr');
  assert.ok(curAssetsRoot.debitTotal >= 270000);

  // Check Sundry Debtors child group under Current Assets
  const debtorsGroup = curAssetsRoot.children.find(c => c.name === 'Sundry Debtors');
  assert.ok(debtorsGroup);
  assert.equal(debtorsGroup.isGroup, true);
  assert.equal(debtorsGroup.children.length, 1);
  assert.equal(debtorsGroup.children[0].name, 'Apex Agro Corp');
  assert.equal(debtorsGroup.children[0].debitTotal, 170000); // 120000 + 50000
});

test('calculateLedgerMonthlySummary generates 12 financial year months (Apr-Mar) with running balance', () => {
  const ledgerId = 'test-client-1';
  const openingBalance = 100000;
  const balanceType = 'Dr';

  const mockVouchers = [
    {
      id: 'v1',
      date: '2026-05-10', // May (index 1)
      type: 'SALES',
      partyId: ledgerId,
      grandTotal: 40000,
    },
    {
      id: 'v2',
      date: '2026-08-20', // Aug (index 4)
      type: 'RECEIPT',
      lines: [
        { ledgerId: ledgerId, type: 'Cr', amount: 50000 }
      ]
    },
    {
      id: 'v3',
      date: '2026-10-12', // Oct (index 6)
      type: 'SALES',
      partyId: ledgerId,
      grandTotal: 25000,
    }
  ];

  const summary = calculateLedgerMonthlySummary(ledgerId, mockVouchers, openingBalance, balanceType);

  assert.equal(summary.monthlyRows.length, 12);
  assert.equal(summary.monthlyRows[0].monthName, 'April 2026');
  assert.equal(summary.monthlyRows[1].monthName, 'May 2026');
  assert.equal(summary.monthlyRows[11].monthName, 'March 2027');

  // Check May turnover: 40k debit
  assert.equal(summary.monthlyRows[1].debitTurnover, 40000);
  // May closing balance: 100k + 40k = 140k Dr
  assert.equal(summary.monthlyRows[1].closingBalance, 140000);

  // Check August turnover: 50k credit
  assert.equal(summary.monthlyRows[4].creditTurnover, 50000);
  // Aug closing balance: 140k - 50k = 90k Dr
  assert.equal(summary.monthlyRows[4].closingBalance, 90000);

  // Check October turnover: 25k debit
  assert.equal(summary.monthlyRows[6].debitTurnover, 25000);
  // Oct closing balance: 90k + 25k = 115k Dr
  assert.equal(summary.monthlyRows[6].closingBalance, 115000);

  assert.equal(summary.totalDebitTurnover, 65000); // 40k + 25k
  assert.equal(summary.totalCreditTurnover, 50000);
  assert.equal(summary.closingBalance, 115000);
  assert.equal(summary.closingBalanceType, 'Dr');
  assert.equal(summary.vouchers.length, 3);
});

test('exportChartOfAccountsToCsv formats tree hierarchy into RFC 4180 CSV report', () => {
  const mockNodes = [
    {
      id: 'grp-cur-asset',
      name: 'Current Assets',
      isGroup: true,
      isPrimary: true,
      category: 'ASSETS' as const,
      depth: 0,
      parentId: null,
      debitTotal: 250000,
      creditTotal: 0,
      netBalance: 250000,
      balanceType: 'Dr' as const,
      ledgerCount: 2,
      children: []
    },
    {
      id: 'ledger-bank-1',
      name: 'HDFC Bank Ltd',
      isGroup: false,
      isPrimary: false,
      category: 'ASSETS' as const,
      depth: 1,
      parentId: 'Current Assets',
      debitTotal: 150000,
      creditTotal: 0,
      netBalance: 150000,
      balanceType: 'Dr' as const,
      ledgerCount: 1,
      children: []
    }
  ];

  const csv = exportChartOfAccountsToCsv(mockNodes);

  assert.ok(csv.includes('"Account / Group Structure"'));
  assert.ok(csv.includes('"Debit Total (INR)"'));
  assert.ok(csv.includes('[Primary Group] Current Assets'));
  assert.ok(csv.includes('• HDFC Bank Ltd'));
  assert.ok(csv.includes('250000.00'));
  assert.ok(csv.includes('150000.00'));
});

// =========================================================================
// Prompt 27: Stock Summary, Godown Locations & Inventory Valuation Tests
// =========================================================================

test('calculateItemValuation calculates Weighted Average Cost accurately with purchases & sales', () => {
  const item = {
    id: 'stock-jeera',
    name: 'Cumin Seeds - Grade A Premium',
    sku: 'JRA-GRADE-A',
    category: 'Agricultural Commodities',
    hsn: '0909',
    unit: 'KGS - KILOGRAMS',
    godown: 'Main Central Godown',
    minReorderLevel: 500,
    openingQty: 1000,
    openingRate: 250, // Opening value = 2,50,000
  };

  const vouchers = [
    {
      type: 'PURCHASE',
      date: '2026-05-10',
      items: [
        { itemId: 'stock-jeera', quantity: 500, rate: 280, taxableAmount: 140000 }
      ]
    },
    {
      type: 'SALES',
      date: '2026-07-15',
      items: [
        { itemId: 'stock-jeera', quantity: 600, rate: 320, taxableAmount: 192000 }
      ]
    }
  ];

  // Total available qty = 1000 + 500 = 1500
  // Total available cost = 2,50,000 + 1,40,000 = 3,90,000
  // Weighted Avg Cost = 3,90,000 / 1500 = 260
  // Closing Qty = 1500 - 600 = 900
  // Closing Valuation = 900 * 260 = 2,34,000
  const row = calculateItemValuation(item, vouchers, 'WEIGHTED_AVG');

  assert.equal(row.openingQty, 1000);
  assert.equal(row.openingRate, 250);
  assert.equal(row.openingValue, 250000);
  assert.equal(row.inwardQty, 500);
  assert.equal(row.inwardValue, 140000);
  assert.equal(row.outwardQty, 600);
  assert.equal(row.closingQty, 900);
  assert.equal(row.effectiveRate, 260);
  assert.equal(row.closingValue, 234000);
  assert.equal(row.status, 'Optimal Stock');
});

test('calculateItemValuation evaluates FIFO and Last Purchase rates correctly', () => {
  const item = {
    id: 'stock-mustard',
    name: 'Mustard Seeds',
    sku: 'MST-001',
    category: 'Agricultural Commodities',
    hsn: '1207',
    unit: 'KGS',
    godown: 'Main Central Godown',
    minReorderLevel: 200,
    openingQty: 300,
    openingRate: 70, // 21,000
  };

  const vouchers = [
    {
      type: 'PURCHASE',
      date: '2026-06-12',
      items: [{ itemId: 'stock-mustard', quantity: 200, rate: 80, taxableAmount: 16000 }]
    },
    {
      type: 'PURCHASE',
      date: '2026-08-14',
      items: [{ itemId: 'stock-mustard', quantity: 100, rate: 90, taxableAmount: 9000 }]
    },
    {
      type: 'SALES',
      date: '2026-09-20',
      items: [{ itemId: 'stock-mustard', quantity: 350, rate: 100, taxableAmount: 35000 }]
    }
  ];

  // Total Inward = 300 @ 70, 200 @ 80, 100 @ 90 (Total 600)
  // Sales = 350
  // Under FIFO: 300 @ 70 depleted (300 sold), 50 @ 80 depleted (50 sold)
  // Remaining batches: 150 @ 80 (= 12,000) + 100 @ 90 (= 9,000) = 250 qty, value 21,000
  // Effective FIFO Rate = 21,000 / 250 = 84.00
  const fifoRow = calculateItemValuation(item, vouchers, 'FIFO');
  assert.equal(fifoRow.closingQty, 250);
  assert.equal(fifoRow.closingValue, 21000);
  assert.equal(fifoRow.effectiveRate, 84);

  // Under Last Purchase: Closing Qty = 250, Last Purchase rate = 90
  // Closing Value = 250 * 90 = 22,500
  const lastPurchaseRow = calculateItemValuation(item, vouchers, 'LAST_PURCHASE');
  assert.equal(lastPurchaseRow.closingQty, 250);
  assert.equal(lastPurchaseRow.effectiveRate, 90);
  assert.equal(lastPurchaseRow.closingValue, 22500);
});

test('calculateItemValuation identifies re-order level and critical stock status', () => {
  const itemLow = {
    id: 'item-low',
    name: 'Packaging Bags 50kg',
    sku: 'PKG-50',
    minReorderLevel: 500,
    openingQty: 400,
    openingRate: 25,
  };
  const resLow = calculateItemValuation(itemLow, [], 'WEIGHTED_AVG');
  assert.equal(resLow.status, 'Re-order Level Reached');

  const itemZero = {
    id: 'item-zero',
    name: 'Hardware Bolts',
    sku: 'HDW-01',
    minReorderLevel: 50,
    openingQty: 0,
    openingRate: 10,
  };
  const resZero = calculateItemValuation(itemZero, [], 'WEIGHTED_AVG');
  assert.equal(resZero.status, 'Critical / Out of Stock');
});

test('calculateStockSummary aggregates overall inventory metrics, godown filter, and search', () => {
  const stockItems = [
    {
      id: 'itm-1',
      name: 'Cumin Seeds',
      sku: 'CMS-01',
      category: 'Spices',
      hsn: '0909',
      unit: 'KGS',
      godown: 'Main Central Godown',
      minReorderLevel: 100,
      openingQty: 500,
      openingRate: 250, // 1,25,000
    },
    {
      id: 'itm-2',
      name: 'Mustard Seeds',
      sku: 'MST-01',
      category: 'Oilseeds',
      hsn: '1207',
      unit: 'KGS',
      godown: 'APMC Mandi Yard Shop',
      minReorderLevel: 300,
      openingQty: 200,
      openingRate: 80, // 16,000 (Low stock)
    }
  ];

  const vouchers = [
    {
      type: 'SALES',
      date: '2026-08-01',
      items: [{ itemId: 'itm-1', quantity: 100, rate: 300, taxableAmount: 30000 }]
    }
  ];

  // All Items
  const summaryAll = calculateStockSummary(stockItems, vouchers, { method: 'WEIGHTED_AVG' });
  assert.equal(summaryAll.totalSKUs, 2);
  assert.equal(summaryAll.lowStockCount, 1); // Mustard has 200 <= 300
  assert.equal(summaryAll.totalOutwardSalesVolume, 100);
  assert.ok(summaryAll.totalValuation > 100000);
  assert.ok(summaryAll.groupedByCategory['Spices']);
  assert.ok(summaryAll.groupedByCategory['Oilseeds']);

  // Filter by Godown: APMC Mandi Yard Shop
  const summaryMandi = calculateStockSummary(stockItems, vouchers, { godownFilter: 'Mandi' });
  assert.equal(summaryMandi.totalSKUs, 1);
  assert.equal(summaryMandi.items[0].name, 'Mustard Seeds');

  // Search keyword filter
  const summarySearch = calculateStockSummary(stockItems, vouchers, { searchKeyword: '0909' });
  assert.equal(summarySearch.totalSKUs, 1);
  assert.equal(summarySearch.items[0].sku, 'CMS-01');
});

test('calculateItemMonthlyMovement generates 12 financial year months and transaction log', () => {
  const item = {
    id: 'itm-cumin',
    name: 'Cumin Seeds Premium',
    openingQty: 1000,
    openingRate: 200, // 2,00,000
  };

  const vouchers = [
    {
      type: 'PURCHASE',
      date: '2026-04-15', // April (index 0)
      number: 'PUR-001',
      partyName: 'Unjha Agro Traders',
      items: [{ itemId: 'itm-cumin', quantity: 200, rate: 220, taxableAmount: 44000 }]
    },
    {
      type: 'SALES',
      date: '2026-06-20', // June (index 2)
      number: 'INV-101',
      partyName: 'Gujarat Agro Syndicate',
      items: [{ itemId: 'itm-cumin', quantity: 300, rate: 260, taxableAmount: 78000 }]
    }
  ];

  const movement = calculateItemMonthlyMovement(item, vouchers, 'WEIGHTED_AVG');

  assert.equal(movement.monthlyMovements.length, 12);
  assert.equal(movement.monthlyMovements[0].monthName, 'April 2026');
  assert.equal(movement.monthlyMovements[0].inwardQty, 200);
  assert.equal(movement.monthlyMovements[2].monthName, 'June 2026');
  assert.equal(movement.monthlyMovements[2].outwardQty, 300);

  assert.equal(movement.totalInwardQty, 200);
  assert.equal(movement.totalOutwardQty, 300);
  assert.equal(movement.finalClosingQty, 900); // 1000 + 200 - 300
  assert.equal(movement.transactionLog.length, 2);
  assert.equal(movement.transactionLog[0].type, 'PURCHASE');
  assert.equal(movement.transactionLog[1].type, 'SALES');
});

test('exportStockSummaryToCsv generates standard RFC 4180 CSV with health status', () => {
  const mockItems: any[] = [
    {
      name: 'Cumin Seeds - Grade A Premium',
      sku: 'JRA-GRADE-A',
      category: 'Agricultural Commodities',
      hsn: '0909',
      godown: 'Main Central Godown',
      unit: 'KGS',
      openingQty: 2500,
      openingRate: 260,
      openingValue: 650000,
      inwardQty: 500,
      inwardValue: 130000,
      outwardQty: 300,
      outwardValue: 84000,
      closingQty: 2700,
      effectiveRate: 260,
      closingValue: 702000,
      status: 'Optimal Stock'
    }
  ];

  const csv = exportStockSummaryToCsv(mockItems);
  assert.ok(csv.includes('"Stock Item Name"'));
  assert.ok(csv.includes('"Closing Valuation (INR)"'));
  assert.ok(csv.includes('Cumin Seeds - Grade A Premium'));
  assert.ok(csv.includes('JRA-GRADE-A'));
  assert.ok(csv.includes('702000.00'));
  assert.ok(csv.includes('Optimal Stock'));
});

// ============================================================================
// PROMPT 28 UNIT TESTS: OUTSTANDING BILLS & MSME SECTION 43B(h) AGEING
// ============================================================================

test('calculateBillsAgeing computes Bills Receivable (Debtors) with settlements and standard ageing slabs', async () => {
  const { calculateBillsAgeing } = await import('./tax-logic');

  const ledgers = [
    { id: 'deb-1', name: 'Patidar Agro Exports', gstin: '24AAACP1234D1Z1', creditDays: 30, phone: '9825012345' },
    { id: 'deb-2', name: 'Sardar Spices Corp', gstin: '24AAACS9988E1Z9', creditDays: 15, phone: '9825099887' }
  ];

  const vouchers = [
    {
      id: 'v-sales-1',
      type: 'SALES',
      number: 'SA/26-27/001',
      date: '2026-09-01',
      partyId: 'deb-1',
      grandTotal: 100000
    },
    {
      id: 'v-rec-1',
      type: 'RECEIPT',
      number: 'REC-001',
      date: '2026-09-15',
      partyId: 'deb-1',
      referenceNo: 'SA/26-27/001',
      grandTotal: 40000
    },
    {
      id: 'v-sales-2',
      type: 'SALES',
      number: 'SA/26-27/002',
      date: '2026-10-10',
      partyId: 'deb-2',
      grandTotal: 50000
    }
  ];

  // As on 2026-10-24
  const res = calculateBillsAgeing('RECEIVABLE', vouchers, ledgers, {
    asOnDate: '2026-10-24',
    slabType: 'STANDARD'
  });

  assert.equal(res.items.length, 2);
  const bill1 = res.items.find(i => i.billNo === 'SA/26-27/001')!;
  assert.equal(bill1.originalAmount, 100000);
  assert.equal(bill1.settledAmount, 40000);
  assert.equal(bill1.pendingBalance, 60000);
  assert.equal(bill1.status, 'Partially Settled');
  // Age: 2026-09-01 to 2026-10-24 = 53 days (falls in 31-60 bucket)
  assert.equal(bill1.bucket2, 60000);
  // Due: 2026-09-01 + 30 days = 2026-10-01. Overdue = 23 days
  assert.equal(bill1.overdueDays, 23);
  assert.equal(bill1.riskTag, 'Overdue Alert');

  const bill2 = res.items.find(i => i.billNo === 'SA/26-27/002')!;
  assert.equal(bill2.pendingBalance, 50000);
  // Age: 14 days (falls in 0-30 bucket)
  assert.equal(bill2.bucket1, 50000);

  // Total Outstanding: 60,000 + 50,000 = 110,000
  assert.equal(res.metrics.totalOutstanding, 110000);
});

test('calculateBillsAgeing for Payables identifies MSME vendors and flags Section 43B(h) non-compliance risk', async () => {
  const { calculateBillsAgeing } = await import('./tax-logic');

  const ledgers = [
    {
      id: 'cred-msme-1',
      name: 'Shree Ambica Oil Mills (Micro Enterprise)',
      isMsme: true,
      msmeType: 'Micro',
      udyamRegNo: 'UDYAM-GJ-01-0029141',
      hasWrittenAgreement: true,
      phone: '9825044332'
    },
    {
      id: 'cred-reg-2',
      name: 'National Corrugation Supplies Ltd',
      isMsme: false,
      creditDays: 30
    }
  ];

  const vouchers = [
    // Unpaid bill from MSME dated 2026-08-15 (more than 45 days ago as on 2026-10-24)
    {
      id: 'v-pur-1',
      type: 'PURCHASE',
      number: 'PUR/26-27/011',
      date: '2026-08-15',
      partyId: 'cred-msme-1',
      grandTotal: 150000
    },
    // Fresh corporate purchase
    {
      id: 'v-pur-2',
      type: 'PURCHASE',
      number: 'PUR/26-27/088',
      date: '2026-10-15',
      partyId: 'cred-reg-2',
      grandTotal: 30000
    }
  ];

  const res = calculateBillsAgeing('PAYABLE', vouchers, ledgers, {
    asOnDate: '2026-10-24',
    slabType: 'STANDARD'
  });

  const msmeBill = res.items.find(i => i.billNo === 'PUR/26-27/011')!;
  assert.equal(msmeBill.isMsme, true);
  assert.equal(msmeBill.creditDays, 45); // Max written agreement statutory cap
  assert.ok(msmeBill.billAgeDays > 45);
  assert.equal(msmeBill.riskTag, 'Sec 43B(h) Non-Compliance Risk');
  assert.equal(res.metrics.msme43bExposure, 150000);
});

test('calculateBillsAgeing bins into MSME Strict Slabs correctly', async () => {
  const { calculateBillsAgeing } = await import('./tax-logic');

  const ledgers = [{ id: 'p-1', name: 'Test Party' }];
  const vouchers = [
    { id: 'v1', type: 'PURCHASE', number: 'P-10', date: '2026-10-20', partyId: 'p-1', grandTotal: 10000 }, // 4 days -> 0-15
    { id: 'v2', type: 'PURCHASE', number: 'P-20', date: '2026-10-04', partyId: 'p-1', grandTotal: 20000 }, // 20 days -> 16-30
    { id: 'v3', type: 'PURCHASE', number: 'P-30', date: '2026-09-15', partyId: 'p-1', grandTotal: 30000 }, // 39 days -> 31-45
    { id: 'v4', type: 'PURCHASE', number: 'P-40', date: '2026-08-01', partyId: 'p-1', grandTotal: 40000 }  // 84 days -> >45
  ];

  const res = calculateBillsAgeing('PAYABLE', vouchers, ledgers, {
    asOnDate: '2026-10-24',
    slabType: 'MSME_STRICT'
  });

  const b1 = res.items.find(i => i.billNo === 'P-10')!;
  const b2 = res.items.find(i => i.billNo === 'P-20')!;
  const b3 = res.items.find(i => i.billNo === 'P-30')!;
  const b4 = res.items.find(i => i.billNo === 'P-40')!;

  assert.equal(b1.bucket1, 10000);
  assert.equal(b2.bucket2, 20000);
  assert.equal(b3.bucket3, 30000);
  assert.equal(b4.bucket4, 40000);
  assert.equal(res.metrics.bucket1Total, 10000);
  assert.equal(res.metrics.bucket2Total, 20000);
  assert.equal(res.metrics.bucket3Total, 30000);
  assert.equal(res.metrics.bucket4Total, 40000);
});

test('generateWhatsAppReminderMessage formats polite collection notice with UPI and advisory hotline', async () => {
  const { generateWhatsAppReminderMessage } = await import('./tax-logic');

  const mockItem = {
    billId: 'b-1',
    billNo: 'SA/26-27/099',
    billDate: '15-Sep-2026',
    partyId: 'p-1',
    partyName: 'Gujarat Agro Corp',
    partyPhone: '9825012345',
    creditDays: 30,
    dueDate: '15-Oct-2026',
    billAgeDays: 39,
    overdueDays: 9,
    originalAmount: 85000,
    settledAmount: 0,
    pendingBalance: 85000,
    bucket1: 0,
    bucket2: 85000,
    bucket3: 0,
    bucket4: 0,
    riskTag: 'Overdue Alert' as const,
    status: 'Unsettled' as const,
    allocations: []
  };

  const uri = generateWhatsAppReminderMessage(mockItem, 'Banas Traders & Agro Products', 'anke-billing@okaxis');
  assert.ok(uri.startsWith('https://wa.me/?phone=919825012345&text='));
  assert.ok(decodeURIComponent(uri).includes('Gujarat Agro Corp'));
  assert.ok(decodeURIComponent(uri).includes('SA/26-27/099'));
  assert.ok(decodeURIComponent(uri).includes('₹85,000.00'));
  assert.ok(decodeURIComponent(uri).includes('anke-billing@okaxis'));
  assert.ok(decodeURIComponent(uri).includes('+91 9104253142'));
});

test('exportAgeingToCsv exports valid RFC 4180 CSV with MSME and 43B(h) flags', async () => {
  const { exportAgeingToCsv } = await import('./tax-logic');

  const items = [
    {
      billId: 'b-1',
      billNo: 'PUR-01',
      billDate: '01-Aug-2026',
      partyId: 'p-1',
      partyName: 'Shree Ambica Oil Mills',
      partyGstin: '24ABCCS5678B1Z2',
      isMsme: true,
      msmeType: 'Micro',
      udyamRegNo: 'UDYAM-GJ-01-0029141',
      creditDays: 45,
      dueDate: '15-Sep-2026',
      billAgeDays: 84,
      overdueDays: 39,
      originalAmount: 120000,
      settledAmount: 0,
      pendingBalance: 120000,
      bucket1: 0,
      bucket2: 0,
      bucket3: 0,
      bucket4: 120000,
      riskTag: 'Sec 43B(h) Non-Compliance Risk' as const,
      status: 'Unsettled' as const,
      allocations: []
    }
  ];

  const csv = exportAgeingToCsv(items, 'PAYABLE');
  assert.ok(csv.includes('"Invoice / Ref No."'));
  assert.ok(csv.includes('"MSME Classification"'));
  assert.ok(csv.includes('"Statutory Risk Status"'));
  assert.ok(csv.includes('Shree Ambica Oil Mills'));
  assert.ok(csv.includes('UDYAM-GJ-01-0029141'));
  assert.ok(csv.includes('Sec 43B(h) Non-Compliance Risk'));
});

test('calculateExportTotals and calculateExportLineItem under LUT (Zero-Rated Without Payment)', async () => {
  const { calculateExportTotals, getStatutoryExportEndorsement } = await import('./tax-logic');

  // Commodity Export: 20 MT Cumin Seeds @ $1,200.00 / MT with exchange rate 86.50 INR/USD under LUT
  const rawLines = [
    {
      name: 'Organic Cumin Seeds - Export Grade',
      hsn: '0909',
      qty: 20,
      unit: 'MT',
      foreignRate: 1200,
      igstRate: 5
    }
  ];

  const result = calculateExportTotals(rawLines, 86.50, 'LUT', 'USD');

  // Foreign Taxable: 20 * 1200 = $24,000.00
  assert.equal(result.totalForeignTaxable, 24000.00);
  // INR Taxable: 24,000 * 86.50 = ₹20,76,000.00
  assert.equal(result.totalInrTaxable, 2076000.00);
  // Under LUT, IGST is 0
  assert.equal(result.totalIgstInr, 0.00);
  // INR Grand Total is ₹20,76,000.00
  assert.equal(result.totalInrGrand, 2076000.00);
  assert.equal(result.totalForeignGrand, 24000.00);

  // Endorsement text check
  const endorsement = getStatutoryExportEndorsement('LUT');
  assert.equal(
    endorsement,
    'SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX'
  );
  assert.ok(result.advisoryAttribution.includes('KARMA ACCOUNTS (+91 9104253142)'));
});

test('calculateExportTotals with Payment of Integrated Tax (IGST Refund Route)', async () => {
  const { calculateExportTotals, getStatutoryExportEndorsement } = await import('./tax-logic');

  // IT Export / Commodity with 18% IGST on EUR 10,000.00 @ 94.20 INR/EUR
  const rawLines = [
    {
      name: 'Enterprise Cloud ERP Architectural Advisory',
      hsn: '998311',
      qty: 1,
      unit: 'NOS',
      foreignRate: 10000,
      igstRate: 18
    }
  ];

  const result = calculateExportTotals(rawLines, 94.20, 'WITH_TAX', 'EUR');

  // Foreign Taxable: EUR 10,000.00
  assert.equal(result.totalForeignTaxable, 10000.00);
  // INR Taxable: 10,000 * 94.20 = ₹9,42,000.00
  assert.equal(result.totalInrTaxable, 942000.00);
  // 18% IGST on ₹9,42,000 = ₹1,69,560.00
  assert.equal(result.totalIgstInr, 169560.00);
  // INR Grand Total: ₹11,11,560.00
  assert.equal(result.totalInrGrand, 1111560.00);

  const endorsement = getStatutoryExportEndorsement('WITH_TAX');
  assert.equal(endorsement, 'SUPPLY MEANT FOR EXPORT ON PAYMENT OF INTEGRATED TAX');
});

test('mapExportVoucherToGstr1Table6A generates statutory GSTN Table 6A payload', async () => {
  const { mapExportVoucherToGstr1Table6A } = await import('./tax-logic');

  const exportVoucher = {
    number: 'EXP/26-27/001',
    date: '2026-10-30',
    exportType: 'LUT',
    grandTotal: 2076000.00,
    taxableAmount: 2076000.00,
    igstAmount: 0,
    customsDetails: {
      lutNumber: 'AD240326001420Z',
      portCode: 'INMUN1',
      shippingBillNo: 'SB89213',
      shippingBillDate: '2026-10-29',
      countryOfDestination: 'United States',
      incoterm: 'FOB'
    }
  };

  const table6A = mapExportVoucherToGstr1Table6A(exportVoucher);
  assert.equal(table6A.exp_typ, 'WOPAY');
  assert.equal(table6A.inv.length, 1);
  assert.equal(table6A.inv[0].inum, 'EXP/26-27/001');
  assert.equal(table6A.inv[0].val, 2076000.00);
  assert.equal(table6A.inv[0].sbnum, 'SB89213');
  assert.equal(table6A.inv[0].port_code, 'INMUN1');
  assert.equal(table6A.inv[0].itms[0].itm_det.txval, 2076000.00);
  assert.equal(table6A.inv[0].itms[0].itm_det.iamnt, 0);
});

test('exportExportInvoiceToCsv exports complete customs and dual-currency data in RFC 4180 format', async () => {
  const { exportExportInvoiceToCsv } = await import('./tax-logic');

  const model = {
    invoiceNo: 'EXP/26-27/008',
    date: '2026-10-30',
    buyerName: 'Al-Barakah Global Trading LLC (Dubai)',
    country: 'United Arab Emirates',
    currency: 'USD',
    exchangeRate: 86.50,
    exportRegime: 'LUT' as const,
    customs: {
      lutNumber: 'AD240326001420Z',
      portCode: 'INMUN1',
      shippingBillNo: 'SB77651',
      shippingBillDate: '2026-10-29',
      countryOfDestination: 'United Arab Emirates',
      foreignBankSwift: 'SBININBBXXX',
      incoterm: 'CIF'
    },
    lines: [
      {
        id: '1',
        name: 'Natural Sesame Seeds - 99.95% Purity',
        hsn: '1207',
        qty: 15,
        unit: 'MT',
        foreignRate: 1800,
        foreignTaxableValue: 27000,
        inrTaxableValue: 2335500,
        igstRate: 0,
        igstAmountInr: 0,
        inrTotal: 2335500,
        foreignTotal: 27000
      }
    ],
    totals: {
      foreignTaxable: 27000,
      inrTaxable: 2335500,
      igstInr: 0,
      inrGrand: 2335500
    }
  };

  const csv = exportExportInvoiceToCsv(model);
  assert.ok(csv.includes('"Invoice No","EXP/26-27/008"'));
  assert.ok(csv.includes('"Al-Barakah Global Trading LLC (Dubai)"'));
  assert.ok(csv.includes('"INMUN1"'));
  assert.ok(csv.includes('"SB77651"'));
  assert.ok(csv.includes('"1 USD = INR 86.50"'));
  assert.ok(csv.includes('SUPPLY MEANT FOR EXPORT UNDER BOND OR LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX'));
  assert.ok(csv.includes('KARMA ACCOUNTS (+91 9104253142)'));
});

test('computeAuditRecordHash and verifyAuditChain detects valid sequential hash link and flags tampering', async () => {
  const { computeAuditRecordHash, verifyAuditChain, MCA_AUDIT_GENESIS_HASH } = await import('./tax-logic');

  const rec1Hash = computeAuditRecordHash(MCA_AUDIT_GENESIS_HASH, '2026-10-30T10:00:00.000Z', 'VCH-1', 'CREATED', 'Initial creation of sales invoice SA/26-27/001');
  const rec1 = {
    id: 'AUDIT-1',
    timestamp: '2026-10-30 10:00:00',
    isoTimestamp: '2026-10-30T10:00:00.000Z',
    entityType: 'VOUCHER' as const,
    entityId: 'VCH-1',
    entityRef: 'SA/26-27/001',
    action: 'CREATED' as const,
    user: 'Admin (Local Vault)',
    ip: '127.0.0.1 (Local Applet)',
    summary: 'Initial creation of sales invoice SA/26-27/001',
    previousHash: MCA_AUDIT_GENESIS_HASH,
    recordHash: rec1Hash
  };

  const rec2Hash = computeAuditRecordHash(rec1Hash, '2026-10-30T10:15:00.000Z', 'VCH-1', 'MODIFIED', 'Grand Total changed from ₹30000.00 to ₹35400.00 (+₹5400.00)');
  const rec2 = {
    id: 'AUDIT-2',
    timestamp: '2026-10-30 10:15:00',
    isoTimestamp: '2026-10-30T10:15:00.000Z',
    entityType: 'VOUCHER' as const,
    entityId: 'VCH-1',
    entityRef: 'SA/26-27/001',
    action: 'MODIFIED' as const,
    user: 'Admin (Local Vault)',
    ip: '127.0.0.1 (Local Applet)',
    summary: 'Grand Total changed from ₹30000.00 to ₹35400.00 (+₹5400.00)',
    previousHash: rec1Hash,
    recordHash: rec2Hash
  };

  // Test 1: Valid sequential chain
  const validCheck = verifyAuditChain([rec1, rec2]);
  assert.equal(validCheck.isValid, true);
  assert.equal(validCheck.checkedCount, 2);

  // Test 2: Tampered record detection (altering rec1 hash or content)
  const tamperedRec2 = { ...rec2, summary: 'Illegally altered summary without re-hashing' };
  const invalidCheck = verifyAuditChain([rec1, tamperedRec2]);
  assert.equal(invalidCheck.isValid, false);
  assert.equal(invalidCheck.tamperedIndex, 1);
});

test('computeEntityDiff calculates field changes, net impact, and summary for voucher alterations', async () => {
  const { computeEntityDiff } = await import('./tax-logic');

  const oldVoucher = {
    number: 'SA/26-27/001',
    date: '26-Oct-2026',
    partyName: 'Patidar Agro Exports',
    taxableAmount: 30000,
    cgstAmount: 750,
    sgstAmount: 750,
    grandTotal: 31500
  };

  const newVoucher = {
    number: 'SA/26-27/001',
    date: '26-Oct-2026',
    partyName: 'Patidar Agro Exports',
    taxableAmount: 40000,
    cgstAmount: 1000,
    sgstAmount: 1000,
    grandTotal: 42000
  };

  const diff = computeEntityDiff('VOUCHER', oldVoucher, newVoucher);
  assert.equal(diff.netImpactAmount, 10500);
  assert.ok(diff.summary.includes('Grand Total changed from ₹31500.00 to ₹42000.00 (+₹10500.00)'));
  assert.ok(diff.fieldChanges.some(f => f.field === 'taxableAmount' && f.oldValue === '30000.00' && f.newValue === '40000.00'));
});

test('createAuditTrailRecord and filterAuditRecords filter records accurately', async () => {
  const { createAuditTrailRecord, filterAuditRecords } = await import('./tax-logic');

  const record1 = createAuditTrailRecord({
    entityType: 'VOUCHER',
    entityId: 'VCH-101',
    entityRef: 'EXP/26-27/001',
    action: 'CREATED',
    user: 'Piyush Suthar',
    fixedIsoTimestamp: '2026-10-30T10:00:00.000Z'
  });

  const record2 = createAuditTrailRecord({
    entityType: 'LEDGER',
    entityId: 'LED-202',
    entityRef: 'Shree Ambica Oil Mills',
    action: 'MODIFIED',
    prevState: { name: 'Shree Ambica Oil Mills', standardRate: 85 },
    newState: { name: 'Shree Ambica Oil Mills', standardRate: 90 },
    user: 'Admin',
    fixedIsoTimestamp: '2026-10-30T11:00:00.000Z'
  });

  const allRecords = [record1, record2];

  // Filter by Entity Type VOUCHER
  const vouchersOnly = filterAuditRecords(allRecords, { entityType: 'VOUCHER' });
  assert.equal(vouchersOnly.length, 1);
  assert.equal(vouchersOnly[0].entityRef, 'EXP/26-27/001');

  // Filter by Action MODIFIED
  const modifiedOnly = filterAuditRecords(allRecords, { action: 'MODIFIED' });
  assert.equal(modifiedOnly.length, 1);
  assert.equal(modifiedOnly[0].entityRef, 'Shree Ambica Oil Mills');

  // Search by text "Ambica"
  const searchResults = filterAuditRecords(allRecords, { search: 'Ambica' });
  assert.equal(searchResults.length, 1);
  assert.equal(searchResults[0].entityId, 'LED-202');
});

test('exportAuditTrailToCsv and generateMcaCertificateHtml output statutory MCA compliance formats', async () => {
  const { createAuditTrailRecord, exportAuditTrailToCsv, generateMcaCertificateHtml } = await import('./tax-logic');

  const rec = createAuditTrailRecord({
    entityType: 'VOUCHER',
    entityId: 'VCH-55',
    entityRef: 'SA/26-27/099',
    action: 'MODIFIED',
    prevState: { grandTotal: 50000 },
    newState: { grandTotal: 55000 },
    fixedIsoTimestamp: '2026-10-30T12:00:00.000Z'
  });

  const csv = exportAuditTrailToCsv([rec]);
  assert.ok(csv.includes('Ministry of Corporate Affairs (MCA) Statutory Audit Trail Report'));
  assert.ok(csv.includes('PERMANENTLY ACTIVE (NON-DISABLEABLE)'));
  assert.ok(csv.includes('SA/26-27/099'));
  assert.ok(csv.includes('VOUCHER'));
  assert.ok(csv.includes('Karma Accounts & Tax Consultants (+91 9104253142)'));

  const cert = generateMcaCertificateHtml({
    totalEvents: 142,
    alteredCount: 8,
    deletedCount: 2,
    createdCount: 132,
    dateRangeStr: '01-Apr-2026 to 31-Mar-2027',
    companyName: 'Banas Traders & Agro Products',
    gstin: '24AAACB1234A1Z5'
  });

  assert.ok(cert.includes('STATUTORY AUDIT TRAIL COMPLIANCE CERTIFICATE'));
  assert.ok(cert.includes('Rule 3(1) of the Companies (Accounts) Rules, 2014'));
  assert.ok(cert.includes('PERMANENTLY ENABLED'));
  assert.ok(cert.includes('Banas Traders & Agro Products'));
  assert.ok(cert.includes('Piyush Suthar, Chief Tax Practitioner'));
});

// ============================================================================
// PROMPT 31: BANK RECONCILIATION STATEMENT (BRS) UNIT TESTS
// ============================================================================

test('calculateBRSSummary calculates 4-stage classical reconciliation formula and equilibrium', async () => {
  const { calculateBRSSummary } = await import('./tax-logic');

  const mockVouchers = [
    // 1. Cleared Payment
    {
      id: 'V1',
      voucherNo: 'PYMT-01',
      voucherType: 'PAYMENT',
      date: '2026-10-05',
      particulars: 'Apmc Market Cess',
      debitAmount: 0,
      creditAmount: 15000,
      bankDate: '2026-10-06',
      isCleared: true
    },
    // 2. Uncleared Payment (Cheque issued not yet debited by bank)
    {
      id: 'V2',
      voucherNo: 'PYMT-02',
      voucherType: 'PAYMENT',
      date: '2026-10-25',
      particulars: 'Shree Agro Traders',
      instrumentNo: 'CHQ-89012',
      debitAmount: 0,
      creditAmount: 45000,
      bankDate: null,
      isCleared: false
    },
    // 3. Uncleared Receipt (Cheque deposited not yet credited by bank)
    {
      id: 'V3',
      voucherNo: 'RCPT-01',
      voucherType: 'RECEIPT',
      date: '2026-10-28',
      particulars: 'Kisan Commodity Buyers',
      instrumentNo: 'NEFT-5512',
      debitAmount: 20000,
      creditAmount: 0,
      bankDate: null,
      isCleared: false
    }
  ];

  // Company Book Balance = ₹5,00,000 Dr
  // Add: Cheques issued not debited = +45,000
  // Less: Cheques deposited not credited = -20,000
  // Expected Bank Balance = 5,00,000 + 45,000 - 20,000 = 5,25,000
  const summary = calculateBRSSummary({
    companyBalance: 500000,
    companyBalanceType: 'Dr',
    vouchers: mockVouchers,
    targetStatementBalance: 525000
  });

  assert.equal(summary.companyBankBalance, 500000);
  assert.equal(summary.companyBalanceType, 'Dr');
  assert.equal(summary.chequesIssuedUncleared, 45000);
  assert.equal(summary.chequesDepositedUncleared, 20000);
  assert.equal(summary.balanceAsPerBankStatement, 525000);
  assert.equal(summary.bankStatementBalanceType, 'Cr');
  assert.equal(summary.isEquilibrium, true);
  assert.equal(summary.unreconciledDifference, 0);
  assert.equal(summary.clearedVouchersCount, 1);
  assert.equal(summary.unclearedVouchersCount, 2);
});

test('parseBankStatementCsv parses standard Indian bank CSVs (SBI, HDFC, ICICI)', async () => {
  const { parseBankStatementCsv } = await import('./tax-logic');

  const sbiCsv = `Txn Date,Description,Ref No./Cheque No.,Debit,Credit,Balance
01-10-2026,OPENING BALANCE,,,150000.00,150000.00
05-10-2026,NEFT INWARD FROM PATEL TRADERS,UTR99281,,50000.00,200000.00
12-10-2026,CHQ PAID TO VENDOR,CHQ-89012,45000.00,,155000.00
15-10-2026,BANK CHARGES FOR SMS,,,250.00,,154750.00`;

  const parsed = parseBankStatementCsv(sbiCsv);
  assert.equal(parsed.length, 4); // 4 transaction rows with dr/cr > 0
  assert.equal(parsed[1].date, '2026-10-05');
  assert.equal(parsed[1].depositCredit, 50000);
  assert.equal(parsed[1].refNo, 'UTR99281');

  assert.equal(parsed[2].date, '2026-10-12');
  assert.equal(parsed[2].withdrawalDebit, 45000);
  assert.equal(parsed[2].refNo, 'CHQ-89012');
});

test('matchBankStatementWithVouchers matches exact ref/amount and fuzzy date window', async () => {
  const { matchBankStatementWithVouchers } = await import('./tax-logic');

  const bankRows = [
    {
      date: '2026-10-26',
      description: 'CHQ CLEARANCE',
      refNo: 'CHQ-89012',
      withdrawalDebit: 45000,
      depositCredit: 0
    },
    {
      date: '2026-10-30',
      description: 'NEFT DEPOSIT FROM CLIENT',
      refNo: '',
      withdrawalDebit: 0,
      depositCredit: 20000
    }
  ];

  const unclearedVouchers = [
    {
      id: 'V-101',
      voucherNo: 'PYMT-01',
      voucherType: 'PAYMENT',
      date: '2026-10-25',
      particulars: 'Shree Agro Traders',
      instrumentNo: 'CHQ-89012',
      debitAmount: 0,
      creditAmount: 45000,
      isCleared: false
    },
    {
      id: 'V-102',
      voucherNo: 'RCPT-02',
      voucherType: 'RECEIPT',
      date: '2026-10-28',
      particulars: 'Kisan Buyers',
      instrumentNo: '',
      debitAmount: 20000,
      creditAmount: 0,
      isCleared: false
    }
  ];

  const matches = matchBankStatementWithVouchers(bankRows, unclearedVouchers, 5);
  assert.equal(matches.length, 2);

  // Match 1: Exact Ref and Amount
  assert.equal(matches[0].matchType, 'EXACT_REF_AND_AMOUNT');
  assert.equal(matches[0].matchedVoucher?.id, 'V-101');
  assert.equal(matches[0].confidence, 98);

  // Match 2: Exact Amount within ±5 days window
  assert.equal(matches[1].matchType, 'EXACT_AMOUNT_DATE_WINDOW');
  assert.equal(matches[1].matchedVoucher?.id, 'V-102');
  assert.equal(matches[1].confidence, 85);
});

test('exportBRSToCsv and generateBRSPrintableHtml generate compliant reports', async () => {
  const { exportBRSToCsv, generateBRSPrintableHtml } = await import('./tax-logic');

  const summary = {
    companyBankBalance: 500000,
    companyBalanceType: 'Dr' as const,
    chequesIssuedUncleared: 45000,
    chequesDepositedUncleared: 20000,
    directBankAdjustments: 0,
    balanceAsPerBankStatement: 525000,
    bankStatementBalanceType: 'Cr' as const,
    isEquilibrium: true,
    unreconciledDifference: 0,
    totalVouchersCount: 3,
    clearedVouchersCount: 1,
    unclearedVouchersCount: 2
  };

  const vouchers = [
    {
      id: 'V1',
      voucherNo: 'PYMT-01',
      voucherType: 'PAYMENT',
      date: '2026-10-25',
      particulars: 'Shree Agro',
      instrumentNo: 'CHQ-89012',
      debitAmount: 0,
      creditAmount: 45000,
      bankDate: null,
      isCleared: false
    }
  ];

  const csv = exportBRSToCsv(summary, vouchers, 'State Bank of India (CA 392810482910)');
  assert.ok(csv.includes('Bank Reconciliation Statement (BRS)'));
  assert.ok(csv.includes('State Bank of India'));
  assert.ok(csv.includes('PYMT-01'));
  assert.ok(csv.includes('CHQ-89012'));
  assert.ok(csv.includes('Karma Accounts (+91 9104253142)'));

  const html = generateBRSPrintableHtml(
    summary,
    vouchers,
    { name: 'State Bank of India' },
    { name: 'Banas Traders & Agro Products', gstin: '24AABCB1234D1Z5' }
  );

  assert.ok(html.includes('BANK RECONCILIATION STATEMENT'));
  assert.ok(html.includes('Banas Traders & Agro Products'));
  assert.ok(html.includes('24AABCB1234D1Z5'));
  assert.ok(html.includes('Piyush Suthar, Chief Tax Practitioner'));
  assert.ok(html.includes('RECONCILED (Discrepancy: ₹0.00)'));
});

// =========================================================================
// PROMPT 32: COST CENTRES, PROFIT CENTRES & DEPARTMENTAL P&L TESTS
// =========================================================================

test('calculateSegmentalPNL computes departmental revenue, direct costs, overheads, and net margin per centre', async () => {
  const { calculateSegmentalPNL } = await import('./tax-logic');

  const categories = [
    { id: 'cat-branches', name: 'Branch Offices' },
    { id: 'cat-projects', name: 'Agricultural Projects' }
  ];

  const centres: any[] = [
    { id: 'cc-deodar', categoryId: 'cat-branches', name: 'Deodar Mandi Yard', code: 'DDR-01', type: 'PROFIT_CENTRE', status: 'ACTIVE' },
    { id: 'cc-palanpur', categoryId: 'cat-branches', name: 'Palanpur Head Office', code: 'PLN-01', type: 'PROFIT_CENTRE', status: 'ACTIVE' },
    { id: 'cc-fleet', categoryId: 'cat-branches', name: 'Vehicle & Fleet Logistics', code: 'FLT-01', type: 'COST_CENTRE', status: 'ACTIVE' }
  ];

  const vouchers = [
    {
      id: 'v1',
      type: 'Sales',
      grandTotal: 500000,
      costAllocations: [
        { categoryId: 'cat-branches', costCentreId: 'cc-deodar', amount: 350000, percentage: 70 },
        { categoryId: 'cat-branches', costCentreId: 'cc-palanpur', amount: 150000, percentage: 30 }
      ]
    },
    {
      id: 'v2',
      type: 'Purchase',
      grandTotal: 200000,
      costAllocations: [
        { categoryId: 'cat-branches', costCentreId: 'cc-deodar', amount: 140000, percentage: 70 },
        { categoryId: 'cat-branches', costCentreId: 'cc-palanpur', amount: 60000, percentage: 30 }
      ]
    },
    {
      id: 'v3',
      type: 'Payment',
      particulars: 'Diesel and Vehicle Fuel',
      grandTotal: 50000,
      costAllocations: [
        { categoryId: 'cat-branches', costCentreId: 'cc-fleet', amount: 50000, percentage: 100 }
      ]
    }
  ];

  const summary = calculateSegmentalPNL({
    categories,
    centres,
    vouchers,
    categoryFilter: 'ALL',
    reportingPeriod: 'FY 2026-27'
  });

  const deodar = summary.centres.find(c => c.centreId === 'cc-deodar')!;
  assert.equal(deodar.salesTurnover, 350000);
  assert.equal(deodar.materialPurchases, 140000);
  assert.equal(deodar.grossContribution, 210000);
  assert.equal(deodar.netProfit, 210000);
  assert.equal(deodar.netMarginPct, 60);

  const fleet = summary.centres.find(c => c.centreId === 'cc-fleet')!;
  assert.equal(fleet.transportFuel, 50000);
  assert.equal(fleet.netProfit, -50000);

  assert.equal(summary.consolidated.totalRevenue, 500000);
  assert.equal(summary.consolidated.totalDirectCosts, 200000);
  assert.equal(summary.consolidated.grossContribution, 300000);
  assert.equal(summary.consolidated.totalOverheads, 50000);
  assert.equal(summary.consolidated.netOperatingProfit, 250000);
  assert.equal(summary.consolidated.netMarginPct, 50);
});

test('calculateSegmentalPNL identifies most profitable branch and highest cost overhead centre', async () => {
  const { calculateSegmentalPNL } = await import('./tax-logic');

  const categories = [{ id: 'cat-1', name: 'Branches' }];
  const centres: any[] = [
    { id: 'c1', categoryId: 'cat-1', name: 'Branch A', code: 'BA', type: 'PROFIT_CENTRE', status: 'ACTIVE' },
    { id: 'c2', categoryId: 'cat-1', name: 'Branch B', code: 'BB', type: 'PROFIT_CENTRE', status: 'ACTIVE' }
  ];

  const vouchers = [
    {
      id: 'v1',
      type: 'Sales',
      grandTotal: 100000,
      costAllocations: [{ categoryId: 'cat-1', costCentreId: 'c1', amount: 100000, percentage: 100 }]
    },
    {
      id: 'v2',
      type: 'Sales',
      grandTotal: 200000,
      costAllocations: [{ categoryId: 'cat-1', costCentreId: 'c2', amount: 200000, percentage: 100 }]
    }
  ];

  const summary = calculateSegmentalPNL({ categories, centres, vouchers });
  assert.equal(summary.mostProfitableCentre?.name, 'Branch B');
  assert.equal(summary.mostProfitableCentre?.amount, 200000);
});

test('calculateSegmentalPNL tracks unallocated revenue and expense for audit clean-up', async () => {
  const { calculateSegmentalPNL } = await import('./tax-logic');

  const categories = [{ id: 'cat-1', name: 'Branches' }];
  const centres: any[] = [
    { id: 'c1', categoryId: 'cat-1', name: 'Branch A', code: 'BA', type: 'PROFIT_CENTRE', status: 'ACTIVE' }
  ];

  const vouchers = [
    { id: 'v1', type: 'Sales', grandTotal: 50000 }, // No cost allocations
    { id: 'v2', type: 'Payment', grandTotal: 12000 } // No cost allocations
  ];

  const summary = calculateSegmentalPNL({ categories, centres, vouchers });
  assert.equal(summary.totalUnallocatedAmount, 62000);
  assert.equal(summary.unallocatedVouchersCount, 2);
});

test('exportCostSheetToCsv and generateSegmentalPNLPrintableHtml output valid Ind AS 108 reports with CA attribution', async () => {
  const { calculateSegmentalPNL, exportCostSheetToCsv, generateSegmentalPNLPrintableHtml } = await import('./tax-logic');

  const categories = [{ id: 'cat-1', name: 'Branches' }];
  const centres: any[] = [
    { id: 'c1', categoryId: 'cat-1', name: 'Deodar Mandi', code: 'DDR-01', type: 'PROFIT_CENTRE', status: 'ACTIVE' }
  ];

  const vouchers = [
    {
      id: 'v1',
      type: 'Sales',
      grandTotal: 100000,
      costAllocations: [{ categoryId: 'cat-1', costCentreId: 'c1', amount: 100000, percentage: 100 }]
    }
  ];

  const summary = calculateSegmentalPNL({ categories, centres, vouchers });
  const csv = exportCostSheetToCsv(summary);
  assert.ok(csv.includes('DEPARTMENTAL & COST CENTRE PROFITABILITY STATEMENT (IND AS 108)'));
  assert.ok(csv.includes('Deodar Mandi'));
  assert.ok(csv.includes('100000.00'));

  const html = generateSegmentalPNLPrintableHtml(summary, { name: 'Banas Traders & Agro Products', gstin: '24AABCB1234D1Z5' });
  assert.ok(html.includes('DEPARTMENTAL & COST CENTRE P&amp;L'));
  assert.ok(html.includes('Banas Traders & Agro Products'));
  assert.ok(html.includes('Karma Accounts &amp; Tax Consultants'));
  assert.ok(html.includes('Piyush Suthar (+91 9104253142)'));
});

// =========================================================================
// PROMPT 33 TESTS: E-WAY BILL & E-INVOICE GENERATION ENGINE (RULE 138 & 48(4))
// =========================================================================

test('calculateEWayValidityDays calculates statutory validity under Rule 138(10)', async () => {
  const { calculateEWayValidityDays } = await import('./tax-logic');

  // Regular Cargo: 200 km per day or part thereof
  assert.equal(calculateEWayValidityDays(0, 'REGULAR'), 1);
  assert.equal(calculateEWayValidityDays(50, 'REGULAR'), 1);
  assert.equal(calculateEWayValidityDays(200, 'REGULAR'), 1);
  assert.equal(calculateEWayValidityDays(201, 'REGULAR'), 2);
  assert.equal(calculateEWayValidityDays(400, 'REGULAR'), 2);
  assert.equal(calculateEWayValidityDays(401, 'REGULAR'), 3);
  assert.equal(calculateEWayValidityDays(1050, 'REGULAR'), 6);

  // Over Dimensional Cargo (ODC): 20 km per day or part thereof
  assert.equal(calculateEWayValidityDays(0, 'ODC'), 1);
  assert.equal(calculateEWayValidityDays(15, 'ODC'), 1);
  assert.equal(calculateEWayValidityDays(20, 'ODC'), 1);
  assert.equal(calculateEWayValidityDays(21, 'ODC'), 2);
  assert.equal(calculateEWayValidityDays(75, 'ODC'), 4);
});

test('validateIndianVehicleNumber validates standard and Bharat series plates', async () => {
  const { validateIndianVehicleNumber } = await import('./tax-logic');

  // Valid plates
  assert.equal(validateIndianVehicleNumber('GJ08AU4521'), true);
  assert.equal(validateIndianVehicleNumber('GJ-08-AU-4521'), true);
  assert.equal(validateIndianVehicleNumber('MH 12 AB 1234'), true);
  assert.equal(validateIndianVehicleNumber('DL-01-A-9999'), true);
  assert.equal(validateIndianVehicleNumber('RJ-14-C-5678'), true);
  assert.equal(validateIndianVehicleNumber('22BH1234AA'), true);

  // Invalid plates
  assert.equal(validateIndianVehicleNumber(''), false);
  assert.equal(validateIndianVehicleNumber('12345'), false);
  assert.equal(validateIndianVehicleNumber('ABCDEF'), false);
  assert.equal(validateIndianVehicleNumber('GJ-999-ABCD'), false);
});

test('isEWayBillMandatory flags consignments exceeding statutory threshold ₹50,000', async () => {
  const { isEWayBillMandatory } = await import('./tax-logic');

  assert.equal(isEWayBillMandatory(49999), false);
  assert.equal(isEWayBillMandatory(50000), true);
  assert.equal(isEWayBillMandatory(185000), true);
  // Custom threshold override
  assert.equal(isEWayBillMandatory(75000, false, 100000), false);
  assert.equal(isEWayBillMandatory(120000, false, 100000), true);
});

test('calculateIRNHash produces deterministic 64-character SHA-256 hex string', async () => {
  const { calculateIRNHash } = await import('./tax-logic');

  const irn = calculateIRNHash({
    sellerGstin: '24AABCB1234D1Z5',
    finYear: '2026-27',
    docType: 'INV',
    docNo: 'SA/26-27/001'
  });

  assert.equal(typeof irn, 'string');
  assert.equal(irn.length, 64);
  assert.match(irn, /^[0-9a-f]{64}$/);

  // Determinism check
  const irn2 = calculateIRNHash({
    sellerGstin: '24AABCB1234D1Z5',
    finYear: '2026-27',
    docType: 'INV',
    docNo: 'SA/26-27/001'
  });
  assert.equal(irn, irn2);

  // Different docNo yields different hash
  const irnOther = calculateIRNHash({
    sellerGstin: '24AABCB1234D1Z5',
    finYear: '2026-27',
    docType: 'INV',
    docNo: 'SA/26-27/002'
  });
  assert.notEqual(irn, irnOther);
});

test('buildEInvoiceSignedQRData encodes required compliance fields and token', async () => {
  const { buildEInvoiceSignedQRData } = await import('./tax-logic');

  const qrData = buildEInvoiceSignedQRData({
    sellerGstin: '24AABCB1234D1Z5',
    buyerGstin: '24XYZAB5678K1Z2',
    docNo: 'INV/2026/089',
    docDate: '2026-10-26',
    totalValue: 245000,
    itemCount: 2,
    mainHsn: '0909',
    irn: 'f8a42b109e37c6458319e76d910a34bcf12389a04bc612de94056291aeb740c2'
  });

  assert.ok(qrData.startsWith('IRP_V1.03|24AABCB1234D1Z5|24XYZAB5678K1Z2|INV/2026/089|2026-10-26|245000.00|2|0909|'));
  assert.ok(qrData.includes('f8a42b109e37c6458319e76d910a34bcf12389a04bc612de94056291aeb740c2'));
  assert.ok(qrData.includes('SIG_GSTN_NIC_'));
});

test('buildNicEWayBillJsonPayload and buildIrpEInvoiceJsonPayload format standard payloads', async () => {
  const { buildNicEWayBillJsonPayload, buildIrpEInvoiceJsonPayload } = await import('./tax-logic');

  const consignment: any = {
    id: 'ewb-1',
    docNo: 'INV/2026/001',
    docDate: '2026-10-26',
    docType: 'INV',
    supplyType: 'O',
    subSupplyType: '1',
    fromGstin: '24AABCB1234D1Z5',
    fromTrdName: 'Banas Traders & Agro Products',
    fromAddr1: 'Highway APMC Market Yard',
    fromPlace: 'Palanpur',
    fromPincode: '385001',
    fromStateCode: '24',
    toGstin: '24XYZAB5678K1Z2',
    toTrdName: 'Gujarat Agro Impex Pvt Ltd',
    toAddr1: 'Naroda Industrial Estate',
    toPlace: 'Ahmedabad',
    toPincode: '382330',
    toStateCode: '24',
    taxableValue: 100000,
    cgstValue: 2500,
    sgstValue: 2500,
    igstValue: 0,
    cessValue: 0,
    totalValue: 105000,
    mainHsn: '0909',
    items: [
      {
        productName: 'Cumin Seeds Grade-A',
        hsnCode: '0909',
        quantity: 100,
        unit: 'BAG',
        taxableAmount: 100000,
        cgstRate: 2.5,
        sgstRate: 2.5,
        igstRate: 0
      }
    ],
    transporterId: '24AAACT1234F1Z8',
    transporterName: 'Banaskantha Goods Transport',
    transDocNo: 'LR-99881',
    transDocDate: '2026-10-26',
    transMode: '1',
    distanceKm: 145,
    vehicleNo: 'GJ-08-AU-4521',
    vehicleType: 'REGULAR',
    status: 'GENERATED'
  };

  // NIC Payload
  const nicPayload = buildNicEWayBillJsonPayload(consignment);
  assert.equal(nicPayload.version, '1.0.0421');
  assert.equal(nicPayload.billLists.length, 1);
  assert.equal(nicPayload.billLists[0].docNo, 'INV/2026/001');
  assert.equal(nicPayload.billLists[0].vehicleNo, 'GJ08AU4521');
  assert.equal(nicPayload.billLists[0].itemList[0].productName, 'Cumin Seeds Grade-A');

  // IRP Payload
  const irpPayload = buildIrpEInvoiceJsonPayload(consignment);
  assert.equal(irpPayload.Version, '1.1');
  assert.equal(irpPayload.TranDtls.SupTyp, 'B2B');
  assert.equal(irpPayload.DocDtls.No, 'INV/2026/001');
  assert.equal(irpPayload.ValDtls.TotInvVal, 105000);
  assert.equal(irpPayload.EwbDtls.VehNo, 'GJ08AU4521');
});

test('generateEWaySlipPrintableHtml renders official Rule 138A slip with CA advisory', async () => {
  const { generateEWaySlipPrintableHtml } = await import('./tax-logic');

  const consignment: any = {
    id: 'ewb-1',
    docNo: 'SA/26-27/001',
    docDate: '2026-10-26',
    docType: 'INV',
    supplyType: 'O',
    fromGstin: '24AABCB1234D1Z5',
    fromTrdName: 'Banas Traders & Agro Products',
    toGstin: '24XYZAB5678K1Z2',
    toTrdName: 'Gujarat Agro Impex Pvt Ltd',
    taxableValue: 100000,
    totalValue: 105000,
    distanceKm: 145,
    vehicleNo: 'GJ-08-AU-4521',
    vehicleType: 'REGULAR',
    ewbNo: '241088923412'
  };

  const html = generateEWaySlipPrintableHtml(consignment, {
    name: 'Banas Traders & Agro Products',
    gstin: '24AABCB1234D1Z5'
  });

  assert.ok(html.includes('E-WAY BILL / CONSIGNMENT NOTE (RULE 138A)'));
  assert.ok(html.includes('241088923412'));
  assert.ok(html.includes('GJ08AU4521') || html.includes('GJ-08-AU-4521'));
  assert.ok(html.includes('Karma Accounts &amp; Tax Consultants'));
  assert.ok(html.includes('Piyush Suthar (+91 9104253142)'));
});

// =========================================================================
// PROMPT 34 TESTS: DIRECT TAX TDS & TCS STATUTORY COMPLIANCE (INCOME TAX ACT)
// =========================================================================

test('validateIndianPan validates 10-character alphanumeric PAN format', async () => {
  const { validateIndianPan } = await import('./tax-logic');

  // Valid PANs
  assert.equal(validateIndianPan('AAACB1234D'), true);
  assert.equal(validateIndianPan('BNSPA5678K'), true);
  assert.equal(validateIndianPan('XYZCP9999M'), true);
  assert.equal(validateIndianPan('aaacb1234d'), true); // case-insensitive

  // Invalid PANs
  assert.equal(validateIndianPan(''), false);
  assert.equal(validateIndianPan('1234567890'), false);
  assert.equal(validateIndianPan('ABCDE12345'), false);
  assert.equal(validateIndianPan('ABCD12345E'), false);
  assert.equal(validateIndianPan('PANNOTAVBL'), false);
});

test('validateIndianTan validates 10-character TAN format', async () => {
  const { validateIndianTan } = await import('./tax-logic');

  // Valid TANs
  assert.equal(validateIndianTan('AHMK12345D'), true);
  assert.equal(validateIndianTan('BLRB99887C'), true);
  assert.equal(validateIndianTan('ahmk12345d'), true);

  // Invalid TANs
  assert.equal(validateIndianTan(''), false);
  assert.equal(validateIndianTan('12345'), false);
  assert.equal(validateIndianTan('AHM123456D'), false);
});

test('calculateTdsDeduction evaluates Section 194C rates, thresholds, and Sec 194C(6) exemption', async () => {
  const { calculateTdsDeduction } = await import('./tax-logic');

  // Below single bill threshold (<= 30000) with no cumulative turnover -> 0 deduction
  const belowThreshold = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 25000,
    hasValidPan: true,
    isCompanyOrFirm: false
  });
  assert.equal(belowThreshold.isThresholdBreached, false);
  assert.equal(belowThreshold.deductionAmount, 0);

  // Single bill > 30000 for Individual -> 1%
  const indDeduction = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 50000,
    hasValidPan: true,
    isCompanyOrFirm: false
  });
  assert.equal(indDeduction.isThresholdBreached, true);
  assert.equal(indDeduction.applicableRate, 1.0);
  assert.equal(indDeduction.deductionAmount, 500);
  assert.equal(indDeduction.isPenalRate, false);

  // Company / Firm contractor -> 2%
  const corpDeduction = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 50000,
    hasValidPan: true,
    isCompanyOrFirm: true
  });
  assert.equal(corpDeduction.applicableRate, 2.0);
  assert.equal(corpDeduction.deductionAmount, 1000);

  // Aggregate turnover breaching ₹1,00,000 threshold
  const aggregateBreach = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 20000,
    cumulativeTurnover: 90000, // 90k + 20k = 110k (> 100k)
    hasValidPan: true,
    isCompanyOrFirm: true
  });
  assert.equal(aggregateBreach.isThresholdBreached, true);
  assert.equal(aggregateBreach.deductionAmount, 400); // 2% on 20000

  // Sec 194C(6) Transporter Exemption
  const transportExempt = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 60000,
    hasValidPan: true,
    isTransportExempt: true
  });
  assert.equal(transportExempt.isExempt, true);
  assert.equal(transportExempt.deductionAmount, 0);
  assert.ok(transportExempt.explanation.includes('194C(6)'));

  // Missing PAN penal rate under Sec 206AA (20%)
  const nonPanPenal = calculateTdsDeduction({
    sectionKey: '194C',
    amount: 50000,
    hasValidPan: false
  });
  assert.equal(nonPanPenal.isPenalRate, true);
  assert.equal(nonPanPenal.applicableRate, 20.0);
  assert.equal(nonPanPenal.deductionAmount, 10000);
});

test('calculateTdsDeduction evaluates Section 194J, 194I, and 194Q statutory rules', async () => {
  const { calculateTdsDeduction } = await import('./tax-logic');

  // Sec 194J Professional (10%)
  const profResult = calculateTdsDeduction({
    sectionKey: '194J_prof',
    amount: 50000,
    hasValidPan: true
  });
  assert.equal(profResult.applicableRate, 10.0);
  assert.equal(profResult.deductionAmount, 5000);

  // Sec 194J Technical (2%)
  const techResult = calculateTdsDeduction({
    sectionKey: '194J_tech',
    amount: 50000,
    hasValidPan: true
  });
  assert.equal(techResult.applicableRate, 2.0);
  assert.equal(techResult.deductionAmount, 1000);

  // Sec 194I Rent Land & Building (10%)
  const rentResult = calculateTdsDeduction({
    sectionKey: '194I_land',
    amount: 300000,
    hasValidPan: true
  });
  assert.equal(rentResult.applicableRate, 10.0);
  assert.equal(rentResult.deductionAmount, 30000);

  // Sec 194Q Goods Purchase exceeding ₹50 Lakhs (@ 0.1%)
  const goodsPurchase = calculateTdsDeduction({
    sectionKey: '194Q',
    amount: 1000000, // 10 Lakhs
    cumulativeTurnover: 5200000, // Total 62 Lakhs
    hasValidPan: true
  });
  assert.equal(goodsPurchase.applicableRate, 0.1);
  assert.equal(goodsPurchase.deductionAmount, 1000); // 0.1% on 10,00,000 = 1,000
});

test('calculateTdsDueDate calculates monthly 7th deadline and 30th April for March', async () => {
  const { calculateTdsDueDate } = await import('./tax-logic');

  // October 2026 deduction -> Due 07-Nov-2026
  const octResult = calculateTdsDueDate('2026-10-26', '2026-10-26');
  assert.equal(octResult.dueDateStr, '07-Nov-2026');
  assert.equal(octResult.monthName, 'October');

  // December 2026 deduction -> Due 07-Jan-2027
  const decResult = calculateTdsDueDate('2026-12-15', '2026-12-15');
  assert.equal(decResult.dueDateStr, '07-Jan-2027');

  // March 2027 deduction -> Due 30-Apr-2027 (Statutory exception)
  const marResult = calculateTdsDueDate('2027-03-20', '2027-03-20');
  assert.equal(marResult.dueDateStr, '30-Apr-2027');
});

test('generateETdsFvuRecords formats NSDL Protean FVU file structure', async () => {
  const { generateETdsFvuRecords } = await import('./tax-logic');

  const challans = [
    {
      challanSerial: '04821',
      bsrCode: '0012456',
      depositDate: '2026-11-05',
      majorHead: '0021',
      taxAmount: 6000,
      surcharge: 0,
      cess: 0,
      interest: 0,
      fee: 0,
      totalChallanAmount: 6000
    }
  ];

  const deductions = [
    {
      deducteePan: 'AAACB1234D',
      deducteeName: 'National Freight Logistics',
      sectionCode: '194C',
      paymentDate: '2026-10-15',
      grossAmount: 100000,
      taxableAmount: 100000,
      tdsRate: 2.0,
      tdsAmount: 2000,
      challanSerial: '04821',
      bsrCode: '0012456'
    },
    {
      deducteePan: 'XYZCP9999M',
      deducteeName: 'Gujarat Legal Associates',
      sectionCode: '194J',
      paymentDate: '2026-10-20',
      grossAmount: 40000,
      taxableAmount: 40000,
      tdsRate: 10.0,
      tdsAmount: 4000,
      challanSerial: '04821',
      bsrCode: '0012456'
    }
  ];

  const { textData, jsonData } = generateETdsFvuRecords({
    deductorTan: 'AHMK12345D',
    deductorPan: '24AABCB1234D',
    deductorName: 'Banas Traders & Agro Products',
    formType: '26Q',
    quarter: 'Q3',
    financialYear: '2026-27',
    challans,
    deductions
  });

  assert.ok(textData.startsWith('FH^SL1^26Q^REGULAR^AHMK12345D'));
  assert.ok(textData.includes('BH^1^1^2^6000.00^6000.00^'));
  assert.ok(textData.includes('CD^1^0021^0012456^20261105^04821^6000.00'));
  assert.ok(textData.includes('DD^1^04821^194C^AAACB1234D'));
  assert.ok(textData.includes('DD^2^04821^194J^XYZCP9999M'));

  assert.equal(jsonData.batchSummary.challanCount, 1);
  assert.equal(jsonData.batchSummary.deducteeCount, 2);
  assert.equal(jsonData.batchSummary.totalTaxDeducted, 6000);
});

test('generateTdsRegisterPrintableHtml outputs valid direct tax statement with CA attribution', async () => {
  const { generateTdsRegisterPrintableHtml } = await import('./tax-logic');

  const deductions = [
    {
      paymentDate: '15-Oct-2026',
      voucherNo: 'PUR/26-27/045',
      deducteeName: 'National Freight Logistics',
      deducteePan: 'AAACB1234D',
      sectionCode: '194C',
      taxableAmount: 100000,
      tdsRate: 2.0,
      tdsAmount: 2000,
      challanStatus: 'PAID',
      bsrCode: '0012456'
    }
  ];

  const html = generateTdsRegisterPrintableHtml(
    deductions,
    { totalPayable: 2000, totalDeposited: 2000, penalCount: 0, quarter: 'Q3 (Oct-Dec)' },
    { name: 'Banas Traders & Agro Products', tan: 'AHMK12345D', pan: '24AABCB1234D' }
  );

  assert.ok(html.includes('QUARTERLY TDS &amp; TCS STATUTORY COMPLIANCE REGISTER'));
  assert.ok(html.includes('AHMK12345D'));
  assert.ok(html.includes('National Freight Logistics'));
  assert.ok(html.includes('Karma Accounts &amp; Tax Consultants'));
  assert.ok(html.includes('Piyush Suthar (+91 9104253142)'));
});

// ============================================================================
// PROMPT 35 TESTS: ENTERPRISE PRODUCTION SUITE, PWA & SELF-DIAGNOSTIC AUDIT
// ============================================================================

test('validateAnkeStateSchema detects valid state and flags missing collections', async () => {
  const { validateAnkeStateSchema } = await import('./tax-logic');
  
  // Valid state
  const validState = {
    company: { name: 'Banas Traders & Agro Products', gstin: '24AAACB1234D1Z5' },
    ledgers: [{ id: 'L1', name: 'Cash', group: 'Cash-in-hand' }],
    items: [],
    vouchers: [],
  };
  const validRes = validateAnkeStateSchema(validState);
  assert.equal(validRes.valid, true);
  assert.equal(validRes.errors.length, 0);

  // Missing company
  const invalidState1 = {
    ledgers: [{ id: 'L1' }],
    items: [],
    vouchers: [],
  };
  const res1 = validateAnkeStateSchema(invalidState1);
  assert.equal(res1.valid, false);
  assert.ok(res1.errors.some(e => e.includes('Company')));

  // Zero ledgers
  const invalidState2 = {
    company: { name: 'Test', gstin: '24A' },
    ledgers: [],
    items: [],
    vouchers: [],
  };
  const res2 = validateAnkeStateSchema(invalidState2);
  assert.equal(res2.valid, false);
  assert.ok(res2.errors.some(e => e.includes('0 ledger masters')));
});

test('verifyDoubleEntryEquilibrium calculates debit-credit balance and variances', async () => {
  const { verifyDoubleEntryEquilibrium } = await import('./tax-logic');

  // Balanced ledger balances
  const balancedLedgers = [
    { id: 'L1', name: 'Cash', balance: 50000, balanceType: 'Dr' as const },
    { id: 'L2', name: 'Capital', balance: 50000, balanceType: 'Cr' as const },
  ];
  const res1 = verifyDoubleEntryEquilibrium(balancedLedgers, []);
  assert.equal(res1.isBalanced, true);
  assert.equal(res1.variance, 0);
  assert.equal(res1.totalDebits, 50000);
  assert.equal(res1.totalCredits, 50000);

  // Balanced voucher rows
  const balancedVouchers = [
    {
      id: 'V1',
      rows: [
        { debit: 12000, credit: 0 },
        { debit: 0, credit: 12000 },
      ],
    },
  ];
  const res2 = verifyDoubleEntryEquilibrium([], balancedVouchers);
  assert.equal(res2.isBalanced, true);
  assert.equal(res2.variance, 0);

  // Unbalanced entries
  const unbalancedLedgers = [
    { id: 'L1', name: 'Cash', balance: 75000, balanceType: 'Dr' as const },
    { id: 'L2', name: 'Capital', balance: 50000, balanceType: 'Cr' as const },
  ];
  const res3 = verifyDoubleEntryEquilibrium(unbalancedLedgers, []);
  assert.equal(res3.isBalanced, false);
  assert.equal(res3.variance, 25000);
});

test('verifyTaxEngineConsistency validates 50/50 CGST+SGST and IGST rules', async () => {
  const { verifyTaxEngineConsistency } = await import('./tax-logic');

  // Consistent vouchers
  const validVouchers = [
    {
      id: 'V-001',
      voucherNumber: 'SAL/26-27/001',
      isInterState: false,
      partyState: 'Gujarat',
      cgstAmount: 900,
      sgstAmount: 900,
      igstAmount: 0,
    },
    {
      id: 'V-002',
      voucherNumber: 'SAL/26-27/002',
      isInterState: true,
      partyState: 'Maharashtra',
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 1800,
    },
  ];
  const res1 = verifyTaxEngineConsistency(validVouchers);
  assert.equal(res1.consistent, true);
  assert.equal(res1.auditedVouchersCount, 2);
  assert.equal(res1.errors.length, 0);

  // Inconsistent split
  const badVouchers = [
    {
      id: 'V-003',
      voucherNumber: 'SAL/26-27/003',
      isInterState: false,
      partyState: 'Gujarat',
      cgstAmount: 900,
      sgstAmount: 850, // Mismatch
      igstAmount: 0,
    },
  ];
  const res2 = verifyTaxEngineConsistency(badVouchers);
  assert.equal(res2.consistent, false);
  assert.ok(res2.errors[0].includes('tax split mismatch'));
});

test('generateSystemSelfTestReport evaluates 35 operational modules', async () => {
  const { generateSystemSelfTestReport } = await import('./tax-logic');

  const report = generateSystemSelfTestReport({
    company: { name: 'Banas Traders & Agro Products', gstin: '24AAACB1234D1Z5' },
    ledgers: [
      { id: 'L1', name: 'Cash', balance: 10000, balanceType: 'Dr' },
      { id: 'L2', name: 'Capital', balance: 10000, balanceType: 'Cr' },
    ],
    items: [],
    vouchers: [],
  });

  assert.equal(report.totalModules, 35);
  assert.equal(report.passedModules, 35);
  assert.equal(report.allPassed, true);
  assert.ok(report.summary.includes('35/35 Modules Operational (100% Pass)'));
  assert.equal(report.testResults.length, 5);
  assert.ok(report.testResults.every(t => t.status === 'PASS'));
});

test('generatePwaManifestJson outputs complete installable PWA specification', async () => {
  const { generatePwaManifestJson } = await import('./tax-logic');

  const manifest = generatePwaManifestJson();
  assert.equal(manifest.name, 'Karma Accounts & Anke Cloud OS');
  assert.equal(manifest.short_name, 'Anke OS');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/#anke-workspace');
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.some((i: any) => i.sizes === '192x192'));
  assert.ok(manifest.icons.some((i: any) => i.sizes === '512x512'));
  assert.ok(manifest.icons.some((i: any) => i.purpose === 'maskable'));
});

test('generateJsonLdStructuredData produces valid Schema.org entities', async () => {
  const { generateJsonLdStructuredData } = await import('./tax-logic');

  const schemas = generateJsonLdStructuredData();
  assert.ok(schemas.karmaAccountsSchema);
  assert.equal(schemas.karmaAccountsSchema['@type'][0], 'TaxConsultant');
  assert.equal(schemas.karmaAccountsSchema.founder.name, 'Piyush Suthar');
  assert.equal(schemas.karmaAccountsSchema.telephone, '+91 9104253142');

  assert.ok(schemas.ankeOsSchema);
  assert.equal(schemas.ankeOsSchema['@type'], 'SoftwareApplication');
  assert.equal(schemas.ankeOsSchema.name, 'Anke Cloud OS');
  assert.equal(schemas.ankeOsSchema.offers.price, '0');
});

test('UNIVERSAL_SHORTCUTS_CATALOG covers all 4 functional clusters', async () => {
  const { UNIVERSAL_SHORTCUTS_CATALOG } = await import('./tax-logic');

  assert.ok(UNIVERSAL_SHORTCUTS_CATALOG.length >= 25);
  const categories = new Set(UNIVERSAL_SHORTCUTS_CATALOG.map(s => s.category));
  assert.ok(categories.has('vouchers'));
  assert.ok(categories.has('forms'));
  assert.ok(categories.has('reports'));
  assert.ok(categories.has('navigation'));

  // Key shortcuts verified
  assert.ok(UNIVERSAL_SHORTCUTS_CATALOG.some(s => s.key === 'F8' && s.label === 'Sales Invoice'));
  assert.ok(UNIVERSAL_SHORTCUTS_CATALOG.some(s => s.key === 'Alt+T' && s.label.includes('TDS')));
  assert.ok(UNIVERSAL_SHORTCUTS_CATALOG.some(s => s.key === 'Ctrl+H' && s.label.includes('Voucher Mode')));
  assert.ok(UNIVERSAL_SHORTCUTS_CATALOG.some(s => s.key === 'Alt+Z' && s.label.includes('BRS')));
});

// ============================================================================
// PROMPT 36 TESTS: DESKTOP EDITION PASSWORD AUTH & BATCH SCRIPT GENERATOR
// ============================================================================

test('validateDesktopInstallerPassword enforces strict Karma@01 case sensitivity', async () => {
  const { validateDesktopInstallerPassword } = await import('./tax-logic');

  // Exact authorized key
  assert.equal(validateDesktopInstallerPassword('Karma@01'), true);

  // Case mismatch / invalid keys
  assert.equal(validateDesktopInstallerPassword('karma@01'), false);
  assert.equal(validateDesktopInstallerPassword('Karma@1'), false);
  assert.equal(validateDesktopInstallerPassword('admin'), false);
  assert.equal(validateDesktopInstallerPassword(''), false);
  assert.equal(validateDesktopInstallerPassword(null as any), false);
});

test('generateWindowsDesktopBatchScript creates valid true kiosk setup script', async () => {
  const { generateWindowsDesktopBatchScript } = await import('./tax-logic');

  const bat = generateWindowsDesktopBatchScript();
  assert.ok(bat.includes('@echo off'));
  assert.ok(bat.includes('AnkeCloudOS'));
  assert.ok(bat.includes('msedge.exe'));
  assert.ok(bat.includes('chrome.exe'));
  assert.ok(bat.includes('file:///%APPDATA%\\AnkeCloudOS\\index.html#anke-workspace'));
  assert.ok(bat.includes('--window-size=1366,768'));
  assert.ok(bat.includes('Anke Accounting OS.lnk'));
  assert.ok(bat.includes('+91 9104253142'));
  assert.ok(bat.includes('-----BEGIN_ANKE_B64-----'));
  assert.ok(bat.includes('-----END_ANKE_B64-----'));
});


