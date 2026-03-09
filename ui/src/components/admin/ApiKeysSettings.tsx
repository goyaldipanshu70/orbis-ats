import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Key, Save, TestTube, Mail } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface EmailSettings {
  provider: 'sendgrid' | 'mailgun' | 'smtp' | '';
  api_key: string;
  smtp_host: string;
  smtp_port: number | string;
  smtp_user: string;
  smtp_password: string;
}

interface ApiSettings {
  google_client_id: string;
  google_client_secret: string;
  openai_api_key: string;
  stripe_publishable_key: string;
  stripe_secret_key: string;
  email_settings: EmailSettings;
}

const ApiKeysSettings = () => {
  const [settings, setSettings] = useState<ApiSettings>({
    google_client_id: '',
    google_client_secret: '',
    openai_api_key: '',
    stripe_publishable_key: '',
    stripe_secret_key: '',
    email_settings: {
      provider: '',
      api_key: '',
      smtp_host: '',
      smtp_port: '',
      smtp_user: '',
      smtp_password: '',
    },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/api-keys', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        // Ensure email_settings exists to prevent errors
        setSettings({ ...data, email_settings: data.email_settings || { provider: '' } });
      }
    } catch (error) {
      console.error('Error loading API settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to load API settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings/api-keys', {
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
          description: 'API settings saved successfully.',
        });
      }
    } catch (error) {
      console.error('Error saving API settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save API settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async (service: string) => {
    try {
      const response = await fetch(`/api/admin/test/${service}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: `${service} connection test passed.`,
        });
      } else {
        throw new Error('Test failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: `${service} connection test failed.`,
        variant: 'destructive',
      });
    }
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleInputChange = (field: keyof Omit<ApiSettings, 'email_settings'>, value: string) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleEmailSettingsChange = (field: keyof EmailSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      email_settings: {
        ...prev.email_settings,
        [field]: value,
      },
    }));
  };

  if (isLoading) {
    return (
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-muted-foreground">Loading API settings...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Google OAuth Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-blue-600" />
            <span>Google OAuth Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure Google OAuth for user authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="google_client_id">Google Client ID</Label>
              <Input
                id="google_client_id"
                value={settings.google_client_id}
                onChange={(e) => handleInputChange('google_client_id', e.target.value)}
                placeholder="Enter Google Client ID"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google_client_secret">Google Client Secret</Label>
              <div className="relative">
                <Input
                  id="google_client_secret"
                  type={showSecrets.google_client_secret ? "text" : "password"}
                  value={settings.google_client_secret}
                  onChange={(e) => handleInputChange('google_client_secret', e.target.value)}
                  placeholder="Enter Google Client Secret"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('google_client_secret')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets.google_client_secret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button
            onClick={() => testConnection('google')}
            variant="outline"
            size="sm"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Google OAuth
          </Button>
        </CardContent>
      </Card>

      {/* OpenAI Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-green-600" />
            <span>OpenAI Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure OpenAI API for AI-powered features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="openai_api_key">OpenAI API Key</Label>
            <div className="relative">
              <Input
                id="openai_api_key"
                type={showSecrets.openai_api_key ? "text" : "password"}
                value={settings.openai_api_key}
                onChange={(e) => handleInputChange('openai_api_key', e.target.value)}
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => toggleSecretVisibility('openai_api_key')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecrets.openai_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <Button
            onClick={() => testConnection('openai')}
            variant="outline"
            size="sm"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test OpenAI Connection
          </Button>
        </CardContent>
      </Card>

      {/* Stripe Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Key className="w-5 h-5 text-purple-600" />
            <span>Stripe Payment Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure Stripe for payment processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="stripe_publishable_key">Stripe Publishable Key</Label>
              <Input
                id="stripe_publishable_key"
                value={settings.stripe_publishable_key}
                onChange={(e) => handleInputChange('stripe_publishable_key', e.target.value)}
                placeholder="pk_..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="stripe_secret_key">Stripe Secret Key</Label>
              <div className="relative">
                <Input
                  id="stripe_secret_key"
                  type={showSecrets.stripe_secret_key ? "text" : "password"}
                  value={settings.stripe_secret_key}
                  onChange={(e) => handleInputChange('stripe_secret_key', e.target.value)}
                  placeholder="sk_..."
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('stripe_secret_key')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets.stripe_secret_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <Button
            onClick={() => testConnection('stripe')}
            variant="outline"
            size="sm"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Stripe Connection
          </Button>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card className="bg-card/80 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5 text-red-600" />
            <span>Email Configuration</span>
          </CardTitle>
          <CardDescription>
            Configure email service for notifications and password resets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email_provider">Email Provider</Label>
            <Select
              value={settings.email_settings.provider}
              onValueChange={(value) => handleEmailSettingsChange('provider', value)}
            >
              <SelectTrigger id="email_provider">
                <SelectValue placeholder="Select an email provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">SMTP</SelectItem>
                <SelectItem value="sendgrid">SendGrid</SelectItem>
                <SelectItem value="mailgun">Mailgun</SelectItem>
              </SelectContent>
            </Select>
          </div>

          { (settings.email_settings.provider === 'sendgrid' || settings.email_settings.provider === 'mailgun') && (
            <div className="space-y-2">
              <Label htmlFor="email_api_key">API Key</Label>
              <div className="relative">
                <Input
                  id="email_api_key"
                  type={showSecrets.email_api_key ? "text" : "password"}
                  value={settings.email_settings.api_key}
                  onChange={(e) => handleEmailSettingsChange('api_key', e.target.value)}
                  placeholder="Enter API Key"
                />
                <button
                  type="button"
                  onClick={() => toggleSecretVisibility('email_api_key')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecrets.email_api_key ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          { settings.email_settings.provider === 'smtp' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input id="smtp_host" value={settings.email_settings.smtp_host} onChange={(e) => handleEmailSettingsChange('smtp_host', e.target.value)} placeholder="smtp.example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input id="smtp_port" type="number" value={settings.email_settings.smtp_port} onChange={(e) => handleEmailSettingsChange('smtp_port', parseInt(e.target.value))} placeholder="587" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input id="smtp_user" value={settings.email_settings.smtp_user} onChange={(e) => handleEmailSettingsChange('smtp_user', e.target.value)} placeholder="your-username" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_password">SMTP Password</Label>
                <div className="relative">
                   <Input
                    id="smtp_password"
                    type={showSecrets.smtp_password ? "text" : "password"}
                    value={settings.email_settings.smtp_password}
                    onChange={(e) => handleEmailSettingsChange('smtp_password', e.target.value)}
                    placeholder="Enter SMTP Password"
                  />
                  <button
                    type="button"
                    onClick={() => toggleSecretVisibility('smtp_password')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showSecrets.smtp_password ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
          <Button
            onClick={() => testConnection('email')}
            variant="outline"
            size="sm"
            disabled={!settings.email_settings.provider}
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Email Connection
          </Button>
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
              <span>Save All Settings</span>
            </div>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ApiKeysSettings;
