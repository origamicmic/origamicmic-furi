"use client"

import { useTheme } from "next-themes"
import { Sun, Moon, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Player } from "@/components/layout/player"

interface HeaderProps {
  onHomeClick?: () => void
  audioUrl?: string | null
  audioTitle?: string
  audioArtist?: string
  audioFallbackUrl?: string | null
}

export function Header({ onHomeClick, audioUrl, audioTitle, audioArtist, audioFallbackUrl }: HeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <button
          onClick={onHomeClick}
          className="group flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 transition-transform hover:scale-[1.02]"
        >
          <span
            className="text-2xl font-bold tracking-[0.08em] text-[oklch(0.5_0.08_40)] transition-colors group-hover:text-[oklch(0.55_0.1_40)] dark:text-[oklch(0.7_0.08_40)] dark:group-hover:text-[oklch(0.75_0.1_40)]"
            style={{ textShadow: "1px 1px 0 oklch(0.85_0.02_60 / 0.5)" }}
          >
            Origamicmic Furi
          </span>
          {!audioUrl && (
            <span               className="hidden text-sm tracking-[0.1em] text-muted-foreground/50 sm:inline-block">
              {"/"}
              {" "}
              lyrics furigana
            </span>
          )}
        </button>

        {audioUrl && audioTitle && (
          <div className="absolute left-1/2 -translate-x-1/2">
            <Player src={audioUrl} title={audioTitle} artist={audioArtist || ""} fallbackSrc={audioFallbackUrl || undefined} />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
          >
            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <a
            href="https://github.com/origamicmic/origamicmic-furi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground">
              <ExternalLink className="h-5 w-5" />
            </Button>
          </a>
        </div>
      </div>
    </header>
  )
}
