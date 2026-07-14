import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import { createRecipe, deleteRecipe, getRecipe, getRecipes, updateRecipe } from '../controllers/recipe.controller.js'

const router = express.Router()

router.get('/recipes', isAuthenticated, getRecipes)
router.get('/recipes/:id', isAuthenticated, getRecipe)
router.post('/recipes', isAuthenticated, authorizeWrite, createRecipe)
router.put('/recipes/:id', isAuthenticated, authorizeWrite, updateRecipe)
router.delete('/recipes/:id', isAuthenticated, authorizeDelete, deleteRecipe)

export default router
