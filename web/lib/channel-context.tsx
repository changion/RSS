'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useMemo } from 'react';
import { api } from '@/lib/api';

export interface SubscribedChannel {
  id: string;
  channelId: string;
  status: string;
  channel: {
    id: string;
    name: string;
    description: string;
    type: string;
    status: string;
  };
}

interface ChannelContextValue {
  subscriptions: SubscribedChannel[];
  loadingSubscriptions: boolean;
  refreshSubscriptions: () => Promise<void>;
  showDiscover: boolean;
  openDiscover: () => void;
  closeDiscover: () => void;
}

const ChannelContext = createContext<ChannelContextValue>({
  subscriptions: [],
  loadingSubscriptions: false,
  refreshSubscriptions: async () => {},
  showDiscover: false,
  openDiscover: () => {},
  closeDiscover: () => {},
});

export function ChannelProvider({ children }: { children: ReactNode }) {
  const [subscriptions, setSubscriptions] = useState<SubscribedChannel[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);

  const refreshSubscriptions = useCallback(async () => {
    setLoadingSubscriptions(true);
    try {
      const res = await api.get<{ data: SubscribedChannel[] }>('/api/subscriptions/me');
      setSubscriptions(res.data);
    } catch {
      // 未登录时静默失败
    } finally {
      setLoadingSubscriptions(false);
    }
  }, []);

  const openDiscover = useCallback(() => setShowDiscover(true), []);
  const closeDiscover = useCallback(() => setShowDiscover(false), []);

  const value = useMemo(
    () => ({ subscriptions, loadingSubscriptions, refreshSubscriptions, showDiscover, openDiscover, closeDiscover }),
    [subscriptions, loadingSubscriptions, refreshSubscriptions, showDiscover, openDiscover, closeDiscover],
  );

  return (
    <ChannelContext.Provider value={value}>
      {children}
    </ChannelContext.Provider>
  );
}

export function useChannels() {
  return useContext(ChannelContext);
}
