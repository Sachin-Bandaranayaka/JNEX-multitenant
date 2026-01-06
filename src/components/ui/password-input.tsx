'use client';

import { useState } from 'react';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

interface PasswordInputProps {
  name: string;
  id: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}

export function PasswordInput({ name, id, defaultValue = '', placeholder, className = '' }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        name={name}
        id={id}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className={`block w-full rounded-md bg-white/5 py-1.5 pr-10 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500 ${className}`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-300"
      >
        {showPassword ? (
          <EyeSlashIcon className="h-5 w-5" aria-hidden="true" />
        ) : (
          <EyeIcon className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
