import { Toaster } from "@/components/ui/toaster"

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <h1 className="text-4xl font-bold">Welcome to the UI Component Showcase</h1>
      <Toaster />
    </div>
  )
}
