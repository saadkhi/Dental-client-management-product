import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { put, del } from '@vercel/blob';

import * as db from './src/server/db/database.js';
import type { User, UserRole } from './src/types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── SEC-01: Fail hard if JWT_SECRET missing in production ────────────────────
const IS_PROD    = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET ?? (IS_PROD
  ? (() => { console.error('FATAL: JWT_SECRET must be set in production. Refusing to start.'); process.exit(1); })()!
  : 'mds-clinic-dev-secret-change-me');

const JWT_EXPIRY = '12h';
const API_PORT   = IS_PROD ? (Number(process.env.PORT) || 3000) : 3001;

// ─── IP extraction helper ─────────────────────────────────────────────────────
// With `trust proxy` enabled in production, Express sets req.ip to the correct
// client IP after stripping trusted proxy hops from X-Forwarded-For.
function getClientIp(req: express.Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

// SEC-06: Minimise JWT payload — only id + role; name/email are fetched from DB on each request
function signToken(user: User): string {
  return jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function setAuthCookie(res: express.Response, token: string) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'strict',
    maxAge: 12 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookie(res: express.Response) {
  res.clearCookie('auth_token', { path: '/' });
}

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.cookies?.auth_token;
  if (!token) {
    return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await db.getUserById(payload.id);
    if (!user || !user.isActive) {
      clearAuthCookie(res);
      return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Session expired or account deactivated' } });
    }
    (req as any).currentUser = user;
    next();
  } catch {
    clearAuthCookie(res);
    return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'Invalid session' } });
  }
}

function currentUser(req: express.Request): User {
  return (req as any).currentUser as User;
}

// ─── Role-Based Access Control ────────────────────────────────────────────────
// DOCTOR role exists in the schema but is not yet used for login/access.
// All authenticated users are either ADMIN or RECEPTIONIST. The role guard is
// applied to admin-only and receptionist-write endpoints explicitly.
function requireRole(...roles: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const user = currentUser(req);
    if (!roles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: `This action requires one of: ${roles.join(', ')}` }
      });
    }
    next();
  };
}

// ─── SEC-02: Simple in-memory rate limiter for login ─────────────────────────
// Keyed by IP. Allows 15 attempts per 15-minute window.
// Note: in a multi-instance (Vercel) deployment this is per-instance; for
// production use an external store (Redis/Upstash). The in-process version
// still protects against single-instance brute-force attacks.
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_WINDOW_MS    = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 15;

// ISSUE-004: Periodically evict expired entries so the Map does not grow
// indefinitely in a long-running process. Run every window interval.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of loginAttempts) {
    if (now >= entry.resetAt) loginAttempts.delete(ip);
  }
}, LOGIN_WINDOW_MS).unref(); // .unref() so this timer does not keep the process alive

function loginRateLimiter(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (entry && now < entry.resetAt) {
    if (entry.count >= LOGIN_MAX_ATTEMPTS) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSecs);
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: `Too many login attempts. Please wait ${Math.ceil(retryAfterSecs / 60)} minute(s) before trying again.`
        }
      });
    }
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  }

  (req as any)._loginIp = ip;
  next();
}

function clearLoginAttempts(req: express.Request) {
  const ip = (req as any)._loginIp;
  if (ip) loginAttempts.delete(ip);
}

// ─── Validation helpers ───────────────────────────────────────────────────────
function validateString(val: any, name: string, maxLen = 500): string {
  if (typeof val !== 'string' || !val.trim()) {
    throw Object.assign(new Error(`${name} is required and must be a non-empty string.`), { status: 400 });
  }
  if (val.length > maxLen) {
    throw Object.assign(new Error(`${name} must be at most ${maxLen} characters.`), { status: 400 });
  }
  return val.trim();
}

function validateDate(val: any, name: string): string {
  if (typeof val !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    throw Object.assign(new Error(`${name} must be a date in YYYY-MM-DD format.`), { status: 400 });
  }
  return val;
}

function validatePatientBody(body: any) {
  validateString(body.firstName, 'firstName');
  validateString(body.lastName,  'lastName');
  validateString(body.phone,     'phone', 30);
  validateDate(body.dateOfBirth, 'dateOfBirth');
  if (!['MALE', 'FEMALE', 'OTHER'].includes(body.gender)) {
    throw Object.assign(new Error('gender must be MALE, FEMALE, or OTHER.'), { status: 400 });
  }
}

