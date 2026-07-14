import { RequireSuperAdmin, RequireWrite } from '@/components/auth/RequireRole'
import { AppLayout } from '@/components/layout/AppLayout'
import CommunityPage from '@/pages/CommunityPage'
import CustomersPage from '@/pages/CustomersPage'
import DashboardPage from '@/pages/DashboardPage'
import HelpPage from '@/pages/HelpPage'
import HomePage from '@/pages/HomePage'
import InventoryPage from '@/pages/InventoryPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OrdersPage from '@/pages/OrdersPage'
import SuppliersPage from '@/pages/SuppliersPage'
import RestockOrdersPage from '@/pages/RestockOrdersPage'
import RecipesPage from '@/pages/RecipesPage'
import LabourPage from '@/pages/LabourPage'
import PosPage from '@/pages/PosPage'
import DelayedOrderPage from '@/pages/DelayedOrderPage'
import WhatsAppPage from '@/pages/WhatsAppPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import { Route, Routes } from 'react-router-dom'

export default function Router() {
    return (
        <Routes>
            <Route element={<AppLayout />}>
                <Route
                    index
                    element={<HomePage />}
                />
                <Route
                    path="dashboard"
                    element={<DashboardPage />}
                />
                <Route
                    path="orders"
                    element={<OrdersPage />}
                />
                <Route
                    path="pos"
                    element={
                        <RequireWrite>
                            <PosPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="delayed-orders"
                    element={
                        <RequireWrite>
                            <DelayedOrderPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="whatsapp"
                    element={<WhatsAppPage />}
                />
                <Route
                    path="inventory"
                    element={<InventoryPage />}
                />
                <Route
                    path="customers"
                    element={<CustomersPage />}
                />
                <Route
                    path="suppliers"
                    element={
                        <RequireWrite>
                            <SuppliersPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="restock-orders"
                    element={
                        <RequireWrite>
                            <RestockOrdersPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="recipes"
                    element={
                        <RequireWrite>
                            <RecipesPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="labour"
                    element={
                        <RequireWrite>
                            <LabourPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="community"
                    element={
                        <RequireSuperAdmin>
                            <CommunityPage />
                        </RequireSuperAdmin>
                    }
                />
                <Route
                    path="profile"
                    element={<ProfilePage />}
                />
                <Route
                    path="settings"
                    element={<SettingsPage />}
                />
                <Route
                    path="help"
                    element={<HelpPage />}
                />
            </Route>
            <Route
                path="*"
                element={<NotFoundPage />}
            />
        </Routes>
    )
}
