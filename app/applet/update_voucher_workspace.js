// update_voucher_workspace.js
// Script to apply Part 1 and Part 2 enhancements to index.html cleanly and deterministically.
const fs = require('fs');

const FILE_PATH = 'index.html';
let content = fs.readFileSync(FILE_PATH, 'utf8');

console.log('Original content length:', content.length);

// ----------------------------------------------------------------------------------
// PART 2: RESTRUCTURE VOUCHER METADATA INTO AN ORGANIZED LEFT-SIDE VERTICAL COLUMN
// ----------------------------------------------------------------------------------

// Locate the start of #anke-voucher-screen-container
const voucherStartTag = '<div id="anke-voucher-screen-container" class="hidden flex-1 flex flex-col bg-[#06141D] text-slate-100 overflow-hidden font-sans">';
const voucherStartIndex = content.indexOf(voucherStartTag);
if (voucherStartIndex === -1) {
  console.error('Could not find #anke-voucher-screen-container');
  process.exit(1);
}

// Locate the start of <main class="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
const mainStartTag = '<main class="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">';
const mainStartIndex = content.indexOf(mainStartTag, voucherStartIndex);
if (mainStartIndex === -1) {
  console.error('Could not find <main> in voucher container');
  process.exit(1);
}

// Locate the end of </main> before footer
const footerTag = '<!-- UNIVERSAL ACTION FOOTER & ACCELERATOR STRIP -->';
const footerIndex = content.indexOf(footerTag, mainStartIndex);
if (footerIndex === -1) {
  console.error('Could not find footer in voucher container');
  process.exit(1);
}

// Find </main> right before footerTag
const mainEndTag = '</main>';
const mainEndIndex = content.lastIndexOf(mainEndTag, footerIndex);
if (mainEndIndex === -1) {
  console.error('Could not find </main> before footer');
  process.exit(1);
}

