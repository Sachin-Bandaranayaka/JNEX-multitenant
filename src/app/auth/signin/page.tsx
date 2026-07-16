"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setIsLoading(false);
      return;
    }

    router.push("/dashboard");
    setIsLoading(false);
  };

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-[#fffafa] text-slate-700 lg:bg-white">
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full border-[36px] border-red-100/60 lg:hidden" aria-hidden="true" />
      <Image src="/brand/jnex-logo.png" alt="" width={280} height={280} className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 object-contain opacity-[0.035] lg:hidden" aria-hidden="true" />
      {/* ===== Left: Login form ===== */}
      <div className="relative z-10 flex w-full flex-col justify-center px-5 py-8 sm:px-14 lg:w-[40%] lg:py-10">
        <div className="mx-auto w-full max-w-sm rounded-lg border border-red-100 bg-white p-6 shadow-[0_18px_45px_rgba(127,29,29,0.08)] sm:p-8 lg:rounded-none lg:border-0 lg:p-0 lg:shadow-none">
          {/* Logo */}
          <div className="flex flex-col items-center mb-6">
            <Image src="/brand/jnex-logo.png" alt="JNEX" width={80} height={80} priority className="h-20 w-20 object-contain drop-shadow-md" />
            <span className="mt-3 text-xl font-extrabold tracking-wide text-slate-600">
              JNEX<span className="text-[#e10600]">OMS</span>
            </span>
          </div>

          <h1 className="mb-8 text-center text-2xl font-semibold text-slate-700">
            Login to Your Account
          </h1>

          {error && (
            <div className="mb-5 p-3 rounded-md bg-[#fdeceb] text-[#c9453f] text-sm font-medium border border-[#f0c2bd] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[#c9453f]" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-500 mb-1.5">
                Username
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="username"
                className="w-full border-0 border-b-2 border-[#e3e6ea] bg-transparent py-2 text-slate-700 transition-colors focus:border-[#e10600] focus:outline-none focus:ring-0"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-500 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full border-0 border-b-2 border-[#e3e6ea] bg-transparent py-2 pr-9 text-slate-700 transition-colors focus:border-[#e10600] focus:outline-none focus:ring-0"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-1 text-slate-500 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e10600] focus-visible:ring-offset-2"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#e10600] px-8 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#b80505] focus:outline-none focus:ring-2 focus:ring-[#e10600] focus:ring-offset-2 disabled:opacity-60"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                  </>
                ) : (
                  "SIGN IN"
                )}
              </button>
            </div>
          </form>

          <p className="mt-10 px-2 text-center text-xs leading-relaxed text-slate-600">
            Seamless shopping, reliable shipping &ndash; satisfaction to your doorstep
            with our innovative sales system!
          </p>
        </div>
      </div>

      {/* ===== Right: Hero ===== */}
      <div className="hidden lg:block lg:w-[60%] relative overflow-hidden">
        <Image src="/brand/jnex-brand-background.jpg" alt="JNEX brand mark" fill priority sizes="60vw" className="object-cover object-center" />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, rgba(15,15,18,0.08), rgba(184,5,5,0.12) 48%, rgba(15,15,18,0.92))" }}
        />
        <div className="relative z-10 flex h-full max-w-2xl flex-col justify-end px-14 pb-14 text-white xl:px-20 xl:pb-20">
          <h2 className="text-5xl font-extrabold tracking-tight drop-shadow">
            JNEX <span className="text-red-200">OMS</span>
          </h2>
          <p className="mt-3 text-sm font-medium text-red-100">Order Management System</p>
          <p className="mt-4 text-lg leading-relaxed text-white/90">
            Welcome to Jnex! Effortlessly organize, access, and collaborate on your products.
            Streamline workflows, manage orders, and boost your sales game. Let&apos;s make your
            business journey smooth and successful!
          </p>
        </div>
      </div>
    </div>
  );
}
