// src/components/orders/shipping-modal.tsx

'use client';

import React, { useState, Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ShippingForm } from './shipping-form';

interface ShippingModalProps {
    isOpen: boolean;
    onClose: () => void;
    orderId: string;
    order: {
        customerName: string;
        customerPhone: string;
        customerSecondPhone?: string;
        customerAddress: string;
        customerCity?: string;
        product: {
            name: string;
            price: number;
        };
        quantity: number;
        discount?: number;
    };
    fardaExpressClientId?: string;
    fardaExpressApiKey?: string;
    transExpressApiKey?: string;
    royalExpressApiKey?: string;
    royalExpressOrderPrefix?: string;
    onSuccess?: () => void;
}

export function ShippingModal({
    isOpen,
    onClose,
    orderId,
    order,
    fardaExpressClientId,
    fardaExpressApiKey,
    transExpressApiKey,
    royalExpressApiKey,
    royalExpressOrderPrefix,
    onSuccess,
}: ShippingModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSuccess = () => {
        onSuccess?.();
        onClose();
    };

    return (
        <Transition appear show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black bg-opacity-75" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-gray-800 p-6 text-left align-middle shadow-xl transition-all ring-1 ring-white/10">
                                <div className="flex items-center justify-between mb-6">
                                    <Dialog.Title
                                        as="h3"
                                        className="text-lg font-medium leading-6 text-white"
                                    >
                                        Ship Order - {order.customerName}
                                    </Dialog.Title>
                                    <button
                                        type="button"
                                        className="rounded-md text-gray-400 hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        onClick={onClose}
                                    >
                                        <XMarkIcon className="h-6 w-6" />
                                    </button>
                                </div>

                                <div className="mb-4 p-4 bg-gray-700/50 rounded-lg">
                                    <h4 className="text-sm font-medium text-gray-300 mb-2">Order Details</h4>
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <span className="text-gray-400">Product:</span>
                                            <span className="ml-2 text-white">{order.product.name}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Quantity:</span>
                                            <span className="ml-2 text-white">{order.quantity}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Customer:</span>
                                            <span className="ml-2 text-white">{order.customerName}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">Phone:</span>
                                            <span className="ml-2 text-white">{order.customerPhone}</span>
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-gray-400">Address:</span>
                                            <span className="ml-2 text-white">{order.customerAddress}</span>
                                        </div>
                                    </div>
                                </div>

                                <ShippingForm
                                    orderId={orderId}
                                    order={order}
                                    fardaExpressClientId={fardaExpressClientId}
                                    fardaExpressApiKey={fardaExpressApiKey}
                                    transExpressApiKey={transExpressApiKey}
                                    royalExpressApiKey={royalExpressApiKey}
                                    royalExpressOrderPrefix={royalExpressOrderPrefix}
                                    onSuccess={handleSuccess}
                                />
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}