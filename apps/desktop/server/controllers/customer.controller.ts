import { Request, Response } from 'express'
import { CatchAsyncError } from '../middleware/catchAsyncError.js'
import { httpResponse } from '../utils/http.js'
import { param } from '../utils/params.js'
import * as customerService from '../services/customer.service.js'

export const addCustomer = CatchAsyncError(async (req: Request, res: Response) => {
    const customer = await customerService.addCustomer({ ...req.body, createdById: req.user!.id })
    httpResponse(req, res, 200, 'Customer added successfully', { customer })
})

export const editCustomer = CatchAsyncError(async (req: Request, res: Response) => {
    const customer = await customerService.editCustomer(param(req.params.id), req.body)
    httpResponse(req, res, 200, 'Customer updated successfully', { customer })
})

export const getCustomer = CatchAsyncError(async (req: Request, res: Response) => {
    const customers = await customerService.listCustomers()
    httpResponse(req, res, 200, 'Customers fetched successfully', { customers })
})

export const deleteCustomer = CatchAsyncError(async (req: Request, res: Response) => {
    await customerService.deleteCustomer(param(req.params.id))
    httpResponse(req, res, 200, 'Deleted the customer successfully', null)
})

export const getCustomerById = CatchAsyncError(async (req: Request, res: Response) => {
    const customer = await customerService.getCustomerById(param(req.params.id))
    httpResponse(req, res, 200, 'Customer fetched successfully', { customer })
})

export const returnUdhar = CatchAsyncError(async (req: Request, res: Response) => {
    const udhar = await customerService.returnCustomerUdhar(param(req.params.id), req.body.returnUdhar, req.user!.id)
    httpResponse(req, res, 200, `Outstanding is now ${udhar} PKR`, { udhar })
})
