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
    routeAssign,
    routeAssignDeletion,
    socialAuth,
    updateAccessToken,
    updatePassword,
    updateRole,
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
router.post('/social-auth', socialAuth)
router.put('/update-user-info', isAuthenticated, updateUserInfo)
router.put('/update-user-password', isAuthenticated, updatePassword)
// router.put("/update-user-avatar", isAuthenticated, updateProfilePicture)
router.get('/get-all-users-admin', isAuthenticated, authorizeRoles('super_admin'), fetchAllUsers)
router.put('/update-user-role', isAuthenticated, authorizeRoles('super_admin'), updateRole)
router.delete('/delete-user/:id', isAuthenticated, authorizeRoles('super_admin'), deleteUser)
router.put('/verify-user/:id', isAuthenticated, authorizeRoles('super_admin'), verifyUser)
router.put('/assign-route/:id', isAuthenticated, authorizeRoles('admin'), routeAssign)
router.delete('/delete-assigned-route/:id/:index', isAuthenticated, authorizeRoles('admin'), routeAssignDeletion)

export default router
