import express from 'express';
import { query } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticate);

// GET /api/settings
router.get('/', asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM settings');
  const result = {};
  rows.forEach(s => { result[s.setting_key] = s.valeur; });
  res.json(result);
}));

// GET /api/settings/:key
router.get('/:key', asyncHandler(async (req, res) => {
  const rows = await query('SELECT * FROM settings WHERE setting_key = ?', [req.params.key]);
  if (rows.length === 0) return res.status(404).json({ error: 'Paramètre non trouvé' });
  res.json({ setting_key: rows[0].setting_key, valeur: rows[0].valeur, description: rows[0].description });
}));

// PUT /api/settings/:key
router.put('/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { valeur } = req.body;
  if (valeur === undefined) return res.status(400).json({ error: 'Valeur requise' });

  // Upsert — crée si absent, met à jour si présent
  await query(
    'INSERT INTO settings (setting_key, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = ?',
    [key, valeur, valeur]
  );
  await query(
    "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'settings', ?, ?)",
    [`LOG_${Date.now()}`, `Paramètre modifié: ${key}`, req.user.id]
  );
  res.json({ success: true, setting_key: key, valeur });
}));

// POST /api/settings/reset-data — RESET ALL DATA TO ZERO
router.post('/reset-data', asyncHandler(async (req, res) => {
  // Only allow porteur or admin
  if (req.user.role !== 'porteur' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès non autorisé' });
  }

  // Reset balances clients et fournisseurs
  await query('UPDATE comptes_clients SET solde = 0');
  await query('UPDATE comptes_fournisseurs SET solde_xaf = 0, solde_usdt = 0, dette_usdt = 0');
  try { await query('DELETE FROM transferts_fournisseurs'); } catch(e) {}

  // Supprimer toutes les transactions et logs
  await query('DELETE FROM transactions');
  await query('DELETE FROM logs');

  // Remettre le stock USDT à zéro
  await query('UPDATE stock SET quantite = 0, cmup = 0');

  // Remettre les comptes (dépôt + caisse) aux valeurs initiales
  await query("UPDATE comptes SET montant = 1000000 WHERE type_compte = 'depot'");
  await query("UPDATE comptes SET montant = 500000  WHERE type_compte = 'caisse'");

  // Remettre la distribution des profits à zéro
  await query('UPDATE repartition_profits SET total_accumule_visible = 0, total_accumule_cache = 0');
  try { await query('DELETE FROM distribution_partenaires'); } catch(e) { /* table optionnelle */ }
  try { await query('UPDATE distribution SET total_accumule_visible = 0, total_accumule_cache = 0'); } catch(e) {}

  // Supprimer les devises personnalisées (garder les défauts)
  await query('DELETE FROM devises_personnalisees WHERE is_default = FALSE');

  // Log du reset
  await query(
    "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'reset', ?, ?)",
    [`LOG_${Date.now()}`, 'Réinitialisation complète des données', req.user.id]
  );

  res.json({ success: true, message: 'Données réinitialisées à zéro ✅' });
}));

export default router;
