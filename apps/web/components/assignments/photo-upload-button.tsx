/**
 * components/assignments/photo-upload-button.tsx
 *
 * Lets a volunteer upload up to 3 completion-proof photos.
 * Flow:
 *   1. Pick file → POST /uploads/signed-url (purpose=completion)
 *   2. PUT bytes directly to the returned signed GCS URL
 *   3. Push the `public_url` into the parent's `onUploaded` callback
 *
 * The parent (CompletionForm) collects the URLs and sends them in
 * POST /assignments/{id}/status  as `photo_urls[]`.
 */
'use client';

import { useRef, useState } from 'react';

import { Camera, Loader2, Trash2, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { apiFetch } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';

const MAX_PHOTOS = 3;
const MAX_FILE_SIZE_MB = 5;

interface SignedUrlResponse {
  upload_url: string;
  object_key: string;
  public_url: string;
  expires_at: string;
}

interface UploadedPhoto {
  objectKey: string;
  publicUrl: string;
  previewUrl: string; // local blob URL for display
  name: string;
}

interface PhotoUploadButtonProps {
  /** Called with the array of public URLs whenever photos change */
  onUploaded: (urls: string[]) => void;
  className?: string;
}

export function PhotoUploadButton({
  onUploaded,
  className,
}: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canAdd = photos.length < MAX_PHOTOS && !uploading;

  async function handleFiles(files: FileList) {
    const remaining = MAX_PHOTOS - photos.length;
    const toUpload = Array.from(files).slice(0, remaining);
    if (toUpload.length === 0) return;

    setError(null);
    setUploading(true);
    setProgress(0);

    const newPhotos: UploadedPhoto[] = [];

    for (let i = 0; i < toUpload.length; i++) {
      const file = toUpload[i];

      // Validate
      if (!file.type.startsWith('image/')) {
        setError('Only image files are accepted.');
        setUploading(false);
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setError(`Each photo must be under ${MAX_FILE_SIZE_MB} MB.`);
        setUploading(false);
        return;
      }

      try {
        // Step 1: Get signed URL
        const signed = await apiFetch<SignedUrlResponse>('/uploads/signed-url', {
          method: 'POST',
          body: JSON.stringify({
            content_type: file.type,
            filename: file.name,
            purpose: 'completion',
          }),
        });

        // Step 2: Upload directly to GCS
        await fetch(signed.upload_url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });

        newPhotos.push({
          objectKey: signed.object_key,
          publicUrl: signed.public_url,
          previewUrl: URL.createObjectURL(file),
          name: file.name,
        });

        setProgress(Math.round(((i + 1) / toUpload.length) * 100));
      } catch {
        setError('Upload failed — please try again.');
        setUploading(false);
        return;
      }
    }

    const updated = [...photos, ...newPhotos];
    setPhotos(updated);
    onUploaded(updated.map((p) => p.publicUrl));
    setUploading(false);
    setProgress(0);
  }

  function remove(objectKey: string) {
    const updated = photos.filter((p) => p.objectKey !== objectKey);
    setPhotos(updated);
    onUploaded(updated.map((p) => p.publicUrl));
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Preview grid */}
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((photo) => (
            <div
              key={photo.objectKey}
              className="group relative h-24 w-24 overflow-hidden rounded-lg border bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.previewUrl}
                alt={photo.name}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo.objectKey)}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Remove ${photo.name}`}
              >
                <Trash2 className="h-5 w-5 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Uploading…
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      {/* Add button */}
      {canAdd && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFiles(e.target.files);
                e.target.value = ''; // reset so same file can be re-selected
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => inputRef.current?.click()}
          >
            <Camera className="h-4 w-4" />
            {photos.length === 0 ? 'Add completion photo' : 'Add another photo'}
            <span className="text-xs text-muted-foreground">
              ({photos.length}/{MAX_PHOTOS})
            </span>
          </Button>
        </>
      )}

      {!canAdd && !uploading && photos.length >= MAX_PHOTOS && (
        <p className="text-xs text-muted-foreground">
          Maximum {MAX_PHOTOS} photos reached.
        </p>
      )}
    </div>
  );
}