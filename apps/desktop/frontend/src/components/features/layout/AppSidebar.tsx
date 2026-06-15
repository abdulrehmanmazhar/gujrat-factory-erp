import { Sidebar, SidebarHeader } from '@/components/ui/sidebar'
import { AppSidebarContent } from './AppSidebarContent'
import { AppSidebarFooter } from './AppSidebarFooter'
import constants from '@/constants/app'
import logo from '@/assets/trip2go.png'

export function AppSidebar() {
    return (
        <Sidebar>
            <SidebarHeader className="border-b px-4 py-3 h-16 flex flex-row align-center gap-2">
                <div className="flex items-center gap-3">
                    <img
                        src={logo}
                        alt={constants.NAME}
                        className="w-8 object-contain"
                    />
                    <span className="text-lg font-semibold tracking-tight">{constants.NAME}</span>
                </div>
            </SidebarHeader>

            <AppSidebarContent />

            <AppSidebarFooter />
        </Sidebar>
    )
}
