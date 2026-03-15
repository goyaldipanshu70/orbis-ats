import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Loader2 } from 'lucide-react';

interface CodePanelProps {
  language?: string;
  problemDescription?: string;
  onSubmit: (code: string, language: string) => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  initialCode?: string;
}

const LANGUAGES = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'go', label: 'Go' },
];

const STARTER_CODE: Record<string, string> = {
  python: '# Write your solution here\n\ndef solution():\n    pass\n',
  javascript: '// Write your solution here\n\nfunction solution() {\n  \n}\n',
  typescript: '// Write your solution here\n\nfunction solution(): void {\n  \n}\n',
  java: '// Write your solution here\n\nclass Solution {\n    public void solve() {\n        \n    }\n}\n',
  cpp: '// Write your solution here\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
  go: '// Write your solution here\n\npackage main\n\nfunc solution() {\n\t\n}\n',
};

export default function CodePanel({
  language: defaultLang = 'python',
  problemDescription,
  onSubmit,
  isSubmitting = false,
  readOnly = false,
  initialCode,
}: CodePanelProps) {
  const [language, setLanguage] = useState(defaultLang);
  const [code, setCode] = useState(initialCode || STARTER_CODE[defaultLang] || '');

  const handleSubmit = () => {
    if (code.trim() && !isSubmitting && !readOnly) {
      onSubmit(code, language);
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: '1px solid var(--orbis-border)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{
          background: 'var(--orbis-card)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--orbis-border)',
        }}
      >
        <h3 className="text-sm font-semibold" style={{ color: 'var(--orbis-heading)' }}>Code Editor</h3>
        <Select value={language} onValueChange={(v) => { setLanguage(v); if (!initialCode) setCode(STARTER_CODE[v] || ''); }} disabled={readOnly}>
          <SelectTrigger className="w-[140px] h-8" style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)', color: 'hsl(var(--foreground))' }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((l) => (
              <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Problem description */}
      {problemDescription && (
        <div
          className="px-4 py-2 text-sm"
          style={{
            background: 'rgba(27,142,229,0.08)',
            borderBottom: '1px solid var(--orbis-border)',
          }}
        >
          <p className="font-medium text-blue-300 mb-1">Problem:</p>
          <p className="whitespace-pre-wrap" style={{ color: 'var(--orbis-text)' }}>{problemDescription}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0" style={{ background: 'var(--orbis-page)' }}>
        <Editor
          height="100%"
          language={language}
          value={code}
          onChange={(v) => setCode(v || '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            readOnly,
            wordWrap: 'on',
          }}
        />
      </div>

      {/* Submit button */}
      {!readOnly && (
        <div
          className="px-4 py-2"
          style={{
            background: 'var(--orbis-card)',
            backdropFilter: 'blur(12px)',
            borderTop: '1px solid var(--orbis-border)',
          }}
        >
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !code.trim()}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-white font-semibold text-sm transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            style={{ background: 'linear-gradient(135deg, #1B8EE5 0%, #5b2dba 100%)' }}
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating...</>
            ) : (
              <><Send className="h-4 w-4" /> Submit Code</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
