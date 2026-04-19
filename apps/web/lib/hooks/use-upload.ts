'use client';
import { useState, useCallback } from 'react';
import { getSignedUrl, uploadToGcs } from '@/lib/api/uploads';

export type UploadProgress = Record<string, number>;

export function useUpload() {
  const [progress, setProgress] = useState<UploadProgress>({});
  const [isUploading, setIsUploading] = useState(false);

  const uploadFiles = useCallback(async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];
    setIsUploading(true);
    const urls: string[] = [];

    try {
      for (const file of files) {
        setProgress((p) => ({ ...p, [file.name]: 10 }));
        const { upload_url, public_url } = await getSignedUrl(file.name);
        setProgress((p) => ({ ...p, [file.name]: 50 }));
        await uploadToGcs(upload_url, file);
        setProgress((p) => ({ ...p, [file.name]: 100 }));
        urls.push(public_url);
      }
    } finally {
      setIsUploading(false);
    }

    return urls;
  }, []);

  const reset = useCallback(() => setProgress({}), []);

  return { uploadFiles, progress, isUploading, reset };
}
