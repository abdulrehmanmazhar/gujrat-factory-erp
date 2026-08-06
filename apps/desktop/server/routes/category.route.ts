import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../controllers/category.controller.js'

const router = express.Router()

router.get('/categories', isAuthenticated, getCategories)
router.post('/categories', isAuthenticated, authorizeWrite, createCategory)
router.put('/categories/:id', isAuthenticated, authorizeWrite, updateCategory)
router.delete('/categories/:id', isAuthenticated, authorizeDelete, deleteCategory)

export default router
