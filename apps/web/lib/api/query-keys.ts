export const QK = {
  needs:         (filters?: object) => ['needs', filters] as const,
  need:          (id: string)       => ['needs', id] as const,
  needExplain:   (id: string)       => ['needs', id, 'explain'] as const,
  assignments:   ()                 => ['assignments'] as const,
  assignment:    (id: string)       => ['assignments', id] as const,
  myAssignments: ()                 => ['assignments', 'me'] as const,
  dashboard:     ()                 => ['analytics', 'dashboard'] as const,
  reports:       (week?: string)    => ['reports', week] as const,
  notifications: ()                 => ['notifications'] as const,
  volunteer:     (id: string)       => ['volunteers', id] as const,
  volunteers:    (filters?: object) => ['volunteers', filters] as const,
};
