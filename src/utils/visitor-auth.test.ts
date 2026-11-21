import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMobileNumber,
  isValidMobileNumber,
  validateRegistrationInput,
  registerVisitor,
  authenticateVisitor,
  verifyOwnerPasscode,
  createOwnerPasscodeHash,
  isValidWebhookUrl,
  buildLeadsCsv,
  DEFAULT_OWNER_MOBILE,
} from './visitor-auth.ts';

describe('visitor-auth utilities', () => {
  it('normalizes 10-digit Indian mobile numbers cleanly', () => {
    assert.equal(normalizeMobileNumber(' 98765-43210 '), '9876543210');
    assert.equal(normalizeMobileNumber('+91 98765 43210'), '9876543210');
    assert.equal(normalizeMobileNumber('09876543210'), '9876543210');
    assert.equal(isValidMobileNumber('9876543210'), true);
    assert.equal(isValidMobileNumber('98765'), false);
    assert.equal(isValidMobileNumber('abcdefghij'), false);
  });

  it('validates all 4 registration fields and blocks duplicate mobiles', () => {
    const badName = validateRegistrationInput(
      { fullName: 'A', mobile: '9876543210', address: 'Deodar', password: 'pass' },
      []
    );
    assert.equal(badName.ok, false);
    if (!badName.ok) assert.equal(badName.code, 'INVALID_NAME');

    const badMobile = validateRegistrationInput(
      { fullName: 'Rameshbhai Patel', mobile: '12345', address: 'Deodar', password: 'pass' },
      []
    );
    assert.equal(badMobile.ok, false);
    if (!badMobile.ok) assert.equal(badMobile.code, 'INVALID_MOBILE');

    const badAddress = validateRegistrationInput(
      { fullName: 'Rameshbhai Patel', mobile: '9876543210', address: ' ', password: 'pass' },
      []
    );
    assert.equal(badAddress.ok, false);
    if (!badAddress.ok) assert.equal(badAddress.code, 'INVALID_ADDRESS');

    const badPass = validateRegistrationInput(
      { fullName: 'Rameshbhai Patel', mobile: '9876543210', address: 'Deodar', password: '123' },
      []
    );
    assert.equal(badPass.ok, false);
    if (!badPass.ok) assert.equal(badPass.code, 'INVALID_PASSWORD');

    const first = registerVisitor(
      {
        fullName: 'Rameshbhai Patel',
        mobile: '+91 98765 43210',
        address: 'Main Bazaar, Deodar, Gujarat',
        password: 'karma2026',
      },
      [],
      '2026-11-21T10:00:00.000Z'
    );
    assert.equal(first.ok, true);
    if (!first.ok) return;

    assert.equal(first.user.mobile, '9876543210');
    assert.equal('password' in first.session, false);
    assert.equal('passwordHash' in first.session, false);

    const dup = registerVisitor(
      {
        fullName: 'Another User',
        mobile: '9876543210',
        address: 'Palanpur',
        password: 'other',
      },
      first.users,
      '2026-11-21T10:05:00.000Z'
    );
    assert.equal(dup.ok, false);
    if (!dup.ok) assert.equal(dup.code, 'DUPLICATE_MOBILE');
  });

  it('authenticates registered visitors and Master Owner from any device', () => {
    const reg = registerVisitor(
      {
        fullName: 'Rameshbhai Patel',
        mobile: '9876543210',
        address: 'Deodar, Banaskantha',
        password: 'secret123',
      },
      [],
      '2026-11-21T10:00:00.000Z'
    );
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const okLogin = authenticateVisitor({ mobile: '9876543210', password: 'secret123' }, reg.users);
    assert.equal(okLogin.ok, true);
    if (okLogin.ok) {
      assert.equal(okLogin.session.fullName, 'Rameshbhai Patel');
      assert.equal(okLogin.session.role, 'user');
    }

    const wrongPass = authenticateVisitor({ mobile: '9876543210', password: 'wrong' }, reg.users);
    assert.equal(wrongPass.ok, false);

    // Master Owner login works even when registered users list is empty
    const ownerLogin = authenticateVisitor(
      { mobile: DEFAULT_OWNER_MOBILE, password: DEFAULT_OWNER_MOBILE },
      []
    );
    assert.equal(ownerLogin.ok, true);
    if (ownerLogin.ok) {
      assert.equal(ownerLogin.session.role, 'owner');
      assert.equal(ownerLogin.session.mobile, DEFAULT_OWNER_MOBILE);
    }

    // Updated owner passcode works for Master Owner login too
    const customOwnerHash = createOwnerPasscodeHash('piyush#99');
    const ownerCustomLogin = authenticateVisitor(
      { mobile: DEFAULT_OWNER_MOBILE, password: 'piyush#99' },
      [],
      { ownerPasscodeHash: customOwnerHash }
    );
    assert.equal(ownerCustomLogin.ok, true);
  });

  it('verifies default and updated Owner Lead Vault passcode', () => {
    assert.equal(verifyOwnerPasscode(DEFAULT_OWNER_MOBILE), true);
    assert.equal(verifyOwnerPasscode('0000000000'), false);

    const customHash = createOwnerPasscodeHash('karma-admin-2026');
    assert.equal(verifyOwnerPasscode('karma-admin-2026', customHash), true);
    assert.equal(verifyOwnerPasscode(DEFAULT_OWNER_MOBILE, customHash), false);
  });

  it('validates optional HTTPS webhook URLs and blocks unsafe schemes/hosts', () => {
    assert.equal(isValidWebhookUrl(''), true);
    assert.equal(
      isValidWebhookUrl('https://script.google.com/macros/s/AKfycbx12345/exec'),
      true
    );
    assert.equal(isValidWebhookUrl('http://script.google.com/macros/s/abc/exec'), false);
    assert.equal(isValidWebhookUrl('javascript:alert(1)'), false);
    assert.equal(isValidWebhookUrl('https://localhost:3000/hook'), false);
    assert.equal(isValidWebhookUrl('https://127.0.0.1/hook'), false);
    assert.equal(isValidWebhookUrl('https://192.168.1.5/hook'), false);
  });

  it('builds formula-safe RFC 4180 CSV without exposing credentials', () => {
    const csv = buildLeadsCsv([
      {
        id: 'USR-1',
        fullName: '=HYPERLINK("http://evil.com","Click")',
        mobile: '9876543210',
        address: 'Shop 4, "Main Road"\nDeodar, Gujarat',
        passwordHash: 'deadbeef12345678',
        registeredAt: '2026-11-21T10:00:00.000Z',
      },
    ]);
    assert.equal(csv.startsWith('\uFEFF'), true);
    assert.equal(csv.includes('deadbeef12345678'), false);
    assert.equal(csv.includes(`"'=HYPERLINK(""http://evil.com"",""Click"")"`), true);
    assert.equal(csv.includes(`"Shop 4, ""Main Road""\nDeodar, Gujarat"`), true);
  });
});
