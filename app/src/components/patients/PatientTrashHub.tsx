import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  X,
  AlertTriangle,
  ShieldAlert,
  Search,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Patient, UserRole } from '../../types/index.js';
import { api } from '../../lib/api.js';
import { calculateAge, formatDate } from '../../lib/utils.js';
import { ConfirmDialog } from '../ui/Toast.js';

interface PatientTrashHubProps {
  currentUserRole: UserRole;
}

export const PatientTrashHub: React.FC<PatientTrashHubProps> = ({ currentUserRole }) => {
  const isAdmin = currentUserRole === 'ADMIN';

  const [patients, setPatients]     = useState<Patient[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch]         = useState('');
  const [error, setError]           = useState('');

  // ── Per-row action state ──────────────────────────────────────────────────
  const [restoring, setRestoring]   = useState<string | null>(null); // patient id being restored
  const [deleteTarget, setDeleteTarget]     = useState<Patient | null>(null); // single perm-delete
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [actionError, setActionError] = useState('');

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const data = await api.getTrashedPatients();
      setPatients(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load trash.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Restore ───────────────────────────────────────────────────────────────
  const handleRestore = async (patient: Patient) => {
    setActionError('');
    setRestoring(patient.id);
    try {
      await api.restorePatient(patient.id);
      setPatients(prev => prev.filter(p => p.id !== patient.id));
    } catch (err: any) {
      setActionError(err.message || 'Failed to restore patient.');
    } finally {
      setRestoring(null);
    }
  };

  // ── Permanent delete (single) ─────────────────────────────────────────────
  const handlePermanentDelete = async () => {
    if (!deleteTarget) return;
    setActionError('');
    try {
      await api.permanentlyDeletePatient(deleteTarget.id);
      setPatients(prev => prev.filter(p => p.id !== deleteTarget.id));
    } catch (err: any) {
      setActionError(err.message || 'Failed to permanently delete patient.');
    } finally {
      setDeleteTarget(null);
    }
  };

  // ── Empty trash ───────────────────────────────────────────────────────────
  const handleEmptyTrash = async () => {
    setActionError('');
    try {
      await api.emptyPatientTrash();
      setPatients([]);
    } catch (err: any) {
      setActionError(err.message || 'Failed to empty trash.');
    } finally {
      setConfirmEmptyTrash(false);
    }
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = patients.filter(p => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.patientNumber.toLowerCase().includes(q) ||
      p.phone.includes(q)
    );
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-600" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Patient Trash</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deleted patient records are held here before permanent removal.
            Restore to recover a record, or permanently delete to erase all data.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg border border-slate-200"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && patients.length > 0 && (
            <button
              onClick={() => setConfirmEmptyTrash(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Empty Trash ({patients.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Warning banner ──────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Trash is not permanent storage.</span> Records in the trash
          are hidden from all clinical workflows but still occupy database space.
          {isAdmin
            ? ' As an Admin you can permanently delete individual records or empty the entire trash.'
            : ' Contact an Admin to permanently delete records.'}
        </div>
      </div>

      {/* ── Inline action error ─────────────────────────────────── */}
      {actionError && (
        <div className="flex items-center justify-between p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-400 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Search bar ─────────────────────────────────────────── */}
      {patients.length > 0 && (
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search trashed patients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-blue-800"
          />
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <span>Loading trash…</span>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-xs text-rose-700">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <Trash2 className="w-10 h-10 mx-auto text-slate-200" />
            <p className="text-sm font-medium text-slate-600">
              {patients.length === 0 ? 'Trash is empty' : 'No results match your search'}
            </p>
            <p className="text-xs text-slate-400">
              {patients.length === 0
                ? 'Deleted patient records will appear here.'
                : 'Try a different name or patient number.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase font-semibold text-slate-500">
                  <th className="py-3 px-4">PT ID</th>
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Age / Gender</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Medical Alert</th>
                  <th className="py-3 px-4">Deleted</th>
                  <th className="py-3 px-4">Deleted By</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(p => (
                  <tr key={p.id} className="hover:bg-rose-50/30 transition-colors">
                    {/* PT ID */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-slate-500">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 line-through decoration-rose-400">
                        {p.patientNumber}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-700 line-through decoration-rose-300">
                        {p.firstName} {p.lastName}
                      </div>
                      {p.occupation && (
                        <div className="text-[10px] text-slate-400">{p.occupation}</div>
                      )}
                    </td>

                    {/* Age / Gender */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                      {calculateAge(p.dateOfBirth)}
                      <span className="text-slate-400 ml-1">({p.gender.charAt(0)})</span>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                      {p.phone}
                    </td>

                    {/* Medical Alert */}
                    <td className="py-3 px-4">
                      {p.allergies ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-medium">
                          <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[100px]" title={p.allergies}>{p.allergies}</span>
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>

                    {/* Deleted at */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      {p.deletedAt ? formatDate(p.deletedAt) : '—'}
                    </td>

                    {/* Deleted by */}
                    <td className="py-3 px-4 text-slate-500">
                      {p.deletedBy || '—'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Restore — available to ADMIN + RECEPTIONIST */}
                        <button
                          onClick={() => handleRestore(p)}
                          disabled={restoring === p.id}
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-semibold disabled:opacity-50"
                          title="Restore patient record"
                        >
                          {restoring === p.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RotateCcw className="w-3 h-3" />
                          }
                          <span>Restore</span>
                        </button>

                        {/* Permanently delete — ADMIN only */}
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteTarget(p)}
                            className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-md text-[11px] font-semibold"
                            title="Permanently delete — cannot be undone"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Forever</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Confirm permanent delete (single) ──────────────────── */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="Permanently Delete Patient"
        message={`This will irreversibly erase all records for ${deleteTarget?.firstName ?? ''} ${deleteTarget?.lastName ?? ''} (${deleteTarget?.patientNumber ?? ''}), including all appointments, treatments, prescriptions, visits, and X-rays. This cannot be undone.`}
        confirmLabel="Delete Forever"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handlePermanentDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ── Confirm empty trash ─────────────────────────────────── */}
      <ConfirmDialog
        isOpen={confirmEmptyTrash}
        title="Empty Patient Trash"
        message={`This will permanently erase all ${patients.length} trashed patient record${patients.length !== 1 ? 's' : ''} and every piece of linked clinical data (appointments, prescriptions, treatments, X-rays, etc.). This cannot be undone.`}
        confirmLabel={`Empty Trash (${patients.length} records)`}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleEmptyTrash}
        onCancel={() => setConfirmEmptyTrash(false)}
      />
    </div>
  );
};
