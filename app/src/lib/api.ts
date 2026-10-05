import {
  Patient,
  Doctor,
  Appointment,
  Visit,
  Treatment,
  Prescription,
  AppointmentReminder,
  ClinicSettings,
  AuditLog,
  User,
  ConflictCheckResult,
  PatientXRay,
} from '../types/index.js';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const fetchFn = typeof window !== 'undefined' ? window.fetch.bind(window) : globalThis.fetch;
  const res = await fetchFn(url, {
    ...options,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  });

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const textPreview = await res.text().catch(() => '');
    throw new Error(
      `Server returned non-JSON response (${res.status}): ${textPreview.slice(0, 80)}`
    );
  }

  const data = await res.json();
  if (!res.ok || !data.success) {
    const errorMsg = data.error?.message || data.message || `Request failed with status ${res.status}`;
    const err: any = new Error(errorMsg);
    err.details = data.error?.details || data;
    err.code = data.error?.code;
    throw err;
  }
  return data.data;
}

export const api = {
  // Auth
  getAuthMe: () => fetchJson<{ user: User | null }>('/api/auth/me'),
  getPublicClinic: () => fetchJson<{ clinicName: string; tagline: string }>('/api/public/clinic'),
  login: (username: string, password: string) => fetchJson<{ user: User }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  logout: () => fetchJson<void>('/api/auth/logout', { method: 'POST' }),

  // Receptionist management
  getReceptionists: () => fetchJson<User[]>('/api/users/receptionists'),
  createReceptionist: (data: { name: string; email: string; password: string }) =>
    fetchJson<User>('/api/users/receptionists', { method: 'POST', body: JSON.stringify(data) }),
  updateReceptionist: (id: string, data: { name?: string; email?: string; password?: string; isActive?: boolean }) =>
    fetchJson<User>(`/api/users/receptionists/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteReceptionist: (id: string) =>
    fetchJson<void>(`/api/users/receptionists/${id}`, { method: 'DELETE' }),

  // Patients
  // SCAL-03: lowered default to 50 — reduces PII transfer per search keystroke
  getPatients: (search = '', limit = 50, offset = 0) => 
    fetchJson<{ patients: Patient[]; total: number }>(`/api/patients?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`),
  
  getPatientById: (id: string) => 
    fetchJson<Patient & {
      medicalHistory: any[];
      allergyList: any[];
      medications: any[];
      dentalHistory: any[];
      appointments: Appointment[];
      treatments: Treatment[];
      prescriptions: Prescription[];
      visits: Visit[];
    }>(`/api/patients/${id}`),

  checkDuplicatePatient: (firstName: string, lastName: string, phone: string, dateOfBirth: string) =>
    fetchJson<{ duplicates: Patient[] }>('/api/patients/check-duplicate', {
      method: 'POST',
      body: JSON.stringify({ firstName, lastName, phone, dateOfBirth })
    }),

  createPatient: (patient: Partial<Patient>) =>
    fetchJson<Patient>('/api/patients', {
      method: 'POST',
      body: JSON.stringify(patient)
    }),

  updatePatient: (id: string, updates: Partial<Patient>) =>
    fetchJson<Patient>(`/api/patients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  // ─── Patient Trash ─────────────────────────────────────────────────────────
  deletePatient: (id: string) =>
    fetchJson<Patient>(`/api/patients/${id}`, { method: 'DELETE' }),

  getTrashedPatients: () =>
    fetchJson<Patient[]>('/api/patients/trash'),

  restorePatient: (id: string) =>
    fetchJson<Patient>(`/api/patients/${id}/restore`, { method: 'PATCH' }),

  permanentlyDeletePatient: (id: string) =>
    fetchJson<void>(`/api/patients/${id}/permanent`, { method: 'DELETE' }),

  emptyPatientTrash: () =>
    fetchJson<{ deleted: number }>('/api/patients/trash/empty', { method: 'DELETE' }),

  addMedicalHistory: (patientId: string, item: any) =>
    fetchJson<any>(`/api/patients/${patientId}/medical-history`, {
      method: 'POST',
      body: JSON.stringify(item)
    }),

  addAllergy: (patientId: string, item: any) =>
    fetchJson<any>(`/api/patients/${patientId}/allergies`, {
      method: 'POST',
      body: JSON.stringify(item)
    }),

  deleteAllergy: (allergyId: string) =>
    fetchJson<any>(`/api/patients/allergies/${allergyId}`, { method: 'DELETE' }),

  addMedication: (patientId: string, item: any) =>
    fetchJson<any>(`/api/patients/${patientId}/medications`, {
      method: 'POST',
      body: JSON.stringify(item)
    }),

  updateToothCondition: (patientId: string, toothNumber: number, condition: string, notes?: string) =>
    fetchJson<any>(`/api/patients/${patientId}/dental-chart`, {
      method: 'POST',
      body: JSON.stringify({ toothNumber, condition, notes })
    }),

  // Doctors
  getDoctors: (includeInactive = true) =>
    fetchJson<Doctor[]>(`/api/doctors?includeInactive=${includeInactive}`),

  getDoctorById: (id: string) =>
    fetchJson<Doctor & { availability: any[]; exceptions: any[] }>(`/api/doctors/${id}`),

  createDoctor: (doc: Partial<Doctor>) =>
    fetchJson<Doctor>('/api/doctors', {
      method: 'POST',
      body: JSON.stringify(doc)
    }),

  updateDoctor: (id: string, updates: Partial<Doctor>) =>
    fetchJson<Doctor>(`/api/doctors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  deleteDoctor: (id: string) =>
    fetchJson<void>(`/api/doctors/${id}`, { method: 'DELETE' }),

  updateDoctorAvailability: (id: string, availability: any[]) =>
    fetchJson<any>(`/api/doctors/${id}/availability`, {
      method: 'PUT',
      body: JSON.stringify({ availability })
    }),

  addDoctorException: (doctorId: string, exception: any) =>
    fetchJson<any>(`/api/doctors/${doctorId}/exceptions`, {
      method: 'POST',
      body: JSON.stringify(exception)
    }),

  deleteDoctorException: (doctorId: string, exId: string) =>
    fetchJson<any>(`/api/doctors/exceptions/${exId}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: (filter?: {
    date?: string;
    startDate?: string;
    endDate?: string;
    doctorId?: string;
    patientId?: string;
    status?: string;
  }) => {
    const params = new URLSearchParams();
    if (filter?.date) params.append('date', filter.date);
    if (filter?.startDate) params.append('startDate', filter.startDate);
    if (filter?.endDate) params.append('endDate', filter.endDate);
    if (filter?.doctorId) params.append('doctorId', filter.doctorId);
    if (filter?.patientId) params.append('patientId', filter.patientId);
    if (filter?.status) params.append('status', filter.status);
    return fetchJson<Appointment[]>(`/api/appointments?${params.toString()}`);
  },

  getAppointmentById: (id: string) =>
    fetchJson<Appointment>(`/api/appointments/${id}`),

  checkConflict: (data: {
    doctorId: string;
    appointmentDate: string;
    startTime: string;
    endTime: string;
    excludeAppointmentId?: string;
  }) => fetchJson<ConflictCheckResult>('/api/appointments/check-conflict', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  createAppointment: (data: Partial<Appointment> & { allowOverride?: boolean }) =>
    fetchJson<Appointment>('/api/appointments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateAppointmentStatus: (id: string, status: string) =>
    fetchJson<Appointment>(`/api/appointments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }),

  rescheduleAppointment: (id: string, data: {
    newDate: string;
    newStartTime: string;
    newEndTime: string;
    reason?: string;
    allowOverride?: boolean;
  }) => fetchJson<Appointment>(`/api/appointments/${id}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Visits
  getVisits: (patientId?: string) =>
    fetchJson<Visit[]>(`/api/visits${patientId ? `?patientId=${patientId}` : ''}`),

  createVisit: (data: Partial<Visit>) =>
    fetchJson<Visit>('/api/visits', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Treatments
  getTreatments: (patientId?: string, doctorId?: string) => {
    const params = new URLSearchParams();
    if (patientId) params.append('patientId', patientId);
    if (doctorId) params.append('doctorId', doctorId);
    return fetchJson<Treatment[]>(`/api/treatments?${params.toString()}`);
  },

  createTreatment: (data: Partial<Treatment>) =>
    fetchJson<Treatment>('/api/treatments', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  updateTreatment: (id: string, updates: Partial<Treatment>) =>
    fetchJson<Treatment>(`/api/treatments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    }),

  // Prescriptions
  getPrescriptions: (filter?: { patientId?: string; doctorId?: string }) => {
    const params = new URLSearchParams();
    if (filter?.patientId) params.append('patientId', filter.patientId);
    if (filter?.doctorId) params.append('doctorId', filter.doctorId);
    return fetchJson<Prescription[]>(`/api/prescriptions?${params.toString()}`);
  },

  getPrescriptionById: (id: string) =>
    fetchJson<Prescription>(`/api/prescriptions/${id}`),

  createPrescription: (data: any) =>
    fetchJson<Prescription>('/api/prescriptions', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  // Reminders
  getReminders: (patientId?: string) =>
    fetchJson<AppointmentReminder[]>(`/api/reminders${patientId ? `?patientId=${patientId}` : ''}`),

  sendReminder: (id: string) =>
    fetchJson<AppointmentReminder>(`/api/reminders/${id}/send`, { method: 'POST' }),

  // Reports
  getReports: (startDate: string, endDate: string, doctorId?: string) => {
    const params = new URLSearchParams({ startDate, endDate });
    if (doctorId) params.append('doctorId', doctorId);
    return fetchJson<any>(`/api/reports?${params.toString()}`);
  },

  // Settings
  getSettings: () => fetchJson<ClinicSettings>('/api/settings'),

  updateSettings: (settings: Partial<ClinicSettings>) =>
    fetchJson<ClinicSettings>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Audit Logs
  getAuditLogs: (limit = 100, entityType?: string) => {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (entityType) params.append('entityType', entityType);
    return fetchJson<AuditLog[]>(`/api/audit-logs?${params.toString()}`);
  },

  logPrintAction: (documentType: string, documentId?: string, patientName?: string) =>
    fetchJson<any>('/api/audit-logs/print', {
      method: 'POST',
      body: JSON.stringify({ documentType, documentId, patientName })
    }),

  // ─── Patient X-Rays ────────────────────────────────────────────────────────

  getXRays: (patientId: string) =>
    fetchJson<PatientXRay[]>(`/api/patients/${patientId}/xrays`),

  /**
   * Upload one or more X-ray files for a patient.
   *
   * Sends multipart/form-data — does NOT set Content-Type manually so the
   * browser includes the correct multipart boundary in the header.
   *
   * @param patientId  Patient UUID
   * @param files      FileList or File[] from an <input type="file"> element
   * @param notes      Optional label applied to all files in this batch (e.g. "Left bitewing")
   * @param takenAt    Optional YYYY-MM-DD date the X-ray was taken
   */
  uploadXRays: async (
    patientId: string,
    files: File[],
    notes?: string,
    takenAt?: string
  ): Promise<PatientXRay[]> => {
    const form = new FormData();
    for (const file of files) form.append('files', file);
    if (notes)   form.append('notes',   notes);
    if (takenAt) form.append('takenAt', takenAt);

    // Use fetch directly — fetchJson always sets Content-Type: application/json
    // which would break multipart uploads.
    const res = await fetch(`/api/patients/${patientId}/xrays`, {
      method: 'POST',
      body: form,
      // credentials are included via cookies automatically for same-origin requests
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text().catch(() => '');
      throw new Error(`Server returned non-JSON response (${res.status}): ${text.slice(0, 80)}`);
    }

    const data = await res.json();
    if (!res.ok || !data.success) {
      const err: any = new Error(data.error?.message || `Upload failed with status ${res.status}`);
      err.code = data.error?.code;
      throw err;
    }
    return data.data as PatientXRay[];
  },

  deleteXRay: (patientId: string, xrayId: string) =>
    fetchJson<void>(`/api/patients/${patientId}/xrays/${xrayId}`, { method: 'DELETE' }),
};
