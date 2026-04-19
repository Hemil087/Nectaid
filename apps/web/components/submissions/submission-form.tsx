'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ImageUploadGrid } from './image-upload-grid';
import { SubmissionProgress } from './submission-progress';
import { submissionsApi } from '@/lib/api/submissions';
import { useUpload } from '@/lib/hooks/use-upload';

const schema = z.object({
  raw_text: z
    .string()
    .min(20, 'Please describe the need in at least 20 characters')
    .max(5000, 'Description must be under 5000 characters'),
});

type FormValues = z.infer<typeof schema>;

export function SubmissionForm() {
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [result, setResult] = useState<{ id: string; status: string } | null>(null);

  const { uploadFiles, progress, isUploading, reset: resetUpload } = useUpload();

  const {
    register,
    handleSubmit,
    reset: resetForm,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const image_urls = await uploadFiles(imageFiles);
      return submissionsApi.create({ raw_text: values.raw_text, image_urls });
    },
    onSuccess: (data) => setResult(data),
  });

  const handleSubmitAnother = () => {
    setResult(null);
    setImageFiles([]);
    resetForm();
    resetUpload();
    mutation.reset();
  };

  if (result) {
    return (
      <SubmissionProgress
        submissionId={result.id}
        status={result.status}
        onSubmitAnother={handleSubmitAnother}
      />
    );
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Report a Need</CardTitle>
        <CardDescription>
          Describe the situation in your own words and attach photos. Our AI will extract
          structured needs automatically.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="raw_text">Description</Label>
            <Textarea
              id="raw_text"
              {...register('raw_text')}
              placeholder="e.g. There are 40 flood-affected families in ward 7 who need clean water and food packets urgently..."
              rows={6}
              disabled={mutation.isPending}
            />
            {errors.raw_text && (
              <p className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                {errors.raw_text.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Photos (optional, up to 5)</Label>
            <ImageUploadGrid
              files={imageFiles}
              progress={progress}
              isUploading={isUploading}
              onChange={setImageFiles}
            />
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Something went wrong. Please try again.'}
            </div>
          )}

          <Button type="submit" disabled={mutation.isPending} className="w-full sm:w-auto">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isUploading ? 'Uploading photos…' : mutation.isPending ? 'Submitting…' : 'Submit Report'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
