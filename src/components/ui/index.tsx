"use client";
/* eslint-disable @next/next/no-img-element -- user-uploaded data URLs render without image optimization */
import * as Dialog from "@radix-ui/react-dialog";
import * as RadixTabs from "@radix-ui/react-tabs";
import { Button } from "./button";
import { cn } from "@/lib/utils";
export { Button, cn };
import {
  X,
  Upload,
  ImageIcon,
  Inbox,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
export const PrimaryButton = Button;
export function SecondaryButton(p: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...p} variant="secondary" />;
}
export function IconButton({
  label,
  children,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <Button
      variant="ghost"
      className="icon-btn"
      aria-label={label}
      title={label}
      {...p}
    >
      {children}
    </Button>
  );
}
export function TextField({
  label,
  ...p
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...p} />
    </label>
  );
}
export function SelectField({
  label,
  children,
  ...p
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select {...p}>{children}</select>
    </label>
  );
}
export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="color-field">
      <span>{label}</span>
      <div>
        <input
          aria-label={label}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <code>{value.toUpperCase()}</code>
      </div>
    </label>
  );
}
export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="badge">
      <span />
      {children}
    </span>
  );
}
export function Breadcrumbs({ children }: { children: ReactNode }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      {children}
    </nav>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="actions">{actions}</div>
    </div>
  );
}
export function StatCard({
  label,
  value,
  icon,
  foot,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  foot: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}
export function Tabs({
  value,
  onChange,
  items,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { value: string; label: string; icon?: ReactNode }[];
  children?: ReactNode;
}) {
  return (
    <RadixTabs.Root value={value} onValueChange={onChange}>
      <RadixTabs.List className="tabs" aria-label="Course sections">
        {items.map((i) => (
          <RadixTabs.Trigger key={i.value} value={i.value}>
            {i.icon}
            {i.label}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {items.map((item) => (
        <RadixTabs.Content
          key={item.value}
          value={item.value}
          forceMount
          hidden={item.value !== value}
        >
          {item.value === value ? children : null}
        </RadixTabs.Content>
      ))}
    </RadixTabs.Root>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="modal">
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
          {children}
          <Dialog.Close asChild>
            <IconButton label="Close dialog" className="modal-close">
              <X />
            </IconButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="This action permanently removes this content and cannot be undone."
    >
      <div className="actions">
        <SecondaryButton onClick={() => onOpenChange(false)}>
          Cancel
        </SecondaryButton>
        <Button
          variant="danger"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Delete
        </Button>
      </div>
    </Modal>
  );
}
export function Drawer({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="overlay" />
        <Dialog.Content className="drawer">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <Dialog.Description className="sr-only">
            Application navigation
          </Dialog.Description>
          {children}
          <Dialog.Close asChild>
            <IconButton label="Close navigation">
              <X />
            </IconButton>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Inbox />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function LoadingState() {
  return (
    <div className="empty" role="status">
      <LoaderCircle className="spin" />
      Loading your workspace…
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div role="alert" className="error">
      <AlertCircle />
      {message}
      {retry && <SecondaryButton onClick={retry}>Try again</SecondaryButton>}
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  return message ? (
    <div className="toast" role="status">
      <CheckCircle2 />
      {message}
    </div>
  ) : null;
}
export function FileUpload({
  label,
  onFile,
  onError,
}: {
  label: string;
  onFile: (value: string) => void;
  onError: (v: string) => void;
}) {
  return (
    <label className="upload">
      <Upload />
      {label}
      <input
        aria-label={label}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          if (
            !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
              f.type,
            ) ||
            f.size > 300000
          ) {
            onError("Use a PNG, JPEG, WebP or GIF image under 300 KB.");
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onFile(String(reader.result));
          reader.readAsDataURL(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}
export function MediaPicker({
  label,
  value,
  onChange,
  onError,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onError: (v: string) => void;
}) {
  return (
    <div className="media-picker">
      <span className="label">{label}</span>
      {value ? (
        <div className="media-thumb">
          <img src={value} alt={label} />
          <SecondaryButton onClick={() => onChange("")}>
            Remove image
          </SecondaryButton>
        </div>
      ) : (
        <div className="media-placeholder">
          <ImageIcon />
          <span>No image selected</span>
        </div>
      )}
      <FileUpload
        label={`Upload ${label.toLowerCase()}`}
        onFile={onChange}
        onError={onError}
      />
    </div>
  );
}
