"use client";

import { useState } from "react";
import { User, Shield, Bell, MapPin, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      
      <div className="border-b border-zinc-100 pb-6">
        <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Settings</h1>
        <p className="text-zinc-500 mt-1">Manage your public profile and account preferences.</p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-zinc-100 p-1 mb-8">
          <TabsTrigger value="profile">Public Profile</TabsTrigger>
          <TabsTrigger value="services">Services & Rates</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>This is how clients will see you on Build Market.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Branding */}
              <div className="flex items-center gap-6">
                <Avatar className="h-24 w-24 border-2 border-zinc-100">
                  <AvatarImage src="https://i.pravatar.cc/150?u=1" />
                  <AvatarFallback>EN</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">Change Logo</Button>
                  <p className="text-xs text-zinc-400">JPG, GIF or PNG. Max size 2MB.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="Evans Structural Engineering" />
                </div>
                <div className="space-y-2">
                  <Label>License Number (NCA)</Label>
                  <Input defaultValue="NCA-128392" disabled className="bg-zinc-50" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bio / About Us</Label>
                <Textarea 
                  className="min-h-[120px]" 
                  defaultValue="We specialize in residential and commercial structural design..." 
                />
              </div>

              <div className="space-y-2">
                <Label>Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input className="pl-9" defaultValue="Nairobi, Kenya" />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">Save Changes</Button>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card className="border border-zinc-200 shadow-sm">
            <CardHeader>
              <CardTitle>Services Offered</CardTitle>
              <CardDescription>Select the categories you want to be listed under.</CardDescription>
            </CardHeader>
            <CardContent>
               <div className="p-8 text-center text-zinc-500 border-2 border-dashed border-zinc-200 rounded-xl">
                  Service Selection Component Goes Here
               </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}