// Build the new Left-Side Context Sidebar + Clean Header
const newVoucherHeaderAndLeftSidebar = `
        <!-- TOP UNIVERSAL VOUCHER HEADER STRIP -->
        <header class="bg-[#0B2130] border-b border-[#1E4D6E] px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
          <!-- Left: Gateway Back + Enterprise Workspace Title -->
          <div class="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <button
              type="button"
              id="voucher-back-gateway-btn"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#071822] hover:bg-gold-500 hover:text-slate-950 text-slate-200 border border-[#1E4D6E] text-xs font-mono font-bold transition-colors cursor-pointer group"
              title="Return to Gateway of Anke [Esc]"
            >
              <svg class="w-3.5 h-3.5 text-gold-400 group-hover:text-slate-950" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              <span>← Gateway [Esc]</span>
            </button>
            <div class="hidden sm:flex items-center gap-2 pl-2 border-l border-[#1E4D6E]/60 text-xs font-mono">
              <span class="text-slate-400">Workspace /</span>
              <span class="text-gold-300 font-bold">Voucher Entry Console</span>
            </div>
          </div>

          <!-- Right: Mode Pill Trigger (Ctrl+H) + Function Key Quick Switcher + FY Tag -->
          <div class="flex items-center gap-2 sm:gap-3 flex-wrap">
            <!-- Quick Voucher Switcher Strip -->
            <div class="hidden xl:flex items-center gap-1 bg-[#071822] p-0.5 rounded-lg border border-[#1E4D6E] text-[10px] font-mono">
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded hover:bg-[#133B54] text-slate-300 transition-colors cursor-pointer" data-key="F4" title="Contra Voucher [F4]">F4 Contra</button>
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded hover:bg-[#133B54] text-slate-300 transition-colors cursor-pointer" data-key="F5" title="Payment Voucher [F5]">F5 Payment</button>
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded hover:bg-[#133B54] text-slate-300 transition-colors cursor-pointer" data-key="F6" title="Receipt Voucher [F6]">F6 Receipt</button>
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded hover:bg-[#133B54] text-slate-300 transition-colors cursor-pointer" data-key="F7" title="Journal Voucher [F7]">F7 Journal</button>
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded bg-blue-900/60 text-blue-200 border border-blue-600 font-bold cursor-pointer" data-key="F8" title="Sales Voucher [F8]">F8 Sales</button>
              <button type="button" class="anke-fkey-btn px-2 py-0.5 rounded hover:bg-[#133B54] text-slate-300 transition-colors cursor-pointer" data-key="F9" title="Purchase Voucher [F9]">F9 Purchase</button>
            </div>

            <!-- Mode Indicator Pill (Ctrl+H) -->
            <button
              type="button"
              id="voucher-mode-trigger-btn"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-gold-500/10 hover:bg-gold-500/20 text-gold-300 border border-gold-500/50 text-xs font-mono font-bold transition-all cursor-pointer shadow-xs"
              title="Change Voucher Mode [Ctrl+H]"
            >
              <svg class="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7"/>
              </svg>
              <span id="voucher-current-mode-label">Mode: Item Invoice</span>
              <span class="text-[10px] bg-gold-500 text-slate-950 px-1 py-0.2 rounded font-mono font-extrabold">[Ctrl+H]</span>
            </button>

            <!-- FY Badge -->
            <span class="hidden md:inline-flex px-2 py-1 rounded bg-[#071822] text-slate-300 border border-[#1E4D6E] text-[11px] font-mono font-bold">
              FY 2026-27
            </span>
          </div>
        </header>

        <!-- SPLIT-PANE ERP LAYOUT: PERSISTENT LEFT CONTEXT PANE + RIGHT PRIMARY WORKSPACE -->
        <div class="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          <!-- LEFT-SIDE PERSISTENT CONTEXT COLUMN (~320px) -->
          <aside class="w-full lg:w-80 shrink-0 bg-[#091E2C] border-b lg:border-b-0 lg:border-r border-[#1E4D6E] p-3 sm:p-4 overflow-y-auto space-y-3.5 shadow-inner">
            
            <!-- Card 1: Voucher Type & Auto Serial -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                  </svg>
                  Voucher Type &amp; No.
                </span>
                <span class="text-[9px] font-mono text-slate-400">[F4–F9]</span>
              </div>
              <!-- Dynamic Voucher Type Badge (Changes color and label on F4-F9) -->
              <div id="voucher-type-badge-container" class="flex items-center w-full">
                <button
                  type="button"
                  id="voucher-type-badge"
                  class="w-full inline-flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-mono font-extrabold uppercase tracking-wider bg-blue-950 text-blue-100 border border-blue-600 shadow-sm transition-all cursor-pointer hover:brightness-110"
                  title="Click to switch/cycle voucher type (or press F4–F9)"
                >
                  <span class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                    <span id="voucher-type-text">SALES TAX INVOICE [F8]</span>
                  </span>
                  <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4"/>
                  </svg>
                </button>
              </div>
              <!-- Auto-Generated Serial Number -->
              <div class="flex items-center justify-between gap-2 bg-[#0B2130] px-3 py-1.5 rounded-lg border border-[#1E4D6E]">
                <span class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Voucher No:</span>
                <input
                  type="text"
                  id="voucher-serial-input"
                  value="SA/26-27/001"
                  class="w-32 bg-transparent text-right text-gold-300 font-mono font-bold text-xs outline-none focus:text-white"
                  title="Voucher Serial Number (Editable)"
                />
              </div>
            </div>

            <!-- Card 2: Operational Date & Buyer/Supplier Order Ref -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  Date &amp; Ref
                </span>
                <!-- Operational Date Trigger (F2) -->
                <button
                  type="button"
                  id="voucher-date-trigger-btn"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0B2130] hover:bg-[#133B54] text-slate-200 border border-[#1E4D6E] text-[10px] font-mono transition-colors cursor-pointer"
                  title="Click or press F2 to change operational date"
                >
                  <span id="voucher-operating-date-disp" class="font-bold text-gold-300">26-Oct-2026 (Mon)</span>
                  <span class="text-[9px] text-slate-400 font-mono">[F2]</span>
                </button>
              </div>

              <!-- Reference / Inward Bill No. -->
              <div class="space-y-1.5 pt-1 border-t border-[#133B54]/60">
                <label for="voucher-ref-no" class="block text-[10px] font-mono uppercase font-bold text-slate-400">
                  <span id="voucher-ref-label">Buyer Order / Ref No:</span>
                </label>
                <div class="space-y-1.5">
                  <input
                    type="text"
                    id="voucher-ref-no"
                    placeholder="e.g. PO-2026-904"
                    class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1.5 rounded-lg text-slate-200 text-xs font-mono focus:border-gold-500 focus:outline-none placeholder:text-slate-500"
                  />
                  <div class="flex items-center justify-between gap-1.5">
                    <span class="text-[10px] font-mono text-slate-400 uppercase">Ref Date:</span>
                    <input
                      type="date"
                      id="voucher-ref-date"
                      class="bg-[#0B2130] border border-[#1E4D6E] px-2 py-1 rounded-lg text-slate-300 text-xs font-mono focus:border-gold-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Card 3: Party A/c Selector with Live Standing Balance -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <label for="voucher-party-select" class="block text-[10px] font-mono uppercase font-bold text-slate-400">
                  <span id="voucher-party-label">Party A/c Name:</span> <span class="text-red-400">*</span>
                </label>
                <button
                  type="button"
                  id="voucher-quick-add-ledger-btn"
                  class="text-[10px] font-mono text-gold-400 hover:text-gold-300 hover:underline cursor-pointer"
                >
                  + Add Ledger [Alt+C]
                </button>
              </div>
              <div class="relative">
                <select
                  id="voucher-party-select"
                  class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1.5 rounded-lg text-slate-100 text-xs font-semibold focus:border-gold-500 focus:outline-none"
                >
                  <option value="">Select Party Account Head...</option>
                </select>
              </div>
              <!-- Live Ledger Balance Dynamic Display -->
              <div class="bg-[#0B2130] p-2 rounded-lg border border-[#1E4D6E]/80 space-y-1">
                <div class="flex items-center justify-between gap-1 text-[10px] font-mono">
                  <span class="text-slate-400 uppercase">Standing Balance:</span>
                  <span id="voucher-party-balance-badge" class="font-bold text-emerald-400">
                    Current Balance: ₹0.00
                  </span>
                </div>
                <div class="flex items-center justify-between gap-1 text-[10px] font-mono border-t border-[#133B54]/40 pt-1">
                  <span class="text-slate-400 uppercase">GSTIN Status:</span>
                  <span id="voucher-party-gstin-badge" class="text-slate-300 truncate max-w-[140px]">
                    GSTIN: Not Selected
                  </span>
                </div>
              </div>
            </div>

            <!-- Card 4: Place of Supply & Statutory Tax Regime Status -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <label for="voucher-place-of-supply-select" class="block text-[10px] font-mono uppercase font-bold text-slate-400">
                  Place of Supply:
                </label>
                <span class="text-[9px] font-mono text-slate-400">36 States/UTs</span>
              </div>
              <select
                id="voucher-place-of-supply-select"
                class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1.5 rounded-lg text-slate-200 text-xs font-mono focus:border-gold-500 focus:outline-none"
              >
              </select>
              <!-- Live Inter-State / Intra-State Tax Badge -->
              <div class="pt-1">
                <span
                  id="voucher-tax-nature-badge"
                  class="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded text-[11px] font-mono font-bold bg-blue-900/60 text-blue-200 border border-blue-700 shadow-xs text-center leading-tight"
                >
                  Intra-State Supply (CGST + SGST Applicable)
                </span>
              </div>
            </div>

            <!-- Card 5: Collapsible Dispatch & Transport Drawer -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <button
                  type="button"
                  id="voucher-toggle-dispatch-drawer-btn"
                  class="w-full inline-flex items-center justify-between text-xs font-mono text-gold-400 hover:text-white bg-[#0B2130] hover:bg-[#133B54] px-2.5 py-1.5 rounded-lg border border-[#1E4D6E] transition-colors cursor-pointer"
                >
                  <span class="flex items-center gap-1.5 font-bold">
                    <svg class="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"/>
                    </svg>
                    Dispatch &amp; Transport
                  </span>
                  <svg id="voucher-dispatch-drawer-icon" class="w-3.5 h-3.5 text-gold-400 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              </div>
              <!-- Collapsible Drawer Contents -->
              <div id="voucher-dispatch-drawer" class="hidden space-y-2 pt-2 border-t border-[#133B54]/70 text-xs font-mono">
                <div class="space-y-1">
                  <label for="voucher-eway-bill" class="text-[10px] text-slate-400 uppercase font-bold block">E-Way Bill Number:</label>
                  <input
                    type="text"
                    id="voucher-eway-bill"
                    placeholder="e.g. 241088492019"
                    class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1 rounded text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div class="space-y-1">
                  <label for="voucher-vehicle-no" class="text-[10px] text-slate-400 uppercase font-bold block">Vehicle Number:</label>
                  <input
                    type="text"
                    id="voucher-vehicle-no"
                    placeholder="e.g. GJ-01-AB-1234"
                    class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1 rounded text-slate-200 text-xs uppercase focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div class="space-y-1">
                  <label for="voucher-lr-no" class="text-[10px] text-slate-400 uppercase font-bold block">LR / Bilti / Doc No:</label>
                  <input
                    type="text"
                    id="voucher-lr-no"
                    placeholder="e.g. LR-90821"
                    class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1 rounded text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                  />
                </div>
                <div class="space-y-1">
                  <label for="voucher-transporter-name" class="text-[10px] text-slate-400 uppercase font-bold block">Transporter Name:</label>
                  <input
                    type="text"
                    id="voucher-transporter-name"
                    placeholder="e.g. Gujarat Express Roadlines"
                    class="w-full bg-[#0B2130] border border-[#1E4D6E] px-2.5 py-1 rounded text-slate-200 text-xs focus:border-gold-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <!-- Card 6: Dynamic UPI QR & Payment Vector -->
            <div class="bg-[#071822] border border-[#1E4D6E] p-3 rounded-xl shadow-sm space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 text-gold-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/>
                  </svg>
                  UPI Settlement QR
                </span>
                <span class="text-[9px] font-mono text-emerald-400 font-bold">BHIM / UPI 2.0</span>
              </div>
              <div class="flex items-center gap-3 bg-[#0B2130] p-2 rounded-lg border border-[#1E4D6E]/80">
                <div id="voucher-sidebar-upi-qr" class="w-14 h-14 bg-white rounded p-1 shrink-0 flex items-center justify-center">
                  <!-- Generated UPI QR will populate here -->
                </div>
                <div class="text-[10px] font-mono space-y-0.5 text-slate-300 min-w-0">
                  <div class="text-white font-bold truncate">Instant Settlement</div>
                  <div class="text-slate-400 text-[9px]">GPay • PhonePe • Paytm</div>
                  <div class="text-gold-300 font-bold text-[9px]">Live Invoice Linked</div>
                </div>
              </div>
            </div>

          </aside>

          <!-- MAIN RIGHT COLUMN: SPACIOUS PRIMARY WORK AREA -->
          `;

