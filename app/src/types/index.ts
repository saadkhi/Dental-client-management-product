/**
 * MDS Clinic (Mehmood Dental Surgeon) Management System
 * Core Domain Types and Enums
 */

export type UserRole = 'ADMIN' | 'RECEPTIONIST' | 'DOCTOR';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Doctor {
  id: string;
  userId?: string;
  fullName: string;
  specialization: string;
  licenseNumber: string;
  phone: string;
  email: string;
  profileImage?: string;
  bio?: string;
  color: string; // for calendar distinction
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DoctorAvailability {
  id: string;
  doctorId: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  isAvailable: boolean;
}

export interface DoctorScheduleException {
  id: string;
  doctorId: string;
  date: string; // "YYYY-MM-DD"
  startTime?: string;
  endTime?: string;
  reason: string;
  isAvailable: boolean; // false = taking leave, true = special extra shift
}

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type PatientStatus = 'ACTIVE' | 'INACTIVE';
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'UNKNOWN';

export interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bloodGroup: BloodGroup;
  occupation?: string;
  allergies?: string;
  generalMedicalNotes?: string;
  status: PatientStatus;
  deletedAt?: string;  // ISO timestamp — present when patient is in trash
  deletedBy?: string;  // name of user who moved to trash
  createdAt: string;
  updatedAt: string;
}

export type MedicalConditionStatus = 'ACTIVE' | 'RESOLVED' | 'CHRONIC';

export interface PatientMedicalHistory {
  id: string;
  patientId: string;
  condition: string;
  description?: string;
  status: MedicalConditionStatus;
  diagnosedAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AllergySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE';

export interface PatientAllergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction?: string;
  severity: AllergySeverity;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type MedicationStatus = 'CURRENT' | 'PAST' | 'DISCONTINUED';

export interface PatientMedication {
  id: string;
  patientId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate?: string;
  endDate?: string;
  status: MedicationStatus;
  notes?: string;
  createdAt: string;
}

export type ToothCondition = 
  | 'HEALTHY' 
  | 'CARIES' 
  | 'FILLED' 
  | 'CROWN' 
  | 'ROOT_CANAL' 
  | 'MISSING' 
  | 'IMPLANT' 
  | 'EXTRACTION_INDICATED' 
  | 'FRACTURED' 
  | 'BRIDGE';

export interface DentalHistory {
  id: string;
  patientId: string;
  toothNumber: number; // 1-32 or 11-48
  condition: ToothCondition;
  diagnosis?: string;
  treatment?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type AppointmentStatus = 
  | 'SCHEDULED' 
  | 'CONFIRMED' 
  | 'ARRIVED' 
  | 'IN_PROGRESS' 
  | 'COMPLETED' 
  | 'CANCELLED' 
  | 'NO_SHOW' 
  | 'RESCHEDULED';

export type AppointmentType = 
  | 'Consultation' 
  | 'Follow-up' 
  | 'Cleaning' 
  | 'Filling' 
  | 'Extraction' 
  | 'Root Canal' 
  | 'Crown' 
  | 'Implant' 
  | 'Orthodontic' 
  | 'Emergency' 
  | 'Other';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  durationMinutes: number;
  appointmentType: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  originalAppointmentId?: string; // For reschedule lineage
  rescheduleReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;

  // Joined views
  patient?: Patient;
  doctor?: Doctor;
}

export interface Visit {
  id: string;
  appointmentId?: string;
  patientId: string;
  doctorId: string;
  visitDate: string; // "YYYY-MM-DD"
  chiefComplaint?: string;
  clinicalNotes?: string;
  diagnosis?: string;
  treatmentSummary?: string;
  followUpDate?: string;
  createdAt: string;
  updatedAt: string;

  // Joined
  doctor?: Doctor;
  treatments?: Treatment[];
  prescription?: Prescription;
}

export type TreatmentStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type MedicalHistory = PatientMedicalHistory;
export type Allergy = PatientAllergy;
export type ClinicSetting = ClinicSettings;

export interface Treatment {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string;
  visitId?: string;
  treatmentType?: string;
  treatmentName?: string;
  toothNumber?: number;
  description?: string;
  status: TreatmentStatus;
  cost?: number;
  startDate?: string;
  completionDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;

