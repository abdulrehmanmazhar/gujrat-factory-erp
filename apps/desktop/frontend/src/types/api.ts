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
    contact: string
    role: string
    isVerified: boolean
    avatar?: { public_id: string; url: string }
}

export interface Customer {
    id: string
    _id: string
    name: string
    address: string
    contact: string
    netAmount?: number
    owed?: number
    createdById?: string
    createdBy?: string
    createdByUser?: { name: string; contact?: string }
    createdAt?: string
}

export interface Unit {
    id: string
    _id: string
    name: string
    createdAt?: string
    updatedAt?: string
}

export interface StockByUnit {
    unitId?: string | null
    unitName: string
    qty: number
}

export interface Category {
    id: string
    _id: string
    name: string
    parentId?: string | null
    sortOrder?: number
    path?: string
    children?: Category[]
    productCount?: number
    stockByUnit?: StockByUnit[]
    createdAt?: string
    updatedAt?: string
}

export interface Product {
    id: string
    _id: string
    name: string
    category: string
    categoryIds?: string[]
    categories?: Category[]
    price: number
    stockQty: number
    inStock: boolean
    purchasePrice?: number | null
    averageCost?: number | null
    fifoCost?: number | null
    inventoryValue?: number | null
    batches?: InventoryBatch[]
    discount?: number | null
    unitId?: string | null
    unit?: Unit | null
    history?: { purchasePrice: number; qty: number }[]
    productSale?: { sold: number; createdAt: string }[]
}

export interface InventoryBatch {
    id: string
    _id: string
    productId: string
    sourceType: string
    sourceLabel?: string | null
    supplierName?: string | null
    labourerName?: string | null
    originalQty: number
    remainingQty: number
    unitCost: number
    receivedAt?: string | null
    notes?: string | null
}

export interface OrderItem {
    product: Product
    qty: number
    unitPrice?: number
    unitDiscount?: number
}

export type LabelledAmount = {
    description: string
    amount: string | number
}

export interface Order {
    id: string
    _id: string
    orderNumber?: number | null
    customerId: string
    customerDetails?: { name: string; contact: string }
    userDetails?: { name: string }
    cart: OrderItem[]
    price?: number | null
    payment?: number | null
    refunded?: number | null
    discount?: number | null
    charges?: number | null
    additionalCharges?: { description: string; amount: number }[]
    additionalDiscounts?: { description: string; amount: number }[]
    invoiceBreakdown?: boolean
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

export interface CustomerTransaction {
    id: string
    _id: string
    customerId: string
    orderId?: string | null
    type: 'sale' | 'refund' | 'udhar_payment' | 'order' | 'order_credit' | string
    amount: number
    description: string
    paymentMode?: 'cash' | 'online' | string
    proofImage?: string | null
    proofImagePublicId?: string | null
    customer?: { id: string; name: string } | null
    createdAt: string
}

export type TransactionDirection = 'in' | 'out'

export interface CustomerAnalyticsTransaction extends CustomerTransaction {
    direction: TransactionDirection
}

export interface CustomerAnalyticsOrder {
    id: string
    _id: string
    customerId: string
    orderNumber?: number | null
    price?: number | null
    payment?: number | null
    refunded?: number | null
    discount?: number | null
    charges?: number | null
    payable: number
    outstanding: number
    status?: string | null
    orderMode?: 'pos' | 'delayed' | string | null
    createdAt?: string
    transactions: CustomerAnalyticsTransaction[]
}

export interface CustomerAnalyticsRow {
    id: string
    _id: string
    name: string
    address: string
    contact: string
    owed?: number
    createdAt?: string
    orderCount: number
    totalSales: number
    totalIn: number
    totalOut: number
    netAmount: number
    orderNumbers: number[]
}

export interface CustomerAnalyticsDetail {
    customer: Customer
    orders: CustomerAnalyticsOrder[]
    standaloneTransactions: CustomerAnalyticsTransaction[]
}

export interface SupplierTransaction {
    id: string
    _id: string
    supplierId: string
    restockOrderId?: string | null
    type: 'purchase' | 'return' | 'payment' | 'refund'
    amount: number
    description: string
    paymentMode?: 'cash' | 'online' | string
    proofImage?: string | null
    proofImagePublicId?: string | null
    supplier?: Supplier | null
    createdAt: string
}

export interface LabourerTransaction {
    id: string
    _id: string
    labourerId: string
    category: LabourTransactionCategory
    labourCategory?: LabourTransactionCategory | null
    amount: number
    description: string
    labourer?: Labourer | null
    createdAt: string
}

export type LabourTransactionCategory = 'production' | 'income' | 'advance' | 'bonus' | 'expense' | 'other'

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
    notes?: string | null
    payable?: number
    isActive: boolean
    products?: SupplierProduct[]
}

