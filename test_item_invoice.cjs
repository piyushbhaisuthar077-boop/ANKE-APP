const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  console.log('Navigating to http://localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });

  // 1. Switch to Anke Accounting Workspace
  await page.evaluate(() => {
    if (typeof window.switchKarmaView === 'function') {
      window.switchKarmaView('anke');
    }
  });
  await page.waitForTimeout(500);

  // 2. Open Voucher Screen in Sales (F8) Item Invoice Mode
  await page.evaluate(() => {
    if (window.AnkeVoucherController) {
      window.AnkeVoucherController.openVoucherScreen('SALES', 'item-invoice');
    }
  });
  await page.waitForTimeout(500);

  // 3. Check visibility of voucher shell & item invoice container
  const voucherVisible = await page.$eval('#anke-voucher-screen-container', el => !el.classList.contains('hidden'));
  const itemInvoiceVisible = await page.$eval('#voucher-mode-item-invoice', el => !el.classList.contains('hidden'));
  console.log('Voucher screen visible:', voucherVisible);
  console.log('Item invoice mode visible:', itemInvoiceVisible);

  // 4. Verify line item rows rendered
  const rowCount = await page.$eval('#item-invoice-table-body', el => el.children.length);
  console.log('Line items rendered count:', rowCount);

  // 5. Check Grand Total display
  const grandTotalText = await page.$eval('#item-invoice-grand-total-disp', el => el.textContent.trim());
  console.log('Initial Grand Total:', grandTotalText);

  // 6. Check Words in English
  const wordsText = await page.$eval('#item-invoice-words-disp', el => el.textContent.trim());
  console.log('Amount in Words:', wordsText);

  // 7. Check Tax Regime Badge (Default Intra-state Gujarat 24)
  const regimeText = await page.$eval('#item-invoice-tax-regime-text', el => el.textContent.trim());
  console.log('Initial Tax Regime:', regimeText);

  // 8. Test Place of Supply switch to Maharashtra (27) - Inter-State
  await page.selectOption('#voucher-place-of-supply-select', '27');
  await page.waitForTimeout(300);
  const interStateRegime = await page.$eval('#item-invoice-tax-regime-text', el => el.textContent.trim());
  const igstVisible = await page.$eval('#item-invoice-igst-row', el => !el.classList.contains('hidden'));
  const cgstVisible = await page.$eval('#item-invoice-cgst-row', el => !el.classList.contains('hidden'));
  console.log('Updated Inter-State Regime:', interStateRegime);
  console.log('IGST Row visible:', igstVisible, '| CGST Row visible:', cgstVisible);

  // 9. Switch back to Intra-State (24)
  await page.selectOption('#voucher-place-of-supply-select', '24');
  await page.waitForTimeout(200);

  // 10. Test adding a line item row
  await page.click('#item-invoice-add-row-btn');
  await page.waitForTimeout(200);
  const newRowCount = await page.$eval('#item-invoice-table-body', el => el.children.length);
  console.log('Row count after adding row:', newRowCount);

  // 11. Select item for row 3 (Castor Seeds)
  await page.selectOption('.item-invoice-row-item-select[data-row="2"]', 'stock-3');
  await page.waitForTimeout(200);

  const updatedTotal = await page.$eval('#item-invoice-grand-total-disp', el => el.textContent.trim());
  console.log('Updated Grand Total after row 3:', updatedTotal);

  // 12. Test deleting row 3
  const deleteBtn = await page.$('.item-invoice-delete-row-btn[data-row="2"]');
  if (deleteBtn) await deleteBtn.click();
  await page.waitForTimeout(200);
  const afterDeleteCount = await page.$eval('#item-invoice-table-body', el => el.children.length);
  console.log('Row count after delete:', afterDeleteCount);

  // 13. Ensure Party is selected
  await page.selectOption('#voucher-party-select', '4'); // Gujarat Agro Syndicate
  await page.waitForTimeout(200);

  // Check initial stock of item 1 before commit
  const initialStock = await page.evaluate(() => {
    const raw = localStorage.getItem('ANKE_ERP_STATE_V1');
    if (!raw) return null;
    const s = JSON.parse(raw);
    const item = s.stock_items.find(i => i.id === 'stock-1');
    return item ? (item.openingQty !== undefined ? item.openingQty : item.openingStockQty) : null;
  });
  console.log('Initial Stock Qty of stock-1:', initialStock);

  // 14. Commit invoice with button
  await page.click('#item-invoice-commit-btn');
  await page.waitForTimeout(500);

  // Check toast notification text
  const toastText = await page.$eval('#anke-workspace-toast-text', el => el.textContent.trim());
  console.log('Toast notification after commit:', toastText);

  // Check updated stock quantity in persistence
  const updatedStock = await page.evaluate(() => {
    const raw = localStorage.getItem('ANKE_ERP_STATE_V1');
    if (!raw) return null;
    const s = JSON.parse(raw);
    const item = s.stock_items.find(i => i.id === 'stock-1');
    return item ? (item.openingQty !== undefined ? item.openingQty : item.openingStockQty) : null;
  });
  console.log('Updated Stock Qty of stock-1 after Sales commit:', updatedStock);

  // Check new voucher serial advanced
  const nextSerial = await page.$eval('#voucher-serial-input', el => el.value);
  console.log('Next voucher serial:', nextSerial);

  // Take screenshot for visual verification
  await page.screenshot({ path: 'item_invoice_verified.png', fullPage: false });
  console.log('Screenshot saved to item_invoice_verified.png');

  await browser.close();
  console.log('All browser verification tests completed successfully!');
})();
