import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <h1 className="text-6xl font-bold text-muted-foreground/30">404</h1>
      <p className="text-lg font-medium text-foreground">页面未找到</p>
      <p className="text-sm text-muted-foreground">您访问的页面不存在或已被移除</p>
      <Link
        href="/"
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        返回首页
      </Link>
    </div>
  )
}
