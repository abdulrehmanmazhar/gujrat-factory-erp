import type {
    TInterruptionAction,
    // TBrowserAction,
    TNetworkInterceptorAction,
    // TPlaywrightAction,
    // TServerAction,
    ClickAction,
    LaunchBrowserAction,
    BuiltInServerAction
} from '@/types/actions'
// import type { Node } from 'reactflow'

// export const playWrightActionNodes: Node<TPlaywrightAction>[] = [
//     {
//         id: 'click-1',
//         data: {
//             name: 'click',
//             button: 'left',
//             modifiers: 0,
//             clickCount: 1
//         },
//         position: { x: 100, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'click-double-1',
//         data: {
//             name: 'click',
//             button: 'left',
//             modifiers: 0,
//             clickCount: 2
//         },
//         position: { x: 100, y: 250 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'click-right-1',
//         data: {
//             name: 'click',
//             button: 'right',
//             modifiers: 0,
//             clickCount: 1
//         },
//         position: { x: 100, y: 400 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'hover-1',
//         data: {
//             name: 'hover'
//         },
//         position: { x: 400, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'check-1',
//         data: {
//             name: 'check'
//         },
//         position: { x: 400, y: 250 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'uncheck-1',
//         data: {
//             name: 'uncheck'
//         },
//         position: { x: 400, y: 400 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'fill-1',
//         data: {
//             name: 'fill',
//             text: 'username@example.com'
//         },
//         position: { x: 700, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'fill-long-1',
//         data: {
//             name: 'fill',
//             text: 'This is a very long text message that might get truncated in the node display but still shows the action properly'
//         },
//         position: { x: 700, y: 250 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'press-1',
//         data: {
//             name: 'press',
//             key: 'Enter',
//             modifiers: 0
//         },
//         position: { x: 700, y: 400 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'press-modifier-1',
//         data: {
//             name: 'press',
//             key: 'a',
//             modifiers: 1 // Ctrl/Cmd
//         },
//         position: { x: 700, y: 550 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'select-1',
//         data: {
//             name: 'select',
//             options: ['option1', 'option2', 'option3']
//         },
//         position: { x: 1000, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'select-many-1',
//         data: {
//             name: 'select',
//             options: ['red', 'green', 'blue', 'yellow', 'black', 'white']
//         },
//         position: { x: 1000, y: 250 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'setInputFiles-1',
//         data: {
//             name: 'setInputFiles',
//             files: ['document.pdf']
//         },
//         position: { x: 1000, y: 400 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'setInputFiles-multiple-1',
//         data: {
//             name: 'setInputFiles',
//             files: ['image1.jpg', 'image2.png', 'document.pdf']
//         },
//         position: { x: 1000, y: 550 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'navigate-1',
//         data: {
//             name: 'navigate',
//             url: 'https://example.com'
//         },
//         position: { x: 1300, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'navigate-deep-1',
//         data: {
//             name: 'navigate',
//             url: 'https://example.com/products/category/item/12345?ref=homepage&utm_source=google'
//         },
//         position: { x: 1300, y: 250 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'openPage-1',
//         data: {
//             name: 'openPage',
//             url: 'https://new-tab.com'
//         },
//         position: { x: 1300, y: 400 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'closePage-1',
//         data: {
//             name: 'closePage'
//         },
//         position: { x: 1300, y: 550 },
//         type: 'playwrightAction'
//     }
// ]

