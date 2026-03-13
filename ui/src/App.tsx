import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import HiringRoute from "@/components/HiringRoute";
import HRRoute from "@/components/HRRoute";
import CandidateRoute from "@/components/CandidateRoute";
import InterviewerRoute from "@/components/InterviewerRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import GoogleCallback from "@/pages/GoogleCallback";
import LinkedInCallback from "@/pages/LinkedInCallback";
import Dashboard from "@/pages/Dashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import CreateJob from "@/pages/CreateJob";
import JobDetail from "@/pages/JobDetail";
import CandidateEvaluation from "@/pages/CandidateEvaluation";
import CandidateDetail from "@/pages/CandidateDetail";
import InterviewEvaluations from "@/pages/InterviewEvaluations";
import NotFound from "@/pages/NotFound";
import AccountSettings from "@/pages/AccountSettings";
import HiringAssistant from "@/pages/HiringAssistant";
import Analytics from "@/pages/Analytics";
import DocumentTemplates from "@/pages/DocumentTemplates";
import TalentPool from "@/pages/TalentPool";
import Careers from "@/pages/Careers";
import CareerJobDetail from "@/pages/CareerJobDetail";
import CandidateSignup from "@/pages/CandidateSignup";
import MyApplications from "@/pages/MyApplications";
import ApplicationDetail from "@/pages/ApplicationDetail";
import Pipeline from "@/pages/Pipeline";
import OrchestratorDashboard from "@/pages/OrchestratorDashboard";

