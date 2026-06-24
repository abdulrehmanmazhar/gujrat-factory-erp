import { AppLayout } from '@/components/layout/AppLayout'
import CommunityPage from '@/pages/CommunityPage'
import CustomersPage from '@/pages/CustomersPage'
import DashboardPage from '@/pages/DashboardPage'
import HelpPage from '@/pages/HelpPage'
import HomePage from '@/pages/HomePage'
import InventoryPage from '@/pages/InventoryPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OrdersPage from '@/pages/OrdersPage'
import PaymentsPage from '@/pages/PaymentsPage'
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
                    element={<PosPage />}
                />
                <Route
                    path="delayed-orders"
                    element={<DelayedOrderPage />}
                />
                <Route
                    path="whatsapp"
                    element={<WhatsAppPage />}
                />
                <Route
                    path="payments"
                    element={<PaymentsPage />}
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
                    element={<SuppliersPage />}
                />
                <Route
                    path="restock-orders"
                    element={<RestockOrdersPage />}
                />
                <Route
                    path="recipes"
                    element={<RecipesPage />}
                />
                <Route
                    path="labour"
                    element={<LabourPage />}
                />
                <Route
                    path="community"
                    element={<CommunityPage />}
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
