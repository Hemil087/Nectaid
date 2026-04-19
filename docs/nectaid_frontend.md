# Nectaid — Frontend Development Guide

> **Solo developer reference.** Everything you need to build the frontend from scratch in 11 days — file structure, all pages, every component, design system, data-fetching patterns, and day-by-day tasks.

---

## Table of Contents

1. [Design System](#1-design-system)
2. [Project File Structure](#2-project-file-structure)
3. [Pages & Routes Reference](#3-pages--routes-reference)
4. [Component Tree (All Components)](#4-component-tree-all-components)
5. [Data Fetching & State Patterns](#5-data-fetching--state-patterns)
6. [Realtime (Firestore) Patterns](#6-realtime-firestore-patterns)
7. [i18n Setup](#7-i18n-setup)
8. [Auth & Role Guards](#8-auth--role-guards)
9. [Forms Reference](#9-forms-reference)
10. [Day-by-Day Frontend Build Order](#10-day-by-day-frontend-build-order)

---

## 1. Design System

### 1.1 Palette (shadcn/ui neutral + social-impact accent)

Use CSS variables in `app/globals.css`. These override shadcn defaults.

```css
/* app/globals.css */
@layer base {
  :root {
    /* shadcn/ui base — neutral zinc */
    --background:        0 0% 100%;
    --foreground:        240 10% 3.9%;
    --card:              0 0% 100%;
    --card-foreground:   240 10% 3.9%;
    --popover:           0 0% 100%;
    --popover-foreground:240 10% 3.9%;
    --muted:             240 4.8% 95.9%;
    --muted-foreground:  240 3.8% 46.1%;
    --border:            240 5.9% 90%;
    --input:             240 5.9% 90%;
    --ring:              240 10% 3.9%;

    /* Brand accent — teal/emerald (social impact, trustworthy) */
    --primary:           160 84% 39%;   /* emerald-600 */
    --primary-foreground:0 0% 98%;

    --secondary:         240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;

    --accent:            160 84% 39%;
    --accent-foreground: 0 0% 98%;

    /* Urgency semantic colors */
    --urgency-critical:  0 84% 60%;     /* red-500 */
    --urgency-high:      25 95% 53%;    /* orange-500 */
    --urgency-medium:    45 93% 47%;    /* yellow-500 */
    --urgency-low:       142 71% 45%;   /* green-500 */

    /* Status semantic colors */
    --status-pending:    45 93% 47%;
    --status-active:     217 91% 60%;   /* blue-500 */
    --status-complete:   142 71% 45%;

    --destructive:       0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --radius:            0.5rem;
  }

  .dark {
    --background:        240 10% 3.9%;
    --foreground:        0 0% 98%;
    --card:              240 10% 3.9%;
    --card-foreground:   0 0% 98%;
    --muted:             240 3.7% 15.9%;
    --muted-foreground:  240 5% 64.9%;
    --border:            240 3.7% 15.9%;
    --input:             240 3.7% 15.9%;
    --primary:           160 84% 39%;
    --primary-foreground:0 0% 98%;
  }
}
```

### 1.2 Typography

```css
/* tailwind.config.ts */
fontFamily: {
  sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
  mono: ['var(--font-geist-mono)', 'monospace'],
}
```

In `app/layout.tsx`:
```tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
```

**Type scale (use Tailwind classes directly):**

| Role | Class | Usage |
|------|-------|-------|
| Page title | `text-2xl font-semibold tracking-tight` | H1 on every page |
| Section heading | `text-lg font-semibold` | Card titles, section labels |
| Body | `text-sm text-foreground` | Default content |
| Muted label | `text-xs text-muted-foreground` | Timestamps, captions |
| Stat number | `text-3xl font-bold tabular-nums` | Dashboard cards |
| Badge text | `text-xs font-medium` | Status badges |

### 1.3 Spacing & Layout Constants

```
Sidebar width:      240px (w-60)
Content max-width:  1280px (max-w-7xl)
Page padding:       px-6 py-6
Card padding:       p-6
Section gap:        space-y-6
Form field gap:     space-y-4
Table row height:   h-12 (min)
```

### 1.4 Urgency & Status Badges

<<<<<<< HEAD
Create `components/ui/urgency-badge.tsx` and `components/ui/status-badge.tsx` — used everywhere. Map values to Tailwind classes:
=======
Create `components/shared/urgency-badge.tsx` and `components/shared/status-badge.tsx` — used everywhere. Map values to Tailwind classes:
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

**UrgencyBadge:**
```
critical → bg-red-100    text-red-700   border-red-200
high     → bg-orange-100 text-orange-700 border-orange-200
medium   → bg-yellow-100 text-yellow-700 border-yellow-200
low      → bg-green-100  text-green-700  border-green-200
```

**StatusBadge (needs):**
```
pending_review    → bg-yellow-100 text-yellow-700
published         → bg-blue-100  text-blue-700
matching_complete → bg-purple-100 text-purple-700
assigned          → bg-indigo-100 text-indigo-700
in_progress       → bg-cyan-100  text-cyan-700
completed         → bg-green-100 text-green-700
cancelled         → bg-gray-100  text-gray-500
expired           → bg-gray-100  text-gray-400
```

**StatusBadge (assignments):**
```
pending_accept → bg-yellow-100 text-yellow-700
accepted       → bg-blue-100  text-blue-700
in_progress    → bg-cyan-100  text-cyan-700
completed      → bg-green-100 text-green-700
declined       → bg-red-100   text-red-700
expired        → bg-gray-100  text-gray-400
no_show        → bg-red-100   text-red-700
```

### 1.5 Icons

Use `lucide-react` exclusively (already in package.json). Key icon map:

```
needs / tasks      → ClipboardList
medical            → Stethoscope
education          → BookOpen
food               → Utensils
shelter            → Home
wash               → Droplets
livelihood         → Briefcase
volunteer          → Users
location           → MapPin
urgency critical   → AlertCircle (red)
urgency high       → AlertTriangle (orange)
clock / deadline   → Clock
score / priority   → TrendingUp
assignment accept  → CheckCircle2
assignment decline → XCircle
in progress        → Play
completed          → CheckSquare
notification       → Bell
settings           → Settings
logout             → LogOut
menu               → Menu
back               → ChevronLeft
external link      → ExternalLink
upload             → Upload
photo              → Camera
report / pdf       → FileText
language           → Globe
```

---

## 2. Project File Structure

```
apps/web/
├── app/                                   # Next.js App Router
│   ├── globals.css
│   ├── layout.tsx                         # Root layout: fonts, providers
│   ├── page.tsx                           # / → redirect to /dashboard or /login
│   │
│   ├── (auth)/                            # Auth group — no sidebar
│   │   ├── layout.tsx                     # Centered card layout
│   │   └── login/
│   │       └── page.tsx
│   │
<<<<<<< HEAD
│   ├── (app)/                             # App group — has sidebar + topbar
│   │   ├── layout.tsx                     # AppShell: Sidebar + TopBar + <main>
│   │   │
│   │   ├── dashboard/
│   │   │   └── page.tsx                   # Coordinator dashboard (default landing)
│   │   │
│   │   ├── submissions/
│   │   │   └── new/
│   │   │       └── page.tsx               # New submission form
│   │   │
│   │   ├── needs/
│   │   │   ├── page.tsx                   # Needs list (all statuses, filterable)
│   │   │   └── [id]/
│   │   │       ├── page.tsx               # Need detail view
│   │   │       └── review/
│   │   │           └── page.tsx           # Coordinator review + edit + publish
│   │   │
│   │   ├── assignments/
│   │   │   ├── page.tsx                   # Volunteer: my assignments list
│   │   │   └── [id]/
│   │   │       └── page.tsx               # Volunteer: assignment detail
│   │   │
│   │   ├── volunteers/
│   │   │   ├── register/
│   │   │   │   └── page.tsx               # Volunteer onboarding (multi-step)
│   │   │   └── me/
│   │   │       └── page.tsx               # Volunteer profile / edit
│   │   │
│   │   ├── reports/
│   │   │   └── page.tsx                   # Weekly reports list + PDF download
│   │   │
│   │   ├── notifications/
│   │   │   └── page.tsx                   # In-app inbox
│   │   │
│   │   ├── settings/
│   │   │   └── page.tsx                   # User settings (language, profile, prefs)
│   │   │
│   │   └── admin/
│   │       ├── layout.tsx                 # Admin-only guard
│   │       └── volunteers/
│   │           ├── page.tsx               # Volunteer management list
│   │           └── [id]/
│   │               └── page.tsx           # Volunteer detail + verify
│   │
│   └── api/                               # Next.js API routes (minimal — mostly proxied to FastAPI)
│       └── auth/
│           └── callback/
│               └── route.ts              # Firebase auth callback if using SSR session
=======
│   └── (app)/                             # App group — has sidebar + topbar
│       ├── layout.tsx                     # AppShell: Sidebar + TopBar + <main>
│       │
│       ├── dashboard/
│       │   └── page.tsx                   # Coordinator dashboard (default landing)
│       │
│       ├── submissions/
│       │   └── new/
│       │       └── page.tsx               # New submission form
│       │
│       ├── needs/
│       │   ├── page.tsx                   # Needs list (all statuses, filterable)
│       │   └── [id]/
│       │       ├── page.tsx               # Need detail view
│       │       └── review/
│       │           └── page.tsx           # Coordinator review + edit + publish
│       │
│       ├── assignments/
│       │   ├── page.tsx                   # Volunteer: my assignments list
│       │   └── [id]/
│       │       └── page.tsx               # Volunteer: assignment detail
│       │
│       ├── volunteers/
│       │   ├── register/
│       │   │   └── page.tsx               # Volunteer onboarding (multi-step)
│       │   └── me/
│       │       └── page.tsx               # Volunteer profile / edit
│       │
│       ├── reports/
│       │   └── page.tsx                   # Weekly reports list + PDF download
│       │
│       ├── notifications/
│       │   └── page.tsx                   # In-app inbox
│       │
│       ├── settings/
│       │   └── page.tsx                   # User settings (language, profile, prefs)
│       │
│       └── admin/
│           ├── layout.tsx                 # Admin-only guard
│           └── volunteers/
│               ├── page.tsx               # Volunteer management list
│               └── [id]/
│                   └── page.tsx           # Volunteer detail + verify
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│
├── components/
│   ├── ui/                                # shadcn/ui base components (auto-generated by CLI)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── textarea.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
<<<<<<< HEAD
│   │   ├── toast.tsx          (use Toaster from sonner instead)
=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │   ├── tooltip.tsx
│   │   ├── popover.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── separator.tsx
│   │   ├── skeleton.tsx
│   │   ├── progress.tsx
│   │   └── sheet.tsx
│   │
│   ├── layout/                            # App shell pieces
<<<<<<< HEAD
│   │   ├── app-shell.tsx                  # Wraps sidebar + main content
│   │   ├── sidebar.tsx                    # Role-aware nav sidebar
│   │   ├── top-bar.tsx                    # Page title + notification bell + user menu
│   │   └── mobile-nav.tsx                 # Sheet-based nav for tablet
=======
│   │   ├── sidebar.tsx                    # Role-aware nav sidebar
│   │   └── top-bar.tsx                    # Page title + notification bell + user menu
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │
│   ├── shared/                            # Cross-cutting reusable components
│   │   ├── urgency-badge.tsx
│   │   ├── status-badge.tsx
│   │   ├── need-type-icon.tsx
│   │   ├── priority-score-display.tsx     # Shows score + breakdown tooltip
│   │   ├── match-score-display.tsx        # Shows match score breakdown tooltip
│   │   ├── location-display.tsx           # MapPin + text
│   │   ├── deadline-display.tsx           # Clock + relative time
│   │   ├── language-switcher.tsx
│   │   ├── empty-state.tsx                # Reusable "nothing here" component
│   │   ├── error-boundary.tsx
│   │   ├── page-header.tsx                # Title + subtitle + optional action button
│   │   ├── confirm-dialog.tsx             # Generic confirmation modal
│   │   ├── file-dropzone.tsx              # Image upload with drag-and-drop
│   │   └── photo-upload-button.tsx        # Inline photo attach (for completion)
│   │
│   ├── dashboard/
│   │   ├── stat-card.tsx                  # Single KPI card (number + label + trend)
│   │   ├── stats-row.tsx                  # Row of 4–5 stat-cards
│   │   ├── needs-heatmap.tsx              # Leaflet map with cluster pins
│   │   ├── activity-feed.tsx              # Recent-events list (Firestore listener)
│   │   └── critical-needs-alert.tsx       # Banner if critical needs are unassigned
│   │
│   ├── needs/
│   │   ├── needs-table.tsx                # Filterable, sortable table
│   │   ├── needs-filters.tsx              # Status/urgency/type filter bar
│   │   ├── need-card.tsx                  # Card view (used in review queue)
│   │   ├── need-detail-panel.tsx          # Full need info (right panel or full page)
│   │   ├── review-editor.tsx              # Editable extraction fields + original side-by-side
│   │   ├── extraction-diff.tsx            # Original vs AI-extracted comparison
│   │   ├── publish-confirm-dialog.tsx     # Show full breakdown before publishing
│   │   ├── assignment-team-view.tsx       # Shows all volunteers assigned to a need
│   │   └── need-status-stepper.tsx        # Visual status progression bar
│   │
│   ├── assignments/
│   │   ├── assignment-list.tsx            # Volunteer's assignment cards
│   │   ├── assignment-card.tsx            # Single assignment summary card
│   │   ├── assignment-detail.tsx          # Full assignment detail with actions
│   │   ├── accept-decline-buttons.tsx     # CTA block with deadline countdown
│   │   ├── deadline-countdown.tsx         # Live countdown timer
│   │   └── completion-form.tsx            # Status update + photo upload
│   │
│   ├── volunteers/
│   │   ├── onboarding/
│   │   │   ├── step-skills.tsx            # Multi-select skills picker
│   │   │   ├── step-location.tsx          # Leaflet map location picker
│   │   │   ├── step-availability.tsx      # Availability slot builder
│   │   │   └── step-preferences.tsx       # Notification prefs + language
│   │   ├── profile-card.tsx               # Summary card (used in admin list)
│   │   ├── skills-editor.tsx              # Add/remove skill tags
│   │   ├── availability-manager.tsx       # View/add/remove time slots
│   │   └── reliability-score-display.tsx  # Score + history tooltip
│   │
<<<<<<< HEAD
│   ├── submissions/
=======
│   ├── submissions/                       # ✅ COMPLETE (Day 3)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │   ├── submission-form.tsx            # Main intake form
│   │   ├── image-upload-grid.tsx          # Multi-image upload grid (up to 5)
│   │   └── submission-progress.tsx        # Extraction status indicator
│   │
│   ├── reports/
│   │   ├── report-card.tsx                # Weekly report row/card
│   │   └── report-metrics-preview.tsx     # Key numbers before PDF
│   │
│   └── notifications/
│       ├── notification-item.tsx          # Single inbox row
│       └── notification-bell.tsx          # Bell icon with unread count badge
│
├── lib/
│   ├── api/                               # Typed API client layer
│   │   ├── client.ts                      # Base fetch wrapper (adds auth header)
<<<<<<< HEAD
│   │   ├── needs.ts                       # Need-related API calls
=======
│   │   ├── needs.ts
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │   ├── assignments.ts
│   │   ├── volunteers.ts
│   │   ├── submissions.ts
│   │   ├── analytics.ts
│   │   ├── notifications.ts
│   │   ├── reports.ts
<<<<<<< HEAD
│   │   └── uploads.ts                     # Signed URL + GCS direct upload helper
=======
│   │   ├── uploads.ts                     # Signed URL + GCS direct upload helper
│   │   └── query-keys.ts
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │
│   ├── firebase/
│   │   ├── config.ts                      # Firebase app init
│   │   ├── auth.ts                        # signIn, signOut, onAuthStateChanged helpers
│   │   └── firestore.ts                   # Typed Firestore listener hooks
│   │
│   ├── hooks/                             # Custom React hooks
<<<<<<< HEAD
│   │   ├── use-auth.ts                    # Auth context consumer
│   │   ├── use-needs.ts                   # TanStack Query hooks for needs
=======
│   │   ├── use-auth.ts
│   │   ├── use-upload.ts                  # ✅ COMPLETE (Day 3) — GCS signed-URL upload flow
│   │   ├── use-needs.ts
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │   ├── use-assignments.ts
│   │   ├── use-volunteers.ts
│   │   ├── use-analytics.ts
│   │   ├── use-notifications.ts
│   │   ├── use-realtime-need.ts           # Firestore listener: /needs_realtime/{id}
│   │   ├── use-realtime-assignment.ts     # Firestore listener: /task_status/{id}
<<<<<<< HEAD
│   │   ├── use-coordinator-feed.ts        # Firestore listener: /coordinator_feed/{org}
│   │   └── use-upload.ts                  # GCS signed-URL upload flow
=======
│   │   └── use-coordinator-feed.ts        # Firestore listener: /coordinator_feed/{org}
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │
│   ├── providers/
│   │   ├── auth-provider.tsx              # Firebase auth state context
│   │   ├── query-provider.tsx             # TanStack Query client
│   │   └── i18n-provider.tsx              # next-intl NextIntlClientProvider
│   │
│   ├── utils/
│   │   ├── date.ts                        # date-fns helpers (format, relative, IST)
<<<<<<< HEAD
│   │   ├── priority.ts                    # time_pressure() + compute_full_score() (mirrors backend)
=======
│   │   ├── priority.ts                    # time_pressure() + compute_full_score()
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│   │   ├── format.ts                      # number, distance, count formatting
│   │   └── cn.ts                          # clsx + tailwind-merge helper
│   │
│   └── types/
<<<<<<< HEAD
│       ├── api.ts                         # All API response shapes (mirroring Pydantic models)
=======
│       ├── api.ts                         # All API response shapes
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
│       ├── firestore.ts                   # Firestore document shapes
│       └── enums.ts                       # Status / urgency / role enums
│
├── messages/                              # i18n translation files
│   ├── en.json
│   ├── hi.json
│   └── gu.json
│
├── public/
│   ├── logo.svg
│   └── favicon.ico
│
<<<<<<< HEAD
├── middleware.ts                          # Next.js middleware: auth guard + locale detection
=======
├── proxy.ts                               # Next.js 16 auth guard (replaces middleware.ts)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
├── next.config.ts
├── tailwind.config.ts
├── components.json                        # shadcn/ui config
└── package.json
```

---

## 3. Pages & Routes Reference

### 3.1 Page Inventory

| Route | Page | Access | Description |
|-------|------|--------|-------------|
| `/` | Root redirect | All | Redirects to `/dashboard` (logged in) or `/login` |
| `/login` | Login | Public | Email/password sign-in with Firebase |
| `/dashboard` | Coordinator Dashboard | coordinator, admin | KPIs, heatmap, activity feed, review queue count |
| `/submissions/new` | New Submission | coordinator, admin | Webform: text + image upload → triggers AI extraction |
| `/needs` | Needs List | coordinator, admin | Filterable table of all needs |
| `/needs/[id]` | Need Detail | coordinator, admin | Full need view + team assignments panel |
| `/needs/[id]/review` | Need Review | coordinator, admin | Side-by-side extraction editor → publish |
| `/assignments` | My Assignments | volunteer | Volunteer's assigned tasks list |
| `/assignments/[id]` | Assignment Detail | volunteer | Accept/decline/update/complete with photo |
| `/volunteers/register` | Volunteer Onboarding | volunteer (new) | 4-step: skills → location → availability → prefs |
| `/volunteers/me` | My Profile | volunteer | View/edit own profile, skills, availability |
| `/reports` | Weekly Reports | coordinator, admin | List of weekly reports + PDF download |
| `/notifications` | Notifications | All | In-app inbox |
| `/settings` | Settings | All | Language, display name, notification prefs |
| `/admin/volunteers` | Volunteer Management | admin | List + search all volunteers |
| `/admin/volunteers/[id]` | Volunteer Admin View | admin | Detail + verify/suspend |

### 3.2 Per-Page Data Requirements

#### `/dashboard`
- **Fetches:** `GET /analytics/dashboard` (TanStack Query, 30s stale time)
- **Realtime:** Firestore listener on `/coordinator_feed/{org_id}/feed` (last 20 events)
- **Derived:** Pending review count from `open_needs_count` breakdown

<<<<<<< HEAD
#### `/submissions/new`
=======
#### `/submissions/new` ✅ Complete
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- **Mutations:** `POST /uploads/signed-url` (per image), then `POST /submissions`
- **Local state:** React state for images array, text field, upload progress
- **After submit:** Show extraction progress indicator → redirect to `/needs?status=pending_review`

#### `/needs`
- **Fetches:** `GET /needs` with query params from filter state
- **Pagination:** cursor-based, infinite scroll (TanStack Query `useInfiniteQuery`)
- **Client state:** filter values (status, urgency, need_type) in URL search params (`useSearchParams`)

#### `/needs/[id]`
- **Fetches:** `GET /needs/{id}`, `GET /needs/{id}/assignments`
- **Realtime:** Firestore `/needs_realtime/{id}` for live status changes
- **Priority:** `GET /needs/{id}/explain` (lazy, on tooltip open)

#### `/needs/[id]/review`
- **Fetches:** `GET /needs/{id}` (includes raw_submission reference)
- **Mutations:** `PATCH /needs/{id}`, then `POST /needs/{id}/publish`
- **Form:** react-hook-form + Zod validation

#### `/assignments`
- **Fetches:** `GET /volunteers/me/assignments`
- **Realtime:** Firestore `/task_status/{assignment_id}` per item

#### `/assignments/[id]`
- **Fetches:** Inlined in parent assignment list (pass as prop or re-fetch by id)
- **Mutations:** `POST /assignments/{id}/accept`, `/decline`, `/status`
- **Realtime:** Firestore `/task_status/{id}` for live status
- **Upload:** `POST /uploads/signed-url` (purpose=completion) → PUT to GCS → pass URL in status update

#### `/volunteers/register`
- **Multi-step form:** local state with `useState` step counter
- **On complete:** `POST /volunteers` with full payload
- **Map:** Leaflet location picker (lat/lng stored in state)

---

## 4. Component Tree (All Components)

### 4.1 App Shell

```
RootLayout (app/layout.tsx)
└── Providers (QueryProvider, AuthProvider, I18nProvider)
    ├── (auth)/layout.tsx
    │   └── Centered auth card
<<<<<<< HEAD
    └── (app)/layout.tsx  → AppShell
=======
    └── (app)/layout.tsx  — AppShell
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
        ├── Sidebar
        │   ├── Logo + org name
        │   ├── NavItem[] (role-filtered)
        │   │   coordinator: Dashboard, New Submission, Needs, Reports, Notifications, Settings
        │   │   volunteer: My Assignments, My Profile, Notifications, Settings
        │   │   admin: (all coordinator items) + Admin > Volunteers
        │   ├── LanguageSwitcher
        │   └── UserMenu (avatar + logout)
<<<<<<< HEAD
        ├── MobileNav (Sheet, visible < lg)
        ├── TopBar
        │   ├── PageTitle (h1, from page metadata or prop)
=======
        ├── TopBar
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
        │   ├── NotificationBell (with unread count)
        │   └── UserAvatarDropdown
        └── <main> (page content)
```

### 4.2 Dashboard Page

```
/dashboard
├── PageHeader ("Dashboard", subtitle = org name)
├── CriticalNeedsAlert (if critical unassigned needs > 0)
├── StatsRow
│   ├── StatCard ("Open Needs", open_needs_count, icon=ClipboardList)
│   ├── StatCard ("Critical", critical_needs_count, red, icon=AlertCircle)
│   ├── StatCard ("Pending Review", pending_review_count, yellow, icon=Clock)
│   ├── StatCard ("Active Volunteers", active_volunteers, icon=Users)
│   └── StatCard ("Served This Week", beneficiaries_served_this_week, icon=Heart)
├── div.grid.grid-cols-3.gap-6
│   ├── NeedsHeatmap (col-span-2)
│   │   └── Leaflet MapContainer
│   │       └── CircleMarker[] (from heatmap array)
│   └── ActivityFeed (col-span-1)
│       └── FeedItem[] (from Firestore coordinator_feed)
│           ├── Icon (per event type)
│           ├── Message text
│           └── RelativeTime
└── PendingReviewQueue (if pending_review_count > 0)
    └── NeedCard[] (top 5 pending review, link to /needs/[id]/review)
```

<<<<<<< HEAD
### 4.3 New Submission Page
=======
### 4.3 New Submission Page ✅ Complete
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

```
/submissions/new
├── PageHeader ("Report a Need")
<<<<<<< HEAD
├── SubmissionForm
│   ├── Textarea (raw_text, "Describe the situation…")
│   ├── ImageUploadGrid
│   │   ├── DropZone (drag-and-drop + file picker, up to 5 images)
│   │   ├── ImagePreviewTile[] (thumbnail + remove button)
│   │   └── UploadProgress (per file, uses useUpload hook)
│   ├── FormFooter
│   │   ├── CharacterCount (live on textarea)
│   │   └── SubmitButton ("Extract & Queue for Review")
│   └── SubmissionProgress (shown after submit)
│       ├── Spinner
│       ├── Status text ("AI is processing your submission…")
│       └── Link to pending review queue
=======
└── SubmissionForm
    ├── Textarea (raw_text, "Describe the situation…")
    ├── ImageUploadGrid
    │   ├── DropZone (drag-and-drop + file picker, up to 5 images)
    │   ├── ImagePreviewTile[] (thumbnail + remove button)
    │   └── UploadProgress (per file, uses useUpload hook)
    ├── FormFooter
    │   └── SubmitButton ("Submit Report")
    └── SubmissionProgress (shown after submit)
        ├── CheckCircle2 icon + "Report submitted!" heading
        ├── Submission ID + status display
        ├── Link to /submissions
        └── "Submit another report" button
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.4 Needs List Page

```
/needs
├── PageHeader ("Needs", action=Button "New Submission")
├── NeedsFilters
│   ├── StatusFilter (Select or Tabs)
│   ├── UrgencyFilter (multi-select CheckboxGroup)
│   ├── NeedTypeFilter (Select)
│   └── SearchInput (title search)
<<<<<<< HEAD
├── NeedsTable (or NeedsGrid for pending_review)
│   ├── Table head: Title, Type, Urgency, Priority, Status, Location, Deadline, Actions
│   └── NeedsTableRow[] (each row)
│       ├── NeedTypeIcon
│       ├── Title (truncated, link to /needs/[id])
│       ├── UrgencyBadge
│       ├── PriorityScoreDisplay (number + tooltip with breakdown)
│       ├── StatusBadge
│       ├── LocationDisplay
│       ├── DeadlineDisplay
│       └── RowActions (Review, View, Cancel)
└── InfiniteScrollSentinel (triggers next page load)
=======
└── NeedsTable
    ├── Table head: Title, Type, Urgency, Priority, Status, Location, Deadline, Actions
    └── NeedsTableRow[]
        ├── NeedTypeIcon
        ├── Title (truncated, link to /needs/[id])
        ├── UrgencyBadge
        ├── PriorityScoreDisplay (number + tooltip with breakdown)
        ├── StatusBadge
        ├── LocationDisplay
        ├── DeadlineDisplay
        └── RowActions (Review, View, Cancel)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.5 Need Detail Page

```
/needs/[id]
├── PageHeader (need.title, back button to /needs)
<<<<<<< HEAD
├── div.grid.grid-cols-3.gap-6
│   ├── div.col-span-2 → NeedDetailPanel
│   │   ├── NeedStatusStepper (visual bar)
│   │   ├── section "Description"
│   │   │   ├── EnglishDescription (text)
│   │   │   └── OriginalText (collapsible, with language badge)
│   │   ├── section "Details"
│   │   │   ├── UrgencyBadge
│   │   │   ├── BeneficiaryCount (people icon + number)
│   │   │   ├── RequiredSkills (tag list)
│   │   │   ├── RequiredTeamSize
│   │   │   ├── ResourcesNeeded (tag list)
│   │   │   ├── Deadline (DeadlineDisplay)
│   │   │   └── LocationDisplay
│   │   └── section "Submission Images" (if any)
│   │       └── ImageThumbnails (lightbox on click)
│   └── div.col-span-1 → right panel
│       ├── PriorityScoreCard
│       │   ├── PriorityScoreDisplay (large number)
│       │   └── BreakdownBars (each component as a progress bar)
│       └── AssignmentTeamView
│           ├── TeamSlotsHeader ("2 of 2 volunteers assigned")
│           └── AssignmentRow[] (volunteer name, role, status, score)
└── ActionBar (sticky bottom on mobile, right-aligned on desktop)
    ├── If status=pending_review → Button "Review & Publish" → /needs/[id]/review
    └── If status=published/matching_complete → Button "Cancel Need" (with confirm)
=======
└── div.grid.grid-cols-3.gap-6
    ├── NeedDetailPanel (col-span-2)
    │   ├── NeedStatusStepper
    │   ├── section "Description"
    │   ├── section "Details" (urgency, beneficiaries, skills, deadline, location)
    │   └── section "Submission Images"
    └── right panel (col-span-1)
        ├── PriorityScoreCard
        │   ├── PriorityScoreDisplay (large number)
        │   └── BreakdownBars (each component as progress bar)
        └── AssignmentTeamView
            ├── TeamSlotsHeader
            └── AssignmentRow[] (volunteer name, role, status, score)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.6 Need Review Page

```
/needs/[id]/review
<<<<<<< HEAD
├── PageHeader ("Review Need", subtitle="Verify AI extraction before publishing")
├── div.grid.grid-cols-2.gap-8
│   ├── OriginalSubmissionPanel (left, read-only)
│   │   ├── OriginalText (pre-wrap)
│   │   ├── LanguageBadge
│   │   └── SubmissionImages (scrollable)
│   └── ReviewEditor (right, react-hook-form)
│       ├── Field: Title (Input)
│       ├── Field: NeedType (Select)
│       ├── Field: Category (Input, optional)
│       ├── Field: Urgency (Select with color indicators)
│       ├── Field: Description (Textarea)
│       ├── Field: BeneficiaryCount (NumberInput)
│       ├── Field: RequiredSkills (TagInput)
│       ├── Field: RequiredTeamSize (NumberInput)
│       ├── Field: ResourcesNeeded (TagInput)
│       ├── Field: Deadline (DateTimePicker)
│       ├── Field: WindowStart / WindowEnd (DateTimePicker pair)
│       └── Field: LocationText (Input, with MapPicker button)
├── ExtractionConfidenceIndicator (AI confidence score, shown if < 0.7)
└── PublishConfirmDialog (modal, opens on "Publish")
    ├── PriorityScoreDisplay (preview of score that will be computed)
    ├── BreakdownPreview
    └── ConfirmButton "Publish Need"
=======
├── PageHeader ("Review Need")
└── div.grid.grid-cols-2.gap-8
    ├── OriginalSubmissionPanel (left, read-only)
    │   ├── OriginalText
    │   ├── LanguageBadge
    │   └── SubmissionImages
    └── ReviewEditor (right, react-hook-form)
        ├── Fields: title, need_type, category, urgency, description,
        │          beneficiary_count, required_skills, required_team_size,
        │          resources_needed, deadline, window_start, window_end, location_text
        └── PublishConfirmDialog
            ├── PriorityScoreDisplay (preview)
            ├── BreakdownPreview
            └── ConfirmButton "Publish Need"
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.7 Volunteer Assignments Page

```
/assignments
├── PageHeader ("My Assignments")
├── TabBar (Pending | Active | Completed | All)
└── AssignmentList
    └── AssignmentCard[]
        ├── NeedTypeIcon
        ├── NeedTitle + UrgencyBadge
<<<<<<< HEAD
        ├── RoleBadge (role_in_team)
        ├── LocationDisplay
        ├── AssignmentStatusBadge
        ├── MatchScoreDisplay (score + breakdown tooltip)
        ├── DeadlineCountdown (if pending_accept)
        └── ActionButtons
            if pending_accept → AcceptButton + DeclineButton
            if accepted       → "Mark In Progress"
            if in_progress    → "Mark Complete"
=======
        ├── RoleBadge
        ├── LocationDisplay
        ├── AssignmentStatusBadge
        ├── MatchScoreDisplay
        ├── DeadlineCountdown (if pending_accept)
        └── ActionButtons
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.8 Assignment Detail Page

```
/assignments/[id]
├── PageHeader (need.title, back button)
<<<<<<< HEAD
├── div.grid.grid-cols-3.gap-6
│   ├── div.col-span-2 → AssignmentDetail
│   │   ├── NeedDetailPanel (read-only, condensed)
│   │   └── YourRoleCard
│   │       ├── RoleBadge
│   │       ├── MatchScoreDisplay
│   │       └── AssignedAt timestamp
│   └── div.col-span-1 → ActionPanel
│       ├── AssignmentStatusBadge (current state)
│       ├── AcceptDeclineButtons (if pending_accept)
│       │   ├── DeadlineCountdown
│       │   ├── Button "Accept Assignment" (primary)
│       │   └── Button "Decline" (ghost) → DeclineReasonDialog
│       ├── InProgressButton (if accepted)
│       └── CompletionForm (if in_progress)
│           ├── Textarea (completion notes)
│           ├── PhotoUploadButton (up to 3 photos)
│           └── Button "Mark Completed"
=======
└── div.grid.grid-cols-3.gap-6
    ├── AssignmentDetail (col-span-2)
    │   ├── NeedDetailPanel (read-only)
    │   └── YourRoleCard (role, match score, assigned_at)
    └── ActionPanel (col-span-1)
        ├── AcceptDeclineButtons (if pending_accept)
        │   ├── DeadlineCountdown
        │   ├── Button "Accept Assignment"
        │   └── Button "Decline" → DeclineReasonDialog
        ├── InProgressButton (if accepted)
        └── CompletionForm (if in_progress)
            ├── Textarea (completion notes)
            ├── PhotoUploadButton (up to 3 photos)
            └── Button "Mark Completed"
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.9 Volunteer Registration (Multi-Step)

```
/volunteers/register
<<<<<<< HEAD
├── ProgressSteps (Step 1 of 4, visual dots)
└── StepContainer (switches on step state)
    ├── Step 1 — StepSkills
    │   ├── SkillsSearch (ComboBox with suggested skills)
    │   ├── SelectedSkillsTags (removable)
    │   ├── CertificationsInput (free-text list)
    │   └── Next →
    ├── Step 2 — StepLocation
    │   ├── Leaflet MapContainer (click to set pin)
    │   ├── AddressInput (text fallback)
    │   ├── MaxTravelSlider (1–100 km, with TravelRadiusCircle on map)
    │   └── Next →
    ├── Step 3 — StepAvailability
    │   ├── AvailabilitySlotBuilder
    │   │   ├── DatePicker (start date)
    │   │   ├── TimeRange (start/end time pickers)
    │   │   ├── RecurrenceToggle ("One-time" / "Repeat weekly")
    │   │   └── AddSlotButton
    │   └── SlotList (removable tags)
=======
├── ProgressSteps (Step 1 of 4)
└── StepContainer
    ├── Step 1 — StepSkills
    │   ├── SkillsSearch (ComboBox)
    │   └── SelectedSkillsTags + CertificationsInput
    ├── Step 2 — StepLocation
    │   ├── Leaflet MapContainer (click to set pin)
    │   ├── AddressInput
    │   └── MaxTravelSlider (1–100 km)
    ├── Step 3 — StepAvailability
    │   ├── AvailabilitySlotBuilder (date + time range + recurrence)
    │   └── SlotList (removable)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
    └── Step 4 — StepPreferences
        ├── LanguageSelect (en / hi / gu)
        ├── NotificationToggles (email, in_app)
        └── SubmitButton "Complete Registration"
```

### 4.10 Reports Page

```
/reports
├── PageHeader ("Weekly Reports")
<<<<<<< HEAD
├── ReportsList
│   └── ReportCard[]
│       ├── WeekLabel ("Week of Apr 14–20, 2026")
│       ├── ReportMetricsPreview (3–4 key numbers inline)
│       ├── HeadlineText (from Gemini narrative)
│       └── DownloadPDFButton (calls GET /reports/weekly.pdf → opens signed URL)
└── EmptyState (if no reports yet)
=======
└── ReportsList
    └── ReportCard[]
        ├── WeekLabel
        ├── ReportMetricsPreview
        ├── HeadlineText
        └── DownloadPDFButton
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 4.11 Notifications Page

```
/notifications
├── PageHeader ("Notifications")
├── MarkAllReadButton
└── NotificationList
    └── NotificationItem[]
        ├── Icon (per type)
        ├── Subject (bold if unread)
        ├── Body (truncated)
        ├── RelativeTime
        └── ReadIndicator (dot)
```

### 4.12 Admin Volunteers Page

```
/admin/volunteers
├── PageHeader ("Volunteer Management")
├── SearchInput + VerifiedFilter + SkillFilter
<<<<<<< HEAD
├── VolunteersTable
│   └── VolunteerRow[]
│       ├── Name + email
│       ├── Skills (first 3 + "+N more" badge)
│       ├── Location
│       ├── ReliabilityScore
│       ├── VerifiedBadge / UnverifiedBadge
│       └── Link to /admin/volunteers/[id]
└── /admin/volunteers/[id]
    ├── ProfileCard (full details)
    ├── VerificationDocsSection (if submitted)
    ├── AssignmentHistoryTable
    └── ActionButtons
        ├── Button "Verify Volunteer" (if not verified)
        └── Button "Suspend Account" (sets deleted_at)
=======
└── VolunteersTable
    └── VolunteerRow[]
        ├── Name + email
        ├── Skills (first 3 + "+N more")
        ├── Location
        ├── ReliabilityScore
        ├── VerifiedBadge
        └── Link to /admin/volunteers/[id]

/admin/volunteers/[id]
├── ProfileCard
├── VerificationDocsSection
├── AssignmentHistoryTable
└── ActionButtons (Verify / Suspend)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

---

## 5. Data Fetching & State Patterns

### 5.1 API Client Base

```ts
// lib/api/client.ts
<<<<<<< HEAD
import { getAuth } from 'firebase/auth';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const user = getAuth().currentUser;
  const token = user ? await user.getIdToken() : null;

=======
import { getToken } from '@/lib/firebase/auth';

export class ApiError extends Error {
  constructor(public status: number, public code?: string, message?: string) {
    super(message ?? `API error ${status}`);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
<<<<<<< HEAD

=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err?.error?.code, err?.error?.message);
  }
  return res.json() as Promise<T>;
}
```

### 5.2 TanStack Query Keys

<<<<<<< HEAD
Define query keys as constants to ensure cache coherence:

=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```ts
// lib/api/query-keys.ts
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
};
```

### 5.3 Mutation + Cache Invalidation Pattern

<<<<<<< HEAD
After every mutation (accept, publish, etc.), invalidate the relevant queries:

```ts
// lib/hooks/use-needs.ts (example)
=======
```ts
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
export function usePublishNeed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/needs/${id}/publish`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: QK.need(id) });
      qc.invalidateQueries({ queryKey: QK.needs() });
      qc.invalidateQueries({ queryKey: QK.dashboard() });
    },
  });
}
```

### 5.4 Pagination (Infinite Scroll)

```ts
<<<<<<< HEAD
// lib/hooks/use-needs.ts
=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
export function useInfiniteNeeds(filters: NeedsFilters) {
  return useInfiniteQuery({
    queryKey: QK.needs(filters),
    queryFn: ({ pageParam }) =>
      apiFetch<NeedsPage>(`/needs?${toQueryString({ ...filters, cursor: pageParam, limit: 20 })}`),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    initialPageParam: undefined,
    staleTime: 30_000,
  });
}
```

---

## 6. Realtime (Firestore) Patterns

### 6.1 Coordinator Feed Hook

```ts
// lib/hooks/use-coordinator-feed.ts
<<<<<<< HEAD
import { collection, onSnapshot, orderBy, query, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/firestore';

=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
export function useCoordinatorFeed(orgId: string) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  useEffect(() => {
    if (!orgId) return;
    const q = query(
      collection(db, 'coordinator_feed', orgId, 'feed'),
      orderBy('created_at', 'desc'),
      limit(20)
    );
    return onSnapshot(q, (snap) =>
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as FeedEvent)))
    );
  }, [orgId]);
  return events;
}
```

### 6.2 Realtime Need Status

```ts
// lib/hooks/use-realtime-need.ts
export function useRealtimeNeed(needId: string) {
  const [data, setData] = useState<NeedRealtime | null>(null);
  useEffect(() => {
    const ref = doc(db, 'needs_realtime', needId);
    return onSnapshot(ref, snap => setData(snap.data() as NeedRealtime));
  }, [needId]);
  return data;
}
```

### 6.3 Usage in Components

```tsx
<<<<<<< HEAD
// In NeedDetailPanel — merge Firestore status with REST data
const need = useQuery(QK.need(id), ...);           // full data from REST
const realtime = useRealtimeNeed(id);              // live status from Firestore

const status = realtime?.status ?? need.data?.status;  // prefer Firestore
=======
// Merge Firestore status with REST data — prefer Firestore for live status
const need = useQuery({ queryKey: QK.need(id), queryFn: () => needsApi.get(id) });
const realtime = useRealtimeNeed(id);
const status = realtime?.status ?? need.data?.status;
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

---

## 7. i18n Setup

### 7.1 next-intl Configuration

```ts
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./i18n.ts');
export default withNextIntl({ /* nextConfig */ });
<<<<<<< HEAD

// i18n.ts
import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```

### 7.2 Translation File Structure

```json
<<<<<<< HEAD
// messages/en.json (abbreviated — create full versions)
{
  "nav": {
    "dashboard": "Dashboard",
    "needs": "Needs",
    "submissions": "New Submission",
    "assignments": "My Assignments",
    "reports": "Reports",
    "notifications": "Notifications",
    "settings": "Settings",
    "admin": "Admin"
  },
  "urgency": {
    "critical": "Critical",
    "high": "High",
    "medium": "Medium",
    "low": "Low"
  },
  "status": {
    "pending_review": "Pending Review",
    "published": "Published",
    "matching_complete": "Matching Complete",
    "assigned": "Assigned",
    "in_progress": "In Progress",
    "completed": "Completed",
    "cancelled": "Cancelled"
  },
  "needs": {
    "title": "Needs",
    "empty": "No needs found. Adjust filters or submit a new one.",
    "review_title": "Review Need",
    "publish_confirm": "Publish this need?",
    "publish_confirm_desc": "This will trigger automatic volunteer matching."
  },
  "assignments": {
    "title": "My Assignments",
    "accept": "Accept Assignment",
    "decline": "Decline",
    "deadline_label": "Accept by",
    "accept_success": "Assignment accepted!",
    "complete": "Mark Completed"
  },
  "dashboard": {
    "title": "Dashboard",
    "open_needs": "Open Needs",
    "critical_needs": "Critical",
    "pending_review": "Pending Review",
    "active_volunteers": "Active Volunteers",
    "served_week": "Served This Week"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "back": "Back",
    "loading": "Loading…",
    "error": "Something went wrong",
    "empty": "Nothing here yet",
    "confirm": "Confirm"
  }
=======
{
  "nav": { "dashboard": "Dashboard", "needs": "Needs", ... },
  "urgency": { "critical": "Critical", "high": "High", "medium": "Medium", "low": "Low" },
  "status": { "pending_review": "Pending Review", "published": "Published", ... },
  "needs": { "title": "Needs", "empty": "No needs found.", "publish_confirm": "Publish this need?" },
  "assignments": { "accept": "Accept Assignment", "decline": "Decline", "complete": "Mark Completed" },
  "dashboard": { "open_needs": "Open Needs", "critical_needs": "Critical", ... },
  "common": { "save": "Save", "cancel": "Cancel", "back": "Back", "loading": "Loading…" }
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
}
```

Duplicate structure in `hi.json` and `gu.json` with translated strings.

<<<<<<< HEAD
### 7.3 Language Switcher Component

```tsx
// components/shared/language-switcher.tsx
const locales = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'gu', label: 'ગુજરાતી' },
];
// Uses router.replace with new locale; also calls PATCH /volunteers/me with preferred_language
```

=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
---

## 8. Auth & Role Guards

<<<<<<< HEAD
### 8.1 Middleware (Route Protection)

```ts
// middleware.ts
=======
### 8.1 Route Protection (proxy.ts)

> **Note:** This project uses Next.js 16 which replaces `middleware.ts` with `proxy.ts`.
> The exported function must be named `proxy` (not `middleware`).

```ts
// proxy.ts  ← NOT middleware.ts
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

<<<<<<< HEAD
export function middleware(req: NextRequest) {
  const token = req.cookies.get('__session')?.value; // Firebase session cookie
  const path = req.nextUrl.pathname;

=======
export function proxy(req: NextRequest) {
  const token = req.cookies.get('__session')?.value;
  const path = req.nextUrl.pathname;
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  if (!token && !PUBLIC_PATHS.some(p => path.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}
<<<<<<< HEAD
export const config = { matcher: ['/((?!_next|favicon|public).*)'] };
```

### 8.2 Role Guard HOC / Hook
=======

export const config = {
  matcher: ['/((?!_next|favicon|public|.*\\.svg|.*\\.ico).*)'],
};
```

### 8.2 Role Guard Hook
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

```ts
// lib/hooks/use-auth.ts
export function useRequireRole(...roles: Role[]) {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (user && !roles.includes(user.role)) router.replace('/dashboard');
  }, [user]);
}

<<<<<<< HEAD
// Usage in page components:
=======
// Usage:
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
export default function AdminPage() {
  useRequireRole('admin');
  // ...
}
```

### 8.3 Auth Context

```ts
// lib/providers/auth-provider.tsx
<<<<<<< HEAD
// Exposes: { user: AppUser | null, loading: boolean, signOut }
// user contains: { id, role, full_name, email, org_id }
=======
// Exposes: { user: AppUser | null, loading: boolean }
// user: { id, role, full_name, email, org_id }
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
// Populated by calling GET /auth/me after Firebase auth state resolves
```

---

## 9. Forms Reference

<<<<<<< HEAD
### 9.1 All Validated Forms (Zod schemas needed)

| Form | Fields | Validation notes |
|------|--------|-----------------|
| **Submission form** | raw_text, images[] | At least one of text or image required |
| **Need review editor** | title, need_type, urgency, description, beneficiary_count, required_skills[], required_team_size, deadline, window_start, window_end, location_text | title max 80 chars, team_size ≥ 1, window_end > window_start |
| **Volunteer registration** | skills[], certifications[], home_location (lat/lng), home_address, max_travel_km, availability_slots[], preferred_language, notification_prefs | skills min 1, max_travel_km 1–200, at least 1 availability slot |
| **Volunteer profile edit** | Same as registration (partial update) | Same rules |
| **Assignment decline** | reason (string) | Required, min 5 chars |
| **Completion form** | notes, photo_urls[], status (in_progress/completed) | Notes required for completed status |
| **Coordinator rating** | rating (1–5), feedback (string) | rating required |

### 9.2 Tag Input Component (Skills, Resources)

For `required_skills`, `resources_needed`, `skills` fields — a simple controlled input that accepts comma/enter to add tags and renders removable chips. Don't install a library; build a 40-line component.

```tsx
// components/shared/tag-input.tsx
// Props: value: string[], onChange: (v: string[]) => void, suggestions?: string[]
// Key behavior: Enter/comma adds tag, Backspace on empty removes last, 
//               ComboBox dropdown for suggestions
```

### 9.3 DateTime Picker

Use shadcn/ui Popover + a simple calendar approach. For the MVP, an HTML `<input type="datetime-local">` styled with Tailwind is perfectly fine and saves significant complexity.
=======
### 9.1 All Validated Forms

| Form | Fields | Notes |
|------|--------|-------|
| **Submission form** ✅ | raw_text, images[] | Min 20 chars text, max 5 images |
| **Need review editor** | title, need_type, urgency, description, beneficiary_count, required_skills[], required_team_size, deadline, window_start, window_end, location_text | title max 80 chars, team_size ≥ 1 |
| **Volunteer registration** | skills[], certifications[], home_location, home_address, max_travel_km, availability_slots[], preferred_language, notification_prefs | skills min 1, max_travel 1–200 km |
| **Assignment decline** | reason | Required, min 5 chars |
| **Completion form** | notes, photo_urls[], status | Notes required for completed |

### 9.2 Tag Input Component

For `required_skills`, `resources_needed`, `skills` — a simple controlled input, Enter/comma adds tag, Backspace removes last, ComboBox for suggestions. Build as `components/shared/tag-input.tsx` (no extra library needed).

### 9.3 DateTime Picker

For MVP use native `<input type="datetime-local">` styled with Tailwind:
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

```tsx
<input
  type="datetime-local"
  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
  {...register('deadline')}
/>
```

---

## 10. Day-by-Day Frontend Build Order

<<<<<<< HEAD
Aligned with the [11-day roadmap](./09_roadmap.md). You're a solo developer — this is the exact order to minimize wasted work.

### Day 1 (Apr 17) — Scaffold ✅
- [ ] Init Next.js 15 with TypeScript, Tailwind, shadcn/ui
- [ ] Install all dependencies from `package.json`
- [ ] Create `globals.css` with design tokens from §1.1
- [ ] Set up `GeistSans` font
- [ ] Create `(auth)/` and `(app)/` route groups with empty layouts
- [ ] Create `lib/utils/cn.ts`, `lib/types/enums.ts`
- [ ] Scaffold empty page files for all routes in §3.1
- [ ] Run `npx shadcn@latest init` + add: button, card, input, label, select, textarea, badge, table, tabs, skeleton, toast, dialog, tooltip, popover, dropdown-menu, sheet, separator

### Day 2 (Apr 18) — Auth + Shell
- [ ] `lib/firebase/config.ts` + `lib/firebase/auth.ts`
- [ ] `lib/providers/auth-provider.tsx` (Firebase auth state + GET /auth/me)
- [ ] `lib/api/client.ts` (base fetch with token)
- [ ] `/login` page (email/password form, error handling)
- [ ] `AppShell`: Sidebar + TopBar (hardcode nav items, role-filtering later)
- [ ] `components/layout/sidebar.tsx` — nav links, user info, logout
- [ ] `components/shared/page-header.tsx`
- [ ] `components/shared/empty-state.tsx`
- [ ] `components/shared/urgency-badge.tsx` + `status-badge.tsx`
- [ ] Middleware auth guard

### Day 3 (Apr 19) — Submission Form + Extraction Status
- [ ] `lib/api/submissions.ts` + `lib/api/uploads.ts`
- [ ] `lib/hooks/use-upload.ts` (signed URL → PUT to GCS flow)
- [ ] `/submissions/new` page
- [ ] `components/submissions/submission-form.tsx`
- [ ] `components/submissions/image-upload-grid.tsx` (drag-drop, 5-image limit, preview thumbnails, progress bars)
- [ ] `components/submissions/submission-progress.tsx`
- [ ] Test end-to-end: submit form → see pending_review in DB
=======
### Day 1 (Apr 17) — Scaffold ✅ COMPLETE
- [x] Init Next.js 15 with TypeScript, Tailwind, shadcn/ui
- [x] Install all dependencies from `package.json`
- [x] Create `globals.css` with design tokens
- [x] Set up `GeistSans` font
- [x] Create `(auth)/` and `(app)/` route groups with layouts
- [x] Create `lib/utils/cn.ts`, `lib/types/enums.ts`
- [x] Scaffold empty page files for all routes
- [x] Add shadcn/ui components: button, card, input, label, select, textarea, badge, table, tabs, skeleton, dialog, tooltip, popover, dropdown-menu, sheet, separator, progress

### Day 2 (Apr 18) — Auth + Shell ✅ COMPLETE
- [x] `lib/firebase/config.ts` + `lib/firebase/auth.ts` (lazy init — avoids SSR crash)
- [x] `lib/providers/auth-provider.tsx` (Firebase auth state + GET /auth/me)
- [x] `lib/api/client.ts` (base fetch with Bearer token)
- [x] `/login` page (email/password form, error handling)
- [x] `components/layout/sidebar.tsx` — role-aware nav, logout
- [x] `components/layout/top-bar.tsx`
- [x] `components/shared/page-header.tsx`
- [x] `components/shared/empty-state.tsx`
- [x] `components/shared/urgency-badge.tsx` + `status-badge.tsx`
- [x] `proxy.ts` auth guard (Next.js 16 — not middleware.ts)

### Day 3 (Apr 19) — Submission Form + Image Upload ✅ COMPLETE
- [x] `lib/api/submissions.ts` + `lib/api/uploads.ts`
- [x] `lib/hooks/use-upload.ts` (signed URL → PUT to GCS, per-file progress)
- [x] `components/submissions/submission-form.tsx` (react-hook-form + zod)
- [x] `components/submissions/image-upload-grid.tsx` (drag-drop, 5-image limit, preview, progress bars)
- [x] `components/submissions/submission-progress.tsx` (success state + submission ID)
- [x] `/submissions/new` page wired to real form
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

### Day 4 (Apr 20) — Needs List + Review + Publish
- [ ] `lib/api/needs.ts` + `lib/hooks/use-needs.ts`
- [ ] `/needs` page with `NeedsTable` + `NeedsFilters`
- [ ] `components/needs/needs-table.tsx`
- [ ] `components/needs/needs-filters.tsx` (status, urgency filters wired to URL params)
- [ ] `components/shared/need-type-icon.tsx`
- [ ] `components/shared/deadline-display.tsx`
- [ ] `components/shared/location-display.tsx`
<<<<<<< HEAD
- [ ] `/needs/[id]/review` page → `components/needs/review-editor.tsx`
- [ ] `components/needs/extraction-diff.tsx`
- [ ] `components/needs/publish-confirm-dialog.tsx`
- [ ] `lib/utils/priority.ts` (time_pressure + full_score for preview)
=======
- [ ] `/needs/[id]/review` page + `components/needs/review-editor.tsx`
- [ ] `components/needs/extraction-diff.tsx`
- [ ] `components/needs/publish-confirm-dialog.tsx`
- [ ] `lib/utils/priority.ts` (time_pressure + full_score preview)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

### Day 5 (Apr 21) — Priority + Need Detail + Score Explainability
- [ ] `components/shared/priority-score-display.tsx` (score + Tooltip breakdown)
- [ ] `components/shared/match-score-display.tsx`
<<<<<<< HEAD
- [ ] `/needs/[id]` page → `NeedDetailPanel` + `AssignmentTeamView`
- [ ] `components/needs/need-status-stepper.tsx`
- [ ] `components/needs/assignment-team-view.tsx`
- [ ] Priority breakdown bars in PriorityScoreCard (right panel)
=======
- [ ] `/needs/[id]` page — `NeedDetailPanel` + `AssignmentTeamView`
- [ ] `components/needs/need-status-stepper.tsx`
- [ ] `components/needs/assignment-team-view.tsx`
- [ ] Priority breakdown bars in PriorityScoreCard
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- [ ] Wire `GET /needs/{id}/explain` on tooltip hover

### Day 6 (Apr 22) — Volunteer UX
- [ ] `/volunteers/register` multi-step form (all 4 steps)
- [ ] `lib/firebase/firestore.ts` init
- [ ] `lib/hooks/use-realtime-assignment.ts`
<<<<<<< HEAD
- [ ] `/assignments` page → `AssignmentList` + `AssignmentCard`
- [ ] `components/assignments/deadline-countdown.tsx` (live timer)
- [ ] `components/assignments/accept-decline-buttons.tsx`
- [ ] `/assignments/[id]` → `AssignmentDetail` + `CompletionForm`
=======
- [ ] `/assignments` page — `AssignmentList` + `AssignmentCard`
- [ ] `components/assignments/deadline-countdown.tsx` (live timer)
- [ ] `components/assignments/accept-decline-buttons.tsx`
- [ ] `/assignments/[id]` — `AssignmentDetail` + `CompletionForm`
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- [ ] `photo-upload-button.tsx` (signs URL with purpose=completion)
- [ ] Role-filter the sidebar nav

### Day 7 (Apr 23) — Realtime + Notifications
- [ ] `lib/hooks/use-coordinator-feed.ts`
- [ ] `lib/hooks/use-realtime-need.ts`
- [ ] Wire Firestore status into NeedDetailPanel
<<<<<<< HEAD
- [ ] `components/dashboard/activity-feed.tsx` (Firestore feed)
- [ ] `components/notifications/notification-bell.tsx` (unread count)
- [ ] `/notifications` page + `notification-item.tsx`
- [ ] `lib/api/notifications.ts` + `POST /notifications/{id}/read`
- [ ] Toast notifications on accept/decline/status update (use `sonner`)
=======
- [ ] `components/dashboard/activity-feed.tsx`
- [ ] `components/notifications/notification-bell.tsx` (unread count)
- [ ] `/notifications` page + `notification-item.tsx`
- [ ] `lib/api/notifications.ts` + `POST /notifications/{id}/read`
- [ ] Toast notifications on accept/decline/status update (sonner)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7

### Day 8 (Apr 24) — Dashboard + Reports
- [ ] `lib/api/analytics.ts` + `lib/hooks/use-analytics.ts`
- [ ] `/dashboard` page fully wired
- [ ] `components/dashboard/stat-card.tsx` + `stats-row.tsx`
<<<<<<< HEAD
- [ ] `components/dashboard/needs-heatmap.tsx` (Leaflet + react-leaflet)
=======
- [ ] `components/dashboard/needs-heatmap.tsx` (Leaflet + react-leaflet, SSR-safe)
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- [ ] `components/dashboard/critical-needs-alert.tsx`
- [ ] `/reports` page + `report-card.tsx`
- [ ] PDF download flow (open signed URL in new tab)

### Day 9 (Apr 25) — Admin + Profile
- [ ] `/admin/volunteers` + volunteers table
- [ ] `/admin/volunteers/[id]` + verify button
- [ ] `/volunteers/me` edit profile page
<<<<<<< HEAD
- [ ] `components/volunteers/availability-manager.tsx` (view/add/remove slots)
- [ ] Settings page (language switcher wired to API PATCH + cookie)

### Day 10 (Apr 26) — Polish
- [ ] Add Skeleton loaders to every data-fetching page (NeedsTable, Dashboard, AssignmentList)
- [ ] Loading states on every mutation button (disabled + spinner while pending)
- [ ] Error boundaries on all pages
- [ ] `NeedsFilters` → persist filters to URL params (`useSearchParams`)
- [ ] Hindi + Gujarati translation strings (fill all keys in hi.json + gu.json)
- [ ] Desktop layout review: check all pages at 1280px and 1440px
- [ ] Tablet layout: MobileNav sheet, collapsed sidebar
- [ ] Accessibility: all images have alt, buttons have aria-label, form inputs have labels
=======
- [ ] `components/volunteers/availability-manager.tsx`
- [ ] Settings page (language switcher wired to API PATCH + cookie)

### Day 10 (Apr 26) — Polish
- [ ] Skeleton loaders on every data-fetching page
- [ ] Loading states on every mutation button
- [ ] Error boundaries on all pages
- [ ] Persist `NeedsFilters` to URL params (`useSearchParams`)
- [ ] Hindi + Gujarati translation strings (hi.json + gu.json)
- [ ] Desktop layout review (1280px, 1440px)
- [ ] Tablet layout: collapsed sidebar, sheet nav
- [ ] Accessibility: alt text, aria-labels, form labels
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- [ ] Clipboard paste for images in SubmissionForm

### Day 11 (Apr 27) — Demo Prep
- [ ] Seed 2 test accounts (coordinator + volunteer) via Firebase console
- [ ] Test full flow: submission → review → publish → assignment email → accept → complete
<<<<<<< HEAD
- [ ] Record screen: show PriorityScore tooltip, then MatchScore tooltip, then team-of-3 assignment
- [ ] Fix any broken Firestore listeners (confirm status updates appear without refresh)
=======
- [ ] Record screen: PriorityScore tooltip, MatchScore tooltip, team-of-3 assignment
- [ ] Fix any broken Firestore listeners
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
- [ ] Final mobile/tablet check

---

## Appendix A: Key shadcn/ui Commands

```bash
<<<<<<< HEAD
# Init shadcn/ui
npx shadcn@latest init

# Add all required components in one shot
=======
npx shadcn@latest init

>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
npx shadcn@latest add button card dialog input label select textarea badge \
  table tabs skeleton toast tooltip popover dropdown-menu sheet separator progress
```

## Appendix B: Leaflet Setup (SSR-safe)

```tsx
// components/dashboard/needs-heatmap.tsx
'use client';
import dynamic from 'next/dynamic';

<<<<<<< HEAD
// Leaflet must be loaded client-side only (no SSR)
=======
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
const MapContainer = dynamic(
  () => import('react-leaflet').then(m => m.MapContainer),
  { ssr: false }
);
<<<<<<< HEAD
// Same pattern for all react-leaflet components
```

Also add to `globals.css`:
=======
```

Add to `globals.css`:
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```css
@import 'leaflet/dist/leaflet.css';
```

<<<<<<< HEAD
Fix Leaflet's broken default icon in Next.js:
=======
Fix broken default icon in Next.js:
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
```ts
// lib/utils/leaflet-fix.ts (import once in the map component)
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
L.Marker.prototype.options.icon = L.icon({ iconUrl: icon.src, shadowUrl: iconShadow.src });
```

## Appendix C: Environment Variables

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

## Appendix D: TypeScript Types Reference

```ts
<<<<<<< HEAD
// lib/types/api.ts (abbreviated)
export type Role = 'volunteer' | 'coordinator' | 'admin';
export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type NeedStatus = 'pending_review' | 'published' | 'matching_complete' |
                         'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type AssignmentStatus = 'pending_accept' | 'accepted' | 'declined' |
                                'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'expired';

export interface Need {
  id: string;
  title: string;
  description: string;
  description_original?: string;
  original_language?: string;
  need_type: string;
  category?: string;
  urgency: Urgency;
  priority_score: number;
  priority_breakdown: PriorityBreakdown;
  location: { lat: number; lng: number; text: string };
  beneficiary_count: number;
  required_skills: string[];
  required_team_size: number;
  resources_needed: string[];
  deadline?: string;
  window_start?: string;
  window_end?: string;
  status: NeedStatus;
  created_at: string;
}

export interface PriorityBreakdown {
  urgency_component: number;
  severity_component: number;
  beneficiary_component: number;
  time_pressure_component: number;
=======
// lib/types/api.ts
export type Role     = 'volunteer' | 'coordinator' | 'admin';
export type Urgency  = 'critical' | 'high' | 'medium' | 'low';
export type NeedStatus =
  'pending_review' | 'published' | 'matching_complete' |
  'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'expired';
export type AssignmentStatus =
  'pending_accept' | 'accepted' | 'declined' |
  'in_progress' | 'completed' | 'cancelled' | 'no_show' | 'expired';

export interface Need {
  id: string; title: string; description: string;
  description_original?: string; original_language?: string;
  need_type: string; category?: string;
  urgency: Urgency; priority_score: number;
  priority_breakdown: PriorityBreakdown;
  location: { lat: number; lng: number; text: string };
  beneficiary_count: number; required_skills: string[];
  required_team_size: number; resources_needed: string[];
  deadline?: string; window_start?: string; window_end?: string;
  status: NeedStatus; created_at: string;
}

export interface PriorityBreakdown {
  urgency_component: number; severity_component: number;
  beneficiary_component: number; time_pressure_component: number;
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  resource_difficulty_component: number;
}

export interface Assignment {
<<<<<<< HEAD
  id: string;
  need_id: string;
  need: Pick<Need, 'id' | 'title' | 'location' | 'urgency' | 'deadline'>;
  volunteer_id: string;
  role_in_team: string;
  match_score: number;
  match_breakdown: MatchBreakdown;
  status: AssignmentStatus;
  assigned_at: string;
  accept_deadline: string;
  completion_notes?: string;
  completion_photo_urls?: string[];
}

export interface MatchBreakdown {
  similarity: number;
  location_score: number;
  reliability: number;
  experience: number;
  recency_penalty: number;
}

export interface VolunteerProfile {
  user_id: string;
  skills: string[];
  certifications?: string[];
  home_address?: string;
  max_travel_km: number;
  verified: boolean;
  reliability_score: number;
  total_tasks_completed: number;
=======
  id: string; need_id: string;
  need: Pick<Need, 'id' | 'title' | 'location' | 'urgency' | 'deadline'>;
  volunteer_id: string; role_in_team: string;
  match_score: number; match_breakdown: MatchBreakdown;
  status: AssignmentStatus; assigned_at: string; accept_deadline: string;
  completion_notes?: string; completion_photo_urls?: string[];
}

export interface MatchBreakdown {
  similarity: number; location_score: number;
  reliability: number; experience: number; recency_penalty: number;
}

export interface VolunteerProfile {
  user_id: string; skills: string[]; certifications?: string[];
  home_address?: string; max_travel_km: number; verified: boolean;
  reliability_score: number; total_tasks_completed: number;
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  notification_prefs: { email: boolean; in_app: boolean };
  preferred_language: 'en' | 'hi' | 'gu';
}

export interface DashboardData {
<<<<<<< HEAD
  open_needs_count: number;
  critical_needs_count: number;
  pending_review_count: number;
  active_volunteers: number;
  avg_response_time_minutes: number;
  beneficiaries_served_this_week: number;
=======
  open_needs_count: number; critical_needs_count: number;
  pending_review_count: number; active_volunteers: number;
  avg_response_time_minutes: number; beneficiaries_served_this_week: number;
>>>>>>> 62f208545f6ce943986b54e74e7e7ee874d9f2e7
  heatmap: { lat: number; lng: number; count: number }[];
}
```
