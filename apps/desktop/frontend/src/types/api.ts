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

export interface SupplierProduct extends Product {
    supplierSku?: string | null
    unitCost?: number | null
    isPreferred?: boolean | null
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
    products?: SupplierProduct[]
}

export interface RestockOrderItem {
    id: string
    _id: string
    productId: string
    qtyOrdered: number
    qtyReceived: number
    unitCost: number
    lineTotal: number
    product?: Product
}

export interface RestockOrder {
    id: string
    _id: string
    supplierId: string
    referenceNumber?: string | null
    status: 'draft' | 'ordered' | 'received' | 'cancelled'
    totalAmount: number
    notes?: string | null
    createdById: string
    orderedAt?: string | null
    receivedAt?: string | null
    createdAt?: string
    supplier?: Supplier | null
    items?: RestockOrderItem[]
}

export interface RecipeItem {
    id: string
    _id: string
    ingredientProductId: string
    qty: number
    product?: Product
}

export interface Recipe {
    id: string
    _id: string
    outputProductId: string
    notes?: string | null
    outputProduct?: Product | null
    items?: RecipeItem[]
}

export interface LabourRate {
    productId: string
    ratePerUnit: number
    product?: Product
}

export interface Labourer {
    id: string
    _id: string
    name: string
    contact?: string | null
    notes?: string | null
    isActive: boolean
    rates?: LabourRate[]
}

export interface LabourConsumption {
    id: string
    productId: string
    qtyConsumed: number
    product?: Product
}

export interface LabourProductionEntry {
    id: string
    _id: string
    labourerId: string
    productId: string
    qtyProduced: number
    ratePerUnit: number
    totalPay: number
    recipeApplied: boolean
    notes?: string | null
    createdAt?: string
    labourer?: Labourer | null
    product?: Product | null
    consumption?: LabourConsumption[]
}

export interface CartLine {
    productId: string
    product: Product
    qty: number
}
