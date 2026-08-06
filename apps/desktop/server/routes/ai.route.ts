import express from 'express'
import { isAuthenticated } from '../middleware/auth.js'
import {
    deleteAiSession,
    getAiSession,
    getAiSessions,
    getGeminiKeyStatus,
    listGeminiModels,
    listGeminiModelsPublic,
    postAiChat,
    postAiSession,
    removeGeminiKey,
    saveGeminiKey,
    saveGeminiModel
} from '../controllers/ai.controller.js'

const router = express.Router()

router.get('/ai/gemini/status', isAuthenticated, getGeminiKeyStatus)
router.get('/ai/gemini/models', isAuthenticated, listGeminiModels)
router.get('/ai/gemini/models/public', isAuthenticated, listGeminiModelsPublic)
router.put('/ai/gemini/api-key', isAuthenticated, saveGeminiKey)
router.put('/ai/gemini/model', isAuthenticated, saveGeminiModel)
router.delete('/ai/gemini/api-key', isAuthenticated, removeGeminiKey)

router.get('/ai/sessions', isAuthenticated, getAiSessions)
router.post('/ai/sessions', isAuthenticated, postAiSession)
router.get('/ai/sessions/:id', isAuthenticated, getAiSession)
router.delete('/ai/sessions/:id', isAuthenticated, deleteAiSession)
router.post('/ai/chat', isAuthenticated, postAiChat)

export default router
