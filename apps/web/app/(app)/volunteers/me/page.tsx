'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pencil, X, CheckCircle2, Star } from 'lucide-react';
import type { VolunteerProfile } from '@/lib/types/api';

const SKILL_SUGGESTIONS = [
  'pediatrician', 'general-doctor', 'nurse', 'surgeon', 'physiotherapist',
  'psychiatrist', 'teacher-math', 'teacher-english', 'teacher-science',
  'carpenter', 'electrician', 'plumber', 'translator-gujarati',
  'translator-hindi', 'social-worker', 'volunteer-general',
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी' },
  { value: 'gu', label: 'ગુજરાતી' },
];

export default function MyProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: profile, isLoading, isError } = useQuery<VolunteerProfile>({
    queryKey: ['volunteer-me'],
    queryFn: () => apiFetch('/volunteers/me'),
  });

  // Edit state — initialised when user opens edit mode
  const [fullName, setFullName] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [maxTravelKm, setMaxTravelKm] = useState(20);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [emailNotif, setEmailNotif] = useState(true);
  const [inAppNotif, setInAppNotif] = useState(true);

  const skillsChanged =
    editing &&
    profile != null &&
    JSON.stringify([...(profile.skills ?? [])].sort()) !== JSON.stringify([...skills].sort());

  function openEdit() {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setSkills(profile.skills ?? []);
    setHomeAddress(profile.home_address ?? '');
    setMaxTravelKm(profile.max_travel_km);
    setPreferredLanguage(profile.preferred_language);
    setEmailNotif(profile.notification_prefs?.email ?? true);
    setInAppNotif(profile.notification_prefs?.in_app ?? true);
    setEditing(true);
  }

  function addSkill(skill: string) {
    const s = skill.trim().toLowerCase();
    if (s && !skills.includes(s)) setSkills((p) => [...p, s]);
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    setSkills((p) => p.filter((s) => s !== skill));
  }

  const mutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch('/volunteers/me', { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteer-me'] });
      setEditing(false);
    },
  });

  function handleSave() {
    mutation.mutate({
      full_name: fullName || undefined,
      skills,
      home_address: homeAddress || null,
      max_travel_km: maxTravelKm,
      preferred_language: preferredLanguage,
      notification_prefs: { email: emailNotif, in_app: inAppNotif },
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" subtitle="Manage your skills and preferences" />
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="py-6">
                <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                <div className="h-3 w-2/3 bg-muted animate-pulse rounded mt-3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="space-y-6">
        <PageHeader title="My Profile" />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Could not load your profile.</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push('/volunteers/register')}>
              Complete registration
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="My Profile"
        subtitle="Manage your skills, availability, and preferences"
        action={
          !editing ? (
            <Button variant="outline" size="sm" onClick={openEdit}>
              <Pencil className="h-4 w-4 mr-2" /> Edit profile
            </Button>
          ) : null
        }
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-semibold">{profile.total_tasks_completed}</p>
            <p className="text-xs text-muted-foreground mt-1">Tasks completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
              <p className="text-2xl font-semibold">
                {(profile.reliability_score * 5).toFixed(1)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Reliability score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1">
              {profile.verified ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground">—</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {profile.verified ? 'Verified' : 'Pending verification'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* View mode */}
      {!editing && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal details</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Full name</span>
                <span>{profile.full_name || '—'}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent>
              {profile.skills?.length ? (
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No skills added yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location & availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Home address</span>
                <span>{profile.home_address || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Max travel</span>
                <span>{profile.max_travel_km} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Language</span>
                <span>{LANGUAGES.find((l) => l.value === profile.preferred_language)?.label ?? profile.preferred_language}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{profile.notification_prefs?.email ? 'On' : 'Off'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">In-app</span>
                <span>{profile.notification_prefs?.in_app ? 'On' : 'Off'}</span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit mode */}
      {editing && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add skill</Label>
                <Input
                  placeholder="Type and press Enter"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      addSkill(skillInput);
                    }
                  }}
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
                      <button type="button" onClick={() => removeSkill(s)} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {skillsChanged && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Your matching profile will be updated when you save.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Location & availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Home address</Label>
                <Input
                  placeholder="Village, District, State"
                  value={homeAddress}
                  onChange={(e) => setHomeAddress(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Max travel: <span className="font-semibold">{maxTravelKm} km</span></Label>
                <input
                  type="range" min={1} max={200}
                  value={maxTravelKm}
                  onChange={(e) => setMaxTravelKm(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred language</Label>
                <select
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={emailNotif} onChange={(e) => setEmailNotif(e.target.checked)} className="h-4 w-4 accent-primary" />
                <span className="text-sm">Email notifications</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={inAppNotif} onChange={(e) => setInAppNotif(e.target.checked)} className="h-4 w-4 accent-primary" />
                <span className="text-sm">In-app notifications</span>
              </label>
            </CardContent>
          </Card>

          {mutation.isError && (
            <p className="text-sm text-destructive">Failed to save. Please try again.</p>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSave} disabled={mutation.isPending} className="flex-1">
              {mutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}