// Replace from voucherStartIndex + voucherStartTag.length up to mainStartIndex + mainStartTag.length
const beforeContainer = content.slice(0, voucherStartIndex + voucherStartTag.length);
const mainAndBeyond = content.slice(mainStartIndex + mainStartTag.length);

// We replace the top section with newVoucherHeaderAndLeftSidebar, then keep <main ...> and its content,
// but add </div> to close the split-pane right after </main>!
const updatedMainAndBeyond = mainAndBeyond.replace('</main>', '</main>\n        </div>');

content = beforeContainer + newVoucherHeaderAndLeftSidebar + '<main class="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 min-w-0">' + updatedMainAndBeyond;

console.log('Restructured split-pane layout applied. New content length:', content.length);

// ----------------------------------------------------------------------------------
// PART 1: FIX VOUCHER TYPE SWITCHING (F4 THROUGH F9), SERIAL PREFIXES & ACTIVE MODE ADAPTATION
// ----------------------------------------------------------------------------------

// 1. Ensure VOUCHER_CONFIGS has REC for RECEIPT
content = content.replace(
  "serialPrefix: 'RCP'",
  "serialPrefix: 'REC'"
);

// 2. In AnkeVoucherController.setVoucherType, ensure all voucher serials use /26-27/ prefix format
const oldSerialLogic = `            const count = this.serialCounts[norm] || 1;
            const padded = String(count).padStart(3, '0');
            let serial = \`\${cfg.serialPrefix}/26-27/\${padded}\`;
            if (norm !== 'SALES' && norm !== 'PURCHASE') {
              serial = \`\${cfg.serialPrefix}/2026/\${padded}\`;
            }
            if (voucherSerialInput) voucherSerialInput.value = serial;`;