// export const browserDummyNodes: Node<TBrowserAction>[] = [
//     {
//         id: 'launch-basic-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: {
//                     headless: false,
//                     channel: 'chrome'
//                 },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'browserAction'
//     },
//     {
//         id: 'launch-headless-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: {
//                     headless: true,
//                     channel: 'chromium',
//                     slowMo: 100,
//                     ignoreHTTPSErrors: true
//                 },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'browserAction'
//     },
//     {
//         id: 'launch-devtools-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '/custom/profile/path',
//                 launch: {
//                     channel: 'chrome',
//                     devtools: true,
//                     viewport: { width: 1920, height: 1080 },
//                     locale: 'en-US',
//                     timezoneId: 'America/New_York'
//                 },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: true,
//                     maxRetries: 5,
//                     actionTimeout: 60000,
//                     navigationTimeout: 60000
//                 }
//             }
//         },
//         position: { x: 100, y: 500 },
//         type: 'browserAction'
//     },
//     {
//         id: 'launch-proxy-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: {
//                     channel: 'msedge',
//                     proxy: {
//                         server: 'http://proxy.company.com:8080',
//                         bypass: 'localhost,127.0.0.1'
//                     },
//                     acceptDownloads: true,
//                     downloadsPath: '/downloads'
//                 },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 100, y: 700 },
//         type: 'browserAction'
//     },
//     {
//         id: 'launch-mobile-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: {
//                     channel: 'chrome',
//                     isMobile: true,
//                     viewport: { width: 375, height: 667 },
//                     deviceScaleFactor: 2,
//                     hasTouch: true,
//                     userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)'
//                 },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 450, y: 100 },
//         type: 'browserAction'
//     },
//     {
//         id: 'launch-full-features-1',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: './user-data',
//                 launch: {
//                     headless: false,
//                     channel: 'chrome',
//                     args: ['--disable-web-security', '--disable-features=IsolateOrigins,site-per-process'],
//                     ignoreDefaultArgs: ['--enable-automation'],
//                     devtools: true,
//                     slowMo: 50,
//                     timeout: 45000,
//                     ignoreHTTPSErrors: true,
//                     bypassCSP: true,
//                     acceptDownloads: true,
//                     locale: 'ja-JP',
//                     timezoneId: 'Asia/Tokyo',
//                     geolocation: { latitude: 35.6895, longitude: 139.6917, accuracy: 100 },
//                     permissions: ['geolocation', 'notifications'],
//                     viewport: { width: 1440, height: 900 },
//                     userAgent: 'Custom User Agent',
//                     javaScriptEnabled: true,
//                     serviceWorkers: 'allow',
//                     baseURL: 'https://staging.example.com'
//                 },
//                 execution: {
//                     blockUserInput: true,
//                     humanInLoopOnError: true,
//                     maxRetries: 2,
//                     actionTimeout: 45000,
//                     navigationTimeout: 60000
//                 }
//             }
//         },
//         position: { x: 450, y: 300 },
//         type: 'browserAction'
//     },
//     {
//         id: 'close-browser-1',
//         data: {
//             name: 'closeBrowser'
//         },
//         position: { x: 450, y: 550 },
//         type: 'browserAction'
//     },
//     {
//         id: 'close-browser-after-workflow-1',
//         data: {
//             name: 'closeBrowser'
//         },
//         position: { x: 450, y: 700 },
//         type: 'browserAction'
//     }
// ]

// // Example workflow connecting browser actions with playwright actions
// export const browserWorkflowNodes: Node[] = [
//     {
//         id: 'launch',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: { headless: false, channel: 'chrome' },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'browserAction'
//     },
//     {
//         id: 'navigate',
//         data: { name: 'navigate', url: 'https://example.com' },
//         position: { x: 100, y: 300 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'click',
//         data: { name: 'click', button: 'left', modifiers: 0, clickCount: 1 },
//         position: { x: 100, y: 500 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'close',
//         data: { name: 'closeBrowser' },
//         position: { x: 100, y: 700 },
//         type: 'browserAction'
//     }
// ]

// export const networkInterceptorDummyNodes: Node<TNetworkInterceptorAction>[] = [
//     {
//         id: 'http-request-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://api.example.com/users',
//             type: 'http',
//             action: 'request',
//             body: undefined
//         },
//         position: { x: 100, y: 100 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'http-request-with-schema-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://api.example.com/users',
//             type: 'http',
//             action: 'request',
//             body: {
//                 type: 'object',
//                 properties: {
//                     name: { type: 'string' },
//                     email: { type: 'string', format: 'email' }
//                 },
//                 required: ['name', 'email']
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'http-response-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://api.example.com/posts/**',
//             type: 'http',
//             action: 'response',
//             body: undefined
//         },
//         position: { x: 100, y: 500 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'http-response-with-schema-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://api.example.com/posts/**',
//             type: 'http',
//             action: 'response',
//             body: {
//                 type: 'array',
//                 items: {
//                     type: 'object',
//                     properties: {
//                         id: { type: 'number' },
//                         title: { type: 'string' },
//                         body: { type: 'string' }
//                     }
//                 }
//             }
//         },
//         position: { x: 100, y: 700 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'ws-request-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'wss://socket.example.com',
//             type: 'ws',
//             action: 'request',
//             body: undefined
//         },
//         position: { x: 450, y: 100 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'ws-request-with-schema-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'wss://socket.example.com',
//             type: 'ws',
//             action: 'request',
//             body: {
//                 type: 'object',
//                 properties: {
//                     event: { type: 'string' },
//                     data: { type: 'object' }
//                 }
//             }
//         },
//         position: { x: 450, y: 300 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'ws-response-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'wss://socket.example.com',
//             type: 'ws',
//             action: 'response',
//             body: undefined
//         },
//         position: { x: 450, y: 500 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'ws-response-with-schema-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'wss://socket.example.com/messages',
//             type: 'ws',
//             action: 'response',
//             body: {
//                 type: 'object',
//                 properties: {
//                     type: { type: 'string' },
//                     payload: { type: 'object' },
//                     timestamp: { type: 'string', format: 'date-time' }
//                 }
//             }
//         },
//         position: { x: 450, y: 700 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'http-wildcard-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://*.example.com/api/v1/*',
//             type: 'http',
//             action: 'request',
//             body: undefined
//         },
//         position: { x: 800, y: 100 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'http-request-graphql-1',
//         data: {
//             name: 'networkInterceptionAction',
//             url: 'https://api.example.com/graphql',
//             type: 'http',
//             action: 'request',
//             body: {
//                 type: 'object',
//                 properties: {
//                     query: { type: 'string' },
//                     variables: { type: 'object' }
//                 }
//             }
//         },
//         position: { x: 800, y: 300 },
//         type: 'networkInterceptor'
//     }
// ]

