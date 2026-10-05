/**
 * MDS Clinic (Mehmood Dental Surgeon) — Postgres Database Layer
 * All persistence now goes through Neon Postgres via the pool in connection.ts
 * Column names: snake_case in DB → camelCase in TypeScript (mapped explicitly)
 */

import { query, transaction } from './connection.js';
import {
  User,
  UserRole,
  Doctor,
  DoctorAvailability,
  DoctorScheduleException,
  Patient,
  PatientMedicalHistory,
  PatientAllergy,
  PatientMedication,
  DentalHistory,
  Appointment,
  Visit,
  Treatment,
  Prescription,
  PrescriptionItem,
  AppointmentReminder,
  ClinicSettings,
  AuditLog,
  ConflictCheckResult,
  PatientXRay,
} from '../../types/index.js';

// ─── Row → Domain mappers ──────────────────────────────────────────────────

function mapUser(r: any): User {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    isActive: r.is_active,
    mustChangePassword: r.must_change_password ?? false,
    lastLoginAt: r.last_login_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapDoctor(r: any): Doctor {
  return {
    id: r.id,
    userId: r.user_id,
    fullName: r.full_name,
    specialization: r.specialization,
    licenseNumber: r.license_number,
    phone: r.phone,
    email: r.email,
    profileImage: r.profile_image,
    bio: r.bio,
    color: r.color,
    isActive: r.is_active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAvailability(r: any): DoctorAvailability {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
    isAvailable: r.is_available,
  };
}

function mapException(r: any): DoctorScheduleException {
  return {
    id: r.id,
    doctorId: r.doctor_id,
    date: typeof r.date === 'string' ? r.date : r.date?.toISOString().slice(0, 10),
    startTime: r.start_time,
    endTime: r.end_time,
    reason: r.reason,
    isAvailable: r.is_available,
  };
}

function mapPatient(r: any): Patient {
  return {
    id: r.id,
    patientNumber: r.patient_number,
    firstName: r.first_name,
    lastName: r.last_name,
    dateOfBirth: typeof r.date_of_birth === 'string' ? r.date_of_birth : r.date_of_birth?.toISOString().slice(0, 10),
    gender: r.gender,
    phone: r.phone,
    alternatePhone: r.alternate_phone,
    email: r.email,
    address: r.address,
    emergencyContactName: r.emergency_contact_name,
    emergencyContactPhone: r.emergency_contact_phone,
    emergencyContactRelation: r.emergency_contact_relation,
    bloodGroup: r.blood_group,
    occupation: r.occupation,
    allergies: r.allergies,
    generalMedicalNotes: r.general_medical_notes,
    status: r.status,
    deletedAt: r.deleted_at ?? undefined,
    deletedBy: r.deleted_by ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapMedicalHistory(r: any): PatientMedicalHistory {
  return {
    id: r.id,
    patientId: r.patient_id,
    condition: r.condition,
    description: r.description,
    status: r.status,
    diagnosedAt: r.diagnosed_at ? (typeof r.diagnosed_at === 'string' ? r.diagnosed_at : r.diagnosed_at.toISOString().slice(0, 10)) : undefined,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAllergy(r: any): PatientAllergy {
  return {
    id: r.id,
    patientId: r.patient_id,
    allergen: r.allergen,
    reaction: r.reaction,
    severity: r.severity,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapMedication(r: any): PatientMedication {
  return {
    id: r.id,
    patientId: r.patient_id,
    medicineName: r.medicine_name,
    dosage: r.dosage,
    frequency: r.frequency,
    route: r.route,
    startDate: r.start_date ? (typeof r.start_date === 'string' ? r.start_date : r.start_date.toISOString().slice(0, 10)) : undefined,
    endDate: r.end_date ? (typeof r.end_date === 'string' ? r.end_date : r.end_date.toISOString().slice(0, 10)) : undefined,
    status: r.status,
    notes: r.notes,
    createdAt: r.created_at,
  };
}

function mapDentalHistory(r: any): DentalHistory {
  return {
    id: r.id,
    patientId: r.patient_id,
    toothNumber: r.tooth_number,
    condition: r.condition,
    diagnosis: r.diagnosis,
    treatment: r.treatment,
    notes: r.notes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function mapAppointment(r: any, patient?: Patient, doctor?: Doctor): Appointment {
  return {
    id: r.id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    appointmentDate: typeof r.appointment_date === 'string' ? r.appointment_date : r.appointment_date?.toISOString().slice(0, 10),
    startTime: r.start_time,
    endTime: r.end_time,
    durationMinutes: r.duration_minutes,
    appointmentType: r.appointment_type,
    status: r.status,
    reason: r.reason,
    notes: r.notes,
    originalAppointmentId: r.original_appointment_id,
    rescheduleReason: r.reschedule_reason,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    patient,
    doctor,
  };
}

function mapVisit(r: any, doctor?: Doctor, treatments?: Treatment[]): Visit {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    visitDate: typeof r.visit_date === 'string' ? r.visit_date : r.visit_date?.toISOString().slice(0, 10),
    chiefComplaint: r.chief_complaint,
    clinicalNotes: r.clinical_notes,
    diagnosis: r.diagnosis,
    treatmentSummary: r.treatment_summary,
    followUpDate: r.follow_up_date ? (typeof r.follow_up_date === 'string' ? r.follow_up_date : r.follow_up_date.toISOString().slice(0, 10)) : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    doctor,
    treatments,
  };
}

function mapTreatment(r: any, doctor?: Doctor, patient?: Patient): Treatment {
  return {
    id: r.id,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    appointmentId: r.appointment_id,
    visitId: r.visit_id,
    treatmentType: r.treatment_type,
    treatmentName: r.treatment_name,
    toothNumber: r.tooth_number,
    description: r.description,
    status: r.status,
    cost: r.cost !== null ? Number(r.cost) : undefined,
    startDate: r.start_date ? (typeof r.start_date === 'string' ? r.start_date : r.start_date.toISOString().slice(0, 10)) : undefined,
    completionDate: r.completion_date ? (typeof r.completion_date === 'string' ? r.completion_date : r.completion_date.toISOString().slice(0, 10)) : undefined,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    doctor,
    patient,
  };
}

function mapPrescription(r: any, items?: PrescriptionItem[], doctor?: Doctor, patient?: Patient): Prescription {
  return {
    id: r.id,
    rxNumber: r.rx_number,
    patientId: r.patient_id,
    doctorId: r.doctor_id,
    visitId: r.visit_id,
    prescriptionDate: typeof r.prescription_date === 'string' ? r.prescription_date : r.prescription_date?.toISOString().slice(0, 10),
    diagnosis: r.diagnosis,
    chiefComplaint: r.chief_complaint,
    instructions: r.instructions,
    followUpNotes: r.follow_up_notes,
    followUpDays: r.follow_up_days,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items,
    doctor,
    patient,
  };
}

function mapPrescriptionItem(r: any): PrescriptionItem {
  return {
    id: r.id,
    prescriptionId: r.prescription_id,
    medicineName: r.medicine_name,
    strength: r.strength,
    dosage: r.dosage,
    frequency: r.frequency,
    duration: r.duration,
    route: r.route,
    instructions: r.instructions,
  };
}

function mapReminder(r: any, patient?: Patient, appointment?: Appointment): AppointmentReminder {
  return {
    id: r.id,
    appointmentId: r.appointment_id,
    patientId: r.patient_id,
    type: r.type,
    channel: r.channel,
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    status: r.status,
    message: r.message,
    recipient: r.recipient,
    createdAt: r.created_at,
    patient,
    appointment,
  };
}

function mapSettings(r: any): ClinicSettings {
  const tpl = r.reminder_templates || {};
  return {
    id: r.id,
    clinicName: r.clinic_name,
    tagline: r.tagline,
    logoUrl: r.logo_url,
    addressLine1: r.address_line1,
    addressLine2: r.address_line2,
    city: r.city,
    state: r.state,
    zipCode: r.zip_code,
    // keep both spellings so existing components don't break
    address: [r.address_line1, r.address_line2, r.city, r.state].filter(Boolean).join(', '),
    phone: r.phone,
    alternatePhone: r.alternate_phone,
    emergencyPhone: r.emergency_phone,
    emergencyHelpline: r.emergency_helpline,
    email: r.email,
    website: r.website,
    registrationNumber: r.registration_number,
    taxId: r.tax_id,
    printHeader: r.print_header,
    printFooter: r.print_footer,
    defaultAppointmentDuration: r.default_appointment_duration,
    defaultSlotDurationMinutes: r.default_slot_duration_minutes,
    workingHoursStart: r.working_hours_start,
    workingHoursEnd: r.working_hours_end,
    operatingHoursStart: r.working_hours_start,
    operatingHoursEnd: r.working_hours_end,
    activeDays: r.active_days,
    currency: r.currency,
    currencySymbol: r.currency_symbol,
    timezone: r.timezone,
    reminderTemplates: {
      confirmation: tpl.confirmation || '',
      reminder: tpl.reminder || '',
      followup: tpl.followup || '',
    },
    updatedAt: r.updated_at,
  } as ClinicSettings;
}

function mapAuditLog(r: any): AuditLog {
  return {
    id: r.id,
    userId: r.user_id,
    userName: r.user_name,
    userRole: r.user_role,
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id,
    entityName: r.entity_name,
    oldValues: r.old_values,
    newValues: r.new_values,
    ipAddress: r.ip_address,
    createdAt: r.created_at,
  };
}

function mapXRay(r: any): PatientXRay {
  return {
    id: r.id,
    patientId: r.patient_id,
    filename: r.filename,
    blobUrl: r.blob_url,
    contentType: r.content_type,
    sizeBytes: r.size_bytes,
    notes: r.notes,
    takenAt: r.taken_at
      ? (typeof r.taken_at === 'string' ? r.taken_at : r.taken_at.toISOString().slice(0, 10))
      : undefined,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

// generateRxNumber is intentionally removed from module scope.
// The RX sequence counter is now incremented INSIDE createPrescription()'s
// transaction body to ensure atomicity (see ISSUE-007 fix).

// ─── Audit ──────────────────────────────────────────────────────────────────

export async function logAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
  const rows = await query<any>(
    `INSERT INTO audit_logs
       (user_id, user_name, user_role, action, entity_type, entity_id, entity_name, old_values, new_values, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      entry.userId ?? null,
      entry.userName,
      entry.userRole,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.entityName ?? null,
      entry.oldValues ?? null,
      entry.newValues ?? null,
      entry.ipAddress ?? null,
    ]
  );
  return mapAuditLog(rows[0]);
}

// ─── Users ──────────────────────────────────────────────────────────────────

export async function getUsers(): Promise<User[]> {
  const rows = await query('SELECT * FROM users ORDER BY role, name');
  return rows.map(mapUser);
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await query('SELECT * FROM users WHERE lower(email) = lower($1)', [email]);
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function updateUserLastLogin(id: string): Promise<void> {
  await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
}

export async function verifyUserPassword(
  nameOrEmail: string,
  password: string
): Promise<User | null> {
  // Match by name (case-insensitive) or email
  const rows = await query<any>(
    `SELECT * FROM users
     WHERE (lower(name) = lower($1) OR lower(email) = lower($1))
       AND is_active = true
       AND password_hash IS NOT NULL
       AND password_hash = crypt($2, password_hash)`,
    [nameOrEmail.trim(), password]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

// ISSUE-005: Verify password by primary key (id) instead of by name.
// Name is not unique in the schema, so verifying by name could inadvertently
// match the wrong account when two users share a name.
export async function verifyUserPasswordById(
  userId: string,
  password: string
): Promise<User | null> {
  const rows = await query<any>(
    `SELECT * FROM users
     WHERE id = $1
       AND is_active = true
       AND password_hash IS NOT NULL
       AND password_hash = crypt($2, password_hash)`,
    [userId, password]
  );
  return rows[0] ? mapUser(rows[0]) : null;
}

export async function getReceptionists(): Promise<User[]> {
  const rows = await query(
    `SELECT * FROM users WHERE role = 'RECEPTIONIST' ORDER BY name`
  );
  return rows.map(mapUser);
}

// ─── Password change ────────────────────────────────────────────────────────

export async function changeUserPassword(
  userId: string,
  newPassword: string,
  actorName = 'System'
): Promise<void> {
  await query(
    `UPDATE users SET password_hash = crypt($1, gen_salt('bf')), must_change_password = false, updated_at = NOW() WHERE id = $2`,
    [newPassword, userId]
  );
}

export async function createReceptionist(data: {
  name: string;
  email: string;
  password: string;
}, actorId = 'system', actorName = 'Admin', actorRole: UserRole = 'ADMIN'): Promise<User> {
  const rows = await query<any>(
    `INSERT INTO users (name, email, role, password_hash, is_active, must_change_password)
     VALUES ($1, $2, 'RECEPTIONIST', crypt($3, gen_salt('bf')), true, true)
     RETURNING *`,
    [data.name.trim(), data.email.trim().toLowerCase(), data.password]
  );
  const user = mapUser(rows[0]);
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'USER_CREATED', entityType: 'USER',
    entityId: user.id, entityName: user.name,
  });
  return user;
}

export async function updateReceptionist(
  id: string,
  data: { name?: string; email?: string; password?: string; isActive?: boolean },
  actorId = 'system',
  actorName = 'Admin',
  actorRole: UserRole = 'ADMIN'
): Promise<User | null> {
  // Build dynamic SET clause — only update provided fields
  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let i = 1;

  if (data.name !== undefined)     { sets.push(`name = $${i++}`);     params.push(data.name.trim()); }
  if (data.email !== undefined)    { sets.push(`email = $${i++}`);    params.push(data.email.trim().toLowerCase()); }
  if (data.password !== undefined && data.password.length > 0) {
    sets.push(`password_hash = crypt($${i++}, gen_salt('bf'))`);
    params.push(data.password);
  }
  if (data.isActive !== undefined) { sets.push(`is_active = $${i++}`); params.push(data.isActive); }

  params.push(id); // last param = WHERE id = $N
  const rows = await query<any>(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${i} AND role = 'RECEPTIONIST' RETURNING *`,
    params
  );
  if (!rows[0]) return null;
  const user = mapUser(rows[0]);
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'USER_UPDATED', entityType: 'USER',
    entityId: id, entityName: user.name,
  });
  return user;
}

export async function deleteReceptionist(id: string, actorId = 'system', actorName = 'Admin', actorRole: UserRole = 'ADMIN'): Promise<boolean> {
  const rows = await query<any>(
    `DELETE FROM users WHERE id = $1 AND role = 'RECEPTIONIST' RETURNING id, name`,
    [id]
  );
  if (!rows[0]) return false;
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'USER_DELETED', entityType: 'USER',
    entityId: id, entityName: rows[0].name,
  });
  return true;
}

// ─── Doctors ────────────────────────────────────────────────────────────────

export async function getDoctors(includeInactive = false): Promise<Doctor[]> {
  const rows = await query(
    `SELECT * FROM doctors ${includeInactive ? '' : 'WHERE is_active = true'} ORDER BY full_name`
  );
  return rows.map(mapDoctor);
}

export async function getDoctorById(id: string): Promise<Doctor | null> {
  const rows = await query('SELECT * FROM doctors WHERE id = $1', [id]);
  return rows[0] ? mapDoctor(rows[0]) : null;
}

export async function getDoctorAvailability(doctorId: string): Promise<DoctorAvailability[]> {
  const rows = await query(
    'SELECT * FROM doctor_availability WHERE doctor_id = $1 ORDER BY day_of_week',
    [doctorId]
  );
  return rows.map(mapAvailability);
}

// DATA-01: Remove manual id generation with Date.now() — let the DB generate UUIDs
// to avoid primary key collisions when multiple rows are inserted in the same millisecond.
export async function updateDoctorAvailability(
  doctorId: string,
  availabilityList: DoctorAvailability[]
): Promise<void> {
  await transaction(async (q) => {
    await q('DELETE FROM doctor_availability WHERE doctor_id = $1', [doctorId]);
    for (const av of availabilityList) {
      // Let Postgres generate the id via DEFAULT gen_random_uuid() — never reuse a
      // client-supplied id that may clash when the same loop runs multiple times.
      await q(
        `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
         VALUES ($1,$2,$3,$4,$5)`,
        [doctorId, av.dayOfWeek, av.startTime, av.endTime, av.isAvailable]
      );
    }
  });
}

export async function getDoctorExceptions(doctorId: string): Promise<DoctorScheduleException[]> {
  const rows = await query(
    'SELECT * FROM doctor_schedule_exceptions WHERE doctor_id = $1 ORDER BY date',
    [doctorId]
  );
  return rows.map(mapException);
}

export async function addDoctorException(
  ex: Omit<DoctorScheduleException, 'id'>
): Promise<DoctorScheduleException> {
  const rows = await query<any>(
    `INSERT INTO doctor_schedule_exceptions (doctor_id, date, start_time, end_time, reason, is_available)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [ex.doctorId, ex.date, ex.startTime ?? null, ex.endTime ?? null, ex.reason, ex.isAvailable]
  );
  return mapException(rows[0]);
}

export async function deleteDoctorException(id: string): Promise<void> {
  await query('DELETE FROM doctor_schedule_exceptions WHERE id = $1', [id]);
}

export async function addDoctor(
  doc: Omit<Doctor, 'id' | 'createdAt' | 'updatedAt'>,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Doctor> {
  const rows = await query<any>(
    `INSERT INTO doctors (user_id, full_name, specialization, license_number, phone, email, profile_image, bio, color, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [doc.userId ?? null, doc.fullName, doc.specialization, doc.licenseNumber, doc.phone, doc.email,
     doc.profileImage ?? null, doc.bio ?? null, doc.color, doc.isActive ?? true]
  );
  const newDoc = mapDoctor(rows[0]);

  // Default Mon–Sat availability
  for (let day = 0; day <= 6; day++) {
    await query(
      `INSERT INTO doctor_availability (doctor_id, day_of_week, start_time, end_time, is_available)
       VALUES ($1,$2,'09:00','17:00',$3) ON CONFLICT (doctor_id, day_of_week) DO NOTHING`,
      [newDoc.id, day, day !== 0]
    );
  }

  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'DOCTOR_ADDED', entityType: 'DOCTOR', entityId: newDoc.id, entityName: newDoc.fullName });
  return newDoc;
}

export async function updateDoctor(
  id: string,
  updates: Partial<Doctor>,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Doctor | null> {
  const old = await getDoctorById(id);
  if (!old) return null;

  const rows = await query<any>(
    `UPDATE doctors SET
       full_name = COALESCE($1, full_name),
       specialization = COALESCE($2, specialization),
       license_number = COALESCE($3, license_number),
       phone = COALESCE($4, phone),
       email = COALESCE($5, email),
       profile_image = COALESCE($6, profile_image),
       bio = COALESCE($7, bio),
       color = COALESCE($8, color),
       is_active = COALESCE($9, is_active),
       updated_at = NOW()
     WHERE id = $10 RETURNING *`,
    [updates.fullName ?? null, updates.specialization ?? null, updates.licenseNumber ?? null,
     updates.phone ?? null, updates.email ?? null, updates.profileImage ?? null,
     updates.bio ?? null, updates.color ?? null, updates.isActive ?? null, id]
  );
  if (!rows[0]) return null;
  const updated = mapDoctor(rows[0]);
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: updates.isActive === false ? 'DOCTOR_DEACTIVATED' : 'DOCTOR_UPDATED', entityType: 'DOCTOR', entityId: id, entityName: updated.fullName, oldValues: JSON.stringify({ fullName: old.fullName, specialization: old.specialization, isActive: old.isActive }), newValues: JSON.stringify({ fullName: updated.fullName, specialization: updated.specialization, isActive: updated.isActive }) });
  return updated;
}

export async function deleteDoctor(
  id: string,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<{ success: boolean; error?: string }> {
  // Check for linked records that would violate ON DELETE RESTRICT
  const [apptRows, treatRows, rxRows, visitRows] = await Promise.all([
    query('SELECT COUNT(*)::int AS n FROM appointments WHERE doctor_id = $1', [id]),
    query('SELECT COUNT(*)::int AS n FROM treatments  WHERE doctor_id = $1', [id]),
    query('SELECT COUNT(*)::int AS n FROM prescriptions WHERE doctor_id = $1', [id]),
    query('SELECT COUNT(*)::int AS n FROM visits       WHERE doctor_id = $1', [id]),
  ]);

  const appts  = Number(apptRows[0]?.n  ?? 0);
  const treats = Number(treatRows[0]?.n ?? 0);
  const rxs    = Number(rxRows[0]?.n    ?? 0);
  const visits = Number(visitRows[0]?.n ?? 0);

  if (appts + treats + rxs + visits > 0) {
    const parts: string[] = [];
    if (appts)  parts.push(`${appts} appointment${appts  !== 1 ? 's' : ''}`);
    if (treats) parts.push(`${treats} treatment${treats !== 1 ? 's' : ''}`);
    if (rxs)    parts.push(`${rxs} prescription${rxs    !== 1 ? 's' : ''}`);
    if (visits) parts.push(`${visits} visit${visits     !== 1 ? 's' : ''}`);
    return {
      success: false,
      error: `Cannot delete this doctor — they have linked records: ${parts.join(', ')}. `
        + `Deactivate the doctor instead to prevent new bookings while preserving clinical history.`,
    };
  }

  const docRows = await query('SELECT full_name FROM doctors WHERE id = $1', [id]);
  if (!docRows[0]) return { success: false, error: 'Doctor not found.' };
  const fullName = docRows[0].full_name;

  await query('DELETE FROM doctors WHERE id = $1', [id]);

  await logAudit({
    userId: actorId,
    userName: actorName,
    userRole: actorRole,
    action: 'DOCTOR_DELETED',
    entityType: 'DOCTOR',
    entityId: id,
    entityName: fullName,
  });

  return { success: true };
}

export async function getPatients(
  searchQuery = '',
  limit = 50,
  offset = 0
): Promise<{ patients: Patient[]; total: number }> {
  const q = searchQuery.trim();
  let rows: any[];
  let countRows: any[];

  if (q) {
    // SEC-05: escape SQL LIKE wildcard characters so user-typed % _ \ don't
    // accidentally match arbitrary records.
    const escaped = q.toLowerCase().replace(/[%_\\]/g, '\\$&');
    const like = `%${escaped}%`;
    // Phone / patient_number search keeps the original (unescaped) query so that
    // partial numeric strings still match, but we use the exact input not lower-case.
    const rawLike = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
    rows = await query(
      `SELECT * FROM patients
       WHERE deleted_at IS NULL
         AND (
           lower(first_name) LIKE $1 ESCAPE '\\'
          OR lower(last_name)  LIKE $1 ESCAPE '\\'
          OR lower(first_name || ' ' || last_name) LIKE $1 ESCAPE '\\'
          OR phone LIKE $2 ESCAPE '\\'
          OR patient_number LIKE $2 ESCAPE '\\'
          OR lower(email) LIKE $1 ESCAPE '\\'
         )
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [like, rawLike, limit, offset]
    );
    countRows = await query(
      `SELECT COUNT(*) FROM patients
       WHERE deleted_at IS NULL
         AND (
           lower(first_name) LIKE $1 ESCAPE '\\'
          OR lower(last_name)  LIKE $1 ESCAPE '\\'
          OR lower(first_name || ' ' || last_name) LIKE $1 ESCAPE '\\'
          OR phone LIKE $2 ESCAPE '\\'
          OR patient_number LIKE $2 ESCAPE '\\'
          OR lower(email) LIKE $1 ESCAPE '\\'
         )`,
      [like, rawLike]
    );
  } else {
    rows = await query(
      'SELECT * FROM patients WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    countRows = await query('SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL');
  }

  return {
    patients: rows.map(mapPatient),
    total: parseInt(countRows[0].count, 10),
  };
}

export async function getPatientById(id: string): Promise<(Patient & {
  medicalHistory: PatientMedicalHistory[];
  allergyList: PatientAllergy[];
  medications: PatientMedication[];
  dentalHistory: DentalHistory[];
  appointments: Appointment[];
  treatments: Treatment[];
  prescriptions: Prescription[];
  visits: Visit[];
  xrays: PatientXRay[];
}) | null> {
  const ptRows = await query(
    'SELECT * FROM patients WHERE (id = $1 OR patient_number = $1) AND deleted_at IS NULL',
    [id]
  );
  if (!ptRows[0]) return null;
  const patient = mapPatient(ptRows[0]);
  const pid = patient.id;

  const [
    medRows, allergyRows, medRows2, dentalRows,
    apptRows, treatRows, rxRows, visitRows, xrayRows
  ] = await Promise.all([
    query('SELECT * FROM patient_medical_history WHERE patient_id = $1 ORDER BY created_at DESC', [pid]),
    query('SELECT * FROM patient_allergies WHERE patient_id = $1 ORDER BY severity DESC', [pid]),
    query('SELECT * FROM patient_medications WHERE patient_id = $1 ORDER BY created_at DESC', [pid]),
    query('SELECT * FROM dental_history WHERE patient_id = $1 ORDER BY tooth_number', [pid]),
    query(`SELECT a.*, p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num, p.phone as p_phone, p.allergies as p_allergies,
                  d.full_name as d_name, d.specialization as d_spec, d.color as d_color, d.license_number as d_lic
           FROM appointments a
           LEFT JOIN patients p ON a.patient_id = p.id
           LEFT JOIN doctors d ON a.doctor_id = d.id
           WHERE a.patient_id = $1 ORDER BY a.appointment_date DESC, a.start_time DESC`, [pid]),
    query(`SELECT t.*, d.full_name as d_name, d.specialization as d_spec, d.color as d_color,
                  pa.first_name as p_first, pa.last_name as p_last, pa.patient_number as p_num
           FROM treatments t
           LEFT JOIN doctors d ON t.doctor_id = d.id
           LEFT JOIN patients pa ON t.patient_id = pa.id
           WHERE t.patient_id = $1 ORDER BY t.created_at DESC`, [pid]),
    query(`SELECT rx.*, d.full_name as d_name, d.specialization as d_spec, d.license_number as d_lic,
                  pa.first_name as p_first, pa.last_name as p_last, pa.patient_number as p_num, pa.allergies as p_allergies, pa.date_of_birth as p_dob, pa.gender as p_gender
           FROM prescriptions rx
           LEFT JOIN doctors d ON rx.doctor_id = d.id
           LEFT JOIN patients pa ON rx.patient_id = pa.id
           WHERE rx.patient_id = $1 ORDER BY rx.prescription_date DESC`, [pid]),
    query(`SELECT v.*, d.full_name as d_name, d.specialization as d_spec, d.color as d_color
           FROM visits v
           LEFT JOIN doctors d ON v.doctor_id = d.id
           WHERE v.patient_id = $1 ORDER BY v.visit_date DESC`, [pid]),
    query(
      `SELECT * FROM patient_xrays WHERE patient_id = $1 ORDER BY created_at DESC`,
      [pid]
    ),
  ]);

  // Hydrate appointments
  const appointments = apptRows.map(r => mapAppointment(r,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, phone: r.p_phone, allergies: r.p_allergies } as Patient,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color, licenseNumber: r.d_lic } as Doctor
  ));

  // Hydrate treatments
  const treatments = treatRows.map(r => mapTreatment(r,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color } as Doctor,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num } as Patient
  ));

  // Hydrate prescriptions with items
  const rxIds = rxRows.map(r => r.id);
  let allItems: any[] = [];
  if (rxIds.length > 0) {
    allItems = await query(
      `SELECT * FROM prescription_items WHERE prescription_id = ANY($1) ORDER BY prescription_id, sort_order`,
      [rxIds]
    );
  }
  const prescriptions = rxRows.map(r => mapPrescription(
    r,
    allItems.filter(i => i.prescription_id === r.id).map(mapPrescriptionItem),
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, licenseNumber: r.d_lic } as Doctor,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, allergies: r.p_allergies, dateOfBirth: r.p_dob, gender: r.p_gender } as Patient
  ));

  // Hydrate visits
  const visits = visitRows.map(r => mapVisit(r,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color } as Doctor
  ));

  return {
    ...patient,
    medicalHistory: medRows.map(mapMedicalHistory),
    allergyList: allergyRows.map(mapAllergy),
    medications: medRows2.map(mapMedication),
    dentalHistory: dentalRows.map(mapDentalHistory),
    appointments,
    treatments,
    prescriptions,
    visits,
    xrays: xrayRows.map(mapXRay),
  };
}

export async function checkDuplicatePatient(
  firstName: string,
  lastName: string,
  phone: string,
  dateOfBirth: string
): Promise<Patient[]> {
  // BUG-03: use exact phone match (after stripping non-digits) to prevent false positives.
  // Require at least 7 digits so partial numbers don't accidentally match everything.
  const cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length < 7) {
    // Fall back to name+DOB only when phone is too short to match reliably
    const rows = await query(
      `SELECT * FROM patients
       WHERE lower(first_name) = lower($1) AND lower(last_name) = lower($2) AND date_of_birth::text = $3`,
      [firstName.trim(), lastName.trim(), dateOfBirth]
    );
    return rows.map(mapPatient);
  }
  const rows = await query(
    `SELECT * FROM patients
     WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
        OR regexp_replace(alternate_phone, '[^0-9]', '', 'g') = $1
        OR (lower(first_name) = lower($2) AND lower(last_name) = lower($3) AND date_of_birth::text = $4)`,
    [cleanPhone, firstName.trim(), lastName.trim(), dateOfBirth]
  );
  return rows.map(mapPatient);
}

// BUG-07: Wrap counter increment + INSERT in a single transaction so a crash
// between the two statements cannot leave a gap or allow two patients to share
// the same patient_number under concurrent load.
export async function addPatient(
  patientData: Omit<Patient, 'id' | 'patientNumber' | 'createdAt' | 'updatedAt'>,
  actorId = 'system',
  actorName = 'Receptionist',
  ipAddress?: string,
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Patient> {
  return transaction(async (q) => {
    // Atomically increment the counter and claim the next sequence value.
    const ctrRows = await q<{ value: number }>(
      `UPDATE counters SET value = value + 1 WHERE name = 'patient_seq' RETURNING value`
    );
    const patientNumber = `PT-${String(ctrRows[0].value).padStart(6, '0')}`;

    const rows = await q<any>(
      `INSERT INTO patients
         (patient_number, first_name, last_name, date_of_birth, gender, phone, alternate_phone,
          email, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation,
          blood_group, occupation, allergies, general_medical_notes, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [patientNumber, patientData.firstName, patientData.lastName, patientData.dateOfBirth,
       patientData.gender, patientData.phone, patientData.alternatePhone ?? null,
       patientData.email ?? null, patientData.address ?? null,
       patientData.emergencyContactName ?? null, patientData.emergencyContactPhone ?? null,
       patientData.emergencyContactRelation ?? null, patientData.bloodGroup,
       patientData.occupation ?? null, patientData.allergies ?? null,
       patientData.generalMedicalNotes ?? null, patientData.status ?? 'ACTIVE']
    );
    // Note: logAudit is called outside the transaction to avoid holding the
    // transaction open while performing an unrelated write.
    const patient = mapPatient(rows[0]);
    await logAudit({
      userId: actorId, userName: actorName, userRole: actorRole,
      action: 'PATIENT_CREATED', entityType: 'PATIENT',
      entityId: patient.id,
      entityName: `${patient.firstName} ${patient.lastName} (${patient.patientNumber})`,
      ipAddress,
    });
    return patient;
  });
}

// DATA-02: Replace COALESCE with explicit per-field assignment so nullable fields
// can be intentionally cleared when the caller passes an empty string or explicit null.
// The server maps "" → null before calling this function (see server.ts PUT /api/patients/:id).
export async function updatePatient(
  id: string,
  updates: Partial<Patient>,
  actorId = 'system',
  actorName = 'Receptionist',
  ipAddress?: string,
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Patient | null> {
  // Build a dynamic SET clause — only columns that were explicitly provided are
  // updated. Required fields (firstName, lastName, phone, dateOfBirth, gender,
  // bloodGroup, status) fall back to COALESCE since they must never be NULL.
  // Nullable/optional fields use direct assignment so they can be cleared.
  const sets: string[] = ['updated_at = NOW()'];
  const params: any[] = [];
  let i = 1;

  // Required — use COALESCE so an accidental null doesn't wipe them
  if (updates.firstName    !== undefined) { sets.push(`first_name = COALESCE($${i++}, first_name)`);   params.push(updates.firstName || null); }
  if (updates.lastName     !== undefined) { sets.push(`last_name = COALESCE($${i++}, last_name)`);     params.push(updates.lastName  || null); }
  if (updates.dateOfBirth  !== undefined) { sets.push(`date_of_birth = COALESCE($${i++}, date_of_birth)`); params.push(updates.dateOfBirth || null); }
  if (updates.gender       !== undefined) { sets.push(`gender = COALESCE($${i++}, gender)`);           params.push(updates.gender    || null); }
  if (updates.phone        !== undefined) { sets.push(`phone = COALESCE($${i++}, phone)`);             params.push(updates.phone     || null); }
  if (updates.bloodGroup   !== undefined) { sets.push(`blood_group = COALESCE($${i++}, blood_group)`); params.push(updates.bloodGroup || null); }
  if (updates.status       !== undefined) { sets.push(`status = COALESCE($${i++}, status)`);           params.push(updates.status    || null); }

  // Optional/nullable — direct assignment so "" or null clears the value
  if ('alternatePhone'            in updates) { sets.push(`alternate_phone = $${i++}`);              params.push(updates.alternatePhone            ?? null); }
  if ('email'                     in updates) { sets.push(`email = $${i++}`);                        params.push(updates.email                     ?? null); }
  if ('address'                   in updates) { sets.push(`address = $${i++}`);                      params.push(updates.address                   ?? null); }
  if ('emergencyContactName'      in updates) { sets.push(`emergency_contact_name = $${i++}`);       params.push(updates.emergencyContactName       ?? null); }
  if ('emergencyContactPhone'     in updates) { sets.push(`emergency_contact_phone = $${i++}`);      params.push(updates.emergencyContactPhone      ?? null); }
  if ('emergencyContactRelation'  in updates) { sets.push(`emergency_contact_relation = $${i++}`);   params.push(updates.emergencyContactRelation   ?? null); }
  if ('occupation'                in updates) { sets.push(`occupation = $${i++}`);                   params.push(updates.occupation                 ?? null); }
  if ('generalMedicalNotes'       in updates) { sets.push(`general_medical_notes = $${i++}`);        params.push(updates.generalMedicalNotes        ?? null); }
  // Note: allergies is managed by rebuildAllergyString() — do not accept direct override

  params.push(id);
  const rows = await query<any>(
    `UPDATE patients SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
    params
  );
  if (!rows[0]) return null;
  const updated = mapPatient(rows[0]);
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'PATIENT_UPDATED', entityType: 'PATIENT',
    entityId: id, entityName: `${updated.firstName} ${updated.lastName}`,
    ipAddress,
  });
  return updated;
}

// ─── Patient Sub-entities ───────────────────────────────────────────────────

export async function addPatientMedicalHistory(
  data: Omit<PatientMedicalHistory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PatientMedicalHistory> {
  const rows = await query<any>(
    `INSERT INTO patient_medical_history (patient_id, condition, description, status, diagnosed_at, notes, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [data.patientId, data.condition, data.description ?? null, data.status ?? 'ACTIVE',
     data.diagnosedAt ?? null, data.notes ?? null, data.createdBy ?? 'System']
  );
  return mapMedicalHistory(rows[0]);
}

export async function addPatientAllergy(
  data: Omit<PatientAllergy, 'id' | 'createdAt' | 'updatedAt'>
): Promise<PatientAllergy> {
  const rows = await query<any>(
    `INSERT INTO patient_allergies (patient_id, allergen, reaction, severity, notes)
     VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [data.patientId, data.allergen, data.reaction ?? null, data.severity ?? 'HIGH', data.notes ?? null]
  );
  const item = mapAllergy(rows[0]);
  // Rebuild patient allergy summary
  await rebuildAllergyString(data.patientId);
  return item;
}

export async function deleteAllergy(id: string): Promise<void> {
  const rows = await query('SELECT patient_id FROM patient_allergies WHERE id = $1', [id]);
  if (rows[0]) {
    await query('DELETE FROM patient_allergies WHERE id = $1', [id]);
    await rebuildAllergyString(rows[0].patient_id);
  }
}

async function rebuildAllergyString(patientId: string): Promise<void> {
  const rows = await query(
    `SELECT allergen, severity FROM patient_allergies WHERE patient_id = $1`,
    [patientId]
  );
  const summary = rows.map(r => `${r.allergen} (${r.severity})`).join(', ');
  await query(
    `UPDATE patients SET allergies = $1, updated_at = NOW() WHERE id = $2`,
    [summary || null, patientId]
  );
}

export async function addPatientMedication(
  data: Omit<PatientMedication, 'id' | 'createdAt'>
): Promise<PatientMedication> {
  const rows = await query<any>(
    `INSERT INTO patient_medications (patient_id, medicine_name, dosage, frequency, route, start_date, end_date, status, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [data.patientId, data.medicineName, data.dosage, data.frequency, data.route ?? 'Oral',
     data.startDate ?? null, data.endDate ?? null, data.status ?? 'CURRENT', data.notes ?? null]
  );
  return mapMedication(rows[0]);
}

export async function updateToothCondition(
  patientId: string,
  toothNumber: number,
  condition: DentalHistory['condition'],
  notes?: string,
  createdBy = 'System'
): Promise<DentalHistory> {
  const rows = await query<any>(
    `INSERT INTO dental_history (patient_id, tooth_number, condition, notes, created_by)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (patient_id, tooth_number)
     DO UPDATE SET condition = EXCLUDED.condition, notes = COALESCE(EXCLUDED.notes, dental_history.notes), updated_at = NOW()
     RETURNING *`,
    [patientId, toothNumber, condition, notes ?? null, createdBy]
  );
  return mapDentalHistory(rows[0]);
}

// ─── Conflict Checking ──────────────────────────────────────────────────────

export async function checkAppointmentConflict(
  doctorId: string,
  appointmentDate: string,
  startTime: string,
  endTime: string,
  excludeAppointmentId?: string
): Promise<ConflictCheckResult> {
  // 1. Doctor active?
  const docRows = await query('SELECT id, full_name, is_active FROM doctors WHERE id = $1', [doctorId]);
  const doctor = docRows[0];
  if (!doctor) {
    return { hasConflict: true, conflictReason: 'Selected doctor was not found.' };
  }
  // Handle both boolean true and string "true" from different drivers
  const isActive = doctor.is_active === true || doctor.is_active === 'true' || doctor.is_active === 't';
  if (!isActive) {
    return { hasConflict: true, conflictReason: 'Selected doctor is currently inactive or unavailable.' };
  }

  // 2. Exception on this date?
  const exRows = await query(
    'SELECT * FROM doctor_schedule_exceptions WHERE doctor_id = $1 AND date = $2',
    [doctorId, appointmentDate]
  );
  if (exRows[0]) {
    const exAvailable = exRows[0].is_available === true || exRows[0].is_available === 'true' || exRows[0].is_available === 't';
    if (!exAvailable) {
      return { hasConflict: true, conflictReason: `Doctor is on leave on ${appointmentDate} (${exRows[0].reason}).` };
    }
  }

  // 3. Weekly schedule
  const apptDate = new Date(`${appointmentDate}T00:00:00`);
  const dayOfWeek = apptDate.getDay();
  const availRows = await query(
    'SELECT * FROM doctor_availability WHERE doctor_id = $1 AND day_of_week = $2',
    [doctorId, dayOfWeek]
  );
  if (availRows[0]) {
    const slotAvailable = availRows[0].is_available === true || availRows[0].is_available === 'true' || availRows[0].is_available === 't';
    if (!slotAvailable) {
      return { hasConflict: true, conflictReason: 'Doctor does not practice on this day of the week.' };
    }
  }

  // 4. Overlapping appointments
  const newStart = toMinutes(startTime);
  const newEnd   = toMinutes(endTime);

  const existingRows = await query(
    `SELECT a.*, p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     WHERE a.doctor_id = $1
       AND a.appointment_date = $2
       AND a.status NOT IN ('CANCELLED','RESCHEDULED')
       AND ($3::text IS NULL OR a.id != $3)`,
    [doctorId, appointmentDate, excludeAppointmentId ?? null]
  );

  for (const r of existingRows) {
    const existStart = toMinutes(r.start_time);
    const existEnd   = toMinutes(r.end_time);
    if (newStart < existEnd && newEnd > existStart) {
      return {
        hasConflict: true,
        conflictReason: `Double-Booking Detected: Dr. ${doctor.full_name} already has a ${r.appointment_type} appointment from ${r.start_time} to ${r.end_time}.`,
        conflictingAppointment: mapAppointment(r,
          { firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num } as Patient,
          mapDoctor(doctor)
        ),
      };
    }
  }

  return { hasConflict: false };
}

// ─── Appointments ───────────────────────────────────────────────────────────

export async function getAppointments(filter?: {
  date?: string;
  startDate?: string;
  endDate?: string;
  doctorId?: string;
  patientId?: string;
  status?: string;
}): Promise<Appointment[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;

  if (filter?.date) {
    conditions.push(`a.appointment_date = $${i++}`);
    params.push(filter.date);
  } else if (filter?.startDate && filter?.endDate) {
    conditions.push(`a.appointment_date BETWEEN $${i++} AND $${i++}`);
    params.push(filter.startDate, filter.endDate);
  }
  if (filter?.doctorId) {
    conditions.push(`a.doctor_id = $${i++}`);
    params.push(filter.doctorId);
  }
  if (filter?.patientId) {
    conditions.push(`a.patient_id = $${i++}`);
    params.push(filter.patientId);
  }
  if (filter?.status && filter.status !== 'ALL') {
    conditions.push(`a.status = $${i++}`);
    params.push(filter.status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = await query(
    `SELECT a.*,
            p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num,
            p.phone as p_phone, p.allergies as p_allergies, p.blood_group as p_blood,
            p.date_of_birth as p_dob, p.gender as p_gender, p.email as p_email,
            d.full_name as d_name, d.specialization as d_spec, d.color as d_color,
            d.license_number as d_lic, d.phone as d_phone, d.email as d_email
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     ${where}
     ORDER BY a.appointment_date, a.start_time`,
    params
  );

  return rows.map(r => mapAppointment(r,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, phone: r.p_phone, allergies: r.p_allergies, bloodGroup: r.p_blood, dateOfBirth: r.p_dob, gender: r.p_gender, email: r.p_email } as Patient,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color, licenseNumber: r.d_lic, phone: r.d_phone, email: r.d_email } as Doctor
  ));
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const rows = await query(
    `SELECT a.*,
            p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num,
            p.phone as p_phone, p.allergies as p_allergies, p.blood_group as p_blood,
            d.full_name as d_name, d.specialization as d_spec, d.color as d_color, d.license_number as d_lic
     FROM appointments a
     LEFT JOIN patients p ON a.patient_id = p.id
     LEFT JOIN doctors d ON a.doctor_id = d.id
     WHERE a.id = $1`,
    [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return mapAppointment(r,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, phone: r.p_phone, allergies: r.p_allergies, bloodGroup: r.p_blood } as Patient,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color, licenseNumber: r.d_lic } as Doctor
  );
}

export async function createAppointment(
  apptData: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'patient' | 'doctor'>,
  allowOverride = false,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<{ appointment?: Appointment; conflict?: ConflictCheckResult }> {
  if (!allowOverride) {
    const conflict = await checkAppointmentConflict(
      apptData.doctorId, apptData.appointmentDate, apptData.startTime, apptData.endTime
    );
    if (conflict.hasConflict) return { conflict };
  }

  const rows = await query<any>(
    `INSERT INTO appointments
       (patient_id, doctor_id, appointment_date, start_time, end_time, duration_minutes,
        appointment_type, status, reason, notes, original_appointment_id, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [apptData.patientId, apptData.doctorId, apptData.appointmentDate, apptData.startTime,
     apptData.endTime, apptData.durationMinutes ?? 30, apptData.appointmentType,
     apptData.status ?? 'SCHEDULED', apptData.reason ?? null, apptData.notes ?? null,
     apptData.originalAppointmentId ?? null, actorName]
  );
  const appt = await getAppointmentById(rows[0].id);

  // Auto-create confirmation reminder
  if (appt) {
    const ptRows = await query('SELECT * FROM patients WHERE id = $1', [apptData.patientId]);
    const docRows = await query('SELECT * FROM doctors WHERE id = $1', [apptData.doctorId]);
    const settRows = await query('SELECT * FROM clinic_settings WHERE id = $1', ['clinic-default']);
    if (ptRows[0] && settRows[0]) {
      const pt = mapPatient(ptRows[0]);
      const doc = docRows[0] ? mapDoctor(docRows[0]) : null;
      const sett = mapSettings(settRows[0]);
      const tpl = sett.reminderTemplates?.confirmation || '';
      const msg = tpl
        .replace('{{patientName}}', `${pt.firstName} ${pt.lastName}`)
        .replace('{{doctorName}}', doc?.fullName ?? 'your doctor')
        .replace('{{appointmentDate}}', apptData.appointmentDate)
        .replace('{{appointmentTime}}', apptData.startTime)
        .replace('{{clinicName}}', sett.clinicName)
        .replace('{{clinicPhone}}', sett.phone);

      await query(
        `INSERT INTO appointment_reminders (appointment_id, patient_id, type, channel, scheduled_at, status, message, recipient)
         VALUES ($1,$2,'CONFIRMATION',$3,NOW(),'PENDING',$4,$5)`,
        [appt.id, pt.id, pt.phone ? 'SMS' : 'EMAIL', msg, pt.phone || pt.email || 'N/A']
      );
    }
  }

  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'APPOINTMENT_CREATED', entityType: 'APPOINTMENT', entityId: rows[0].id });
  return { appointment: appt! };
}

export async function updateAppointmentStatus(
  id: string,
  status: Appointment['status'],
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Appointment | null> {
  await query(
    `UPDATE appointments SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
  const updated = await getAppointmentById(id);
  if (updated) {
    await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: `APPOINTMENT_${status}`, entityType: 'APPOINTMENT', entityId: id });
  }
  return updated;
}

export async function rescheduleAppointment(
  id: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  reason: string,
  allowOverride = false,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<{ appointment?: Appointment; conflict?: ConflictCheckResult }> {
  const old = await getAppointmentById(id);
  if (!old) return { conflict: { hasConflict: true, conflictReason: 'Appointment not found' } };

  if (!allowOverride) {
    const conflict = await checkAppointmentConflict(old.doctorId, newDate, newStartTime, newEndTime, id);
    if (conflict.hasConflict) return { conflict };
  }

  // ISSUE-010 FIX: logAudit and getAppointmentById are called AFTER the
  // transaction commits so a rolled-back reschedule never produces a phantom
  // audit entry, and getAppointmentById uses its own connection (not the tx one).
  let newApptId = '';
  await transaction(async (q) => {
    // Mark old as RESCHEDULED
    await q(
      `UPDATE appointments SET status = 'RESCHEDULED', reschedule_reason = $1, updated_at = NOW() WHERE id = $2`,
      [reason, id]
    );
    // Create new appointment
    const newRows = await q<{ id: string }>(
      `INSERT INTO appointments
         (patient_id, doctor_id, appointment_date, start_time, end_time, duration_minutes,
          appointment_type, status, original_appointment_id, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'SCHEDULED',$8,$9,$10) RETURNING id`,
      [old.patientId, old.doctorId, newDate, newStartTime, newEndTime,
       old.durationMinutes, old.appointmentType, id,
       `Rescheduled from ${old.appointmentDate} ${old.startTime}. Reason: ${reason}`,
       actorName]
    );
    newApptId = newRows[0].id;
  });

  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'APPOINTMENT_RESCHEDULED', entityType: 'APPOINTMENT', entityId: newApptId });
  const newAppt = await getAppointmentById(newApptId);
  return { appointment: newAppt! };
}

// ─── Visits ─────────────────────────────────────────────────────────────────

export async function getVisits(patientId?: string, limit = 200, offset = 0): Promise<Visit[]> {
  // SCAL-01: add LIMIT/OFFSET — unbounded visit queries can return thousands of rows
  const params: any[] = patientId ? [patientId, Math.min(limit, 500), Math.max(offset, 0)] : [Math.min(limit, 500), Math.max(offset, 0)];
  const limitIdx  = patientId ? 2 : 1;
  const offsetIdx = limitIdx + 1;
  const rows = await query(
    `SELECT v.*, d.full_name as d_name, d.specialization as d_spec, d.color as d_color
     FROM visits v
     LEFT JOIN doctors d ON v.doctor_id = d.id
     ${patientId ? 'WHERE v.patient_id = $1' : ''}
     ORDER BY v.visit_date DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows.map(r => mapVisit(r, { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color } as Doctor));
}

export async function createVisit(
  visitData: Omit<Visit, 'id' | 'createdAt' | 'updatedAt' | 'doctor' | 'treatments' | 'prescription'>,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Visit> {
  const rows = await query<any>(
    `INSERT INTO visits (appointment_id, patient_id, doctor_id, visit_date, chief_complaint, clinical_notes, diagnosis, treatment_summary, follow_up_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [visitData.appointmentId ?? null, visitData.patientId, visitData.doctorId,
     visitData.visitDate, visitData.chiefComplaint ?? null, visitData.clinicalNotes ?? null,
     visitData.diagnosis ?? null, visitData.treatmentSummary ?? null, visitData.followUpDate ?? null]
  );
  // If linked to appointment, complete it — but only if the current status
  // allows that transition (ISSUE-012: bypass of the API-layer guard).
  if (visitData.appointmentId) {
    const linkedAppt = await query('SELECT status FROM appointments WHERE id = $1', [visitData.appointmentId]);
    const currentStatus = linkedAppt[0]?.status as string | undefined;
    // Only IN_PROGRESS appointments transition cleanly to COMPLETED.
    // Allow ARRIVED as well in case the doctor starts the visit directly.
    const completableStatuses = ['IN_PROGRESS', 'ARRIVED', 'CONFIRMED', 'SCHEDULED'];
    if (currentStatus && completableStatuses.includes(currentStatus)) {
      await updateAppointmentStatus(visitData.appointmentId, 'COMPLETED', actorId, actorName);
    }
  }
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'VISIT_RECORDED', entityType: 'VISIT', entityId: rows[0].id });
  return mapVisit(rows[0]);
}

// ─── Treatments ─────────────────────────────────────────────────────────────

export async function getTreatments(patientId?: string, doctorId?: string, limit = 200, offset = 0): Promise<Treatment[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (patientId) { conditions.push(`t.patient_id = $${i++}`); params.push(patientId); }
  if (doctorId)  { conditions.push(`t.doctor_id = $${i++}`);  params.push(doctorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  // SCAL-01: add LIMIT/OFFSET to prevent full-table scans on large datasets
  params.push(Math.min(limit, 500));
  params.push(Math.max(offset, 0));

  const rows = await query(
    `SELECT t.*,
            d.full_name as d_name, d.specialization as d_spec, d.color as d_color,
            p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num
     FROM treatments t
     LEFT JOIN doctors d ON t.doctor_id = d.id
     LEFT JOIN patients p ON t.patient_id = p.id
     ${where}
     ORDER BY t.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    params
  );
  return rows.map(r => mapTreatment(r,
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color } as Doctor,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num } as Patient
  ));
}

export async function createTreatment(
  data: Omit<Treatment, 'id' | 'createdAt' | 'updatedAt' | 'doctor' | 'patient'>,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Treatment> {
  const rows = await query<any>(
    `INSERT INTO treatments
       (patient_id, doctor_id, appointment_id, visit_id, treatment_type, treatment_name,
        tooth_number, description, status, cost, start_date, completion_date, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [data.patientId, data.doctorId, data.appointmentId ?? null, data.visitId ?? null,
     data.treatmentType ?? null, data.treatmentName, data.toothNumber ?? null,
     data.description ?? null, data.status ?? 'PLANNED', data.cost ?? null,
     data.startDate ?? null, data.completionDate ?? null, data.notes ?? null]
  );
  // If tooth number provided, update dental chart using a treatment-type-aware
  // condition mapping instead of the previous binary FILLED/CARIES that could
  // overwrite a more specific condition (e.g. ROOT_CANAL → CARIES).
  if (data.toothNumber) {
    const TREATMENT_CONDITION_MAP: Record<string, DentalHistory['condition']> = {
      'Root Canal':  'ROOT_CANAL',
      'Crown':       'CROWN',
      'Bridge':      'BRIDGE',
      'Implant':     'IMPLANT',
      'Extraction':  'MISSING',
    };
    // Derive condition from treatmentName or treatmentType; fall back to FILLED
    // for a completed treatment and CARIES for anything in-progress/planned.
    const nameKey = Object.keys(TREATMENT_CONDITION_MAP).find(k =>
      (data.treatmentName ?? '').toLowerCase().includes(k.toLowerCase()) ||
      (data.treatmentType ?? '').toLowerCase().includes(k.toLowerCase())
    );
    const derivedCondition: DentalHistory['condition'] = nameKey
      ? TREATMENT_CONDITION_MAP[nameKey]
      : (data.status === 'COMPLETED' ? 'FILLED' : 'CARIES');

    await updateToothCondition(
      data.patientId, data.toothNumber,
      derivedCondition,
      `${data.treatmentName ?? 'Treatment'} (${data.status})`,
      actorName
    );
  }
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'TREATMENT_CREATED', entityType: 'TREATMENT', entityId: rows[0].id, entityName: data.treatmentName });
  const full = await query(
    `SELECT t.*, d.full_name as d_name, d.specialization as d_spec, d.color as d_color,
             p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num
     FROM treatments t LEFT JOIN doctors d ON t.doctor_id = d.id LEFT JOIN patients p ON t.patient_id = p.id
     WHERE t.id = $1`, [rows[0].id]
  );
  const fr = full[0];
  return mapTreatment(fr, { id: fr.doctor_id, fullName: fr.d_name, specialization: fr.d_spec, color: fr.d_color } as Doctor, { id: fr.patient_id, firstName: fr.p_first, lastName: fr.p_last, patientNumber: fr.p_num } as Patient);
}

export async function updateTreatment(
  id: string,
  updates: Partial<Treatment>,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Treatment | null> {
  await query(
    `UPDATE treatments SET
       treatment_name = COALESCE($1, treatment_name),
       treatment_type = COALESCE($2, treatment_type),
       status = COALESCE($3, status),
       cost = COALESCE($4, cost),
       notes = COALESCE($5, notes),
       completion_date = COALESCE($6, completion_date),
       updated_at = NOW()
     WHERE id = $7`,
    [updates.treatmentName ?? null, updates.treatmentType ?? null, updates.status ?? null,
     updates.cost ?? null, updates.notes ?? null, updates.completionDate ?? null, id]
  );
  const rows = await query(
    `SELECT t.*, d.full_name as d_name, d.specialization as d_spec, d.color as d_color,
             p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num
     FROM treatments t LEFT JOIN doctors d ON t.doctor_id = d.id LEFT JOIN patients p ON t.patient_id = p.id
     WHERE t.id = $1`, [id]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'TREATMENT_UPDATED', entityType: 'TREATMENT', entityId: id });
  return mapTreatment(r, { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, color: r.d_color } as Doctor, { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num } as Patient);
}

// ─── Prescriptions ──────────────────────────────────────────────────────────

export async function getPrescriptions(filter?: { patientId?: string; doctorId?: string }): Promise<Prescription[]> {
  const conditions: string[] = [];
  const params: any[] = [];
  let i = 1;
  if (filter?.patientId) { conditions.push(`rx.patient_id = $${i++}`); params.push(filter.patientId); }
  if (filter?.doctorId)  { conditions.push(`rx.doctor_id = $${i++}`);  params.push(filter.doctorId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rxRows = await query(
    `SELECT rx.*,
            d.full_name as d_name, d.specialization as d_spec, d.license_number as d_lic,
            p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num,
            p.allergies as p_allergies, p.date_of_birth as p_dob, p.gender as p_gender
     FROM prescriptions rx
     LEFT JOIN doctors d ON rx.doctor_id = d.id
     LEFT JOIN patients p ON rx.patient_id = p.id
     ${where}
     ORDER BY rx.prescription_date DESC`,
    params
  );

  if (rxRows.length === 0) return [];
  const ids = rxRows.map(r => r.id);
  const itemRows = await query(
    `SELECT * FROM prescription_items WHERE prescription_id = ANY($1) ORDER BY prescription_id, sort_order`,
    [ids]
  );

  return rxRows.map(r => mapPrescription(
    r,
    itemRows.filter(i => i.prescription_id === r.id).map(mapPrescriptionItem),
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, licenseNumber: r.d_lic } as Doctor,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, allergies: r.p_allergies, dateOfBirth: r.p_dob, gender: r.p_gender } as Patient
  ));
}

export async function getPrescriptionById(id: string): Promise<Prescription | null> {
  const rxRows = await query(
    `SELECT rx.*,
            d.full_name as d_name, d.specialization as d_spec, d.license_number as d_lic,
            p.first_name as p_first, p.last_name as p_last, p.patient_number as p_num,
            p.allergies as p_allergies, p.date_of_birth as p_dob, p.gender as p_gender
     FROM prescriptions rx
     LEFT JOIN doctors d ON rx.doctor_id = d.id
     LEFT JOIN patients p ON rx.patient_id = p.id
     WHERE rx.id = $1 OR rx.rx_number = $1`,
    [id]
  );
  if (!rxRows[0]) return null;
  const r = rxRows[0];
  const itemRows = await query(
    'SELECT * FROM prescription_items WHERE prescription_id = $1 ORDER BY sort_order',
    [r.id]
  );
  return mapPrescription(
    r,
    itemRows.map(mapPrescriptionItem),
    { id: r.doctor_id, fullName: r.d_name, specialization: r.d_spec, licenseNumber: r.d_lic } as Doctor,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, patientNumber: r.p_num, allergies: r.p_allergies, dateOfBirth: r.p_dob, gender: r.p_gender } as Patient
  );
}

export async function createPrescription(
  rxData: Omit<Prescription, 'id' | 'rxNumber' | 'createdAt' | 'updatedAt' | 'items' | 'doctor' | 'patient'>,
  items: Omit<PrescriptionItem, 'id' | 'prescriptionId'>[],
  actorId = 'system',
  actorName = 'System',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Prescription> {
  // Server-side allergy cross-check against structured patient_allergies table.
  // Done before opening the transaction so the check does not hold a DB connection open.
  const allergyRows = await query(
    `SELECT allergen, severity FROM patient_allergies WHERE patient_id = $1`,
    [rxData.patientId]
  );
  const allergyWarnings: string[] = [];
  if (allergyRows.length > 0) {
    const allergenNames = allergyRows.map((r: any) => r.allergen.toLowerCase());
    for (const item of items) {
      const med = item.medicineName.toLowerCase();
      for (const allergen of allergenNames) {
        const isPenicillinFamily = allergen.includes('penicillin') &&
          (med.includes('amox') || med.includes('penicillin') || med.includes('augmentin') || med.includes('ampicillin'));
        const isCephalosporinFamily = allergen.includes('cephalosporin') &&
          (med.includes('cefadroxil') || med.includes('cephalex') || med.includes('cefdinir'));
        const isNsaidFamily = (allergen.includes('nsaid') || allergen.includes('aspirin') || allergen.includes('ibuprofen')) &&
          (med.includes('ibu') || med.includes('ketorolac') || med.includes('aspirin') || med.includes('naproxen') || med.includes('diclofenac'));
        const isMacrolideFamily = allergen.includes('macrolide') &&
          (med.includes('azithromycin') || med.includes('clarithromycin') || med.includes('erythromycin'));
        const isDirectMatch = med.includes(allergen) || allergen.includes(med.split(' ')[0]);

        if (isPenicillinFamily || isCephalosporinFamily || isNsaidFamily || isMacrolideFamily || isDirectMatch) {
          const severity = allergyRows.find((r: any) => r.allergen.toLowerCase() === allergen)?.severity ?? 'HIGH';
          allergyWarnings.push(
            `ALLERGY ALERT [${severity}]: Patient has documented allergy to "${allergyRows.find((r: any) => r.allergen.toLowerCase() === allergen)?.allergen}" — prescribed "${item.medicineName}" may be contraindicated.`
          );
        }
      }
    }
  }

  const allergyWarningText = allergyWarnings.length > 0 ? allergyWarnings.join('\n') : null;

  // ISSUE-007 FIX: generate the RX number INSIDE the transaction so that a
  // failed INSERT cannot leave a gap in the sequence — the counter increment
  // and the prescription INSERT are now a single atomic unit.
  // ISSUE-010 FIX: logAudit is called AFTER the transaction resolves so that a
  // rolled-back transaction does not produce a phantom audit entry.
  let createdRxId = '';
  let createdRxNumber = '';

  await transaction(async (q) => {
    // Atomically claim the next sequence value inside the transaction
    const ctrRows = await q<{ value: number }>(
      `UPDATE counters SET value = value + 1 WHERE name = 'rx_seq' RETURNING value`
    );
    const rxNumber = `RX-${new Date().getFullYear()}-${String(ctrRows[0].value).padStart(4, '0')}`;
    createdRxNumber = rxNumber;

    const rxRows = await q<{ id: string }>(
      `INSERT INTO prescriptions
         (rx_number, patient_id, doctor_id, visit_id, prescription_date, diagnosis,
          chief_complaint, instructions, follow_up_notes, follow_up_days, status, allergy_warnings)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [rxNumber, rxData.patientId, rxData.doctorId, rxData.visitId ?? null,
       rxData.prescriptionDate ?? new Date().toISOString().slice(0, 10),
       rxData.diagnosis ?? null, rxData.chiefComplaint ?? null,
       rxData.instructions ?? null, rxData.followUpNotes ?? null,
       rxData.followUpDays ?? null, rxData.status ?? 'ACTIVE', allergyWarningText]
    );
    const rxId = rxRows[0].id;
    createdRxId = rxId;

    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      await q(
        `INSERT INTO prescription_items (prescription_id, medicine_name, strength, dosage, frequency, duration, route, instructions, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [rxId, it.medicineName, it.strength ?? null, it.dosage, it.frequency, it.duration, it.route ?? 'Oral', it.instructions ?? null, idx]
      );
      await q(
        `INSERT INTO patient_medications (patient_id, medicine_name, dosage, frequency, route, start_date, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,'CURRENT',$7)`,
        [rxData.patientId, it.medicineName, it.dosage, it.frequency, it.route ?? 'Oral',
         rxData.prescriptionDate ?? new Date().toISOString().slice(0, 10),
         `Prescribed on ${rxNumber} (${it.duration})`]
      );
    }
  });

  // Audit log written after the transaction commits so it never records a
  // phantom entry for a rolled-back operation.
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'PRESCRIPTION_CREATED', entityType: 'PRESCRIPTION', entityId: createdRxId, entityName: createdRxNumber });
  return getPrescriptionById(createdRxId) as Promise<Prescription>;
}

// ─── Reminders ──────────────────────────────────────────────────────────────

export async function getReminders(patientId?: string, limit = 200, offset = 0): Promise<AppointmentReminder[]> {
  // SCAL-01: add LIMIT/OFFSET to prevent full table scans
  const params: any[] = patientId ? [patientId, Math.min(limit, 500), Math.max(offset, 0)] : [Math.min(limit, 500), Math.max(offset, 0)];
  const limitIdx  = patientId ? 2 : 1;
  const offsetIdx = limitIdx + 1;
  const rows = await query(
    `SELECT r.*,
            p.first_name as p_first, p.last_name as p_last, p.phone as p_phone
     FROM appointment_reminders r
     LEFT JOIN patients p ON r.patient_id = p.id
     ${patientId ? 'WHERE r.patient_id = $1' : ''}
     ORDER BY r.created_at DESC
     LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params
  );
  return rows.map(r => mapReminder(r,
    { id: r.patient_id, firstName: r.p_first, lastName: r.p_last, phone: r.p_phone } as Patient
  ));
}

export async function triggerManualReminder(
  reminderId: string,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<AppointmentReminder | null> {
  const rows = await query<any>(
    `UPDATE appointment_reminders SET status = 'SENT', sent_at = NOW() WHERE id = $1 RETURNING *`,
    [reminderId]
  );
  if (!rows[0]) return null;
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'REMINDER_SENT', entityType: 'REMINDER', entityId: reminderId });
  return mapReminder(rows[0]);
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(): Promise<ClinicSettings> {
  const rows = await query("SELECT * FROM clinic_settings WHERE id = 'clinic-default'");
  if (!rows[0]) {
    throw new Error('Clinic settings not initialised. Run migrations first (npm run migrate:seed).');
  }
  return mapSettings(rows[0]);
}

export async function updateSettings(
  settings: Partial<ClinicSettings>,
  actorId = 'system',
  actorName = 'Admin',
  actorRole: UserRole = 'ADMIN'
): Promise<ClinicSettings> {
  const rows = await query<any>(
    `UPDATE clinic_settings SET
       clinic_name = COALESCE($1, clinic_name),
       tagline     = COALESCE($2, tagline),
       address_line1 = COALESCE($3, address_line1),
       address_line2 = COALESCE($4, address_line2),
       city        = COALESCE($5, city),
       state       = COALESCE($6, state),
       zip_code    = COALESCE($7, zip_code),
       phone       = COALESCE($8, phone),
       alternate_phone = COALESCE($9, alternate_phone),
       emergency_phone = COALESCE($10, emergency_phone),
       email       = COALESCE($11, email),
       website     = COALESCE($12, website),
       print_header = COALESCE($13, print_header),
       print_footer = COALESCE($14, print_footer),
       default_appointment_duration = COALESCE($15, default_appointment_duration),
       default_slot_duration_minutes = COALESCE($16, default_slot_duration_minutes),
       working_hours_start = COALESCE($17, working_hours_start),
       working_hours_end   = COALESCE($18, working_hours_end),
       currency_symbol = COALESCE($19, currency_symbol),
       updated_at  = NOW()
     WHERE id = 'clinic-default' RETURNING *`,
    [settings.clinicName ?? null, settings.tagline ?? null,
     settings.addressLine1 ?? null, settings.addressLine2 ?? null,
     settings.city ?? null, settings.state ?? null, settings.zipCode ?? null,
     settings.phone ?? null, settings.alternatePhone ?? null, settings.emergencyPhone ?? null,
     settings.email ?? null, settings.website ?? null,
     settings.printHeader ?? null, settings.printFooter ?? null,
     settings.defaultAppointmentDuration ?? settings.defaultSlotDurationMinutes ?? null,
     settings.defaultSlotDurationMinutes ?? null,
     settings.workingHoursStart ?? settings.operatingHoursStart ?? null,
     settings.workingHoursEnd ?? settings.operatingHoursEnd ?? null,
     settings.currencySymbol ?? null]
  );
  if (!rows[0]) {
    throw new Error('Clinic settings row not found. Run migrations first (npm run migrate:seed).');
  }
  await logAudit({ userId: actorId, userName: actorName, userRole: actorRole, action: 'SETTINGS_UPDATED', entityType: 'SETTINGS', entityId: 'clinic-default' });
  return mapSettings(rows[0]);
}

// ─── Audit Logs ─────────────────────────────────────────────────────────────

export async function getAuditLogs(limit = 100, entityType?: string): Promise<AuditLog[]> {
  // ISSUE-018 FIX: use fully parameterized query instead of mixing string
  // interpolation with placeholders, which is fragile and error-prone.
  const filterByType = entityType && entityType !== 'ALL';
  const rows = await query(
    filterByType
      ? `SELECT * FROM audit_logs WHERE entity_type = $1 ORDER BY created_at DESC LIMIT $2`
      : `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT $1`,
    filterByType ? [entityType, limit] : [limit]
  );
  return rows.map(mapAuditLog);
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function getReports(startDate: string, endDate: string, doctorId?: string) {
  const apptParams: any[] = [startDate, endDate];
  const apptWhere = doctorId ? 'AND doctor_id = $3' : '';
  if (doctorId) apptParams.push(doctorId);

  const [apptRows, treatRows, doctorRows] = await Promise.all([
    query(
      `SELECT a.status, a.appointment_type, a.doctor_id, d.full_name as doctor_name
       FROM appointments a LEFT JOIN doctors d ON a.doctor_id = d.id
       WHERE a.appointment_date BETWEEN $1 AND $2 ${apptWhere}`,
      apptParams
    ),
    query(
      `SELECT t.cost FROM treatments t
       WHERE t.created_at::date BETWEEN $1 AND $2 ${doctorId ? 'AND t.doctor_id = $3' : ''}`,
      apptParams
    ),
    query('SELECT id, full_name FROM doctors'),
  ]);

  const total = apptRows.length;
  const completed  = apptRows.filter(r => r.status === 'COMPLETED').length;
  const cancelled  = apptRows.filter(r => r.status === 'CANCELLED').length;
  const noShow     = apptRows.filter(r => r.status === 'NO_SHOW').length;
  const totalRevenue = treatRows.reduce((acc, r) => acc + Number(r.cost || 0), 0);

  // By type
  const typeMap: Record<string, number> = {};
  apptRows.forEach(r => { typeMap[r.appointment_type] = (typeMap[r.appointment_type] || 0) + 1; });

  // By doctor
  const doctorMap: Record<string, { name: string; total: number; completed: number }> = {};
  doctorRows.forEach(d => { doctorMap[d.id] = { name: d.full_name, total: 0, completed: 0 }; });
  apptRows.forEach(r => {
    if (doctorMap[r.doctor_id]) {
      doctorMap[r.doctor_id].total++;
      if (r.status === 'COMPLETED') doctorMap[r.doctor_id].completed++;
    }
  });

  return {
    totalAppointments: total,
    completedAppointments: completed,
    cancelledAppointments: cancelled + noShow,
    estimatedRevenue: Math.round(totalRevenue * 100) / 100,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    byType: typeMap,
    byDoctor: Object.fromEntries(
      Object.values(doctorMap).map(d => [d.name, d.total])
    ),
    byDoctorDetailed: Object.values(doctorMap),
  };
}

// ─── Patient X-Rays ──────────────────────────────────────────────────────────

export async function getPatientXRays(patientId: string): Promise<PatientXRay[]> {
  const rows = await query(
    `SELECT * FROM patient_xrays WHERE patient_id = $1 ORDER BY created_at DESC`,
    [patientId]
  );
  return rows.map(mapXRay);
}

export async function addPatientXRay(data: {
  patientId: string;
  filename: string;
  blobUrl: string;
  contentType: string;
  sizeBytes: number;
  notes?: string;
  takenAt?: string;
  uploadedBy: string;
}): Promise<PatientXRay> {
  const rows = await query<any>(
    `INSERT INTO patient_xrays
       (patient_id, filename, blob_url, content_type, size_bytes, notes, taken_at, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [
      data.patientId,
      data.filename,
      data.blobUrl,
      data.contentType,
      data.sizeBytes,
      data.notes ?? null,
      data.takenAt ?? null,
      data.uploadedBy,
    ]
  );
  return mapXRay(rows[0]);
}

export async function deletePatientXRay(
  xrayId: string,
  patientId: string
): Promise<{ found: boolean; blobUrl: string | null }> {
  // Verify ownership before deleting — ensures a user cannot delete an X-ray
  // belonging to a different patient by guessing the xray ID.
  const rows = await query<any>(
    `DELETE FROM patient_xrays WHERE id = $1 AND patient_id = $2 RETURNING blob_url`,
    [xrayId, patientId]
  );
  if (!rows[0]) return { found: false, blobUrl: null };
  return { found: true, blobUrl: rows[0].blob_url };
}

// ─── Patient Soft-Delete / Trash / Restore / Hard-Delete ─────────────────────

/**
 * Soft-delete a patient — sets deleted_at and deleted_by, hides from all
 * normal queries. Does NOT touch related records (appointments, prescriptions
 * etc.) so clinical history is fully preserved.
 */
export async function softDeletePatient(
  id: string,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Patient | null> {
  const rows = await query<any>(
    `UPDATE patients
     SET deleted_at = NOW(), deleted_by = $1, updated_at = NOW()
     WHERE id = $2 AND deleted_at IS NULL
     RETURNING *`,
    [actorName, id]
  );
  if (!rows[0]) return null;
  const patient = mapPatient(rows[0]);
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'PATIENT_TRASHED', entityType: 'PATIENT',
    entityId: id,
    entityName: `${patient.firstName} ${patient.lastName} (${patient.patientNumber})`,
  });
  return patient;
}

/**
 * Return all patients currently in the trash (deleted_at IS NOT NULL).
 * Ordered most-recently-deleted first.
 */
export async function getTrashedPatients(): Promise<Patient[]> {
  const rows = await query(
    `SELECT * FROM patients WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
  return rows.map(mapPatient);
}

/**
 * Restore a trashed patient — clears deleted_at and deleted_by.
 */
export async function restorePatient(
  id: string,
  actorId = 'system',
  actorName = 'Receptionist',
  actorRole: UserRole = 'RECEPTIONIST'
): Promise<Patient | null> {
  const rows = await query<any>(
    `UPDATE patients
     SET deleted_at = NULL, deleted_by = NULL, updated_at = NOW()
     WHERE id = $1 AND deleted_at IS NOT NULL
     RETURNING *`,
    [id]
  );
  if (!rows[0]) return null;
  const patient = mapPatient(rows[0]);
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'PATIENT_RESTORED', entityType: 'PATIENT',
    entityId: id,
    entityName: `${patient.firstName} ${patient.lastName} (${patient.patientNumber})`,
  });
  return patient;
}

/**
 * Permanently delete a single trashed patient and all their related records.
 * The patients table has ON DELETE RESTRICT for appointments/treatments/
 * prescriptions/visits, so those must be hard-deleted first, then the patient.
 * CASCADE takes care of sub-entities (allergies, medications, dental_history,
 * patient_medical_history, patient_xrays) automatically.
 */
export async function hardDeletePatient(
  id: string,
  actorId = 'system',
  actorName = 'Admin',
  actorRole: UserRole = 'ADMIN'
): Promise<boolean> {
  // Verify the patient is actually in the trash before permanently deleting.
  const check = await query('SELECT id, first_name, last_name, patient_number FROM patients WHERE id = $1 AND deleted_at IS NOT NULL', [id]);
  if (!check[0]) return false;
  const { first_name, last_name, patient_number } = check[0];

  await transaction(async (q) => {
    // Delete RESTRICT-constrained child records first so the final DELETE succeeds.
    await q('DELETE FROM appointment_reminders WHERE appointment_id IN (SELECT id FROM appointments WHERE patient_id = $1)', [id]);
    await q('DELETE FROM prescription_items    WHERE prescription_id IN (SELECT id FROM prescriptions WHERE patient_id = $1)', [id]);
    await q('DELETE FROM treatments   WHERE patient_id = $1', [id]);
    await q('DELETE FROM prescriptions WHERE patient_id = $1', [id]);
    await q('DELETE FROM visits        WHERE patient_id = $1', [id]);
    await q('DELETE FROM appointments  WHERE patient_id = $1', [id]);
    // patient_xrays, patient_allergies, patient_medications, patient_medical_history,
    // dental_history all have ON DELETE CASCADE so they're removed by the row delete below.
    await q('DELETE FROM patients WHERE id = $1', [id]);
  });

  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'PATIENT_PERMANENTLY_DELETED', entityType: 'PATIENT',
    entityId: id,
    entityName: `${first_name} ${last_name} (${patient_number})`,
  });
  return true;
}

/**
 * Empty the entire trash — permanently delete every patient with deleted_at IS NOT NULL.
 * Returns the count of patients destroyed.
 */
export async function emptyPatientTrash(
  actorId = 'system',
  actorName = 'Admin',
  actorRole: UserRole = 'ADMIN'
): Promise<number> {
  const trashed = await getTrashedPatients();
  if (trashed.length === 0) return 0;

  for (const patient of trashed) {
    await hardDeletePatient(patient.id, actorId, actorName, actorRole);
  }

  // Single summary audit entry rather than one per patient to keep the log clean.
  await logAudit({
    userId: actorId, userName: actorName, userRole: actorRole,
    action: 'PATIENT_TRASH_EMPTIED', entityType: 'PATIENT',
    entityId: 'trash',
    entityName: `${trashed.length} patient record(s) permanently deleted`,
  });
  return trashed.length;
}
