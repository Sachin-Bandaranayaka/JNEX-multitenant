"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

export function ThemeToggle() {
    const { setTheme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => setMounted(true), [])

    const isDark = mounted && resolvedTheme === "dark"
    const label = isDark ? "Switch to light mode" : "Switch to dark mode"

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={label}
            title={label}
            className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-gray-200 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#17181c]"
        >
            {mounted ? (
                isDark ? <Sun aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" /> : <Moon aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
            ) : (
                <span aria-hidden="true" className="h-[1.15rem] w-[1.15rem] rounded-full border border-current opacity-50" />
            )}
            <span className="sr-only">{label}</span>
        </button>
    )
}
