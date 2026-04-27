/**
 * components/assignments/completion-form.tsx
 *
 * Shown when assignment.status === 'in_progress'.
 * Collects completion notes + up to 3 photos, then fires
 * POST /assignments/{id}/status  with status='completed'.
 */
'use client';

import { useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhotoUploadButton } from './photo-upload-button';
import { useUpdateAssignmentStatus } from '@/lib/api/assignments';

const schema = z.object({
  notes: z.string().min(10, 'Please describe what was accomplished (min 10 chars).'),
});

type FormValues = z.infer<typeof schema>;

interface CompletionFormProps {
  assignmentId: string;
}

export function CompletionForm({ assignmentId }: CompletionFormProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const { mutate, isPending } = useUpdateAssignmentStatus();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  function onSubmit(values: FormValues) {
    mutate({
      id: assignmentId,
      status: 'completed',
      notes: values.notes,
      photo_urls: photoUrls,
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="completion-notes">
          Completion notes <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="completion-notes"
          placeholder="Describe what was accomplished, any issues encountered, and next steps if applicable…"
          rows={4}
          {...register('notes')}
          aria-invalid={!!errors.notes}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      {/* Photo upload */}
      <div className="space-y-2">
        <Label>Completion photos (optional, up to 3)</Label>
        <PhotoUploadButton onUploaded={setPhotoUrls} />
      </div>

      {/* Submit */}
      <Button type="submit" disabled={isPending} className="gap-2 w-full">
        {isPending ? (
          <>Submitting…</>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Mark as completed
          </>
        )}
      </Button>
    </form>
  );
}