import React, { useState } from 'react';
import { ToothCondition, DentalHistory } from '../../types/index.js';
import { Check, Edit3, X } from 'lucide-react';
import { TOOTH_CONDITIONS } from '../../lib/constants.js';

interface DentalChartProps {
  patientId: string;
  dentalHistory?: DentalHistory[];
  onUpdateToothCondition: (toothNumber: number, condition: ToothCondition, notes?: string) => Promise<void>;
  readOnly?: boolean;
}


export const DentalChart: React.FC<DentalChartProps> = ({
  patientId,
  dentalHistory = [],
  onUpdateToothCondition,
  readOnly = false
}) => {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [selectedCondition, setSelectedCondition] = useState<ToothCondition | ''>('');
  const [toothNotes, setToothNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Upper Arch (1 to 16) and Lower Arch (17 to 32)
  const upperArch = Array.from({ length: 16 }, (_, i) => i + 1);
  const lowerArch = Array.from({ length: 16 }, (_, i) => 32 - i); // Render 32 down to 17

  // Helper to get condition of tooth
  const getToothData = (num: number) => {
    return dentalHistory.find(d => d.toothNumber === num);
  };

  const handleToothClick = (num: number) => {
    if (readOnly) return;
    const existing = getToothData(num);
    setSelectedTooth(num);
    // Default to '' (None) when the tooth has no recorded condition yet,
    // so the dropdown opens showing "— None (clear) —" rather than assuming HEALTHY.
    setSelectedCondition(existing?.condition || '');
    setToothNotes(existing?.notes || '');
    setSaveError('');
  };

  const handleSaveCondition = async () => {
    if (!selectedTooth) return;
    setSaveError('');
    try {
      setIsUpdating(true);
      if (selectedCondition === '') {
        // "None" selected: if the tooth already had a condition, reset it to HEALTHY
        // (the API has no delete — HEALTHY is the visual equivalent of "clear").
        const existing = getToothData(selectedTooth);
        if (existing) {
          await onUpdateToothCondition(selectedTooth, 'HEALTHY', '');
        }
        // If no existing record, nothing to save — just close.
      } else {
        await onUpdateToothCondition(selectedTooth, selectedCondition, toothNotes);
      }
      setSelectedTooth(null);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update tooth condition. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getConditionStyle = (cond?: ToothCondition) => {
    const found = TOOTH_CONDITIONS.find(c => c.value === cond);
    return found ? found.color : '#e2e8f0';
  };

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex flex-wrap gap-2 text-[11px]">
        {TOOTH_CONDITIONS.map(c => (
          <div key={c.value} className="flex items-center gap-1.5 px-2 py-1 bg-white rounded border border-slate-200">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }}></span>
            <span className="text-slate-700 font-medium">{c.label}</span>
          </div>
        ))}
      </div>

      {/* Interactive Chart Container */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
        {/* UPPER ARCH */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Upper Maxillary Arch (Teeth 1 - 16)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Universal Numbering System</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 justify-items-center">
            {upperArch.map(num => {
              const data = getToothData(num);
              const isSelected = selectedTooth === num;
              const color = getConditionStyle(data?.condition);

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleToothClick(num)}
                  className={`w-10 h-14 rounded-lg flex flex-col items-center justify-between p-1 transition-all border ${
                    isSelected ? 'ring-2 ring-blue-800 border-blue-800 scale-105' : 'hover:border-slate-400 border-slate-200'
                  }`}
                  style={{ backgroundColor: data?.condition ? `${color}15` : '#ffffff' }}
                >
                  <span className="text-[10px] font-mono font-bold text-slate-700">{num}</span>
                  {/* Tooth Shape SVG representation */}
                  <div
                    className="w-5 h-6 rounded-t-sm rounded-b-lg border flex items-center justify-center text-[8px] font-mono font-bold text-white shadow-2xs"
                    style={{ backgroundColor: color, borderColor: color }}
                  >
                    {data?.condition && data.condition !== 'HEALTHY' ? data.condition.charAt(0) : ''}
                  </div>
                  <span className="text-[8px] text-slate-400 truncate max-w-full font-mono">
                    {data?.condition ? data.condition.slice(0, 3) : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mid-line separator */}
        <div className="relative flex py-1 items-center">
          <div className="grow border-t border-slate-200"></div>
          <span className="shrink mx-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Occlusal Plane / Midline
          </span>
          <div className="grow border-t border-slate-200"></div>
        </div>

        {/* LOWER ARCH */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Lower Mandibular Arch (Teeth 17 - 32)
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Universal Numbering System</span>
          </div>
          <div className="grid grid-cols-8 sm:grid-cols-[repeat(16,minmax(0,1fr))] gap-1.5 justify-items-center">
            {lowerArch.map(num => {
              const data = getToothData(num);
              const isSelected = selectedTooth === num;
              const color = getConditionStyle(data?.condition);

              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleToothClick(num)}
                  className={`w-10 h-14 rounded-lg flex flex-col items-center justify-between p-1 transition-all border ${
                    isSelected ? 'ring-2 ring-blue-800 border-blue-800 scale-105' : 'hover:border-slate-400 border-slate-200'
                  }`}
                  style={{ backgroundColor: data?.condition ? `${color}15` : '#ffffff' }}
                >
                  <span className="text-[8px] text-slate-400 truncate max-w-full font-mono">
                    {data?.condition ? data.condition.slice(0, 3) : ''}
                  </span>
                  <div
                    className="w-5 h-6 rounded-b-sm rounded-t-lg border flex items-center justify-center text-[8px] font-mono font-bold text-white shadow-2xs"
                    style={{ backgroundColor: color, borderColor: color }}
                  >
                    {data?.condition && data.condition !== 'HEALTHY' ? data.condition.charAt(0) : ''}
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-700">{num}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tooth Condition Editor Modal / Drawer */}
      {selectedTooth && (
        <div className="p-4 bg-slate-900 text-slate-100 rounded-xl shadow-lg border border-slate-800 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-800 text-sm">Tooth #{selectedTooth}</span>
              <span className="text-xs text-slate-400">Clinical Notation Editor</span>
            </div>
            <button
              onClick={() => setSelectedTooth(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Tooth Diagnosis / Status</label>
              <select
                value={selectedCondition}
                onChange={(e) => setSelectedCondition(e.target.value as ToothCondition | '')}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-800 focus:outline-hidden"
              >
                <option value="">— None (clear condition) —</option>
                {TOOTH_CONDITIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Specific Tooth Notes</label>
              <input
                type="text"
                placeholder="e.g. Disto-occlusal cavity, asymptomatic"
                value={toothNotes}
                onChange={(e) => setToothNotes(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-slate-100 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-800 focus:outline-hidden"
              />
            </div>
          </div>

          {saveError && (
            <div className="p-2.5 bg-rose-900/60 border border-rose-600 rounded-lg text-rose-200 text-xs">
              {saveError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSelectedTooth(null)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={isUpdating}
              onClick={handleSaveCondition}
              className="px-4 py-1.5 bg-blue-800 hover:bg-blue-900 text-white rounded text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isUpdating ? 'Saving...' : 'Update Tooth Condition'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
