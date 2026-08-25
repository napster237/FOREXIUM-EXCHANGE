import express from 'express';
import { query, transaction as dbTransaction } from '../config/database.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import { ensureSupplierFeatures, getSupplierUsdtBalance, normalizeSupplierRole } from '../utils/supplierFeatures.js';

const router = express.Router();
router.use(authenticate);

const normalizeFullName = (...parts) => parts
  .filter(Boolean)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });
const STOCK_EPSILON = 1e-6;
const MONEY_EPSILON = 1e-2;
const HIGH_PRECISION_FIELDS = new Set([
  'quantite',
  'quantite_vente',
  'usdt_consomme',
  'taux_achat_unitaire',
  'ancien_cmup',
  'nouveau_cmup',
  'taux_conversion',
  'taux_achat_xaf',
  'taux_vente_visible',
  'taux_vente_cache',
  'pourcentage_porteur',
  'pourcentage_associe',
]);
const IGNORED_UPDATE_FIELDS = new Set(['cmup_usdt']);
const MONEY_FIELDS = new Set([
  'prix_achat_total',
  'montant',
  'montant_a_payer',
  'montant_paye',
  'valeur_achat_xaf',
  'valeur_vente_visible',
  'valeur_vente_cachee',
  'benefice_visible',
  'benefice_cache',
  'part_porteur_visible',
  'part_associe_visible',
  'part_porteur_cachee',
  'part_associe_cachee',
]);
const BOOLEAN_FIELDS = new Set(['use_caisse']);

