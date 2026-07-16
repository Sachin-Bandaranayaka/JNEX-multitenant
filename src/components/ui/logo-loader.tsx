import Image from 'next/image';

import { cn } from '@/lib/utils';

interface LogoLoaderProps {
  fullScreen?: boolean;
  label?: string;
  className?: string;
}

export function LogoLoader({ fullScreen = false, label = 'Loading', className }: LogoLoaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullScreen && 'min-h-screen w-full bg-[#f8fafc]',
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="jnex-loader" aria-hidden="true">
        <span className="jnex-loader__orbit" />
        <span className="jnex-loader__halo" />
        <Image
          src="/brand/jnex-logo.png"
          alt=""
          width={96}
          height={96}
          priority={fullScreen}
          className="jnex-loader__logo"
        />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
