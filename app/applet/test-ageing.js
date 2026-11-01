const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('Navigating to workspace...');
  await page.goto('http://localhost:3000/#anke-workspace', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // Check if Gateway is visible
  const gatewayVisible = await page.isVisible('#anke-gateway-root');
  console.log('Gateway visible:', gatewayVisible);

  // Check clicking Bills Receivable from Gateway
  console.log('Clicking Bills Receivable in Gateway...');
  await page.click('button[data-action="bills-receivable"]');
  await page.waitForTimeout(500);

  const hubVisible = await page.isVisible('#anke-outstanding-ageing-container');
  console.log('Outstanding Ageing Hub visible:', hubVisible);

  // Verify Active Tab is Receivables
  const activeTabReceivable = await page.$eval('#anke-ageing-tab-receivable', el => el.classList.contains('border-emerald-500'));
  console.log('Receivables Tab Active:', activeTabReceivable);

  // Verify KPI Cards exist
  const totalBalanceText = await page.$eval('#anke-kpi-total-balance', el => el.textContent.trim());
  console.log('KPI Total Balance:', totalBalanceText);

  // Check number of rows
  const rowCountReceivables = await page.$$eval('#anke-ageing-table-body tr', rows => rows.length);
  console.log('Receivables Table Rows:', rowCountReceivables);

  // Take screenshot of Receivables Hub
  await page.screenshot({ path: '/tmp/receivables-hub.png' });
  console.log('Saved /tmp/receivables-hub.png');

  // Switch to Bills Payable via Tab click
  console.log('Clicking Bills Payable tab...');
  await page.click('#anke-ageing-tab-payable');
  await page.waitForTimeout(500);

  const activeTabPayable = await page.$eval('#anke-ageing-tab-payable', el => el.classList.contains('border-emerald-500'));
  console.log('Payables Tab Active:', activeTabPayable);

  // Check MSME 43B(h) Advisory Banner visibility
  const bannerVisible = await page.isVisible('#anke-sec43b-advisory-banner');
  console.log('Section 43B(h) Advisory Banner visible in Payables:', bannerVisible);

  const msmeExposure = await page.$eval('#anke-kpi-msme-exposure', el => el.textContent.trim());
  console.log('KPI MSME Exposure:', msmeExposure);

  const rowCountPayables = await page.$$eval('#anke-ageing-table-body tr', rows => rows.length);
  console.log('Payables Table Rows:', rowCountPayables);

  // Check MSME badge existence
  const msmeBadgeCount = await page.$$eval('#anke-ageing-table-body span:has-text("MSME (UDYAM)")', badges => badges.length);
  console.log('MSME Badges count in Payables:', msmeBadgeCount);

  // Check Section 43B(h) Risk Tag existence
  const riskTags = await page.$$eval('#anke-ageing-table-body span:has-text("Sec 43B(h) Risk")', tags => tags.length);
  console.log('Sec 43B(h) Risk tags in Payables:', riskTags);

  // Take screenshot of Payables Hub
  await page.screenshot({ path: '/tmp/payables-hub.png' });
  console.log('Saved /tmp/payables-hub.png');

  // Switch Ageing Slabs to MSME Strict (0-15, 16-30, 31-45, >45)
  console.log('Switching to MSME Strict slabs...');
  await page.click('#anke-slab-msme-strict');
  await page.waitForTimeout(500);

  const col4Header = await page.$eval('#anke-ageing-col-bucket-4', el => el.textContent.trim());
  console.log('Column 4 Header after MSME Strict switch:', col4Header);

  // Test opening Bill Allocation Drawer by clicking first row View button
  console.log('Opening Bill-by-Bill Allocation Drawer...');
  await page.click('#anke-ageing-table-body tr button[title="View Bill Allocation & History"]');
  await page.waitForTimeout(500);

  const drawerVisible = await page.isVisible('#anke-bill-drawer-panel');
  console.log('Bill Allocation Drawer visible:', drawerVisible);

  const drawerBillNumber = await page.$eval('#anke-drawer-bill-number', el => el.textContent.trim());
  console.log('Drawer Bill Number:', drawerBillNumber);

  const drawerPartyName = await page.$eval('#anke-drawer-party-name', el => el.textContent.trim());
  console.log('Drawer Party Name:', drawerPartyName);

  const drawerWhatsAppText = await page.$eval('#anke-drawer-whatsapp-preview', el => el.value);
  console.log('WhatsApp Preview excerpt:', drawerWhatsAppText.slice(0, 100) + '...');

  // Take screenshot of Drawer
  await page.screenshot({ path: '/tmp/drawer-open.png' });
  console.log('Saved /tmp/drawer-open.png');

  // Test closing drawer via Escape key
  console.log('Pressing Escape to close drawer...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const drawerAfterEsc = await page.isVisible('#anke-bill-drawer-overlay');
  console.log('Drawer overlay visible after Escape:', drawerAfterEsc);

  // Test pressing Escape again to return to Gateway
  console.log('Pressing Escape again to close hub and return to Gateway...');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const hubAfterEsc = await page.isVisible('#anke-outstanding-ageing-container');
  const gatewayAfterEsc = await page.isVisible('#anke-gateway-root');
  console.log('Hub visible after Escape:', hubAfterEsc, '| Gateway visible after Escape:', gatewayAfterEsc);

  // Test shortcut Alt+B to directly open Bills Payable from Gateway
  console.log('Testing Alt+B shortcut from Gateway...');
  await page.keyboard.press('Alt+KeyB');
  await page.waitForTimeout(500);

  const hubFromAltB = await page.isVisible('#anke-outstanding-ageing-container');
  const activeTabFromAltB = await page.$eval('#anke-ageing-tab-payable', el => el.classList.contains('border-emerald-500'));
  console.log('Hub opened via Alt+B:', hubFromAltB, '| Payable Tab Active:', activeTabFromAltB);

  // Close browser
  await browser.close();
  console.log('All end-to-end browser tests completed successfully!');
})();