function validateAppointmentBody(body: any) {
  validateString(body.patientId,     'patientId', 100);
  validateString(body.doctorId,      'doctorId',  100);
  validateDate(body.appointmentDate, 'appointmentDate');
  if (typeof body.startTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.startTime)) {
    throw Object.assign(new Error('startTime must be in HH:mm format.'), { status: 400 });
  }
  if (typeof body.endTime !== 'string' || !/^\d{2}:\d{2}$/.test(body.endTime)) {
    throw Object.assign(new Error('endTime must be in HH:mm format.'), { status: 400 });
  }
  if (body.startTime >= body.endTime) {
    throw Object.assign(new Error('endTime must be after startTime.'), { status: 400 });
  }
}

function validateDoctorBody(body: any) {
  validateString(body.fullName,       'fullName');
  validateString(body.specialization, 'specialization');
  validateString(body.licenseNumber,  'licenseNumber', 100);
  validateString(body.phone,          'phone', 30);
}

// ISSUE-013: Validation for previously unvalidated mutation endpoints
function validateTreatmentBody(body: any) {
  validateString(body.treatmentName, 'treatmentName');
  validateString(body.patientId,     'patientId', 100);
  validateString(body.doctorId,      'doctorId',  100);
}

function validateVisitBody(body: any) {
  validateString(body.patientId, 'patientId', 100);
  validateString(body.doctorId,  'doctorId',  100);
  validateDate(body.visitDate,   'visitDate');
}

function validateAllergyBody(body: any) {
  validateString(body.allergen, 'allergen');
  if (body.severity && !['LOW', 'MEDIUM', 'HIGH', 'SEVERE'].includes(body.severity)) {
    throw Object.assign(new Error('severity must be LOW, MEDIUM, HIGH, or SEVERE.'), { status: 400 });
  }
}

function validateMedicationBody(body: any) {
  validateString(body.medicineName, 'medicineName');
  validateString(body.dosage,       'dosage');
  validateString(body.frequency,    'frequency');
}

function handleValidationError(err: any, res: express.Response) {
  const status = err.status ?? 500;
  return res.status(status).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();

// Trust the first proxy in production so req.ip resolves correctly
// and X-Forwarded-For cannot be forged by clients to bypass rate limiting.
if (IS_PROD) {
  app.set('trust proxy', 1);
}

// ─── HTTP security headers via helmet ────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      // Tailwind v4 uses inline styles for utilities; unsafe-inline is needed until
      // a nonce-based CSP approach is implemented.
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"],
      baseUri:    ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: IS_PROD ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ─── CSRF: Validate Origin on all state-changing API requests ─────────────────
// sameSite:'strict' on the cookie + Origin header check gives double CSRF protection.
// ISSUE-006 FIX: use exact URL match instead of substring .includes() to prevent
// an attacker at evil-myhost.com from bypassing the check against myhost.com.
const ALLOWED_ORIGINS = IS_PROD
  ? [process.env.ALLOWED_ORIGIN ?? ''].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use((req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && req.path.startsWith('/api/')) {
    const origin = req.headers.origin ?? '';
    const host   = req.headers.host ?? '';

    // No Origin header means same-origin request (browser same-origin omits Origin).
    if (!origin) return next();

    // Build the expected origin from the Host header for exact comparison.
    const proto          = IS_PROD ? 'https' : 'http';
    const expectedOrigin = `${proto}://${host}`;
    const isSameHost     = origin === expectedOrigin;
    const isAllowed      = ALLOWED_ORIGINS.some(o => origin === o);

    if (!isSameHost && !isAllowed && IS_PROD) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cross-origin request not allowed' } });
    }
  }
  next();
});

// ─── Content-Type enforcement on API mutation routes ─────────────────────────
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.path.startsWith('/api/') && req.headers['content-length'] !== '0') {
    if (!req.is('application/json') && req.headers['content-length']) {
      return res.status(415).json({ success: false, error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Content-Type must be application/json' } });
    }
  }
  next();
});

// Limit JSON body to 1 MB to prevent payload attacks
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Dev-only CORS — never runs in production
if (!IS_PROD) {
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    next();
  });
  app.options('*', (_req, res) => res.sendStatus(204));
}

// ─── Public auth routes ───────────────────────────────────────────────────────

app.get('/api/auth/me', async (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.json({ success: true, data: { user: null } });
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string };
    const user = await db.getUserById(payload.id);
    return res.json({ success: true, data: { user: user || null } });
  } catch {
    clearAuthCookie(res);
    return res.json({ success: true, data: { user: null } });
  }
});

