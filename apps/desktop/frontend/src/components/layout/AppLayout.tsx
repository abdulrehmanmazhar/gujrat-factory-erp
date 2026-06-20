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
import { useLogoutMutation } from '@/redux/api/authApi'
import { selectCurrentUser } from '@/redux/slices/authSlice'
import {
    BarChart3,
    CreditCard,
    HelpCircle,
    LayoutDashboard,
    LogOut,
    Package,
    Settings,
    ShoppingBag,
    ShoppingCart,
    Target,
    Truck,
    Users,
    UsersRound
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'sonner'
import { useGetMeQuery } from '@/redux/api/authApi'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

const navItems = [
    { to: '/', label: 'Home', icon: BarChart3 },
    { to: '/dashboard', label: 'Dashboard', icon: Target },
    { to: '/pos', label: 'POS', icon: ShoppingBag },
    { to: '/orders', label: 'Orders', icon: ShoppingCart },
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/inventory', label: 'Inventory', icon: Package },
    { to: '/customers', label: 'Customers', icon: Users },
    { to: '/suppliers', label: 'Suppliers', icon: Truck },
    { to: '/community', label: 'Community', icon: UsersRound },
    { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/help', label: 'Help', icon: HelpCircle }
]

export function AppLayout() {
    useGetMeQuery()
    const user = useSelector(selectCurrentUser)
    const [logout] = useLogoutMutation()
    const navigate = useNavigate()
    const { theme, setTheme } = useTheme()

    const handleLogout = async () => {
        try {
            await logout().unwrap()
            navigate('/')
            toast.success('Logged out')
        } catch {
            toast.error('Logout failed')
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
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems.map((item) => (
                                    <SidebarMenuItem key={item.to}>
                                        <SidebarMenuButton asChild>
                                            <NavLink
                                                to={item.to}
                                                end={item.to === '/'}
                                                className={({ isActive }) => (isActive ? 'bg-sidebar-accent' : '')}>
                                                <item.icon className="size-4" />
                                                <span>{item.label}</span>
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
                        <p className="font-medium">{user?.name ?? 'User'}</p>
                        <p className="text-muted-foreground text-xs">{user?.role ?? ''}</p>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            Theme
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
