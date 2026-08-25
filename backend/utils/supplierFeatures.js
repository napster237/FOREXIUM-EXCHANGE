import { query } from '../config/database.js';

let schemaReadyPromise = null;

const isMissingColumnError = (error) => {
  const message = String(error?.message || '');
  return /Duplicate column name|Nom du champ .*déjà utilisé|Nom du champ .*deja utilise|doesn't exist|Unknown column/i.test(message);
};

export const normalizeSupplierRole = (value) => {
  const role = String(value || '').toLowerCase();
  return role === 'principal' ? 'principal' : 'secondaire';
};

export const ensureSupplierFeatures = async () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await query(`
        CREATE TABLE IF NOT EXISTS transferts_fournisseurs (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(50),
          source_id INT NOT NULL,
          destination_id INT NOT NULL,
          montant_usdt DECIMAL(18,8) NOT NULL,
          montant_xaf DECIMAL(18,2) DEFAULT 0,
          statut ENUM('pending','committed') NOT NULL DEFAULT 'pending',
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          source_nom VARCHAR(255),
          destination_nom VARCHAR(255),
          source_stock_avant DECIMAL(18,8) DEFAULT 0,
          source_stock_apres DECIMAL(18,8) DEFAULT 0,
          destination_stock_avant DECIMAL(18,8) DEFAULT 0,
          destination_stock_apres DECIMAL(18,8) DEFAULT 0,
          INDEX idx_source (source_id),
          INDEX idx_destination (destination_id),
          INDEX idx_date (date DESC)
        ) ENGINE=InnoDB
      `);

      const columnRows = await query(`
        SELECT COUNT(*) AS column_exists
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'comptes_fournisseurs'
          AND COLUMN_NAME = 'type_fournisseur'
      `);

      if (Number(columnRows?.[0]?.column_exists || 0) === 0) {
        try {
          await query(`
            ALTER TABLE comptes_fournisseurs
            ADD COLUMN type_fournisseur ENUM('principal','secondaire')
            NOT NULL DEFAULT 'secondaire'
          `);
        } catch (error) {
          if (!isMissingColumnError(error)) throw error;
        }
      }

      await query(`
        UPDATE comptes_fournisseurs
        SET type_fournisseur = 'secondaire'
        WHERE type_fournisseur IS NULL OR type_fournisseur = ''
      `);

      const transferColumnRows = await query(`
        SELECT COUNT(*) AS column_exists
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transferts_fournisseurs'
          AND COLUMN_NAME = 'montant_xaf'
      `);
      if (Number(transferColumnRows?.[0]?.column_exists || 0) === 0) {
        await query(`ALTER TABLE transferts_fournisseurs ADD COLUMN montant_xaf DECIMAL(18,2) DEFAULT 0`);
      }

      const transferStatusRows = await query(`
        SELECT COUNT(*) AS column_exists
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'transferts_fournisseurs'
          AND COLUMN_NAME = 'statut'
      `);
      if (Number(transferStatusRows?.[0]?.column_exists || 0) === 0) {
        await query(`ALTER TABLE transferts_fournisseurs ADD COLUMN statut ENUM('pending','committed') NOT NULL DEFAULT 'pending'`);
      }

      await query(`
        UPDATE transferts_fournisseurs tf
        JOIN stock s ON s.devise = 'USDT'
        SET tf.montant_xaf = tf.montant_usdt * s.cmup
        WHERE (tf.montant_xaf IS NULL OR tf.montant_xaf = 0) AND s.cmup > 0
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  return schemaReadyPromise;
};

export const getSupplierUsdtBalance = async (conn, supplierId) => {
  const [supplierRows] = await conn.query(
    'SELECT nom, prenom FROM comptes_fournisseurs WHERE id = ?',
    [supplierId]
  );
  const supplierName = String(
    [supplierRows?.[0]?.nom, supplierRows?.[0]?.prenom].filter(Boolean).join(' ')
  ).replace(/\s+/g, ' ').trim();
  const supplierFirstName = String(supplierRows?.[0]?.prenom || '').replace(/\s+/g, ' ').trim();
  const supplierLastName = String(supplierRows?.[0]?.nom || '').replace(/\s+/g, ' ').trim();

  const [rows] = await conn.query(
    `
      SELECT
        COALESCE((
          SELECT SUM(COALESCE(t.quantite, 0))
          FROM transactions t
          WHERE t.type = 'achat'
            AND (
              t.id_fournisseur = ?
              OR (
                t.id_fournisseur IS NULL
                AND (
                  TRIM(t.fournisseur) = TRIM(?)
                  OR TRIM(t.fournisseur) = TRIM(?)
                  OR TRIM(t.fournisseur) = TRIM(?)
                )
              )
            )
            AND t.statut IN ('committed','porteur_pending','assoc_pending','pending')
        ), 0) AS total_achats,
        COALESCE((
          SELECT SUM(COALESCE(t.usdt_consomme, 0))
          FROM transactions t
          WHERE t.type = 'vente'
            AND t.id_fournisseur = ?
            AND t.statut IN ('committed','porteur_pending','assoc_pending','pending')
        ), 0) AS total_ventes,
        COALESCE((
          SELECT SUM(COALESCE(tf.montant_usdt, 0))
          FROM transferts_fournisseurs tf
          WHERE tf.destination_id = ?
        ), 0) AS transferts_entrants,
        COALESCE((
          SELECT SUM(COALESCE(tf.montant_usdt, 0))
          FROM transferts_fournisseurs tf
          WHERE tf.source_id = ?
        ), 0) AS transferts_sortants
    `,
    [supplierId, supplierName, supplierLastName, supplierFirstName, supplierId, supplierId, supplierId]
  );

  const row = rows[0] || {};
  return {
    achats: parseFloat(row.total_achats || 0),
    ventes: parseFloat(row.total_ventes || 0),
    transfertsEntrants: parseFloat(row.transferts_entrants || 0),
    transfertsSortants: parseFloat(row.transferts_sortants || 0),
    stockUsdt:
      parseFloat(row.total_achats || 0)
      + parseFloat(row.transferts_entrants || 0)
      - parseFloat(row.total_ventes || 0)
      - parseFloat(row.transferts_sortants || 0),
  };
};
