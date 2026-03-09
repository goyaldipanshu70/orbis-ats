import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
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
    <div className="flex flex-col h-full border-l">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <h3 className="text-sm font-semibold">Code Editor</h3>
        <Select value={language} onValueChange={(v) => { setLanguage(v); if (!initialCode) setCode(STARTER_CODE[v] || ''); }} disabled={readOnly}>
          <SelectTrigger className="w-[140px] h-8">
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
        <div className="px-4 py-2 border-b bg-blue-50 dark:bg-blue-950/30 text-sm">
          <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Problem:</p>
          <p className="text-blue-600 dark:text-blue-400 whitespace-pre-wrap">{problemDescription}</p>
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
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
        <div className="px-4 py-2 border-t bg-muted/30">
          <Button onClick={handleSubmit} disabled={isSubmitting || !code.trim()} className="w-full gap-2">
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Evaluating...</>
            ) : (
              <><Send className="h-4 w-4" /> Submit Code</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
