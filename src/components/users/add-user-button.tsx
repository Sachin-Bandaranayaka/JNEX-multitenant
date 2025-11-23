'use client';

import { motion } from 'framer-motion';
import { PlusIcon } from '@heroicons/react/24/outline';

export interface AddUserButtonProps {
    onAddUser: () => void;
}

export function AddUserButton({ onAddUser }: AddUserButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddUser}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors"
        >
            <PlusIcon className="h-5 w-5" />
            Add User
        </motion.button>
    );
}
