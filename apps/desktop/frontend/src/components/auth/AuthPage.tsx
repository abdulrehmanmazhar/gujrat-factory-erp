import {
    useLoginMutation,
    useRegisterMutation,
    useActivateUserMutation,
    useForgotPasswordMutation,
    useResetPasswordMutation
} from '@/redux/api/authApi'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import constants from '@/constants/app'
import { getApiErrorMessage } from '@/lib/errors'
import { ArrowLeft, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type AuthTab = 'login' | 'signup'

export function AuthPage() {
    const [tab, setTab] = useState<AuthTab>('login')
    const [loginEmail, setLoginEmail] = useState('')

    return (
        <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{constants.NAME}</CardTitle>
                    <CardDescription>{tab === 'login' ? 'Sign in to your account' : 'Create a new account'}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs
                        value={tab}
                        onValueChange={(v) => setTab(v as AuthTab)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="login">Sign in</TabsTrigger>
                            <TabsTrigger value="signup">Sign up</TabsTrigger>
                        </TabsList>
                        <TabsContent
                            value="login"
                            className="mt-4">
                            <LoginPanel defaultEmail={loginEmail} />
                        </TabsContent>
                        <TabsContent
                            value="signup"
                            className="mt-4">
                            <SignUpPanel
                                onActivated={(email) => {
                                    setLoginEmail(email)
                                    setTab('login')
                                }}
                            />
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    )
}

function LoginPanel({ defaultEmail }: { defaultEmail: string }) {
    const [step, setStep] = useState<'login' | 'forgot' | 'reset'>('login')
    const [email, setEmail] = useState(defaultEmail)
    const [password, setPassword] = useState('')
    const [login, { isLoading }] = useLoginMutation()

    useEffect(() => {
        if (defaultEmail) setEmail(defaultEmail)
    }, [defaultEmail])

    if (step === 'forgot') {
        return (
            <ForgotPasswordPanel
                defaultEmail={email}
                onBack={() => setStep('login')}
                onCodeSent={(sentEmail, resetToken) => {
                    setEmail(sentEmail)
                    sessionStorage.setItem('erp_reset_token', resetToken)
                    setStep('reset')
                }}
            />
        )
    }

    if (step === 'reset') {
        return (
            <ResetPasswordPanel
                email={email}
                resetToken={sessionStorage.getItem('erp_reset_token') ?? ''}
                onBack={() => setStep('forgot')}
                onDone={() => {
                    sessionStorage.removeItem('erp_reset_token')
                    setPassword('')
                    setStep('login')
                }}
            />
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            await login({ email, password }).unwrap()
            toast.success('Signed in successfully')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Invalid email or password'))
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                />
            </div>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Password</Label>
                    <button
                        type="button"
                        className="text-xs text-primary hover:underline"
                        onClick={() => setStep('forgot')}>
                        Forgot password?
                    </button>
                </div>
                <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
            </div>
            <Button
                type="submit"
                className="w-full"
                disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
        </form>
    )
}

function ForgotPasswordPanel({
    defaultEmail,
    onBack,
    onCodeSent
}: {
    defaultEmail: string
    onBack: () => void
    onCodeSent: (email: string, resetToken: string) => void
}) {
    const [email, setEmail] = useState(defaultEmail)
    const [forgotPassword, { isLoading }] = useForgotPasswordMutation()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const result = await forgotPassword({ email }).unwrap()
            if (!result.resetToken) {
                toast.message('If an account exists, a reset code was sent to your email')
                return
            }
            toast.success('Reset code sent to your email')
            onCodeSent(email, result.resetToken)
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Could not send reset code'))
        }
    }

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-4">
            <p className="text-sm text-muted-foreground">Enter your account email and we will send a 4-digit reset code.</p>
            <div className="space-y-2">
                <Label htmlFor="forgot-email">Email</Label>
                <Input
                    id="forgot-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
            </div>
            <Button
                type="submit"
                className="w-full"
                disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send reset code'}
            </Button>
            <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={onBack}>
                <ArrowLeft className="size-4" /> Back to sign in
            </Button>
        </form>
    )
}

