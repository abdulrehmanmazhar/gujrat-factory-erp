import { RequireSuperAdmin, RequireWrite } from '@/components/auth/RequireRole'
import { AppLayout } from '@/components/layout/AppLayout'
import CommunityPage from '@/pages/CommunityPage'
import CustomersPage from '@/pages/CustomersPage'
import DashboardPage from '@/pages/DashboardPage'
import HelpPage from '@/pages/HelpPage'
import HomePage from '@/pages/HomePage'
import InventoryPage from '@/pages/InventoryPage'
import InventoryAnalyticsPage from '@/pages/InventoryAnalyticsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import OrdersPage from '@/pages/OrdersPage'
import SuppliersPage from '@/pages/SuppliersPage'
import RestockOrdersPage from '@/pages/RestockOrdersPage'
import RecipesPage from '@/pages/RecipesPage'
import ConversionPage from '@/pages/ConversionPage'
import LabourPage from '@/pages/LabourPage'
import LabourAnalyticsPage from '@/pages/LabourAnalyticsPage'
import PosPage from '@/pages/PosPage'
import DelayedOrderPage from '@/pages/DelayedOrderPage'
import WhatsAppPage from '@/pages/WhatsAppPage'
import MediaPage from '@/pages/MediaPage'
import ProfilePage from '@/pages/ProfilePage'
import SettingsPage from '@/pages/SettingsPage'
import AiAnalyticsPage from '@/pages/AiAnalyticsPage'
import MiscellaneousExpenditurePage from '@/pages/MiscellaneousExpenditurePage'
import CustomersAnalyticsPage from '@/pages/CustomersAnalyticsPage'
import SuppliersAnalyticsPage from '@/pages/SuppliersAnalyticsPage'
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
                    path="media"
                    element={<MediaPage />}
                />
                <Route
                    path="inventory"
                    element={<InventoryPage />}
                />
                <Route
                    path="inventory-analytics"
                    element={<InventoryAnalyticsPage />}
                />
                <Route
                    path="customers"
                    element={<CustomersPage />}
                />
                <Route
                    path="customers-analytics"
                    element={<CustomersAnalyticsPage />}
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
                    path="suppliers-analytics"
                    element={
                        <RequireWrite>
                            <SuppliersAnalyticsPage />
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
                    path="conversions"
                    element={
                        <RequireWrite>
                            <ConversionPage />
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
                    path="labour-analytics"
                    element={
                        <RequireWrite>
                            <LabourAnalyticsPage />
                        </RequireWrite>
                    }
                />
                <Route
                    path="miscellaneous-expenditure"
                    element={
                        <RequireWrite>
                            <MiscellaneousExpenditurePage />
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
                <Route
                    path="ai-analytics"
                    element={<AiAnalyticsPage />}
                />
            </Route>
            <Route
                path="*"
                element={<NotFoundPage />}
            />
        </Routes>
    )
}