const newSerialLogic = `            const count = this.serialCounts[norm] || 1;
            const padded = String(count).padStart(3, '0');
            const serial = \`\${cfg.serialPrefix}/26-27/\${padded}\`;
            if (voucherSerialInput) voucherSerialInput.value = serial;`;

if (content.includes(oldSerialLogic)) {
  content = content.replace(oldSerialLogic, newSerialLogic);
  console.log('Replaced serial number formatting to /26-27/ for all voucher types');
} else {
  console.warn('oldSerialLogic string not matched verbatim, performing fallback replace...');
  content = content.replace(
    /if \(norm !== 'SALES' && norm !== 'PURCHASE'\) \{\s*serial = `\$\{cfg\.serialPrefix\}\/2026\/\$\{padded\}`;?\s*\}/g,
    '// Standardized to sequential /26-27/ prefix'
  );
}

// 3. In AnkeVoucherController, update setVoucherType to also notify active voucher mode and update function key buttons
const oldCheckAllowed = `            // Check if current mode is allowed
            if (!cfg.allowedModes.includes(this.activeMode)) {
              this.switchVoucherMode(cfg.defaultMode, false);
            }`;

const newCheckAllowed = `            // Check if current mode is allowed
            if (!cfg.allowedModes.includes(this.activeMode)) {
              this.switchVoucherMode(cfg.defaultMode, false);
            } else {
              // Active mode is allowed; notify mode controller so calculation & UI adapt instantly
              if (this.activeMode === 'item-invoice' && window.AnkeItemInvoice) {
                if (typeof window.AnkeItemInvoice.recalculateItemInvoice === 'function') {
                  window.AnkeItemInvoice.recalculateItemInvoice();
                }
              } else if (this.activeMode === 'accounting-invoice' && window.AnkeAccountingInvoice) {
                if (typeof window.AnkeAccountingInvoice.recalculate === 'function') {
                  window.AnkeAccountingInvoice.recalculate();
                }
              } else if (this.activeMode === 'as-voucher' && window.AnkeAsVoucher) {
                if (typeof window.AnkeAsVoucher.onModeActivated === 'function') {
                  window.AnkeAsVoucher.onModeActivated();
                }
              } else if (this.activeMode === 'single-entry' && window.AnkeSingleEntry) {
                if (typeof window.AnkeSingleEntry.onModeActivated === 'function') {
                  window.AnkeSingleEntry.onModeActivated();
                }
              }
            }
            this.updateFunctionKeyButtons();`;

