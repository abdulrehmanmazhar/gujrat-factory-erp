import express from 'express'
import {
    activateUser,
    deleteUser,
    fetchAllUsers,
    forgotPassword,
    getUserInfo,
    LoginUser,
    logoutUser,
    registrationUser,
    resetPassword,
    updateAccessToken,
    updatePassword,
    updateRole,
    updateProfilePicture,
    updateUserInfo,
    verifyUser
} from '../controllers/user.controller.js'
import { authorizeRoles, isAuthenticated } from '../middleware/auth.js'
const router = express.Router()

router.post('/registration', registrationUser)
router.post('/activate-user', activateUser)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password', resetPassword)
router.post('/login', LoginUser)
router.post('/logout', isAuthenticated, logoutUser)
router.get('/refresh', updateAccessToken)
router.get('/me', isAuthenticated, getUserInfo)
router.put('/update-user-info', isAuthenticated, updateUserInfo)
router.put('/update-user-password', isAuthenticated, updatePassword)
router.put('/update-user-avatar', isAuthenticated, updateProfilePicture)
router.get('/get-all-users-admin', isAuthenticated, authorizeRoles('super_admin'), fetchAllUsers)
router.put('/update-user-role', isAuthenticated, authorizeRoles('super_admin'), updateRole)
router.delete('/delete-user/:id', isAuthenticated, authorizeRoles('super_admin'), deleteUser)
router.put('/verify-user/:id', isAuthenticated, authorizeRoles('super_admin'), verifyUser)

export default router
