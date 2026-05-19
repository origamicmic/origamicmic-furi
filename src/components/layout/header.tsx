"use client"

import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

interface HeaderProps {
  onHomeClick?: () => void
}

const BG_PATH = "M24 0v24H0V0zM12.593 23.258l-.011.002-.071.035-.02.004-.014-.004-.071-.035c-.01-.004-.019-.001-.024.005l-.004.01-.017.428.005.02.01.013.104.074.015.004.012-.004.104-.074.012-.016.004-.017-.017-.427c-.002-.01-.009-.017-.017-.018m.265-.113-.013.002-.185.093-.01.01-.003.011.018.43.005.012.008.007.201.093c.012.004.023 0 .029-.008l.004-.014-.034-.614c-.003-.012-.01-.02-.02-.022m-.715.002a.023.023 0 0 0-.027.006l-.006.014-.034.614c0 .012.007.02.017.024l.015-.002.201-.093.01-.008.004-.011.017-.43-.003-.012-.01-.01z"

const GITHUB_PATH = "M6.315 6.176c-.25-.638-.24-1.367-.129-2.034a6.77 6.77 0 0 1 2.12 1.07c.28.214.647.283.989.18A9.343 9.343 0 0 1 12 5c.961 0 1.874.14 2.703.391.342.104.709.034.988-.18a6.77 6.77 0 0 1 2.119-1.07c.111.667.12 1.396-.128 2.033-.15.384-.075.826.208 1.14C18.614 8.117 19 9.04 19 10c0 2.114-1.97 4.187-5.134 4.818-.792.158-1.101 1.155-.495 1.726.389.366.629.882.629 1.456v3a1 1 0 0 0 2 0v-3c0-.57-.12-1.112-.334-1.603C18.683 15.35 21 12.993 21 10c0-1.347-.484-2.585-1.287-3.622.21-.82.191-1.646.111-2.28-.071-.568-.17-1.312-.57-1.756-.595-.659-1.58-.271-2.28-.032a9.081 9.081 0 0 0-2.125 1.045A11.432 11.432 0 0 0 12 3c-.994 0-1.953.125-2.851.356a9.08 9.08 0 0 0-2.125-1.045c-.7-.24-1.686-.628-2.281.031-.408.452-.493 1.137-.566 1.719l-.005.038c-.08.635-.098 1.462.112 2.283C3.484 7.418 3 8.654 3 10c0 2.992 2.317 5.35 5.334 6.397A3.986 3.986 0 0 0 8 17.98l-.168.034c-.717.099-1.176.01-1.488-.122-.76-.322-1.152-1.133-1.63-1.753-.298-.385-.732-.866-1.398-1.088a1 1 0 0 0-.632 1.898c.558.186.944 1.142 1.298 1.566.373.448.869.916 1.58 1.218.682.29 1.483.393 2.438.276V21a1 1 0 0 0 2 0v-3c0-.574.24-1.09.629-1.456.607-.572.297-1.568-.495-1.726C6.969 14.187 5 12.114 5 10c0-.958.385-1.881 1.108-2.684.283-.314.357-.756.207-1.14"
const GITHUB_FILL_PATH = "M7.024 2.31a9.08 9.08 0 0 1 2.125 1.046A11.432 11.432 0 0 1 12 3c.993 0 1.951.124 2.849.355a9.08 9.08 0 0 1 2.124-1.045c.697-.237 1.69-.621 2.28.032.4.444.5 1.188.571 1.756.08.634.099 1.46-.111 2.28C20.516 7.415 21 8.652 21 10c0 2.042-1.106 3.815-2.743 5.043a9.456 9.456 0 0 1-2.59 1.356c.214.49.333 1.032.333 1.601v3a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-.991c-.955.117-1.756.013-2.437-.276-.712-.302-1.208-.77-1.581-1.218-.354-.424-.74-1.38-1.298-1.566a1 1 0 0 1 .632-1.898c.666.222 1.1.702 1.397 1.088.48.62.87 1.43 1.63 1.753.313.133.772.22 1.49.122L8 17.98a3.986 3.986 0 0 1 .333-1.581 9.455 9.455 0 0 1-2.59-1.356C4.106 13.815 3 12.043 3 10c0-1.346.483-2.582 1.284-3.618-.21-.82-.192-1.648-.112-2.283l.005-.038c.073-.582.158-1.267.566-1.719.59-.653 1.584-.268 2.28-.031Z"

