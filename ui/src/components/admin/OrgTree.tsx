import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, User, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface OrgNode {
  id: number;
  user_id: number;
  reports_to: number | null;
  department: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role: string | null;
}

interface OrgTreeProps {
  nodes: OrgNode[];
  onNodeClick: (node: OrgNode) => void;
  selectedId?: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#ef4444',
  hr: '#3b82f6',
  hiring_manager: '#8b5cf6',
  manager: '#f59e0b',
  interviewer: '#10b981',
  candidate: '#64748b',
};

function getInitials(first: string | null, last: string | null) {
  return `${(first || '')[0] || ''}${(last || '')[0] || ''}`.toUpperCase() || '?';
}

function TreeNode({
  node,
  childrenMap,
  onNodeClick,
  selectedId,
  depth = 0,
}: {
  node: OrgNode;
  childrenMap: Map<number, OrgNode[]>;
  onNodeClick: (node: OrgNode) => void;
  selectedId?: number;
  depth?: number;
}) {
  const children = childrenMap.get(node.user_id) || [];
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = children.length > 0;
  const isSelected = selectedId === node.user_id;
  const roleColor = ROLE_COLORS[node.role || ''] || '#64748b';

  return (
    <div className="ml-6 relative">
      {/* Vertical connector line */}
      {depth > 0 && (
        <div className="absolute -left-3 top-0 h-6 border-l border-dashed" style={{ borderColor: 'var(--orbis-border)' }} />
      )}
      {depth > 0 && (
        <div className="absolute -left-3 top-6 w-3 border-t border-dashed" style={{ borderColor: 'var(--orbis-border)' }} />
      )}

      {/* Node card */}
      <div
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all mb-1 ${isSelected ? 'ring-1 ring-[#1B8EE5]' : 'hover:bg-white/5'}`}
        style={{ background: isSelected ? 'rgba(27, 142, 229, 0.1)' : 'transparent' }}
        onClick={() => onNodeClick(node)}
      >
        {hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} className="p-0.5 text-slate-500 hover:text-white">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-4.5" />
        )}

        <div
          className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: `${roleColor}30`, color: roleColor }}
        >
          {getInitials(node.first_name, node.last_name)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">
            {node.first_name || ''} {node.last_name || ''}
          </p>
          <p className="text-xs text-slate-500 truncate">{node.title || node.role || 'No title'}</p>
        </div>

        {hasChildren && (
          <span className="text-xs text-slate-500 shrink-0 flex items-center gap-1">
            <Users className="h-3 w-3" /> {children.length}
          </span>
        )}

        <div className="h-2 w-2 rounded-full shrink-0" style={{ background: roleColor }} title={node.role || ''} />
      </div>

      {/* Children */}
      <AnimatePresence>
        {expanded && hasChildren && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden relative"
          >
            {/* Vertical line for children group */}
            <div className="absolute left-3 top-0 bottom-0 border-l border-dashed" style={{ borderColor: 'var(--orbis-border)' }} />
            {children.map(child => (
              <TreeNode
                key={child.user_id}
                node={child}
                childrenMap={childrenMap}
                onNodeClick={onNodeClick}
                selectedId={selectedId}
                depth={depth + 1}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function OrgTree({ nodes, onNodeClick, selectedId }: OrgTreeProps) {
  const { roots, childrenMap } = useMemo(() => {
    const map = new Map<number, OrgNode[]>();
    const rootNodes: OrgNode[] = [];

    nodes.forEach(node => {
      if (node.reports_to === null || node.reports_to === undefined) {
        rootNodes.push(node);
      } else {
        const existing = map.get(node.reports_to) || [];
        existing.push(node);
        map.set(node.reports_to, existing);
      }
    });

    return { roots: rootNodes, childrenMap: map };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Users className="h-12 w-12 mb-3 opacity-50" />
        <p className="text-sm">No organization structure defined yet</p>
        <p className="text-xs mt-1">Add team members to build the hierarchy</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {roots.map(root => (
        <TreeNode
          key={root.user_id}
          node={root}
          childrenMap={childrenMap}
          onNodeClick={onNodeClick}
          selectedId={selectedId}
        />
      ))}
    </div>
  );
}
