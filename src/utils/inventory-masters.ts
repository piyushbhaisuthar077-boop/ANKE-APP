// Pure Inventory Masters Logic — GST UQC Units, Stock Groups, Stock Items, HSN/SAC & Tree Builder

export interface GstUqcOption {
  code: string;
  symbol: string;
  formalName: string;
  defaultDecimals: number;
}

export const GST_UQC_CATALOG: GstUqcOption[] = [
  { code: 'NOS-NUMBERS', symbol: 'NOS', formalName: 'Numbers', defaultDecimals: 0 },
  { code: 'KGS-KILOGRAMS', symbol: 'KGS', formalName: 'Kilograms', defaultDecimals: 3 },
  { code: 'PCS-PIECES', symbol: 'PCS', formalName: 'Pieces', defaultDecimals: 0 },
  { code: 'MTR-METERS', symbol: 'MTR', formalName: 'Meters', defaultDecimals: 2 },
  { code: 'BOX-BOX', symbol: 'BOX', formalName: 'Box', defaultDecimals: 0 },
  { code: 'LTR-LITRES', symbol: 'LTR', formalName: 'Litres', defaultDecimals: 3 },
  { code: 'BAG-BAGS', symbol: 'BAG', formalName: 'Bags', defaultDecimals: 0 },
  { code: 'QTL-QUINTAL', symbol: 'QTL', formalName: 'Quintal', defaultDecimals: 2 },
  { code: 'TON-TONNES', symbol: 'TON', formalName: 'Tonnes', defaultDecimals: 3 },
  { code: 'SET-SETS', symbol: 'SET', formalName: 'Sets', defaultDecimals: 0 },
  { code: 'SQF-SQUARE FEET', symbol: 'SQF', formalName: 'Square Feet', defaultDecimals: 2 },
  { code: 'SQM-SQUARE METERS', symbol: 'SQM', formalName: 'Square Meters', defaultDecimals: 2 },
  { code: 'BTL-BOTTLES', symbol: 'BTL', formalName: 'Bottles', defaultDecimals: 0 },
  { code: 'ROL-ROLLS', symbol: 'ROL', formalName: 'Rolls', defaultDecimals: 0 },
  { code: 'UNT-UNITS', symbol: 'UNT', formalName: 'Units', defaultDecimals: 0 },
  { code: 'OTH-OTHERS', symbol: 'OTH', formalName: 'Others', defaultDecimals: 2 }
];

export type UnitType = 'Simple' | 'Compound';
export type GstApplicability = 'Applicable' | 'Not Applicable' | 'Exempt';
export type HsnSource = 'Specify Details Here' | 'Use Stock Group Details';
export type TaxabilityType = 'Taxable' | 'Exempt' | 'Nil Rated' | 'Non-GST';
export type SupplyType = 'Goods' | 'Services';
export type ValuationMethod = 'FIFO' | 'Weighted Average' | 'Standard Cost';

export interface InventoryUnitRecord {
  id: string;
  type: UnitType;
  symbol: string;
  formalName: string;
  uqc: string;
  decimalPlaces: number;
  baseUnitSymbol?: string;
  conversionFactor?: number;
}

export interface StockGroupRecord {
  id: string;
  name: string;
  alias?: string;
  parent: string;
  addQuantities: boolean;
  hasGroupGst: boolean;
  hsnCode?: string;
  taxability?: TaxabilityType;
  gstRate?: number;
}

export interface StockItemRecord {
  id: string;
  name: string;
  alias?: string;
  sku?: string;
  stockGroup: string;
  category?: string;
  unit: string;
  uqc?: string;
  decimalPrecision: number;
  gstApplicability: GstApplicability;
  hsnSource: HsnSource;
  hsn: string;
  hsnDescription?: string;
  taxability: TaxabilityType;
  gstRate: number;
  cessRate?: number;
  supplyType: SupplyType;
  valuationMethod?: ValuationMethod;
  minReorderLevel?: number;
  mrp?: number;
  sellingPrice?: number;
  purchaseCost?: number;
  openingQty: number;
  openingRate: number;
  openingValue: number;
  closingStock?: number;
}

export interface InventoryTreeGroupNode {
  group: StockGroupRecord;
  depth: number;
  childGroups: InventoryTreeGroupNode[];
  items: StockItemRecord[];
}

function norm(val: string | undefined | null): string {
  return String(val || '').trim().toLowerCase();
}