const normalizeEntityLabel = (value) => String(value || '')
  .replace(/\s*\(.*$/, '')
  .replace(/\s*·.*$/, '')
  .trim();

const toNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toNullablePositiveInt = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const toOptionalDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const preserveTransactionTime = (rawDate, currentDate, fallbackDate = null) => {
  if (rawDate === undefined) return currentDate;

  const parsed = toOptionalDate(rawDate);
  if (!parsed) return rawDate;

  const rawString = typeof rawDate === 'string' ? rawDate.trim() : '';
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(rawString);
  if (!isDateOnly) return parsed;

  const referenceDate = toOptionalDate(currentDate) || toOptionalDate(fallbackDate);
  if (!referenceDate) return parsed;

  const merged = new Date(parsed);
  merged.setUTCHours(
    referenceDate.getUTCHours(),
    referenceDate.getUTCMinutes(),
    referenceDate.getUTCSeconds(),
    referenceDate.getUTCMilliseconds()
  );
  return merged;
};

const getFieldTolerance = (field) => {
  if (HIGH_PRECISION_FIELDS.has(field)) return STOCK_EPSILON;
  if (MONEY_FIELDS.has(field)) return MONEY_EPSILON;
  return STOCK_EPSILON;
};

const significantDiff = (field, currentValue, nextValue) => {
  const tolerance = getFieldTolerance(field);
  return Math.abs(toNumber(currentValue) - toNumber(nextValue)) > tolerance;
};

const getTimelineTime = (value) => {
  const parsed = toOptionalDate(value);
  return parsed ? parsed.getTime() : 0;
};

const sortByTimeline = (a, b) => {
  const diffDate = getTimelineTime(a?.date || a?.date_enregistrement) - getTimelineTime(b?.date || b?.date_enregistrement);
  if (diffDate !== 0) return diffDate;
  const diffCreated = getTimelineTime(a?.date_enregistrement || a?.date) - getTimelineTime(b?.date_enregistrement || b?.date);
  if (diffCreated !== 0) return diffCreated;
  return String(a?.id || '').localeCompare(String(b?.id || ''));
};

const deriveHiddenSharePct = (row, fallbackPct = 70) => {
  const benefitCache = toNumber(row?.benefice_cache, 0);
  const partPorteurCachee = toNumber(row?.part_porteur_cachee, 0);
  if (Math.abs(benefitCache) > MONEY_EPSILON) {
    const pct = (partPorteurCachee / benefitCache) * 100;
    if (Number.isFinite(pct)) return pct;
  }
  return fallbackPct;
};

function normalizeEditPayload(body = {}) {
  const normalized = { ...body };
  if (normalized.porteurPct !== undefined && normalized.pourcentage_porteur === undefined) normalized.pourcentage_porteur = normalized.porteurPct;
  if (normalized.associePct !== undefined && normalized.pourcentage_associe === undefined) normalized.pourcentage_associe = normalized.associePct;
  if (normalized.pct_porteur !== undefined && normalized.pourcentage_porteur === undefined) normalized.pourcentage_porteur = normalized.pct_porteur;
  if (normalized.pct_associe !== undefined && normalized.pourcentage_associe === undefined) normalized.pourcentage_associe = normalized.pct_associe;
  if (normalized.porteurPctCache !== undefined && normalized.pct_porteur_cache === undefined) normalized.pct_porteur_cache = normalized.porteurPctCache;
  if (normalized.associePctCache !== undefined && normalized.pct_associe_cache === undefined) normalized.pct_associe_cache = normalized.associePctCache;
  if (normalized.idFournisseur !== undefined && normalized.id_fournisseur === undefined) normalized.id_fournisseur = normalized.idFournisseur;
  if (normalized.idClient !== undefined && normalized.client_id === undefined) normalized.client_id = normalized.idClient;
  if (normalized.deviseVente !== undefined && normalized.devise_vente === undefined) normalized.devise_vente = normalized.deviseVente;
  if (normalized.tauxConversion !== undefined && normalized.taux_conversion === undefined) normalized.taux_conversion = normalized.tauxConversion;
  if (normalized.tauxVisible !== undefined && normalized.taux_vente_visible === undefined) normalized.taux_vente_visible = normalized.tauxVisible;
  if (normalized.tauxCache !== undefined && normalized.taux_vente_cache === undefined) normalized.taux_vente_cache = normalized.tauxCache;
  if (normalized.quantiteDevise !== undefined && normalized.quantite_vente === undefined) normalized.quantite_vente = normalized.quantiteDevise;
  if (normalized.quantiteAchat !== undefined && normalized.quantite === undefined) normalized.quantite = normalized.quantiteAchat;
  if (normalized.taux !== undefined && normalized.taux_achat_unitaire === undefined) normalized.taux_achat_unitaire = normalized.taux;
  if (normalized.tauxAchatXAF !== undefined && normalized.taux_achat_xaf === undefined) normalized.taux_achat_xaf = normalized.tauxAchatXAF;
  if (normalized.valeurAchat !== undefined && normalized.valeur_achat_xaf === undefined) normalized.valeur_achat_xaf = normalized.valeurAchat;
  if (normalized.valeurVenteVisible !== undefined && normalized.valeur_vente_visible === undefined) normalized.valeur_vente_visible = normalized.valeurVenteVisible;
  if (normalized.valeurVenteCachee !== undefined && normalized.valeur_vente_cachee === undefined) normalized.valeur_vente_cachee = normalized.valeurVenteCachee;
  if (normalized.beneficeVisible !== undefined && normalized.benefice_visible === undefined) normalized.benefice_visible = normalized.beneficeVisible;
  if (normalized.beneficeCachee !== undefined && normalized.benefice_cache === undefined) normalized.benefice_cache = normalized.beneficeCachee;
  if (normalized.partPorteur !== undefined && normalized.part_porteur_visible === undefined) normalized.part_porteur_visible = normalized.partPorteur;
  if (normalized.partAssocie !== undefined && normalized.part_associe_visible === undefined) normalized.part_associe_visible = normalized.partAssocie;
  if (normalized.partPorteurCache !== undefined && normalized.part_porteur_cachee === undefined) normalized.part_porteur_cachee = normalized.partPorteurCache;
  if (normalized.partAssocieCache !== undefined && normalized.part_associe_cachee === undefined) normalized.part_associe_cachee = normalized.partAssocieCache;
  if (normalized.montantAPayer !== undefined && normalized.montant_a_payer === undefined) normalized.montant_a_payer = normalized.montantAPayer;
  if (normalized.montantPaye !== undefined && normalized.montant_paye === undefined) normalized.montant_paye = normalized.montantPaye;
  if (normalized.modePaiement !== undefined && normalized.mode_paiement === undefined) normalized.mode_paiement = normalized.modePaiement;
  if (normalized.useCaisse !== undefined && normalized.use_caisse === undefined) normalized.use_caisse = normalized.useCaisse;
  if (normalized.description !== undefined && normalized.notes === undefined) normalized.notes = normalized.description;
  return normalized;
}

async function resolveClientReference(conn, rawClientName, rawClientId, { required = false } = {}) {
  let clientId = toNullablePositiveInt(rawClientId);
  let clientName = normalizeEntityLabel(rawClientName);

  if (clientId) {
    const [rows] = await conn.query(
      'SELECT id, nom, prenom FROM comptes_clients WHERE id = ?',
      [clientId]
    );
    if (!rows.length) throw badRequest('Client introuvable');
    clientName = normalizeFullName(rows[0].nom, rows[0].prenom);
  } else if (clientName) {
    const [rows] = await conn.query(
      `SELECT id, nom, prenom FROM comptes_clients
       WHERE TRIM(CONCAT(nom, IF(prenom IS NOT NULL AND prenom != '', CONCAT(' ', prenom), ''))) = TRIM(?)
       LIMIT 1`,
      [clientName]
    );
    if (rows.length) {
      clientId = rows[0].id;
      clientName = normalizeFullName(rows[0].nom, rows[0].prenom);
    }
  }

  if (required && (!clientId || !clientName)) throw badRequest('Client requis');
  return { id: clientId, name: clientName || null };
}

async function resolveSupplierReference(conn, rawSupplierName, rawSupplierId, { required = false } = {}) {
  let fournisseurId = toNullablePositiveInt(rawSupplierId);
  let fournisseurName = normalizeEntityLabel(rawSupplierName);
  let fournisseurType = 'secondaire';

  if (fournisseurId) {
    const [rows] = await conn.query(
      'SELECT id, nom, prenom, COALESCE(type_fournisseur, "secondaire") AS type_fournisseur FROM comptes_fournisseurs WHERE id = ?',
      [fournisseurId]
    );
    if (!rows.length) throw badRequest('Fournisseur introuvable');
    fournisseurName = normalizeFullName(rows[0].nom, rows[0].prenom);
    fournisseurType = normalizeSupplierRole(rows[0].type_fournisseur);
  } else if (fournisseurName) {
    const [rows] = await conn.query(
      `SELECT id, nom, prenom, COALESCE(type_fournisseur, "secondaire") AS type_fournisseur FROM comptes_fournisseurs
       WHERE TRIM(CONCAT(nom, IF(prenom IS NOT NULL AND prenom != '', CONCAT(' ', prenom), ''))) = TRIM(?)
       LIMIT 1`,
      [fournisseurName]
    );
    if (rows.length) {
      fournisseurId = rows[0].id;
      fournisseurName = normalizeFullName(rows[0].nom, rows[0].prenom);
      fournisseurType = normalizeSupplierRole(rows[0].type_fournisseur);
    }
  }

  if (required && (!fournisseurId || !fournisseurName)) throw badRequest('Fournisseur requis');
  return { id: fournisseurId, name: fournisseurName || null, type: fournisseurType };
}

async function getAccountBalance(conn, accountType) {
  const [rows] = await conn.query(
    'SELECT montant FROM comptes WHERE type_compte = ?',
    [accountType]
  );
  if (!rows.length) throw badRequest(`Compte ${accountType} introuvable`);
  return toNumber(rows[0].montant, 0);
}

async function applyAccountDelta(conn, accountType, delta, insufficientMessage) {
  const amount = toNumber(delta, 0);
  if (amount < -MONEY_EPSILON) {
    const currentBalance = await getAccountBalance(conn, accountType);
    if (currentBalance + amount < -MONEY_EPSILON) {
      throw badRequest(insufficientMessage || `Solde ${accountType} insuffisant`);
    }
  }

  if (Math.abs(amount) <= MONEY_EPSILON) return;
  await conn.query(
    'UPDATE comptes SET montant = montant + ? WHERE type_compte = ?',
    [amount, accountType]
  );
}

function buildChangedFields(currentRow, proposedFields) {
  const changed = {};

  for (const [field, nextValue] of Object.entries(proposedFields || {})) {
    if (nextValue === undefined) continue;
    if (IGNORED_UPDATE_FIELDS.has(field)) continue;

    if (field === 'date') {
      const currentTime = getTimelineTime(currentRow?.[field]);
      const nextTime = getTimelineTime(nextValue);
      if (currentTime !== nextTime) changed[field] = nextValue;
      continue;
    }

    if (BOOLEAN_FIELDS.has(field)) {
      const currentBool = Boolean(Number(currentRow?.[field] || 0));
      const nextBool = Boolean(Number(nextValue || 0));
      if (currentBool !== nextBool) changed[field] = nextBool ? 1 : 0;
      continue;
    }

    if (HIGH_PRECISION_FIELDS.has(field) || MONEY_FIELDS.has(field) || typeof nextValue === 'number') {
      if (significantDiff(field, currentRow?.[field], nextValue)) changed[field] = nextValue;
      continue;
    }

    if ((currentRow?.[field] ?? null) !== (nextValue ?? null)) changed[field] = nextValue;
  }

  return changed;
}

async function updateTransactionColumns(conn, transactionId, fields) {
  const entries = Object.entries(fields || []).filter(([field, value]) => value !== undefined && !IGNORED_UPDATE_FIELDS.has(field));
  if (!entries.length) return;

  const updates = [];
  const values = [];

  for (const [field, value] of entries) {
    updates.push(`${field} = ?`);
    values.push(BOOLEAN_FIELDS.has(field) ? (value ? 1 : 0) : value);
  }

  updates.push('date_modification = NOW()');
  values.push(transactionId);

  await conn.query(
    `UPDATE transactions SET ${updates.join(', ')} WHERE id = ?`,
    values
  );
}

async function upsertStockRow(conn, devise, quantite, cmup) {
  const [rows] = await conn.query('SELECT id FROM stock WHERE devise = ?', [devise]);
  const quantiteFinale = Math.max(0, toNumber(quantite, 0));
  const cmupFinal = quantiteFinale > STOCK_EPSILON ? toNumber(cmup, 0) : 0;

  if (!rows.length) {
    await conn.query(
      'INSERT INTO stock (devise, quantite, cmup) VALUES (?, ?, ?)',
      [devise, quantiteFinale, cmupFinal]
    );
    return;
  }

  await conn.query(
    'UPDATE stock SET quantite = ?, cmup = ? WHERE devise = ?',
    [quantiteFinale, cmupFinal, devise]
  );
}

function projectPurchaseRow(row, stockBefore, cmupBefore) {
  const quantite = toNumber(row.quantite, NaN);
  const tauxUnitaire = toNumber(row.taux_achat_unitaire, NaN);

  if (!(quantite > 0)) throw badRequest('Quantité achat invalide');
  if (!(tauxUnitaire > 0)) throw badRequest('Taux achat invalide');

  const prixAchatTotal = quantite * tauxUnitaire;
  const stockAfter = stockBefore + quantite;
  const nouveauCmup = stockBefore <= STOCK_EPSILON
    ? tauxUnitaire
    : ((stockBefore * cmupBefore) + prixAchatTotal) / stockAfter;

  return {
    stockBefore,
    stockAfter,
    cmupBefore,
    cmupAfter: nouveauCmup,
    updateFields: {
      devise: 'USDT',
      quantite,
      taux_achat_unitaire: tauxUnitaire,
      prix_achat_total: prixAchatTotal,
      // Convention fournisseur: achat de devise = paiement fournisseur.
      montant_a_payer: 0,
      montant_paye: prixAchatTotal,
      ancien_cmup: cmupBefore,
      nouveau_cmup: nouveauCmup,
    },
  };
}

function projectSaleRow(row, stockBefore, cmupBefore) {
  const quantiteVente = toNumber(row.quantite_vente, NaN);
  const tauxConversion = toNumber(row.taux_conversion, NaN);
  const tauxVisible = toNumber(row.taux_vente_visible, NaN);
  const tauxCacheInput = toNumber(row.taux_vente_cache, NaN);
  const cmupBase = toNumber(row.ancien_cmup ?? row.cmup_usdt, cmupBefore);

  if (!(quantiteVente > 0)) throw badRequest('Quantité de vente invalide');
  if (!(tauxConversion > 0)) throw badRequest('Taux de conversion invalide');
  if (!(tauxVisible > 0)) throw badRequest('Taux de vente invalide');

  const operation = (() => {
    const explicit = String(row.cmup_operation || '').toLowerCase();
    if (explicit === 'multiply' || explicit === 'divide') return explicit;
    const tauxAchat = toNumber(row.taux_achat_xaf, NaN);
    if (cmupBase > 0 && tauxConversion > 0 && tauxAchat > 0) {
      const multiplyDiff = Math.abs(tauxAchat - (cmupBase * tauxConversion));
      const divideDiff = Math.abs(tauxAchat - (cmupBase / tauxConversion));
      return multiplyDiff <= divideDiff ? 'multiply' : 'divide';
    }
    return 'divide';
  })();
  const usdtConsomme = operation === 'multiply'
    ? quantiteVente * tauxConversion
    : quantiteVente / tauxConversion;
  if (stockBefore + STOCK_EPSILON < usdtConsomme) {
    throw badRequest(`Stock insuffisant: ${stockBefore.toFixed(4)} USDT disponibles, ${usdtConsomme.toFixed(4)} USDT requis`);
  }

  const tauxCache = Number.isFinite(tauxCacheInput) && tauxCacheInput > 0 ? tauxCacheInput : tauxVisible;
  const pctPorteur = Number.isFinite(toNumber(row.pourcentage_porteur, NaN))
    ? toNumber(row.pourcentage_porteur, NaN)
    : 70;
  const pctAssocie = Number.isFinite(toNumber(row.pourcentage_associe, NaN))
    ? toNumber(row.pourcentage_associe, NaN)
    : (100 - pctPorteur);
  const pctPorteurCache = Number.isFinite(toNumber(row.__pct_porteur_cache, NaN))
    ? toNumber(row.__pct_porteur_cache, NaN)
    : deriveHiddenSharePct(row, pctPorteur);
  const pctAssocieCache = Number.isFinite(toNumber(row.__pct_associe_cache, NaN))
    ? toNumber(row.__pct_associe_cache, NaN)
    : (100 - pctPorteurCache);

  const tauxAchatXaf = cmupBase > 0
    ? (operation === 'multiply' ? cmupBase * tauxConversion : cmupBase / tauxConversion)
    : 0;
  const valeurAchatXaf = quantiteVente * tauxAchatXaf;
  const valeurVenteVisible = quantiteVente * tauxVisible;
  const valeurVenteCachee = quantiteVente * tauxCache;
  const beneficeVisible = valeurVenteVisible - valeurAchatXaf;
  const beneficeCache = valeurVenteCachee - valeurAchatXaf;
  const partPorteurVisible = beneficeVisible * (pctPorteur / 100);
  const partAssocieVisible = beneficeVisible * (pctAssocie / 100);
  const partPorteurCachee = beneficeCache * (pctPorteurCache / 100);
  const partAssocieCachee = beneficeCache * (pctAssocieCache / 100);
  const montantPaye = toNumber(row.montant_paye, 0);

  const stockAfter = stockBefore - usdtConsomme;
  return {
    stockBefore,
    stockAfter,
    cmupBefore,
    cmupAfter: stockAfter > STOCK_EPSILON ? cmupBefore : 0,
    updateFields: {
      devise_vente: row.devise_vente,
      taux_conversion: tauxConversion,
      quantite_vente: quantiteVente,
      usdt_consomme: usdtConsomme,
      taux_achat_xaf: tauxAchatXaf,
      taux_vente_visible: tauxVisible,
      taux_vente_cache: tauxCache,
      montant: valeurVenteVisible,
      valeur_achat_xaf: valeurAchatXaf,
      valeur_vente_visible: valeurVenteVisible,
      valeur_vente_cachee: valeurVenteCachee,
      ancien_cmup: cmupBase,
      benefice_visible: beneficeVisible,
      benefice_cache: beneficeCache,
      part_porteur_visible: partPorteurVisible,
      part_associe_visible: partAssocieVisible,
      part_porteur_cachee: partPorteurCachee,
      part_associe_cachee: partAssocieCachee,
      pourcentage_porteur: pctPorteur,
      pourcentage_associe: pctAssocie,
      montant_a_payer: valeurVenteVisible,
      montant_paye: montantPaye,
      client: row.client,
      client_id: row.client_id,
      fournisseur: row.fournisseur,
      id_fournisseur: row.id_fournisseur,
    },
  };
}

async function replayUsdtHistory(conn, targetId, targetOverrideRow) {
  const [historyRows] = await conn.query(`
    SELECT *
    FROM transactions
    WHERE type = 'vente'
       OR (type = 'achat' AND UPPER(COALESCE(devise, 'USDT')) = 'USDT')
  `);

  const history = historyRows
    .map((row) => row.id === targetId ? { ...row, ...targetOverrideRow } : row)
    .sort(sortByTimeline);

  const targetIndex = history.findIndex((row) => row.id === targetId);
  if (targetIndex < 0) {
    throw badRequest('Transaction stock introuvable pour le recalcul');
  }

  let stockCourant = 0;
  let cmupCourant = 0;
  const cascadeUpdates = [];

  // Avant la transaction modifiée, on repart des données déjà enregistrées.
  // Cela évite de bloquer à tort une édition à cause d'un ancien historique
  // déjà figé ou d'un CMUP ajusté manuellement.
  for (let index = 0; index < targetIndex; index += 1) {
    const row = history[index];
    if (row.type === 'achat') {
      stockCourant += Math.max(0, toNumber(row.quantite, 0));
      const cmupApres = toNumber(row.nouveau_cmup, NaN);
      if (Number.isFinite(cmupApres) && cmupApres > 0) {
        cmupCourant = cmupApres;
      } else if (stockCourant <= STOCK_EPSILON) {
        cmupCourant = 0;
      }
      continue;
    }

    const usdtConsomme = Math.max(0, toNumber(row.usdt_consomme, 0));
    stockCourant = Math.max(0, stockCourant - usdtConsomme);
    if (stockCourant <= STOCK_EPSILON) {
      cmupCourant = 0;
    } else if (cmupCourant <= 0) {
      cmupCourant = Math.max(0, toNumber(row.ancien_cmup, 0));
    }
  }

  let targetProjection = null;
  for (let index = targetIndex; index < history.length; index += 1) {
    const row = history[index];
    const projection = row.type === 'achat'
      ? projectPurchaseRow(row, stockCourant, cmupCourant)
      : projectSaleRow(row, stockCourant, cmupCourant);

    const changedFields = buildChangedFields(row, projection.updateFields);

    if (row.id === targetId) {
      targetProjection = projection;
    } else if (Object.keys(changedFields).length) {
      if (row.statut === 'committed') {
        throw badRequest(`Modification impossible : la transaction verrouillée ${row.id} dépend de cet historique`);
      }
      cascadeUpdates.push({ id: row.id, fields: changedFields });
    }

    stockCourant = projection.stockAfter;
    cmupCourant = projection.cmupAfter;
  }

  return {
    targetProjection,
    cascadeUpdates,
    finalStock: stockCourant,
    finalCmup: cmupCourant,
  };
}

async function replayUsdtHistoryAfterDeletion(conn, deletedId) {
  const [historyRows] = await conn.query(`
    SELECT *
    FROM transactions
    WHERE type = 'vente'
       OR (type = 'achat' AND UPPER(COALESCE(devise, 'USDT')) = 'USDT')
  `);

  const history = historyRows
    .filter((row) => row.id !== deletedId)
    .sort(sortByTimeline);

  let stockCourant = 0;
  let cmupCourant = 0;
  const cascadeUpdates = [];

  for (const row of history) {
    const projection = row.type === 'achat'
      ? projectPurchaseRow(row, stockCourant, cmupCourant)
      : projectSaleRow(row, stockCourant, cmupCourant);

    const changedFields = buildChangedFields(row, projection.updateFields);
    if (Object.keys(changedFields).length) {
      if (row.statut === 'committed') {
        throw badRequest(`Suppression impossible : la transaction verrouillée ${row.id} dépend de cet historique`);
      }
      cascadeUpdates.push({ id: row.id, fields: changedFields });
    }

    stockCourant = projection.stockAfter;
    cmupCourant = projection.cmupAfter;
  }

  return {
    cascadeUpdates,
    finalStock: stockCourant,
    finalCmup: cmupCourant,
  };
}

async function editSaleTransaction(conn, currentTx, normalized) {
  const hasClientOverride = normalized.client !== undefined;
  const resolvedClient = await resolveClientReference(
    conn,
    hasClientOverride ? normalized.client : currentTx.client,
    hasClientOverride
      ? (normalized.client_id !== undefined ? normalized.client_id : null)
      : (normalized.client_id !== undefined ? normalized.client_id : currentTx.client_id),
    { required: true }
  );
  const resolvedSupplier = await resolveSupplierReference(
    conn,
    normalized.fournisseur !== undefined ? normalized.fournisseur : currentTx.fournisseur,
    normalized.id_fournisseur !== undefined ? normalized.id_fournisseur : currentTx.id_fournisseur,
    { required: true }
  );
  if (normalizeSupplierRole(resolvedSupplier.type) !== 'secondaire') {
    throw badRequest('La vente doit être attribuée à un fournisseur secondaire');
  }

  const effectiveDate = preserveTransactionTime(
    normalized.date,
    currentTx.date,
    currentTx.date_enregistrement
  );

  const overrideRow = {
    ...currentTx,
    devise_vente: normalized.devise_vente !== undefined ? normalized.devise_vente : currentTx.devise_vente,
    taux_conversion: normalized.taux_conversion !== undefined ? normalized.taux_conversion : currentTx.taux_conversion,
    quantite_vente: normalized.quantite_vente !== undefined ? normalized.quantite_vente : currentTx.quantite_vente,
    ancien_cmup: normalized.ancien_cmup !== undefined ? normalized.ancien_cmup : currentTx.ancien_cmup,
    cmup_operation: normalized.cmup_operation !== undefined ? normalized.cmup_operation : currentTx.cmup_operation,
    taux_vente_visible: normalized.taux_vente_visible !== undefined ? normalized.taux_vente_visible : currentTx.taux_vente_visible,
    taux_vente_cache: normalized.taux_vente_cache !== undefined ? normalized.taux_vente_cache : currentTx.taux_vente_cache,
    pourcentage_porteur: normalized.pourcentage_porteur !== undefined ? normalized.pourcentage_porteur : currentTx.pourcentage_porteur,
    pourcentage_associe: normalized.pourcentage_associe !== undefined ? normalized.pourcentage_associe : currentTx.pourcentage_associe,
    montant_paye: normalized.montant_paye !== undefined ? normalized.montant_paye : currentTx.montant_paye,
    client: resolvedClient.name,
    client_id: resolvedClient.id,
    fournisseur: resolvedSupplier.name,
    id_fournisseur: resolvedSupplier.id,
    date: effectiveDate,
    __pct_porteur_cache: normalized.pct_porteur_cache,
    __pct_associe_cache: normalized.pct_associe_cache,
  };

  const replay = await replayUsdtHistory(conn, currentTx.id, overrideRow);
  const targetFields = {
    ...replay.targetProjection.updateFields,
    ancien_cmup: overrideRow.ancien_cmup,
    date: overrideRow.date,
  };
  const changedTargetFields = buildChangedFields(currentTx, targetFields);

  await updateTransactionColumns(conn, currentTx.id, changedTargetFields);
  for (const cascade of replay.cascadeUpdates) {
    await updateTransactionColumns(conn, cascade.id, cascade.fields);
  }
  await upsertStockRow(conn, 'USDT', replay.finalStock, replay.finalCmup);

  const [updatedRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [currentTx.id]);
  return updatedRows[0];
}

async function editPurchaseTransaction(conn, currentTx, normalized) {
  const fournisseurIdFinal = normalized.id_fournisseur !== undefined ? normalized.id_fournisseur : currentTx.id_fournisseur;
  if (!toNullablePositiveInt(fournisseurIdFinal)) throw badRequest('Fournisseur requis');
  const resolvedSupplier = await resolveSupplierReference(
    conn,
    normalized.fournisseur !== undefined ? normalized.fournisseur : currentTx.fournisseur,
    fournisseurIdFinal,
    { required: true }
  );
  if (normalizeSupplierRole(resolvedSupplier.type) !== 'principal') {
    throw badRequest("L'achat direct est réservé aux fournisseurs principaux");
  }

  const quantite = toNumber(normalized.quantite !== undefined ? normalized.quantite : currentTx.quantite, NaN);
  const tauxUnitaire = toNumber(normalized.taux_achat_unitaire !== undefined ? normalized.taux_achat_unitaire : currentTx.taux_achat_unitaire, NaN);
  if (!(quantite > 0)) throw badRequest('Quantité achat invalide');
  if (!(tauxUnitaire > 0)) throw badRequest('Taux achat invalide');

  const prixAchatTotal = quantite * tauxUnitaire;
  const oldTotal = toNumber(currentTx.prix_achat_total, 0);
  const oldSource = currentTx.use_caisse ? 'caisse' : 'depot';
  const nextUseCaisse = normalized.use_caisse !== undefined ? Boolean(normalized.use_caisse) : Boolean(currentTx.use_caisse);
  const newSource = nextUseCaisse ? 'caisse' : 'depot';

  if (oldSource === newSource) {
    await applyAccountDelta(
      conn,
      newSource,
      oldTotal - prixAchatTotal,
      newSource === 'caisse' ? 'Solde caisse insuffisant' : 'Solde dépôt insuffisant'
    );
  } else {
    await applyAccountDelta(conn, oldSource, oldTotal);
    await applyAccountDelta(
      conn,
      newSource,
      -prixAchatTotal,
      newSource === 'caisse' ? 'Solde caisse insuffisant' : 'Solde dépôt insuffisant'
    );
  }

  const effectiveDate = preserveTransactionTime(
    normalized.date,
    currentTx.date,
    currentTx.date_enregistrement
  );

  const overrideRow = {
    ...currentTx,
    devise: 'USDT',
    quantite,
    taux_achat_unitaire: tauxUnitaire,
    prix_achat_total: prixAchatTotal,
    montant_a_payer: 0,
    montant_paye: prixAchatTotal,
    fournisseur: resolvedSupplier.name,
    id_fournisseur: resolvedSupplier.id,
    use_caisse: nextUseCaisse ? 1 : 0,
    date: effectiveDate,
  };

  const replay = await replayUsdtHistory(conn, currentTx.id, overrideRow);
  const targetFields = {
    ...replay.targetProjection.updateFields,
    fournisseur: resolvedSupplier.name,
    id_fournisseur: resolvedSupplier.id,
    use_caisse: nextUseCaisse ? 1 : 0,
    date: overrideRow.date,
  };
  const changedTargetFields = buildChangedFields(currentTx, targetFields);

  await updateTransactionColumns(conn, currentTx.id, changedTargetFields);
  for (const cascade of replay.cascadeUpdates) {
    await updateTransactionColumns(conn, cascade.id, cascade.fields);
  }
  await upsertStockRow(conn, 'USDT', replay.finalStock, replay.finalCmup);

  const [updatedRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [currentTx.id]);
  return updatedRows[0];
}

async function editCashLikeTransaction(conn, currentTx, normalized) {
  const montant = toNumber(normalized.montant !== undefined ? normalized.montant : currentTx.montant, NaN);
  if (!(montant > 0)) throw badRequest('Montant invalide');
  const effectiveDate = preserveTransactionTime(
    normalized.date,
    currentTx.date,
    currentTx.date_enregistrement
  );

  const oldMontant = toNumber(currentTx.montant, 0);
  const delta = currentTx.type === 'versement'
    ? (montant - oldMontant)
    : (oldMontant - montant);
  await applyAccountDelta(conn, 'caisse', delta, 'Solde caisse insuffisant');

  const targetFields = {
    montant,
    date: effectiveDate,
  };
  if (currentTx.type === 'depense') {
    targetFields.categorie = normalized.categorie !== undefined ? normalized.categorie : currentTx.categorie;
    targetFields.notes = normalized.notes !== undefined ? normalized.notes : currentTx.notes;
  }
  if (currentTx.type === 'retrait') {
    targetFields.beneficiaire = normalized.beneficiaire !== undefined ? normalized.beneficiaire : currentTx.beneficiaire;
    targetFields.notes = normalized.notes !== undefined ? normalized.notes : currentTx.notes;
  }

  const changedTargetFields = buildChangedFields(currentTx, targetFields);
  await updateTransactionColumns(conn, currentTx.id, changedTargetFields);
  const [updatedRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [currentTx.id]);
  return updatedRows[0];
}

async function editClientPaymentTransaction(conn, currentTx, normalized) {
  const hasClientOverride = normalized.client !== undefined;
  const resolvedClient = await resolveClientReference(
    conn,
    hasClientOverride ? normalized.client : currentTx.client,
    hasClientOverride
      ? (normalized.client_id !== undefined ? normalized.client_id : null)
      : (normalized.client_id !== undefined ? normalized.client_id : currentTx.client_id),
    { required: true }
  );

  const montantPaye = toNumber(normalized.montant_paye !== undefined ? normalized.montant_paye : currentTx.montant_paye, NaN);
  if (!(montantPaye > 0)) throw badRequest('Montant reçu invalide');

  const effectiveDate = preserveTransactionTime(
    normalized.date,
    currentTx.date,
    currentTx.date_enregistrement
  );

  const targetFields = {
    client: resolvedClient.name,
    client_id: resolvedClient.id,
    montant_a_payer: 0,
    montant_paye: montantPaye,
    devise: 'XAF',
    date: effectiveDate,
  };
  const changedTargetFields = buildChangedFields(currentTx, targetFields);
  await updateTransactionColumns(conn, currentTx.id, changedTargetFields);
  const [updatedRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [currentTx.id]);
  return updatedRows[0];
}

async function editSupplierPaymentTransaction(conn, currentTx, normalized) {
  const resolvedSupplier = await resolveSupplierReference(
    conn,
    normalized.fournisseur !== undefined ? normalized.fournisseur : currentTx.fournisseur,
    normalized.id_fournisseur !== undefined ? normalized.id_fournisseur : currentTx.id_fournisseur,
    { required: true }
  );

  const montantPaye = toNumber(normalized.montant_paye !== undefined ? normalized.montant_paye : currentTx.montant_paye, NaN);
  if (!(montantPaye > 0)) throw badRequest('Montant payé invalide');

  const devise = String(normalized.devise !== undefined ? normalized.devise : currentTx.devise || 'XAF').toUpperCase();
  if (!['XAF', 'USDT'].includes(devise)) throw badRequest('Devise invalide (XAF ou USDT)');

  const effectiveDate = preserveTransactionTime(
    normalized.date,
    currentTx.date,
    currentTx.date_enregistrement
  );

  const targetFields = {
    fournisseur: resolvedSupplier.name,
    id_fournisseur: resolvedSupplier.id,
    montant: 0,
    montant_paye: montantPaye,
    devise,
    date: effectiveDate,
  };
  const changedTargetFields = buildChangedFields(currentTx, targetFields);
  await updateTransactionColumns(conn, currentTx.id, changedTargetFields);
  const [updatedRows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [currentTx.id]);
  return updatedRows[0];
}

async function getClientOutstanding(conn, clientId, clientName) {
  const normalizedName = normalizeFullName(clientName);
  const [rows] = await conn.query(`
    SELECT
      IFNULL(SUM(CASE
        WHEN t.type = 'vente' THEN COALESCE(t.montant_a_payer, t.valeur_vente_visible, 0)
        ELSE 0
      END), 0) AS total_due,
      IFNULL(SUM(CASE
        WHEN t.type IN ('vente', 'paiement_client') THEN COALESCE(t.montant_paye, 0)
        ELSE 0
      END), 0) AS total_paid
    FROM transactions t
    WHERE (t.client_id = ? OR FIND_IN_SET(?, t.client) > 0)
      AND t.type IN ('vente', 'paiement_client')
      AND (
        t.statut IN ('committed', 'porteur_pending', 'assoc_pending')
        OR (t.type IN ('vente', 'paiement_client') AND t.statut = 'pending')
      )
  `, [clientId || null, normalizedName]);

  const totalDue = parseFloat(rows?.[0]?.total_due || 0);
  const totalPaid = parseFloat(rows?.[0]?.total_paid || 0);
  return {
    totalDue,
    totalPaid,
    reste: totalDue - totalPaid,
  };
}

async function getSupplierOutstanding(conn, fournisseurId, fournisseurName) {
  const normalizedName = normalizeFullName(fournisseurName);
  const [rows] = await conn.query(`
    SELECT
      IFNULL(SUM(CASE
        WHEN t.type = 'vente' AND t.id_fournisseur IS NOT NULL THEN COALESCE(t.valeur_achat_xaf, 0)
        ELSE 0
      END), 0) AS total_due,
      IFNULL(SUM(CASE
        WHEN t.type = 'achat' THEN COALESCE(t.prix_achat_total, t.montant_paye, 0)
        WHEN t.type = 'paiement_fournisseur' THEN COALESCE(t.montant_paye, 0)
        ELSE 0
      END), 0) AS total_paid
    FROM transactions t
    WHERE (
      (t.type = 'achat' AND (t.id_fournisseur = ? OR TRIM(t.fournisseur) = TRIM(?)))
      OR (t.type = 'vente' AND t.id_fournisseur = ?)
      OR (t.type = 'paiement_fournisseur' AND t.id_fournisseur = ?)
    )
      AND (
        t.statut IN ('committed', 'porteur_pending', 'assoc_pending')
        OR (t.type IN ('achat', 'vente', 'paiement_fournisseur') AND t.statut = 'pending')
      )
  `, [fournisseurId || null, normalizedName, fournisseurId || null, fournisseurId || null]);

  const totalDue = parseFloat(rows?.[0]?.total_due || 0);
  const totalPaid = parseFloat(rows?.[0]?.total_paid || 0);
  return {
    totalDue,
    totalPaid,
    reste: totalDue - totalPaid,
  };
}

// ─────────────────────────────────────────────────────────────
// GET /api/transactions
// ─────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 500, type, statut } = req.query;
  const maxRows = Math.min(parseInt(limit, 10) || 500, 1000);

  let sql = `
    SELECT t.*, u.name AS user_name, u.role AS user_role, u.email AS user_email
    FROM transactions t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE 1=1`;
  const params = [];

  if (type)   { sql += ' AND t.type = ?';   params.push(type); }
  if (statut) { sql += ' AND t.statut = ?'; params.push(statut); }
  // Tri par date d'enregistrement réelle DESC (pas date_operation qui peut être minuit)
  sql += ` ORDER BY t.date_enregistrement DESC, t.id DESC LIMIT ${maxRows}`;

  const rows = await query(sql, params);

  let transferRows = [];
  if ((!type || type === 'transfert_fournisseur') && !statut) {
    await ensureSupplierFeatures();
    transferRows = await query(`
      SELECT
        tf.id,
        tf.user_id,
        'transfert_fournisseur' AS type,
        tf.montant_usdt,
        tf.montant_xaf,
        tf.montant_usdt AS quantite,
        tf.montant_usdt AS usdt_consomme,
        'USDT' AS devise,
        tf.montant_xaf AS montant,
        COALESCE(tf.statut, 'pending') AS statut,
        tf.date,
        tf.date AS date_enregistrement,
        tf.notes,
        tf.source_id,
        tf.destination_id,
        COALESCE(tf.source_nom, TRIM(CONCAT(src.nom, IF(src.prenom IS NOT NULL AND src.prenom != '', CONCAT(' ', src.prenom), '')))) AS source_nom,
        COALESCE(tf.destination_nom, TRIM(CONCAT(dst.nom, IF(dst.prenom IS NOT NULL AND dst.prenom != '', CONCAT(' ', dst.prenom), '')))) AS destination_nom,
        CONCAT(
          COALESCE(tf.source_nom, TRIM(CONCAT(src.nom, IF(src.prenom IS NOT NULL AND src.prenom != '', CONCAT(' ', src.prenom), '')))),
          ' -> ',
          COALESCE(tf.destination_nom, TRIM(CONCAT(dst.nom, IF(dst.prenom IS NOT NULL AND dst.prenom != '', CONCAT(' ', dst.prenom), ''))))
        ) AS fournisseur,
        tf.source_stock_avant,
        tf.source_stock_apres,
        tf.destination_stock_avant,
        tf.destination_stock_apres,
        u.name AS user_name,
        u.role AS user_role,
        u.email AS user_email
      FROM transferts_fournisseurs tf
      LEFT JOIN comptes_fournisseurs src ON tf.source_id = src.id
      LEFT JOIN comptes_fournisseurs dst ON tf.destination_id = dst.id
      LEFT JOIN users u ON tf.user_id = u.id
      ORDER BY tf.date DESC, tf.id DESC
      LIMIT ${maxRows}
    `);
  }

  const transactions = [...rows, ...transferRows]
    .sort((a, b) => {
      const aTime = new Date(a.date_enregistrement || a.date || 0).getTime();
      const bTime = new Date(b.date_enregistrement || b.date || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return String(b.id || '').localeCompare(String(a.id || ''));
    })
    .slice(0, maxRows);

  res.json({ transactions });
}));

