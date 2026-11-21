/**
 * Pure visitor registration, Mobile-ID authentication, Owner Lead Vault passcode,
 * webhook URL validation, and RFC 4180 CSV export logic for Anke Cloud OS.
 */

export interface RegisteredVisitor {
  id: string;
  fullName: string;
  mobile: string;
  address: string;
  passwordHash: string;
  /** Optional legacy field if pre-existing local records stored plaintext */
  password?: string;
  registeredAt: string;
}

export interface ActiveVisitorSession {
  id: string;
  fullName: string;
  mobile: string;
  address: string;
  role: 'user' | 'owner';
  loggedInAt: string;
}

export interface RegistrationInput {
  fullName: string;
  mobile: string;
  address: string;
  password: string;
}

export interface LoginInput {
  mobile: string;
  password: string;
}

export interface OwnerAuthConfig {
  ownerMobile?: string;
  ownerName?: string;
  ownerAddress?: string;
  ownerPasscodeHash?: string | null;
}

export const DEFAULT_OWNER_MOBILE = '9104253142';
export const DEFAULT_OWNER_NAME = 'Piyush Suthar';
export const DEFAULT_OWNER_ADDRESS = 'Karma Accounts, Deodar, Gujarat';

/**
 * Deterministic synchronous salted hash (dual 32-bit FNV-1a + avalanche mix)
 * for offline/static client-side credential verification without storing raw secrets.
 */
