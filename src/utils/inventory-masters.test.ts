import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GST_UQC_CATALOG,
  suggestUqcForSymbol,
  formatCompoundUnitLabel,
  validateHsnSacCode,
  computeGstSplit,
  resolveInheritedGroupGst,
  computeOpeningStockValue,
  formatQuantityForUnit,
  isDuplicateUnitSymbol,
  isDuplicateStockGroupName,
  isDuplicateStockItemName,
  canDeleteUnit,
  canDeleteStockGroup,
  canDeleteStockItem,
  buildInventoryTree,
  type InventoryUnitRecord,
  type StockGroupRecord,
  type StockItemRecord
} from './inventory-masters';

test('GST UQC catalog contains official standards and auto-suggests from symbol', () => {
  assert.ok(GST_UQC_CATALOG.length >= 16);
  assert.equal(suggestUqcForSymbol('NOS')?.code, 'NOS-NUMBERS');
  assert.equal(suggestUqcForSymbol('kg')?.code, 'KGS-KILOGRAMS');
  assert.equal(suggestUqcForSymbol('roll')?.code, 'ROL-ROLLS');
  assert.equal(suggestUqcForSymbol('ltr')?.defaultDecimals, 3);
  assert.equal(suggestUqcForSymbol('nos')?.defaultDecimals, 0);
});

test('Compound unit label formatting and HSN/SAC 4/6/8 digit validation', () => {
  assert.equal(
    formatCompoundUnitLabel({ type: 'Compound', symbol: 'BOX', baseUnitSymbol: 'NOS', conversionFactor: 12 }),
    'BOX of 12 NOS'
  );
  assert.equal(formatCompoundUnitLabel({ type: 'Simple', symbol: 'NOS' }), 'NOS');

  assert.equal(validateHsnSacCode('7318').valid, true);
  assert.equal(validateHsnSacCode('731815').valid, true);
  assert.equal(validateHsnSacCode('73181500').valid, true);
  assert.equal(validateHsnSacCode('').valid, true);
  assert.equal(validateHsnSacCode('731').valid, false);
  assert.equal(validateHsnSacCode('73181').valid, false);
  assert.equal(validateHsnSacCode('ABCD').valid, false);
});

test('GST split computes exact 50/50 CGST/SGST and full IGST only when Taxable & Applicable', () => {
  assert.deepEqual(computeGstSplit(18, 'Taxable', 'Applicable'), { cgst: 9, sgst: 9, igst: 18 });
  assert.deepEqual(computeGstSplit(5, 'Taxable', 'Applicable'), { cgst: 2.5, sgst: 2.5, igst: 5 });
  assert.deepEqual(computeGstSplit(18, 'Exempt', 'Applicable'), { cgst: 0, sgst: 0, igst: 0 });
  assert.deepEqual(computeGstSplit(18, 'Taxable', 'Not Applicable'), { cgst: 0, sgst: 0, igst: 0 });
});

test('Stock Group GST/HSN inheritance walks up ancestor groups', () => {
  const groups: StockGroupRecord[] = [
    { id: 'sg-1', name: 'Hardware', parent: 'Primary', addQuantities: true, hasGroupGst: true, hsnCode: '7318', taxability: 'Taxable', gstRate: 18 },
    { id: 'sg-2', name: 'Steel Fasteners', parent: 'Hardware', addQuantities: true, hasGroupGst: false }
  ];
  const inherited = resolveInheritedGroupGst('Steel Fasteners', groups);
  assert.equal(inherited.found, true);
  assert.equal(inherited.sourceGroup, 'Hardware');
  assert.equal(inherited.hsnCode, '7318');
  assert.equal(inherited.gstRate, 18);
});

test('Opening value calculation and unit decimal formatting', () => {
  assert.equal(computeOpeningStockValue(12.5, 42.4), 530);
  assert.equal(formatQuantityForUnit(100, 0), '100');
  assert.equal(formatQuantityForUnit(12.5, 3), '12.500');
});

test('Duplicate checks reject duplicates case-insensitively and allow self in alter mode', () => {
  const units: InventoryUnitRecord[] = [
    { id: 'u-1', type: 'Simple', symbol: 'NOS', formalName: 'Numbers', uqc: 'NOS-NUMBERS', decimalPlaces: 0 }
  ];
  const groups: StockGroupRecord[] = [
    { id: 'sg-1', name: 'Fasteners', parent: 'Primary', addQuantities: true, hasGroupGst: false }
  ];
  const items: StockItemRecord[] = [
    {
      id: 'st-1', name: 'M8 Bolt', stockGroup: 'Fasteners', unit: 'NOS', decimalPrecision: 0,
      gstApplicability: 'Applicable', hsnSource: 'Specify Details Here', hsn: '7318',
      taxability: 'Taxable', gstRate: 18, supplyType: 'Goods', openingQty: 10, openingRate: 5, openingValue: 50
    }
  ];

  assert.equal(isDuplicateUnitSymbol('nos', units), true);
  assert.equal(isDuplicateUnitSymbol('nos', units, 'u-1'), false);
  assert.equal(isDuplicateStockGroupName('primary', groups), true);
  assert.equal(isDuplicateStockGroupName('FASTENERS', groups), true);
  assert.equal(isDuplicateStockGroupName('FASTENERS', groups, 'sg-1'), false);
  assert.equal(isDuplicateStockItemName('m8 bolt', items), true);
  assert.equal(isDuplicateStockItemName('m8 bolt', items, 'st-1'), false);
});