export function suggestUqcForSymbol(symbol: string): GstUqcOption | null {
  const s = String(symbol || '').trim().toUpperCase();
  if (!s) return null;
  const aliasMap: Record<string, string> = {
    NO: 'NOS',
    NOS: 'NOS',
    NUM: 'NOS',
    KG: 'KGS',
    KGS: 'KGS',
    PC: 'PCS',
    PCS: 'PCS',
    M: 'MTR',
    MTR: 'MTR',
    MTRS: 'MTR',
    L: 'LTR',
    LTR: 'LTR',
    LTRS: 'LTR',
    ROLL: 'ROL',
    ROLLS: 'ROL',
    ROL: 'ROL',
    BOTTLE: 'BTL',
    BTL: 'BTL',
    UNIT: 'UNT',
    UNITS: 'UNT',
    UNT: 'UNT',
    MT: 'TON',
    TON: 'TON',
    TONNE: 'TON',
    BOX: 'BOX',
    BAG: 'BAG',
    BAGS: 'BAG',
    QTL: 'QTL',
    SET: 'SET',
    SETS: 'SET',
    SQFT: 'SQF',
    SQF: 'SQF',
    SQM: 'SQM'
  };
  const mapped = aliasMap[s] || s;
  const exact = GST_UQC_CATALOG.find(u => u.symbol === mapped || u.code.startsWith(mapped + '-'));
  if (exact) return exact;
  const partial = GST_UQC_CATALOG.find(
    u => u.symbol.startsWith(s) || u.formalName.toUpperCase().startsWith(s)
  );
  return partial || null;
}

export function formatCompoundUnitLabel(unit: Pick<InventoryUnitRecord, 'type' | 'symbol' | 'baseUnitSymbol' | 'conversionFactor'>): string {
  if (unit.type === 'Compound' && unit.baseUnitSymbol && unit.conversionFactor && unit.conversionFactor > 0) {
    return `${unit.symbol} of ${unit.conversionFactor} ${unit.baseUnitSymbol}`;
  }
  return unit.symbol;
}

export function validateHsnSacCode(code: string): { valid: boolean; error?: string } {
  const clean = String(code || '').trim();
  if (!clean) return { valid: true };
  if (!/^[0-9]{4}$|^[0-9]{6}$|^[0-9]{8}$/.test(clean)) {
    return { valid: false, error: 'HSN / SAC Code must be 4, 6, or 8 numeric digits.' };
  }
  return { valid: true };
}

export function computeGstSplit(gstRate: number, taxability: TaxabilityType = 'Taxable', applicability: GstApplicability = 'Applicable'): {
  cgst: number;
  sgst: number;
  igst: number;
} {
  if (applicability !== 'Applicable' || taxability !== 'Taxable') {
    return { cgst: 0, sgst: 0, igst: 0 };
  }
  const cleanRate = Math.max(0, Math.min(100, Number(gstRate) || 0));
  const half = Math.round((cleanRate / 2) * 100) / 100;
  return { cgst: half, sgst: half, igst: Math.round(cleanRate * 100) / 100 };
}

export function resolveInheritedGroupGst(
  groupName: string,
  groups: StockGroupRecord[]
): { found: boolean; sourceGroup?: string; hsnCode: string; taxability: TaxabilityType; gstRate: number } {
  const byName = new Map<string, StockGroupRecord>();
  groups.forEach(g => byName.set(norm(g.name), g));

  const visited = new Set<string>();
  let current = String(groupName || '').trim();
  while (current && norm(current) !== 'primary') {
    const key = norm(current);
    if (visited.has(key)) break;
    visited.add(key);
    const grp = byName.get(key);
    if (!grp) break;
    if (grp.hasGroupGst) {
      return {
        found: true,
        sourceGroup: grp.name,
        hsnCode: grp.hsnCode || '',
        taxability: grp.taxability || 'Taxable',
        gstRate: Number(grp.gstRate) || 0
      };
    }
    current = grp.parent || 'Primary';
  }
  return { found: false, hsnCode: '', taxability: 'Taxable', gstRate: 0 };
}

export function computeOpeningStockValue(qty: number, rate: number): number {
  const q = Math.max(0, Number(qty) || 0);
  const r = Math.max(0, Number(rate) || 0);
  return Math.round(q * r * 100) / 100;
}

export function formatQuantityForUnit(qty: number, decimalPlaces: number): string {
  const dec = Math.max(0, Math.min(4, Math.floor(Number(decimalPlaces) || 0)));
  const q = Math.max(0, Number(qty) || 0);
  return q.toFixed(dec);
}

export function isDuplicateUnitSymbol(symbol: string, units: InventoryUnitRecord[], excludeId?: string | null): boolean {
  const target = norm(symbol);
  if (!target) return false;
  return units.some(u => norm(u.symbol) === target && (!excludeId || u.id !== excludeId));
}

export function isDuplicateStockGroupName(name: string, groups: StockGroupRecord[], excludeId?: string | null): boolean {
  const target = norm(name);
  if (!target) return false;
  if (target === 'primary') return true;
  return groups.some(g => norm(g.name) === target && (!excludeId || g.id !== excludeId));
}

export function isDuplicateStockItemName(name: string, items: StockItemRecord[], excludeId?: string | null): boolean {
  const target = norm(name);
  if (!target) return false;
  return items.some(i => norm(i.name) === target && (!excludeId || i.id !== excludeId));
}

