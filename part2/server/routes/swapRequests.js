// server/routes/swapRequests.js
router.get('/swap-requests', requireAuth, requireRole('admin'), listRequests);
router.post('/swap-requests/:id/approve', requireAuth, approveRequest);
router.post('/swap-requests/:id/cancel', requireAuth, cancelRequest);
