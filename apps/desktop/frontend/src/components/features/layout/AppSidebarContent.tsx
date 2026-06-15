import { Play, History, Settings, Info, FileText, ShieldCheck } from 'lucide-react'

import {
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton
} from '@/components/ui/sidebar'
import { Link } from 'react-router-dom'

export function AppSidebarContent() {
    return (
        <SidebarContent>
            {/* ================= MAIN ================= */}
            <SidebarGroup>
                <SidebarGroupLabel>Main</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <Link to={'/'}>
                            <SidebarMenuItem>
                                <SidebarMenuButton>
                                    <Play />
                                    <span>Dashboard</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </Link>

                        <SidebarMenuItem>
                            <SidebarMenuButton>
                                <History />
                                <span>History</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <Link to={'/setting'}>
                            <SidebarMenuItem>
                                <SidebarMenuButton>
                                    <Settings />
                                    <span>Settings</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </Link>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>

            {/* ================= ABOUT ================= */}
            <SidebarGroup>
                <SidebarGroupLabel>About & Legal</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton>
                                <Info />
                                <span>About</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton>
                                <FileText />
                                <span>Terms</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>

                        <SidebarMenuItem>
                            <SidebarMenuButton>
                                <ShieldCheck />
                                <span>Privacy</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </SidebarContent>
    )
}
