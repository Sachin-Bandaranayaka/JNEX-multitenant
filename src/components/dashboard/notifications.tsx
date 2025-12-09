'use client';

import { Popover, Transition } from '@headlessui/react';
import { BellIcon } from '@heroicons/react/24/outline';
import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';

type Notification = {
    id: string;
    title: string;
    description: string;
    type: string;
    read: boolean;
    createdAt: string;
    orderId?: string;
};

export function Notifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNotifications();
        // Poll every minute
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, read: true } : n))
            );
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true }),
            });
            setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            await markAsRead(notification.id);
        }
        if (notification.orderId) {
            router.push(`/dashboard/orders/${notification.orderId}`);
        }
    };

    const unreadCount = notifications.filter((n) => !n.read).length;

    return (
        <Popover className="relative">
            {({ open }) => (
                <>
                    <Popover.Button
                        className={`
                relative rounded-full p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors focus:outline-none
                ${open ? 'bg-accent text-foreground' : ''}
            `}
                    >
                        <BellIcon className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-background" />
                        )}
                    </Popover.Button>
                    <Transition
                        as={Fragment}
                        enter="transition ease-out duration-200"
                        enterFrom="opacity-0 translate-y-1"
                        enterTo="opacity-100 translate-y-0"
                        leave="transition ease-in duration-150"
                        leaveFrom="opacity-100 translate-y-0"
                        leaveTo="opacity-0 translate-y-1"
                    >
                        <Popover.Panel className="absolute right-0 z-10 mt-2 w-80 transform px-4 sm:px-0">
                            <div className="overflow-hidden rounded-lg shadow-lg ring-1 ring-black/5">
                                <div className="bg-background p-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-sm font-medium text-foreground">Notifications</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-muted-foreground">{unreadCount} unread</span>
                                            {unreadCount > 0 && (
                                                <button
                                                    onClick={markAllAsRead}
                                                    className="text-xs text-primary hover:underline"
                                                >
                                                    Mark all read
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-1 max-h-[300px] overflow-y-auto">
                                        {loading ? (
                                            <p className="text-xs text-center text-muted-foreground py-4">Loading...</p>
                                        ) : notifications.length === 0 ? (
                                            <p className="text-xs text-center text-muted-foreground py-4">No notifications</p>
                                        ) : (
                                            notifications.map((notification) => (
                                                <button
                                                    key={notification.id}
                                                    onClick={() => handleNotificationClick(notification)}
                                                    className={`w-full text-left flex items-start gap-3 p-2 rounded-md transition-colors hover:bg-accent/50 ${!notification.read ? 'bg-accent/20' : ''}`}
                                                >
                                                    <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${!notification.read ? 'bg-blue-500' : 'bg-transparent'}`} />
                                                    <div>
                                                        <p className={`text-sm ${!notification.read ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>{notification.title}</p>
                                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.description}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1">
                                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                                        </p>
                                                    </div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Popover.Panel>
                    </Transition>
                </>
            )}
        </Popover>
    );
}
