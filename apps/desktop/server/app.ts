import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { errorMiddleware } from './middleware/error.js'
import { httpError } from './utils/http.js'
import { AppError } from './utils/errors.js'
import userRouter from './routes/user.route.js'
import customerRouter from './routes/customer.route.js'
import productRouter from './routes/product.route.js'
import orderRouter from './routes/order.route.js'
import transactionRouter from './routes/transaction.route.js'
import analyticsRouter from './routes/analytics.route.js'
import productSaleRouter from './routes/productSale.route.js'
import targetRouter from './routes/target.route.js'
import supplierRouter from './routes/supplier.route.js'
import restockRouter from './routes/restock.route.js'

export const app = express()

app.use(express.static('public'))
app.use(express.json({ limit: '50kb' }))
app.use(cookieParser())
app.use(
    cors({
        origin: (origin, callback) => callback(null, origin || '*'),
        credentials: true
    })
)

app.use('/api/v1', userRouter)
app.use('/api/v1', customerRouter)
app.use('/api/v1', productRouter)
app.use('/api/v1', orderRouter)
app.use('/api/v1', transactionRouter)
app.use('/api/v1', analyticsRouter)
app.use('/api/v1', productSaleRouter)
app.use('/api/v1', targetRouter)
app.use('/api/v1', supplierRouter)
app.use('/api/v1', restockRouter)

app.get('/test', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'test route called and it worked properly'
    })
})

app.all('*', (req: Request, _res: Response, next: NextFunction) => {
    next(httpError(next, new AppError(`Can't find ${req.originalUrl} on this server`, 404), req, 404))
})

app.use(errorMiddleware)
