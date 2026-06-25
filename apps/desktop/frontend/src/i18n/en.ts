export const en = {
    nav: {
        navigation: 'Navigation',
        home: 'Home',
        dashboard: 'Dashboard',
        pos: 'POS',
        delayedOrders: 'Delayed orders',
        orders: 'Orders',
        whatsapp: 'WhatsApp',
        inventory: 'Inventory',
        customers: 'Customers',
        suppliers: 'Suppliers',
        restockOrders: 'Restock orders',
        recipes: 'Recipes',
        labour: 'Labour',
        community: 'Community',
        profile: 'Profile',
        settings: 'Settings',
        help: 'Help',
        theme: 'Theme',
        logout: 'Logout',
        loggedOut: 'Logged out',
        logoutFailed: 'Logout failed'
    },
    settings: {
        title: 'Settings',
        description: 'Application preferences and integrations',
        appearance: 'Appearance',
        appearanceDesc: 'Customize how {name} looks',
        darkMode: 'Dark mode',
        language: 'Language',
        languageDesc: 'Choose interface and document languages',
        uiLanguage: 'Interface language',
        uiLanguageDesc: 'Language for menus, buttons, and screens',
        documentLanguage: 'Documents & messages',
        documentLanguageDesc: 'Language for invoices, receipts, and WhatsApp messages',
        english: 'English',
        urdu: 'Urdu',
        languageSaved: 'Language settings saved',
        languageSaveFailed: 'Failed to save language settings',
        backupRestore: 'Backup & restore',
        backupRestoreDesc: 'Download a full local backup of the database and uploaded files, or restore from a previously saved `.bak` file.',
        downloadBackup: 'Download backup',
        creatingBackup: 'Creating backup...',
        restoreFromBackup: 'Restore from backup',
        restoring: 'Restoring...',
        backupNote:
            'Backups include the SQLite database and all files in local storage (avatars, WhatsApp queue files, proofs). Restore overwrites the current database and storage after you restart the application.',
        backupDownloaded: 'Backup downloaded ({fileName})',
        backupDownloadFailed: 'Backup download failed',
        chooseBakFile: 'Please choose a .bak backup file',
        backupStaged: 'Backup staged. Restart the application to complete restore.',
        backupStagedDesc: 'Close and reopen the app after the server restarts.',
        restoreFailed: 'Restore failed',
        restoreTitle: 'Restore backup?',
        restoreDesc:
            'This will replace the current database and all stored files with the contents of {fileName}. Restart the application after restore completes.',
        cancel: 'Cancel',
        restoreBackup: 'Restore backup',
        stagingRestore: 'Staging restore...',
        whatsapp: 'WhatsApp',
        whatsappDesc: 'Manage WhatsApp linking, logout, and send queue on the dedicated page',
        openWhatsapp: 'Open WhatsApp page'
    },
    common: {
        user: 'User',
        loading: 'Loading...'
    }
} as const

type DeepStringRecord<T> = {
    [K in keyof T]: T[K] extends string ? string : DeepStringRecord<T[K]>
}

export type TranslationTree = DeepStringRecord<typeof en>
