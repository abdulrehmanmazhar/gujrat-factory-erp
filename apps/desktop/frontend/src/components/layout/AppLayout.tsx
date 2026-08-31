import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger
} from '@/components/ui/sidebar'
import constants from '@/constants/app'
import { useLanguage } from '@/hooks/useLanguage'
import { usePermissions } from '@/hooks/usePermissions'
import { useLogoutMutation } from '@/redux/api/authApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import {
    BarChart3,
    CalendarClock,
    HelpCircle,
    LayoutDashboard,
    LogOut,
    MessageCircle,
    Package,
    Settings,
    ShoppingBag,
    ShoppingCart,
    ClipboardList,
    ChefHat,
    HardHat,
    Activity,
    Receipt,
    Sparkles,
    Target,
    Truck,
    UserCircle,
    Users,
    ArrowRightLeft,
    UsersRound,
    LineChart,
    Warehouse,
    Boxes,
    Images
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { useGetMeQuery } from '@/redux/api/authApi'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

const navItems = [
    { to: '/', labelKey: 'home' as const, icon: BarChart3 },
    { to: '/dashboard', labelKey: 'dashboard' as const, icon: Target },
    { to: '/pos', labelKey: 'pos' as const, icon: ShoppingBag, writeOnly: true },
    { to: '/delayed-orders', labelKey: 'delayedOrders' as const, icon: CalendarClock, writeOnly: true },
    { to: '/orders', labelKey: 'orders' as const, icon: ShoppingCart },
    { to: '/ai-analytics', labelKey: 'aiAnalytics' as const, icon: Sparkles },
    { to: '/whatsapp', labelKey: 'whatsapp' as const, icon: MessageCircle },
    { to: '/media', labelKey: 'media' as const, icon: Images },
    { to: '/inventory', labelKey: 'inventory' as const, icon: Package },
    { to: '/inventory-analytics', labelKey: 'inventoryAnalytics' as const, icon: Boxes },
    { to: '/customers', labelKey: 'customers' as const, icon: Users },
    { to: '/customers-analytics', labelKey: 'customersAnalytics' as const, icon: LineChart },
    { to: '/suppliers', labelKey: 'suppliers' as const, icon: Truck, adminOnly: true },
    { to: '/suppliers-analytics', labelKey: 'suppliersAnalytics' as const, icon: Warehouse, adminOnly: true },
    { to: '/restock-orders', labelKey: 'restockOrders' as const, icon: ClipboardList, adminOnly: true },
    { to: '/recipes', labelKey: 'recipes' as const, icon: ChefHat, adminOnly: true },
    { to: '/conversions', labelKey: 'conversions' as const, icon: ArrowRightLeft, adminOnly: true },
    { to: '/labour', labelKey: 'labour' as const, icon: HardHat, adminOnly: true },
    { to: '/labour-analytics', labelKey: 'labourAnalytics' as const, icon: Activity, adminOnly: true },
    { to: '/miscellaneous-expenditure', labelKey: 'miscExpenditure' as const, icon: Receipt, adminOnly: true },
    { to: '/community', labelKey: 'community' as const, icon: UsersRound, superAdminOnly: true },
    { to: '/profile', labelKey: 'profile' as const, icon: UserCircle },
    { to: '/settings', labelKey: 'settings' as const, icon: Settings },
    { to: '/help', labelKey: 'help' as const, icon: HelpCircle }
]

export function AppLayout() {
    useGetMeQuery()
    const { t } = useLanguage()
    const { canWrite, isSuperAdmin } = usePermissions()
    const user = useSelector(selectCurrentUser)
    const [logout] = useLogoutMutation()
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()

    const handleLogout = async () => {
        try {
            await logout().unwrap()
            navigate('/')
            toast.success(t.nav.loggedOut)
        } catch {
            toast.error(t.nav.logoutFailed)
        }
    }

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader className="border-b px-4 py-4">
                    <div className="flex items-center gap-2">
                        <LayoutDashboard className="size-5" />
                        <span className="font-semibold">{constants.NAME}</span>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>{t.nav.navigation}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems
                                    .filter((item) => {
                                        if (item.superAdminOnly && !isSuperAdmin) return false
                                        if (item.adminOnly && !canWrite) return false
                                        if (item.writeOnly && !canWrite) return false
                                        return true
                                    })
                                    .map((item) => (
                                        <SidebarMenuItem key={item.to}>
                                            <SidebarMenuButton asChild>
                                                <NavLink
                                                    to={item.to}
                                                    end={item.to === '/'}
                                                    className={({ isActive }) => (isActive ? 'bg-sidebar-accent' : '')}>
                                                    <item.icon className="size-4" />
                                                    <span>{t.nav[item.labelKey]}</span>
                                                </NavLink>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter className="border-t p-4">
                    <div className="mb-2 text-sm">
                        <p className="font-medium">{user?.name ?? t.common.user}</p>
                        <p className="text-muted-foreground text-xs">{user?.role ?? ''}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            {t.nav.theme}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleLogout}>
                            <LogOut className="size-4" />
                        </Button>
                    </div>
                </SidebarFooter>
            </Sidebar>
            <main className="flex min-h-screen flex-1 flex-col">
                <header className="flex h-14 items-center gap-2 border-b px-4">
                    <SidebarTrigger />
                </header>
                <div className="flex-1 overflow-auto p-6">
                    <Outlet />
                </div>
            </main>
        </SidebarProvider>
    )
}