// ─────────────────────────────────────────────────────────────
// POST /api/transactions
// ─────────────────────────────────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { type, ...data } = req.body;
  if (!type) return res.status(400).json({ error: 'Type requis' });

  let result;
  switch (type) {
    case 'achat':     result = await handleAchat(data, req.user);     break;
    case 'vente':     result = await handleVente(data, req.user);     break;
    case 'depense':   result = await handleDepense(data, req.user);   break;
    case 'retrait':   result = await handleRetrait(data, req.user);   break;
    case 'versement': result = await handleVersement(data, req.user); break;
    case 'paiement_client':      result = await handlePaiementClient(data, req.user);      break;
    case 'paiement_fournisseur': result = await handlePaiementFournisseur(data, req.user); break;
    default: return res.status(400).json({ error: 'Type invalide' });
  }
  res.json(result);
}));

// ─────────────────────────────────────────────────────────────
// PUT /api/transactions/:id/valider — VERROUILLER UNIQUEMENT
// Rôle : rendre la transaction non-modifiable (committed)
// Stock et comptes déjà mis à jour à la création
// ─────────────────────────────────────────────────────────────
router.put('/:id/valider', asyncHandler(async (req, res) => {
  const { id } = req.params;
  await ensureSupplierFeatures();
  const transferRows = await query('SELECT id, statut FROM transferts_fournisseurs WHERE id = ?', [id]);
  if (transferRows.length) {
    if (transferRows[0].statut === 'committed') {
      return res.status(400).json({ error: 'Transaction déjà verrouillée' });
    }
    await query("UPDATE transferts_fournisseurs SET statut = 'committed' WHERE id = ?", [id]);
    await query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'lock', ?, ?)",
      [`LOG_${Date.now()}`, `Transfert verrouillé: ${id}`, req.user.id]
    );
    return res.json({ success: true, transaction_id: id, statut: 'committed' });
  }
  const txRows = await query('SELECT id, type, statut FROM transactions WHERE id = ?', [id]);

  if (!txRows || txRows.length === 0)
    return res.status(404).json({ error: 'Transaction non trouvée' });

  if (txRows[0].statut === 'committed')
    return res.status(400).json({ error: 'Transaction déjà verrouillée' });

  // Uniquement verrouiller — rien d'autre
  await query(
    "UPDATE transactions SET statut = 'committed', date_modification = NOW() WHERE id = ?",
    [id]
  );

  await query(
    "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'lock', ?, ?)",
    [`LOG_${Date.now()}`, `Transaction verrouillée: ${id} (type: ${txRows[0].type})`, req.user.id]
  );

  res.json({ success: true, transaction_id: id, statut: 'committed' });
}));

