"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Eye,
  GraduationCap,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Palette,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import { AppShell } from "./shell";
import {
  Button,
  SecondaryButton,
  IconButton,
  PageHeader,
  StatCard,
  StatusBadge,
  TextField,
  SelectField,
  Modal,
  ConfirmDialog,
  Toast,
  EmptyState,
  LoadingState,
  ErrorState,
} from "./ui";
import { type CourseData, newCourse, presets } from "@/lib/course";
import { CourseEditor } from "./editor";
import { Learner } from "./learner";
type RecordCourse = {
  id: string;
  title: string;
  data: CourseData;
  revision: number;
  updatedAt: string;
};
async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok)
    throw new Error(data.error || "Something went wrong. Please try again.");
  return data;
}
export function CourseCard({
  course,
  onEdit,
  onPreview,
  onDelete,
}: {
  course: RecordCourse;
  onEdit: () => void;
  onPreview: () => void;
  onDelete: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const count = course.data.levels.reduce((n, l) => n + l.slides.length, 0);
  return (
    <article className="course-card">
      <div
        className="course-cover"
        style={{ "--cover": course.data.theme.primary } as React.CSSProperties}
      >
        <div className="cover-grid" />
        <div className="cover-orbit orbit-one" />
        <div className="cover-orbit orbit-two" />
        <span className="cover-label">
          <Layers />
          LEARNING EXPERIENCE
        </span>
        <div className="cover-content">
          <small>BUILT TO INSPIRE</small>
          <strong>{course.data.header.title || course.title}</strong>
          <span>
            {course.data.header.subtitle || "YOUR LEARNING JOURNEY"}
            <ArrowUpRight />
          </span>
        </div>
        <span className="cover-symbol">
          <ShieldCheck />
        </span>
        <span className="cover-status">
          <StatusBadge>Draft</StatusBadge>
        </span>
      </div>
      <div className="course-info">
        <div className="course-title">
          <h3>{course.title}</h3>
          <div className="card-menu">
            <IconButton
              label={`Actions for ${course.title}`}
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal />
            </IconButton>
            {menu && (
              <div className="dropdown">
                <button
                  onClick={() => {
                    setMenu(false);
                    onEdit();
                  }}
                >
                  Edit course
                </button>
                <button
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    onDelete();
                  }}
                >
                  Delete course
                </button>
              </div>
            )}
          </div>
        </div>
        <p>
          {course.data.description ||
            "Your next great learning experience starts here."}
        </p>
        <div className="course-meta">
          <span>
            <Layers />
            {course.data.levels.length}{" "}
            {course.data.levels.length === 1 ? "level" : "levels"}
          </span>
          <span>
            <BookOpen />
            {count} slides
          </span>
          <span>
            <Clock3 />
            {Math.max(1, count * 2)} min
          </span>
        </div>
        <div className="course-updated">
          Edited{" "}
          {new Date(course.updatedAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Calcutta",
          })}
        </div>
        <div className="course-card-actions">
          <Button onClick={onEdit}>
            Open course
            <ArrowRight />
          </Button>
          <IconButton label={`Preview ${course.title}`} onClick={onPreview}>
            <Eye />
          </IconButton>
        </div>
      </div>
    </article>
  );
}
export function Studio() {
  const [admin, setAdmin] = useState<{ email: string } | null>(null),
    [authLoading, setAuthLoading] = useState(true),
    [courses, setCourses] = useState<RecordCourse[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [page, setPage] = useState("courses"),
    [selected, setSelected] = useState<RecordCourse | null>(null),
    [preview, setPreview] = useState<CourseData | null>(null),
    [create, setCreate] = useState(false),
    [title, setTitle] = useState(""),
    [search, setSearch] = useState(""),
    [sort, setSort] = useState("recent"),
    [deleting, setDeleting] = useState<RecordCourse | null>(null),
    [busy, setBusy] = useState(false);
  const notify = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(""), 4500);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCourses(await api("/api/courses"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    api("/api/auth")
      .then((d) => setAdmin(d.admin))
      .catch((e) => setError(e.message))
      .finally(() => setAuthLoading(false));
  }, []);
  useEffect(() => {
    if (admin) load();
  }, [admin, load]);
  function navigate(p: string) {
    if (
      selected &&
      !window.confirm(
        "Return to the dashboard? Any unsaved changes will be lost.",
      )
    )
      return;
    setSelected(null);
    setPage(p);
    setError("");
  }
  async function save(data: CourseData) {
    if (!selected) return false;
    try {
      const updated = await api(`/api/courses/${selected.id}`, "PUT", {
        data,
        revision: selected.revision,
      });
      setSelected(updated);
      setCourses((c) => c.map((x) => (x.id === updated.id ? updated : x)));
      notify("Course saved successfully");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  if (authLoading) return <LoadingState />;
  if (!admin)
    return (
      <Login
        onLogin={async () => {
          const d = await api("/api/auth");
          setAdmin(d.admin);
          setError("");
        }}
        initialError={error}
      />
    );
  const filtered = courses
    .filter((c) => c.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === "name"
        ? a.title.localeCompare(b.title)
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  const levels = courses.reduce((n, c) => n + c.data.levels.length, 0),
    slides = courses.reduce(
      (n, c) => n + c.data.levels.reduce((k, l) => k + l.slides.length, 0),
      0,
    );
  return (
    <>
      {preview && (
        <Learner
          key={preview.title}
          course={preview}
          onClose={() => setPreview(null)}
        />
      )}
      <div hidden={!!preview}>
        <AppShell
          email={admin.email}
          active={page}
          onNavigate={navigate}
          onLogout={async () => {
            try {
              await api("/api/auth", "DELETE");
              setAdmin(null);
              setCourses([]);
              setSelected(null);
            } catch (e) {
              setError((e as Error).message);
            }
          }}
          crumb={
            selected?.title ||
            (page === "themes"
              ? "Theme library"
              : page === "guide"
                ? "Getting started"
                : undefined)
          }
        >
          {error && <ErrorState message={error} retry={() => setError("")} />}{" "}
          {selected ? (
            <CourseEditor
              key={selected.id}
              initial={selected.data}
              onBack={() => {
                setSelected(null);
                load();
              }}
              onSave={save}
              onPreview={setPreview}
              onError={setError}
            />
          ) : page === "courses" ? (
            <>
              <PageHeader
                eyebrow="CREATE. INSPIRE. EMPOWER."
                title="Your courses"
                description="A home for every learning experience you create."
                actions={
                  <Button
                    onClick={() => {
                      setTitle("");
                      setCreate(true);
                    }}
                  >
                    <Plus />
                    Create course
                  </Button>
                }
              />
              <section className="welcome-banner">
                <div className="banner-copy">
                  <span className="banner-kicker">
                    <span />
                    YOUR NEXT CHAPTER STARTS HERE
                  </span>
                  <h2>
                    Great learning starts
                    <br />
                    with a little possibility.
                  </h2>
                  <p>
                    Build engaging courses, bring your ideas to life,
                    <br className="desktop-break" /> and make every learning
                    moment count.
                  </p>
                  <button onClick={() => setPage("guide")}>
                    Let’s build something meaningful
                    <ArrowRight />
                  </button>
                </div>
                <div className="banner-art" aria-hidden="true">
                  <div className="art-grid" />
                  <div className="art-orbit" />
                  <div className="art-card art-card-back">
                    <div />
                    <div />
                    <div />
                  </div>
                  <div className="art-card art-card-front">
                    <div className="art-card-header">
                      <span>
                        <GraduationCap />
                      </span>
                      <i />
                      <i />
                    </div>
                    <div className="art-lines">
                      <i />
                      <i />
                    </div>
                    <div className="art-blocks">
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className="art-progress">
                      <i />
                    </div>
                  </div>
                  <span className="art-badge badge-spark">
                    <Sparkles />
                  </span>
                  <span className="art-badge badge-check">
                    <CheckCircle2 />
                  </span>
                  <span className="art-caption">
                    <span />
                    Ideas into impact
                  </span>
                </div>
              </section>
              <section className="stats">
                <StatCard
                  label="Total courses"
                  value={String(courses.length).padStart(2, "0")}
                  icon={<BookOpen />}
                  foot="Your growing learning library"
                />
                <StatCard
                  label="Learning levels"
                  value={String(levels).padStart(2, "0")}
                  icon={<Layers />}
                  foot="Structured for discovery"
                />
                <StatCard
                  label="Interactive slides"
                  value={String(slides).padStart(2, "0")}
                  icon={<GraduationCap />}
                  foot="Moments that make an impact"
                />
              </section>
              <div className="library-heading">
                <div>
                  <h2>
                    Course library <span>{courses.length}</span>
                  </h2>
                  <p>Pick up where you left off, or start something new.</p>
                </div>
                <div className="library-tools">
                  <label className="search">
                    <Search />
                    <input
                      aria-label="Search courses"
                      placeholder="Search courses…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <SelectField
                    label="Sort courses"
                    aria-label="Sort courses"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="recent">Recently edited</option>
                    <option value="name">Name A–Z</option>
                  </SelectField>
                </div>
              </div>
              {loading ? (
                <LoadingState />
              ) : (
                <div className="course-grid">
                  {filtered.map((c) => (
                    <CourseCard
                      key={c.id}
                      course={c}
                      onEdit={() => setSelected(c)}
                      onPreview={() => setPreview(c.data)}
                      onDelete={() => setDeleting(c)}
                    />
                  ))}
                  {!search && (
                    <button
                      className="new-course-card"
                      onClick={() => {
                        setTitle("");
                        setCreate(true);
                      }}
                    >
                      <span>
                        <Plus />
                      </span>
                      <strong>Bring a new idea to life</strong>
                      <p>A blank canvas. Endless possibilities.</p>
                      <small>
                        Create a new course
                        <ArrowRight />
                      </small>
                    </button>
                  )}
                  {search && !filtered.length && (
                    <EmptyState
                      title="No courses found"
                      description="Try a different course name."
                    />
                  )}
                </div>
              )}
              <div className="workspace-note">
                <span>
                  <ShieldCheck />
                </span>
                <p>
                  <strong>Your ideas, safely saved.</strong> Course content is
                  stored in your workspace. Open any course to continue
                  creating.
                </p>
                <span className="note-tag">BUILT FOR WHAT’S NEXT</span>
              </div>
            </>
          ) : page === "themes" ? (
            <>
              <PageHeader
                eyebrow="MAKE IT YOURS"
                title="Theme library"
                description="Independent learner themes. One consistent authoring experience."
              />
              <div className="notice">
                Both presets are provisional. Confirm colors against corporate
                brand standards before publishing.
              </div>
              <div className="preset-library">
                {Object.entries(presets).map(([name, t]) => (
                  <section className="property-panel" key={name}>
                    <div
                      className="preset-preview"
                      style={{ background: t.header }}
                    >
                      <Palette />
                      <h2>{name}</h2>
                    </div>
                    <div className="swatches">
                      {[t.header, t.primary, t.background, t.life].map(
                        (c, i) => (
                          <span key={i} style={{ background: c }} title={c} />
                        ),
                      )}
                    </div>
                    <p>
                      Apply this preset from any course’s Theme manager.
                      Customize colors, typography, header and imagery for that
                      course.
                    </p>
                    <SecondaryButton onClick={() => setPage("courses")}>
                      Choose a course
                      <ArrowRight />
                    </SecondaryButton>
                  </section>
                ))}
              </div>
            </>
          ) : (
            <>
              <PageHeader
                eyebrow="YOUR CREATOR TOOLKIT"
                title="From an idea to an experience"
                description="Everything you need for your first course, one step at a time."
              />
              <div className="guide-grid">
                {[
                  {
                    n: "01",
                    title: "Create your course",
                    text: "Give your course a name. Add levels to organize the learning journey and use the arrow controls to reorder them.",
                  },
                  {
                    n: "02",
                    title: "Build meaningful slides",
                    text: "Add text and upload images. Choose a single-choice slide for an interaction, then configure options and feedback.",
                  },
                  {
                    n: "03",
                    title: "Make it your own",
                    text: "Open Theme manager to customize the learner palette and fonts. Slide background overrides remain independent.",
                  },
                  {
                    n: "04",
                    title: "Save, reopen, explore",
                    text: "Save your changes, return to your library, and reopen your course. Preview starts with 100% life; the first wrong answer per question costs 25%.",
                  },
                ].map((s) => (
                  <section className="property-panel" key={s.n}>
                    <span className="guide-number">{s.n}</span>
                    <h2>{s.title}</h2>
                    <p>{s.text}</p>
                  </section>
                ))}
              </div>
              <div className="notice">
                Phase 1 includes content, theme editing and temporary learner
                preview. SCORM publishing, advanced canvas editing, recovery,
                stars and course maps are future milestones.
              </div>
              <Button onClick={() => setPage("courses")}>
                Go to your courses
                <ArrowRight />
              </Button>
            </>
          )}
          <Modal
            open={create}
            onOpenChange={setCreate}
            title="Create a new course"
            description="Start with a name. Your content and theme can evolve as you build."
          >
            {error && <ErrorState message={error} />}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const c = await api("/api/courses", "POST", newCourse(title));
                  setCourses((x) => [c, ...x]);
                  setCreate(false);
                  setSelected(c);
                  notify("Your new course is ready");
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <TextField
                label="Course name"
                placeholder="e.g. Workplace essentials"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={160}
                autoFocus
              />
              <div className="actions">
                <SecondaryButton type="button" onClick={() => setCreate(false)}>
                  Cancel
                </SecondaryButton>
                <Button disabled={busy || !title.trim()} type="submit">
                  <Plus />
                  {busy ? "Creating…" : "Create course"}
                </Button>
              </div>
            </form>
          </Modal>
          <ConfirmDialog
            open={!!deleting}
            onOpenChange={(v) => {
              if (!v) setDeleting(null);
            }}
            title={`Delete ${deleting?.title || "course"}?`}
            onConfirm={async () => {
              if (!deleting) return;
              try {
                await api(`/api/courses/${deleting.id}`, "DELETE");
                setCourses((c) => c.filter((x) => x.id !== deleting.id));
                notify("Course deleted");
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Toast message={toast} />
        </AppShell>
      </div>
    </>
  );
}
function Login({
  onLogin,
  initialError,
}: {
  onLogin: () => Promise<void>;
  initialError: string;
}) {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [error, setError] = useState(initialError),
    [busy, setBusy] = useState(false);
  return (
    <div className="login-page">
      <div className="login-brand">
        <Layers />
        coursecraft
      </div>
      <section className="login-story">
        <span className="eyebrow">LEARNING, WITH POSSIBILITY.</span>
        <h1>
          Big ideas.
          <br />
          Lasting impact.
        </h1>
        <p>Your studio for learning experiences that move people forward.</p>
        <div className="login-art">
          <GraduationCap />
        </div>
        <span className="login-foot">COURSECRAFT STUDIO · PHASE 1</span>
      </section>
      <section className="login-form">
        <span className="login-icon">
          <BookOpen />
        </span>
        <h2>Welcome to your studio</h2>
        <p>Sign in to create your next learning experience.</p>
        {error && <ErrorState message={error} />}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await api("/api/auth", "POST", { email, password });
              await onLogin();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <TextField
            label="Email address"
            type="email"
            autoComplete="username"
            placeholder="you@organization.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to your workspace"}
            <ArrowRight />
          </Button>
        </form>
        <p className="login-security">
          <ShieldCheck />
          Secure administrator access
        </p>
      </section>
    </div>
  );
}
