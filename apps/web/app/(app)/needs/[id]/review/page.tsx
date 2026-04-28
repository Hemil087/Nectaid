'use client';
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, X, Send } from 'lucide-react';
import { LocationMapPicker } from '@/components/needs/location-map-picker';
import type { Need } from '@/lib/types/api';
import type { Urgency } from '@/lib/types/enums';

const SKILL_SUGGESTIONS = [
  'pediatrician', 'general-doctor', 'nurse', 'surgeon', 'physiotherapist',
  'psychiatrist', 'teacher-math', 'teacher-english', 'teacher-science',
  'carpenter', 'electrician', 'plumber', 'translator-gujarati',
  'translator-hindi', 'social-worker', 'volunteer-general',
];

const URGENCY_OPTIONS: Urgency[] = ['critical', 'high', 'medium', 'low'];
const NEED_TYPES = ['medical', 'education', 'food', 'shelter', 'wash', 'livelihood', 'other'];

export default function NeedReviewPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: need, isLoading } = useQuery<Need>({
    queryKey: ['need', id],
    queryFn: () => apiFetch(`/needs/${id}`),
  });

  const initial = useMemo(() => ({
    title: need?.title ?? '',
    needType: need?.need_type ?? 'medical',
    urgency: (need?.urgency ?? 'medium') as Urgency,
    description: need?.description ?? '',
    beneficiaryCount: need?.beneficiary_count ?? 1,
    requiredTeamSize: need?.required_team_size ?? 1,
    requiredSkills: need?.required_skills ?? [],
    deadline: need?.deadline ? need.deadline.slice(0, 16) : '',
    windowStart: need?.window_start ? need.window_start.slice(0, 16) : '',
    windowEnd: need?.window_end ? need.window_end.slice(0, 16) : '',
    locationText: need?.location_text ?? '',
    locationPin:
      need?.location_lat != null && need?.location_lng != null
        ? { lat: need.location_lat, lng: need.location_lng }
        : null,
  }), [need]);

  const [title, setTitle] = useState('');
  const [needType, setNeedType] = useState('medical');
  const [urgency, setUrgency] = useState<Urgency>('medium');
  const [description, setDescription] = useState('');
  const [beneficiaryCount, setBeneficiaryCount] = useState(1);
  const [requiredTeamSize, setRequiredTeamSize] = useState(1);
  const [requiredSkills, setRequiredSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [deadline, setDeadline] = useState('');
  const [windowStart, setWindowStart] = useState('');
  const [windowEnd, setWindowEnd] = useState('');
  const [locationText, setLocationText] = useState('');
  const [locationPin, setLocationPin] = useState<{ lat: number; lng: number } | null>(null);
  const [synced, setSynced] = useState(false);

  if (need && !synced) {
    setTitle(initial.title);
    setNeedType(initial.needType);
    setUrgency(initial.urgency);
    setDescription(initial.description);
    setBeneficiaryCount(initial.beneficiaryCount);
    setRequiredTeamSize(initial.requiredTeamSize);
    setRequiredSkills(initial.requiredSkills);
    setDeadline(initial.deadline);
    setWindowStart(initial.windowStart);
    setWindowEnd(initial.windowEnd);
    setLocationText(initial.locationText);
    setLocationPin(initial.locationPin);
    setSynced(true);
  }

  function addSkill(skill: string) {
    const s = skill.trim().toLowerCase();
    if (s && !requiredSkills.includes(s)) setRequiredSkills((p) => [...p, s]);
    setSkillInput('');
  }

  function buildBody() {
    return {
      title, need_type: needType, urgency, description,
      beneficiary_count: beneficiaryCount,
      required_team_size: requiredTeamSize,
      required_skills: requiredSkills,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      window_start: windowStart ? new Date(windowStart).toISOString() : null,
      window_end: windowEnd ? new Date(windowEnd).toISOString() : null,
      location_text: locationText,
      location_lat: locationPin?.lat ?? null,
      location_lng: locationPin?.lng ?? null,
    };
  }

  const saveMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch(`/needs/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['need', id] }),
  });

  const publishMutation = useMutation({
    mutationFn: async (body: object) => {
      await apiFetch(`/needs/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
      return apiFetch(`/needs/${id}/publish`, { method: 'POST' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['need', id] });
      queryClient.invalidateQueries({ queryKey: ['needs'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      router.push(`/needs/${id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <Card><CardContent className="py-8">
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-4 bg-muted animate-pulse rounded" />)}
          </div>
        </CardContent></Card>
      </div>
    );
  }

  if (!need) return <p className="text-sm text-muted-foreground p-6">Need not found.</p>;

  if (need.status !== 'pending_review') {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/needs/${id}`}><ArrowLeft className="h-4 w-4 mr-2" /> Back to need</Link>
        </Button>
        <p className="text-sm text-muted-foreground">
          This need is <strong>{need.status}</strong> and can no longer be edited.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/needs/${id}`}><ArrowLeft className="h-4 w-4 mr-2" /> Back</Link>
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => saveMutation.mutate(buildBody())} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          <Button size="sm" onClick={() => publishMutation.mutate(buildBody())} disabled={publishMutation.isPending}>
            <Send className="h-4 w-4 mr-2" />
            {publishMutation.isPending ? 'Publishing…' : 'Save & publish'}
          </Button>
        </div>
      </div>

      <PageHeader title="Review & edit need" subtitle="Verify AI-extracted fields before publishing to volunteers." />

      {need.description_original && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">
              Original submission ({need.original_language ?? 'unknown language'})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{need.description_original}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extracted fields</CardTitle>
          <CardDescription>Edit any fields the AI got wrong.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Need type</Label>
              <select value={needType} onChange={(e) => setNeedType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {NEED_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Urgency</Label>
              <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {URGENCY_OPTIONS.map((u) => <option key={u} value={u} className="capitalize">{u}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (English)</Label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="beneficiaryCount">Beneficiary count</Label>
              <Input id="beneficiaryCount" type="number" min={0} value={beneficiaryCount} onChange={(e) => setBeneficiaryCount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teamSize">Team size needed</Label>
              <Input id="teamSize" type="number" min={1} value={requiredTeamSize} onChange={(e) => setRequiredTeamSize(Number(e.target.value))} />
            </div>
          </div>
          <div className="space-y-3">
            <Label>Required skills</Label>
            <Input placeholder="Type skill and press Enter" value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSkill(skillInput); } }} />
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.filter((s) => !requiredSkills.includes(s)).map((s) => (
                <button key={s} type="button" onClick={() => addSkill(s)}
                  className="text-xs px-2 py-1 rounded-full border border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                  + {s}
                </button>
              ))}
            </div>
            {requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {requiredSkills.map((s) => (
                  <Badge key={s} variant="secondary" className="gap-1 pr-1">
                    {s}
                    <button type="button" onClick={() => setRequiredSkills((p) => p.filter((x) => x !== s))}>
                      <X className="h-3 w-3 hover:text-destructive" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <Label>Timing</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Deadline</p>
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Window start</p>
                <Input type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Window end</p>
                <Input type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ── Location ── */}
          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              placeholder="e.g. Harni village, Vadodara, Gujarat"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
            />
            <LocationMapPicker
              value={locationPin}
              onChange={setLocationPin}
              className="h-64 w-full"
            />
            {!locationPin && (
              <p className="text-xs text-amber-600">
                ⚠ No location pin — click the map to place one before publishing.
              </p>
            )}
          </div>

        </CardContent>
      </Card>

      {(saveMutation.isError || publishMutation.isError) && (
        <p className="text-sm text-destructive">Failed to save. Please try again.</p>
      )}
      {saveMutation.isSuccess && !publishMutation.isPending && (
        <p className="text-sm text-emerald-600">Draft saved.</p>
      )}
    </div>
  );
}