// ═════════════════════════════════════════════════════════════
// 🆕 PUT /api/transactions/:id/edit - MODIFIER SANS VALIDATION
// ✅ Modifie les champs d'une transaction (sauf si committée)
// ✅ Ne valide PAS la transaction — met à jour le champ demandé
// ═════════════════════════════════════════════════════════════
const editSupplierTransfer = async (req, id, body) => {
  await ensureSupplierFeatures();
  return dbTransaction(async (conn) => {
    const [transferRows] = await conn.query('SELECT * FROM transferts_fournisseurs WHERE id = ?', [id]);
    if (!transferRows.length) return null;
    const current = transferRows[0];
    if (current.statut === 'committed') throw badRequest('Impossible de modifier une transaction verrouillée');
    if (req.user?.role === 'associe' && String(current.user_id || '') !== String(req.user.id || '')) {
      throw Object.assign(new Error('Un associé ne peut modifier que ses propres saisies'), { status: 403 });
    }

    const sourceId = Number(body.source_id ?? current.source_id);
    const destinationId = Number(body.destination_id ?? current.destination_id);
    const amount = Number(body.montant_usdt ?? current.montant_usdt);
    if (!sourceId || !destinationId || sourceId === destinationId || !(amount > 0)) {
      throw badRequest('Source, destination et montant USDT invalides');
    }

    const [suppliers] = await conn.query(`
      SELECT id, nom, prenom, COALESCE(type_fournisseur, 'secondaire') AS type_fournisseur
      FROM comptes_fournisseurs WHERE id IN (?, ?)
    `, [sourceId, destinationId]);
    const source = suppliers.find((row) => Number(row.id) === sourceId);
    const destination = suppliers.find((row) => Number(row.id) === destinationId);
    if (!source || !destination) throw badRequest('Fournisseur introuvable');
    if (normalizeSupplierRole(source.type_fournisseur) !== 'principal') throw badRequest('Le fournisseur source doit être principal');
    if (normalizeSupplierRole(destination.type_fournisseur) !== 'secondaire') throw badRequest('Le fournisseur destination doit être secondaire');

    const sourceBalance = await getSupplierUsdtBalance(conn, sourceId);
    const available = sourceBalance.stockUsdt + (Number(current.source_id) === sourceId ? Number(current.montant_usdt || 0) : 0);
    if (available + 1e-8 < amount) throw badRequest('Solde USDT source insuffisant');
    const [stockRows] = await conn.query('SELECT cmup FROM stock WHERE devise = ?', ['USDT']);
    const montantXaf = amount * Number(stockRows?.[0]?.cmup || 0);
    const transferDate = body.date ? new Date(body.date) : current.date;
    const sourceAfter = available - amount;
    const destinationBalance = await getSupplierUsdtBalance(conn, destinationId);

    await conn.query(`
      UPDATE transferts_fournisseurs
      SET source_id = ?, destination_id = ?, montant_usdt = ?, montant_xaf = ?, date = ?, notes = ?,
          source_nom = ?, destination_nom = ?, source_stock_avant = ?, source_stock_apres = ?,
          destination_stock_avant = ?, destination_stock_apres = ?
      WHERE id = ?
    `, [sourceId, destinationId, amount, montantXaf, transferDate, body.notes ?? current.notes ?? null,
      normalizeFullName(source.nom, source.prenom), normalizeFullName(destination.nom, destination.prenom),
      available, sourceAfter, destinationBalance.stockUsdt, destinationBalance.stockUsdt + amount, id]);
    return { id, type: 'transfert_fournisseur', montant_usdt: amount, montant_xaf: montantXaf };
  });
};

