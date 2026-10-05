import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  ShieldAlert,
  Plus,
  Printer,
  CalendarPlus,
  FileText,
  Stethoscope,
  Trash2,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
  Pencil,
  X,
  Save,
} from 'lucide-react';
import { Patient, PatientFull, ToothCondition, Appointment, Treatment, Prescription, Visit, MedicalHistory, Allergy, Gender, BloodGroup, UserRole } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { BLOOD_GROUPS, GENDER_OPTIONS } from '../../lib/constants.js';
import { formatDate, formatTime, calculateAge, getStatusBadgeClasses } from '../../lib/utils.js';
import { DentalChart } from './DentalChart.js';
import { XRaysTab } from './XRaysTab.js';
import { ConfirmDialog } from '../ui/Toast.js';

interface PatientProfileViewProps {
  patientId: string;
  onBack: () => void;
  onOpenNewAppointment: (patientId: string) => void;
  onOpenNewPrescription: (patientId: string) => void;
  onOpenPrintCenter: (docType: string, appointment?: Appointment, patientId?: string, prescription?: Prescription) => void;
  onRescheduleAppointment: (appointment: Appointment) => void;
  currentUserRole?: UserRole;
  onPatientDeleted?: () => void;
}

type TabType = 'overview' | 'dental-chart' | 'medical' | 'allergies' | 'appointments' | 'treatments' | 'prescriptions' | 'visits' | 'xrays';