const InterviewerDashboard = lazy(() => import("./pages/InterviewerDashboard"));
const InterviewerManagement = lazy(() => import("./pages/InterviewerManagement"));
const FeedbackForm = lazy(() => import("./pages/FeedbackForm"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const CandidateFeedbackDetail = lazy(() => import("./pages/CandidateFeedbackDetail"));
const Announcements = lazy(() => import("./pages/Announcements"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Referrals = lazy(() => import("./pages/Referrals"));
const Outreach = lazy(() => import("./pages/Outreach"));
const CandidateScorecard = lazy(() => import("./pages/CandidateScorecard"));
const CandidateCompare = lazy(() => import("./pages/CandidateCompare"));
const Compliance = lazy(() => import("./pages/Compliance"));
const AIInterviewRoom = lazy(() => import("./pages/AIInterviewRoom"));
const JobRequests = lazy(() => import("./pages/JobRequests"));
const JDTemplates = lazy(() => import("./pages/JDTemplates"));
const LeadGeneration = lazy(() => import("./pages/LeadGeneration"));
const InboxCapture = lazy(() => import("./pages/InboxCapture"));
const JobPortals = lazy(() => import("./pages/JobPortals"));
const PeopleAnalytics = lazy(() => import("./pages/PeopleAnalytics"));
const Jobs = lazy(() => import("./pages/Jobs"));
const WorkflowList = lazy(() => import("./pages/WorkflowList"));
const WorkflowBuilder = lazy(() => import("./pages/WorkflowBuilder"));
const WorkflowRunHistory = lazy(() => import("./pages/WorkflowRunHistory"));
const WorkflowLeadResults = lazy(() => import("./pages/WorkflowLeadResults"));
const WorkflowTemplates = lazy(() => import("./pages/WorkflowTemplates"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/** Smart home redirect based on user's role */
const HomeRedirect = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'interviewer') return <Navigate to="/interviews" replace />;
  if (user.role === 'candidate') return <Navigate to="/my-applications" replace />;
  return <Navigate to="/dashboard" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Sonner />
      <AuthProvider>
        <ThemeProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/login/success" element={<GoogleCallback />} />
            <Route path="/linkedin/success" element={<LinkedInCallback />} />

            {/* Public careers (no auth required) */}
            <Route path="/careers" element={<Careers />} />
            <Route path="/careers/:jobId" element={<CareerJobDetail />} />
            <Route path="/careers/signup" element={<CandidateSignup />} />
            <Route path="/ai-interview/:token" element={<Suspense fallback={null}><AIInterviewRoom /></Suspense>} />
            <Route path="/invite/:token" element={<Suspense fallback={null}><AcceptInvite /></Suspense>} />

            {/* Candidate-only routes */}
            <Route path="/my-applications" element={<CandidateRoute><MyApplications /></CandidateRoute>} />
            <Route path="/my-applications/:id" element={<CandidateRoute><ApplicationDetail /></CandidateRoute>} />

            {/* Hiring routes — requires admin, hr, or hiring_manager */}
            <Route path="/dashboard" element={<HiringRoute><Dashboard /></HiringRoute>} />
            <Route path="/jobs" element={<HiringRoute><Suspense fallback={null}><Jobs /></Suspense></HiringRoute>} />
            <Route path="/jobs/create" element={<HiringRoute><CreateJob /></HiringRoute>} />
            <Route path="/jobs/:jobId" element={<HiringRoute><JobDetail /></HiringRoute>} />
            <Route path="/jobs/:jobId/candidates" element={<HiringRoute><CandidateEvaluation /></HiringRoute>} />
            <Route path="/jobs/:jobId/interview-evaluations" element={<HiringRoute><InterviewEvaluations /></HiringRoute>} />
            <Route path="/jobs/:jobId/interview-evaluations/:candidateId/details" element={<HiringRoute><CandidateDetail /></HiringRoute>} />
            <Route path="/jobs/:jobId/pipeline" element={<HiringRoute><Pipeline /></HiringRoute>} />
            <Route path="/hiring-assistant" element={<HiringRoute><HiringAssistant /></HiringRoute>} />
            <Route path="/analytics" element={<HiringRoute><Analytics /></HiringRoute>} />
            <Route path="/talent-pool" element={<HiringRoute><TalentPool /></HiringRoute>} />
            <Route path="/templates" element={<HRRoute><DocumentTemplates /></HRRoute>} />
            <Route path="/referrals" element={<ProtectedRoute><Suspense fallback={null}><Referrals /></Suspense></ProtectedRoute>} />
            <Route path="/outreach" element={<HRRoute><Suspense fallback={null}><Outreach /></Suspense></HRRoute>} />
            <Route path="/scorecard/:candidateId" element={<HiringRoute><Suspense fallback={null}><CandidateScorecard /></Suspense></HiringRoute>} />
            <Route path="/compare" element={<HiringRoute><Suspense fallback={null}><CandidateCompare /></Suspense></HiringRoute>} />
            <Route path="/compliance" element={<HRRoute><Suspense fallback={null}><Compliance /></Suspense></HRRoute>} />
            <Route path="/job-requests" element={<HiringRoute><Suspense fallback={null}><JobRequests /></Suspense></HiringRoute>} />
            <Route path="/jd-templates" element={<HRRoute><Suspense fallback={null}><JDTemplates /></Suspense></HRRoute>} />
            <Route path="/lead-generation" element={<HRRoute><Suspense fallback={null}><LeadGeneration /></Suspense></HRRoute>} />
            <Route path="/inbox-capture" element={<HRRoute><Suspense fallback={null}><InboxCapture /></Suspense></HRRoute>} />
            <Route path="/people-analytics" element={<HRRoute><Suspense fallback={null}><PeopleAnalytics /></Suspense></HRRoute>} />
            <Route path="/workflows" element={<HRRoute><Suspense fallback={null}><WorkflowList /></Suspense></HRRoute>} />
            <Route path="/workflows/templates" element={<HRRoute><Suspense fallback={null}><WorkflowTemplates /></Suspense></HRRoute>} />
            <Route path="/workflows/:workflowId/runs" element={<HRRoute><Suspense fallback={null}><WorkflowRunHistory /></Suspense></HRRoute>} />
            <Route path="/workflows/runs/:runId/leads" element={<HRRoute><Suspense fallback={null}><WorkflowLeadResults /></Suspense></HRRoute>} />
            <Route path="/workflows/:workflowId" element={<HRRoute><Suspense fallback={null}><WorkflowBuilder /></Suspense></HRRoute>} />

            {/* Company routes — admin + HR */}
            <Route path="/announcements" element={<HRRoute><Suspense fallback={null}><Announcements /></Suspense></HRRoute>} />
            <Route path="/onboarding" element={<HRRoute><Suspense fallback={null}><Onboarding /></Suspense></HRRoute>} />

            {/* Interviewer routes */}
            <Route path="/interviews" element={<InterviewerRoute><Suspense fallback={null}><InterviewerDashboard /></Suspense></InterviewerRoute>} />
            <Route path="/interviews/:scheduleId/feedback" element={<InterviewerRoute><Suspense fallback={null}><FeedbackForm /></Suspense></InterviewerRoute>} />
            <Route path="/interviewers" element={<HRRoute><Suspense fallback={null}><InterviewerManagement /></Suspense></HRRoute>} />
            <Route path="/jobs/:jobId/candidates/:candidateId/feedback" element={<HiringRoute><Suspense fallback={null}><CandidateFeedbackDetail /></Suspense></HiringRoute>} />

            {/* Settings & Admin */}
            <Route path="/account-settings" element={<ProtectedRoute><AccountSettings /></ProtectedRoute>} />
            <Route path="/job-portals" element={<AdminRoute><Suspense fallback={null}><JobPortals /></Suspense></AdminRoute>} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/orchestrator" element={<AdminRoute><OrchestratorDashboard /></AdminRoute>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </ErrorBoundary>
        </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
