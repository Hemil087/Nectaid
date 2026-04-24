'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api/client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Bell, CheckCheck } from 'lucide-react';
import type { Notification } from '@/lib/types/api';
import { formatDistanceToNow } from 'date-fns';

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: Notification[] }>({
    queryKey: ['notifications'],
    queryFn: () => apiFetch('/notifications'),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-2xl">
      <PageHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="py-4">
              <div className="h-4 w-2/3 bg-muted animate-pulse rounded mb-2" />
              <div className="h-3 w-full bg-muted animate-pulse rounded" />
            </CardContent></Card>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          title="No notifications yet"
          description="You'll see assignment updates and system messages here."
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card
              key={n.id}
              className={`transition-colors ${!n.read ? 'border-primary/30 bg-primary/5' : ''}`}
            >
              <CardContent className="py-4 flex items-start gap-3">
                <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${!n.read ? 'bg-primary/10' : 'bg-muted'}`}>
                  <Bell className={`h-3.5 w-3.5 ${!n.read ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  {n.subject && <p className="text-sm font-medium">{n.subject}</p>}
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
                {!n.read && (
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => readMutation.mutate(n.id)}
                    disabled={readMutation.isPending}
                    className="shrink-0"
                  >
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}