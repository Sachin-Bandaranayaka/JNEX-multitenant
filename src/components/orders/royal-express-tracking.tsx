'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow } from 'date-fns';
import {
    CheckCircleIcon,
    TruckIcon,
    MapPinIcon,
    ClockIcon,
    UserIcon,
    BuildingOfficeIcon,
    ExclamationTriangleIcon,
    ArrowPathIcon,
    InformationCircleIcon
} from '@heroicons/react/24/outline';

interface RoyalExpressTrackingProps {
    orderId: string;
    trackingNumber: string;
}

interface TrackingEvent {
    status: {
        name: string;
        color: string;
        icon: string;
    };
    date_time: string;
    date_time_ago: string;
    user: {
        first_name: string;
        last_name?: string;
        reference_id: string;
    };
    'Assigned Rider'?: string;
    'Returned Branch'?: string;
    'Received Branch'?: string;
    Reason?: string;
}

interface TrackingData {
    data: TrackingEvent[];
}

const getStatusIcon = (iconName: string, color: string) => {
    const iconClass = `w-6 h-6 ${color === 'success' ? 'text-emerald-600 dark:text-emerald-400' :
            color === 'info' ? 'text-blue-600 dark:text-blue-400' :
                color === 'warning' ? 'text-amber-600 dark:text-amber-400' :
                    color === 'primary' ? 'text-primary' :
                        'text-muted-foreground'
        }`;

    switch (iconName) {
        case 'CheckIcon':
        case 'CheckSquareIcon':
            return <CheckCircleIcon className={iconClass} />;
        case 'TruckIcon':
            return <TruckIcon className={iconClass} />;
        case 'NavigationIcon':
            return <MapPinIcon className={iconClass} />;
        case 'RepeatIcon':
            return <ArrowPathIcon className={iconClass} />;
        case 'GitBranchIcon':
        case 'GitPullRequestIcon':
            return <BuildingOfficeIcon className={iconClass} />;
        case 'CornerDownLeftIcon':
            return <ArrowPathIcon className={iconClass} />;
        default:
            return <ClockIcon className={iconClass} />;
    }
};

const getStatusBadgeColor = (color: string) => {
    switch (color) {
        case 'success':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
        case 'info':
            return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
        case 'warning':
            return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
        case 'primary':
            return 'bg-primary/10 text-primary border-primary/20';
        default:
            return 'bg-muted text-muted-foreground border-border';
    }
};

