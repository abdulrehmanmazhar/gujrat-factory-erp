import { PageHeader } from '@/components/shared/PageHeader'
import { WhatsAppQrCard } from '@/components/settings/WhatsAppQrCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/useTheme'
import constants from '@/constants/app'

export default function SettingsPage() {
    const { theme, setTheme } = useTheme()

    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                description="Application preferences and integrations"
            />

            <Card>
                <CardHeader>
                    <CardTitle>Appearance</CardTitle>
                    <CardDescription>Customize how {constants.NAME} looks</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                    <Label htmlFor="dark-mode">Dark mode</Label>
                    <Switch
                        id="dark-mode"
                        checked={theme === 'dark'}
                        onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    />
                </CardContent>
            </Card>

            <WhatsAppQrCard />
        </div>
    )
}
