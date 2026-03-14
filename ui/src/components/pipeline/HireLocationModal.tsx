import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { LocationVacancy } from '@/types/api';
import { apiClient } from '@/utils/api';
import { MapPin, Users, Loader2, AlertCircle, CheckCircle2, Building2 } from 'lucide-react';

interface HireLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (locationId: number) => void;
  candidateName: string;
  jobId: string;
  isLoading?: boolean;
}

export default function HireLocationModal({
  isOpen, onClose, onConfirm, candidateName, jobId, isLoading
}: HireLocationModalProps) {
  const [locations, setLocations] = useState<LocationVacancy[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!isOpen || !jobId) return;
    setFetching(true);
    setSelectedId(null);
    apiClient.getAvailableHireLocations(jobId)
      .then(setLocations)
      .catch(() => setLocations([]))
      .finally(() => setFetching(false));
  }, [isOpen, jobId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md border-0 rounded-2xl shadow-2xl p-0"
        style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 rounded-t-2xl" style={{ borderBottom: '1px solid var(--orbis-border)', background: 'rgba(16,185,129,0.06)' }}>
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold text-white">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              Select Hire Location
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-400">
              Choose which location to assign <span className="font-medium text-white">{candidateName}</span> to.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
              <p className="text-sm text-slate-400">Loading locations...</p>
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-sm font-medium text-white">All positions filled</p>
              <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">There are no open vacancies remaining for this job.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {locations.map((loc) => {
                const isSelected = selectedId === loc.id;
                const openSlots = loc.vacancies - loc.hired_count;
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSelectedId(loc.id)}
                    className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl text-left transition-all duration-150"
                    style={{
                      background: isSelected ? 'rgba(16,185,129,0.1)' : 'var(--orbis-card)',
                      border: isSelected ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--orbis-border)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(16,185,129,0.15)' : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150"
                        style={{
                          background: isSelected ? 'linear-gradient(135deg, #10b981, #14b8a6)' : 'var(--orbis-border)',
                          boxShadow: isSelected ? '0 4px 12px rgba(16,185,129,0.2)' : 'none',
                        }}
                      >
                        {isSelected ? <CheckCircle2 className="w-4.5 h-4.5 text-white" /> : <Building2 className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{loc.city}, {loc.country}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" /> {loc.hired_count}/{loc.vacancies} filled
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: openSlots <= 1 ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)',
                        color: openSlots <= 1 ? '#fbbf24' : '#34d399',
                      }}
                    >
                      {openSlots} open
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 rounded-b-2xl" style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}>
          <div className="flex w-full justify-end gap-2.5">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-300 transition-colors hover:text-white disabled:opacity-50"
              style={{ background: 'var(--orbis-border)', border: '1px solid var(--orbis-border)' }}
            >
              Cancel
            </button>
            {locations.length > 0 && (
              <button
                onClick={() => selectedId && onConfirm(selectedId)}
                disabled={isLoading || !selectedId}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all hover:shadow-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(135deg, #10b981, #14b8a6)' }}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Moving...
                  </span>
                ) : (
                  'Confirm Hire'
                )}
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