if (content.includes(oldCheckAllowed)) {
  content = content.replace(oldCheckAllowed, newCheckAllowed);
  console.log('Updated setVoucherType to notify active voucher mode');
}

// 4. Add cycleVoucherType and updateFunctionKeyButtons to AnkeVoucherController
const oldIsOpen = `          isOpen: function () {
            return voucherScreenContainer && !voucherScreenContainer.classList.contains('hidden');
          },`;

const newIsOpen = `          isOpen: function () {
            return voucherScreenContainer && !voucherScreenContainer.classList.contains('hidden');
          },
          cycleVoucherType: function () {
            const types = ['CONTRA', 'PAYMENT', 'RECEIPT', 'JOURNAL', 'SALES', 'PURCHASE'];
            const curIdx = types.indexOf(this.activeVoucherType);
            const nextIdx = (curIdx + 1) % types.length;
            this.setVoucherType(types[nextIdx]);
          },
          updateFunctionKeyButtons: function () {
            const keyMap = {
              CONTRA: 'F4',
              PAYMENT: 'F5',
              RECEIPT: 'F6',
              JOURNAL: 'F7',
              SALES: 'F8',
              PURCHASE: 'F9'
            };
            const activeKey = keyMap[this.activeVoucherType] || 'F8';
            document.querySelectorAll('.sidebar-shortcut-btn, .anke-fkey-btn').forEach(btn => {
              const k = btn.getAttribute('data-key');
              if (!k || !['F4','F5','F6','F7','F8','F9'].includes(k)) return;
              if (k === activeKey) {
                btn.classList.add('ring-2', 'ring-gold-500', 'bg-gold-500/20', 'text-gold-200');
              } else {
                btn.classList.remove('ring-2', 'ring-gold-500', 'bg-gold-500/20', 'text-gold-200');
              }
            });
          },`;