app.post('/api/auth/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Username and password are required' } });
    }
    const user = await db.verifyUserPassword(username, password);
    if (!user) {
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    }
    clearLoginAttempts(req);
    await db.updateUserLastLogin(user.id);
    const token = signToken(user);
    setAuthCookie(res, token);
    await db.logAudit({
      userId: user.id, userName: user.name, userRole: user.role,
      action: 'USER_LOGIN', entityType: 'USER', entityId: user.id, entityName: user.name,
      ipAddress: getClientIp(req),
    });
    return res.json({ success: true, data: { user } });
  } catch (err: any) {
    console.error('[login] error:', err.message);
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.get('/api/public/clinic', async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: { clinicName: settings.clinicName, tagline: settings.tagline } });
  } catch {
    res.json({ success: true, data: { clinicName: '', tagline: '' } });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// ISSUE-005 FIX: change-password verifies by user ID (via verifyUserPasswordById),
// not by name — name is not unique and could match the wrong account.
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const cu = currentUser(req);
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: { message: 'currentPassword and newPassword are required.' } });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, error: { message: 'New password must be at least 8 characters.' } });
    }
    // Verify current password by user ID, not by name
    const verified = await db.verifyUserPasswordById(cu.id, currentPassword);
    if (!verified) {
      return res.status(401).json({ success: false, error: { message: 'Current password is incorrect.' } });
    }
    await db.changeUserPassword(cu.id, newPassword, cu.name);
    await db.logAudit({
      userId: cu.id, userName: cu.name, userRole: cu.role,
      action: 'PASSWORD_CHANGED', entityType: 'USER', entityId: cu.id, entityName: cu.name,
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ─── Protected routes gate ────────────────────────────────────────────────────

app.use('/api', (req, res, next) => {
  const pub = [
    ['GET',  '/auth/me'],
    ['POST', '/auth/login'],
    ['POST', '/auth/logout'],
    ['GET',  '/public/clinic'],
  ];
  const isPublic = pub.some(([m, p]) => req.method === m && req.path === p);
  if (isPublic) return next();
  return requireAuth(req, res, next);
});

// ─── Users / Staff management ─────────────────────────────────────────────────
// Any authenticated user can list receptionists (needed for selection dropdowns)
app.get('/api/users/receptionists', async (_req, res) => {
  try {
    const users = await db.getReceptionists();
    res.json({ success: true, data: users });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// Only ADMIN can create / modify / delete receptionist accounts
app.post('/api/users/receptionists', requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Name, email, and password are required' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: { message: 'Password must be at least 8 characters.' } });
    }
    const cu = currentUser(req);
    const user = await db.createReceptionist({ name, email, password }, cu.id, cu.name, cu.role);
    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate');
    res.status(isDupe ? 409 : 500).json({ success: false, error: { message: isDupe ? 'Email already in use' : err.message } });
  }
});

app.put('/api/users/receptionists/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateReceptionist(req.params.id, req.body, cu.id, cu.name, cu.role);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receptionist not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate');
    res.status(isDupe ? 409 : 500).json({ success: false, error: { message: isDupe ? 'Email already in use' : err.message } });
  }
});

app.delete('/api/users/receptionists/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    if (req.params.id === currentUser(req).id) {
      return res.status(400).json({ success: false, error: { code: 'SELF_DELETE', message: 'You cannot delete your own account' } });
    }
    const cu = currentUser(req);
    const deleted = await db.deleteReceptionist(req.params.id, cu.id, cu.name, cu.role);
    if (!deleted) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Receptionist not found' } });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Patients ─────────────────────────────────────────────────────────────────

app.get('/api/patients', async (req, res) => {
  try {
    const search = (req.query.search as string) || '';
    // ISSUE-008 FIX: use Number.isFinite guard — parseInt('0') || 50 incorrectly
    // returned 50 because 0 is falsy. Number.isFinite is unambiguous.
    const rawLimit  = Number(req.query.limit);
    const rawOffset = Number(req.query.offset);
    const limit  = Math.min(Number.isFinite(rawLimit)  && rawLimit  > 0 ? Math.floor(rawLimit)  : 50, 200);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;
    const result = await db.getPatients(search, limit, offset);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/patients/:id', async (req, res) => {
  try {
    const patient = await db.getPatientById(req.params.id);
    if (!patient) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
    res.json({ success: true, data: patient });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/check-duplicate', async (req, res) => {
  try {
    const { firstName, lastName, phone, dateOfBirth } = req.body;
    if (!firstName || !lastName || !phone) return res.json({ success: true, data: { duplicates: [] } });
    const duplicates = await db.checkDuplicatePatient(firstName, lastName, phone, dateOfBirth || '');
    res.json({ success: true, data: { duplicates } });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-003: Patient creation restricted to ADMIN and RECEPTIONIST
app.post('/api/patients', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validatePatientBody(req.body);
    const cu = currentUser(req);
    const patient = await db.addPatient(req.body, cu.id, cu.name, getClientIp(req), cu.role);
    res.status(201).json({ success: true, data: patient });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } });
  }
});

