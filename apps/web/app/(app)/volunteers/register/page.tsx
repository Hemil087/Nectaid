'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/providers/auth-provider';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { LocationMapPicker } from '@/components/needs/location-map-picker';

const SKILL_SUGGESTIONS = [
  'pediatrician', 'general-doctor', 'nurse', 'surgeon', 'physiotherapist',
  'psychiatrist', 'teacher-math', 'teacher-english', 'teacher-science',
  'carpenter', 'electrician', 'plumber', 'translator-gujarati',
  'translator-hindi', 'social-worker', 'volunteer-general',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
];

export default function VolunteerRegisterPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [phone, setPhone] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [locationPin, setLocationPin] = useState<{ lat: number; lng: number } | null>(null);
  const [maxTravelKm, setMaxTravelKm] = useState(20);
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function addSkill(skill: string) {
    const normalized = skill.trim().toLowerCase();
    if (normalized && !skills.includes(normalized)) {
      setSkills((prev) => [...prev, normalized]);
    }
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    setSkills((prev) => prev.filter((s) => s !== skill));
  }

  function handleSkillKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (skills.length === 0) {
      setError('Please add at least one skill.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/volunteers', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          phone: phone || null,
          preferred_language: preferredLanguage,
          skills,
          home_address: homeAddress || null,
          home_location: locationPin
            ? { lat: locationPin.lat, lng: locationPin.lng }
            : null,
          max_travel_km: maxTravelKm,
          notification_prefs: { email: emailNotif, in_app: inAppNotif },
        }),
      });
      router.replace('/dashboard');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      setError(msg || 'Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Complete your profile"
        subtitle="This helps us match you to the right opportunities."
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Basic information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone number <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="language">Preferred language</Label>
              <select
                id="language"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Skills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Skills</CardTitle>
            <CardDescription>Type a skill and press Enter, or click a suggestion below.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="skillInput">Add skill</Label>
              <Input
                id="skillInput"
                placeholder="e.g. pediatrician, nurse, teacher-math"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleSkillKeyDown}
                onBlur={() => { if (skillInput) addSkill(skillInput); }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.filter((s) => !skills.includes(s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s)}
                  className="text-xs px-2 py-1 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
            {skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSkill(s)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Location & availability</CardTitle>
            <CardDescription>
              Set your home location so we can match you with nearby needs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="homeAddress">
                Home address <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="homeAddress"
                placeholder="Village, District, State"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
              />
            </div>

            {/* Map pin picker */}
            <div className="space-y-1.5">
              <Label>Pin your location on the map</Label>
              <LocationMapPicker
                value={locationPin}
                onChange={setLocationPin}
                className="h-64 w-full"
              />
              {!locationPin && (
                <p className="text-xs text-amber-600">
                  Click the map to set your location — improves how well we match you to nearby needs.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTravel">
                Max travel distance: <span className="font-semibold">{maxTravelKm} km</span>
              </Label>
              <input
                id="maxTravel"
                type="range"
                min={1}
                max={200}
                value={maxTravelKm}
                onChange={(e) => setMaxTravelKm(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 km</span>
                <span>200 km</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notification preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={emailNotif}
                onChange={(e) => setEmailNotif(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm">Email notifications for new assignments</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inAppNotif}
                onChange={(e) => setInAppNotif(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              <span className="text-sm">In-app notifications</span>
            </label>
          </CardContent>
        </Card>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Saving profile…' : 'Save profile & continue'}
        </Button>
      </form>
    </div>
  );
}