if (content.includes(oldIsOpen)) {
  content = content.replace(oldIsOpen, newIsOpen);
  console.log('Added cycleVoucherType and updateFunctionKeyButtons to AnkeVoucherController');
}

// 5. Wire #voucher-type-badge and #voucher-type-badge-container click listeners
const oldWireBadge = `        // Wire DOM event listeners for Universal Voucher Shell
        if (voucherBackBtn) voucherBackBtn.addEventListener('click', () => AnkeVoucherController.closeVoucherScreen());`;

const newWireBadge = `        // Wire DOM event listeners for Universal Voucher Shell
        if (voucherBackBtn) voucherBackBtn.addEventListener('click', () => AnkeVoucherController.closeVoucherScreen());
        if (voucherTypeBadge) voucherTypeBadge.addEventListener('click', () => AnkeVoucherController.cycleVoucherType());`;

if (content.includes(oldWireBadge)) {
  content = content.replace(oldWireBadge, newWireBadge);
  console.log('Wired voucherTypeBadge click listener');
}

// 6. Wire sidebarButtons and anke-fkey-btn so clicking F4-F9 immediately calls shortcutActions
const oldSidebarWire = `        // Wire right sidebar items
        const sidebarButtons = document.querySelectorAll('.sidebar-shortcut-btn');
        sidebarButtons.forEach(function (btn) {
          btn.addEventListener('click', function () {
            const act = btn.getAttribute('data-action');
            if (shortcutActions[act]) shortcutActions[act]();
          });
        });`;

const newSidebarWire = `        // Wire right sidebar items and top ribbon function key buttons
        const keyActionMap = {
          'F2': 'f2-date',
          'F3': 'f3-company',
          'F4': 'f4-contra',
          'F5': 'f5-payment',
          'F6': 'f6-receipt',
          'F7': 'f7-journal',
          'F8': 'f8-sales',
          'F9': 'f9-purchase'
        };

        function handleShortcutButtonClick(btn) {
          const act = btn.getAttribute('data-action');
          const key = btn.getAttribute('data-key');
          const mappedAction = act || (key ? keyActionMap[key.toUpperCase()] : null);
          if (mappedAction && shortcutActions[mappedAction]) {
            shortcutActions[mappedAction]();
          }
        }

        const sidebarButtons = document.querySelectorAll('.sidebar-shortcut-btn');
        sidebarButtons.forEach(function (btn) {
          btn.addEventListener('click', function () {
            handleShortcutButtonClick(btn);
          });
        });

        const fkeyButtons = document.querySelectorAll('.anke-fkey-btn');
        fkeyButtons.forEach(function (btn) {
          btn.addEventListener('click', function () {
            handleShortcutButtonClick(btn);
          });
        });`;

if (content.includes(oldSidebarWire)) {
  content = content.replace(oldSidebarWire, newSidebarWire);
  console.log('Updated sidebar and fkey button click listeners with keyActionMap');
}

// 7. Dynamic UPI QR update for sidebar
// In recalculateItemInvoice, also update #voucher-sidebar-upi-qr
const oldUpiUpdate = `            const qrContainer = document.getElementById('item-invoice-upi-qr');
            if (qrContainer) {
              qrContainer.innerHTML = this.generateUpiSvg(totals.grandTotal, serial);
            }`;

const newUpiUpdate = `            const qrContainer = document.getElementById('item-invoice-upi-qr');
            const svgContent = this.generateUpiSvg(totals.grandTotal, serial);
            if (qrContainer) {
              qrContainer.innerHTML = svgContent;
            }
            const sidebarQr = document.getElementById('voucher-sidebar-upi-qr');
            if (sidebarQr) {
              sidebarQr.innerHTML = svgContent;
            }`;

if (content.includes(oldUpiUpdate)) {
  content = content.replace(oldUpiUpdate, newUpiUpdate);
  console.log('Updated UPI QR to sync with sidebar UPI preview');
}

// Write the updated file back
fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log('Successfully written updated index.html! Final length:', content.length);
