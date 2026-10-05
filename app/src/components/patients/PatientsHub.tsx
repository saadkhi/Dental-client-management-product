import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  Phone,
  ShieldAlert,
  CalendarPlus,
  Printer,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Patient, BloodGroup } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { calculateAge, formatDate } from '../../lib/utils.js';
import { BLOOD_GROUPS_WITH_ALL } from '../../lib/constants.js';
import { ConfirmDialog } from '../ui/Toast.js';

interface PatientsHubProps {
  onSelectPatient: (patientId: string) => void;
  onOpenNewPatient: () => void;
  onOpenNewAppointment: (patientId: string) => void;
  onOpenPrintCenter: (docType: string, appointment?: any, patientId?: string) => void;
}



export const PatientsHub: React.FC<PatientsHubProps> = ({
  onSelectPatient,
  onOpenNewPatient,
  onOpenNewAppointment,
  onOpenPrintCenter
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [bloodGroupFilter, setBloodGroupFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleteError, setDeleteError] = useState('');

  const handleDeleteToTrash = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePatient(deleteTarget.id);
      setPatients(prev => prev.filter(p => p.id !== deleteTarget.id));
      setTotal(prev => prev - 1);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to move patient to trash.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const loadPatients = async () => {
    try {
      setLoading(true);
      const res = await api.getPatients(searchQuery, 100);
      setPatients(res.patients);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // PERF-03: increased from 200ms to 500ms to reduce DB load during rapid typing
    const timer = setTimeout(() => {
      loadPatients();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filtered by blood group
  const filteredPatients = patients.filter(p => {
    if (bloodGroupFilter !== 'ALL' && p.bloodGroup !== bloodGroupFilter) return false;
    return true;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-800" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">
              Patient Clinical Directory
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Master database of registered patients, systemic health flags, and 32-tooth odontograms.
          </p>
        </div>

        <button
          onClick={onOpenNewPatient}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-800 hover:bg-blue-900 text-white rounded-lg text-xs font-medium shadow-xs transition-colors self-start md:self-auto"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>+ Register New Patient</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by patient name, phone, PT number, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-800"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-slate-500 font-medium">Blood Group:</label>
          <select
            value={bloodGroupFilter}
            onChange={(e) => setBloodGroupFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1.5 text-slate-700 focus:outline-hidden"
          >
            {BLOOD_GROUPS_WITH_ALL.map(bg => (
              <option key={bg} value={bg}>{bg}</option>
            ))}
          </select>

          <span className="text-slate-400 font-mono text-[11px] ml-2">
            Showing {filteredPatients.length} of {total} records
          </span>
        </div>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading patients directory...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No patients found matching your search.
            </div>
          ) : (
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] uppercase font-semibold text-slate-600">
                  <th className="py-3 px-4">PT ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Blood Group</th>
                  <th className="py-3 px-4">Medical Alert</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPatients.map(p => {
                  const hasAllergies = Boolean(p.allergies);

                  return (
                    <tr
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-800"
                      onClick={() => onSelectPatient(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectPatient(p.id);
                        }
                      }}
                    >
                      {/* PT Number */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-blue-800">
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {p.patientNumber}
                        </span>
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-blue-800 transition-colors">
                          {p.firstName} {p.lastName}
                        </div>
                        {p.occupation && (
                          <div className="text-[10px] text-slate-400">{p.occupation}</div>
                        )}
                      </td>

                      {/* Age / Gender */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-slate-800">{calculateAge(p.dateOfBirth)}</span>
                        <span className="text-slate-400 ml-1">({p.gender.charAt(0)})</span>
                      </td>

                      {/* Contact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-700 font-mono text-[11px]">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {p.phone}
                        </div>
                        {p.email && <div className="text-[10px] text-slate-400">{p.email}</div>}
                      </td>

                      {/* Blood Group */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-rose-700">
                          {p.bloodGroup || 'UNKNOWN'}
                        </span>
                      </td>

                      {/* Medical Alert */}
                      <td className="py-3 px-4">
                        {hasAllergies ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-300 text-[10px] font-bold">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            <span className="truncate max-w-[120px]" title={p.allergies}>
                              {p.allergies}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onOpenNewAppointment(p.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs"
                            title="Schedule Appointment"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenPrintCenter('PatientHistory', undefined, p.id)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs"
                            title="Print Patient Card"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onSelectPatient(p.id)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-md text-[11px] font-semibold flex items-center gap-1"
                          >
                            <span>Open Chart</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="p-1.5 bg-slate-100 hover:bg-rose-50 text-rose-600 rounded-md text-xs border border-transparent hover:border-rose-200"
                            title="Move to trash"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* ── Delete to trash confirmation ─────────────────────── */}
      {deleteError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-3 bg-rose-50 border border-rose-300 rounded-xl shadow-lg text-xs text-rose-800">
          {deleteError}
          <button onClick={() => setDeleteError('')} className="ml-3 underline">Dismiss</button>
        </div>
      )}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Move Patient to Trash"
        message={`Move ${deleteTarget?.firstName ?? ''} ${deleteTarget?.lastName ?? ''} (${deleteTarget?.patientNumber ?? ''}) to trash? All clinical records are preserved and can be restored from the Patient Trash section.`}
        confirmLabel="Move to Trash"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteToTrash}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
