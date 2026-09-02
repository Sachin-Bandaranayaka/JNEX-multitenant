// The shared chrome for every unauthenticated screen: the branded split
// layout, so sign-in, the email-code step and the password reset all look like
// one continuous flow instead of three different products.

import Image from 'next/image';

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#fffafa] text-slate-700 lg:bg-white">
      <div
        className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full border-[36px] border-red-100/60 lg:hidden"
        aria-hidden="true"
      />
      <Image
        src="/brand/jnex-logo.png"
        alt=""
        width={280}
        height={280}
        className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 object-contain opacity-[0.035] lg:hidden"
        aria-hidden="true"
      />

      {/* ===== Left: form ===== */}
      <div className="relative z-10 flex w-full flex-col justify-center px-5 py-8 sm:px-14 lg:w-[40%] lg:py-10">
        <div className="mx-auto w-full max-w-sm rounded-lg border border-red-100 bg-white p-6 shadow-[0_18px_45px_rgba(127,29,29,0.08)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
          <div className="mb-6 flex flex-col items-center">
            <Image
              src="/brand/jnex-logo.png"
              alt="JNEX"
              width={80}
              height={80}
              priority
              className="h-20 w-20 object-contain drop-shadow-md"
            />
            <span className="mt-3 text-xl font-extrabold tracking-wide text-slate-600">
              JNEX<span className="text-[#e10600]">OMS</span>
            </span>
          </div>

          {children}
        </div>
      </div>

      {/* ===== Right: hero ===== */}
      <div className="relative hidden overflow-hidden lg:block lg:w-[60%]">
        <Image
          src="/brand/jnex-brand-background.jpg"
          alt="JNEX brand mark"
          fill
          priority
          sizes="60vw"
          className="object-cover object-center"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,15,18,0.08), rgba(184,5,5,0.12) 48%, rgba(15,15,18,0.92))',
          }}
        />
        <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end px-14 pb-14 text-white xl:px-20 xl:pb-20">
          <h2 className="text-5xl font-extrabold tracking-tight drop-shadow">
            JNEX <span className="text-red-200">OMS</span>
          </h2>
          <p className="mt-3 text-sm font-medium text-red-100">Order Management System</p>
          <p className="mt-4 text-lg leading-relaxed text-white/90">
            Welcome to Jnex! Effortlessly organize, access, and collaborate on your
            products. Streamline workflows, manage orders, and boost your sales game.
            Let&apos;s make your business journey smooth and successful!
          </p>
        </div>
      </div>
    </div>
  );
}
