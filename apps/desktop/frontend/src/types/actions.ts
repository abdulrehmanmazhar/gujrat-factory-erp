export type ActionName =
    | 'check'
    | 'click'
    | 'hover'
    | 'closePage'
    | 'fill'
    | 'navigate'
    | 'openPage'
    | 'press'
    | 'select'
    | 'uncheck'
    | 'setInputFiles'
    | 'assertText'
    | 'assertValue'
    | 'assertChecked'
    | 'assertVisible'
    | 'assertSnapshot'

export type BaseSignal = {
    nope: unknown
}

export type NavigationSignal = BaseSignal & {
    name: 'navigation'
    url: string
}

export type PopupSignal = BaseSignal & {
    name: 'popup'
    popupAlias: string
}

export type DownloadSignal = BaseSignal & {
    name: 'download'
    downloadAlias: string
}

export type DialogSignal = BaseSignal & {
    name: 'dialog'
    dialogAlias: string
}

export type Signal = NavigationSignal | PopupSignal | DownloadSignal | DialogSignal

export type ActionBase = {
    name: ActionName
    signals: Signal[]
    ariaSnapshot?: string
    preconditionSelector?: string
}

export type ActionWithSelector = ActionBase & {
    selector: string
    ref?: string
}

export type ClickAction = ActionWithSelector & {
    name: 'click'
    button: 'left' | 'middle' | 'right'
    modifiers: number
    clickCount: number
    // position?: Point
}

export type HoverAction = ActionWithSelector & {
    name: 'hover'
    // position?: Point
}

export type CheckAction = ActionWithSelector & {
    name: 'check'
}

export type UncheckAction = ActionWithSelector & {
    name: 'uncheck'
}

export type FillAction = ActionWithSelector & {
    name: 'fill'
    text: string
}

export type NavigateAction = ActionBase & {
    name: 'navigate'
    url: string
}

export type OpenPageAction = ActionBase & {
    name: 'openPage'
    url: string
}

export type ClosesPageAction = ActionBase & {
    name: 'closePage'
}

export type PressAction = ActionWithSelector & {
    name: 'press'
    key: string
    modifiers: number
}

export type SelectAction = ActionWithSelector & {
    name: 'select'
    options: string[]
}

export type SetInputFilesAction = ActionWithSelector & {
    name: 'setInputFiles'
    files: string[]
}

export type AssertTextAction = ActionWithSelector & {
    name: 'assertText'
    text: string
    substring: boolean
}

export type AssertValueAction = ActionWithSelector & {
    name: 'assertValue'
    value: string
}

export type AssertCheckedAction = ActionWithSelector & {
    name: 'assertChecked'
    checked: boolean
}

export type AssertVisibleAction = ActionWithSelector & {
    name: 'assertVisible'
}

export type AssertSnapshotAction = ActionWithSelector & {
    name: 'assertSnapshot'
    ariaSnapshot: string
}

export type TPlaywrightAction =
    | ClickAction
    | HoverAction
    | CheckAction
    | ClosesPageAction
    | OpenPageAction
    | UncheckAction
    | FillAction
    | NavigateAction
    | PressAction
    | SelectAction
    | SetInputFilesAction
    | AssertCheckedAction
    | AssertSnapshotAction
    | AssertTextAction
    | AssertValueAction
    | AssertVisibleAction

export type TNetworkInterceptorAction = {
    name: 'networkInterceptionAction'
    url: string
    type: 'http' | 'ws'
    action: 'request' | 'response'
    body: unknown // this would be ajv compatible schema
}

export type PlaywrightConfigs = {
    userDataDir: string
    launch: {
        // 🔹 Core
        headless?: boolean
        executablePath?: string
        channel?: 'chrome'
        args?: string[]
        ignoreDefaultArgs?: boolean | string[]

        // 🔹 Debug / Dev
        devtools?: boolean
        slowMo?: number
        timeout?: number

        // 🔹 Network
        proxy?: {
            server: string
            bypass: string
            username: string
            password: string
        }

        // 🔹 Security
        ignoreHTTPSErrors?: boolean
        bypassCSP?: boolean
        httpCredentials?: {
            username: string
            password: string
        }

        // 🔹 Downloads
        acceptDownloads?: boolean
        downloadsPath?: string

        // 🔹 Locale / Region
        locale?: string
        timezoneId?: string
        geolocation?: {
            latitude: number
            longitude: number
            accuracy?: number
        }
        permissions?: string[]

        // 🔹 Device / View
        viewport?: {
            width: number
            height: number
        } | null
        screen?: {
            width: number
            height: number
        }
        deviceScaleFactor?: number
        isMobile?: boolean
        hasTouch?: boolean

        // 🔹 Browser Identity
        userAgent?: string
        extraHTTPHeaders?: Record<string, string>

        // 🔹 Storage / Session
        storageState?:
            | string
            | {
                  cookies?: unknown[]
                  origins?: unknown[]
              }

        // 🔹 Network Behavior
        offline?: boolean

        // 🔹 Media / Rendering
        colorScheme?: 'light' | 'dark' | 'no-preference'
        reducedMotion?: 'reduce' | 'no-preference'
        forcedColors?: 'active' | 'none'

        // 🔹 JS Control
        javaScriptEnabled?: boolean

        // 🔹 Recording / Debugging
        recordHar?: {
            path: string
            content?: 'omit' | 'embed' | 'attach'
            mode?: 'full' | 'minimal'
        }
        recordVideo?: {
            dir: string
            size?: {
                width: number
                height: number
            }
        }

        // 🔹 Service Workers
        serviceWorkers?: 'allow' | 'block'

        // 🔹 Base URL (useful for routing systems)
        baseURL?: string

        // 🔹 Strict mode
        strictSelectors?: boolean

        // 🔹 Advanced (rare)
        clientCertificates?: Array<{
            origin: string
            certPath?: string
            keyPath?: string
            passphrase?: string
        }>
    }
    execution: {
        blockUserInput: boolean
        humanInLoopOnError: boolean
        maxRetries: number
        actionTimeout: number
        navigationTimeout: number
    }
}

export type LaunchBrowserAction = {
    name: 'launchBrowser'
    config: PlaywrightConfigs
}

export type CloseBrowserAction = {
    name: 'closeBrowser'
}

export type TBrowserAction = LaunchBrowserAction | CloseBrowserAction

export type CustomServerAction = {
    name: 'customServerAction'
    type: 'custom'
    runtimeEnvRef: 'environment' | 'context'
    action: {
        url: string
        method: 'GET' | 'POST' | 'PUT' | 'DELETE'
        body: unknown
    }
}

export type BuiltInServerAction = {
    name: 'builtInServerAction'
    type: 'built-in'
    runtimeEnvRef: 'environment' | 'context'
    action: {
        timeout: number
        function: 'get-otp'
    }
}

export type TServerAction = BuiltInServerAction | CustomServerAction

export type TInterruptionAction = {
    name: 'interruptionAction'
    timeout: number
    preconditionSelector: string | null
    resolve: {
        selector: string
        attr: 'visible' | 'hidden'
    }
}

export type TAction = TPlaywrightAction | TNetworkInterceptorAction | TBrowserAction | TServerAction | TInterruptionAction

// export type ControlFlowAction = IfElseAction |

// // {
// //     name: 'controlFlowAction'
// //     type: 'if' | 'loop'
// //     condition: 'check'
// // }

// export type IfElseAction = {
//     name: 'ifElseAction'
//     condition: 'checkEqual' | 'checkGreaterThan' | 'checkLessThan'
// }