export function hashCredential(secret: string, salt: string): string {
  const input = `${salt}::anke-karma-v1::${secret}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + ((i + 1) * 31);
    h2 = Math.imul(h2, 0x85ebca6b);
    h2 ^= h2 >>> 13;
  }
  // Extra avalanche rounds
  h1 ^= h1 >>> 16;
  h1 = Math.imul(h1, 0x85ebca6b);
  h1 ^= h1 >>> 13;
  h2 ^= h2 >>> 16;
  h2 = Math.imul(h2, 0xc2b2ae35);
  h2 ^= h2 >>> 16;
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function createOwnerPasscodeHash(passcode: string): string {
  return hashCredential(String(passcode || '').trim(), 'owner-vault');
}

export const DEFAULT_OWNER_PASSCODE_HASH = createOwnerPasscodeHash(DEFAULT_OWNER_MOBILE);

/**
 * Normalizes an Indian mobile number input into digits.
 * Strips spaces, dashes, +91 prefix (when 12 digits), or leading 0 (when 11 digits).
 */
export function normalizeMobileNumber(raw: string): string {
  const digits = String(raw || '').replace(/\D+/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(1);
  }
  return digits;
}

export function isValidMobileNumber(mobile: string): boolean {
  return /^\d{10}$/.test(normalizeMobileNumber(mobile));
}

export function validateRegistrationInput(
  input: RegistrationInput,
  existingUsers: RegisteredVisitor[]
):
  | {
      ok: true;
      normalized: { fullName: string; mobile: string; address: string; password: string };
    }
  | {
      ok: false;
      code: 'INVALID_NAME' | 'INVALID_MOBILE' | 'DUPLICATE_MOBILE' | 'INVALID_ADDRESS' | 'INVALID_PASSWORD';
      field: 'fullName' | 'mobile' | 'address' | 'password';
      message: string;
    } {
  const fullName = String(input.fullName || '').trim();
  if (fullName.length < 2) {
    return {
      ok: false,
      code: 'INVALID_NAME',
      field: 'fullName',
      message: 'Please enter your full name (at least 2 characters).',
    };
  }

  const mobile = normalizeMobileNumber(input.mobile);
  if (!/^\d{10}$/.test(mobile)) {
    return {
      ok: false,
      code: 'INVALID_MOBILE',
      field: 'mobile',
      message: 'Please enter a valid 10-digit mobile number.',
    };
  }

  const duplicate = existingUsers.some((u) => normalizeMobileNumber(u.mobile) === mobile);
  if (duplicate) {
    return {
      ok: false,
      code: 'DUPLICATE_MOBILE',
      field: 'mobile',
      message: 'This mobile number is already registered. Please switch to User Login.',
    };
  }

  const address = String(input.address || '').trim();
  if (address.length < 3) {
    return {
      ok: false,
      code: 'INVALID_ADDRESS',
      field: 'address',
      message: 'Please enter your city or full business address.',
    };
  }

  const password = String(input.password || '');
  if (password.length < 4) {
    return {
      ok: false,
      code: 'INVALID_PASSWORD',
      field: 'password',
      message: 'Please create a password of at least 4 characters.',
    };
  }

  return {
    ok: true,
    normalized: { fullName, mobile, address, password },
  };
}

export function toPublicSession(
  user: Pick<RegisteredVisitor, 'id' | 'fullName' | 'mobile' | 'address'>,
  role: 'user' | 'owner',
  nowIso: string
): ActiveVisitorSession {
  return {
    id: user.id,
    fullName: user.fullName,
    mobile: user.mobile,
    address: user.address,
    role,
    loggedInAt: nowIso,
  };
}

export function registerVisitor(
  input: RegistrationInput,
  existingUsers: RegisteredVisitor[],
  nowIso: string = new Date().toISOString()
):
  | {
      ok: true;
      user: RegisteredVisitor;
      users: RegisteredVisitor[];
      session: ActiveVisitorSession;
    }
  | {
      ok: false;
      code: 'INVALID_NAME' | 'INVALID_MOBILE' | 'DUPLICATE_MOBILE' | 'INVALID_ADDRESS' | 'INVALID_PASSWORD';
      field: 'fullName' | 'mobile' | 'address' | 'password';
      message: string;
    } {
  const validation = validateRegistrationInput(input, existingUsers);
  if (!validation.ok) {
    return validation;
  }

  const { fullName, mobile, address, password } = validation.normalized;
  const user: RegisteredVisitor = {
    id: `USR-${mobile.slice(-4)}-${Date.parse(nowIso) || Date.now()}`,
    fullName,
    mobile,
    address,
    passwordHash: hashCredential(password, mobile),
    registeredAt: nowIso,
  };

  return {
    ok: true,
    user,
    users: [...existingUsers, user],
    session: toPublicSession(user, 'user', nowIso),
  };
}

export function authenticateVisitor(
  input: LoginInput,
  existingUsers: RegisteredVisitor[],
  ownerConfig: OwnerAuthConfig = {},
  nowIso: string = new Date().toISOString()
):
  | { ok: true; session: ActiveVisitorSession }
  | { ok: false; code: 'INVALID_MOBILE' | 'INVALID_PASSWORD' | 'INVALID_CREDENTIALS'; message: string } {
  const mobile = normalizeMobileNumber(input.mobile);
  if (!/^\d{10}$/.test(mobile)) {
    return {
      ok: false,
      code: 'INVALID_MOBILE',
      message: 'Enter a valid 10-digit mobile number.',
    };
  }

  const password = String(input.password || '');
  if (!password) {
    return {
      ok: false,
      code: 'INVALID_PASSWORD',
      message: 'Please enter your password.',
    };
  }

  const found = existingUsers.find((u) => normalizeMobileNumber(u.mobile) === mobile);
  if (found) {
    const matchesHash =
      typeof found.passwordHash === 'string' &&
      found.passwordHash.length > 0 &&
      found.passwordHash === hashCredential(password, mobile);
    const matchesLegacy = typeof found.password === 'string' && found.password === password;

    if (matchesHash || matchesLegacy) {
      return {
        ok: true,
        session: toPublicSession(
          found,
          mobile === (ownerConfig.ownerMobile || DEFAULT_OWNER_MOBILE) ? 'owner' : 'user',
          nowIso
        ),
      };
    }
  }

  // Master Owner fallback so owner can always enter from any browser
  const ownerMobile = normalizeMobileNumber(ownerConfig.ownerMobile || DEFAULT_OWNER_MOBILE);
  const expectedOwnerHash = ownerConfig.ownerPasscodeHash || DEFAULT_OWNER_PASSCODE_HASH;
  if (mobile === ownerMobile && createOwnerPasscodeHash(password) === expectedOwnerHash) {
    return {
      ok: true,
      session: {
        id: 'OWNER-KARMA',
        fullName: ownerConfig.ownerName || DEFAULT_OWNER_NAME,
        mobile: ownerMobile,
        address: ownerConfig.ownerAddress || DEFAULT_OWNER_ADDRESS,
        role: 'owner',
        loggedInAt: nowIso,
      },
    };
  }

  return {
    ok: false,
    code: 'INVALID_CREDENTIALS',
    message: found
      ? 'Incorrect password. Please try again.'
      : 'Mobile number not found. Please complete New Registration first.',
  };
}

export function verifyOwnerPasscode(candidate: string, storedPasscodeHash?: string | null): boolean {
  const trimmed = String(candidate || '').trim();
  if (!trimmed) return false;
  const targetHash = storedPasscodeHash || DEFAULT_OWNER_PASSCODE_HASH;
  return createOwnerPasscodeHash(trimmed) === targetHash;
}

/**
 * Validates optional Google Apps Script / HTTPS webhook URL.
 * Allows empty string (unset). Rejects non-HTTPS and local/private network addresses.
 */
export function isValidWebhookUrl(rawUrl: string): boolean {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '[::1]' ||
      host.endsWith('.local') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return false;
    }
    return host.includes('.');
  } catch {
    return false;
  }
}

function escapeCsvCell(value: string): string {
  let str = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // Prevent CSV/Excel formula injection (DDE / spreadsheet execution)
  if (/^[=+\-@\t]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates an RFC 4180 CSV string with UTF-8 BOM for Excel compatibility.
 * Never exports password or passwordHash fields.
 */
export function buildLeadsCsv(users: RegisteredVisitor[]): string {
  const header = ['Sr. No.', 'Registration Date & Time', 'Full Name', 'Mobile Number', 'Address'];
  const lines = [header.map(escapeCsvCell).join(',')];

  users.forEach((user, idx) => {
    const row = [
      String(idx + 1),
      String(user.registeredAt || ''),
      String(user.fullName || ''),
      normalizeMobileNumber(user.mobile),
      String(user.address || ''),
    ];
    lines.push(row.map(escapeCsvCell).join(','));
  });

  return '\uFEFF' + lines.join('\r\n');
}
