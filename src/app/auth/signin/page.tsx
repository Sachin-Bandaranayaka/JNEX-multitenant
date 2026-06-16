"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";

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
    <div className="min-h-screen w-full flex bg-white text-slate-700">
      {/* ===== Left: Login form ===== */}
      <div className="w-full lg:w-[40%] flex flex-col justify-center px-8 sm:px-14 py-10">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img src="/IMAGES/logo.svg" alt="Logo" className="h-16 w-16 object-contain" />
          </div>

          <h1 className="text-center text-2xl font-light text-slate-400 mb-8">
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
                className="w-full border-0 border-b-2 border-[#e3e6ea] bg-transparent py-2 text-slate-700 focus:border-[#e89c31] focus:outline-none focus:ring-0 transition-colors"
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
                  className="w-full border-0 border-b-2 border-[#e3e6ea] bg-transparent py-2 pr-9 text-slate-700 focus:border-[#e89c31] focus:outline-none focus:ring-0 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
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
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#e89c31] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#d4860f] disabled:opacity-60 transition-colors"
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

          <p className="mt-10 text-center text-xs text-slate-400 leading-relaxed px-2">
            Seamless shopping, reliable shipping &ndash; satisfaction to your doorstep
            with our innovative sales system!
          </p>
        </div>
      </div>

      {/* ===== Right: Hero ===== */}
      <div className="hidden lg:block lg:w-[60%] relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1920&auto=format&fit=crop"
          alt="Logistics"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(120deg, rgba(58,45,26,0.78), rgba(122,90,47,0.45) 60%, rgba(0,0,0,0.25))" }}
        />
        <div className="relative z-10 flex h-full flex-col justify-center px-14 text-white max-w-2xl">
          <h2 className="text-5xl font-extrabold tracking-tight drop-shadow">
            JNEX <span className="text-[#f5b94d]">OMS</span>
          </h2>
          <p className="mt-3 text-sm font-medium text-[#f5b94d]">Order Management System</p>
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
