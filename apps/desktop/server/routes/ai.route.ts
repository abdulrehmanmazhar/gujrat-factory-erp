import express from 'express'
import { authorizeDelete, authorizeWrite, isAuthenticated } from '../middleware/auth.js'
import {
    deleteAiSession,
    getAiProvider,
    getAiSession,
    getAiSessions,
    getGeminiKeyStatus,
    getOllamaModels,
    listGeminiModels,
    listGeminiModelsPublic,
    postAiChat,
    postAiSession,
    putAiProvider,
    removeGeminiKey,
    saveGeminiKey,
    saveGeminiModel,
    saveOllamaConfig
} from '../controllers/ai.controller.js'

const router = express.Router()

router.get('/ai/provider', isAuthenticated, getAiProvider)
router.put('/ai/provider', isAuthenticated, authorizeWrite, putAiProvider)

router.get('/ai/ollama/models', isAuthenticated, getOllamaModels)
router.put('/ai/ollama', isAuthenticated, authorizeWrite, saveOllamaConfig)

router.get('/ai/gemini/status', isAuthenticated, getGeminiKeyStatus)
router.get('/ai/gemini/models', isAuthenticated, listGeminiModels)
router.get('/ai/gemini/models/public', isAuthenticated, listGeminiModelsPublic)
router.put('/ai/gemini/api-key', isAuthenticated, authorizeWrite, saveGeminiKey)
router.put('/ai/gemini/model', isAuthenticated, authorizeWrite, saveGeminiModel)
router.delete('/ai/gemini/api-key', isAuthenticated, authorizeDelete, removeGeminiKey)

router.get('/ai/sessions', isAuthenticated, getAiSessions)
router.post('/ai/sessions', isAuthenticated, authorizeWrite, postAiSession)
router.get('/ai/sessions/:id', isAuthenticated, getAiSession)
router.delete('/ai/sessions/:id', isAuthenticated, authorizeDelete, deleteAiSession)
router.post('/ai/chat', isAuthenticated, authorizeWrite, postAiChat)

export default router
