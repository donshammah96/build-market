"use client";

import { useState, useTransition } from "react";
import { 
  Save, 
  Shield, 
  Bell, 
  Smartphone, 
  Globe, 
  Wrench, 
  CreditCard,
  AlertTriangle
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { updateSystemSettings, clearSystemCache } from "@/actions/admin";
import { SystemSettingsInput } from "@/actions/admin";

type SettingsProps = {
  initialSettings: {
    maintenanceMode: boolean;
    publicSignup: boolean;
    enableAutoVerifyNCA: boolean;
    platformCommission: number;
    supportEmail: string;
    adminEmailAlerts: boolean;
    securityMFA: boolean;
  };
};

export default function SettingsClient({ initialSettings }: SettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);
  const [settings, setSettings] = useState(initialSettings);

  const handleChange = (key: string, value: string | number | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateSystemSettings(settings as SystemSettingsInput);
      if (result.success) {
        setHasChanges(false);
        window.location.reload(); // Simple refresh to show saved state
      } else {
        alert("Failed to save settings");
      }
    });
  };

  const handleClearCache = () => {
    startTransition(async () => {
      try {
        const result = await clearSystemCache();
        if (result.success) {
          alert("Cache cleared successfully");
        } else {
          alert("Failed to clear cache: " + result.error);
        }
      } catch (error: unknown) {
        alert("An unexpected error occurred while clearing cache.");
        console.error("Clear cache error:", error);
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Platform Settings</h1>
          <p className="text-zinc-500 mt-1">Manage global configurations and system preferences.</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!hasChanges || isPending}
          className="bg-zinc-900 hover:bg-zinc-800 text-white min-w-[140px]"
        >
          {isPending ? "Saving..." : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-zinc-100 p-1 mb-8 h-auto flex flex-wrap gap-1">
          <TabTrigger value="general" icon={Globe} label="General" />
          <TabTrigger value="platform" icon={Wrench} label="Platform Logic" />
          <TabTrigger value="notifications" icon={Bell} label="Notifications" />
          <TabTrigger value="security" icon={Shield} label="Security" />
        </TabsList>

        {/* --- General Tab --- */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Control the availability of the platform.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Maintenance Mode</Label>
                  <p className="text-sm text-zinc-500">Disable access for all non-admin users.</p>
                </div>
                <Switch 
                  checked={settings.maintenanceMode} 
                  onCheckedChange={(c) => handleChange('maintenanceMode', c)}
                  className="data-[state=checked]:bg-amber-500"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Public Registration</Label>
                  <p className="text-sm text-zinc-500">Allow new users and professionals to sign up.</p>
                </div>
                <Switch 
                  checked={settings.publicSignup}
                  onCheckedChange={(c) => handleChange('publicSignup', c)}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Public facing contact details for system emails.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor="support-email">Support Email</Label>
                <Input 
                  id="support-email" 
                  value={settings.supportEmail}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  className="max-w-md bg-zinc-50 border-zinc-200" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Platform Logic Tab --- */}
        <TabsContent value="platform" className="space-y-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Professional Verification</CardTitle>
              <CardDescription>Rules for onboarding new professionals.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Auto-Verify NCA Licenses</Label>
                  <p className="text-sm text-zinc-500">Automatically mark professionals as verified if NCA API returns valid.</p>
                </div>
                <Switch 
                  checked={settings.enableAutoVerifyNCA}
                  onCheckedChange={(c) => handleChange('enableAutoVerifyNCA', c)}
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Financial Configuration</CardTitle>
              <CardDescription>Manage fees and commission structures.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-zinc-500" /> 
                    Platform Commission
                  </Label>
                  <p className="text-sm text-zinc-500">Percentage taken from every completed project payment.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={settings.platformCommission}
                    onChange={(e) => handleChange('platformCommission', Number(e.target.value))}
                    className="w-20 text-right bg-zinc-50 border-zinc-200"
                  />
                  <span className="text-zinc-500 font-medium">%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Notifications Tab --- */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Admin Alerts</CardTitle>
              <CardDescription>Configure what events trigger an email to administrators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="flex-1">Email Alerts Enabled</Label>
                <Switch 
                  checked={settings.adminEmailAlerts}
                  onCheckedChange={(c) => handleChange('adminEmailAlerts', c)}
                  className="data-[state=checked]:bg-emerald-600" 
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Security Tab --- */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Access Control</CardTitle>
              <CardDescription>Manage security policies for administrators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-zinc-500" />
                    Enforce MFA for Admins
                  </Label>
                  <p className="text-sm text-zinc-500">Require multi-factor authentication for the dashboard.</p>
                </div>
                <Switch 
                  checked={settings.securityMFA}
                  onCheckedChange={(c) => handleChange('securityMFA', c)}
                  disabled
                  className="data-[state=checked]:bg-emerald-600"
                />
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border border-red-200 shadow-sm bg-red-50/10">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" /> Danger Zone
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border border-red-100 bg-white rounded-lg">
                <div>
                  <h4 className="font-medium text-zinc-900">Clear System Cache</h4>
                  <p className="text-sm text-zinc-500">Remove all cached data and revalidate paths.</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleClearCache}
                  disabled={isPending}
                >
                  Clear Cache
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}

interface TabTriggerProps {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

function TabTrigger({ value, icon: Icon, label }: TabTriggerProps) {
  return (
    <TabsTrigger 
      value={value}
      className="flex-1 min-w-[120px] gap-2 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm"
    >
      <Icon className="h-4 w-4" />
      {label}
    </TabsTrigger>
  )
}
