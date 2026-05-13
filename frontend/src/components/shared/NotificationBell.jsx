import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { relativeTime, cn } from '@/lib/utils';

export function NotificationBell({ audience }) {
  const [open, setOpen] = useState(false);
  const base = audience === 'admin' ? '/admin' : '/partner';
  const qc = useQueryClient();

  const { data: unread } = useQuery({
    queryKey: ['notifications-unread', audience],
    queryFn: () => api.get(`${base}/notifications/unread-count`),
    refetchInterval: 60_000,
  });

  const { data: list } = useQuery({
    queryKey: ['notifications-list', audience],
    queryFn: () => api.get(`${base}/notifications?pageSize=10`),
    enabled: open,
  });

  const count = unread?.count || 0;

  async function markAll() {
    await api.patch(`${base}/notifications/read-all`);
    qc.invalidateQueries({ queryKey: ['notifications-unread'] });
    qc.invalidateQueries({ queryKey: ['notifications-list'] });
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="size-10 rounded-xl hover:bg-white transition flex items-center justify-center text-smoke relative"
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute top-1 right-1 size-4 rounded-full bg-harvest-400 text-[10px] font-bold text-forest-800 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-elev border border-whisper/60 z-20 animate-fade-in overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-whisper/60">
              <p className="font-display text-base font-semibold">Notifications</p>
              {count > 0 && (
                <button onClick={markAll} className="text-xs text-forest-500 hover:text-forest-700 font-medium">
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-whisper/40">
              {(list || []).length === 0 && (
                <p className="px-4 py-8 text-sm text-smoke text-center">You're all caught up</p>
              )}
              {(list || []).map((n) => (
                <div key={n.id} className={cn('px-4 py-3', !n.is_read && 'bg-forest-50/40')}>
                  <div className="flex items-start gap-3">
                    <div className={cn('size-2 rounded-full mt-2', !n.is_read ? 'bg-forest-500' : 'bg-transparent')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink">{n.title}</p>
                      <p className="text-sm text-smoke line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-smoke mt-1">{relativeTime(n.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