router.put('/:id/edit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const body = req.body || {};

  if (Object.keys(body).length === 0) {
    return res.status(400).json({ error: 'Aucune modification fournie' });
  }

  const transfer = await editSupplierTransfer(req, id, body);
  if (transfer) {
    await query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'modification', ?, ?)",
      [`LOG_${Date.now()}`, `Transfert modifié: ${id}`, req.user.id]
    );
    return res.json({ success: true, message: 'Transfert modifié', transaction: transfer });
  }

  const normalized = normalizeEditPayload(body);
  const updatedTransaction = await dbTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!rows.length) throw Object.assign(new Error('Transaction non trouvée'), { status: 404 });

    const currentTx = rows[0];
    if (currentTx.statut === 'committed') {
      throw badRequest('Impossible de modifier une transaction verrouillée');
    }

    if (req.user?.role === 'associe') {
      if (String(currentTx.user_id || '') !== String(req.user.id || '')) {
        throw Object.assign(new Error('Un associé ne peut modifier que ses propres saisies'), { status: 403 });
      }

      const createdAt = currentTx.date_enregistrement ? new Date(currentTx.date_enregistrement) : null;
      const ageMinutes = createdAt instanceof Date && !Number.isNaN(createdAt.getTime())
        ? (Date.now() - createdAt.getTime()) / 60000
        : Number.POSITIVE_INFINITY;

      if (ageMinutes > 5) {
        throw badRequest('Modification impossible : le délai de 5 minutes est dépassé');
      }
    }

    switch (currentTx.type) {
      case 'vente':
        return editSaleTransaction(conn, currentTx, normalized);
      case 'achat':
        return editPurchaseTransaction(conn, currentTx, normalized);
      case 'depense':
      case 'retrait':
      case 'versement':
        return editCashLikeTransaction(conn, currentTx, normalized);
      case 'paiement_client':
        return editClientPaymentTransaction(conn, currentTx, normalized);
      case 'paiement_fournisseur':
        return editSupplierPaymentTransaction(conn, currentTx, normalized);
      default:
        throw badRequest(`Type de transaction non modifiable: ${currentTx.type}`);
    }
  });

  await query(
    "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'modification', ?, ?)",
    [`LOG_${Date.now()}`, `Transaction modifiée: ${id} - Champs: ${Object.keys(body).join(', ')}`, req.user.id]
  );

  res.json({
    success: true,
    message: 'Transaction modifiée',
    transaction: updatedTransaction,
  });
}));

