export interface ApiEnvelope<T = unknown> {
    success: boolean
    statusCode: number
    message: string
    data: T
    request?: { method: string; url: string }
}

export interface User {
    id: string
    _id: string
    name: string
    email: string
    role: string
    isVerified: boolean
    routes: string[]
    avatar?: { public_id: string; url: string }
}

export interface Customer {
    id: string
    _id: string
    name: string
    businessName?: string | null
    address: string
    contact: string
    udhar: number
    route?: string | null
    createdById?: string
    createdBy?: string
    createdByUser?: { name: string }
    createdAt?: string
}

export interface Product {
    id: string
    _id: string
    name: string
    category: string
    price: number
    stockQty: number
    inStock: boolean
    purchasePrice?: number | null
    discount?: number | null
    history?: { purchasePrice: number; qty: number; totalBill: number }[]
    productSale?: { sold: number; createdAt: string }[]
}

export interface OrderItem {
    product: Product
    qty: number
}

export interface Order {
    id: string
    _id: string
    orderNumber?: number | null
    customerId: string
    customerDetails?: { name: string; contact: string; route?: string }
    userDetails?: { name: string }
    cart: OrderItem[]
    price?: number | null
    payment?: number | null
    discount?: number | null
    status?: string | null
    deliveryStatus?: boolean | null
    deliveryDate?: string | null
    message?: string | null
    orderMode?: 'pos' | 'delayed' | null
    stockDeducted?: boolean | null
    returnedAt?: string | null
    createdAt?: string
    createdBy?: string
}

export interface Target {
    id: string
    _id: string
    type: 'sales' | 'orders' | 'quantity'
    value: number
    progress: number
    achieved: boolean
    startDate: string
    endDate: string
    userId: { name: string; id?: string }
    productId?: { name: string; category?: string } | null
}

export interface Transaction {
    id: string
    _id: string
    type: string
    amount: number
    description: string
    createdAt: string
}

export interface LoginResponse {
    success: boolean
    user: User
    accessToken: string
}

export interface RegistrationResponse {
    activationToken: string
}

export interface ActivateUserRequest {
    activation_token: string
    activation_code: string
}

export interface Supplier {
    id: string
    _id: string
    name: string
    contact: string
    businessName?: string | null
    address?: string | null
    email?: string | null
    notes?: string | null
    isActive: boolean
    products?: Product[]
}

export interface CartLine {
    productId: string
    product: Product
    qty: number
}
