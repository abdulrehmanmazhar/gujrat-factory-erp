import { PageHeader } from '@/components/shared/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/hooks/useTheme'
import constants from '@/constants/app'
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'

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

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageCircle className="size-5" />
                        WhatsApp
                    </CardTitle>
                    <CardDescription>Manage WhatsApp linking, logout, and send queue on the dedicated page</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link to="/whatsapp">Open WhatsApp page</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    )
}
