"use client"

import { useState, useEffect } from "react"
import { Search, Sparkles, Edit3, Download, Music, BookOpen, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import type { IntroAnimationState } from "@/components/landing/page-switcher"
import { FloatingTitle } from "@/components/ui/floating-title"

interface IntroPageProps {
  onBackToSearch?: () => void
  animState: IntroAnimationState
}

const ICON_WRAPPER = "flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20"

function animClass(state: IntroAnimationState, delayIdx: number): string {
  switch (state) {
    case "hidden":   return "intro-item-base"
    case "entering": return `intro-animate-in intro-delay-${delayIdx}`
    case "active":   return "intro-item-visible"
    case "exiting":  return `intro-animate-out intro-delay-out-${delayIdx}`
    default:         return ""
  }
}

/** Calculate scale factor relative to 800px baseline */
function useScale() {
  const [vw, setVw] = useState(800)
  useEffect(() => {
    const update = () => setVw(window.innerWidth)
    update()
    window.addEventListener("resize", update)
    return () => window.removeEventListener("resize", update)
  }, [])
  return vw / 800 // scale = 1 at 800px, < 1 below, > 1 above
}

/**
 * Card aspect ratio: at 800px the cards have their natural ratio.
 * Below 800px, cards become progressively squarer.
 * Above 800px, aspect ratio stays constant.
 *
 * Formula:
 *   naturalAspect = w / h at 800px (e.g. 1.6 for a 320×200 card)
 *   scale = vw / 800
 *   When scale >= 1: aspect = naturalAspect (fixed)
 *   When scale < 1: aspect transitions linearly from naturalAspect → 1
 *     aspect = 1 + (naturalAspect - 1) * scale
 */
function cardAspectScale(naturalAspect: number, scale: number): number {
  if (scale >= 1) return naturalAspect
  return 1 + (naturalAspect - 1) * scale
}

export function IntroPage({ onBackToSearch, animState }: IntroPageProps) {
  const scale = useScale()

  // Card natural aspect ratios (width/height at 800px design)
  const FEATURE_ASPECT = 1.6
  const SCENE_ASPECT = 1.2
  const featureAspect = cardAspectScale(FEATURE_ASPECT, scale)
  const sceneAspect = cardAspectScale(SCENE_ASPECT, scale)

  // vw-based spacing (at 800px: 1vw = 8px)
  const gap = `${(16 / 800 * 100).toFixed(2)}vw` // 16px → 2vw
  const cardPadX = `${(20 / 800 * 100).toFixed(2)}vw` // 20px → 2.5vw
  const cardPadY = `${(20 / 800 * 100).toFixed(2)}vw`
  const sectionPadX = `${(24 / 800 * 100).toFixed(2)}vw` // 24px → 3vw

  return (
    <div className="flex h-screen flex-col overflow-y-auto overflow-x-hidden overscroll-none bg-background [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" data-intro-scroll>

      {/* ═══════ Hero ═══════ */}
      <section className="flex flex-col items-center px-[3vw] pb-[6vw] pt-[8vw] text-center sm:pt-[10vw]">

        <div className={cn("mb-[4vw]", animClass(animState, 0))}>
          <h2
            className="text-[clamp(1.2rem,5vw,2.8rem)] font-bold leading-tight tracking-[0.06em] text-[oklch(0.45_0.06_40)] dark:text-[oklch(0.7_0.06_40)]"
            style={{ textShadow: "3px 3px 0 oklch(0.85_0.02_60 / 0.5)" }}
            aria-label="日语歌词 一键注音"
          >
            <FloatingTitle as="span" className="inline">日语歌词</FloatingTitle>
            <br aria-hidden="true" />
            <FloatingTitle
              as="span"
              className="inline text-[oklch(0.55_0.1_40)] dark:text-[oklch(0.65_0.1_40)]"
            >
              一键注音
            </FloatingTitle>
          </h2>
        </div>

        <p className={cn(
          "max-w-[70vw] text-[clamp(0.75rem,1.75vw,1.25rem)] leading-relaxed tracking-[0.03em] text-muted-foreground/70",
          animClass(animState, 1)
        )}>
          搜索或粘贴日语歌词，自动标注平假名与罗马音。
          <br className="hidden sm:block" />
          高亮对照 · 在线编辑 · 一键导出，日语学习者的歌词注音利器。
        </p>

        <div className={cn("mt-[4vw] flex items-center justify-center", animClass(animState, 2))}>
          <button
            onClick={onBackToSearch}
            className="inline-flex items-center gap-[1vw] rounded-xl bg-primary px-[2.5vw] py-[1.25vw] text-[clamp(0.75rem,1.5vw,1rem)] font-medium text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 active:scale-95"
          >
            <Search className="h-[clamp(0.85rem,2vw,1.2rem)] w-[clamp(0.85rem,2vw,1.2rem)]" />
            开始使用
          </button>
        </div>
      </section>

      {/* ═══════ 核心功能 ═══════ */}
      <section className={cn("mx-auto w-full px-[3vw] pb-[6vw]", animClass(animState, 4))}
        style={{ maxWidth: `min(${(896 / 800 * 100).toFixed(2)}vw, 100%)` }}>
        <h3 className="mb-[3vw] text-center font-semibold uppercase tracking-[0.15em] text-muted-foreground/50"
          style={{ fontSize: `clamp(0.9rem, ${(18/500*100).toFixed(2)}vw, 2rem)` }}>
          <FloatingTitle as="span" className="inline">核心功能</FloatingTitle>
        </h3>
        <div className="grid grid-cols-2" style={{ gap }}>
          {[
            { icon: Sparkles, title: "智能注音", desc: "Kuromoji + Kuroshiro 引擎，汉字自动转假名或罗马音" },
            { icon: BookOpen, title: "高亮对照", desc: "原文与注音两侧同步高亮，汉字与读音一一对应" },
            { icon: Edit3, title: "在线编辑", desc: "点击汉字直接修改读音，社区数据辅助修正" },
            { icon: Download, title: "多格式导出", desc: "支持 TXT 原文+注音、仅注音、LRC 歌词" },
          ].map(({ icon: Icon, title, desc }) => (
            <article
              key={title}
              className="flex flex-col items-start rounded-2xl border border-border/30 bg-white dark:bg-zinc-900 transition-shadow hover:shadow-md"
              style={{
                aspectRatio: featureAspect,
                padding: cardPadY,
                paddingLeft: cardPadX,
                paddingRight: cardPadX,
                gap: `${(12 / 800 * 100).toFixed(2)}vw`,
              }}
            >
               <div className={cn("h-[clamp(1.5rem,6.4vw,3rem)] w-[clamp(1.5rem,6.4vw,3rem)]", ICON_WRAPPER)}>
                <Icon className="h-[clamp(0.9rem,4vw,1.6rem)] w-[clamp(0.9rem,4vw,1.6rem)]" />
              </div>
              <h4 className="text-[clamp(0.75rem,2.8vw,1.3rem)] font-semibold tracking-[0.04em] text-foreground">{title}</h4>
              <p className="text-[clamp(0.7rem,2.4vw,1.1rem)] leading-relaxed text-muted-foreground/60">{desc}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ═══════ 适用场景 ═══════ */}
      <section className={cn("mx-auto w-full px-[3vw] pb-[6vw]", animClass(animState, 5))}
        style={{ maxWidth: `min(${(896 / 800 * 100).toFixed(2)}vw, 100%)` }}>
        <h3 className="mb-[3vw] text-center font-semibold uppercase tracking-[0.15em] text-muted-foreground/50"
          style={{ fontSize: `clamp(0.9rem, ${(18/500*100).toFixed(2)}vw, 2rem)` }}>
          <FloatingTitle as="span" className="inline">适用场景</FloatingTitle>
        </h3>
        <div className="grid grid-cols-3" style={{ gap }}>
          {[
            { icon: Globe, title: "日语学习者", desc: "通过歌词学习汉字读音，在音乐中自然习得假名与词汇" },
            { icon: Music, title: "歌词爱好者", desc: "获取精确注音对照，跟唱日语歌曲不再有障碍" },
            { icon: Search, title: "翻译工作者", desc: "快速获取歌词原文与读音，辅助翻译与校对工作" },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col items-center rounded-2xl border border-border/30 bg-white text-center dark:bg-zinc-900"
              style={{
                aspectRatio: sceneAspect,
                padding: cardPadY,
                paddingLeft: cardPadX,
                paddingRight: cardPadX,
                gap: `${(12 / 800 * 100).toFixed(2)}vw`,
              }}
            >
              <div className={cn("h-[clamp(1.5rem,6.4vw,3rem)] w-[clamp(1.5rem,6.4vw,3rem)]", ICON_WRAPPER, "rounded-full")}>
                <Icon className="h-[clamp(0.9rem,4vw,1.6rem)] w-[clamp(0.9rem,4vw,1.6rem)]" />
              </div>
              <h4 className="text-[clamp(0.75rem,2.8vw,1.3rem)] font-semibold tracking-[0.04em] text-foreground">{title}</h4>
              <p className="text-[clamp(0.7rem,2.4vw,1.1rem)] leading-relaxed text-muted-foreground/60">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════ 技术特色 + Footer ═══════ */}
      <div className={cn("mt-auto w-full border-t border-border/30 bg-muted/30 dark:bg-muted/10", animClass(animState, 6))}>
        <div className="mx-auto py-[4vw]"
          style={{ maxWidth: `min(${(896 / 800 * 100).toFixed(2)}vw, 100%)`, paddingLeft: sectionPadX, paddingRight: sectionPadX }}>
          <div className="flex flex-wrap items-center justify-center gap-[3vw] sm:gap-[5vw]">
            <div className="text-center">
              <dt className="text-[clamp(0.75rem,2.8vw,1.3rem)] font-medium tracking-[0.05em] text-foreground/70">多源搜索</dt>
              <dd className="mt-[0.5vw] text-[clamp(0.7rem,2.4vw,1.1rem)] text-muted-foreground/60">网易云 · LRCLIB · Genius</dd>
            </div>
            <div className="text-center">
              <dt className="text-[clamp(0.75rem,2.8vw,1.3rem)] font-medium tracking-[0.05em] text-foreground/70">社区推荐</dt>
              <dd className="mt-[0.5vw] text-[clamp(0.7rem,2.4vw,1.1rem)] text-muted-foreground/60">读音修正与投票系统</dd>
            </div>
            <div className="text-center">
              <dt className="text-[clamp(0.75rem,2.8vw,1.3rem)] font-medium tracking-[0.05em] text-foreground/70">音频播放</dt>
              <dd className="mt-[0.5vw] text-[clamp(0.7rem,2.4vw,1.1rem)] text-muted-foreground/60">同步试听与进度跟踪</dd>
            </div>
          </div>
          <p className="mt-[4vw] text-right text-[clamp(0.65rem,2.4vw,1rem)] text-muted-foreground/40">
            &copy; {new Date().getFullYear()} Origamicmic &middot; MIT License
          </p>
        </div>
      </div>

    </div>
  )
}
