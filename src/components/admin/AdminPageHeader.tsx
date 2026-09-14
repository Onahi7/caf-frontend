import type { ReactNode } from 'react';

interface AdminPageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function AdminPageHeader({ title, subtitle, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-400 leading-normal">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
