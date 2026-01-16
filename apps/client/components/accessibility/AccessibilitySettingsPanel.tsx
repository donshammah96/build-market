"use client";

import React, { memo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accessibility,
  Eye,
  Monitor,
  Type,
  Palette,
  RotateCcw,
  Sparkles,
  Focus,
  Keyboard,
} from "lucide-react";
import { useAccessibilityStore } from "@/lib/stores/accessibilityStore";
import { cn } from "@/lib/utils";

// Custom Switch component since we might not have one
const Switch = memo(function Switch({
  checked,
  onCheckedChange,
  id,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  id?: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
        "transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-emerald-600" : "bg-zinc-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0",
          "transition duration-200 ease-in-out",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
});

// Setting row component for consistency
const SettingRow = memo(function SettingRow({
  icon: Icon,
  label,
  description,
  children,
  htmlFor,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-zinc-100 last:border-0">
      <div className="flex gap-3">
        <div className="mt-0.5 p-2 rounded-lg bg-zinc-100 text-zinc-600">
          <Icon size={18} aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={htmlFor}
            className="text-sm font-medium text-zinc-900 cursor-pointer"
          >
            {label}
          </Label>
          <p className="text-xs text-zinc-500 max-w-[280px]">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
});

// Section header component
const SectionHeader = memo(function SectionHeader({
  title,
}: {
  title: string;
}) {
  return (
    <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mt-6 mb-2 first:mt-0">
      {title}
    </h3>
  );
});

interface AccessibilitySettingsPanelProps {
  trigger?: React.ReactNode;
}

export const AccessibilitySettingsPanel = memo(
  function AccessibilitySettingsPanel({
    trigger,
  }: AccessibilitySettingsPanelProps) {
    const {
      reduceMotion,
      setReduceMotion,
      reduceTransparency,
      setReduceTransparency,
      highContrast,
      setHighContrast,
      largeText,
      setLargeText,
      fontSize,
      setFontSize,
      enhancedFocus,
      setEnhancedFocus,
      keyboardShortcuts,
      setKeyboardShortcuts,
      colorBlindMode,
      setColorBlindMode,
      dyslexiaFont,
      setDyslexiaFont,
      lineSpacing,
      setLineSpacing,
      resetToDefaults,
    } = useAccessibilityStore();

    const handleReset = useCallback(() => {
      resetToDefaults();
    }, [resetToDefaults]);

    return (
      <Dialog>
        <DialogTrigger asChild>
          {trigger || (
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Accessibility settings"
            >
              <Accessibility size={20} />
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Accessibility className="h-5 w-5 text-emerald-600" />
              Accessibility Settings
            </DialogTitle>
            <DialogDescription>
              Customize your experience to suit your needs. Changes are saved
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            {/* Motion & Animation */}
            <SectionHeader title="Motion & Animation" />

            <SettingRow
              icon={Sparkles}
              label="Reduce Motion"
              description="Minimize animations and transitions throughout the site"
              htmlFor="reduce-motion"
            >
              <Select
                value={reduceMotion}
                onValueChange={(value: "system" | "on" | "off") =>
                  setReduceMotion(value)
                }
              >
                <SelectTrigger className="w-[120px]" id="reduce-motion">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="on">Always On</SelectItem>
                  <SelectItem value="off">Always Off</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              icon={Monitor}
              label="Reduce Transparency"
              description="Use solid colors instead of translucent backgrounds"
              htmlFor="reduce-transparency"
            >
              <Switch
                id="reduce-transparency"
                checked={reduceTransparency}
                onCheckedChange={setReduceTransparency}
              />
            </SettingRow>

            {/* Visual */}
            <SectionHeader title="Visual" />

            <SettingRow
              icon={Eye}
              label="High Contrast"
              description="Increase contrast for better visibility"
              htmlFor="high-contrast"
            >
              <Switch
                id="high-contrast"
                checked={highContrast}
                onCheckedChange={setHighContrast}
              />
            </SettingRow>

            <SettingRow
              icon={Type}
              label="Large Text"
              description="Increase default text size across the site"
              htmlFor="large-text"
            >
              <Switch
                id="large-text"
                checked={largeText}
                onCheckedChange={setLargeText}
              />
            </SettingRow>

            <SettingRow
              icon={Type}
              label="Font Size"
              description="Fine-tune text size (75% - 150%)"
              htmlFor="font-size"
            >
              <Select
                value={String(fontSize)}
                onValueChange={(value) => setFontSize(Number(value))}
              >
                <SelectTrigger className="w-[100px]" id="font-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="75">75%</SelectItem>
                  <SelectItem value="85">85%</SelectItem>
                  <SelectItem value="100">100%</SelectItem>
                  <SelectItem value="115">115%</SelectItem>
                  <SelectItem value="125">125%</SelectItem>
                  <SelectItem value="150">150%</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Color */}
            <SectionHeader title="Color & Vision" />

            <SettingRow
              icon={Palette}
              label="Color Blind Mode"
              description="Adjust colors for different types of color blindness"
              htmlFor="color-blind-mode"
            >
              <Select
                value={colorBlindMode}
                onValueChange={(
                  value: "none" | "protanopia" | "deuteranopia" | "tritanopia"
                ) => setColorBlindMode(value)}
              >
                <SelectTrigger className="w-[140px]" id="color-blind-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="protanopia">Protanopia (Red)</SelectItem>
                  <SelectItem value="deuteranopia">
                    Deuteranopia (Green)
                  </SelectItem>
                  <SelectItem value="tritanopia">Tritanopia (Blue)</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Reading */}
            <SectionHeader title="Reading" />

            <SettingRow
              icon={Type}
              label="Dyslexia-Friendly Font"
              description="Use OpenDyslexic font for easier reading"
              htmlFor="dyslexia-font"
            >
              <Switch
                id="dyslexia-font"
                checked={dyslexiaFont}
                onCheckedChange={setDyslexiaFont}
              />
            </SettingRow>

            <SettingRow
              icon={Type}
              label="Line Spacing"
              description="Adjust space between lines of text"
              htmlFor="line-spacing"
            >
              <Select
                value={lineSpacing}
                onValueChange={(value: "normal" | "relaxed" | "loose") =>
                  setLineSpacing(value)
                }
              >
                <SelectTrigger className="w-[110px]" id="line-spacing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="relaxed">Relaxed</SelectItem>
                  <SelectItem value="loose">Loose</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            {/* Focus & Navigation */}
            <SectionHeader title="Focus & Navigation" />

            <SettingRow
              icon={Focus}
              label="Enhanced Focus"
              description="Show larger, more visible focus indicators"
              htmlFor="enhanced-focus"
            >
              <Switch
                id="enhanced-focus"
                checked={enhancedFocus}
                onCheckedChange={setEnhancedFocus}
              />
            </SettingRow>

            <SettingRow
              icon={Keyboard}
              label="Keyboard Shortcuts"
              description="Enable keyboard shortcuts for navigation"
              htmlFor="keyboard-shortcuts"
            >
              <Switch
                id="keyboard-shortcuts"
                checked={keyboardShortcuts}
                onCheckedChange={setKeyboardShortcuts}
              />
            </SettingRow>

            {/* Reset Button */}
            <div className="mt-6 pt-4 border-t border-zinc-100">
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full text-zinc-600 hover:text-zinc-900"
              >
                <RotateCcw size={16} className="mr-2" />
                Reset to Defaults
              </Button>
            </div>

            {/* Accessibility Info */}
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg">
              <p className="text-xs text-emerald-700">
                <strong>Tip:</strong> Press{" "}
                <kbd className="px-1.5 py-0.5 bg-emerald-100 rounded text-emerald-800 font-mono">
                  Alt + A
                </kbd>{" "}
                anywhere on the site to quickly open these settings.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
);

export default AccessibilitySettingsPanel;
