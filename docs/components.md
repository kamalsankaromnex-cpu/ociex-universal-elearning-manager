# Shared component usage

Admin colors, spacing and type styles live in `src/app/globals.css`. Color tokens are CSS variables. The shadcn/ui Button composition uses Radix Slot (`asChild`), `cva`, `clsx` and `tailwind-merge`; dialogs, tabs and drawers use Radix for focus management, semantics, keyboard support and Escape handling. Inter is bundled locally.

```tsx
import { Button, SecondaryButton, TextField, PageHeader, StatusBadge } from '@/components/ui';
<PageHeader title="My courses" description="Continue creating."
  actions={<Button onClick={createCourse}>Create course</Button>} />
<TextField label="Course title" value={title} onChange={e => setTitle(e.target.value)} />
<StatusBadge>Draft</StatusBadge>
```

| Component | Location / contract |
| --- | --- |
| AppShell, Sidebar, Topbar | `shell.tsx`; shared navigation, header, breadcrumbs and responsive Drawer |
| PageHeader, Breadcrumbs | `ui/index.tsx`; page heading/actions and breadcrumb navigation |
| Button / PrimaryButton, SecondaryButton, IconButton | `ui/index.tsx`; native button props; IconButton requires an accessible `label` |
| CourseCard, StatCard | `studio.tsx`, `ui/index.tsx`; dashboard content and summary |
| LevelCard, SlideCard, SlideList | `editor.tsx`; stable identity selection and ordered display |
| TextField, SelectField, ColorField | `ui/index.tsx`; accessible labels; controlled values |
| Tabs, StatusBadge | `ui/index.tsx`; controlled Radix tabs and draft badge |
| Modal, ConfirmDialog, Drawer | `ui/index.tsx`; controlled open state; focus trapping and keyboard dismissal |
| Toast, EmptyState, LoadingState, ErrorState | `ui/index.tsx`; status/alert announcements and recovery |
| EditorToolbar, PropertyPanel | `editor.tsx`; reusable action row and settings panel |
| MediaPicker, FileUpload | `ui/index.tsx`; file selection, preview/removal and size/type validation |

Learner tokens are scoped on `.learner` as `--l-*` variables. Never reference admin `--primary`, `--surface` or `--text` inside the learner renderer. Inherit course tokens when an override is absent (`slide.background === ''`). Preview game state belongs to `Learner`, not `CourseData`, the header or future maps.