export const PatientProfileView: React.FC<PatientProfileViewProps> = ({
  patientId,
  onBack,
  onOpenNewAppointment,
  onOpenNewPrescription,
  onOpenPrintCenter,
  onRescheduleAppointment,
  currentUserRole,
  onPatientDeleted,
}) => {
  // DEBT-02: properly typed — replaces useState<any>(null)
  const [patient, setPatient] = useState<PatientFull | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  // BUG-11: separate load error state so "Loading…" doesn't show forever on fetch failure
  const [loadError, setLoadError] = useState('');

  // ── Delete-to-trash state ────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ── Edit Profile state ──────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editSaved, setEditSaved] = useState(false);
  const [editError, setEditError] = useState('');

  // Edit form fields
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAlternatePhone, setEditAlternatePhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editDateOfBirth, setEditDateOfBirth] = useState('');
  const [editGender, setEditGender] = useState<Gender>('MALE');
  const [editBloodGroup, setEditBloodGroup] = useState<BloodGroup>('UNKNOWN');
  const [editOccupation, setEditOccupation] = useState('');
  const [editEmergencyName, setEditEmergencyName] = useState('');
  const [editEmergencyPhone, setEditEmergencyPhone] = useState('');
  const [editEmergencyRelation, setEditEmergencyRelation] = useState('');
  const [editGeneralNotes, setEditGeneralNotes] = useState('');

  // ── Other inline form states ────────────────────────────────
  const [availableDoctors, setAvailableDoctors] = useState<any[]>([]);
  const [allergyToDelete, setAllergyToDelete] = useState<string | null>(null);

  const [showAddMedicalModal, setShowAddMedicalModal] = useState(false);
  const [newConditionName, setNewConditionName] = useState('');
  const [newConditionNotes, setNewConditionNotes] = useState('');

  const [showAddAllergyModal, setShowAddAllergyModal] = useState(false);
  const [newAllergen, setNewAllergen] = useState('');
  const [newAllergySeverity, setNewAllergySeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'SEVERE'>('HIGH');
  const [newAllergyReaction, setNewAllergyReaction] = useState('');

  const [showAddTreatmentModal, setShowAddTreatmentModal] = useState(false);
  const [newTreatmentName, setNewTreatmentName] = useState('Dental Composite Restoration');
  const [newToothNumber, setNewToothNumber] = useState<number | undefined>(undefined);
  const [newTreatmentCost, setNewTreatmentCost] = useState(150);
  const [newTreatmentNotes, setNewTreatmentNotes] = useState('');
  // BUG-01: doctor selector for treatment form
  const [newTreatmentDoctorId, setNewTreatmentDoctorId] = useState('');

  const [showAddVisitModal, setShowAddVisitModal] = useState(false);
  const [newVisitChiefComplaint, setNewVisitChiefComplaint] = useState('');
  const [newVisitClinicalNotes, setNewVisitClinicalNotes] = useState('');
  const [newVisitDiagnosis, setNewVisitDiagnosis] = useState('');
  // BUG-01: doctor selector for visit form
  const [newVisitDoctorId, setNewVisitDoctorId] = useState('');

  // BUG-01: per-modal error state so inline API failures are surfaced to the user
  const [medicalModalError, setMedicalModalError] = useState('');
  const [allergyModalError, setAllergyModalError] = useState('');
  const [treatmentModalError, setTreatmentModalError] = useState('');
  const [visitModalError, setVisitModalError] = useState('');

  // ── Load patient ─────────────────────────────────────────────
  const loadPatientData = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const [data, docs] = await Promise.all([
        api.getPatientById(patientId),
        api.getDoctors(false),
      ]);
      setPatient(data);
      setAvailableDoctors(docs);
      // Pre-select first doctor for the inline forms
      if (docs.length > 0) {
        setNewTreatmentDoctorId(prev => prev || docs[0].id);
        setNewVisitDoctorId(prev => prev || docs[0].id);
      }
    } catch (err: any) {
      // BUG-11: expose load failure instead of leaving UI stuck on "Loading…"
      setLoadError(err?.message || 'Failed to load patient record.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatientData();
  }, [patientId]);

  // Populate edit form whenever patient data loads
  useEffect(() => {
    if (patient) {
      setEditFirstName(patient.firstName || '');
      setEditLastName(patient.lastName || '');
      setEditPhone(patient.phone || '');
      setEditAlternatePhone(patient.alternatePhone || '');
      setEditEmail(patient.email || '');
      setEditAddress(patient.address || '');
      setEditDateOfBirth(patient.dateOfBirth || '');
      setEditGender(patient.gender || 'MALE');
      setEditBloodGroup(patient.bloodGroup || 'UNKNOWN');
      setEditOccupation(patient.occupation || '');
      setEditEmergencyName(patient.emergencyContactName || '');
      setEditEmergencyPhone(patient.emergencyContactPhone || '');
      setEditEmergencyRelation(patient.emergencyContactRelation || '');
      setEditGeneralNotes(patient.generalMedicalNotes || '');
    }
  }, [patient]);

  // ── Edit handlers ─────────────────────────────────────────────
  const handleOpenEdit = () => { setIsEditing(true); setEditError(''); };
  const handleCancelEdit = () => { setIsEditing(false); setEditError(''); };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFirstName || !editLastName || !editPhone) return;
    try {
      setEditSaving(true);
      await api.updatePatient(patientId, {
        firstName: editFirstName,
        lastName: editLastName,
        phone: editPhone,
        alternatePhone: editAlternatePhone || undefined,
        email: editEmail || undefined,
        address: editAddress || undefined,
        dateOfBirth: editDateOfBirth,
        gender: editGender,
        bloodGroup: editBloodGroup,
        occupation: editOccupation || undefined,
        emergencyContactName: editEmergencyName || undefined,
        emergencyContactPhone: editEmergencyPhone || undefined,
        emergencyContactRelation: editEmergencyRelation || undefined,
        generalMedicalNotes: editGeneralNotes || undefined,
      });
      setEditSaved(true);
      setTimeout(() => setEditSaved(false), 3000);
      setIsEditing(false);
      await loadPatientData();
    } catch (err: any) {
      setEditError(`Failed to save changes: ${err.message}`);
    } finally {
      setEditSaving(false);
    }
  };

  // ── Tooth chart ──────────────────────────────────────────────
  const handleUpdateToothCondition = async (toothNumber: number, condition: ToothCondition, notes?: string) => {
    const updated = await api.updateToothCondition(patientId, toothNumber, condition, notes);
    // Optimistic update: replace or add the entry in dentalHistory
    setPatient((prev: any) => {
      if (!prev) return prev;
      const exists = prev.dentalHistory?.some((d: any) => d.toothNumber === toothNumber);
      const newHistory = exists
        ? prev.dentalHistory.map((d: any) => d.toothNumber === toothNumber ? updated : d)
        : [...(prev.dentalHistory || []), updated];
      return { ...prev, dentalHistory: newHistory };
    });
  };

  // ── Medical History ──────────────────────────────────────────
  const handleAddMedicalHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConditionName) return;
    setMedicalModalError('');
    try {
      const newItem = await api.addMedicalHistory(patientId, {
        condition: newConditionName,
        notes: newConditionNotes,
        diagnosedAt: new Date().toISOString().split('T')[0],
      });
      setPatient((prev: any) => prev ? ({
        ...prev,
        medicalHistory: [newItem, ...(prev.medicalHistory || [])],
      }) : prev);
      setNewConditionName('');
      setNewConditionNotes('');
      setShowAddMedicalModal(false);
    } catch (err: any) {
      setMedicalModalError(err?.message || 'Failed to save condition. Please try again.');
    }
  };

  // ── Allergies ────────────────────────────────────────────────
  const handleAddAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAllergen) return;
    setAllergyModalError('');
    try {
      const newItem = await api.addAllergy(patientId, {
        allergen: newAllergen,
        severity: newAllergySeverity,
        reaction: newAllergyReaction,
      });
      setPatient((prev: any) => {
        if (!prev) return prev;
        const allergyList = [...(prev.allergyList || []), newItem];
        const allergies = allergyList.map((a: any) => `${a.allergen} (${a.severity})`).join(', ');
        return { ...prev, allergyList, allergies };
      });
      setNewAllergen('');
      setNewAllergyReaction('');
      setShowAddAllergyModal(false);
    } catch (err: any) {
      setAllergyModalError(err?.message || 'Failed to save allergy. Please try again.');
    }
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    try {
      await api.deleteAllergy(allergyId);
      setPatient((prev: any) => {
        if (!prev) return prev;
        const allergyList = (prev.allergyList || []).filter((a: any) => a.id !== allergyId);
        const allergies = allergyList.length
          ? allergyList.map((a: any) => `${a.allergen} (${a.severity})`).join(', ')
          : null;
        return { ...prev, allergyList, allergies };
      });
    } catch (err: any) {
      // Surface delete error — allergyToDelete confirm dialog will stay open
      setAllergyModalError(err?.message || 'Failed to delete allergy. Please try again.');
    }
  };
  // ── Treatment ────────────────────────────────────────────────
  const handleAddTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    const doctorId = newTreatmentDoctorId || availableDoctors[0]?.id || '';
    if (!doctorId) return;
    setTreatmentModalError('');
    try {
      const newTreatment = await api.createTreatment({
        patientId,
        doctorId,
        treatmentName: newTreatmentName,
        toothNumber: newToothNumber ? Number(newToothNumber) : undefined,
        cost: Number(newTreatmentCost),
        notes: newTreatmentNotes,
        status: 'PLANNED',
      });
      setPatient((prev: any) => prev ? ({
        ...prev,
        treatments: [newTreatment, ...(prev.treatments || [])],
      }) : prev);
      setShowAddTreatmentModal(false);
      setNewTreatmentName('Dental Composite Restoration');
      setNewToothNumber(undefined);
      setNewTreatmentCost(150);
      setNewTreatmentNotes('');
    } catch (err: any) {
      setTreatmentModalError(err?.message || 'Failed to create treatment. Please try again.');
    }
  };

  // ── Visit ────────────────────────────────────────────────────
  const handleAddVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const doctorId = newVisitDoctorId || availableDoctors[0]?.id || '';
    if (!doctorId) return;
    setVisitModalError('');
    try {
      const newVisit = await api.createVisit({
        patientId,
        doctorId,
        visitDate: new Date().toISOString().split('T')[0],
        chiefComplaint: newVisitChiefComplaint,
        clinicalNotes: newVisitClinicalNotes,
        diagnosis: newVisitDiagnosis,
      });
      setPatient((prev: any) => prev ? ({
        ...prev,
        visits: [newVisit, ...(prev.visits || [])],
      }) : prev);
      setShowAddVisitModal(false);
      setNewVisitChiefComplaint('');
      setNewVisitClinicalNotes('');
      setNewVisitDiagnosis('');
    } catch (err: any) {
      setVisitModalError(err?.message || 'Failed to record visit. Please try again.');
    }
  };

  // ── Delete to trash handler ──────────────────────────────────
  const handleDeleteToTrash = async () => {
    if (!patient) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.deletePatient(patient.id);
      onPatientDeleted?.();
      onBack();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to move patient to trash.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading patient clinical chart...
      </div>
    );
  }

  // BUG-11: show error + back button instead of hanging "Loading…" when fetch fails
  if (loadError || !patient) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-rose-700">
          {loadError || 'Patient record not found.'}
        </p>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patients Directory</span>
        </button>
      </div>
    );
  }

  const age = calculateAge(patient.dateOfBirth);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Back Navigation Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Patients Directory</span>
        </button>

        <div className="flex items-center gap-2">
          {editSaved && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Profile saved
            </span>
          )}
          <button
            onClick={() => onOpenPrintCenter('PatientHistory', undefined, patient.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium border border-slate-300 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Card</span>
          </button>
          <button
            onClick={() => onOpenNewPrescription(patient.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-blue-800 rounded-lg text-xs font-medium border border-blue-200 shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-blue-800" />
            <span>+ Prescription</span>
          </button>
          <button
            onClick={() => onOpenNewAppointment(patient.id)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs"
          >
            <CalendarPlus className="w-3.5 h-3.5" />
            <span>+ Appointment</span>
          </button>
          {/* Delete to trash — available to ADMIN and RECEPTIONIST */}
          {(currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTIONIST') && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 rounded-lg text-xs font-medium border border-rose-200 shadow-2xs"
              title="Move patient to trash"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Allergy Alert Banner ──────────────────────────────── */}
      {(patient.allergies || (patient.allergyList && patient.allergyList.length > 0)) && (
        <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl text-rose-900 flex items-start gap-3 shadow-xs">
          <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-sm tracking-tight text-rose-950 uppercase block">
              CRITICAL MEDICAL ALERT / ALLERGY WARNING
            </span>
            <p className="mt-0.5 text-rose-900 font-medium">
              Documented allergy:{' '}
              <strong className="underline text-rose-950">
                {patient.allergies || patient.allergyList?.map((a: any) => a.allergen).join(', ')}
              </strong>. Avoid prescribing or administering contraindicated anesthetics/materials.
            </p>
          </div>
        </div>
      )}

      {/* ── Patient Header Card ───────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          {/* Left: identity */}
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-blue-800 text-white font-bold text-xl flex items-center justify-center shadow-xs shrink-0">
              {patient.firstName.charAt(0)}{patient.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">
                  {patient.firstName} {patient.lastName}
                </h1>
                <span className="font-mono text-xs font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {patient.patientNumber}
                </span>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {patient.gender} · {age}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-600 mt-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {patient.phone}
                </span>
                {patient.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {patient.email}
                  </span>
                )}
                <span>DOB: <strong>{formatDate(patient.dateOfBirth)}</strong></span>
                <span>Blood: <strong className="text-rose-700">{patient.bloodGroup}</strong></span>
              </div>
            </div>
          </div>

          {/* Right: emergency contact + Edit button */}
          <div className="flex items-start gap-4 shrink-0">
            <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-6 text-xs space-y-1 text-slate-600 min-w-[200px]">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Emergency Contact</span>
                <span className="font-semibold text-slate-800">{patient.emergencyContactName || 'None listed'}</span>
                {patient.emergencyContactPhone && (
                  <span className="text-slate-500 block font-mono">{patient.emergencyContactPhone}</span>
                )}
                {patient.emergencyContactRelation && (
                  <span className="text-slate-400 text-[10px]">({patient.emergencyContactRelation})</span>
                )}
              </div>
              {patient.occupation && (
                <div className="pt-1">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Occupation</span>
                  <span>{patient.occupation}</span>
                </div>
              )}
            </div>

            <button
              onClick={handleOpenEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────── */}
      <div className="border-b border-slate-200 bg-white rounded-t-xl px-4 flex gap-2 overflow-x-auto text-xs font-medium text-slate-600">
        {[
          { id: 'overview',      label: 'Overview' },
          { id: 'dental-chart',  label: 'Dental Chart (32 Teeth)' },
          { id: 'medical',       label: `Medical History (${patient.medicalHistory?.length || 0})` },
          { id: 'allergies',     label: `Allergies (${patient.allergyList?.length || (patient.allergies ? 1 : 0)})` },
          { id: 'appointments',  label: `Appointments (${patient.appointments?.length || 0})` },
          { id: 'treatments',    label: `Treatments (${patient.treatments?.length || 0})` },
          { id: 'prescriptions', label: `Prescriptions (${patient.prescriptions?.length || 0})` },
          { id: 'visits',        label: `Clinical Visits (${patient.visits?.length || 0})` },
          { id: 'xrays',         label: `X-Rays (${patient.xrays?.length || 0})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`py-3 px-3 border-b-2 font-semibold transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-blue-800 text-blue-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Contents ─────────────────────────────────────── */}
      <div className="bg-white rounded-b-xl border border-t-0 border-slate-200 p-6 shadow-2xs min-h-[400px]">

        {/* 1. OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Next Appointment */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Next Appointment</span>
                {patient.appointments?.filter((a: any) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED').length > 0 ? (
                  (() => {
                    const next = patient.appointments.filter((a: any) => a.status !== 'COMPLETED' && a.status !== 'CANCELLED')[0];
                    return (
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{next.appointmentType}</div>
                        <div className="text-xs text-slate-600 mt-1">{formatDate(next.appointmentDate)} at {formatTime(next.startTime)}</div>
                        <div className="text-[11px] text-slate-500">{next.doctor?.fullName}</div>
                        <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeClasses(next.status)}`}>{next.status}</span>
                      </div>
                    );
                  })()
                ) : (
                  <div className="text-xs text-slate-400 py-2">
                    No active upcoming appointments.
                    <button onClick={() => onOpenNewAppointment(patient.id)} className="text-blue-800 block font-semibold mt-1 hover:underline">+ Schedule now</button>
                  </div>
                )}
              </div>

              {/* Active Treatments */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Active / Planned Treatments</span>
                {patient.treatments?.filter((t: any) => t.status !== 'COMPLETED').length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {patient.treatments.filter((t: any) => t.status !== 'COMPLETED').map((t: any) => (
                      <div key={t.id} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200">
                        <div>
                          <span className="font-semibold text-slate-800">{t.treatmentName}</span>
                          {t.toothNumber && <span className="ml-1 text-[10px] text-slate-500 font-mono">(#{t.toothNumber})</span>}
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">{t.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-2">No active treatment plans.</div>
                )}
              </div>

              {/* Recent Prescription */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Recent Prescription</span>
                {patient.prescriptions?.length > 0 ? (
                  <div className="text-xs space-y-1">
                    <div className="font-semibold text-slate-800">{patient.prescriptions[0].diagnosis || 'General Dental Rx'}</div>
                    <div className="text-[11px] text-slate-500">{formatDate(patient.prescriptions[0].prescriptionDate)} · {patient.prescriptions[0].doctor?.fullName}</div>
                    <div className="text-[11px] text-slate-600 mt-1 font-mono">{patient.prescriptions[0].items?.length || 0} medications</div>
                    <button
                      onClick={() => onOpenPrintCenter('Prescription', undefined, patient.id, patient.prescriptions[0])}
                      className="text-blue-800 font-medium text-[11px] hover:underline flex items-center gap-1 mt-1"
                    >
                      <Printer className="w-3 h-3" /><span>Print Rx Pad</span>
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-2">No prescriptions issued yet.</div>
                )}
              </div>
            </div>

            {/* Dental chart summary */}
            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dental Chart Summary</h3>
                <button onClick={() => setActiveTab('dental-chart')} className="text-xs text-blue-800 font-semibold hover:underline">Open Full 32-Tooth Chart →</button>
              </div>
              <div className="flex flex-wrap gap-2 text-xs pt-1">
                {patient.dentalHistory?.length > 0 ? (
                  patient.dentalHistory.map((d: any) => (
                    <span key={d.id} className="px-2 py-1 rounded bg-slate-100 border border-slate-200 text-[11px] font-mono">
                      #{d.toothNumber}: <strong>{d.condition}</strong>
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs">All teeth in healthy baseline condition.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. DENTAL CHART */}
        {activeTab === 'dental-chart' && (
          <DentalChart
            patientId={patient.id}
            dentalHistory={patient.dentalHistory || []}
            onUpdateToothCondition={handleUpdateToothCondition}
          />
        )}

        {/* 3. MEDICAL HISTORY */}
        {activeTab === 'medical' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Systemic Conditions & Medical History</h3>
              <button onClick={() => setShowAddMedicalModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Add Condition</span>
              </button>
            </div>
            {patient.medicalHistory?.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {patient.medicalHistory.map((m: any) => (
                  <div key={m.id} className="p-3 bg-white flex items-center justify-between">
                    <div>
                      {/* BUG-07: PatientMedicalHistory has 'condition', not 'conditionName' */}
                      <div className="font-semibold text-slate-800">{m.condition}</div>
                      {m.notes && <div className="text-slate-600 text-[11px] mt-0.5">{m.notes}</div>}
                    </div>
                    <div className="text-right text-[10px] text-slate-400 font-mono">
                      {formatDate(m.diagnosedAt || m.createdAt)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">No chronic or systemic medical conditions recorded.</div>
            )}
          </div>
        )}

        {/* 4. ALLERGIES */}
        {activeTab === 'allergies' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Known Allergies & Adverse Drug Reactions</h3>
                <p className="text-[11px] text-slate-500">Allergy records trigger clinic-wide prescription and operatory warnings.</p>
              </div>
              <button onClick={() => setShowAddAllergyModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-medium shadow-xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Add Allergy</span>
              </button>
            </div>
            {patient.allergyList?.length > 0 ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100">
                {patient.allergyList.map((a: any) => (
                  <div key={a.id} className="p-3 bg-rose-50/40 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-rose-900 flex items-center gap-2">
                        <span>{a.allergen}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">{a.severity}</span>
                      </div>
                      {(a.reaction || a.reactionNotes) && (
                        <div className="text-rose-800 text-[11px] mt-0.5">Reaction: {a.reaction || a.reactionNotes}</div>
                      )}
                    </div>
                    <button onClick={() => setAllergyToDelete(a.id)} className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-100" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">No drug or material allergies recorded for this patient.</div>
            )}
          </div>
        )}

        {/* 5. APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Appointments History</h3>
              <button onClick={() => onOpenNewAppointment(patient.id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs">
                <CalendarPlus className="w-3.5 h-3.5" /><span>+ Schedule New</span>
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-semibold">
                    <th className="py-2.5 px-3">Date & Time</th>
                    <th className="py-2.5 px-3">Doctor</th>
                    <th className="py-2.5 px-3">Procedure</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patient.appointments?.length > 0 ? patient.appointments.map((appt: any) => (
                    <tr key={appt.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{formatDate(appt.appointmentDate)}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{formatTime(appt.startTime)} – {formatTime(appt.endTime)}</div>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">{appt.doctor?.fullName}</td>
                      <td className="py-2.5 px-3">{appt.appointmentType}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeClasses(appt.status)}`}>{appt.status}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => onOpenPrintCenter('AppointmentCard', appt, patient.id)} className="p-1 hover:bg-slate-200 text-slate-600 rounded" title="Print Card">
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">No appointments found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6. TREATMENTS */}
        {activeTab === 'treatments' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Treatments & Clinical Procedures</h3>
              <button onClick={() => setShowAddTreatmentModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Add Treatment</span>
              </button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 border-b border-slate-200 text-[11px] uppercase font-semibold">
                    <th className="py-2.5 px-3">Procedure</th>
                    <th className="py-2.5 px-3">Tooth #</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Cost</th>
                    <th className="py-2.5 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {patient.treatments?.length > 0 ? patient.treatments.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{t.treatmentName}</td>
                      <td className="py-2.5 px-3 font-mono">{t.toothNumber ? `#${t.toothNumber}` : '—'}</td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusBadgeClasses(t.status)}`}>{t.status}</span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">${t.cost || 0}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500">{formatDate(t.createdAt)}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">No treatments logged.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 7. PRESCRIPTIONS */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Prescriptions & Medication Orders</h3>
              <button onClick={() => onOpenNewPrescription(patient.id)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Issue Prescription</span>
              </button>
            </div>
            {patient.prescriptions?.length > 0 ? (
              <div className="space-y-3">
                {patient.prescriptions.map((rx: any) => (
                  <div key={rx.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-bold text-slate-900 text-xs">Diagnosis: {rx.diagnosis || 'Clinical Dental Rx'}</span>
                        <span className="text-[11px] text-slate-500 block">{rx.doctor?.fullName} — {formatDate(rx.prescriptionDate)}</span>
                      </div>
                      <button onClick={() => onOpenPrintCenter('Prescription', undefined, patient.id, rx)} className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
                        <Printer className="w-3.5 h-3.5" /><span>Print Rx</span>
                      </button>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                            <th className="py-1.5 px-3">Medicine & Strength</th>
                            <th className="py-1.5 px-3">Dosage & Frequency</th>
                            <th className="py-1.5 px-3">Duration</th>
                            <th className="py-1.5 px-3">Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {rx.items?.map((item: any) => (
                            <tr key={item.id}>
                              <td className="py-1.5 px-3 font-semibold text-slate-800">{item.medicineName} {item.strength}</td>
                              <td className="py-1.5 px-3 font-mono">{item.dosage} ({item.frequency})</td>
                              <td className="py-1.5 px-3">{item.duration}</td>
                              <td className="py-1.5 px-3 text-slate-600">{item.instructions || 'As directed'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">No prescriptions issued for this patient.</div>
            )}
          </div>
        )}

        {/* 8. VISITS */}
        {activeTab === 'visits' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Consultation Visits & Clinical Notes</h3>
              <button onClick={() => setShowAddVisitModal(true)} className="flex items-center gap-1 px-3 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs">
                <Plus className="w-3.5 h-3.5" /><span>+ Record Visit</span>
              </button>
            </div>
            {patient.visits?.length > 0 ? (
              <div className="space-y-3">
                {patient.visits.map((v: any) => (
                  <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 border-b border-slate-100 pb-1.5">
                      <span className="font-bold text-slate-800">{formatDate(v.visitDate)}</span>
                      <span>{v.doctor?.fullName}</span>
                    </div>
                    {v.chiefComplaint && <div><span className="font-semibold text-slate-700 text-[11px] block">Chief Complaint:</span><p className="text-slate-800">{v.chiefComplaint}</p></div>}
                    {v.diagnosis && <div><span className="font-semibold text-slate-700 text-[11px] block">Diagnosis:</span><p className="text-slate-800">{v.diagnosis}</p></div>}
                    {v.clinicalNotes && (
                      <div className="bg-slate-50 p-2.5 rounded border border-slate-200">
                        <span className="font-semibold text-slate-700 text-[11px] block">Clinical Notes:</span>
                        <p className="text-slate-700">{v.clinicalNotes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400">No clinical consultation visits recorded.</div>
            )}
          </div>
        )}

        {/* 9. X-RAYS */}
        {activeTab === 'xrays' && (
          <XRaysTab
            patientId={patient.id}
            xrays={patient.xrays || []}
            onXRaysChange={(updated) =>
              setPatient(prev => prev ? { ...prev, xrays: updated } : prev)
            }
          />
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          EDIT PATIENT PROFILE MODAL
      ═══════════════════════════════════════════════════════════ */}
      {isEditing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-blue-800" />
                <div>
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Edit Patient Profile</h2>
                  <p className="text-[11px] text-slate-500">{patient.firstName} {patient.lastName} · {patient.patientNumber}</p>
                </div>
              </div>
              <button onClick={handleCancelEdit} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveEdit} className="overflow-y-auto flex-1 p-5 space-y-5 text-xs">

              {/* Section 1: Basic Demographics */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 pb-1 border-b border-slate-100">
                  1. Basic Demographics & Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">First Name *</label>
                    <input type="text" required value={editFirstName} onChange={e => setEditFirstName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Last Name *</label>
                    <input type="text" required value={editLastName} onChange={e => setEditLastName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Primary Phone *</label>
                    <input type="tel" required value={editPhone} onChange={e => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Alternate Phone</label>
                    <input type="tel" value={editAlternatePhone} onChange={e => setEditAlternatePhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                    <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Date of Birth *</label>
                    <input type="date" required value={editDateOfBirth} onChange={e => setEditDateOfBirth(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Gender *</label>
                    <select value={editGender} onChange={e => setEditGender(e.target.value as Gender)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none">
                      {GENDER_OPTIONS.map(g => (
                        <option key={g.value} value={g.value}>{g.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Blood Group</label>
                    <select value={editBloodGroup} onChange={e => setEditBloodGroup(e.target.value as BloodGroup)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none">
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Occupation</label>
                    <input type="text" value={editOccupation} onChange={e => setEditOccupation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="font-semibold text-slate-700 block mb-1">Residential Address</label>
                    <input type="text" value={editAddress} onChange={e => setEditAddress(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Section 2: Emergency Contact */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 pb-1 border-b border-slate-100">
                  2. Emergency Contact
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Name</label>
                    <input type="text" value={editEmergencyName} onChange={e => setEditEmergencyName(e.target.value)} placeholder="e.g. Jane Smith"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Contact Phone</label>
                    <input type="tel" value={editEmergencyPhone} onChange={e => setEditEmergencyPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">Relationship</label>
                    <input type="text" value={editEmergencyRelation} onChange={e => setEditEmergencyRelation(e.target.value)} placeholder="e.g. Spouse, Parent"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Section 3: Medical notes */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 pb-1 border-b border-slate-100">
                  3. General Medical Notes
                </div>
                <textarea
                  rows={3}
                  value={editGeneralNotes}
                  onChange={e => setEditGeneralNotes(e.target.value)}
                  placeholder="e.g. Controlled hypertension, Type 2 Diabetes on Metformin, no bleeding disorders"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-blue-800 focus:outline-none"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Note: Drug allergies are managed in the Allergies tab. This field is for systemic conditions only.
                </p>
              </div>
            </form>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2.5 shrink-0">
              {editError && (
                <p className="text-xs text-rose-700 flex-1">{editError}</p>
              )}
              <div className="flex items-center justify-end gap-2.5 ml-auto">
                <button type="button" onClick={handleCancelEdit} disabled={editSaving}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium disabled:opacity-50">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit as any}
                  disabled={editSaving}
                  className="px-5 py-2 bg-blue-800 hover:bg-blue-900 disabled:opacity-50 text-white rounded-lg text-xs font-medium shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{editSaving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add Medical Condition ─────────────────────── */}
      {showAddMedicalModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddMedicalHistory} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800">Add Medical Condition</h3>
            <div>
              <label htmlFor="med-condition" className="block font-semibold text-slate-700 mb-1">Condition Name *</label>
              <input id="med-condition" type="text" required placeholder="e.g. Type 2 Diabetes, Hypertension" value={newConditionName} onChange={e => setNewConditionName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <div>
              <label htmlFor="med-notes" className="block font-semibold text-slate-700 mb-1">Clinical Notes</label>
              <textarea id="med-notes" rows={2} value={newConditionNotes} onChange={e => setNewConditionNotes(e.target.value)} placeholder="e.g. Managed with Metformin, stable"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            {medicalModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">{medicalModalError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAddMedicalModal(false); setMedicalModalError(''); }} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-800 text-white rounded font-medium">Save Condition</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Add Allergy ───────────────────────────────── */}
      {showAddAllergyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddAllergy} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-rose-900">Add Allergy / Contraindication</h3>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Allergen / Drug *</label>
              <input type="text" required placeholder="e.g. Penicillin, Latex, Aspirin" value={newAllergen} onChange={e => setNewAllergen(e.target.value)}
                className="w-full p-2 border border-rose-300 rounded-lg text-xs text-rose-900" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Severity</label>
              <select value={newAllergySeverity} onChange={e => setNewAllergySeverity(e.target.value as any)} className="w-full p-2 border border-slate-300 rounded-lg text-xs">
                <option value="LOW">Low (Mild rash)</option>
                <option value="MEDIUM">Medium (Hives, swelling)</option>
                <option value="HIGH">High (Severe reaction)</option>
                <option value="SEVERE">Severe (Anaphylaxis)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Known Reaction</label>
              <input type="text" value={newAllergyReaction} onChange={e => setNewAllergyReaction(e.target.value)} placeholder="e.g. Facial edema, urticaria"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            {allergyModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">{allergyModalError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAddAllergyModal(false); setAllergyModalError(''); }} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-rose-600 text-white rounded font-medium">Record Allergy Alert</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Add Treatment ─────────────────────────────── */}
      {showAddTreatmentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddTreatment} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800">Add Planned Treatment</h3>
            {/* BUG-01: Doctor selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attending Doctor *</label>
              <select value={newTreatmentDoctorId} onChange={e => setNewTreatmentDoctorId(e.target.value)} required
                className="w-full p-2 border border-slate-300 rounded-lg text-xs">
                {availableDoctors.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName} ({d.specialization})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Procedure Name *</label>
              <input type="text" required value={newTreatmentName} onChange={e => setNewTreatmentName(e.target.value)}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tooth # (Optional)</label>
                <input type="number" min={1} max={32} value={newToothNumber || ''} onChange={e => setNewToothNumber(e.target.value ? Number(e.target.value) : undefined)} placeholder="e.g. 19"
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Cost ($)</label>
                <input type="number" value={newTreatmentCost} onChange={e => setNewTreatmentCost(Number(e.target.value))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono" />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Notes</label>
              <textarea rows={2} value={newTreatmentNotes} onChange={e => setNewTreatmentNotes(e.target.value)} placeholder="e.g. Class I composite, shade A2"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            {treatmentModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">{treatmentModalError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAddTreatmentModal(false); setTreatmentModalError(''); }} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-800 text-white rounded font-medium">Add to Plan</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Modal: Add Visit ─────────────────────────────────── */}
      {showAddVisitModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddVisit} className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-5 space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800">Record Clinical Consultation Visit</h3>
            {/* BUG-01: Doctor selector */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attending Doctor *</label>
              <select value={newVisitDoctorId} onChange={e => setNewVisitDoctorId(e.target.value)} required
                className="w-full p-2 border border-slate-300 rounded-lg text-xs">
                {availableDoctors.map(d => (
                  <option key={d.id} value={d.id}>{d.fullName} ({d.specialization})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Chief Complaint *</label>
              <input type="text" required value={newVisitChiefComplaint} onChange={e => setNewVisitChiefComplaint(e.target.value)} placeholder="e.g. Sensitivity on cold drinks, lower molar"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Diagnosis</label>
              <input type="text" value={newVisitDiagnosis} onChange={e => setNewVisitDiagnosis(e.target.value)} placeholder="e.g. Reversible Pulpitis, Tooth #19"
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Clinical Notes & Findings</label>
              <textarea rows={3} value={newVisitClinicalNotes} onChange={e => setNewVisitClinicalNotes(e.target.value)} placeholder="Operatory findings, periodontal probing, radiograph notes..."
                className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
            </div>
            {visitModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-rose-800 text-xs">{visitModalError}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setShowAddVisitModal(false); setVisitModalError(''); }} className="px-3 py-1.5 bg-slate-100 rounded text-slate-700">Cancel</button>
              <button type="submit" className="px-4 py-1.5 bg-blue-800 text-white rounded font-medium">Record Visit</button>
            </div>
          </form>
        </div>
      )}
      {/* ── Allergy Delete Confirmation ───────────────────────── */}
      <ConfirmDialog
        isOpen={allergyToDelete !== null}
        title="Remove Allergy Record"
        message="This will permanently remove this allergy alert from the patient's file. Clinical warnings dependent on this record will be cleared."
        confirmLabel="Remove Allergy"
        cancelLabel="Keep It"
        variant="danger"
        onConfirm={async () => {
          if (allergyToDelete) await handleDeleteAllergy(allergyToDelete);
          setAllergyToDelete(null);
        }}
        onCancel={() => setAllergyToDelete(null)}
      />

      {/* ── Delete Patient to Trash Confirmation ─────────────── */}
      {deleteError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-300 rounded-xl shadow-lg text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{deleteError}</span>
          <button onClick={() => setDeleteError('')} className="ml-2 text-rose-400 hover:text-rose-700">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmDelete}
        title="Move Patient to Trash"
        message={`This will move ${patient?.firstName ?? ''} ${patient?.lastName ?? ''} (${patient?.patientNumber ?? ''}) to the trash. All clinical records are preserved. You can restore this patient from the Patient Trash section.`}
        confirmLabel={deleting ? 'Moving to trash…' : 'Move to Trash'}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteToTrash}
        onCancel={() => { setConfirmDelete(false); setDeleteError(''); }}
      />
    </div>
  );
};