// ISSUE-003: Patient updates restricted to ADMIN and RECEPTIONIST
app.put('/api/patients/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    // Normalise empty strings to null so nullable fields can be cleared
    const nullify = (v: any) => (v === '' ? null : v);
    const updates = {
      ...req.body,
      alternatePhone:           nullify(req.body.alternatePhone),
      email:                    nullify(req.body.email),
      address:                  nullify(req.body.address),
      emergencyContactName:     nullify(req.body.emergencyContactName),
      emergencyContactPhone:    nullify(req.body.emergencyContactPhone),
      emergencyContactRelation: nullify(req.body.emergencyContactRelation),
      occupation:               nullify(req.body.occupation),
      generalMedicalNotes:      nullify(req.body.generalMedicalNotes),
    };
    const updated = await db.updatePatient(req.params.id, updates, cu.id, cu.name, getClientIp(req), cu.role);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/patients/:id/medical-history', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    if (!req.body.condition) {
      return res.status(400).json({ success: false, error: { message: 'condition is required.' } });
    }
    const item = await db.addPatientMedicalHistory({ patientId: req.params.id, createdBy: cu.name, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-013: Validate allergy body
app.post('/api/patients/:id/allergies', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateAllergyBody(req.body);
    const item = await db.addPatientAllergy({ patientId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.delete('/api/patients/allergies/:allergyId', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    await db.deleteAllergy(req.params.allergyId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-013: Validate medication body
app.post('/api/patients/:id/medications', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateMedicationBody(req.body);
    const item = await db.addPatientMedication({ patientId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.post('/api/patients/:id/dental-chart', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { toothNumber, condition, notes } = req.body;
    if (!toothNumber || !condition) {
      return res.status(400).json({ success: false, error: { message: 'toothNumber and condition are required.' } });
    }
    const num = Number(toothNumber);
    if (!Number.isInteger(num) || num < 1 || num > 52) {
      return res.status(400).json({ success: false, error: { message: 'toothNumber must be an integer between 1 and 52.' } });
    }
    const VALID_CONDITIONS = [
      'HEALTHY', 'CARIES', 'FILLED', 'CROWN', 'ROOT_CANAL',
      'MISSING', 'IMPLANT', 'EXTRACTION_INDICATED', 'FRACTURED', 'BRIDGE',
    ];
    if (!VALID_CONDITIONS.includes(condition)) {
      return res.status(400).json({ success: false, error: { message: `condition must be one of: ${VALID_CONDITIONS.join(', ')}.` } });
    }
    const cu = currentUser(req);
    const item = await db.updateToothCondition(req.params.id, num, condition, notes, cu.name);
    res.json({ success: true, data: item });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Doctors ──────────────────────────────────────────────────────────────────

app.get('/api/doctors', async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const doctors = await db.getDoctors(includeInactive);
    res.json({ success: true, data: doctors });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/doctors/:id', async (req, res) => {
  try {
    const doc = await db.getDoctorById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
    const [availability, exceptions] = await Promise.all([
      db.getDoctorAvailability(doc.id),
      db.getDoctorExceptions(doc.id),
    ]);
    res.json({ success: true, data: { ...doc, availability, exceptions } });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-003: Doctor creation restricted to ADMIN and RECEPTIONIST
app.post('/api/doctors', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateDoctorBody(req.body);
    const cu = currentUser(req);
    const doc = await db.addDoctor(req.body, cu.id, cu.name, cu.role);
    res.status(201).json({ success: true, data: doc });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(400).json({ success: false, error: { code: 'CREATION_FAILED', message: err.message } });
  }
});

// ISSUE-003: Doctor updates restricted to ADMIN and RECEPTIONIST
app.put('/api/doctors/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateDoctor(req.params.id, req.body, cu.id, cu.name, cu.role);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-003: Doctor deletion restricted to ADMIN only
app.delete('/api/doctors/:id', requireRole('ADMIN'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const result = await db.deleteDoctor(req.params.id, cu.id, cu.name, cu.role);
    if (!result.success) {
      return res.status(409).json({ success: false, error: { code: 'DELETE_CONFLICT', message: result.error } });
    }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.put('/api/doctors/:id/availability', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    if (!Array.isArray(req.body.availability)) {
      return res.status(400).json({ success: false, error: { message: 'availability must be an array.' } });
    }
    await db.updateDoctorAvailability(req.params.id, req.body.availability);
    const availability = await db.getDoctorAvailability(req.params.id);
    res.json({ success: true, data: availability });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/doctors/:id/exceptions', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const ex = await db.addDoctorException({ doctorId: req.params.id, ...req.body });
    res.status(201).json({ success: true, data: ex });
  } catch (err: any) {
    const isDupe = err.message?.includes('unique') || err.message?.includes('duplicate') || err.message?.includes('uq_exception');
    res.status(isDupe ? 409 : 500).json({
      success: false,
      error: { message: isDupe ? 'An exception already exists for this doctor on that date. Please edit or delete the existing one.' : err.message }
    });
  }
});

app.delete('/api/doctors/exceptions/:exId', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    await db.deleteDoctorException(req.params.exId);
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Appointments ─────────────────────────────────────────────────────────────

app.get('/api/appointments', async (req, res) => {
  try {
    const filter = {
      date:      req.query.date      as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate:   req.query.endDate   as string | undefined,
      doctorId:  req.query.doctorId  as string | undefined,
      patientId: req.query.patientId as string | undefined,
      status:    req.query.status    as string | undefined,
    };
    const appointments = await db.getAppointments(filter);
    res.json({ success: true, data: appointments });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/appointments/:id', async (req, res) => {
  try {
    const appt = await db.getAppointmentById(req.params.id);
    if (!appt) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    res.json({ success: true, data: appt });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/appointments/check-conflict', async (req, res) => {
  try {
    const { doctorId, appointmentDate, startTime, endTime, excludeAppointmentId } = req.body;
    if (!doctorId || !appointmentDate || !startTime || !endTime) {
      return res.status(400).json({ success: false, error: { message: 'doctorId, appointmentDate, startTime and endTime are required.' } });
    }
    const result = await db.checkAppointmentConflict(doctorId, appointmentDate, startTime, endTime, excludeAppointmentId);
    res.json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-003: Appointment creation restricted to ADMIN and RECEPTIONIST
app.post('/api/appointments', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateAppointmentBody(req.body);
    const allowOverride = req.body.allowOverride === true;
    const { allowOverride: _, ...apptData } = req.body;
    const cu = currentUser(req);
    apptData.createdBy = cu.name;
    const result = await db.createAppointment(apptData, allowOverride, cu.id, cu.name, cu.role);
    if (result.conflict) {
      return res.status(409).json({ success: false, error: { code: 'APPOINTMENT_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
    }
    res.status(201).json({ success: true, data: result.appointment });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.put('/api/appointments/:id/status', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ success: false, error: { message: 'status is required.' } });

    const VALID_TRANSITIONS: Record<string, string[]> = {
      SCHEDULED:   ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
      CONFIRMED:   ['ARRIVED', 'CANCELLED', 'NO_SHOW'],
      ARRIVED:     ['IN_PROGRESS', 'CANCELLED', 'NO_SHOW'],
      IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
      COMPLETED:   [],
      CANCELLED:   [],
      NO_SHOW:     [],
      RESCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED'],
    };
    const current = await db.getAppointmentById(req.params.id);
    if (!current) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
    const allowed = VALID_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS_TRANSITION',
          message: `Cannot transition appointment from "${current.status}" to "${status}". Allowed next states: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}.`
        }
      });
    }

    const cu = currentUser(req);
    const updated = await db.updateAppointmentStatus(req.params.id, status, cu.id, cu.name, cu.role);
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/appointments/:id/reschedule', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { newDate, newStartTime, newEndTime, reason, allowOverride } = req.body;
    if (!newDate || !newStartTime || !newEndTime) {
      return res.status(400).json({ success: false, error: { message: 'newDate, newStartTime, and newEndTime are required.' } });
    }
    const cu = currentUser(req);
    const result = await db.rescheduleAppointment(
      req.params.id, newDate, newStartTime, newEndTime,
      reason || 'Patient request', allowOverride === true, cu.id, cu.name, cu.role
    );
    if (result.conflict) {
      return res.status(409).json({ success: false, error: { code: 'RESCHEDULE_CONFLICT', message: result.conflict.conflictReason, details: result.conflict } });
    }
    res.json({ success: true, data: result.appointment });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Visits ───────────────────────────────────────────────────────────────────

app.get('/api/visits', async (req, res) => {
  try {
    const visits = await db.getVisits(req.query.patientId as string | undefined);
    res.json({ success: true, data: visits });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-013: Validate visit body
app.post('/api/visits', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateVisitBody(req.body);
    const cu = currentUser(req);
    const visit = await db.createVisit(req.body, cu.id, cu.name, cu.role);
    res.status(201).json({ success: true, data: visit });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

// ─── Treatments ───────────────────────────────────────────────────────────────

app.get('/api/treatments', async (req, res) => {
  try {
    const treatments = await db.getTreatments(
      req.query.patientId as string | undefined,
      req.query.doctorId  as string | undefined
    );
    res.json({ success: true, data: treatments });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-013: Validate treatment body; ISSUE-003: restrict to staff roles
app.post('/api/treatments', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    validateTreatmentBody(req.body);
    const cu = currentUser(req);
    const treatment = await db.createTreatment(req.body, cu.id, cu.name, cu.role);
    res.status(201).json({ success: true, data: treatment });
  } catch (err: any) {
    if (err.status === 400) return handleValidationError(err, res);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
});

app.put('/api/treatments/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateTreatment(req.params.id, req.body, cu.id, cu.name, cu.role);
    if (!updated) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Treatment not found' } });
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Prescriptions ────────────────────────────────────────────────────────────

app.get('/api/prescriptions', async (req, res) => {
  try {
    const rxList = await db.getPrescriptions({
      patientId: req.query.patientId as string | undefined,
      doctorId:  req.query.doctorId  as string | undefined,
    });
    res.json({ success: true, data: rxList });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.get('/api/prescriptions/:id', async (req, res) => {
  try {
    const rx = await db.getPrescriptionById(req.params.id);
    if (!rx) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Prescription not found' } });
    res.json({ success: true, data: rx });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ISSUE-003: Prescription creation restricted to ADMIN and RECEPTIONIST
app.post('/api/prescriptions', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { items, ...rxData } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: { code: 'ITEMS_REQUIRED', message: 'At least one medicine item is required' } });
    }
    if (!rxData.patientId || !rxData.doctorId) {
      return res.status(400).json({ success: false, error: { message: 'patientId and doctorId are required.' } });
    }
    const cu = currentUser(req);
    const result = await db.createPrescription(rxData, items, cu.id, cu.name, cu.role);
    res.status(201).json({ success: true, data: result });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Reminders ────────────────────────────────────────────────────────────────

app.get('/api/reminders', async (req, res) => {
  try {
    const reminders = await db.getReminders(req.query.patientId as string | undefined);
    res.json({ success: true, data: reminders });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/reminders/:id/send', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const reminder = await db.triggerManualReminder(req.params.id, cu.id, cu.name, cu.role);
    if (!reminder) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Reminder not found' } });
    res.json({ success: true, data: reminder });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Reports ──────────────────────────────────────────────────────────────────

app.get('/api/reports', async (req, res) => {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const startDate = (req.query.startDate as string) || today;
    const endDate   = (req.query.endDate   as string) || today;
    const doctorId  =  req.query.doctorId  as string | undefined;
    const reports = await db.getReports(startDate, endDate, doctorId);
    res.json({ success: true, data: reports });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Settings ─────────────────────────────────────────────────────────────────

app.get('/api/settings', async (_req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({ success: true, data: settings });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.put('/api/settings', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const updated = await db.updateSettings(req.body, cu.id, cu.name, cu.role);
    res.json({ success: true, data: updated });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Audit Logs ───────────────────────────────────────────────────────────────

app.get('/api/audit-logs', requireRole('ADMIN'), async (req, res) => {
  try {
    const rawLimit   = Number(req.query.limit);
    const limit      = Number.isFinite(rawLimit) ? Math.min(Math.max(1, rawLimit), 500) : 100;
    const entityType = req.query.entityType as string | undefined;
    const logs       = await db.getAuditLogs(limit, entityType);
    res.json({ success: true, data: logs });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

app.post('/api/audit-logs/print', async (req, res) => {
  try {
    const { documentType, documentId, patientName } = req.body;
    const cu = currentUser(req);
    await db.logAudit({
      userId: cu.id, userName: cu.name, userRole: cu.role,
      action: 'PRINT_DOCUMENT', entityType: 'DOCUMENT',
      entityId: documentId,
      entityName: `${documentType}${patientName ? ` — ${patientName}` : ''}`,
    });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Patient Trash / Soft-Delete / Restore / Hard-Delete ─────────────────────

// GET  /api/patients/trash  — list all trashed patients (ADMIN + RECEPTIONIST)
app.get('/api/patients/trash', requireRole('ADMIN', 'RECEPTIONIST'), async (_req, res) => {
  try {
    const patients = await db.getTrashedPatients();
    res.json({ success: true, data: patients });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// DELETE /api/patients/:id  — soft-delete (move to trash)
app.delete('/api/patients/:id', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const patient = await db.softDeletePatient(req.params.id, cu.id, cu.name, cu.role);
    if (!patient) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found or already in trash.' } });
    res.json({ success: true, data: patient });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// PATCH /api/patients/:id/restore  — restore from trash
app.patch('/api/patients/:id/restore', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const patient = await db.restorePatient(req.params.id, cu.id, cu.name, cu.role);
    if (!patient) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found in trash.' } });
    res.json({ success: true, data: patient });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// DELETE /api/patients/:id/permanent  — permanently delete one trashed patient (ADMIN only)
app.delete('/api/patients/:id/permanent', requireRole('ADMIN'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const deleted = await db.hardDeletePatient(req.params.id, cu.id, cu.name, cu.role);
    if (!deleted) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found in trash.' } });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// DELETE /api/patients/trash/empty  — permanently delete ALL trashed patients (ADMIN only)
app.delete('/api/patients/trash/empty', requireRole('ADMIN'), async (req, res) => {
  try {
    const cu = currentUser(req);
    const count = await db.emptyPatientTrash(cu.id, cu.name, cu.role);
    res.json({ success: true, data: { deleted: count } });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// ─── Patient X-Rays ───────────────────────────────────────────────────────────
// Accepted MIME types for X-ray uploads.
const ACCEPTED_XRAY_TYPES = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
  'image/webp', 'image/bmp', 'image/tiff',
  'application/dicom', 'application/octet-stream', // .dcm files
]);

// Magic-byte signatures for common image formats (first 4 bytes).
// Used as a second line of defence after MIME-type validation.
const MAGIC_BYTES: Array<{ type: string; bytes: number[] }> = [
  { type: 'image/jpeg',  bytes: [0xFF, 0xD8, 0xFF] },
  { type: 'image/png',   bytes: [0x89, 0x50, 0x4E, 0x47] },
  { type: 'image/gif',   bytes: [0x47, 0x49, 0x46] },
  { type: 'image/webp',  bytes: [0x52, 0x49, 0x46, 0x46] },
  { type: 'image/bmp',   bytes: [0x42, 0x4D] },
  { type: 'image/tiff',  bytes: [0x49, 0x49, 0x2A, 0x00] },  // little-endian
  { type: 'image/tiff',  bytes: [0x4D, 0x4D, 0x00, 0x2A] },  // big-endian
  { type: 'application/dicom', bytes: [] },                   // DICOM: no universal magic bytes; trust extension + mime
];

function detectMagicBytes(buf: Buffer): boolean {
  for (const sig of MAGIC_BYTES) {
    if (sig.bytes.length === 0) continue; // DICOM — skip magic-byte check
    if (sig.bytes.every((b, i) => buf[i] === b)) return true;
  }
  return false;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB per file
const MAX_FILES_PER_REQUEST = 10;

// Multer: store files in memory (never on disk — safe for serverless).
// Size limit is enforced here before the buffer is even read.
const xrayUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: MAX_FILES_PER_REQUEST },
  fileFilter: (_req, file, cb) => {
    // Normalise content-type: multer reads the Content-Type sent by the browser.
    const mime = file.mimetype.toLowerCase();
    // Accept any image/* MIME as well as the explicit DICOM types.
    if (mime.startsWith('image/') || ACCEPTED_XRAY_TYPES.has(mime) || file.originalname.toLowerCase().endsWith('.dcm')) {
      cb(null, true);
    } else {
      cb(new Error(`File type not accepted: ${file.mimetype}. Please upload images (JPEG, PNG, WEBP, GIF, BMP, TIFF) or DICOM files.`));
    }
  },
});

// GET  /api/patients/:id/xrays  — list all X-rays for a patient
app.get('/api/patients/:id/xrays', async (req, res) => {
  try {
    const xrays = await db.getPatientXRays(req.params.id);
    res.json({ success: true, data: xrays });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// POST /api/patients/:id/xrays  — upload one or more X-ray images
app.post(
  '/api/patients/:id/xrays',
  requireRole('ADMIN', 'RECEPTIONIST'),
  (req, res, next) => {
    // Run multer as middleware inside the route so errors are catchable.
    xrayUpload.array('files', MAX_FILES_PER_REQUEST)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ success: false, error: { code: 'FILE_TOO_LARGE', message: `Each file must be under ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.` } });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ success: false, error: { code: 'TOO_MANY_FILES', message: `Maximum ${MAX_FILES_PER_REQUEST} files per upload.` } });
        }
        return res.status(400).json({ success: false, error: { message: err.message } });
      }
      if (err) return res.status(400).json({ success: false, error: { message: err.message } });
      next();
    });
  },
  async (req, res) => {
    try {
      const files = req.files as Express.Multer.File[] | undefined;
      if (!files || files.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'NO_FILES', message: 'At least one file is required.' } });
      }

      // Verify the patient exists before uploading anything.
      const patientCheck = await db.getPatientById(req.params.id);
      if (!patientCheck) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found.' } });
      }

      const cu = currentUser(req);
      const notes   = typeof req.body.notes   === 'string' ? req.body.notes.trim().slice(0, 500)   : undefined;
      const takenAt = typeof req.body.takenAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.takenAt)
        ? req.body.takenAt : undefined;

      // Validate each file's content via magic bytes, then upload to Vercel Blob.
      const created = [];
      for (const file of files) {
        const mime = file.mimetype.toLowerCase();
        const isDicom = file.originalname.toLowerCase().endsWith('.dcm') || mime === 'application/dicom';
        // Skip magic-byte check for DICOM files (no universal signature).
        if (!isDicom && !detectMagicBytes(file.buffer)) {
          return res.status(400).json({
            success: false,
            error: { code: 'INVALID_FILE_CONTENT', message: `File "${file.originalname}" does not appear to be a valid image.` },
          });
        }

        // Upload to Vercel Blob. The pathname determines the URL structure.
        // We namespace by patient ID so files are logically grouped.
        const blobPathname = `xrays/${req.params.id}/${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const blob = await put(blobPathname, file.buffer, {
          access: 'public',
          contentType: file.mimetype,
        });

        const xray = await db.addPatientXRay({
          patientId:   req.params.id,
          filename:    file.originalname,
          blobUrl:     blob.url,
          contentType: file.mimetype,
          sizeBytes:   file.size,
          notes,
          takenAt,
          uploadedBy:  cu.name,
        });
        created.push(xray);
      }

      await db.logAudit({
        userId: cu.id, userName: cu.name, userRole: cu.role,
        action: 'XRAY_UPLOADED', entityType: 'XRAY',
        entityId: req.params.id,
        entityName: `${created.length} X-ray(s) for patient ${patientCheck.patientNumber}`,
      });

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      res.status(500).json({ success: false, error: { message: err.message } });
    }
  }
);

// DELETE /api/patients/xrays/:xrayId  — delete one X-ray
// The patientId is passed as a query param so the DB can verify ownership.
app.delete('/api/patients/:patientId/xrays/:xrayId', requireRole('ADMIN', 'RECEPTIONIST'), async (req, res) => {
  try {
    const { patientId, xrayId } = req.params;
    const result = await db.deletePatientXRay(xrayId, patientId);
    if (!result.found) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'X-ray not found or does not belong to this patient.' } });
    }
    // Remove the file from Vercel Blob storage.
    if (result.blobUrl) {
      await del(result.blobUrl);
    }
    const cu = currentUser(req);
    await db.logAudit({
      userId: cu.id, userName: cu.name, userRole: cu.role,
      action: 'XRAY_DELETED', entityType: 'XRAY',
      entityId: xrayId, entityName: `X-ray for patient ${patientId}`,
    });
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ success: false, error: { message: err.message } }); }
});

// ─── Production static file serving ──────────────────────────────────────────

if (IS_PROD) {
  const distPath = path.join(__dirname, 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

// ─── Global error handler — prevents stack trace leakage to clients ───────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server] Unhandled error:', err);
  const message = IS_PROD ? 'An internal error occurred.' : (err.message ?? 'Unknown error');
  res.status(err.status ?? 500).json({ success: false, error: { message } });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(API_PORT, () => {
  console.log(`🦷  MDS Clinic API → http://localhost:${API_PORT}`);
  console.log(`   Mode: ${IS_PROD ? 'production' : 'development (Vite proxies /api from :3000)'}`);
});

export default app;
