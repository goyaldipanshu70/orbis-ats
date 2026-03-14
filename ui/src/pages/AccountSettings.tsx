
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeMode, type AccentColor } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import CandidateLayout from "@/components/layout/CandidateLayout";
import { apiClient } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Sun, Moon, Monitor, Check, User as UserIcon, Lock, Bell, Palette, Shield, Calendar, Clock, Camera } from "lucide-react";
import { useState } from "react";

/* ── design-system constants ─────────────────────────────────── */

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};

const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

/* ── form schema ─────────────────────────────────────────────── */

const passwordFormSchema = z.object({
  new_password: z.string().min(8, "Password must be at least 8 characters long."),
  confirm_password: z.string(),
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

const ACCENT_COLORS: { value: AccentColor; label: string; swatch: string }[] = [
  { value: 'blue', label: 'Blue', swatch: 'bg-blue-500' },
  { value: 'green', label: 'Green', swatch: 'bg-green-600' },
  { value: 'purple', label: 'Purple', swatch: 'bg-blue-500' },
  { value: 'red', label: 'Red', swatch: 'bg-red-500' },
  { value: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
  { value: 'teal', label: 'Teal', swatch: 'bg-teal-500' },
];

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/* ── component ───────────────────────────────────────────────── */

const AccountSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { mode, accentColor, setMode, setAccentColor } = useTheme();
  const [emailNotif, setEmailNotif] = useState(true);
  const [smsNotif, setSmsNotif] = useState(false);
  const [inAppNotif, setInAppNotif] = useState(true);

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      new_password: "",
      confirm_password: "",
    },
  });

  const onSubmit = async (data: PasswordFormValues) => {
    try {
      await apiClient.resetPassword(data.new_password);
      toast({
        title: "Success",
        description: "Your password has been updated successfully.",
      });
      form.reset();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update your password. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase();
  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'N/A';
  const lastLogin = user.last_login
    ? new Date(user.last_login).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'N/A';

  const Layout = user.role === 'candidate' ? CandidateLayout : AppLayout;

  return (
    <Layout>
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white">Account Settings</h1>
              <p className="text-slate-400 mt-1">Manage your profile and preferences</p>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - 2/3 */}
              <div className="lg:col-span-2 space-y-6">
                {/* Profile Section */}
                <div className="rounded-xl" style={glassCard}>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                      <UserIcon className="h-5 w-5 text-slate-400" />
                      <h2 className="text-lg font-semibold text-white">Profile Information</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Your personal details and contact information
                    </p>
                  </div>
                  <div className="space-y-6 p-6 pt-0">
                    {/* Avatar */}
                    <div className="flex items-center gap-5">
                      <div className="relative group">
                        <div
                          className="h-20 w-20 rounded-full flex items-center justify-center text-blue-400 text-xl font-semibold overflow-hidden"
                          style={{ background: 'rgba(27,142,229,0.1)', border: '2px solid var(--orbis-border)' }}
                        >
                          {user.avatar_url || user.picture ? (
                            <img
                              src={user.avatar_url || user.picture}
                              alt={`${user.first_name} ${user.last_name}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            initials
                          )}
                        </div>
                        <button
                          type="button"
                          className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <Camera className="h-5 w-5 text-white" />
                        </button>
                      </div>
                      <div>
                        <p className="font-medium text-white">{user.first_name} {user.last_name}</p>
                        <p className="text-sm text-slate-400">{user.email}</p>
                      </div>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    {/* Name fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="firstName" className="text-sm font-medium text-slate-300">First Name</label>
                        <input
                          id="firstName"
                          value={user.first_name}
                          readOnly
                          className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all"
                          style={glassInput}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="lastName" className="text-sm font-medium text-slate-300">Last Name</label>
                        <input
                          id="lastName"
                          value={user.last_name}
                          readOnly
                          className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all"
                          style={glassInput}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                        />
                      </div>
                    </div>

                    {/* Email */}
                    <div className="space-y-1.5">
                      <label htmlFor="email" className="text-sm font-medium text-slate-300">Email Address</label>
                      <input
                        id="email"
                        type="email"
                        value={user.email}
                        readOnly
                        disabled
                        className="w-full h-10 rounded-lg px-3 text-sm outline-none opacity-60"
                        style={glassInput}
                      />
                    </div>

                    {/* Phone */}
                    <div className="space-y-1.5">
                      <label htmlFor="phone" className="text-sm font-medium text-slate-300">Phone Number</label>
                      <input
                        id="phone"
                        type="tel"
                        value={user.phone ?? ''}
                        readOnly
                        placeholder="Not provided"
                        className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                      />
                    </div>
                  </div>
                </div>

                {/* Password Section */}
                <div className="rounded-xl" style={glassCard}>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                      <Lock className="h-5 w-5 text-slate-400" />
                      <h2 className="text-lg font-semibold text-white">Change Password</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Update your password to keep your account secure
                    </p>
                  </div>
                  <div className="p-6 pt-0">
                    <Form {...form}>
                      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                          control={form.control}
                          name="new_password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-300">New Password</FormLabel>
                              <FormControl>
                                <input
                                  type="password"
                                  placeholder="Enter new password"
                                  className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500"
                                  style={glassInput}
                                  onFocus={handleFocus}
                                  onBlur={handleBlur}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="confirm_password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium text-slate-300">Confirm New Password</FormLabel>
                              <FormControl>
                                <input
                                  type="password"
                                  placeholder="Confirm new password"
                                  className="w-full h-10 rounded-lg px-3 text-sm outline-none transition-all placeholder:text-slate-500"
                                  style={glassInput}
                                  onFocus={handleFocus}
                                  onBlur={handleBlur}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <button
                          type="submit"
                          disabled={form.formState.isSubmitting}
                          className="w-full h-10 rounded-lg text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
                        >
                          {form.formState.isSubmitting ? "Updating..." : "Update Password"}
                        </button>
                      </form>
                    </Form>
                  </div>
                </div>

                {/* Notifications Section */}
                <div className="rounded-xl" style={glassCard}>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                      <Bell className="h-5 w-5 text-slate-400" />
                      <h2 className="text-lg font-semibold text-white">Notifications</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Choose how you want to receive updates
                    </p>
                  </div>
                  <div className="p-6 pt-0 space-y-0">
                    <div
                      className="flex items-center justify-between py-4"
                      style={{ borderBottom: '1px solid var(--orbis-border)' }}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">Email Notifications</p>
                        <p className="text-xs text-slate-500">Receive updates via email</p>
                      </div>
                      <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                    </div>
                    <div
                      className="flex items-center justify-between py-4"
                      style={{ borderBottom: '1px solid var(--orbis-border)' }}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">SMS Notifications</p>
                        <p className="text-xs text-slate-500">Receive updates via text message</p>
                      </div>
                      <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
                    </div>
                    <div className="flex items-center justify-between py-4">
                      <div>
                        <p className="text-sm font-medium text-white">In-App Notifications</p>
                        <p className="text-xs text-slate-500">Receive in-app push notifications</p>
                      </div>
                      <Switch checked={inAppNotif} onCheckedChange={setInAppNotif} />
                    </div>
                  </div>
                </div>

                {/* Theme Section */}
                <div className="rounded-xl" style={glassCard}>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-slate-400" />
                      <h2 className="text-lg font-semibold text-white">Theme Preferences</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                      Customize the appearance of your workspace
                    </p>
                  </div>
                  <div className="p-6 pt-0 space-y-6">
                    {/* Mode selector */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-300">Appearance</label>
                      <div className="grid grid-cols-3 gap-3">
                        {MODE_OPTIONS.map((opt) => {
                          const Icon = opt.icon;
                          const isActive = mode === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setMode(opt.value)}
                              className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                isActive
                                  ? 'text-blue-400 ring-2 ring-blue-500/30'
                                  : 'text-slate-400 hover:text-slate-200'
                              }`}
                              style={
                                isActive
                                  ? { background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.3)' }
                                  : { background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }
                              }
                            >
                              <Icon className="h-5 w-5" />
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    {/* Accent color selector */}
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-slate-300">Accent Color</label>
                      <div className="flex gap-3">
                        {ACCENT_COLORS.map((color) => (
                          <button
                            key={color.value}
                            type="button"
                            onClick={() => setAccentColor(color.value)}
                            title={color.label}
                            className={`relative h-9 w-9 rounded-full ${color.swatch} transition-all hover:scale-110 focus:outline-none ${
                              accentColor === color.value ? 'ring-2 ring-offset-2 ring-blue-500 ring-offset-[var(--orbis-page)] scale-110' : ''
                            }`}
                          >
                            {accentColor === color.value && (
                              <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                            )}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500">
                        Selected: {ACCENT_COLORS.find(c => c.value === accentColor)?.label ?? accentColor}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - 1/3 */}
              <div className="space-y-6">
                <div className="rounded-xl sticky top-24" style={glassCard}>
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-slate-400" />
                      <h2 className="text-lg font-semibold text-white">Account Info</h2>
                    </div>
                  </div>
                  <div className="p-6 pt-0 space-y-5">
                    {/* Role */}
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Role</p>
                      <span className="inline-block capitalize text-sm px-3 py-1 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {user.role?.replace('_', ' ') ?? 'N/A'}
                      </span>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    {/* Current Role / Title */}
                    {user.current_role && (
                      <>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Title</p>
                          <p className="text-sm text-white font-medium">{user.current_role}</p>
                        </div>
                        <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />
                      </>
                    )}

                    {/* Location */}
                    {user.location && (
                      <>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Location</p>
                          <p className="text-sm text-white">{user.location}</p>
                        </div>
                        <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />
                      </>
                    )}

                    {/* Member Since */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-500" />
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Member Since</p>
                      </div>
                      <p className="text-sm text-white">{memberSince}</p>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    {/* Last Login */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Last Login</p>
                      </div>
                      <p className="text-sm text-white">{lastLogin}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </Layout>
  );
};

export default AccountSettings;
