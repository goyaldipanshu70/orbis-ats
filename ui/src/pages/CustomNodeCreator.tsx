import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import {
  ArrowLeft, Save, Play, Plus, Trash2, Upload,
  CheckCircle2, XCircle, Loader2, Zap, Search, Brain, Cog, Send,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { apiClient } from '@/utils/api';
import type { CustomNodeTypeCreate, TestNodeResponse } from '@/types/workflow';
import { toast } from 'sonner';

const CATEGORY_OPTIONS = [
  { value: 'trigger', label: 'Trigger', icon: <Zap className="h-4 w-4" /> },
  { value: 'search', label: 'Search Source', icon: <Search className="h-4 w-4" /> },
  { value: 'ai', label: 'AI Processing', icon: <Brain className="h-4 w-4" /> },
  { value: 'processing', label: 'Data Processing', icon: <Cog className="h-4 w-4" /> },
  { value: 'action', label: 'Action', icon: <Send className="h-4 w-4" /> },
];

const DEFAULT_CODE = `leads = self._collect_leads(input_data)
query = self.config.get("search_query", "")
max_results = self.config.get("max_results", 20)

# Your custom logic here
# You can use: json, re, math, datetime, httpx, asyncio, etc.
# Example: fetch data from an external API
# async with httpx.AsyncClient() as client:
#     resp = await client.get("https://api.example.com/search", params={"q": query})
#     data = resp.json()

results = []
for lead in leads[:max_results]:
    results.append(lead)

return {"leads": results, "count": len(results)}`;

interface SchemaField {
  key: string;
  type: string;
  default_value: string;
  description: string;
  required: boolean;
}

export default function CustomNodeCreator() {
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!nodeId;

  // Form state
  const [nodeType, setNodeType] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('search');
  const [description, setDescription] = useState('');
  const [executionCode, setExecutionCode] = useState(DEFAULT_CODE);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([
    { key: 'search_query', type: 'string', default_value: '', description: 'Search query', required: true },
    { key: 'max_results', type: 'number', default_value: '20', description: 'Maximum results to return', required: false },
  ]);

  // Test state
  const [testInput, setTestInput] = useState('{}');
  const [testResult, setTestResult] = useState<TestNodeResponse | null>(null);
  const [testLogs, setTestLogs] = useState<string[]>([]);

  // Load existing node for editing
  const { data: existingNode } = useQuery({
    queryKey: ['custom-node', nodeId],
    queryFn: () => apiClient.getCustomNode(Number(nodeId)),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingNode) {
      setNodeType(existingNode.node_type);
      setDisplayName(existingNode.display_name);
      setCategory(existingNode.category);
      setDescription(existingNode.description);
      setExecutionCode(existingNode.execution_code);
      // Parse config_schema into fields
      const fields: SchemaField[] = Object.entries(existingNode.config_schema || {}).map(
        ([key, schema]: [string, any]) => ({
          key,
          type: schema.type || 'string',
          default_value: schema.default != null ? String(schema.default) : '',
          description: schema.description || '',
          required: schema.required || false,
        })
      );
      if (fields.length > 0) setSchemaFields(fields);
    }
  }, [existingNode]);

  // Build config_schema from fields
  const configSchema = useMemo(() => {
    const schema: Record<string, any> = {};
    for (const f of schemaFields) {
      if (!f.key) continue;
      const entry: any = { type: f.type, description: f.description };
      if (f.default_value !== '') {
        if (f.type === 'number' || f.type === 'integer') entry.default = Number(f.default_value);
        else if (f.type === 'boolean') entry.default = f.default_value === 'true';
        else entry.default = f.default_value;
      }
      schema[f.key] = entry;
    }
    return schema;
  }, [schemaFields]);

  // Build test config from schema defaults
  const testConfig = useMemo(() => {
    const cfg: Record<string, any> = {};
    for (const f of schemaFields) {
      if (f.default_value !== '') {
        if (f.type === 'number' || f.type === 'integer') cfg[f.key] = Number(f.default_value);
        else if (f.type === 'boolean') cfg[f.key] = f.default_value === 'true';
        else cfg[f.key] = f.default_value;
      }
    }
    return cfg;
  }, [schemaFields]);

  const saveMutation = useMutation({
    mutationFn: async (status: 'draft' | 'published') => {
      const payload: CustomNodeTypeCreate = {
        node_type: nodeType,
        category: category as any,
        display_name: displayName,
        description,
        config_schema: configSchema,
        execution_code: executionCode,
      };
      if (isEditing) {
        return apiClient.updateCustomNode(Number(nodeId), { ...payload, status });
      }
      return apiClient.createCustomNode({ ...payload, status });
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ['workflow-node-types'] });
      queryClient.invalidateQueries({ queryKey: ['custom-nodes'] });
      toast.success(status === 'published' ? 'Node published!' : 'Draft saved');
      navigate('/workflows/nodes');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save node');
    },
  });

  const testMutation = useMutation({
    mutationFn: () => {
      let inputData = {};
      try { inputData = JSON.parse(testInput); } catch { /* ignore */ }
      return apiClient.testCustomNode({
        execution_code: executionCode,
        config_schema: configSchema,
        config: testConfig,
        input_data: inputData,
      });
    },
    onSuccess: (result) => {
      setTestResult(result);
      const now = new Date().toLocaleTimeString();
      if (result.success) {
        setTestLogs((prev) => [
          ...prev,
          `[${now}] Execution successful`,
          `[${now}] ${result.lead_count || 0} leads returned`,
        ]);
      } else {
        setTestLogs((prev) => [...prev, `[${now}] ERROR: ${result.error}`]);
      }
    },
    onError: (err: any) => {
      const now = new Date().toLocaleTimeString();
      setTestLogs((prev) => [...prev, `[${now}] FATAL: ${err.message}`]);
      setTestResult({ success: false, error: err.message, output: null });
    },
  });

  const addField = () => {
    setSchemaFields((prev) => [
      ...prev,
      { key: '', type: 'string', default_value: '', description: '', required: false },
    ]);
  };

  const removeField = (idx: number) => {
    setSchemaFields((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateField = (idx: number, updates: Partial<SchemaField>) => {
    setSchemaFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  };

  const inputClass = "w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50";

  return (
    <AppLayout>
      <div className="h-[calc(100vh-64px)] flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700/50 bg-slate-900/80">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/workflows/nodes')} className="p-2 rounded-lg hover:bg-slate-800/60 text-slate-400">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-lg font-semibold text-slate-100">
              {isEditing ? 'Edit Custom Node' : 'Create Custom Node'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
            >
              {testMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test Node
            </button>
            <button
              onClick={() => saveMutation.mutate('draft')}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 border border-slate-700/50 hover:bg-slate-800/60"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </button>
            <button
              onClick={() => saveMutation.mutate('published')}
              disabled={saveMutation.isPending || !nodeType || !displayName || !executionCode}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #1676c0 0%, #1B8EE5 100%)' }}
            >
              <Upload className="h-4 w-4" />
              Publish
            </button>
          </div>
        </div>

        {/* Main content — two columns */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column — Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Node Basics */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Node Basics</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Node Type (ID)</label>
                  <input
                    value={nodeType}
                    onChange={(e) => setNodeType(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="e.g. indeed_search"
                    className={inputClass}
                    disabled={isEditing}
                  />
                  <p className="text-[10px] text-slate-600 mt-1">Lowercase, underscores only. Cannot be changed later.</p>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Display Name</label>
                  <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Indeed Job Search" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Category</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Description</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description..." className={inputClass} />
                </div>
              </div>
            </section>

            {/* Config Schema */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Config Schema</h2>
                <button onClick={addField} className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                  <Plus className="h-3.5 w-3.5" /> Add Parameter
                </button>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_100px_1fr_1fr_40px] gap-2 text-[10px] text-slate-500 uppercase tracking-wider px-1">
                  <span>Name</span><span>Type</span><span>Default</span><span>Description</span><span />
                </div>
                {schemaFields.map((field, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_1fr_1fr_40px] gap-2">
                    <input value={field.key} onChange={(e) => updateField(idx, { key: e.target.value })} placeholder="param_name" className={inputClass} />
                    <select value={field.type} onChange={(e) => updateField(idx, { type: e.target.value })} className={inputClass}>
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="integer">integer</option>
                      <option value="boolean">boolean</option>
                      <option value="array">array</option>
                      <option value="select">select</option>
                    </select>
                    <input value={field.default_value} onChange={(e) => updateField(idx, { default_value: e.target.value })} placeholder="default" className={inputClass} />
                    <input value={field.description} onChange={(e) => updateField(idx, { description: e.target.value })} placeholder="description" className={inputClass} />
                    <button onClick={() => removeField(idx)} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Code Editor */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Execution Code</h2>
              <p className="text-[10px] text-slate-500 mb-2">
                Write the body of <code className="text-blue-400">async def execute(self, input_data)</code>. Use <code className="text-blue-400">self._collect_leads(input_data)</code> for upstream leads, <code className="text-blue-400">self.config</code> for node config. Return a dict with a "leads" key.
              </p>
              <div className="rounded-xl overflow-hidden border border-slate-700/50">
                <Editor
                  height="300px"
                  language="python"
                  theme="vs-dark"
                  value={executionCode}
                  onChange={(v) => setExecutionCode(v || '')}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    padding: { top: 12 },
                    wordWrap: 'on',
                  }}
                />
              </div>
            </section>

            {/* Testing Console */}
            <section>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-3">Testing & Logs</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Test Input (JSON)</label>
                  <div className="rounded-lg overflow-hidden border border-slate-700/50">
                    <Editor
                      height="120px"
                      language="json"
                      theme="vs-dark"
                      value={testInput}
                      onChange={(v) => setTestInput(v || '{}')}
                      options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-slate-400">Test Output</label>
                    {testResult && (
                      <span className={`flex items-center gap-1 text-xs ${testResult.success ? 'text-emerald-400' : 'text-red-400'}`}>
                        {testResult.success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {testResult.success ? 'Passed' : 'Failed'}
                      </span>
                    )}
                  </div>
                  <div className="rounded-lg overflow-hidden border border-slate-700/50">
                    <Editor
                      height="120px"
                      language="json"
                      theme="vs-dark"
                      value={testResult ? JSON.stringify(testResult.output || testResult.error, null, 2) : '// Run a test to see output'}
                      options={{ minimap: { enabled: false }, fontSize: 12, lineNumbers: 'off', readOnly: true, scrollBeyondLastLine: false }}
                    />
                  </div>
                </div>
              </div>
              {/* Log console */}
              <div className="mt-3 rounded-lg bg-slate-950 border border-slate-700/50 p-3 max-h-32 overflow-y-auto font-mono text-[11px]">
                {testLogs.length === 0 ? (
                  <span className="text-slate-600">Console output will appear here...</span>
                ) : (
                  testLogs.map((log, i) => (
                    <div key={i} className={log.includes('ERROR') || log.includes('FATAL') ? 'text-red-400' : 'text-emerald-400'}>
                      {log}
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right column — Live Preview */}
          <div className="w-[340px] border-l border-slate-700/50 overflow-y-auto p-5 bg-slate-900/40">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wide mb-4">Live Preview</h2>

            {/* Palette Card Preview */}
            <div className="mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Palette Card</p>
              <div
                className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40"
                style={{ borderLeft: `3px solid ${{ trigger: '#1B8EE5', search: '#3b82f6', ai: '#f59e0b', processing: '#10b981', action: '#ef4444' }[category] || '#6b7280'}` }}
              >
                <p className="text-sm font-medium text-slate-200">{displayName || 'Node Name'}</p>
                <p className="text-xs text-slate-500 mt-0.5">{description || 'Description...'}</p>
              </div>
            </div>

            {/* Canvas Node Preview */}
            <div className="mb-6">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Canvas Node</p>
              <div className="relative p-4 flex items-center justify-center">
                <div className="relative rounded-xl border border-slate-600/50 bg-slate-800/60 overflow-hidden w-48 shadow-lg">
                  <div className="h-1.5" style={{ backgroundColor: { trigger: '#1B8EE5', search: '#3b82f6', ai: '#f59e0b', processing: '#10b981', action: '#ef4444' }[category] || '#6b7280' }} />
                  <div className="p-3">
                    <p className="text-xs font-semibold text-slate-200">{displayName || 'Node Name'}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{category}</p>
                  </div>
                  {/* Handles */}
                  <div className="absolute left-0 top-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-slate-500 bg-slate-800" />
                  <div className="absolute right-0 top-1/2 translate-x-1/2 w-3 h-3 rounded-full border-2 border-slate-500 bg-slate-800" />
                </div>
              </div>
            </div>

            {/* Config Panel Preview */}
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Config Panel</p>
              <div className="rounded-xl border border-slate-700/40 bg-slate-800/30 p-3 space-y-3">
                {schemaFields.filter((f) => f.key).map((f, i) => (
                  <div key={i}>
                    <label className="text-xs text-slate-400 mb-1 block capitalize">{f.key.replace(/_/g, ' ')}</label>
                    {f.type === 'boolean' ? (
                      <input type="checkbox" disabled className="rounded" />
                    ) : (
                      <input
                        type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'}
                        value={f.default_value}
                        disabled
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-900/50 border border-slate-700/50 text-xs text-slate-400"
                      />
                    )}
                  </div>
                ))}
                {schemaFields.filter((f) => f.key).length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-2">Add parameters to see preview</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
