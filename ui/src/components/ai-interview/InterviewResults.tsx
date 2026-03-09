import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, MessageSquare, Code, AlertTriangle, Eye, Copy, Monitor, Clock, Mic, FileWarning } from 'lucide-react';
import { AIInterviewResults, CheatingFlag } from '@/types/api';

interface InterviewResultsProps {
  results: AIInterviewResults;
}

function getRecBadge(rec: string | null) {
  switch (rec) {
    case 'Hire':
      return { className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', label: 'Hire' };
    case 'Manual Review':
      return { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Manual Review' };
    case 'Do Not Recommend':
      return { className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', label: 'Do Not Recommend' };
    default:
      return { className: 'bg-muted text-muted-foreground', label: rec || 'Pending' };
  }
}

function ScoreBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? (score / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function TrustScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <Badge className="bg-muted text-muted-foreground">N/A</Badge>;
  if (score >= 80) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300">{score}%</Badge>;
  if (score >= 60) return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">{score}%</Badge>;
  return <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">{score}%</Badge>;
}

function RiskLevelBadge({ level }: { level?: string }) {
  const config: Record<string, { className: string; label: string }> = {
    low: { className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', label: 'Low Risk' },
    medium: { className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', label: 'Medium Risk' },
    high: { className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300', label: 'High Risk' },
    critical: { className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300', label: 'Critical Risk' },
  };
  const c = config[level || 'low'] || config.low;
  return <Badge className={c.className}>{c.label}</Badge>;
}

function CheatingFlagRow({ flag }: { flag: CheatingFlag }) {
  const severityColors: Record<string, string> = {
    low: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  };

  const labels: Record<string, string> = {
    tab_switching: 'Excessive Tab Switching',
    copy_paste: 'Copy/Paste Detected',
    multiple_faces: 'Multiple Faces Detected',
    long_silence: 'Extended Silence Periods',
    external_device: 'External Device Usage',
    code_plagiarism: 'Code Plagiarism Suspected',
    extended_absence: 'Extended Absence from Window',
  };

  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
      <div className="flex items-center gap-2">
        <EventIcon type={flag.type} />
        <span className="text-sm font-medium">{labels[flag.type] || flag.type.replace(/_/g, ' ')}</span>
        {flag.count != null && <span className="text-xs text-muted-foreground">({flag.count}x)</span>}
        {flag.duration_ms != null && <span className="text-xs text-muted-foreground">({(flag.duration_ms / 1000).toFixed(0)}s)</span>}
      </div>
      <Badge className={severityColors[flag.severity] || severityColors.medium} variant="secondary">
        {flag.severity}
      </Badge>
    </div>
  );
}

function EventIcon({ type }: { type: string }) {
  const cls = "h-3.5 w-3.5 text-muted-foreground";
  switch (type) {
    case 'tab_away':
    case 'tab_return':
    case 'tab_switching':
    case 'window_blur':
    case 'window_focus':
      return <Eye className={cls} />;
    case 'copy_paste':
      return <Copy className={cls} />;
    case 'multiple_faces':
      return <Monitor className={cls} />;
    case 'long_silence':
      return <Mic className={cls} />;
    case 'external_device':
      return <Monitor className={cls} />;
    case 'code_plagiarism':
      return <FileWarning className={cls} />;
    case 'extended_absence':
      return <Clock className={cls} />;
    default:
      return <AlertTriangle className={cls} />;
  }
}

export default function InterviewResults({ results }: InterviewResultsProps) {
  const eval_ = results.evaluation || {};
  const scores = eval_.score_breakdown || {};
  const supplementary = eval_.supplementary_scores || {};
  const rec = getRecBadge(results.ai_recommendation);

  const duration = results.started_at && results.completed_at
    ? Math.round((new Date(results.completed_at).getTime() - new Date(results.started_at).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">AI Interview Results</h2>
          <p className="text-sm text-muted-foreground">
            {results.interview_type} interview
            {duration ? ` \u00b7 ${duration} minutes` : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <div className="text-3xl font-bold">{results.overall_score ?? '\u2014'}</div>
            <div className="text-xs text-muted-foreground">/ 100</div>
          </div>
          <Badge className={rec.className}>{rec.label}</Badge>
        </div>
      </div>

      <Tabs defaultValue="scores">
        <TabsList>
          <TabsTrigger value="scores">Scores</TabsTrigger>
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="proctoring">Proctoring</TabsTrigger>
        </TabsList>

        <TabsContent value="scores" className="space-y-4 mt-4">
          {/* Core scores */}
          <Card>
            <CardHeader><CardTitle className="text-base">Score Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <ScoreBar label="Technical Competency" score={scores.technical_competency || 0} max={25} />
              <ScoreBar label="Core Qualifications" score={scores.core_qualifications || 0} max={15} />
              <ScoreBar label="Communication Skills" score={scores.communication_skills || 0} max={20} />
              <ScoreBar label="Problem Solving" score={scores.problem_solving || 0} max={15} />
              <ScoreBar label="Domain Knowledge" score={scores.domain_knowledge || 0} max={15} />
              <ScoreBar label="Teamwork & Culture Fit" score={scores.teamwork_culture_fit || 0} max={10} />
            </CardContent>
          </Card>

          {/* Supplementary */}
          {Object.keys(supplementary).length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Supplementary Metrics</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <ScoreBar label="Answer Depth" score={supplementary.answer_depth || 0} max={10} />
                <ScoreBar label="Resume Consistency" score={supplementary.consistency_with_resume || 0} max={10} />
                <ScoreBar label="Verbal Communication" score={supplementary.verbal_communication || 0} max={10} />
                <ScoreBar label="Adaptability" score={supplementary.adaptability || 0} max={10} />
              </CardContent>
            </Card>
          )}

          {/* Qualitative */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Strongest Area</p>
                <p className="font-medium">{eval_.strongest_competency || '\u2014'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Area for Development</p>
                <p className="font-medium">{eval_.area_for_development || '\u2014'}</p>
              </CardContent>
            </Card>
          </div>

          {eval_.overall_impression && (
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Overall Impression</p>
                <p className="text-sm">{eval_.overall_impression}</p>
              </CardContent>
            </Card>
          )}

          {/* Red flags */}
          {eval_.red_flags?.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-4 w-4" /> Red Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {eval_.red_flags.map((flag: string, i: number) => (
                    <li key={i} className="text-red-600 dark:text-red-400">{flag}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="transcript" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="p-4 space-y-4">
                  {results.transcript.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg px-4 py-2 ${
                        msg.role === 'ai'
                          ? 'bg-muted text-foreground'
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {msg.role === 'ai' ? (
                            <MessageSquare className="h-3 w-3" />
                          ) : null}
                          <span className="text-xs font-medium">
                            {msg.role === 'ai' ? 'AI Interviewer' : 'Candidate'}
                          </span>
                          <Badge variant="outline" className="text-[10px] h-4">{msg.message_type}</Badge>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        {msg.code_content && (
                          <pre className="mt-2 p-2 bg-black/20 rounded text-xs overflow-x-auto">
                            <code>{msg.code_content}</code>
                          </pre>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="proctoring" className="space-y-4 mt-4">
          {/* Trust Score & Risk Level */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4" /> Proctoring Report
                </CardTitle>
                <div className="flex items-center gap-3">
                  <TrustScoreBadge score={results.proctoring_score} />
                  <RiskLevelBadge level={results.risk_level} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Trust Score</span>
                  <span className="font-medium">{results.proctoring_score ?? '\u2014'}%</span>
                </div>
                <Progress value={results.proctoring_score ?? 100} className="h-3" />
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Eye className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tab Switches</p>
                    <p className="text-sm font-semibold">
                      {results.proctoring_events.filter(e => e.event_type === 'tab_away' || e.event_type === 'window_blur').length}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Copy className="h-4 w-4 text-red-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Copy/Paste</p>
                    <p className="text-sm font-semibold">
                      {results.proctoring_events.filter(e => e.event_type === 'copy_paste').length}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                  <Monitor className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="text-xs text-muted-foreground">Total Events</p>
                    <p className="text-sm font-semibold">{results.proctoring_events.length}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cheating Flags */}
          {results.cheating_flags && results.cheating_flags.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-4 w-4" /> Flagged Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.cheating_flags.map((flag, i) => (
                    <CheatingFlagRow key={i} flag={flag} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Event Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {results.proctoring_events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No suspicious activity detected.</p>
              ) : (
                <ScrollArea className="h-[200px]">
                  {results.proctoring_events.map((evt, i) => (
                    <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                      <div className="flex items-center gap-2">
                        <EventIcon type={evt.event_type} />
                        <span className="text-muted-foreground capitalize">{evt.event_type.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {evt.duration_ms ? `${(evt.duration_ms / 1000).toFixed(1)}s` : ''}
                        {evt.timestamp && ` \u00b7 ${new Date(evt.timestamp).toLocaleTimeString()}`}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