// // Example workflow with network interceptors
// export const networkWorkflowNodes: Node[] = [
//     {
//         id: 'launch',
//         data: {
//             name: 'launchBrowser',
//             config: {
//                 userDataDir: '',
//                 launch: { headless: false, channel: 'chrome' },
//                 execution: {
//                     blockUserInput: false,
//                     humanInLoopOnError: false,
//                     maxRetries: 3,
//                     actionTimeout: 30000,
//                     navigationTimeout: 30000
//                 }
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'browserAction'
//     },
//     {
//         id: 'interceptor-request',
//         data: {
//             url: 'https://api.example.com/**',
//             type: 'http',
//             action: 'request',
//             body: {
//                 type: 'object',
//                 properties: {
//                     auth: { type: 'string' }
//                 }
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'navigate',
//         data: { name: 'navigate', url: 'https://example.com' },
//         position: { x: 100, y: 500 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'interceptor-response',
//         data: {
//             url: 'https://api.example.com/data',
//             type: 'http',
//             action: 'response',
//             body: {
//                 type: 'object',
//                 properties: {
//                     status: { type: 'string' },
//                     data: { type: 'object' }
//                 }
//             }
//         },
//         position: { x: 100, y: 700 },
//         type: 'networkInterceptor'
//     },
//     {
//         id: 'close',
//         data: { name: 'closeBrowser' },
//         position: { x: 100, y: 900 },
//         type: 'browserAction'
//     }
// ]

// export const interruptionDummyNodes: Node<TInterruptionAction>[] = [
//     {
//         id: 'interruption-1',
//         data: {
//             name: 'interruptionAction',
//             timeout: 5000,
//             preconditionSelector: null,
//             resolve: {
//                 selector: '#loading-spinner',
//                 attr: 'hidden'
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'interruption-2',
//         data: {
//             name: 'interruptionAction',
//             timeout: 10000,
//             preconditionSelector: '.modal-overlay',
//             resolve: {
//                 selector: '.success-message',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'interruption-3',
//         data: {
//             name: 'interruptionAction',
//             timeout: 3000,
//             preconditionSelector: '[data-loading="true"]',
//             resolve: {
//                 selector: '[data-loaded="true"]',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 100, y: 500 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'interruption-4',
//         data: {
//             name: 'interruptionAction',
//             timeout: 15000,
//             preconditionSelector: null,
//             resolve: {
//                 selector: '.toast-notification',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 100, y: 700 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'interruption-5',
//         data: {
//             name: 'interruptionAction',
//             timeout: 2000,
//             preconditionSelector: '.captcha-container',
//             resolve: {
//                 selector: '.captcha-success',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 400, y: 100 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'interruption-6',
//         data: {
//             name: 'interruptionAction',
//             timeout: 8000,
//             preconditionSelector: 'iframe#payment-frame',
//             resolve: {
//                 selector: '.payment-confirmation',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 400, y: 300 },
//         type: 'interruptionAction'
//     }
// ]

// // Example workflow with interruption
// export const workflowWithInterruption: Node[] = [
//     {
//         id: 'navigate',
//         data: { name: 'navigate', url: 'https://example.com' },
//         position: { x: 100, y: 100 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'click',
//         data: { name: 'click', button: 'left', modifiers: 0, clickCount: 1 },
//         position: { x: 100, y: 300 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'interruption',
//         data: {
//             name: 'interruptionAction',
//             timeout: 10000,
//             preconditionSelector: '.loading-state',
//             resolve: {
//                 selector: '.content-loaded',
//                 attr: 'visible'
//             }
//         },
//         position: { x: 100, y: 500 },
//         type: 'interruptionAction'
//     },
//     {
//         id: 'fill',
//         data: { name: 'fill', text: 'user@example.com' },
//         position: { x: 100, y: 700 },
//         type: 'playwrightAction'
//     }
// ]