// ─────────────────────────────────────────────────────────────
// DELETE /api/transactions/:id — SUPPRESSION AVEC RETOUR EN ARRIÈRE
// ─────────────────────────────────────────────────────────────
const deleteTransactionHandler = async (req, res, id) => {
  await ensureSupplierFeatures();
  const transferRows = await query('SELECT id, user_id FROM transferts_fournisseurs WHERE id = ?', [id]);
  if (transferRows.length) {
    const [statusRows] = await query('SELECT statut FROM transferts_fournisseurs WHERE id = ?', [id]);
    if (statusRows?.[0]?.statut === 'committed') {
      throw badRequest('Suppression impossible : transaction verrouillée');
    }
    if (req.user?.role === 'associe') {
      throw Object.assign(new Error('Un associé ne peut pas supprimer une opération'), { status: 403 });
    }
    await query('DELETE FROM transferts_fournisseurs WHERE id = ?', [id]);
    await query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'suppression', ?, ?)",
      [`LOG_${Date.now()}`, `Transfert supprimé: ${id}`, req.user.id]
    );
    return res.json({ success: true, message: 'Transfert supprimé', transaction_id: id, type: 'transfert_fournisseur' });
  }

  const deletedTransaction = await dbTransaction(async (conn) => {
    const [rows] = await conn.query('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!rows.length) throw Object.assign(new Error('Transaction non trouvée'), { status: 404 });

    const currentTx = rows[0];
    if (currentTx.statut === 'committed') {
      throw badRequest('Suppression impossible : transaction verrouillée');
    }

    if (req.user?.role === 'associe') {
      throw Object.assign(new Error('Un associé ne peut pas supprimer une opération'), { status: 403 });
    }

    const sourceAccount = currentTx.use_caisse ? 'caisse' : 'depot';
    const amount = toNumber(currentTx.montant, 0);

    if (currentTx.type === 'achat') {
      await applyAccountDelta(conn, sourceAccount, toNumber(currentTx.prix_achat_total, 0));
    } else if (currentTx.type === 'depense' || currentTx.type === 'retrait') {
      await applyAccountDelta(conn, 'caisse', amount);
    } else if (currentTx.type === 'versement') {
      await conn.query(
        'UPDATE comptes SET montant = montant - ? WHERE type_compte = ?',
        [amount, 'caisse']
      );
    }

    await conn.query('DELETE FROM transactions WHERE id = ?', [id]);

    let replay = null;
    if (currentTx.type === 'vente' || currentTx.type === 'achat') {
      replay = await replayUsdtHistoryAfterDeletion(conn, id);
      for (const cascade of replay.cascadeUpdates) {
        await updateTransactionColumns(conn, cascade.id, cascade.fields);
      }
      await upsertStockRow(conn, 'USDT', replay.finalStock, replay.finalCmup);
    }

    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'suppression', ?, ?)",
      [`LOG_${Date.now()}`, `Transaction supprimée: ${id} (type: ${currentTx.type})`, req.user.id]
    );

    return { id, type: currentTx.type, replay };
  });

  res.json({
    success: true,
    message: 'Transaction supprimée',
    transaction_id: deletedTransaction.id,
    type: deletedTransaction.type,
  });
};

router.delete('/delete/:id', asyncHandler(async (req, res) => {
  await deleteTransactionHandler(req, res, req.params.id);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  await deleteTransactionHandler(req, res, req.params.id);
}));