  // Joined
  doctor?: Doctor;
  patient?: Patient;
}

export interface Prescription {
  id: string;
  rxNumber: string; // e.g. "RX-2026-0001"
  patientId: string;
  doctorId: string;
  visitId?: string;
  prescriptionDate: string; // "YYYY-MM-DD"
  diagnosis?: string;
  chiefComplaint?: string;
  instructions?: string;
  followUpNotes?: string;
  followUpDays?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;

  // Joined
  items?: PrescriptionItem[];
  doctor?: Doctor;
  patient?: Patient;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  medicineName: string;
  strength?: string; // e.g. "500mg"
  dosage: string;    // e.g. "1 tablet"
  frequency: string; // e.g. "1-0-1 (Twice daily)" or "TID"
  duration: string;  // e.g. "5 days"
  route: string;     // e.g. "Oral", "Topical", "Mouth Rinse"
  instructions?: string; // e.g. "After meals"
}

export type ReminderType = 'CONFIRMATION' | 'REMINDER' | 'FOLLOWUP';
export type ReminderChannel = 'SMS' | 'EMAIL' | 'WHATSAPP';
export type ReminderStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  type: ReminderType;
  channel: ReminderChannel;
  scheduledAt: string;
  sentAt?: string;
  status: ReminderStatus;
  message: string;
  recipient: string;
  createdAt: string;

  // Joined
  patient?: Patient;
  appointment?: Appointment;
}

export interface ClinicSettings {
  id: string;
  clinicName: string;
  tagline?: string;
  logoUrl?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone: string;
  alternatePhone?: string;
  emergencyPhone?: string;
  emergencyHelpline?: string;
  email: string;
  website?: string;
  registrationNumber?: string;
  taxId?: string;
  printHeader?: string;
  printFooter?: string;
  defaultAppointmentDuration?: number; // in minutes
  defaultSlotDurationMinutes?: number;
  workingHoursStart?: string; // "09:00"
  workingHoursEnd?: string;   // "18:00"
  operatingHoursStart?: string;
  operatingHoursEnd?: string;
  activeDays?: number[];      // [1, 2, 3, 4, 5, 6] = Mon-Sat
  currency?: string;          // "$"
  currencySymbol?: string;
  timezone?: string;
  emailProviderEnabled?: boolean;
  smsProviderEnabled?: boolean;
  whatsAppProviderEnabled?: boolean;
  reminderTemplates?: {
    confirmation?: string;
    reminder?: string;
    followup?: string;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  oldValues?: string;
  newValues?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface ConflictCheckResult {
  hasConflict: boolean;
  conflictReason?: string;
  conflictingAppointment?: Appointment;
}

// ─── Patient X-Rays ──────────────────────────────────────────────────────────

export interface PatientXRay {
  id: string;
  patientId: string;
  filename: string;       // original file name shown in the UI
  blobUrl: string;        // Vercel Blob permanent URL
  contentType: string;    // MIME type: image/jpeg, image/png, image/dicom, etc.
  sizeBytes: number;
  notes?: string;         // optional label, e.g. "Left bitewing", "PA #19"
  takenAt?: string;       // "YYYY-MM-DD" — date the X-ray was taken
  uploadedBy: string;     // user name of the uploader
  createdAt: string;
}

// ─── PatientFull ─────────────────────────────────────────────────────────────
// DEBT-02: Composite type used by PatientProfileView — replaces useState<any>.
// The API endpoint GET /api/patients/:id returns Patient + all related arrays.
export interface PatientFull extends Patient {
  medicalHistory:  PatientMedicalHistory[];
  allergyList:     PatientAllergy[];
  medications:     PatientMedication[];
  dentalHistory:   DentalHistory[];
  appointments:    Appointment[];
  treatments:      Treatment[];
  prescriptions:   Prescription[];
  visits:          Visit[];
  xrays:           PatientXRay[];
}