test('Guarded deletions block linked units, populated stock groups, and voucher-referenced items', () => {
  const units: InventoryUnitRecord[] = [
    { id: 'u-nos', type: 'Simple', symbol: 'NOS', formalName: 'Numbers', uqc: 'NOS-NUMBERS', decimalPlaces: 0 },
    { id: 'u-box', type: 'Compound', symbol: 'BOX', formalName: 'Box', uqc: 'BOX-BOX', decimalPlaces: 0, baseUnitSymbol: 'NOS', conversionFactor: 12 },
    { id: 'u-kgs', type: 'Simple', symbol: 'KGS', formalName: 'Kilograms', uqc: 'KGS-KILOGRAMS', decimalPlaces: 3 }
  ];
  const groups: StockGroupRecord[] = [
    { id: 'sg-1', name: 'Fasteners', parent: 'Primary', addQuantities: true, hasGroupGst: false },
    { id: 'sg-empty', name: 'Packaging', parent: 'Primary', addQuantities: true, hasGroupGst: false }
  ];
  const items: StockItemRecord[] = [
    {
      id: 'st-1', name: 'M8 Bolt', stockGroup: 'Fasteners', unit: 'NOS', decimalPrecision: 0,
      gstApplicability: 'Applicable', hsnSource: 'Specify Details Here', hsn: '7318',
      taxability: 'Taxable', gstRate: 18, supplyType: 'Goods', openingQty: 10, openingRate: 5, openingValue: 50
    },
    {
      id: 'st-2', name: 'M10 Nut', stockGroup: 'Fasteners', unit: 'NOS', decimalPrecision: 0,
      gstApplicability: 'Applicable', hsnSource: 'Specify Details Here', hsn: '7318',
      taxability: 'Taxable', gstRate: 18, supplyType: 'Goods', openingQty: 20, openingRate: 4, openingValue: 80
    }
  ];
  const vouchers = [{ id: 'V-1', items: [{ itemId: 'st-1', itemName: 'M8 Bolt', qty: 2 }] }];

  assert.equal(canDeleteUnit(units[0], items, units).allowed, false);
  assert.equal(canDeleteUnit(units[2], items, units).allowed, true);
  assert.equal(canDeleteStockGroup(groups[0], groups, items).allowed, false);
  assert.equal(canDeleteStockGroup(groups[1], groups, items).allowed, true);
  assert.equal(canDeleteStockItem(items[0], vouchers).allowed, false);
  assert.equal(canDeleteStockItem(items[1], vouchers).allowed, true);
});

test('buildInventoryTree nests Stock Groups -> Sub-Groups -> Stock Items cleanly', () => {
  const groups: StockGroupRecord[] = [
    { id: 'sg-1', name: 'Hardware', parent: 'Primary', addQuantities: true, hasGroupGst: false },
    { id: 'sg-2', name: 'Steel Fasteners', parent: 'Hardware', addQuantities: true, hasGroupGst: true, hsnCode: '7318', gstRate: 18 }
  ];
  const items: StockItemRecord[] = [
    {
      id: 'st-1', name: 'M8 Bolt', stockGroup: 'Steel Fasteners', unit: 'NOS', decimalPrecision: 0,
      gstApplicability: 'Applicable', hsnSource: 'Use Stock Group Details', hsn: '7318',
      taxability: 'Taxable', gstRate: 18, supplyType: 'Goods', openingQty: 100, openingRate: 15, openingValue: 1500
    },
    {
      id: 'st-2', name: 'Loose Packing Tape', stockGroup: 'Primary', unit: 'ROL', decimalPrecision: 0,
      gstApplicability: 'Applicable', hsnSource: 'Specify Details Here', hsn: '3919',
      taxability: 'Taxable', gstRate: 18, supplyType: 'Goods', openingQty: 10, openingRate: 50, openingValue: 500
    }
  ];

  const tree = buildInventoryTree(groups, items);
  assert.equal(tree.roots.length, 1);
  assert.equal(tree.roots[0].group.name, 'Hardware');
  assert.equal(tree.roots[0].childGroups.length, 1);
  assert.equal(tree.roots[0].childGroups[0].group.name, 'Steel Fasteners');
  assert.equal(tree.roots[0].childGroups[0].items.length, 1);
  assert.equal(tree.roots[0].childGroups[0].items[0].name, 'M8 Bolt');
  assert.equal(tree.primaryItems.length, 1);
  assert.equal(tree.primaryItems[0].name, 'Loose Packing Tape');
});
