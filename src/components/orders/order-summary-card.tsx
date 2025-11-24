'use client';

import { motion } from 'framer-motion';
import { UserIcon, ShoppingBagIcon } from '@heroicons/react/24/outline';

interface OrderSummaryCardProps {
    order: {
        customerName: string;
        customerPhone: string;
        customerAddress: string;
        product: {
            name: string;
            code: string;
            price: number;
        };
        quantity: number;
        discount?: number;
    };
}

export function OrderSummaryCard({ order }: OrderSummaryCardProps) {
    return (
        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border bg-muted/30">
                <h3 className="text-lg font-bold text-foreground">Order Summary</h3>
            </div>
            <div className="p-6">
                <div className="space-y-6">
                    {/* Customer Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <UserIcon className="h-5 w-5 text-primary" />
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Customer Details
                            </h4>
                        </div>
                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                            <p className="font-semibold text-foreground text-lg">{order.customerName}</p>
                            <p className="text-muted-foreground font-mono mt-1">{order.customerPhone}</p>
                            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                {order.customerAddress}
                            </p>
                        </div>
                    </div>

                    {/* Product Details */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <ShoppingBagIcon className="h-5 w-5 text-primary" />
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                                Product Details
                            </h4>
                        </div>
                        <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                            <div className="flex justify-between items-start mb-2">
                                <div>
                                    <p className="font-semibold text-foreground">{order.product.name}</p>
                                    <p className="text-xs text-muted-foreground font-mono">Code: {order.product.code}</p>
                                </div>
                                <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-1 rounded-lg">
                                    x{order.quantity}
                                </span>
                            </div>

                            <div className="border-t border-border/50 my-3" />

                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total</span>
                                <span className="font-bold text-lg text-primary">
                                    {new Intl.NumberFormat('en-LK', {
                                        style: 'currency',
                                        currency: 'LKR',
                                    }).format((order.product.price * order.quantity) - (order.discount || 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
