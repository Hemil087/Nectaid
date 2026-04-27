'use client'

import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, MapPin, CheckCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { LocationMapPicker } from '@/components/needs/location-map-picker'
import { apiFetch } from '@/lib/api/client'
import { QK } from '@/lib/api/query-keys'
import { t } from '@/lib/utils/toast'

// ── Types ──────────────────────────────────────────────────────────────────

interface Need {
  id: string
  title: string
  need_type: string
  category?: string
  urgency: string
  description: string
  beneficiary_count: number
  required_skills: string[]
  required_team_size: number
  resources_needed?: string[]
  deadline?: string
  window_start?: string
  window_end?: string
  location_text?: string
  location_lat?: number
  location_lng?: number
  priority_score?: number
  priority_breakdown?: Record<string, number>
}

interface ReviewEditorProps {
  need: Need
  onPublished?: () => void
}

// ── Validation schema ──────────────────────────────────────────────────────

const schema = z.object({
  title: z.string().min(1, 'Required').max(80, 'Max 80 characters'),
  need_type: z.string().min(1, 'Required'),
  category: z.string().optional(),
  urgency: z.enum(['critical', 'high', 'medium', 'low']),
  description: z.string().min(10, 'Too short'),
  beneficiary_count: z.number().int().min(0),
  required_team_size: z.number().int().min(1),
  deadline: z.string().optional(),
  window_start: z.string().optional(),
  window_end: z.string().optional(),
  location_text: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ── Component ──────────────────────────────────────────────────────────────

export function ReviewEditor({ need, onPublished }: ReviewEditorProps) {
  const queryClient = useQueryClient()
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Location pin state — separate from react-hook-form since it's not a text input
  const [locationPin, setLocationPin] = useState<{ lat: number; lng: number } | null>(
    need.location_lat != null && need.location_lng != null
      ? { lat: need.location_lat, lng: need.location_lng }
      : null,
  )

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: need.title,
      need_type: need.need_type,
      category: need.category ?? '',
      urgency: need.urgency as FormValues['urgency'],
      description: need.description,
      beneficiary_count: need.beneficiary_count,
      required_team_size: need.required_team_size,
      deadline: need.deadline?.slice(0, 16) ?? '',
      window_start: need.window_start?.slice(0, 16) ?? '',
      window_end: need.window_end?.slice(0, 16) ?? '',
      location_text: need.location_text ?? '',
    },
  })

  // ── Save draft mutation ──────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      return apiFetch(`/needs/${need.id}`, {
        method: 'PATCH',
        body: JSON.stringify(values),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.need(need.id) })
      t.needSaved()
    },
    onError: () => t.generic('Failed to save changes'),
  })

  const onSave = handleSubmit((values) => {
    saveMutation.mutate({
      ...values,
      location_lat: locationPin?.lat,
      location_lng: locationPin?.lng,
    })
  })

  // ── Publish mutation ─────────────────────────────────────────────────────

  const publishMutation = useMutation({
    mutationFn: async () => {
      const values = getValues()
      await apiFetch(`/needs/${need.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...values,
          ...(locationPin ?? {}),
        }),
      })
      return apiFetch(`/needs/${need.id}/publish`, { method: 'POST' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QK.needs() })
      queryClient.invalidateQueries({ queryKey: QK.need(need.id) })
      t.needPublished()
      setConfirmOpen(false)
      onPublished?.()
    },
    onError: () => t.generic('Failed to publish'),
  })

  const handlePinChange = useCallback((coords: { lat: number; lng: number }) => {
    setLocationPin(coords)
  }, [])

  const urgencyValue = watch('urgency')

  return (
    <div className="space-y-6">
      {/* ── Title ── */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" {...register('title')} maxLength={80} />
        {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
      </div>

      {/* ── Need type + Urgency ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Need Type</Label>
          <Select
            defaultValue={need.need_type}
            onValueChange={(v) => setValue('need_type', v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['medical', 'education', 'food', 'shelter', 'wash', 'livelihood', 'other'].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Urgency</Label>
          <Select
            defaultValue={need.urgency}
            onValueChange={(v) => setValue('urgency', v as FormValues['urgency'])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="critical">🔴 Critical</SelectItem>
              <SelectItem value="high">🟠 High</SelectItem>
              <SelectItem value="medium">🟡 Medium</SelectItem>
              <SelectItem value="low">🟢 Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Description ── */}
      <div className="space-y-1.5">
        <Label htmlFor="description">Description (English)</Label>
        <Textarea id="description" rows={4} {...register('description')} />
        {errors.description && <p className="text-xs text-red-500">{errors.description.message}</p>}
      </div>

      {/* ── Beneficiaries + Team size ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="beneficiary_count">Beneficiary Count</Label>
          <Input id="beneficiary_count" type="number" min={0} {...register('beneficiary_count')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="required_team_size">Team Size Required</Label>
          <Input id="required_team_size" type="number" min={1} {...register('required_team_size')} />
        </div>
      </div>

      {/* ── Deadline ── */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="deadline">Deadline</Label>
          <Input id="deadline" type="datetime-local" {...register('deadline')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="window_start">Task Window Start</Label>
          <Input id="window_start" type="datetime-local" {...register('window_start')} />
        </div>
      </div>

      {/* ── Location ── */}
      <div className="space-y-2">
        <Label className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-zinc-500" />
          Location
        </Label>

        {/* Text label (AI-extracted, editable) */}
        <Input
          placeholder="e.g. Kathlal, Kheda, Gujarat"
          {...register('location_text')}
        />

        {/* Map pin */}
        <LocationMapPicker
          value={locationPin}
          onChange={handlePinChange}
          className="h-64 w-full"
        />

        {!locationPin && (
          <p className="text-xs text-amber-600">
            ⚠ Location not geocoded — click the map to place a pin manually before publishing.
          </p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-4">
        <Button
          variant="outline"
          onClick={onSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Draft
        </Button>

        <Button
          onClick={() => setConfirmOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <CheckCircle className="mr-2 h-4 w-4" />
          Review & Publish
        </Button>
      </div>

      {/* ── Publish confirm dialog ── */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish this need?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <p className="text-zinc-600">
              Publishing will immediately start volunteer matching. Make sure
              the details are correct.
            </p>

            {need.priority_score != null && (
              <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                <p className="font-medium text-zinc-700">
                  Priority Score: <span className="text-emerald-700">{need.priority_score.toFixed(1)}</span>
                </p>
                {need.priority_breakdown && (
                  <ul className="mt-1.5 space-y-0.5 text-xs text-zinc-500">
                    {Object.entries(need.priority_breakdown)
                      .filter(([k]) => k !== 'total')
                      .map(([k, v]) => (
                        <li key={k} className="flex justify-between">
                          <span className="capitalize">{k.replace(/_/g, ' ')}</span>
                          <span>{(v as number).toFixed(1)}</span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {!locationPin && (
              <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                ⚠ No location pin set. Geospatial volunteer matching will be skipped.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Go Back
            </Button>
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {publishMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirm Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}