export function RoyalExpressTracking({ orderId, trackingNumber }: RoyalExpressTrackingProps) {
    const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const fetchTrackingData = async () => {
        try {
            const response = await fetch(`/api/orders/${orderId}/tracking`);
            if (!response.ok) {
                throw new Error('Failed to fetch tracking data');
            }
            const data = await response.json();
            setTrackingData(data);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch tracking data');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTrackingData();
    }, [orderId]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchTrackingData();
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-6 bg-muted rounded w-48 animate-pulse"></div>
                    <div className="h-8 bg-muted rounded w-24 animate-pulse"></div>
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-start space-x-4 p-4 bg-card rounded-lg border border-border animate-pulse">
                            <div className="w-6 h-6 bg-muted rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-muted rounded w-3/4"></div>
                                <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4">
                <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-destructive" />
                    <span className="text-destructive font-medium">Error loading tracking data</span>
                </div>
                <p className="text-destructive/80 text-sm mt-2">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="mt-3 px-3 py-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground text-sm rounded transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!trackingData?.data?.length) {
        return (
            <div className="rounded-lg bg-muted/30 border border-border p-6 text-center">
                <InformationCircleIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-foreground">No tracking information available</p>
                <p className="text-muted-foreground text-sm mt-1">Tracking data will appear here once the shipment is processed</p>
            </div>
        );
    }

    const currentStatus = trackingData.data[0];
    const isDelivered = currentStatus?.status?.name === 'DELIVERED';

    return (
        <div className="space-y-6">
            {/* Header with current status */}
            <div className="rounded-xl bg-gradient-to-r from-primary/10 to-purple-500/10 border border-primary/20 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-background shadow-sm">
                            {getStatusIcon(currentStatus.status.icon, currentStatus.status.color)}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-foreground">Royal Express Tracking</h3>
                            <p className="text-primary text-sm font-medium">#{trackingNumber}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center space-x-2 px-3 py-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm rounded-lg transition-colors shadow-sm"
                    >
                        <ArrowPathIcon className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusBadgeColor(currentStatus.status.color)}`}>
                            {currentStatus.status.name}
                        </span>
                        <p className="text-muted-foreground text-sm mt-2">
                            Last updated {currentStatus.date_time_ago}
                        </p>
                    </div>
                    {isDelivered && (
                        <div className="text-right">
                            <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400">
                                <CheckCircleIcon className="w-5 h-5" />
                                <span className="font-medium">Delivered</span>
                            </div>
                            <p className="text-emerald-600/80 dark:text-emerald-400/80 text-sm">
                                {format(new Date(currentStatus.date_time), 'PPp')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Timeline */}
            <div className="space-y-4">
                <h4 className="text-lg font-medium text-foreground flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5 text-primary" />
                    <span>Tracking Timeline</span>
                </h4>

                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-purple-500 to-muted-foreground/20"></div>

                    <div className="space-y-6">
                        <AnimatePresence>
                            {trackingData.data.map((event, index) => (
                                <motion.div
                                    key={index}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.1 }}
                                    className="relative flex items-start space-x-4"
                                >
                                    {/* Timeline dot */}
                                    <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 shadow-sm ${index === 0
                                            ? 'bg-background border-primary'
                                            : 'bg-muted border-border'
                                        }`}>
                                        {getStatusIcon(event.status.icon, event.status.color)}
                                    </div>

                                    {/* Event content */}
                                    <div className="flex-1 min-w-0 pb-6">
                                        <div className="rounded-xl bg-card border border-border p-4 hover:border-primary/30 transition-colors shadow-sm">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="text-foreground font-medium text-lg">
                                                        {event.status.name}
                                                    </h5>
                                                    <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                                                        <span className="flex items-center space-x-1">
                                                            <ClockIcon className="w-4 h-4" />
                                                            <span>{format(new Date(event.date_time), 'PPp')}</span>
                                                        </span>
                                                        <span>({event.date_time_ago})</span>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(event.status.color)}`}>
                                                    {event.status.color}
                                                </span>
                                            </div>

                                            {/* Additional details */}
                                            <div className="space-y-2">
                                                {event.user && (
                                                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                                        <UserIcon className="w-4 h-4" />
                                                        <span>
                                                            Handled by: {event.user.first_name} {event.user.last_name || ''}
                                                            {event.user.reference_id && (
                                                                <span className="text-muted-foreground/60 ml-1">({event.user.reference_id})</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}

                                                {event['Assigned Rider'] && (
                                                    <div className="flex items-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                                                        <TruckIcon className="w-4 h-4" />
                                                        <span>Assigned Rider: {event['Assigned Rider']}</span>
                                                    </div>
                                                )}

                                                {(event['Returned Branch'] || event['Received Branch']) && (
                                                    <div className="flex items-center space-x-2 text-sm text-amber-600 dark:text-amber-400">
                                                        <BuildingOfficeIcon className="w-4 h-4" />
                                                        <span>
                                                            {event['Returned Branch'] ? 'Returned to' : 'Received at'}: {event['Returned Branch'] || event['Received Branch']}
                                                        </span>
                                                    </div>
                                                )}

                                                {event.Reason && (
                                                    <div className="flex items-start space-x-2 text-sm text-orange-600 dark:text-orange-400">
                                                        <InformationCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                                        <span>Reason: {event.Reason}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                        <ClockIcon className="w-5 h-5 text-primary" />
                        <span className="text-muted-foreground font-medium">Total Updates</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground mt-1">{trackingData.data.length}</p>
                </div>

                <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-muted-foreground font-medium">Current Status</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground mt-1">{currentStatus.status.name}</p>
                </div>

                <div className="rounded-xl bg-card border border-border p-4 shadow-sm">
                    <div className="flex items-center space-x-2">
                        <TruckIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <span className="text-muted-foreground font-medium">In Transit</span>
                    </div>
                    <p className="text-lg font-semibold text-foreground mt-1">
                        {formatDistanceToNow(new Date(trackingData.data[trackingData.data.length - 1].date_time))}
                    </p>
                </div>
            </div>
        </div>
    );
}