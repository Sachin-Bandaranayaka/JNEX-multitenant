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
    PhoneIcon,
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
    const iconClass = `w-6 h-6 ${
        color === 'success' ? 'text-green-400' :
        color === 'info' ? 'text-blue-400' :
        color === 'warning' ? 'text-yellow-400' :
        color === 'primary' ? 'text-indigo-400' :
        'text-gray-400'
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
            return 'bg-green-900/50 text-green-300 border-green-500/30';
        case 'info':
            return 'bg-blue-900/50 text-blue-300 border-blue-500/30';
        case 'warning':
            return 'bg-yellow-900/50 text-yellow-300 border-yellow-500/30';
        case 'primary':
            return 'bg-indigo-900/50 text-indigo-300 border-indigo-500/30';
        default:
            return 'bg-gray-900/50 text-gray-300 border-gray-500/30';
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
                    <div className="h-6 bg-gray-700 rounded w-48 animate-pulse"></div>
                    <div className="h-8 bg-gray-700 rounded w-24 animate-pulse"></div>
                </div>
                <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-start space-x-4 p-4 bg-gray-800/50 rounded-lg animate-pulse">
                            <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-lg bg-red-900/20 border border-red-500/30 p-4">
                <div className="flex items-center space-x-2">
                    <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                    <span className="text-red-300 font-medium">Error loading tracking data</span>
                </div>
                <p className="text-red-400 text-sm mt-2">{error}</p>
                <button
                    onClick={handleRefresh}
                    className="mt-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (!trackingData?.data?.length) {
        return (
            <div className="rounded-lg bg-gray-800/50 border border-gray-600/30 p-6 text-center">
                <InformationCircleIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-300">No tracking information available</p>
                <p className="text-gray-500 text-sm mt-1">Tracking data will appear here once the shipment is processed</p>
            </div>
        );
    }

    const currentStatus = trackingData.data[0];
    const isDelivered = currentStatus?.status?.name === 'DELIVERED';

    return (
        <div className="space-y-6">
            {/* Header with current status */}
            <div className="rounded-lg bg-gradient-to-r from-indigo-900/20 to-purple-900/20 border border-indigo-500/30 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-full bg-indigo-600/20">
                            {getStatusIcon(currentStatus.status.icon, currentStatus.status.color)}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">Royal Express Tracking</h3>
                            <p className="text-indigo-300 text-sm">#{trackingNumber}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
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
                        <p className="text-gray-300 text-sm mt-2">
                            Last updated {currentStatus.date_time_ago}
                        </p>
                    </div>
                    {isDelivered && (
                        <div className="text-right">
                            <div className="flex items-center space-x-2 text-green-400">
                                <CheckCircleIcon className="w-5 h-5" />
                                <span className="font-medium">Delivered</span>
                            </div>
                            <p className="text-green-300 text-sm">
                                {format(new Date(currentStatus.date_time), 'PPp')}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Detailed Timeline */}
            <div className="space-y-4">
                <h4 className="text-lg font-medium text-white flex items-center space-x-2">
                    <ClockIcon className="w-5 h-5 text-indigo-400" />
                    <span>Tracking Timeline</span>
                </h4>

                <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-indigo-500 via-purple-500 to-gray-600"></div>

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
                                    <div className={`relative z-10 flex items-center justify-center w-12 h-12 rounded-full border-2 ${
                                        index === 0 
                                            ? 'bg-indigo-600 border-indigo-400' 
                                            : 'bg-gray-800 border-gray-600'
                                    }`}>
                                        {getStatusIcon(event.status.icon, event.status.color)}
                                    </div>

                                    {/* Event content */}
                                    <div className="flex-1 min-w-0 pb-6">
                                        <div className="rounded-lg bg-gray-800/50 border border-gray-600/30 p-4 hover:bg-gray-800/70 transition-colors">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex-1">
                                                    <h5 className="text-white font-medium text-lg">
                                                        {event.status.name}
                                                    </h5>
                                                    <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
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
                                                    <div className="flex items-center space-x-2 text-sm text-gray-300">
                                                        <UserIcon className="w-4 h-4 text-gray-400" />
                                                        <span>
                                                            Handled by: {event.user.first_name} {event.user.last_name || ''}
                                                            {event.user.reference_id && (
                                                                <span className="text-gray-500 ml-1">({event.user.reference_id})</span>
                                                            )}
                                                        </span>
                                                    </div>
                                                )}

                                                {event['Assigned Rider'] && (
                                                    <div className="flex items-center space-x-2 text-sm text-blue-300">
                                                        <TruckIcon className="w-4 h-4 text-blue-400" />
                                                        <span>Assigned Rider: {event['Assigned Rider']}</span>
                                                    </div>
                                                )}

                                                {(event['Returned Branch'] || event['Received Branch']) && (
                                                    <div className="flex items-center space-x-2 text-sm text-yellow-300">
                                                        <BuildingOfficeIcon className="w-4 h-4 text-yellow-400" />
                                                        <span>
                                                            {event['Returned Branch'] ? 'Returned to' : 'Received at'}: {event['Returned Branch'] || event['Received Branch']}
                                                        </span>
                                                    </div>
                                                )}

                                                {event.Reason && (
                                                    <div className="flex items-start space-x-2 text-sm text-orange-300">
                                                        <InformationCircleIcon className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
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
                <div className="rounded-lg bg-gray-800/50 border border-gray-600/30 p-4">
                    <div className="flex items-center space-x-2">
                        <ClockIcon className="w-5 h-5 text-indigo-400" />
                        <span className="text-gray-300 font-medium">Total Updates</span>
                    </div>
                    <p className="text-2xl font-bold text-white mt-1">{trackingData.data.length}</p>
                </div>

                <div className="rounded-lg bg-gray-800/50 border border-gray-600/30 p-4">
                    <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300 font-medium">Current Status</span>
                    </div>
                    <p className="text-lg font-semibold text-white mt-1">{currentStatus.status.name}</p>
                </div>

                <div className="rounded-lg bg-gray-800/50 border border-gray-600/30 p-4">
                    <div className="flex items-center space-x-2">
                        <TruckIcon className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-300 font-medium">In Transit</span>
                    </div>
                    <p className="text-lg font-semibold text-white mt-1">
                        {formatDistanceToNow(new Date(trackingData.data[trackingData.data.length - 1].date_time))}
                    </p>
                </div>
            </div>
        </div>
    );
}