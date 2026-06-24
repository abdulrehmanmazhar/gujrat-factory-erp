import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
import { createRecipe, deleteRecipe, getRecipe, getRecipes, updateRecipe } from '../controllers/recipe.controller.js'

const router = express.Router()

router.get('/recipes', isAuthenticated, getRecipes)
router.get('/recipes/:id', isAuthenticated, getRecipe)
router.post('/recipes', isAuthenticated, authorizeRoles('admin'), createRecipe)
router.put('/recipes/:id', isAuthenticated, authorizeRoles('admin'), updateRecipe)
router.delete('/recipes/:id', isAuthenticated, authorizeRoles('admin'), deleteRecipe)

export default router
