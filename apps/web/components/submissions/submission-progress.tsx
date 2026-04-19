'use client';
import { CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import Link from 'next/link';

interface Props {
  submissionId: string;
  status: string;
  onSubmitAnother: () => void;
}

export function SubmissionProgress({ submissionId, status, onSubmitAnother }: Props) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <CardContent className="pt-8 pb-4">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h2 className="text-xl font-semibold">Report submitted!</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Our AI is extracting needs from your report. You&apos;ll see results shortly.
        </p>
        <div className="mt-4 rounded-md bg-muted px-4 py-2 text-left text-xs">
          <p className="text-muted-foreground">Submission ID</p>
          <p className="font-mono font-medium">{submissionId}</p>
          <p className="mt-1 text-muted-foreground">Status</p>
          <p className="font-medium capitalize">{status.replace(/_/g, ' ')}</p>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2 pb-6">
        <Link href="/submissions" className="w-full">
          <Button variant="outline" className="w-full">
            <FileText className="mr-2 h-4 w-4" />
            View my submissions
          </Button>
        </Link>
        <Button onClick={onSubmitAnother} className="w-full">
          Submit another report
        </Button>
      </CardFooter>
    </Card>
  );
}
