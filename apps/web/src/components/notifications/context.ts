import { createContext, useContext } from 'react';
import type { NotificationCenter } from './notification-center';

export const NotificationContext = createContext<NotificationCenter | null>(
  null,
);
export const useNotifications = () => useContext(NotificationContext);
