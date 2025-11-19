// src/routes/checklist.routes.js
const express = require('express');
const router = express.Router();
const checklistController = require('../controllers/checklist.controller');

router.get('/:token', checklistController.obterChecklistPorToken);
router.post('/:token', checklistController.responderChecklist);

module.exports = router;