// export const serverActionDummyNodes: Node<TServerAction>[] = [
//     {
//         id: 'server-custom-get-1',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'environment',
//             action: {
//                 url: 'https://api.example.com/users',
//                 method: 'GET',
//                 body: null
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-custom-post-1',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'context',
//             action: {
//                 url: 'https://api.example.com/auth/login',
//                 method: 'POST',
//                 body: {
//                     email: '{{context.user.email}}',
//                     password: '{{context.user.password}}'
//                 }
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-custom-put-1',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'environment',
//             action: {
//                 url: 'https://api.example.com/users/123',
//                 method: 'PUT',
//                 body: {
//                     name: 'Updated Name'
//                 }
//             }
//         },
//         position: { x: 100, y: 500 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-custom-delete-1',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'context',
//             action: {
//                 url: 'https://api.example.com/users/123',
//                 method: 'DELETE',
//                 body: null
//             }
//         },
//         position: { x: 100, y: 700 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-builtin-otp-1',
//         data: {
//             name: 'serverAction',
//             type: 'built-in',
//             runtimeEnvRef: 'environment',
//             action: {
//                 timeout: 30000,
//                 function: 'get-otp'
//             }
//         },
//         position: { x: 400, y: 100 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-builtin-otp-2',
//         data: {
//             name: 'serverAction',
//             type: 'built-in',
//             runtimeEnvRef: 'context',
//             action: {
//                 timeout: 60000,
//                 function: 'get-otp'
//             }
//         },
//         position: { x: 400, y: 300 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-custom-long-url-1',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'environment',
//             action: {
//                 url: 'https://api.example.com/v1/users/123/posts/comments?include=author&sort=desc&limit=100',
//                 method: 'GET',
//                 body: null
//             }
//         },
//         position: { x: 400, y: 500 },
//         type: 'serverAction'
//     }
// ]

// // Example workflow with server actions
// export const serverWorkflowNodes: Node[] = [
//     {
//         id: 'server-get-users',
//         data: {
//             name: 'serverAction',
//             type: 'custom',
//             runtimeEnvRef: 'environment',
//             action: {
//                 url: 'https://api.example.com/users',
//                 method: 'GET',
//                 body: null
//             }
//         },
//         position: { x: 100, y: 100 },
//         type: 'serverAction'
//     },
//     {
//         id: 'server-get-otp',
//         data: {
//             name: 'serverAction',
//             type: 'built-in',
//             runtimeEnvRef: 'context',
//             action: {
//                 timeout: 30000,
//                 function: 'get-otp'
//             }
//         },
//         position: { x: 100, y: 300 },
//         type: 'serverAction'
//     },
//     {
//         id: 'navigate',
//         data: { name: 'navigate', url: 'https://example.com/verify' },
//         position: { x: 100, y: 500 },
//         type: 'playwrightAction'
//     },
//     {
//         id: 'fill-otp',
//         data: { name: 'fill', text: '{{context.otp}}' },
//         position: { x: 100, y: 700 },
//         type: 'playwrightAction'
//     }
// ]

export const defaultPlaywrightAction: ClickAction = {
    name: 'click',
    selector: 'button[data-testid="submit"]',
    ref: 'ref_123',
    signals: [],
    ariaSnapshot: '',
    preconditionSelector: '',
    button: 'left',
    modifiers: 0,
    clickCount: 1
}

export const defaultNetworkInterceptorAction: TNetworkInterceptorAction = {
    name: 'networkInterceptionAction',
    url: 'https://api.example.com/*',
    type: 'http',
    action: 'request',
    body: {
        type: 'object',
        properties: {
            userId: { type: 'string' }
        },
        required: ['userId']
    }
}

export const defaultLaunchBrowserAction: LaunchBrowserAction = {
    name: 'launchBrowser',
    config: {
        userDataDir: '/path/to/user-data',
        launch: {
            headless: false,
            channel: 'chrome',
            args: ['--no-sandbox'],
            ignoreDefaultArgs: false,
            devtools: false,
            slowMo: 50,
            timeout: 30000,
            ignoreHTTPSErrors: false,
            bypassCSP: false,
            acceptDownloads: true,
            downloadsPath: './downloads',
            locale: 'en-US',
            timezoneId: 'America/New_York',
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            javaScriptEnabled: true,
            serviceWorkers: 'allow',
            strictSelectors: true
        },
        execution: {
            blockUserInput: false,
            humanInLoopOnError: true,
            maxRetries: 3,
            actionTimeout: 30000,
            navigationTimeout: 60000
        }
    }
}

export const defaultServerAction: BuiltInServerAction = {
    name: 'builtInServerAction',
    type: 'built-in',
    runtimeEnvRef: 'environment',
    action: {
        timeout: 30000,
        function: 'get-otp'
    }
}

export const defaultInterruptionAction: TInterruptionAction = {
    name: 'interruptionAction',
    timeout: 5000,
    preconditionSelector: 'div.loading-spinner',
    resolve: {
        selector: 'div.content',
        attr: 'visible'
    }
}