const BILIBILI_PATH = "M6.445 3.168a1 1 0 0 1 1.387.277L9.535 6h4.93l1.703-2.555a1 1 0 0 1 1.664 1.11L16.87 6H18a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-7a4 4 0 0 1 4-4h1.131l-.963-1.445a1 1 0 0 1 .277-1.387M8.986 8H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2H9.016zM9 11a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0zm5 0a1 1 0 1 1 2 0v2a1 1 0 1 1-2 0z"
const BILIBILI_FILL_PATH = "M17.555 3.168a1 1 0 0 1 .277 1.387L16.87 6H18a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-7a4 4 0 0 1 4-4h1.131l-.963-1.445a1 1 0 0 1 1.664-1.11L9.535 6h4.93l1.703-2.555a1 1 0 0 1 1.387-.277M9 11a1 1 0 0 0-.993.883L8 12v2a1 1 0 0 0 1.993.117L10 14v-2a1 1 0 0 0-1-1m6 0a1 1 0 0 0-1 1v2a1 1 0 1 0 2 0v-2a1 1 0 0 0-1-1"

const SUN_PATH = "M12 19a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0v-1a1 1 0 0 1 1-1m6.364-2.05.707.707a1 1 0 0 1-1.414 1.414l-.707-.707a1 1 0 0 1 1.414-1.414m-12.728 0a1 1 0 0 1 1.497 1.32l-.083.094-.707.707a1 1 0 0 1-1.497-1.32l.083-.094zM12 6a6 6 0 1 1 0 12 6 6 0 0 1 0-12m-8 5a1 1 0 0 1 .117 1.993L4 13H3a1 1 0 0 1-.117-1.993L3 11zm17 0a1 1 0 1 1 0 2h-1a1 1 0 1 1 0-2zM4.929 4.929a1 1 0 0 1 1.32-.083l.094.083.707.707a1 1 0 0 1-1.32 1.497l-.094-.083-.707-.707a1 1 0 0 1 0-1.414m14.142 0a1 1 0 0 1 0 1.414l-.707.707a1 1 0 1 1-1.414-1.414l.707-.707a1 1 0 0 1 1.414 0M12 2a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1"
const MOON_PATH = "M13.574 3.138a1.01 1.01 0 0 0-1.097 1.408 6 6 0 0 1-7.931 7.931 1.01 1.01 0 0 0-1.409 1.097A9 9 0 0 0 21 12a9.001 9.001 0 0 0-7.426-8.862"

function Icon({ d, className, fillRule }: { d: string; className?: string; fillRule?: "evenodd" }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" className={className}>
      <path d={BG_PATH} fillRule={fillRule} />
      <path d={d} fill="currentColor" fillRule={fillRule} />
    </svg>
  )
}

export function Header({ onHomeClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-50 bg-background/60 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <button
          onClick={onHomeClick}
          className="group flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 transition-transform hover:scale-[1.02]"
        >
          <span
            className="text-[clamp(1.1rem,4.5vw,1.5rem)] font-bold tracking-[0.08em] text-[oklch(0.5_0.08_40)] transition-colors group-hover:text-[oklch(0.55_0.1_40)] dark:text-[oklch(0.7_0.08_40)] dark:group-hover:text-[oklch(0.75_0.1_40)]"
            style={{ textShadow: "1px 1px 0 oklch(0.85_0.02_60 / 0.5)" }}
          >
            Origamicmic Furi
          </span>
          <span className="hidden text-[clamp(0.7rem,2vw,0.875rem)] tracking-[0.1em] text-muted-foreground/50 sm:inline-block">
              {"/"}
              {" "}
              lyrics furigana
            </span>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-11 w-11 text-muted-foreground hover:text-foreground"
          >
            <Icon d={SUN_PATH} className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Icon d={MOON_PATH} fillRule="evenodd" className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <a
            href="https://github.com/origamicmic/origamicmic-furi"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="group"
          >
            <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground">
              <Icon d={GITHUB_PATH} className="h-5 w-5 group-hover:hidden" />
              <Icon d={GITHUB_FILL_PATH} className="hidden h-5 w-5 group-hover:block" />
            </Button>
          </a>
          <a
            href="https://space.bilibili.com/608373480"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Bilibili"
            className="group"
          >
            <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-foreground">
              <Icon d={BILIBILI_PATH} fillRule="evenodd" className="h-5 w-5 group-hover:hidden" />
              <Icon d={BILIBILI_FILL_PATH} fillRule="evenodd" className="hidden h-5 w-5 group-hover:block" />
            </Button>
          </a>
        </div>
      </div>
    </header>
  )
}
