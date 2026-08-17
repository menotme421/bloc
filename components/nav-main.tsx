"use client"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url?: string
    icon: React.ReactNode
    isActive?: boolean
    onSelect?: () => void
  }[]
}) {
  return (
    <SidebarMenu className="gap-0.5">
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton asChild isActive={item.isActive}>
            {item.onSelect ? (
              <button
                type="button"
                onClick={item.onSelect}
                className="font-normal"
              >
                {item.icon}
                <span>{item.title}</span>
              </button>
            ) : item.url ? (
              <a href={item.url}>
                {item.icon}
                <span>{item.title}</span>
              </a>
            ) : (
              <span className="flex items-center gap-2">
                {item.icon}
                <span>{item.title}</span>
              </span>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
}