'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/lib/providers/auth-provider';
import { apiFetch } from '@/lib/api/client';
import { signOut } from '@/lib/firebase/auth';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { LogOut, Trash2 } from 'lucide-react';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [language, setLanguage] = useState('en');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const langMutation = useMutation({
    mutationFn: (lang: string) =>
      apiFetch('/volunteers/me', { method: 'PATCH', body: JSON.stringify({ preferred_language: lang }) }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch('/volunteers/me', { method: 'DELETE' }),
    onSuccess: async () => {
      await signOut();
      router.replace('/login');
    },
  });

  async function handleSignOut() {
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="space-y-6 w-full max-w-2xl">
      <PageHeader title="Settings" subtitle="Language, profile, and account preferences" />

      {/* Language */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Language</CardTitle>
          <CardDescription>Choose your preferred language for the app and notifications.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Display language</Label>
            <select
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                langMutation.mutate(e.target.value);
              }}
              className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>
          {langMutation.isSuccess && <p className="text-xs text-emerald-600">Language updated.</p>}
        </CardContent>
      </Card>

      {/* Account */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground space-y-1">
            <p><span className="font-medium text-foreground">{user?.full_name}</span></p>
            <p>{user?.email}</p>
            <p className="capitalize">Role: {user?.role}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSignOut} className="mt-2">
            <LogOut className="h-4 w-4 mr-2" /> Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Danger zone — only for volunteers */}
      {user?.role === 'volunteer' && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
            <CardDescription>Permanently delete your account and all personal data (DPDP right to erasure).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-4 w-4 mr-2" /> Delete my account
              </Button>
            ) : (
              <div className="space-y-3 rounded-md border border-destructive/30 p-4">
                <p className="text-sm text-destructive font-medium">Are you sure? This cannot be undone.</p>
                <div className="flex gap-2">
                  <Button
                    variant="destructive" size="sm"
                    onClick={() => deleteMutation.mutate()}
                    disabled={deleteMutation.isPending}
                  >
                    {deleteMutation.isPending ? 'Deleting…' : 'Yes, delete my account'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                    Cancel
                  </Button>
                </div>
                {deleteMutation.isError && (
                  <p className="text-xs text-destructive">Failed to delete. Please try again.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}