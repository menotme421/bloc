"use client"

import { ChevronsUpDown, LogOut, Settings2, Sparkles } from "lucide-react"

import { signOut } from "@/app/(auth)/auth/actions"
import { clearOfflineAuth } from "@/lib/auth-state"
import {
  Avatar,
  AvatarImage,
} from "@/components/ui/avatar"
import ProfileAvatar from "@/components/profile-avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export type NavUserData = {
  name: string
  email: string
  avatar?: string | null
}

export function NavUser({ user }: { user?: NavUserData | null }) {
  const { isMobile } = useSidebar()

  // Defensive: AppLayout may render with empty session offline or during
  // stale-bundle HMR. Never crash the whole sidebar on missing user.
  if (!user) return null
  const name = user.name || "User"
  const email = user.email || ""

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-full">
                <AvatarImage src={user.avatar ?? undefined} alt={name} />
                <ProfileAvatar name={name} size={32} />
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-full">
                  <AvatarImage src={user.avatar ?? undefined} alt={name} />
                  <ProfileAvatar name={name} size={32} />
                </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm">{name}</span>
                <span className="truncate text-xs text-muted-foreground">{email}</span>
              </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem className="text-base">
                <Sparkles />
                Upgrade to Pro
              </DropdownMenuItem>
              <DropdownMenuItem className="text-base" asChild>
                <a href="/app/settings">
                  <Settings2 />
                  Settings
                </a>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <form action={signOut} className="contents">
                <button type="submit" onClick={() => clearOfflineAuth()} className="flex items-center gap-2 text-base">
                  <LogOut />
                  Log out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}