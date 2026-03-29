"use client";

import { useState } from "react";
import { Bot, Globe, Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Merchant } from "@/types/supabase";

interface AiConfigProps {
  merchant: Merchant;
  onSave: (updated: Partial<Merchant>) => void;
}

const TONE_OPTIONS: { value: string; label: string; desc: string }[] = [
  { value: "friendly", label: "Amical", desc: "Ton chaleureux et décontracté" },
  { value: "formal", label: "Formel", desc: "Ton professionnel et courtois" },
  { value: "casual", label: "Casual", desc: "Ton léger et spontané" },
];

const LANGUAGE_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "pt", label: "Português", flag: "🇵🇹" },
];

const DELAY_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Désactivé" },
  { value: 60, label: "1 heure" },
  { value: 120, label: "2 heures" },
  { value: 360, label: "6 heures" },
  { value: 1440, label: "24 heures" },
  { value: 2880, label: "48 heures" },
];

const CHANNEL_LIST = [
  { id: "whatsapp", label: "WhatsApp", color: "text-green-600" },
  { id: "sms", label: "SMS", color: "text-gray-600" },
  { id: "messenger", label: "Messenger", color: "text-blue-600" },
  { id: "telegram", label: "Telegram", color: "text-sky-600" },
] as const;

const AiConfig = ({ merchant, onSave }: AiConfigProps) => {
  const [aiName, setAiName] = useState(merchant.ai_name ?? "");
  const [aiTone, setAiTone] = useState(merchant.ai_tone ?? "friendly");
  const [aiLanguages, setAiLanguages] = useState<string[]>(merchant.ai_languages ?? ["fr"]);
  const [cancellationDelay, setCancellationDelay] = useState(merchant.cancellation_delay_minutes ?? 0);
  const [saving, setSaving] = useState(false);

  const toggleLanguage = (code: string) => {
    setAiLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ai_name: aiName || null,
        ai_tone: aiTone || null,
        ai_languages: aiLanguages,
        cancellation_delay_minutes: cancellationDelay || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Personnalité IA */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-indigo-600" />
            Personnalité de l&apos;IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Nom */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de l&apos;IA
            </label>
            <Input
              value={aiName}
              onChange={(e) => setAiName(e.target.value)}
              placeholder="Ex : Sofia, Alex..."
              className="max-w-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Le nom utilisé par l&apos;IA pour se présenter aux clients
            </p>
          </div>

          {/* Ton */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ton</label>
            <div className="grid grid-cols-3 gap-3 max-w-lg">
              {TONE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAiTone(opt.value)}
                  className={`rounded-lg border p-3 text-left transition-all ${
                    aiTone === opt.value
                      ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Langues */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-5 w-5 text-indigo-600" />
            Langues
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            L&apos;IA répondra aux clients dans les langues sélectionnées.
          </p>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map((lang) => {
              const active = aiLanguages.includes(lang.code);
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => toggleLanguage(lang.code)}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium border transition-all ${
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Canaux */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activation par canal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {CHANNEL_LIST.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium text-sm ${ch.color}`}>{ch.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full">
                    Configuration via intégration
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">
            L&apos;activation par canal se configure dans les paramètres de chaque intégration (WhatsApp Business, Telnyx, etc.).
          </p>
        </CardContent>
      </Card>

      {/* Délai annulation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-5 w-5 text-indigo-600" />
            Délai d&apos;annulation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-3">
            Délai minimum avant le RDV pendant lequel le client peut annuler via l&apos;IA.
          </p>
          <select
            value={cancellationDelay}
            onChange={(e) => setCancellationDelay(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-w-xs"
          >
            {DELAY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Sauvegarder */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Enregistrement..." : "Sauvegarder"}
        </Button>
      </div>
    </div>
  );
};

export default AiConfig;