// ═════════════════════════════════════════════════════════════
// ACHAT
// ✅ FIX: Retourner statut 'pending' (pas 'committed')
// ✅ Stock mis à jour dès création
// ✅ Date de l'opération respectée
// ═════════════════════════════════════════════════════════════
async function handleAchat(data, user) {
  const { quantite, taux_unitaire, use_caisse = false, fournisseur, id_fournisseur } = data;
  if (!quantite || !taux_unitaire) throw badRequest('Quantité et taux unitaire requis');
  if (!toNullablePositiveInt(id_fournisseur)) throw badRequest('Fournisseur requis');

  const qte       = parseFloat(quantite);
  const taux      = parseFloat(taux_unitaire);
  const prixTotal = qte * taux;
  const source    = use_caisse ? 'caisse' : 'depot';
  const dateOp    = data.date ? new Date(data.date) : new Date();

  if (!(qte > 0)) throw badRequest('Quantité achat invalide');
  if (!(taux > 0)) throw badRequest('Taux achat invalide');

  return await dbTransaction(async (conn) => {
    await ensureSupplierFeatures();
    const resolvedSupplier = await resolveSupplierReference(conn, fournisseur, id_fournisseur, { required: true });
    if (normalizeSupplierRole(resolvedSupplier.type) !== 'principal') {
      throw badRequest("L'achat direct est réservé aux fournisseurs principaux");
    }

    // Vérification solde si caisse
    if (use_caisse) {
      const [caisseRows] = await conn.query(
        'SELECT montant FROM comptes WHERE type_compte = ?', ['caisse']
      );
      if (!caisseRows.length || parseFloat(caisseRows[0].montant) < prixTotal)
        throw badRequest('Solde caisse insuffisant');
    }

    const [stockRows] = await conn.query(
      'SELECT quantite, cmup FROM stock WHERE devise = ?', ['USDT']
    );
    const stockActuel = stockRows.length ? parseFloat(stockRows[0].quantite) : 0;
    const cmupActuel  = stockRows.length ? parseFloat(stockRows[0].cmup)     : 0;

    const nouveauCmup = stockActuel <= 0
      ? taux
      : ((stockActuel * cmupActuel) + (qte * taux)) / (stockActuel + qte);

    const txId = `TX_${Date.now()}`;

    // ✅ FIX: Création en 'pending' — modifiable
    // Stock mis à jour IMMÉDIATEMENT
    await conn.query(`
      INSERT INTO transactions
        (id, user_id, type, devise, quantite, taux_achat_unitaire,
         prix_achat_total, montant_a_payer, montant_paye, use_caisse, ancien_cmup,
         nouveau_cmup, fournisseur, id_fournisseur, statut, date)
      VALUES (?, ?, 'achat', 'USDT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [txId, user.id, qte, taux, prixTotal, 0,
       prixTotal,          // montant_paye = prixTotal (payé immédiatement)
       use_caisse ? 1 : 0, cmupActuel, nouveauCmup,
       resolvedSupplier.name, resolvedSupplier.id, dateOp]
    );

    // ✅ FIX Stock: INSERT si ligne n'existe pas, UPDATE sinon
    if (stockRows.length === 0) {
      await conn.query(
        'INSERT INTO stock (devise, quantite, cmup) VALUES (?, ?, ?)',
        ['USDT', qte, nouveauCmup]
      );
    } else {
      await conn.query(
        'UPDATE stock SET quantite = quantite + ?, cmup = ? WHERE devise = ?',
        [qte, nouveauCmup, 'USDT']
      );
    }

    // Déduire de la caisse ou dépôt
    await conn.query(
      'UPDATE comptes SET montant = montant - ? WHERE type_compte = ?',
      [prixTotal, source]
    );

    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'achat', ?, ?)",
      [`LOG_${Date.now()}`,
       `Achat USDT: ${qte} @ ${taux} XAF — Source: ${source} — Fournisseur: ${resolvedSupplier.name}`,
       user.id]
    );

    return {
      success: true,
      message: 'Achat enregistré — En attente validation',
      transaction_id: txId,
      statut: 'pending',  // ✅ FIX: Retourner le vrai statut
      nouveau_cmup: nouveauCmup,
    };
  });
}

// ═════════════════════════════════════════════════════════════
// VENTE
// ✅ FIX: Retourner statut 'pending' (pas 'committed')
// ═════════════════════════════════════════════════════════════
async function handleVente(data, user) {
  const {
    devise_vente, taux_conversion, quantite_vente,
    taux_vente_visible,
    cmup_usdt = null, cmup_operation = 'divide',
    client, fournisseur, id_client = null, id_fournisseur = null, client_id = null, fournisseur_id = null, taux_vente_cache = null,
    ancien_cmup = null,
    mode_paiement  = 'XAF',
  } = data;

  return await dbTransaction(async (conn) => {
    await ensureSupplierFeatures();
    const [stockRows] = await conn.query(
      'SELECT quantite, cmup FROM stock WHERE devise = ?', ['USDT']
    );

    const stockActuel = stockRows.length ? parseFloat(stockRows[0].quantite) : 0;
    const cmupActuel  = stockRows.length ? parseFloat(stockRows[0].cmup)     : 0;

    const qteVente     = parseFloat(quantite_vente);
    const tauxConv     = parseFloat(taux_conversion);
    const tauxVVisible = parseFloat(taux_vente_visible);
    const tauxVCacheRaw = taux_vente_cache ? parseFloat(taux_vente_cache) : tauxVVisible;
    const tauxVCache    = Number.isFinite(tauxVCacheRaw) && tauxVCacheRaw > 0 ? tauxVCacheRaw : tauxVVisible;
    const cmupBaseRaw   = parseFloat(ancien_cmup ?? cmup_usdt);
    const cmupBase      = Number.isFinite(cmupBaseRaw) && cmupBaseRaw > 0 ? cmupBaseRaw : cmupActuel;
    const operation     = String(cmup_operation || 'divide').toLowerCase() === 'multiply' ? 'multiply' : 'divide';
    const normalizeLabel = (value) => String(value || '')
      .replace(/\s*\(.*$/, '')
      .replace(/\s*·.*$/, '')
      .trim();

    let clientNom = normalizeLabel(client);
    let fournisseurNom = normalizeLabel(fournisseur);
    let clientId = parseInt(id_client ?? client_id, 10);
    let fournisseurId = parseInt(id_fournisseur ?? fournisseur_id, 10);

    if (!Number.isFinite(clientId) || clientId <= 0) clientId = null;
    if (!Number.isFinite(fournisseurId) || fournisseurId <= 0) fournisseurId = null;

    if (!Number.isFinite(qteVente) || qteVente <= 0)
      throw new Error('Quantité de vente invalide');
    if (!Number.isFinite(tauxConv) || tauxConv <= 0)
      throw new Error('Taux de conversion invalide');
    if (!Number.isFinite(tauxVVisible) || tauxVVisible <= 0)
      throw new Error('Taux de vente visible invalide');

    const pctPorteurRaw = data.pct_porteur ?? data.porteurPct ?? data.pourcentage_porteur ?? 70;
    const pctAssocieRaw = data.pct_associe ?? data.associePct ?? data.pourcentage_associe ?? (100 - parseFloat(pctPorteurRaw || 0));
    const pct_porteur = Number.isFinite(parseFloat(pctPorteurRaw)) ? parseFloat(pctPorteurRaw) : 70;
    const pct_associe = Number.isFinite(parseFloat(pctAssocieRaw)) ? parseFloat(pctAssocieRaw) : (100 - pct_porteur);
    // Si le frontend fournit aussi une répartition cachée, on la conserve séparément.
    const pctPorteurCacheRaw = data.pct_porteur_cache ?? data.porteurPctCache ?? data.pourcentage_porteur_cache ?? pctPorteurRaw;
    const pctAssocieCacheRaw = data.pct_associe_cache ?? data.associePctCache ?? data.pourcentage_associe_cache ?? (100 - parseFloat(pctPorteurCacheRaw || 0));
    const pct_porteur_cache = Number.isFinite(parseFloat(pctPorteurCacheRaw)) ? parseFloat(pctPorteurCacheRaw) : pct_porteur;
    const pct_associe_cache = Number.isFinite(parseFloat(pctAssocieCacheRaw)) ? parseFloat(pctAssocieCacheRaw) : (100 - pct_porteur_cache);

    // Normaliser les entités:
    // - le frontend envoie le nom affiché;
    // - on recalcule aussi les IDs pour éviter qu'un champ "vide" côté UI
    //   bloque une vente pourtant correctement sélectionnée.
    if (!clientNom && clientId) {
      const [cRows] = await conn.query(
        'SELECT nom, prenom FROM comptes_clients WHERE id = ?',
        [clientId]
      );
      if (cRows.length) clientNom = [cRows[0].nom, cRows[0].prenom].filter(Boolean).join(' ');
    }
    if (!clientId && clientNom) {
      const [cRows] = await conn.query(
        `SELECT id FROM comptes_clients
         WHERE TRIM(CONCAT(nom, IF(prenom IS NOT NULL AND prenom != '', CONCAT(' ', prenom), ''))) = TRIM(?)
         LIMIT 1`,
        [clientNom]
      );
      if (cRows.length) clientId = cRows[0].id;
    }

    if (!fournisseurNom && fournisseurId) {
      const [fRows] = await conn.query(
        'SELECT nom, prenom FROM comptes_fournisseurs WHERE id = ?',
        [fournisseurId]
      );
      if (fRows.length) fournisseurNom = [fRows[0].nom, fRows[0].prenom].filter(Boolean).join(' ');
    }
    if (!fournisseurId && fournisseurNom) {
      const [fRows] = await conn.query(
        `SELECT id FROM comptes_fournisseurs
         WHERE TRIM(CONCAT(nom, IF(prenom IS NOT NULL AND prenom != '', CONCAT(' ', prenom), ''))) = TRIM(?)
         LIMIT 1`,
        [fournisseurNom]
      );
      if (fRows.length) fournisseurId = fRows[0].id;
    }

    const missingFields = [];
    if (!devise_vente) missingFields.push('devise_vente');
    if (!Number.isFinite(qteVente) || qteVente <= 0) missingFields.push('quantite_vente');
    if (!Number.isFinite(tauxConv) || tauxConv <= 0) missingFields.push('taux_conversion');
    if (!Number.isFinite(tauxVVisible) || tauxVVisible <= 0) missingFields.push('taux_vente_visible');
    if (!clientNom) missingFields.push('client');
    if (!fournisseurNom) missingFields.push('fournisseur');
    if (missingFields.length) {
      throw new Error(`Champs manquants pour la vente: ${missingFields.join(', ')}`);
    }

    // Convention métier:
    // quantite_vente = quantité vendue au client dans la devise choisie
    // usdt_consomme   = quantité réelle retirée du stock USDT
    const usdtConsomme = operation === 'multiply'
      ? qteVente * tauxConv
      : qteVente / tauxConv;
    const tauxAchatXAF = cmupBase > 0
      ? (operation === 'multiply' ? cmupBase * tauxConv : cmupBase / tauxConv)
      : 0;

    const [supplierRoleRows] = await conn.query(
      'SELECT COALESCE(type_fournisseur, "secondaire") AS type_fournisseur FROM comptes_fournisseurs WHERE id = ?',
      [fournisseurId]
    );
    if (!supplierRoleRows.length) throw new Error('Fournisseur introuvable');
    const supplierRole = normalizeSupplierRole(supplierRoleRows[0].type_fournisseur);
    if (supplierRole !== 'secondaire') throw new Error('La vente doit être attribuée à un fournisseur secondaire');

    const supplierBalance = await getSupplierUsdtBalance(conn, fournisseurId);
    if (supplierBalance.stockUsdt + STOCK_EPSILON < usdtConsomme) {
      throw new Error(`Solde USDT fournisseur insuffisant: ${supplierBalance.stockUsdt.toFixed(4)} USDT disponibles, ${usdtConsomme.toFixed(4)} USDT requis`);
    }

    if (stockActuel < usdtConsomme)
      throw new Error(`Stock insuffisant: ${stockActuel.toFixed(4)} USDT disponibles, ${usdtConsomme.toFixed(4)} USDT requis`);

    // ── Calculs financiers ────────────────────────────────────
    const valeurVenteVisible = qteVente * tauxVVisible;
    const valeurVenteCachee  = qteVente * tauxVCache;
    const valeurAchatXAF     = qteVente * tauxAchatXAF;
    const montantAPayer      = valeurVenteVisible;
    const montantPaye        = Math.max(0, toNumber(data.montant_paye ?? data.montantPaye, 0));

    const beneficeVisible    = valeurVenteVisible - valeurAchatXAF;
    const beneficeCache      = valeurVenteCachee  - valeurAchatXAF;

    const partPorteurVisible = beneficeVisible * (pct_porteur / 100);
    const partAssocieVisible = beneficeVisible * (pct_associe / 100);
    const partPorteurCachee  = beneficeCache   * (pct_porteur_cache / 100);
    const partAssocieCachee  = beneficeCache   * (pct_associe_cache / 100);

    const txId = `TX_${Date.now()}`;

    await conn.query(`
      INSERT INTO transactions (
        id, user_id, type,
        devise_vente, taux_conversion, taux_achat_xaf, quantite_vente, usdt_consomme,
        taux_vente_visible, valeur_vente_visible,
        taux_vente_cache,  valeur_vente_cachee,
        valeur_achat_xaf,  ancien_cmup,
        benefice_visible,  benefice_cache,
        part_porteur_visible, part_associe_visible,
        part_porteur_cachee,  part_associe_cachee,
        pourcentage_porteur,  pourcentage_associe,
        client, fournisseur, client_id, id_fournisseur,
        montant_a_payer, montant_paye, statut, date
      ) VALUES (
        ?, ?, 'vente',
        ?, ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        'pending', ?
      )`,
      [
        txId, user.id,
        devise_vente, tauxConv, tauxAchatXAF, qteVente, usdtConsomme,
        tauxVVisible, valeurVenteVisible,
        tauxVCache,   valeurVenteCachee,
        valeurAchatXAF, cmupBase,
        beneficeVisible, beneficeCache,
        partPorteurVisible, partAssocieVisible,
        partPorteurCachee,  partAssocieCachee,
        pct_porteur, pct_associe,
        clientNom, fournisseurNom, clientId, fournisseurId,
        montantAPayer, montantPaye, new Date(),
      ]
    );

    // Décrémenter le stock
    const nouveauStock = stockActuel - usdtConsomme;
    const nouveauCmup  = nouveauStock > 0 ? cmupActuel : 0;

    await conn.query(
      'UPDATE stock SET quantite = ?, cmup = ? WHERE devise = ?',
      [nouveauStock, nouveauCmup, 'USDT']
    );

    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'vente', ?, ?)",
      [`LOG_${Date.now()}`,
       `Vente ${devise_vente}: ${qteVente.toFixed(4)} ${devise_vente} → ${usdtConsomme.toFixed(4)} USDT consommés @ ${tauxVVisible} XAF/${devise_vente} — Client: ${client} — Fournisseur: ${fournisseurNom} — Bénéfice: ${beneficeVisible.toLocaleString('fr-FR')} XAF`,
       user.id]
    );

    return {
      success: true,
      message: 'Vente initiée — En attente finalisation',
      transaction_id: txId,
      statut: 'pending',
      usdt_consomme: usdtConsomme,
      valeur_vente_visible: valeurVenteVisible,
      montant_paye: montantPaye,
      benefice_visible:     beneficeVisible,
    };
  });
}

// ═════════════════════════════════════════════════════════════
// DÉPENSE
// ═════════════════════════════════════════════════════════════
async function handleDepense(data, user) {
  const { montant, categorie, description } = data;
  if (!montant || !categorie) throw new Error('Montant et catégorie requis');

  const montantF = parseFloat(montant);

  return await dbTransaction(async (conn) => {
    const txId = `TX_${Date.now()}`;

    await conn.query(
      "INSERT INTO transactions (id, user_id, type, montant, categorie, description, statut, date) VALUES (?, ?, 'depense', ?, ?, ?, 'pending', ?)",
      [txId, user.id, montantF, categorie, description || null, new Date()]
    );
    await conn.query(
      'UPDATE comptes SET montant = montant - ? WHERE type_compte = ?',
      [montantF, 'caisse']
    );
    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'depense', ?, ?)",
      [`LOG_${Date.now()}`, `Dépense: ${categorie} — ${montantF} XAF`, user.id]
    );

    return { success: true, message: 'Dépense enregistrée !', transaction_id: txId };
  });
}

// ─────────────────────────────────────────────────────────────
// RETRAIT
// ─────────────────────────────────────────────────────────────
async function handleRetrait(data, user) {
  const { montant, beneficiaire } = data;
  if (!montant || !beneficiaire) throw new Error('Montant et bénéficiaire requis');

  const montantF = parseFloat(montant);
  const dateOp = data.date ? new Date(data.date) : new Date();

  return await dbTransaction(async (conn) => {
    const [caisseRows] = await conn.query(
      'SELECT montant FROM comptes WHERE type_compte = ?', ['caisse']
    );

    if (!caisseRows.length || parseFloat(caisseRows[0].montant) < montantF)
      throw new Error('Solde caisse insuffisant');

    const txId = `TX_${Date.now()}`;

    await conn.query(
      "INSERT INTO transactions (id, user_id, type, montant, beneficiaire, statut, date) VALUES (?, ?, 'retrait', ?, ?, 'pending', ?)",
      [txId, user.id, montantF, beneficiaire, dateOp]
    );
    await conn.query(
      'UPDATE comptes SET montant = montant - ? WHERE type_compte = ?',
      [montantF, 'caisse']
    );
    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'retrait', ?, ?)",
      [`LOG_${Date.now()}`, `Retrait: ${beneficiaire} — ${montantF} XAF`, user.id]
    );

    return { success: true, message: 'Retrait enregistré', transaction_id: txId };
  });
}

// ─────────────────────────────────────────────────────────────
// VERSEMENT
// ─────────────────────────────────────────────────────────────
async function handleVersement(data, user) {
  const { montant } = data;
  if (!montant) throw new Error('Montant requis');

  const montantF = parseFloat(montant);

  return await dbTransaction(async (conn) => {
    const txId = `TX_${Date.now()}`;

    await conn.query(
      "INSERT INTO transactions (id, user_id, type, montant, statut) VALUES (?, ?, 'versement', ?, 'pending')",
      [txId, user.id, montantF]
    );
    await conn.query(
      'UPDATE comptes SET montant = montant + ? WHERE type_compte = ?',
      [montantF, 'caisse']
    );
    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'versement', ?, ?)",
      [`LOG_${Date.now()}`, `Versement caisse: ${montantF} XAF`, user.id]
    );

    return { success: true, message: 'Versement enregistré', transaction_id: txId };
  });
}

// ═════════════════════════════════════════════════════════════
// PAIEMENT CLIENT
// ═════════════════════════════════════════════════════════════
async function handlePaiementClient(data, user) {
  const { id_client, client, montant_paye = 0 } = data;

  if (!id_client && !client) throw badRequest('Client requis (id_client ou client)');

  const montantPaye = parseFloat(montant_paye);
  if (!(montantPaye > 0)) throw badRequest('Montant reçu invalide');

  const txId      = `TX_${Date.now()}`;
  const dateOp    = data.date || new Date();
  let currentOutstanding = null;
  let clientNomFinal = client || null;
  let clientIdFinal = id_client ? parseInt(id_client, 10) : null;

  await dbTransaction(async (conn) => {
    let clientNom    = client || null;
    let clientIdReal = id_client ? parseInt(id_client, 10) : null;

    if (clientIdReal && !clientNom) {
      const [cRows] = await conn.query(
        'SELECT nom, prenom FROM comptes_clients WHERE id = ?', [clientIdReal]
      );
      if (!cRows.length) throw badRequest('Client introuvable');
      clientNom = [cRows[0].nom, cRows[0].prenom].filter(Boolean).join(' ');
    }
    if (!clientIdReal && clientNom) {
      const [cRows] = await conn.query(
        `SELECT id FROM comptes_clients
         WHERE TRIM(CONCAT(nom, IF(prenom IS NOT NULL AND prenom != '', CONCAT(' ', prenom), ''))) = TRIM(?)
         LIMIT 1`,
        [clientNom]
      );
      if (cRows.length) clientIdReal = cRows[0].id;
    }
    if (!clientNom && clientIdReal) {
      const [cRows] = await conn.query(
        'SELECT nom, prenom FROM comptes_clients WHERE id = ?', [clientIdReal]
      );
      if (!cRows.length) throw badRequest('Client introuvable');
      clientNom = [cRows[0].nom, cRows[0].prenom].filter(Boolean).join(' ');
    }
    if (!clientNom) throw badRequest('Client introuvable');

    currentOutstanding = await getClientOutstanding(conn, clientIdReal, clientNom);

    clientNomFinal = clientNom;
    clientIdFinal = clientIdReal;

    await conn.query(`
      INSERT INTO transactions
        (id, user_id, type, client, client_id, montant_a_payer, montant_paye, devise, statut, date)
      VALUES (?, ?, 'paiement_client', ?, ?, ?, ?, 'XAF', 'pending', ?)`,
      [txId, user.id, clientNom, clientIdReal, 0, montantPaye, dateOp]
    );

    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'paiement_client', ?, ?)",
      [`LOG_${Date.now()}`,
       `Paiement client: ${clientNom} — reçu: ${montantPaye.toLocaleString('fr-FR')} XAF, solde après paiement: ${(currentOutstanding.reste - montantPaye).toLocaleString('fr-FR')} XAF`,
       user.id]
    );
  });

  return {
    success: true,
    message: 'Paiement client enregistré',
    transaction_id: txId,
    client_id: clientIdFinal,
    client: clientNomFinal,
    montant_a_payer: currentOutstanding?.reste || 0,
    montant_paye: montantPaye,
    reste: (currentOutstanding?.reste || 0) - montantPaye,
    devise: 'XAF',
  };
}

// ═════════════════════════════════════════════════════════════
// PAIEMENT FOURNISSEUR
// ═════════════════════════════════════════════════════════════
async function handlePaiementFournisseur(data, user) {
  const { id_fournisseur, montant_a_payer, montant_paye = 0, devise = 'XAF', cmup_usdt = null } = data;
  if (!id_fournisseur) throw badRequest('Fournisseur requis');
  if (!['XAF','USDT','xaf','usdt'].includes(devise)) throw badRequest('Devise invalide (XAF ou USDT)');

  const fournisseurId = parseInt(id_fournisseur);
  const montantAPayer = parseFloat(montant_a_payer || 0);
  const montantPaye   = parseFloat(montant_paye);
  const deviseUpper   = devise.toUpperCase();

  if (!(montantPaye > 0)) throw badRequest('Montant payé invalide');
  if (deviseUpper === 'USDT' && !(parseFloat(cmup_usdt) > 0)) {
    throw badRequest('CMUP USDT requis pour un paiement fournisseur en USDT');
  }

  const txId  = `TX_${Date.now()}`;
  const dateOp = data.date || null;
  let currentOutstanding = null;
  let fournisseurNom = '';
  let montantPayeStored = montantPaye;
  let montantAPayerStored = montantAPayer;
  let noteConversion = '';
  let cmup = null;

  await dbTransaction(async (conn) => {
    const [fournRows] = await conn.query('SELECT id, nom, prenom FROM comptes_fournisseurs WHERE id = ?', [fournisseurId]);
    if (!fournRows || fournRows.length === 0) throw badRequest('Fournisseur introuvable');
    fournisseurNom = normalizeFullName(fournRows[0].nom, fournRows[0].prenom);

    if (deviseUpper === 'USDT' && cmup_usdt) {
      cmup = parseFloat(cmup_usdt);
      montantAPayerStored = montantAPayer * cmup;
      montantPayeStored = montantPaye * cmup;
      noteConversion = ` [${montantAPayer} USDT @ CMUP ${cmup}]`;
    }

    currentOutstanding = await getSupplierOutstanding(conn, fournisseurId, fournisseurNom);
    montantAPayerStored = Math.max(0, currentOutstanding.reste || 0);

    await conn.query(
      `INSERT INTO transactions
         (id, user_id, type, id_fournisseur, montant, montant_paye, devise, statut, date, notes)
       VALUES (?, ?, 'paiement_fournisseur', ?, ?, ?, ?, 'pending', ?, ?)`,
      [txId, user.id, fournisseurId, 0, montantPayeStored, deviseUpper, dateOp || new Date(), `Paiement ${deviseUpper}${noteConversion}`]
    );

    await conn.query(
      "INSERT INTO logs (id, date_heure, type_evenement, description, user_id) VALUES (?, NOW(), 'paiement_fournisseur', ?, ?)",
      [`LOG_${Date.now()}`, `Paiement fournisseur ID:${fournisseurId} — payé: ${montantPaye} ${deviseUpper}${noteConversion}, solde après paiement: ${(currentOutstanding.reste - montantPayeStored).toLocaleString('fr-FR')} XAF`, user.id]
    );
  });

  const remainingXaf = (currentOutstanding?.reste || 0) - montantPayeStored;
  const remainingInRequestedDevise = deviseUpper === 'USDT' && cmup
    ? remainingXaf / cmup
    : remainingXaf;

  return {
    success: true,
    message: 'Paiement fournisseur enregistré',
    transaction_id: txId,
    montant_a_payer: currentOutstanding?.reste || montantAPayerStored,
    montant_paye: montantPaye,
    reste: remainingInRequestedDevise,
    reste_xaf: remainingXaf,
    devise: deviseUpper,
    cmup_usdt: cmup ?? (cmup_usdt ? parseFloat(cmup_usdt) : null),
  };
}

export default router;
