'use client';
import { useCallback, useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils/cn';
import type { UploadProgress } from '@/lib/hooks/use-upload';

const MAX_IMAGES = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic';

interface Props {
  files: File[];
  progress: UploadProgress;
  isUploading: boolean;
  onChange: (files: File[]) => void;
}

export function ImageUploadGrid({ files, progress, isUploading, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;
      const valid = Array.from(incoming)
        .filter((f) => f.type.startsWith('image/'))
        .slice(0, MAX_IMAGES - files.length);
      if (valid.length) onChange([...files, ...valid]);
    },
    [files, onChange],
  );

  const remove = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50',
          files.length >= MAX_IMAGES && 'pointer-events-none opacity-50',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <ImagePlus className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          {files.length >= MAX_IMAGES ? 'Maximum 5 photos reached' : 'Drop photos here or click to browse'}
        </p>
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · up to {MAX_IMAGES} photos</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {files.map((file, idx) => {
            const pct = progress[file.name] ?? 0;
            const uploading = isUploading && pct < 100;
            return (
              <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
                {uploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                    <Loader2 className="mb-1 h-4 w-4 animate-spin text-white" />
                    <Progress value={pct} className="h-1 w-3/4" />
                  </div>
                )}
                {!isUploading && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-0.5 text-white group-hover:flex"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
