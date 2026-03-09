import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
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
      <DialogContent className="sm:max-w-md rounded-xl border-0 shadow-2xl bg-background p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-t-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-semibold">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
                <MapPin className="h-4.5 w-4.5" />
              </div>
              Select Hire Location
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Choose which location to assign <span className="font-medium text-foreground">{candidateName}</span> to.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 py-5">
          {fetching ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center mb-3">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              </div>
              <p className="text-sm text-muted-foreground">Loading locations...</p>
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mb-3">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <p className="text-sm font-medium text-foreground">All positions filled</p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px]">There are no open vacancies remaining for this job.</p>
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
                    className={`flex items-center justify-between w-full px-4 py-3.5 rounded-xl border text-left transition-all duration-150 ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-50/80 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-sm'
                        : 'border-border/50 hover:border-emerald-300 hover:bg-muted/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-150 ${
                        isSelected
                          ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20'
                          : 'bg-muted/50 text-muted-foreground'
                      }`}>
                        {isSelected ? <CheckCircle2 className="w-4.5 h-4.5" /> : <Building2 className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{loc.city}, {loc.country}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Users className="w-3 h-3" /> {loc.hired_count}/{loc.vacancies} filled
                        </div>
                      </div>
                    </div>
                    <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      openSlots <= 1
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    }`}>
                      {openSlots} open
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/20 rounded-b-xl">
          <div className="flex w-full justify-end gap-2.5">
            <Button variant="outline" onClick={onClose} disabled={isLoading} className="rounded-lg">Cancel</Button>
            {locations.length > 0 && (
              <Button
                onClick={() => selectedId && onConfirm(selectedId)}
                disabled={isLoading || !selectedId}
                className="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/20"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Moving...
                  </span>
                ) : (
                  'Confirm Hire'
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