export function canDeleteUnit(
  unit: InventoryUnitRecord | undefined | null,
  items: StockItemRecord[],
  units: InventoryUnitRecord[]
): { allowed: boolean; reason?: string } {
  if (!unit) return { allowed: false, reason: 'Unit not found.' };
  const symKey = norm(unit.symbol);
  const linkedItems = items.filter(it => norm(it.unit) === symKey || norm(it.unit).startsWith(symKey + ' ') || norm(it.unit).startsWith(symKey + '-')).length;
  if (linkedItems > 0) {
    return {
      allowed: false,
      reason: `Cannot delete unit "${unit.symbol}" because ${linkedItems} stock item${linkedItems === 1 ? '' : 's'} use this unit.`
    };
  }
  const linkedCompound = units.filter(u => u.id !== unit.id && u.type === 'Compound' && norm(u.baseUnitSymbol) === symKey).length;
  if (linkedCompound > 0) {
    return {
      allowed: false,
      reason: `Cannot delete unit "${unit.symbol}" because ${linkedCompound} compound unit${linkedCompound === 1 ? '' : 's'} reference it as a base unit.`
    };
  }
  return { allowed: true };
}

export function canDeleteStockGroup(
  group: StockGroupRecord | undefined | null,
  groups: StockGroupRecord[],
  items: StockItemRecord[]
): { allowed: boolean; reason?: string } {
  if (!group) return { allowed: false, reason: 'Stock Group not found.' };
  const gKey = norm(group.name);
  const subCount = groups.filter(g => g.id !== group.id && norm(g.parent) === gKey).length;
  if (subCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete stock group "${group.name}" because ${subCount} sub-group${subCount === 1 ? '' : 's'} exist under it.`
    };
  }
  const itemCount = items.filter(it => norm(it.stockGroup || it.category) === gKey).length;
  if (itemCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete stock group "${group.name}" because ${itemCount} stock item${itemCount === 1 ? '' : 's'} belong to it.`
    };
  }
  return { allowed: true };
}

export function countVouchersForStockItem(item: StockItemRecord, vouchers: any[]): number {
  const idKey = norm(item.id);
  const nameKey = norm(item.name);
  let count = 0;
  for (const v of vouchers || []) {
    if (!v || typeof v !== 'object') continue;
    const rows = Array.isArray(v.items) ? v.items : (Array.isArray(v.lines) ? v.lines : (Array.isArray(v.lineItems) ? v.lineItems : []));
    const hit = rows.some((r: any) =>
      (r && r.itemId && norm(r.itemId) === idKey) ||
      (r && r.stockItemId && norm(r.stockItemId) === idKey) ||
      (r && r.itemName && norm(r.itemName) === nameKey) ||
      (r && r.name && norm(r.name) === nameKey)
    );
    if (hit) count++;
  }
  return count;
}

export function canDeleteStockItem(
  item: StockItemRecord | undefined | null,
  vouchers: any[]
): { allowed: boolean; reason?: string } {
  if (!item) return { allowed: false, reason: 'Stock Item not found.' };
  const vCount = countVouchersForStockItem(item, vouchers);
  if (vCount > 0) {
    return {
      allowed: false,
      reason: `Cannot delete "${item.name}" because it is used in ${vCount} voucher${vCount === 1 ? '' : 's'}. Remove or alter those vouchers first.`
    };
  }
  return { allowed: true };
}

export function buildInventoryTree(
  groups: StockGroupRecord[],
  items: StockItemRecord[]
): { roots: InventoryTreeGroupNode[]; primaryItems: StockItemRecord[] } {
  const byParent = new Map<string, StockGroupRecord[]>();
  const itemsByGroup = new Map<string, StockItemRecord[]>();

  groups.forEach(g => {
    const pKey = norm(g.parent || 'Primary') || 'primary';
    if (!byParent.has(pKey)) byParent.set(pKey, []);
    byParent.get(pKey)!.push(g);
  });

  const knownGroupKeys = new Set(groups.map(g => norm(g.name)));
  items.forEach(it => {
    const rawGrp = it.stockGroup || it.category || 'Primary';
    const gKey = knownGroupKeys.has(norm(rawGrp)) ? norm(rawGrp) : 'primary';
    if (!itemsByGroup.has(gKey)) itemsByGroup.set(gKey, []);
    itemsByGroup.get(gKey)!.push(it);
  });

  function buildNode(grp: StockGroupRecord, depth: number, ancestors: Set<string>): InventoryTreeGroupNode {
    const gKey = norm(grp.name);
    const nextAnc = new Set(ancestors);
    nextAnc.add(gKey);
    const childGroups = (byParent.get(gKey) || [])
      .filter(cg => !nextAnc.has(norm(cg.name)))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(cg => buildNode(cg, depth + 1, nextAnc));
    const directItems = (itemsByGroup.get(gKey) || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
    return { group: grp, depth, childGroups, items: directItems };
  }

  const roots = (byParent.get('primary') || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(g => buildNode(g, 0, new Set()));

  const primaryItems = (itemsByGroup.get('primary') || [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return { roots, primaryItems };
}
