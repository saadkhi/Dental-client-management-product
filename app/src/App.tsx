import React, { useState, useEffect, useCallback } from 'react';
import { AppSidebar, NavSection } from './components/layout/AppSidebar.js';
import { TopBar } from './components/layout/TopBar.js';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal.js';
import { useToast, ToastContainer } from './components/ui/Toast.js';

// Hubs & Views
import { ReceptionistDashboard } from './components/dashboard/ReceptionistDashboard.js';
import { AppointmentsHub } from './components/appointments/AppointmentsHub.js';
import { PatientsHub } from './components/patients/PatientsHub.js';
import { PatientProfileView } from './components/patients/PatientProfileView.js';
import { DoctorsHub } from './components/doctors/DoctorsHub.js';
import { PrescriptionsHub } from './components/prescriptions/PrescriptionsHub.js';
import { TreatmentsHub } from './components/treatments/TreatmentsHub.js';
import { RemindersHub } from './components/reminders/RemindersHub.js';
import { ReportsHub } from './components/reports/ReportsHub.js';
import { AuditLogsHub } from './components/audit/AuditLogsHub.js';
import { SettingsHub } from './components/settings/SettingsHub.js';
import { UsersHub } from './components/users/UsersHub.js';
import { PatientTrashHub } from './components/patients/PatientTrashHub.js';

// Modals
import { NewAppointmentModal } from './components/appointments/NewAppointmentModal.js';
import { RescheduleModal } from './components/appointments/RescheduleModal.js';
import { AppointmentDetailModal } from './components/appointments/AppointmentDetailModal.js';
import { NewPatientModal } from './components/patients/NewPatientModal.js';
import { PrescriptionEditorModal } from './components/prescriptions/PrescriptionEditorModal.js';
import { PrintCenterModal, PrintDocType } from './components/print/PrintCenterModal.js';

// Auth
import { LoginScreen } from './components/auth/LoginScreen.js';

import { Appointment, Prescription, User, ClinicSettings } from './types/index.js';
import { api } from './lib/api.js';

