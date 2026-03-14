import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Module display names and icons
const MODULE_LABELS: Record<string, string> = {
  jobs: 'Jobs',
  candidates: 'Candidates',
  pipeline: 'Pipeline',
  interviews: 'Interviews',
  reports: 'Reports',
  admin: 'Administration',
  ai: 'AI Features',
  requisitions: 'Requisitions',
  org: 'Organization',
};

function formatAction(action: string): string {
  return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface PermissionMatrixProps {
  permissions: Record<string, boolean>;
  schema: Record<string, string[]>;
  onChange: (permissions: Record<string, boolean>) => void;
  disabled?: boolean;
}

export default function PermissionMatrix({ permissions, schema, onChange, disabled }: PermissionMatrixProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleModule = (module: string) => {
    setExpanded(prev => ({ ...prev, [module]: !prev[module] }));
  };

  const toggleAll = (module: string, value: boolean) => {
    const actions = schema[module] || [];
    const updated = { ...permissions };
    actions.forEach(action => { updated[`${module}.${action}`] = value; });
    onChange(updated);
  };

  const togglePerm = (key: string) => {
    onChange({ ...permissions, [key]: !permissions[key] });
  };

  const isModuleAllOn = (module: string) => {
    const actions = schema[module] || [];
    return actions.every(a => permissions[`${module}.${a}`] === true);
  };

  const countEnabled = (module: string) => {
    const actions = schema[module] || [];
    return actions.filter(a => permissions[`${module}.${a}`] === true).length;
  };

  return (
    <div className="space-y-2">
      {Object.entries(schema).map(([module, actions]) => {
        const isExpanded = expanded[module] !== false; // default expanded
        const enabled = countEnabled(module);
        const total = actions.length;

        return (
          <div key={module} className="rounded-lg overflow-hidden" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}>
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
              onClick={() => toggleModule(module)}
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                <span className="font-medium text-sm text-white">{MODULE_LABELS[module] || module}</span>
                <span className="text-xs text-slate-500">{enabled}/{total}</span>
              </div>
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <span className="text-xs text-slate-500 mr-1">All</span>
                <Switch
                  checked={isModuleAllOn(module)}
                  onCheckedChange={(val) => toggleAll(module, val)}
                  disabled={disabled}
                  className="data-[state=checked]:bg-[#1B8EE5]"
                />
              </div>
            </div>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {actions.map(action => {
                      const key = `${module}.${action}`;
                      return (
                        <div key={key} className="flex items-center justify-between rounded-md px-3 py-2" style={{ background: 'var(--orbis-card)' }}>
                          <span className="text-xs text-slate-300">{formatAction(action)}</span>
                          <Switch
                            checked={permissions[key] === true}
                            onCheckedChange={() => togglePerm(key)}
                            disabled={disabled}
                            className="data-[state=checked]:bg-[#1B8EE5] scale-90"
                          />
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