function ResetPasswordPanel({ email, resetToken, onBack, onDone }: { email: string; resetToken: string; onBack: () => void; onDone: () => void }) {
    const [resetCode, setResetCode] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [resetPassword, { isLoading }] = useResetPasswordMutation()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (resetCode.length !== 4) {
            toast.error('Enter the 4-digit reset code')
            return
        }
        try {
            await resetPassword({
                reset_token: resetToken,
                reset_code: resetCode,
                new_password: newPassword
            }).unwrap()
            toast.success('Password reset. You can sign in now.')
            onDone()
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Password reset failed'))
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
                <Mail className="size-4 shrink-0 text-muted-foreground" />
                <p>
                    Enter the code sent to <span className="font-medium">{email}</span> and choose a new password.
                </p>
            </div>
            <form
                onSubmit={handleSubmit}
                className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="reset-code">Reset code</Label>
                    <Input
                        id="reset-code"
                        inputMode="numeric"
                        pattern="[0-9]{4}"
                        maxLength={4}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="text-center text-lg tracking-[0.5em]"
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reset-password">New password</Label>
                    <Input
                        id="reset-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        minLength={6}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="reset-confirm">Confirm password</Label>
                    <Input
                        id="reset-confirm"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        minLength={6}
                        required
                    />
                </div>
                <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}>
                    {isLoading ? 'Resetting...' : 'Reset password'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={onBack}>
                    <ArrowLeft className="size-4" /> Back
                </Button>
            </form>
        </div>
    )
}

function SignUpPanel({ onActivated }: { onActivated: (email: string) => void }) {
    const [step, setStep] = useState<'register' | 'verify'>('register')
    const [register, { isLoading: registering }] = useRegisterMutation()
    const [activateUser, { isLoading: activating }] = useActivateUserMutation()

    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [activationToken, setActivationToken] = useState('')
    const [activationCode, setActivationCode] = useState('')

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password !== confirmPassword) {
            toast.error('Passwords do not match')
            return
        }
        if (password.length < 6) {
            toast.error('Password must be at least 6 characters')
            return
        }
        try {
            const result = await register({ name, email, password }).unwrap()
            setActivationToken(result.activationToken)
            setStep('verify')
            toast.success('Verification code sent to your email')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Registration failed'))
        }
    }

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        if (activationCode.length !== 4) {
            toast.error('Enter the 4-digit verification code')
            return
        }
        try {
            await activateUser({
                activation_token: activationToken,
                activation_code: activationCode
            }).unwrap()
            toast.success('Account activated. If you are the first user, you can sign in as super admin.')
            onActivated(email)
            setStep('register')
            setName('')
            setPassword('')
            setConfirmPassword('')
            setActivationCode('')
            setActivationToken('')
        } catch (err) {
            toast.error(getApiErrorMessage(err, 'Invalid verification code'))
        }
    }

    if (step === 'verify') {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <p>
                        We sent a 4-digit code to <span className="font-medium">{email}</span>. Enter it below to activate your account.
                    </p>
                </div>
                <form
                    onSubmit={handleVerify}
                    className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="activation-code">Verification code</Label>
                        <Input
                            id="activation-code"
                            inputMode="numeric"
                            pattern="[0-9]{4}"
                            maxLength={4}
                            value={activationCode}
                            onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="1234"
                            className="text-center text-lg tracking-[0.5em]"
                            required
                            autoFocus
                        />
                    </div>
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={activating}>
                        {activating ? 'Verifying...' : 'Verify & activate'}
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => setStep('register')}>
                        <ArrowLeft className="size-4" /> Back to sign up
                    </Button>
                </form>
            </div>
        )
    }

    return (
        <form
            onSubmit={handleRegister}
            className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="signup-name">Full name</Label>
                <Input
                    id="signup-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                    id="signup-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <Input
                    id="signup-confirm"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                />
            </div>
            <Button
                type="submit"
                className="w-full"
                disabled={registering}>
                {registering ? 'Creating account...' : 'Create account'}
            </Button>
        </form>
    )
}
