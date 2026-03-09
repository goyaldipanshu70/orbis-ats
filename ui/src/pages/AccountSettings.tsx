
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { motion } from 'framer-motion';
import { fadeInUp, hoverScale, tapScale, staggerContainer } from '@/lib/animations';
import { StaggerGrid } from '@/components/ui/stagger-grid';
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemeMode, type AccentColor } from "@/contexts/ThemeContext";
import AppLayout from "@/components/layout/AppLayout";
import { apiClient } from "@/utils/api";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Sun, Moon, Monitor, Check, User as UserIcon, Lock, Bell, Palette, Shield, Calendar, Clock, Camera } from "lucide-react";
import { useState } from "react";

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
  { value: 'purple', label: 'Purple', swatch: 'bg-violet-500' },
  { value: 'red', label: 'Red', swatch: 'bg-red-500' },
  { value: 'orange', label: 'Orange', swatch: 'bg-orange-500' },
  { value: 'teal', label: 'Teal', swatch: 'bg-teal-500' },
];

const MODE_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

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

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen bg-background">
        <main className="flex-1 p-6 md:p-8">
          <div className="max-w-6xl mx-auto">
            {/* Page Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mb-8"
            >
              <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
              <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
            </motion.div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - 2/3 */}
              <div className="lg:col-span-2 space-y-6">
                <StaggerGrid className="grid gap-6">
                  {/* Profile Section */}
                  <motion.div variants={fadeInUp}>
                    <Card className="rounded-xl border shadow-sm">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                          <UserIcon className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Profile Information</CardTitle>
                        </div>
                        <CardDescription>
                          Your personal details and contact information
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6 p-6 pt-0">
                        {/* Avatar */}
                        <div className="flex items-center gap-5">
                          <div className="relative group">
                            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-semibold overflow-hidden ring-2 ring-border">
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
                            <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>

                        <Separator />

                        {/* Name fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="firstName" className="text-sm font-medium">First Name</Label>
                            <Input
                              id="firstName"
                              value={user.first_name}
                              readOnly
                              className="h-10 rounded-lg bg-muted/50"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="lastName" className="text-sm font-medium">Last Name</Label>
                            <Input
                              id="lastName"
                              value={user.last_name}
                              readOnly
                              className="h-10 rounded-lg bg-muted/50"
                            />
                          </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                          <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                          <Input
                            id="email"
                            type="email"
                            value={user.email}
                            readOnly
                            disabled
                            className="h-10 rounded-lg"
                          />
                        </div>

                        {/* Phone */}
                        <div className="space-y-1.5">
                          <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={user.phone ?? ''}
                            readOnly
                            className="h-10 rounded-lg bg-muted/50"
                            placeholder="Not provided"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Password Section */}
                  <motion.div variants={fadeInUp}>
                    <Card className="rounded-xl border shadow-sm">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                          <Lock className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Change Password</CardTitle>
                        </div>
                        <CardDescription>
                          Update your password to keep your account secure
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 pt-0">
                        <Form {...form}>
                          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                              control={form.control}
                              name="new_password"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">New Password</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="password"
                                      placeholder="Enter new password"
                                      className="h-10 rounded-lg"
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
                                  <FormLabel className="text-sm font-medium">Confirm New Password</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="password"
                                      placeholder="Confirm new password"
                                      className="h-10 rounded-lg"
                                      {...field}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <motion.div whileHover={hoverScale} whileTap={tapScale}>
                              <Button
                                type="submit"
                                disabled={form.formState.isSubmitting}
                                className="w-full h-10 rounded-lg"
                              >
                                {form.formState.isSubmitting ? "Updating..." : "Update Password"}
                              </Button>
                            </motion.div>
                          </form>
                        </Form>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Notifications Section */}
                  <motion.div variants={fadeInUp}>
                    <Card className="rounded-xl border shadow-sm">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                          <Bell className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Notifications</CardTitle>
                        </div>
                        <CardDescription>
                          Choose how you want to receive updates
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 space-y-0">
                        <div className="flex items-center justify-between py-4 border-b">
                          <div>
                            <p className="text-sm font-medium text-foreground">Email Notifications</p>
                            <p className="text-xs text-muted-foreground">Receive updates via email</p>
                          </div>
                          <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                        </div>
                        <div className="flex items-center justify-between py-4 border-b">
                          <div>
                            <p className="text-sm font-medium text-foreground">SMS Notifications</p>
                            <p className="text-xs text-muted-foreground">Receive updates via text message</p>
                          </div>
                          <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
                        </div>
                        <div className="flex items-center justify-between py-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">In-App Notifications</p>
                            <p className="text-xs text-muted-foreground">Receive in-app push notifications</p>
                          </div>
                          <Switch checked={inAppNotif} onCheckedChange={setInAppNotif} />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* Theme Section */}
                  <motion.div variants={fadeInUp}>
                    <Card className="rounded-xl border shadow-sm">
                      <CardHeader className="pb-4">
                        <div className="flex items-center gap-2">
                          <Palette className="h-5 w-5 text-muted-foreground" />
                          <CardTitle className="text-lg">Theme Preferences</CardTitle>
                        </div>
                        <CardDescription>
                          Customize the appearance of your workspace
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 pt-0 space-y-6">
                        {/* Mode selector */}
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Appearance</Label>
                          <div className="grid grid-cols-3 gap-3">
                            {MODE_OPTIONS.map((opt) => {
                              const Icon = opt.icon;
                              const isActive = mode === opt.value;
                              return (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setMode(opt.value)}
                                  className={`flex flex-col items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                                    isActive
                                      ? 'border-primary bg-primary/5 text-primary ring-2 ring-primary/20'
                                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                  {opt.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <Separator />

                        {/* Accent color selector */}
                        <div className="space-y-3">
                          <Label className="text-sm font-medium">Accent Color</Label>
                          <div className="flex gap-3">
                            {ACCENT_COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setAccentColor(color.value)}
                                title={color.label}
                                className={`relative h-9 w-9 rounded-full ${color.swatch} transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring ${
                                  accentColor === color.value ? 'ring-2 ring-offset-2 ring-ring scale-110' : ''
                                }`}
                              >
                                {accentColor === color.value && (
                                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
                                )}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Selected: {ACCENT_COLORS.find(c => c.value === accentColor)?.label ?? accentColor}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </StaggerGrid>
              </div>

              {/* Right Column - 1/3 */}
              <div className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 }}
                >
                  <Card className="rounded-xl border shadow-sm sticky top-24">
                    <CardHeader className="pb-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">Account Info</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6 pt-0 space-y-5">
                      {/* Role */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Role</p>
                        <Badge variant="secondary" className="capitalize text-sm px-3 py-1">
                          {user.role?.replace('_', ' ') ?? 'N/A'}
                        </Badge>
                      </div>

                      <Separator />

                      {/* Current Role / Title */}
                      {user.current_role && (
                        <>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Title</p>
                            <p className="text-sm text-foreground font-medium">{user.current_role}</p>
                          </div>
                          <Separator />
                        </>
                      )}

                      {/* Location */}
                      {user.location && (
                        <>
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Location</p>
                            <p className="text-sm text-foreground">{user.location}</p>
                          </div>
                          <Separator />
                        </>
                      )}

                      {/* Member Since */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Member Since</p>
                        </div>
                        <p className="text-sm text-foreground">{memberSince}</p>
                      </div>

                      <Separator />

                      {/* Last Login */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Last Login</p>
                        </div>
                        <p className="text-sm text-foreground">{lastLogin}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </AppLayout>
  );
};

export default AccountSettings;
