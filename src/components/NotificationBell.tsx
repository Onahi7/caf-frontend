import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  Bell,
  CheckCheck,
  BellOff,
  X,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { useNotificationStore } from '../stores/notification-store';
import { useAuthStore } from '../stores/auth-store';
import { notificationsApi, type AppNotification } from '../lib/notifications-api';

const severityConfig: Record<
  string,
  { bg: string; border: string; text: string; Icon: typeof Info }
> = {
  info: {
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
    text: 'text-sky-400',
    Icon: Info,
  },
  warning: {
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    Icon: AlertTriangle,
  },
  error: {
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    Icon: AlertCircle,
  },
  critical: {
    bg: 'bg-red-500/20',
    border: 'border-red-500/40',
    text: 'text-red-400',
    Icon: ShieldAlert,
  },
};

function timeAgo(iso: string): string {
  try {
    const date = new Date(iso);
    const diff = Date.now() - date.getTime();
    if (diff < 0 || Number.isNaN(diff)) return '';
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    if (d < 7) return `${d}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

export const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { unreadCount, hasNew, increment, setUnreadCount, clearHasNew } = useNotificationStore();

  const { data: notifications } = useQuery({
    queryKey: ['notifications', 'list', open ? 50 : 0],
    queryFn: () => notificationsApi.list({ limit: 50 }),
    enabled: isAuthenticated && open,
    refetchInterval: open ? 30_000 : false,
  });

  // Poll unread count every 60s
  useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const count = await notificationsApi.unreadCount();
      setUnreadCount(count);
      return count;
    },
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  // Listen for new notifications via custom event dispatched from useWebSocket
  useEffect(() => {
    const onNew = () => increment();
    window.addEventListener('app:notification-new', onNew as EventListener);
    return () => window.removeEventListener('app:notification-new', onNew as EventListener);
  }, [increment]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        clearHasNew();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, clearHasNew]);

  const handleClickItem = useCallback(
    (n: AppNotification) => {
      if (!n.read) markReadMutation.mutate(n._id);
      if (n.link) {
        setOpen(false);
        clearHasNew();
        navigate(n.link);
      }
    },
    [markReadMutation, navigate, clearHasNew],
  );

  return (
    <div className="relative">
      <button
        id="notification-bell-button"
        ref={buttonRef}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) clearHasNew();
        }}
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border bg-slate-800/80 backdrop-blur-md transition-all shadow-sm ${
          open
            ? 'border-emerald-500/40 text-emerald-400 bg-slate-800'
            : 'border-white/[0.08] text-slate-300 hover:border-emerald-500/30 hover:text-emerald-400'
        }`}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className={`h-4.5 w-4.5 ${hasNew ? 'animate-bounce text-emerald-400' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-slate-900">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/80 backdrop-blur-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-slate-950/40 px-4 py-3.5">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Notifications</h3>
              {unreadCount > 0 ? (
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 border border-emerald-500/30">
                  {unreadCount} new
                </span>
              ) : (
                <span className="text-xs text-slate-400">All caught up</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-[28rem] overflow-y-auto divide-y divide-white/[0.04]">
            {!notifications || notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <BellOff className="h-9 w-9 mx-auto mb-2.5 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No notifications</p>
                <p className="text-xs text-slate-500 mt-0.5">We'll alert you when important events occur.</p>
              </div>
            ) : (
              notifications.map((n) => {
                const config = severityConfig[n.severity] ?? severityConfig.info;
                const IconComponent = config.Icon;
                return (
                  <div
                    key={n._id}
                    onClick={() => handleClickItem(n)}
                    className={`group relative flex items-start gap-3 p-3.5 cursor-pointer transition-colors hover:bg-white/[0.04] ${
                      !n.read ? 'bg-emerald-500/[0.03]' : ''
                    }`}
                  >
                    {!n.read && (
                      <span className="absolute left-1.5 top-4 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-emerald-400/20" />
                    )}
                    <div
                      className={`shrink-0 flex h-8 w-8 items-center justify-center rounded-xl ${config.bg} ${config.text} ${config.border}`}
                    >
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white truncate">{n.title}</p>
                        <span className="text-[10px] font-medium text-slate-400 shrink-0">
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300 mt-0.5 whitespace-normal break-words">
                        {n.message}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMutation.mutate(n._id);
                      }}
                      className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors opacity-80 sm:opacity-0 sm:group-hover:opacity-100"
                      title="Dismiss notification"
                      aria-label="Dismiss notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
