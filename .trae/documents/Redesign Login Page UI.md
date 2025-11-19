## Goals
- Redesign `/auth/signin` with shadcn/ui for a polished look.
- Add light mode support alongside the existing dark mode, with an in-page theme toggle and persisted preference.

## Current Context
- Forced dark mode via `<html class="dark">` in `src/app/layout.tsx`.
- Login page uses Tailwind + Framer Motion (`src/app/auth/signin/page.tsx`).
- UI kit available: `@/components/ui/{button,input,label,card}`.

## Proposed Changes
- Refactor the login page to use `Card`, `Input`, `Label`, and `Button`.
- Support dual theme by:
  - Adding a small theme toggle button in the login header that switches the `dark` class on `document.documentElement` and stores preference in `localStorage('theme')`.
  - Using dual-mode Tailwind classes on the page (`bg-white dark:bg-gray-900`, `text-gray-900 dark:text-white`).
  - Overriding `Input` and `Label` via `className` with light/dark variants (leveraging `tailwind-merge` inside `cn`).
- Keep auth logic unchanged.

## Implementation Steps
1. Import shadcn/ui components and `Loader2` for the button spinner.
2. Add a `ThemeToggle` button in the page that:
   - Reads persisted `theme` from `localStorage` on mount.
   - Toggles `document.documentElement.classList` between `dark` and light.
   - Persists the selected theme.
3. Update container and card to use dual-mode classes.
4. Override `Input` and `Label` styles with dual-mode classes via `className`.
5. Preserve framer-motion animations and existing error/loading behavior.

## Resulting JSX (for reference)
```tsx
'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  useEffect(() => {
    const saved = (localStorage.getItem('theme') as 'light' | 'dark') || 'dark'
    setTheme(saved)
    const root = document.documentElement
    if (saved === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('theme', next)
    const root = document.documentElement
    if (next === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }
  return (
    <Button variant="outline" size="sm" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}

export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) {
      setError('Invalid email or password')
      setIsLoading(false)
      return
    }
    router.push('/dashboard')
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Card className="shadow-xl bg-white text-gray-900 ring-1 ring-gray-200 dark:bg-gray-800 dark:text-white dark:ring-white/10">
            <CardHeader className="text-center">
              <div className="flex justify-end">
                <ThemeToggle />
              </div>
              <CardTitle className="text-indigo-600 dark:text-indigo-400">J-nex Holdings</CardTitle>
              <CardDescription>Sign in to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="rounded-md bg-red-100 text-red-700 ring-1 ring-red-300 p-3 mb-4 dark:bg-red-900/50 dark:text-red-400 dark:ring-red-500"
                  role="alert"
                  aria-live="polite"
                >
                  {error}
                </motion.div>
              )}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-900 dark:text-gray-100">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="bg-white text-gray-900 border-gray-300 focus-visible:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-900 dark:text-gray-100">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="bg-white text-gray-900 border-gray-300 focus-visible:ring-gray-400 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
                  />
                </div>
                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign in'
                  )}
                </Button>
              </form>
              <div className="mt-4 text-sm text-center">
                <a href="#" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Forgot your password?</a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-center text-sm text-gray-600 dark:text-gray-400 mt-6">
          By signing in, you agree to our{' '}
          <a href="#" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Terms of Service</a>{' '}and{' '}
          <a href="#" className="text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Privacy Policy</a>
        </motion.div>
      </div>
    </div>
  )
}
```

## Affected Files
- Update: `src/app/auth/signin/page.tsx` only (theme toggle included inline; component overrides used to avoid changing shared UI files).

## Considerations
- Keeps forced dark default; users can toggle to light and it persists.
- Dual-mode classes ensure visual correctness in both themes without touching global CSS or component files.
- Later, we can remove `<html class="dark">` and centralize theme handling if you want system/auto theme.

Confirm and I will apply these changes to add light mode and the redesigned UI.