const express = require('express');
const {
  requireAuth,
  requireRole,
  verifyCsrf,
  verifyLoginCsrf,
  verifyPublicCsrf
} = require('../middleware/auth');
const { loginLimiter, authFlowLimiter } = require('../middleware/rateLimiters');
const { loginForm, login, logout } = require('../controllers/authController');
const { localStart, setupForm, setupOwner } = require('../controllers/setupController');
const {
  createTeamInvite,
  createSupportInvite,
  acceptInviteForm,
  acceptInviteHandler
} = require('../controllers/invitesController');
const {
  forgotPasswordForm,
  requestPasswordReset,
  resetPasswordForm,
  resetPasswordHandler
} = require('../controllers/passwordController');
const { dashboard, orderDetail, updateStatus, deleteOrder, clientsPage } = require('../controllers/adminController');
const { emailSettingsPage, saveEmailSettings, testEmailSettings, testExistingEmailSettings } = require('../controllers/emailSettingsController');
const {
  teamPage,
  inviteForm,
  changeActive,
  changeRole,
  supportPage,
  supportInviteForm,
  activateSupport,
  deactivateSupport,
  settingsPage,
  saveBusinessSettings,
  closeOtherSessions
} = require('../controllers/teamController');
const { changeProductApprovalExemption } = require('../controllers/teamController');
const products = require('../controllers/productsController');
const musicLibrary = require('../controllers/musicLibraryController');

const router = express.Router();

router.get('/local-start', localStart);
router.get('/setup/:token', setupForm);
router.post('/setup/:token', authFlowLimiter, verifyPublicCsrf, setupOwner);
router.get('/invite/:token', acceptInviteForm);
router.post('/invite/:token', authFlowLimiter, verifyPublicCsrf, acceptInviteHandler);
router.get('/forgot-password', forgotPasswordForm);
router.post('/forgot-password', authFlowLimiter, verifyPublicCsrf, requestPasswordReset);
router.get('/reset-password/:token', resetPasswordForm);
router.post('/reset-password/:token', authFlowLimiter, verifyPublicCsrf, resetPasswordHandler);
router.get('/login', loginForm);
router.post('/login', verifyLoginCsrf, loginLimiter, login);

router.use(requireAuth);

router.post('/logout', verifyCsrf, logout);
router.get('/', (req, res) => res.redirect('/admin/orders'));
router.get('/orders', dashboard);
router.get('/orders/:id', orderDetail);
router.post('/orders/:id/status', verifyCsrf, updateStatus);
router.post('/orders/:id/delete', requireRole('owner', 'admin', 'support'), verifyCsrf, deleteOrder);

router.get('/clients', requireRole('owner', 'admin', 'attendant', 'support'), clientsPage);
router.get('/music', requireRole('owner', 'admin'), musicLibrary.page);
router.post('/music/upload', requireRole('owner', 'admin'), verifyCsrf,
  express.raw({ type: 'application/octet-stream', limit: '8mb' }), musicLibrary.upload);
router.post('/music/:id', requireRole('owner', 'admin'), verifyCsrf, musicLibrary.update);

router.get('/team', requireRole('owner', 'admin', 'support'), teamPage);
router.get('/team/invite', requireRole('owner', 'admin'), inviteForm);
router.post('/team/invite', requireRole('owner', 'admin'), verifyCsrf, createTeamInvite);
router.post('/team/:id/active', requireRole('owner', 'admin'), verifyCsrf, changeActive);
router.post('/team/:id/role', requireRole('owner', 'admin'), verifyCsrf, changeRole);
router.post('/team/:id/product-approval-exemption', requireRole('owner', 'admin'), verifyCsrf, changeProductApprovalExemption);

router.get('/products/media/:filename', requireRole('owner', 'admin', 'attendant'), products.adminProductMedia);
router.post('/products/media/upload', requireRole('owner', 'admin', 'attendant'), verifyCsrf,
  express.raw({ type: 'application/octet-stream', limit: '3mb' }), (req, res) => {
    req.rawImageBuffer = Buffer.isBuffer(req.body) ? req.body : null;
    return products.uploadProductImage(req, res);
  });
router.get('/products', requireRole('owner', 'admin', 'attendant'), products.productsPage);
router.get('/products/new', requireRole('owner', 'admin', 'attendant'), products.productForm);
router.get('/products/:id/edit', requireRole('owner', 'admin', 'attendant'), products.productForm);
router.post('/products', requireRole('owner', 'admin', 'attendant'), verifyCsrf, products.saveProduct);
router.post('/products/:id', requireRole('owner', 'admin', 'attendant'), verifyCsrf, products.saveProduct);
router.post('/products/:id/state', requireRole('owner', 'admin', 'attendant'), verifyCsrf, products.changeProductState);
router.post('/products/categories', requireRole('owner', 'admin'), verifyCsrf, products.createCategoryHandler);
router.post('/products/categories/:id', requireRole('owner', 'admin'), verifyCsrf, products.updateCategoryHandler);
router.post('/products/categories/:id/active', requireRole('owner', 'admin'), verifyCsrf, products.toggleCategoryHandler);
router.get('/approvals', requireRole('owner', 'admin'), products.approvalsPage);
router.post('/approvals/:id/approve', requireRole('owner', 'admin'), verifyCsrf, products.approveProductChange);
router.post('/approvals/:id/reject', requireRole('owner', 'admin'), verifyCsrf, products.rejectProductChange);

router.get('/support', requireRole('owner', 'admin'), supportPage);
router.get('/support/invite', requireRole('owner', 'admin'), supportInviteForm);
router.post('/support/invite', requireRole('owner', 'admin'), verifyCsrf, createSupportInvite);
router.post('/support/:id/authorize', requireRole('owner', 'admin'), verifyCsrf, activateSupport);
router.post('/support/:id/disable', requireRole('owner', 'admin'), verifyCsrf, deactivateSupport);

router.get('/settings', requireRole('owner', 'admin', 'attendant', 'support'), settingsPage);
router.post('/settings', requireRole('owner', 'admin'), verifyCsrf, saveBusinessSettings);
router.post('/settings/sessions/revoke', requireRole('owner', 'admin', 'support'), verifyCsrf, closeOtherSessions);
router.post('/settings/email/test-existing', requireRole('owner', 'admin'), verifyCsrf, testExistingEmailSettings);
router.get('/settings/email', requireRole('owner'), emailSettingsPage);
router.post('/settings/email', requireRole('owner'), verifyCsrf, saveEmailSettings);
router.post('/settings/email/test', requireRole('owner'), verifyCsrf, testEmailSettings);

module.exports = router;
