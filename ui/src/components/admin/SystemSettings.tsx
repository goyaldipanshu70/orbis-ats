
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Settings, Save, Globe, Mail, Shield } from 'lucide-react';

interface SystemSettings {
  app_name: string;
  app_description: string;
  app_url: string;
  support_email: string;
  max_file_size_mb: number;
  allowed_file_types: string[];
  enable_registrations: boolean;
  require_email_verification: boolean;
  session_timeout_hours: number;
  maintenance_mode: boolean;
  maintenance_message: string;
}

const SystemSettings = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    app_name: 'Candidate Evaluation Platform',
    app_description: 'AI-powered candidate evaluation and recruitment platform',
    app_url: '',
    support_email: '',
    max_file_size_mb: 10,
    allowed_file_types: ['pdf', 'doc', 'docx', 'txt'],
    enable_registrations: true,
    require_email_verification: true,
    session_timeout_hours: 24,
    maintenance_mode: false,
    maintenance_message: 'The system is currently under maintenance. Please try again later.',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/system', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load system settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings/system', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'System settings saved successfully.',
        });
      }
    } catch (error) {
      console.error('Error saving system settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save system settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-muted-foreground">Loading system settings...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Application Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>Application Settings</span>
          </CardTitle>
          <CardDescription>
            Configure basic application information and branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="app_name">Application Name</Label>
              <Input
                id="app_name"
                value={settings.app_name}
                onChange={(e) => handleInputChange('app_name', e.target.value)}
                placeholder="Enter application name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app_url">Application URL</Label>
              <Input
                id="app_url"
                value={settings.app_url}
                onChange={(e) => handleInputChange('app_url', e.target.value)}
                placeholder="https://your-domain.com"
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="app_description">Application Description</Label>
            <Textarea
              id="app_description"
              value={settings.app_description}
              onChange={(e) => handleInputChange('app_description', e.target.value)}
              placeholder="Enter application description"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="support_email">Support Email</Label>
            <Input
              id="support_email"
              type="email"
              value={settings.support_email}
              onChange={(e) => handleInputChange('support_email', e.target.value)}
              placeholder="support@your-domain.com"
            />
          </div>
        </CardContent>
      </Card>

      {/* File Upload Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-green-600" />
            <span>File Upload Settings</span>
          </CardTitle>
          <CardDescription>
            Configure file upload restrictions and permissions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="max_file_size_mb">Maximum File Size (MB)</Label>
              <Input
                id="max_file_size_mb"
                type="number"
                value={settings.max_file_size_mb}
                onChange={(e) => handleInputChange('max_file_size_mb', parseInt(e.target.value))}
                min="1"
                max="100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="allowed_file_types">Allowed File Types</Label>
              <Input
                id="allowed_file_types"
                value={settings.allowed_file_types.join(', ')}
                onChange={(e) => handleInputChange('allowed_file_types', e.target.value.split(', '))}
                placeholder="pdf, doc, docx, txt"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <span>Security & Access Settings</span>
          </CardTitle>
          <CardDescription>
            Configure security policies and user access controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable User Registrations</Label>
              <p className="text-sm text-muted-foreground">Allow new users to register for accounts</p>
            </div>
            <Switch
              checked={settings.enable_registrations}
              onCheckedChange={(checked) => handleInputChange('enable_registrations', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Require Email Verification</Label>
              <p className="text-sm text-muted-foreground">Require users to verify their email addresses</p>
            </div>
            <Switch
              checked={settings.require_email_verification}
              onCheckedChange={(checked) => handleInputChange('require_email_verification', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="session_timeout_hours">Session Timeout (Hours)</Label>
            <Select
              value={settings.session_timeout_hours.toString()}
              onValueChange={(value) => handleInputChange('session_timeout_hours', parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 hour</SelectItem>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="24">24 hours</SelectItem>
                <SelectItem value="72">3 days</SelectItem>
                <SelectItem value="168">7 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="w-5 h-5 text-orange-600" />
            <span>Maintenance Mode</span>
          </CardTitle>
          <CardDescription>
            Control system maintenance and user access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Enable Maintenance Mode</Label>
              <p className="text-sm text-muted-foreground">Temporarily disable user access to the system</p>
            </div>
            <Switch
              checked={settings.maintenance_mode}
              onCheckedChange={(checked) => handleInputChange('maintenance_mode', checked)}
            />
          </div>

          {settings.maintenance_mode && (
            <div className="space-y-2">
              <Label htmlFor="maintenance_message">Maintenance Message</Label>
              <Textarea
                id="maintenance_message"
                value={settings.maintenance_message}
                onChange={(e) => handleInputChange('maintenance_message', e.target.value)}
                placeholder="Enter maintenance message for users"
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
        >
          {isSaving ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Saving...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Save className="w-4 h-4" />
              <span>Save Settings</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SystemSettings;