export interface RestockOrderItem {
    id: string
    _id: string
    productId: string
    qtyOrdered: number
    qtyReceived: number
    qtyReturned?: number
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
    amountPaid?: number | null
    amountRefunded?: number | null
    notes?: string | null
    createdById: string
    orderedAt?: string | null
    receivedAt?: string | null
    createdAt?: string
    supplier?: Supplier | null
    items?: RestockOrderItem[]
}

export interface SupplierAnalyticsTransaction extends SupplierTransaction {
    direction: TransactionDirection
}

export interface SupplierAnalyticsOrder extends RestockOrder {
    outstanding: number
    transactions: SupplierAnalyticsTransaction[]
}

export interface SupplierAnalyticsRow {
    id: string
    _id: string
    name: string
    contact: string
    businessName?: string | null
    address?: string | null
    payable: number
    isActive: boolean
    orderCount: number
    totalPurchases: number
    restockOutstanding: number
    totalIn: number
    totalOut: number
    netAmount: number
    referenceNumbers: string[]
}

export interface SupplierAnalyticsDetail {
    supplier: Supplier
    orders: SupplierAnalyticsOrder[]
    standaloneTransactions: SupplierAnalyticsTransaction[]
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

export interface ProductConversion {
    id: string
    _id: string
    inputProductId: string
    outputProductId: string
    inputRatio: number
    outputRatio: number
    inputQty: number
    outputQty: number
    notes?: string | null
    createdAt?: string
    inputProduct?: Product | null
    outputProduct?: Product | null
    createdByUser?: { id?: string; name?: string; contact?: string } | null
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
    labourerTransactionId?: string | null
    notes?: string | null
    createdAt?: string
    labourer?: Labourer | null
    product?: Product | null
    consumption?: LabourConsumption[]
}

export interface LabourAnalyticsTransaction extends LabourerTransaction {
    direction: TransactionDirection
}

export interface LabourAnalyticsProduction extends LabourProductionEntry {
    transactions: LabourAnalyticsTransaction[]
}

export interface LabourAnalyticsRow {
    id: string
    _id: string
    name: string
    contact?: string | null
    notes?: string | null
    isActive: boolean
    productionCount: number
    totalProductionPay: number
    totalIn: number
    totalOut: number
    netAmount: number
    productNames: string[]
}

export interface LabourAnalyticsDetail {
    labourer: Labourer
    productions: LabourAnalyticsProduction[]
    standaloneTransactions: LabourAnalyticsTransaction[]
}

export interface InventoryProductLine {
    productId: string
    name: string
    category: string
    categoryIds: string[]
    unitName: string
    qty: number
    value: number
    orderCount: number
    qtyReceived?: number
    qtyReturned?: number
}

export interface InventoryCustomerRow {
    id: string
    _id: string
    name: string
    contact: string
    address: string
    orderCount: number
    productCount: number
    totalQty: number
    totalValue: number
    products: InventoryProductLine[]
}

export interface InventorySupplierRow {
    id: string
    _id: string
    name: string
    contact: string
    businessName?: string | null
    address?: string | null
    isActive: boolean
    orderCount: number
    productCount: number
    totalQty: number
    totalValue: number
    products: InventoryProductLine[]
}

export interface InventoryLabourRow {
    id: string
    _id: string
    name: string
    contact?: string | null
    notes?: string | null
    isActive: boolean
    productionCount: number
    productCount: number
    producedQty: number
    producedValue: number
    consumedQty: number
    produced: InventoryProductLine[]
    consumed: InventoryProductLine[]
}

export interface CartLine {
    productId: string
    product: Product
    qty: number
}

export type ExpenditurePaymentMode = 'cash' | 'online'

export interface MiscExpenditureCategory {
    id: string
    _id: string
    name: string
    parentId?: string | null
    sortOrder?: number
    path?: string
    children?: MiscExpenditureCategory[]
    expenditureCount?: number
    expenditureTotal?: number
    createdAt?: string
    updatedAt?: string
}

export interface MiscellaneousExpenditure {
    id: string
    _id: string
    amount: number
    paymentMode: ExpenditurePaymentMode
    note: string
    categoryId?: string | null
    category?: Pick<MiscExpenditureCategory, 'id' | '_id' | 'name' | 'path'> | null
    proofImage?: string | null
    proofImagePublicId?: string | null
    createdById: string
    createdBy?: User | null
    createdAt?: string
    updatedAt?: string
}

export type KhataParty = 'customer' | 'supplier'
export type KhataDirection = 'in' | 'out'

export interface KhataEntry {
    id: string
    _id: string
    party: KhataParty
    direction: KhataDirection
    partyName: string
    balanceImpact: string
    amount: number
    description: string
    paymentMode?: ExpenditurePaymentMode | string
    proofImage?: string | null
    type: string
    customerId?: string
    supplierId?: string
    remainingBalance?: number
    createdAt: string
}
