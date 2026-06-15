// import { AppSidebar } from "@/components/features/app-sidebar";
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
// import Footer from "../footer";
import { AppSidebar } from './AppSidebar'
// import Footer from '../footer'
// import Footer from '@/components/features/Footer'

export default function ShadcnSidebarLayout({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider>
            <AppSidebar />

            <main className="relative flex h-screen w-full flex-col min-w-0">
                <SidebarTrigger className="fixed z-50 top-4" />

                <div className="flex-1">{children}</div>

                {/* Footer */}
                {/* <div className="pointer-events-none sticky bottom-0 flex justify-center bg-background">
                    <Footer className="pointer-events-auto mb-1" />
                </div> */}
            </main>
        </SidebarProvider>
    )
}