export default function App() {
  // ── Auth state ───────────────────────────────────────────────
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings | null>(null);

  // ── Navigation state ─────────────────────────────────────────
  const [currentSection, setCurrentSection] = useState<NavSection>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  // MOB-01: mobile sidebar drawer state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // GAP-03 / ACC-07: global toast system — exposed to all child hubs via props or context
  const { toasts, showToast, dismissToast } = useToast();

  // ── Modal states ─────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [newApptInitialPatientId, setNewApptInitialPatientId] = useState<string | undefined>();
  const [newApptInitialDoctorId, setNewApptInitialDoctorId] = useState<string | undefined>();
  const [newApptInitialDate, setNewApptInitialDate] = useState<string | undefined>();

  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [rescheduleAppointment, setRescheduleAppointment] = useState<Appointment | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);

  const [isNewPatientOpen, setIsNewPatientOpen] = useState(false);

  const [isNewPrescriptionOpen, setIsNewPrescriptionOpen] = useState(false);
  const [prescriptionInitialPatientId, setPrescriptionInitialPatientId] = useState<string | undefined>();

  const [isPrintCenterOpen, setIsPrintCenterOpen] = useState(false);
  const [printDocType, setPrintDocType] = useState<PrintDocType>('DailySchedule');
  const [printAppointment, setPrintAppointment] = useState<Appointment | undefined>();
  const [printPatientId, setPrintPatientId] = useState<string | undefined>();
  const [printPrescription, setPrintPrescription] = useState<Prescription | undefined>();

  // ── Bootstrap auth from cookie ───────────────────────────────
  useEffect(() => {
    api.getAuthMe()
      .then(({ user }) => {
        setCurrentUser(user ?? null);
        if (user) {
          api.getSettings().then(setClinicSettings).catch(() => {});
        }
      })
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // ── Keyboard shortcut: Ctrl+K / Cmd+K ───────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // ── Auth handlers ─────────────────────────────────────────────
  const handleLogin = useCallback(async (username: string, password: string) => {
    const { user } = await api.login(username, password);
    setCurrentUser(user);
    api.getSettings().then(setClinicSettings).catch(() => {});
  }, []);

  const handleLogout = useCallback(async () => {
    try { await api.logout(); } catch { /* ignore */ }
    setCurrentUser(null);
    setClinicSettings(null);
    setCurrentSection('dashboard');
    setSelectedPatientId(null);
  }, []);

  // ── Navigation handlers ───────────────────────────────────────
  const handleOpenNewAppointment = useCallback((patientId?: string, doctorId?: string, date?: string) => {
    setNewApptInitialPatientId(patientId);
    setNewApptInitialDoctorId(doctorId);
    setNewApptInitialDate(date);
    setIsNewAppointmentOpen(true);
  }, []);

  const handleOpenReschedule = useCallback((appointment: Appointment) => {
    setRescheduleAppointment(appointment);
    setIsRescheduleOpen(true);
  }, []);

  const handleOpenDetail = useCallback((appointment: Appointment) => {
    setDetailAppointment(appointment);
    setIsDetailOpen(true);
  }, []);

  // ── appointmentRefreshKey: incremented after a successful booking so
  //    AppointmentsHub re-fetches without a full page reload (Finding 3)
  const [appointmentRefreshKey, setAppointmentRefreshKey] = useState(0);

  // ── Status update error state (BUG-03: replaces bare alert()) ──────────────
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleUpdateAppointmentStatus = useCallback(async (appointmentId: string, newStatus: string) => {
    try {
      setStatusError(null);
      const updated = await api.updateAppointmentStatus(appointmentId, newStatus);
      setDetailAppointment(prev => (prev?.id === appointmentId ? updated : prev));
    } catch (err: any) {
      setStatusError(err.message || 'Failed to update appointment status.');
    }
  }, []);

  const handleOpenNewPrescription = useCallback((patientId?: string) => {
    setPrescriptionInitialPatientId(patientId);
    setIsNewPrescriptionOpen(true);
  }, []);

  const handleOpenPrintCenter = useCallback((
    docType: PrintDocType | string,
    appointment?: Appointment,
    patientId?: string,
    prescription?: Prescription
  ) => {
    setPrintDocType(docType as PrintDocType);
    setPrintAppointment(appointment);
    setPrintPatientId(patientId);
    setPrintPrescription(prescription);
    setIsPrintCenterOpen(true);
  }, []);

  const handleSelectPatient = useCallback((patientId: string) => {
    setSelectedPatientId(patientId);
    setCurrentSection('patients');
  }, []);

  const handleNavigate = useCallback((section: NavSection) => {
    if (section !== 'patients') setSelectedPatientId(null);
    setCurrentSection(section);
    setIsSidebarOpen(false); // MOB-01: close drawer on navigation
  }, []);

  // ── Loading screen ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-800 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Login gate ───────────────────────────────────────────────
  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // ── Main app ─────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex overflow-hidden font-sans antialiased selection:bg-blue-50 selection:text-blue-800">
      {/* ACC-06: Skip navigation link — visible on keyboard focus only */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[200] focus:bg-white focus:text-blue-800 focus:font-semibold focus:text-sm focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:ring-2 focus:ring-blue-800"
      >
        Skip to main content
      </a>

      {/* MOB-01: Mobile sidebar backdrop — tap to close */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* GAP-03: Global toast notifications — aria-live="polite" for screen readers */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <AppSidebar
        currentSection={currentSection}
        onNavigate={handleNavigate}
        onOpenPrintCenter={() => handleOpenPrintCenter('DailySchedule')}
        currentUser={{ name: currentUser.name, role: currentUser.role }}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar
          currentUser={currentUser}
          onLogout={handleLogout}
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenGlobalSearch={() => setIsSearchOpen(true)}
          onOpenNewAppointment={() => handleOpenNewAppointment()}
          onOpenNewPatient={() => setIsNewPatientOpen(true)}
          onOpenPrintCenter={(docType) => handleOpenPrintCenter(docType)}
          settings={clinicSettings ?? undefined}
          onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        />

        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-50">
          {currentSection === 'dashboard' && (
            <ReceptionistDashboard
              onOpenNewAppointment={() => handleOpenNewAppointment()}
              onOpenNewPatient={() => setIsNewPatientOpen(true)}
              onSelectAppointment={handleOpenDetail}
              onSelectPatient={handleSelectPatient}
              onRescheduleAppointment={handleOpenReschedule}
              onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
              initialSettings={clinicSettings}
            />
          )}

          {currentSection === 'appointments' && (
            <AppointmentsHub
              onOpenNewAppointment={handleOpenNewAppointment}
              onSelectAppointment={handleOpenDetail}
              onRescheduleAppointment={handleOpenReschedule}
              onOpenPrintCenter={(docType, appt) => handleOpenPrintCenter(docType, appt)}
              onSelectPatient={handleSelectPatient}
              refreshKey={appointmentRefreshKey}
            />
          )}

          {currentSection === 'patients' && (
            selectedPatientId ? (
              <PatientProfileView
                patientId={selectedPatientId}
                onBack={() => setSelectedPatientId(null)}
                onOpenNewAppointment={(ptId) => handleOpenNewAppointment(ptId)}
                onOpenNewPrescription={(ptId) => handleOpenNewPrescription(ptId)}
                onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
                onRescheduleAppointment={handleOpenReschedule}
                currentUserRole={currentUser.role}
                onPatientDeleted={() => setSelectedPatientId(null)}
              />
            ) : (
              <PatientsHub
                onSelectPatient={handleSelectPatient}
                onOpenNewPatient={() => setIsNewPatientOpen(true)}
                onOpenNewAppointment={(ptId) => handleOpenNewAppointment(ptId)}
                onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
              />
            )
          )}

          {currentSection === 'doctors'       && <DoctorsHub />}
          {currentSection === 'prescriptions' && (
            <PrescriptionsHub
              onOpenNewPrescription={handleOpenNewPrescription}
              onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
              onSelectPatient={handleSelectPatient}
            />
          )}
          {currentSection === 'treatments'    && <TreatmentsHub onSelectPatient={handleSelectPatient} />}
          {currentSection === 'reminders'     && <RemindersHub />}
          {currentSection === 'reports'       && <ReportsHub />}
          {currentSection === 'audit'         && <AuditLogsHub />}
          {currentSection === 'settings'      && <SettingsHub />}
          {currentSection === 'staff'         && <UsersHub currentUserId={currentUser.id} />}
          {currentSection === 'trash'         && <PatientTrashHub currentUserRole={currentUser.role} />}
        </main>
      </div>

      {/* ── Global Modals ──────────────────────────────────────── */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectPatient={(ptId) => { setIsSearchOpen(false); handleSelectPatient(ptId); }}
        onSelectAppointment={(appt) => { setIsSearchOpen(false); handleOpenDetail(appt); }}
      />

      <NewAppointmentModal
        isOpen={isNewAppointmentOpen}
        onClose={() => setIsNewAppointmentOpen(false)}
        onSuccess={() => {
          setIsNewAppointmentOpen(false);
          setAppointmentRefreshKey(k => k + 1);
        }}
        initialPatientId={newApptInitialPatientId}
        initialDoctorId={newApptInitialDoctorId}
        initialDate={newApptInitialDate}
      />

      {rescheduleAppointment && (
        <RescheduleModal
          isOpen={isRescheduleOpen}
          onClose={() => { setIsRescheduleOpen(false); setRescheduleAppointment(null); }}
          appointment={rescheduleAppointment}
          onSuccess={() => { setIsRescheduleOpen(false); setRescheduleAppointment(null); }}
        />
      )}

      {detailAppointment && (
        <AppointmentDetailModal
          isOpen={isDetailOpen}
          appointment={detailAppointment}
          statusError={statusError}
          onClearStatusError={() => setStatusError(null)}
          onClose={() => { setIsDetailOpen(false); setDetailAppointment(null); setStatusError(null); }}
          onSelectPatient={(ptId) => {
            setIsDetailOpen(false);
            setDetailAppointment(null);
            handleSelectPatient(ptId);
          }}
          onReschedule={(appt) => {
            setIsDetailOpen(false);
            setDetailAppointment(null);
            handleOpenReschedule(appt);
          }}
          onUpdateStatus={handleUpdateAppointmentStatus}
          onOpenPrintCenter={(docType, appt, ptId) => handleOpenPrintCenter(docType, appt, ptId)}
        />
      )}

      <NewPatientModal
        isOpen={isNewPatientOpen}
        onClose={() => setIsNewPatientOpen(false)}
        onSuccess={(newPatient) => {
          setIsNewPatientOpen(false);
          handleSelectPatient(newPatient.id);
        }}
        onSelectExistingPatient={(ptId) => {
          setIsNewPatientOpen(false);
          handleSelectPatient(ptId);
        }}
      />

      <PrescriptionEditorModal
        isOpen={isNewPrescriptionOpen}
        onClose={() => setIsNewPrescriptionOpen(false)}
        onSuccess={() => setIsNewPrescriptionOpen(false)}
        initialPatientId={prescriptionInitialPatientId}
        onOpenPrintCenter={(docType, appt, ptId, rx) => handleOpenPrintCenter(docType, appt, ptId, rx)}
      />

      <PrintCenterModal
        isOpen={isPrintCenterOpen}
        onClose={() => setIsPrintCenterOpen(false)}
        defaultDocType={printDocType}
        selectedAppointment={printAppointment}
        selectedPatientId={printPatientId}
        selectedPrescription={printPrescription}
      />
    </div>
  );
}
