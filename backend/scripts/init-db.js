import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

(async () => {
  try {
    console.log('🔄 Initialisation de la base de données FOREXIUM v5.6.0...\n');

    const pool = mysql.createPool({
      host:     process.env.DB_HOST || 'localhost',
      port:     parseInt(process.env.DB_PORT) || 3306,
      user:     process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'forexium',
    });

    const conn = await pool.getConnection();
    console.log('✅ Connecté à MySQL\n');

    // Créer les tables
    const tables = [
      {
        name: 'users',
        sql: `CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(50) PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          role ENUM('porteur', 'associe') NOT NULL,
          name VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP NULL,
          INDEX idx_email (email),
          INDEX idx_role (role)
        ) ENGINE=InnoDB`
      },
      {
        name: 'clients',
        sql: `CREATE TABLE IF NOT EXISTS clients (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          numero VARCHAR(50) UNIQUE NOT NULL,
          adresse TEXT,
          solde DECIMAL(18,2) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_numero (numero),
          INDEX idx_nom (nom)
        ) ENGINE=InnoDB`
      },
      {
        name: 'fournisseurs',
        sql: `CREATE TABLE IF NOT EXISTS fournisseurs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nom VARCHAR(255) NOT NULL,
          numero VARCHAR(50) UNIQUE NOT NULL,
          adresse TEXT,
          type_fournisseur ENUM('principal','secondaire') NOT NULL DEFAULT 'secondaire',
          solde_xaf DECIMAL(18,2) DEFAULT 0,
          solde_usdt DECIMAL(18,8) DEFAULT 0,
          dette_usdt DECIMAL(18,8) DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_numero (numero),
          INDEX idx_nom (nom)
        ) ENGINE=InnoDB`
      },
      {
        name: 'transferts_fournisseurs',
        sql: `CREATE TABLE IF NOT EXISTS transferts_fournisseurs (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(50),
          source_id INT NOT NULL,
          destination_id INT NOT NULL,
          montant_usdt DECIMAL(18,8) NOT NULL,
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
        ) ENGINE=InnoDB`
      },
      {
        name: 'devises',
        sql: `CREATE TABLE IF NOT EXISTS devises (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(10) NOT NULL UNIQUE,
           nom VARCHAR(100),
          taux_conversion DECIMAL(18,8) NOT NULL,
          description TEXT,
          is_default BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_code (code)
        ) ENGINE=InnoDB`
      },
      {
        name: 'stock',
        sql: `CREATE TABLE IF NOT EXISTS stock (
          id INT AUTO_INCREMENT PRIMARY KEY,
          devise VARCHAR(10) UNIQUE NOT NULL DEFAULT 'USDT',
          quantite DECIMAL(18,8) DEFAULT 0,
          cmup DECIMAL(18,8) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_devise (devise)
        ) ENGINE=InnoDB`
      },
      {
        name: 'comptes',
        sql: `CREATE TABLE IF NOT EXISTS comptes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          type_compte ENUM('depot', 'caisse') UNIQUE NOT NULL,
          montant DECIMAL(18,2) DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`
      },
      {
        name: 'transactions',
        sql: `CREATE TABLE IF NOT EXISTS transactions (
          id VARCHAR(100) PRIMARY KEY,
          user_id VARCHAR(50),
          type ENUM('achat', 'vente', 'depense', 'retrait', 'versement') NOT NULL,
          date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          date_enregistrement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          montant DECIMAL(18,2),
          client VARCHAR(255),
          fournisseur VARCHAR(255),
          beneficiaire VARCHAR(255),
          devise VARCHAR(10),
          quantite DECIMAL(18,8),
          taux_achat_unitaire DECIMAL(18,8),
          devise_vente VARCHAR(10),
          taux_conversion DECIMAL(18,8),
          taux_vente_visible DECIMAL(18,2),
          taux_vente_cache DECIMAL(18,2),
          benefice_visible DECIMAL(18,2),
          benefice_cache DECIMAL(18,2),
          statut ENUM('pending', 'porteur_pending', 'assoc_pending', 'committed') DEFAULT 'pending',
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_user_id (user_id),
          INDEX idx_type (type),
          INDEX idx_date (date DESC),
          INDEX idx_statut (statut)
        ) ENGINE=InnoDB`
      },
      {
        name: 'distribution',
        sql: `CREATE TABLE IF NOT EXISTS distribution (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role ENUM('porteur', 'associe') UNIQUE NOT NULL,
          pourcentage_defaut DECIMAL(5,2) DEFAULT 70.00,
          total_accumule_visible DECIMAL(18,2) DEFAULT 0,
          total_accumule_cache DECIMAL(18,2) DEFAULT 0
        ) ENGINE=InnoDB`
      },
      {
        name: 'logs',
        sql: `CREATE TABLE IF NOT EXISTS logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id VARCHAR(50),
          type_evenement VARCHAR(50),
          description TEXT,
          date_heure TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          metadata JSON,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
          INDEX idx_date (date_heure DESC),
          INDEX idx_type (type_evenement)
        ) ENGINE=InnoDB`
      }
    ];

    console.log('📋 Création des tables...\n');
    for (const table of tables) {
      try {
        await conn.query(table.sql);
        console.log(`  ✓ ${table.name}`);
      } catch (e) {
        console.log(`  ✓ ${table.name} (déjà existante)`);
      }
    }

    console.log('\n✅ Schéma créé\n');

    // Insertion des données par défaut
    console.log('📝 Insertion des données par défaut...\n');

    try {
      await conn.query('INSERT IGNORE INTO devises (code, nom, taux_conversion, is_default) VALUES (?, ?, ?, ?)', ['RMB', 'Yuan Chinois', 0.15, true]);
      await conn.query('INSERT IGNORE INTO devises (code, nom, taux_conversion, is_default) VALUES (?, ?, ?, ?)', ['USD', 'Dollar Américain', 1.00, true]);
      console.log('  ✓ Devises');
    } catch (e) {
      console.log('  ✓ Devises (déjà existantes)');
    }

    try {
      await conn.query('INSERT IGNORE INTO stock (devise, quantite, cmup) VALUES (?, ?, ?)', ['USDT', 0, 0]);
      console.log('  ✓ Stock USDT');
    } catch (e) {
      console.log('  ✓ Stock USDT (déjà existant)');
    }

    try {
      await conn.query('INSERT IGNORE INTO comptes (type_compte, montant) VALUES (?, ?)', ['depot', 1000000]);
      await conn.query('INSERT IGNORE INTO comptes (type_compte, montant) VALUES (?, ?)', ['caisse', 500000]);
      console.log('  ✓ Comptes (Dépôt: 1M, Caisse: 500k)');
    } catch (e) {
      console.log('  ✓ Comptes (déjà existants)');
    }

    // Utilisateurs de test
    console.log('\n📝 Création des utilisateurs...\n');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      ['user-1', 'porteur@forexium.com', hashedPassword, 'porteur', 'Porteur Affaire'],
      ['user-2', 'associe@forexium.com', hashedPassword, 'associe', 'Associé Commerce'],
    ];

    for (const [id, email, password, role, name] of users) {
      try {
        await conn.query(
          'INSERT INTO users (id, email, password, role, name) VALUES (?, ?, ?, ?, ?)',
          [id, email, password, role, name]
        );
        console.log(`  ✓ ${email} (${role})`);
      } catch (e) {
        console.log(`  ✓ ${email} (déjà existant)`);
      }
    }

    // Répartition des profits
    try {
      await conn.query('INSERT IGNORE INTO repartition_profits (role, pourcentage_defaut) VALUES (?, ?)', ['porteur', 70]);
      await conn.query('INSERT IGNORE INTO repartition_profits (role, pourcentage_defaut) VALUES (?, ?)', ['associe', 30]);
      console.log('  ✓ Répartition des profits');
    } catch (e) {
      console.log('  ✓ Répartition (déjà existante)');
    }

    console.log('\n✅ BASE DE DONNÉES INITIALISÉE AVEC SUCCÈS!\n');
    console.log('📋 Identifiants pour tester:');
    console.log('   Porteur  : porteur@forexium.com / password123');
    console.log('   Associé  : associe@forexium.com / password123\n');

    conn.release();
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
})();
