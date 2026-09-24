import React, { useState, useEffect, useCallback } from 'react';
import {
  apiLogin, apiLogout, apiLoadAll,
  apiCreateTransaction, apiFinaliserVente, apiEditTransaction, apiDeleteTransaction,
  apiUpdateCmup, apiUpdateProfitShare, apiRegister, apiCheckSlots,
  apiValiderAssoc, apiValiderTransaction,
  // v5.6.0+ nouveaux endpoints
  apiGetClients, apiCreateClient, apiUpdateClient, apiDeleteClient, apiGetClientExtrait, apiPayClient,
  apiGetFournisseurs, apiCreateFournisseur, apiUpdateFournisseur, apiDeleteFournisseur, apiFournisseurPayment, apiGetFournisseurExtrait, apiGetFournisseurTransferts, apiGetTransfertsFournisseurs, apiTransferFournisseur, apiPayFournisseur,
  apiGetDevises, apiCreateDevise, apiUpdateDevise, apiDeleteDevise,
  apiGetDistributionDetails, apiToggleDistribution,
} from './api.js';
import {
  DollarSign, TrendingUp, Users, LogOut, Plus, ArrowUpRight, ArrowDownLeft,
  Download, Settings, FileText, BarChart3, X, Moon, Sun, Globe,
  ShieldCheck, AlertCircle, RefreshCw, Warehouse, Banknote, Clock,
  CheckCircle2, XCircle, AlertTriangle, Filter, Edit2, Info, Lock,
  TrendingDown, Activity, ChevronDown, ChevronUp, Search, Package,
  ArrowRight, ChevronsUpDown, Layers, PenLine, Shield, Zap,
  Store, Trash2, CreditCard, LayoutDashboard, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { fr as dateFr, enUS } from 'date-fns/locale';
import jsPDF from 'jspdf';
import qrcode from 'qrcode-generator';
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

// ─────────────────────────────────────────────────────────────
// UTILITAIRES — Séparateurs de milliers
// ─────────────────────────────────────────────────────────────
// Formate un nombre entier avec espaces : 1000000 → "1 000 000"
const fmtThousands = (v) => {
  const s = String(v).replace(/\s/g, '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
};
// Parse un champ formaté vers float : "1 000 500,5" → 1000500.5
const parseThousands = (v) => parseFloat(String(v).replace(/[\s\u00A0]/g, '').replace(',', '.')) || 0;
// Handler onChange pour champs entiers XAF (montants, taux entiers)
const handleIntInput = (setter) => (e) => {
  const raw = e.target.value.replace(/[\s\u00A0]/g, '').replace(/[^0-9]/g, '');
  setter(raw === '' ? '' : fmtThousands(raw));
};
// Handler onChange pour champs décimaux (quantité USDT, taux avec virgule)
const handleDecInput = (setter) => (e) => {
  const raw = e.target.value.replace(/[\s\u00A0]/g, '').replace(/[^0-9.]/g, '');
  setter(raw);
};
const TRANSLATIONS = {
  fr: {
    appSubtitle: 'Plateforme Professionnelle de Change',
    login: 'Se connecter', email: 'Adresse email', password: 'Mot de passe',
    logout: 'Déconnexion', newTransaction: 'Nouvelle Transaction',
    transactions: 'Transactions', quickActions: 'Actions Rapides',
    profitShare: 'Répartition des Profits', settings: 'Paramètres',
    save: 'Enregistrer', cancel: 'Annuler',
    all: 'Tous', sale: 'Vente', purchase: 'Achat', expense: 'Dépense', withdrawal: 'Retrait',
    sellCurrency: 'Vendre une devise', buyCurrency: 'Acheter une devise',
    recordExpense: 'Enregistrer dépense', makeWithdrawal: 'Effectuer un retrait',
    cashClient: 'Encaisser un client', stockSupply: 'Approvisionner le stock',
    operationalCosts: "Frais d'exploitation", partnerWithdrawal: 'Retrait caisse',
    depot: 'Dépôt', caisse: 'Caisse',
    myShare: 'Ma Part', currencyStock: 'Stock de Devises',
    updatedRealTime: 'Mis à jour en temps réel', noTransactions: 'Aucune transaction trouvée',
    connectedAs: 'Connecté en tant que', partner: "Porteur d'affaire", associate: 'Associé',
    currency: 'Devise', quantity: 'Quantité',
    purchaseRate: "Taux d'achat calculé (XAF/USDT)", client: 'Client *', supplier: 'Fournisseur',
    clientPlaceholder: 'Nom du client (obligatoire)',
    amount: 'Montant (XAF)', category: 'Catégorie', description: 'Description',
    beneficiary: 'Bénéficiaire', reason: 'Motif (optionnel)',
    autoCalc: 'Calculs automatiques', clientAmount: 'Montant client :',
    cost: 'Coût :', profit: 'Bénéfice :', distribution: 'Répartition :',
    totalProfit: 'Profit total', totalTransactions: 'Transactions', totalRecorded: 'Total enregistrées',
    invoicePDF: 'Reçu PDF',
    noteSettings: "S'applique aux nouvelles transactions uniquement.",
    loginNote: 'Email "porteur@..." → Porteur  |  Autre email → Associé',
    insufficientStock: 'Stock insuffisant !',
    insufficientCaisse: 'Solde caisse insuffisant !',
    allFieldsRequired: 'Champs obligatoires manquants',
    saleSuccess: 'Vente initiée — En attente finalisation', purchaseSuccess: 'Achat enregistré !',
    expenseSuccess: 'Dépense enregistrée !', withdrawalSuccess: 'Retrait enregistré !',
    settingsUpdated: 'Paramètres mis à jour !', logoutSuccess: 'Déconnexion réussie', welcome: 'Bienvenue',
    filterByDate: 'Par date', searchByType: 'Par type',
    journalLog: 'Journal des activités', journalEmpty: 'Aucune activité enregistrée',
    sourceAccount: "Source de l'achat", useCaisse: 'Payer depuis la Caisse',
    restock: 'Alimenter la Caisse', restockDesc: 'Transférer du Dépôt vers la Caisse',
    restockAmount: 'Montant à transférer', transferSuccess: 'Transfert effectué !',
    clientRequired: 'Le nom du client est obligatoire',
    supplierRequired: 'Le fournisseur est obligatoire',
    globalShare: 'Répartition globale (par défaut)',
    customShare: 'Personnaliser pour cette vente',
    generalSituation: 'Situation générale',
    clientSituation: 'Situation clients',
    supplierSituation: 'Situation fournisseurs',
    responsibilityByUser: 'Responsabilité par utilisateur',
    clientsReceivable: 'Créances clients',
    clientsCredit: 'Crédit clients',
    suppliersPayable: 'Dettes fournisseurs',
    suppliersCredit: 'Crédit fournisseurs',
    netBalance: 'Solde net',
    responsible: 'Responsable',
    part: 'Part',
    depotDesc: 'Fonds propres (dépôt)', caisseDesc: 'Fonds opérationnels',
    loginFailed: 'Email ou mot de passe incorrect',
    sessionDuration: 'Durée de session',
    logTypes: {
      connexion: 'Connexion', deconnexion: 'Déconnexion', vente: 'Vente',
      achat: 'Achat', depense: 'Dépense', retrait: 'Retrait',
      restock: 'Alimentation caisse', settings: 'Paramètres', error: 'Erreur',
      connexion_echouee: 'Tentative échouée', finalisation: 'Finalisation', edition: 'Édition',
      pdf: 'Reçu PDF', filtre: 'Filtrage', cmup: 'Ajust. CMUP'
    },
    deviseVente: 'Devise de vente', tauxConversion: 'Taux de conversion',
    tauxConversionHint: 'Combien d\'unités pour 1 USDT ?',
    tauxAchatCalc: 'Taux d\'achat XAF (CMUP ÷ conversion)',
    tauxVenteVisible: 'Taux de vente (XAF)',
    tauxVenteCache: 'Taux de vente CACHÉ (XAF)', afficherCachee: 'Voir données cachées 🔒', masquerCachee: 'Masquer',
    valeurAchatXAF: 'Valeur d\'achat (XAF)', valeurVenteVisible: 'Valeur vente (XAF)',
    valeurVenteCachee: 'Valeur CACHÉE (XAF)', beneficeVisible: 'Bénéfice',
    beneficeCachee: 'Bénéfice CACHÉ', stockUsdtConsomme: 'USDT consommé',
    stockUsdtRestant: 'USDT restant', repartitionVisible: 'Répartition',
    repartitionCachee: 'Répartition CACHÉE', incorrectPassword: 'Mot de passe incorrect',
    passwordPromptTitle: 'Données cachées', passwordLabel: 'Mot de passe',
    customShareCache: 'Personnaliser répartition cachée',
    manageCurrencies: 'Devises', addCurrency: 'Ajouter', currencyCode: 'Code',
    currencyName: 'Nom complet', currencySymbol: 'Symbole', currencyAdded: 'Devise ajoutée !',
    currencyDeleted: 'Devise supprimée !', defaultCurrencies: 'Devises par défaut',
    customCurrencies: 'Devises ajoutées', restockTip: 'Versement ajouté à la Caisse',
    currentCaisse: 'Caisse actuelle', obligatoire: 'obligatoire',
    paymentClient: 'Paiement Client',
    paymentSupplier: 'Paiement Fournisseur',
    manageClients: 'Gestion des Clients',
    manageSuppliers: 'Gestion des Fournisseurs',
    newClient: 'Nouveau client',
    newSupplier: 'Nouveau fournisseur',
    supplierType: 'Type',
    principalSupplier: 'Principal',
    secondarySupplier: 'Secondaire',
    transferSupplier: 'Transfert USDT',
    sourceSupplier: 'Fournisseur source',
    destinationSupplier: 'Fournisseur destination',
    transferAmountLabel: 'Montant USDT',
    transferHistory: 'Historique des transferts',
    transferOperation: 'Transfert fournisseur',
    transferDateTrace: 'Transfert effectue le',
    showAllTransfers: 'Voir tous les transferts',
    showLessTransfers: 'Reduire la liste',
    createClient: 'Créer un client',
    createSupplier: 'Créer un fournisseur',
    create: 'Créer',
    clientCodeHint: 'Code généré automatiquement (CLT-001, CLT-002…)',
    supplierCodeHint: 'Code généré automatiquement (FRN-001, FRN-002…)',
    noClientRegistered: 'Aucun client enregistré',
    noSupplierRegistered: 'Aucun fournisseur enregistré',
    name: 'Nom',
    firstName: 'Prénom',
    phone: 'Téléphone',
    city: 'Ville',
    addressDistrict: 'Adresse / Quartier',
    fullName: 'Nom & Prénom',
    addressCity: 'Adresse / Ville',
    salesValue: 'Valeur ventes',
    amountToPay: 'Montant à payer',
    amountPaidTitle: 'Montant payé',
    actions: 'Actions',
    pay: 'Payer',
    recordPayment: 'Enregistrer un paiement',
    statement: 'Extrait de compte',
    delete: 'Supprimer',
    edit: 'Modifier',
    clientStatementTitle: 'Client · Extrait de compte complet',
    supplierStatementTitle: 'Fournisseur · Extrait de compte complet',
    totalSalesCard: 'TOTAL VENTES',
    totalReceivedCard: 'MONTANT REÇU',
    totalDueCard: 'TOTAL À PAYER',
    totalPaidCard: 'TOTAL PAYÉ',
    purchasesCard: 'ACHATS',
    linkedSalesCard: 'VENTES LIÉES',
    paymentsCard: 'PAIEMENTS',
    paidPrefix: 'Payé',
    remainingPrefix: 'Reste',
    pendingStatus: 'En attente',
    settledAccount: 'Compte soldé',
    noAllocationAvailable: 'Aucune répartition disponible',
    noTransactionRecorded: 'Aucune transaction enregistrée',
    usersCountSuffix: 'utilisateur(s)',
    ownerShort: 'Porteur',
    associateShort: 'Associé',
    nameRequired: 'Nom requis',
    clientCreatedSuccess: 'Client créé ✓',
    supplierCreatedSuccess: 'Fournisseur créé ✓',
    clientUpdatedSuccess: 'Client modifié ✓',
    supplierUpdatedSuccess: 'Fournisseur modifié ✓',
    deleteClientConfirm: 'Supprimer ce client ?',
    deleteSupplierConfirm: 'Supprimer ce fournisseur ?',
    deletedSuccess: 'Supprimé',
    statementUnavailable: 'Extrait indisponible',
    salesCountLabel: 'vente(s)',
    paymentsCountLabel: 'paiement(s)',
    purchasesCountLabel: 'achat(s)',
    operationsCountLabel: 'op(s)',
    purchaseSaleLabel: '(achat+vente+paiement)',
    dueShort: 'DÛ',
    receivedShort: 'REÇU',
    paidShort: 'PAYÉ',
    dateLabel: 'DATE',
    typeLabel: 'TYPE',
    numberPlaceholder: 'Numéro',
    digitsLabel: 'chiffre(s)',
    downloadPdf: 'Télécharger PDF',
    newPayment: 'Nouveau paiement',
    recordedOn: 'Enregistré le',
    updatedOn: 'Modifié le',
    currentLabel: 'Actuel',
    newStockValue: 'Nouvelle valeur stock',
    topLogout: 'Quitter',
    operationDate: "Date de l'opération",
    operationDateHint: "(peut différer de la date d'enregistrement)",
    currentBalances: 'Soldes actuels',
    amountToCreditCash: 'Montant à créditer dans la Caisse (XAF)',
    cashAfterDeposit: 'Caisse après versement',
    usdtStockTitle: 'Stock USDT',
    totalStockValue: 'Valeur totale stock',
    linkedRates: "Taux — modifier l'un recalcule l'autre",
    autoCalculated: 'Auto-calculé',
    selectClient: '— Sélectionner un client —',
    selectSupplier: '— Sélectionner un fournisseur —',
    chooseSupplier: '— Choisir le fournisseur —',
    viaSupplier: 'Via fournisseur',
    paymentReceived: 'Paiement reçu',
    saleAmountLabel: 'Montant de la vente :',
    amountReceivedOptional: 'Montant reçu du client (XAF) — laisser vide si non payé',
    statusPaid: '✅ Payé',
    statusPartial: '⚡ Partiel',
    statusOverpaid: '⭐ Surplus',
    statusUnpaid: '⏳ Non payé',
    remainingToCollect: 'Reste à recouvrer :',
    surplusCredit: 'Surplus (crédit) :',
    transactionSettled: 'Transaction soldée ✅',
    stockAfterSale: 'Stock après vente',
    referenceCalculation: 'Calcul de référence',
    referenceRate: 'Taux réf.',
    referenceProfit: 'Bénéfice réf.',
    collapse: 'réduire',
    splitShort: 'Répartition',
    customizeLower: 'personnaliser',
    purchaseRateXaf: "Taux d'achat (XAF)",
    totalXafAuto: 'Montant total XAF (auto-calculé)',
    totalCost: 'Coût total',
    debitFromCash: 'Prélever depuis la Caisse',
    availableCash: 'Caisse disponible :',
    totalSalesLabel: 'TOTAL VENTES',
    alreadyReceived: 'DÉJÀ REÇU',
    balanceDue: 'RESTE DÛ',
    amountReceivedClient: 'Montant reçu du client (XAF)',
    afterPayment: 'Après ce paiement :',
    exceedsBalanceDue: 'Dépasse le reste dû',
    settled: '✓ Soldé',
    amountDue: 'MONTANT DÛ',
    alreadyPaid: 'DÉJÀ PAYÉ',
    balanceLabel: 'RESTE',
    remainingShort: 'Reste',
    amountPaidSupplier: 'Montant payé (XAF)',
    accountSettled: 'Compte déjà soldé',
    amountRequired: 'Montant requis',
    purchasedCurrency: 'Devise achetée',
    currentCmup: 'CMUP actuel',
    newStock: 'Nouveau stock',
    saleRecordedAfterSubmit: 'Cette vente sera enregistrée immédiatement après soumission.',
    profitShareInSale: 'Répartition pour cette vente',
    pending: 'En attente', committed: 'Finalisé',
    finaliserVente: 'Finaliser la vente', finaliserDesc: 'Ajouter les données cachées',
    finaliserSuccess: 'Vente finalisée avec données cachées !',
    prixAchatTotal: 'Prix d\'achat total (XAF)',
    tauxUnitaireCalc: 'Taux unitaire calculé',
    nouveauCMUP: 'Nouveau CMUP après achat',
    stockCourant: 'Stock courant',
    soldeDisponible: 'Solde disponible',
    modifierTx: 'Modifier', editSuccess: 'Transaction modifiée !',
    stockNegatif: 'Modification bloquée — stock USDT négatif détecté le',
    depuisCaisse: 'Depuis la Caisse',
    infoAchat: 'Informations stock', infoCaisse: 'Informations caisse',
    prixAchatHint: 'Montant total payé au fournisseur',
    // ── Mouvement de Stock USDT ──
    stockMovement: 'Mouvements de Stock USDT',
    stockMovementDesc: 'Historique détaillé des entrées/sorties USDT',
    entree: 'Entrée', sortie: 'Sortie',
    stockAvant: 'Stock avant', stockApres: 'Stock après',
    variation: 'Variation', libelle: 'Libellé',
    typeOp: 'Type', refOp: 'Référence',
    noMovements: 'Aucun mouvement de stock enregistré',
    exportCSV: 'Exporter CSV',
    soldeActuel: 'Solde actuel',
    totalEntrees: 'Total entrées', totalSorties: 'Total sorties',
    cmupActuel: 'CMUP actuel', valeurStock: 'Valeur du stock',
    supplierStockBreakdown: 'Répartition du stock par fournisseur',
    supplierStockAvailable: 'Disponible',
    supplierStockDebt: 'Dette stock',
    supplierStockBefore: 'Stock fournisseur avant',
    supplierStockAfter: 'Stock fournisseur après',
    noSupplierStock: 'Aucun stock fournisseur',
    sourceAchat: 'Source financement', clientVente: 'Client',
    deviseSortie: 'Devise sortie', qteDevise: 'Qté devise',
    tauxConvUsdt: 'Taux conv. USDT', tauxAchatXaf: 'Taux achat XAF',
    tauxVenteXaf: 'Taux vente XAF', valAchatXaf: 'Valeur achat XAF',
    valVenteXaf: 'Valeur vente XAF', beneficeOp: 'Bénéfice',
    fournisseurAchat: 'Fournisseur', newCmup: 'Nouveau CMUP',
    searchMovement: 'Rechercher...', filterAll: 'Tous',
    evolutionStock: 'Évolution du stock',
    editCmup: 'Modifier le CMUP manuellement',
    cmupManuel: 'Nouveau CMUP (XAF/USDT)',
    cmupUpdated: 'CMUP mis à jour avec succès !',
    cmupWarning: 'Attention : modifier le CMUP manuellement affecte tous les calculs futurs.',
    confirmCmup: 'Confirmer la modification',
    cmupHistory: 'Historique CMUP',
    passwordRequired: 'Mot de passe requis pour modifier le CMUP',
    cmupLog: 'Ajustement CMUP',
    inputCmup: 'Saisir le CMUP',
    addCurrencyButton: 'Ajouter devise',
    newCurrency: 'Nouvelle devise',
    codeExample: 'Code * (ex: EUR)',
    currencyRateFormula: 'Taux (1 USDT = ? devise) *',
    optional: 'Optionnel',
    noCurrency: 'Aucune devise',
    defaultLabel: 'DÉFAUT',
    deleteCurrencyConfirm: 'Supprimer cette devise ?',
    deletedCurrencySuccess: 'Supprimée',
    currencyCreatedSuccess: 'Devise créée',
    currencyUpdatedSuccess: 'Devise modifiée ✓',
    codeAndRateRequired: 'Code et taux requis',
    rateRequired: 'Taux requis',
    currencyNamePlaceholder: 'Nom de la devise',
    stockMovementRecordedCount: 'opération(s) enregistrée(s)',
    stockSearchPlaceholder: 'Réf., client, fournisseur…',
    clearFilters: 'Effacer',
    noMovementFound: 'Aucun mouvement trouvé',
    filterIncoming: '↑ Entrées',
    filterOutgoing: '↓ Sorties',
    recordedShortLabel: 'Enreg.',
    editedShortLabel: 'Modifié',
    operationLabel: 'Opération',
    referenceLabel: 'Référence',
    recordedDateLabel: 'Date enreg.',
    modifiedDateLabel: 'Date modif.',
    userLabel: 'Utilisateur',
    statusLabel: 'Statut',
    fundingSupplyLabel: 'Approvisionnement',
    saleMovementLabel: 'Vente',
    marketEvolution: 'Évolution du Marché',
    marketDailyVariation: 'Variations ventes & bénéfices par jour',
    profitXafLabel: 'Bénéfice XAF',
    purchasesXafLabel: 'Achats XAF',
    salesXafLabel: 'Ventes XAF',
    periodPurchases: 'Achats période',
    periodProfit: 'Profit période',
    operationsCountFull: 'Nb opérations',
  },
  en: {
    appSubtitle: 'Professional Exchange Platform',
    login: 'Sign in', email: 'Email address', password: 'Password',
    logout: 'Logout', newTransaction: 'New Transaction',
    transactions: 'Transactions', quickActions: 'Quick Actions',
    profitShare: 'Profit Distribution', settings: 'Settings',
    save: 'Save', cancel: 'Cancel',
    all: 'All', sale: 'Sale', purchase: 'Purchase', expense: 'Expense', withdrawal: 'Withdrawal',
    sellCurrency: 'Sell Currency', buyCurrency: 'Buy Currency',
    recordExpense: 'Record Expense', makeWithdrawal: 'Make Withdrawal',
    cashClient: 'Cash a client', stockSupply: 'Supply stock',
    operationalCosts: 'Operational costs', partnerWithdrawal: 'Cash withdrawal',
    depot: 'Deposit', caisse: 'Cash Register',
    myShare: 'My Share', currencyStock: 'Currency Stock',
    updatedRealTime: 'Updated in real time', noTransactions: 'No transactions found',
    connectedAs: 'Connected as', partner: 'Business Owner', associate: 'Associate',
    currency: 'Currency', quantity: 'Quantity',
    purchaseRate: 'Calculated rate (XAF/USDT)', client: 'Client *', supplier: 'Supplier',
    clientPlaceholder: 'Client name (required)',
    amount: 'Amount (XAF)', category: 'Category', description: 'Description',
    beneficiary: 'Beneficiary', reason: 'Reason (optional)',
    autoCalc: 'Automatic calculations', clientAmount: 'Client amount:',
    cost: 'Cost:', profit: 'Profit:', distribution: 'Distribution:',
    totalProfit: 'Total Profit', totalTransactions: 'Transactions', totalRecorded: 'Total recorded',
    invoicePDF: 'PDF Receipt',
    noteSettings: 'Applies to new transactions only.',
    loginNote: 'Email "porteur@..." → Business Owner  |  Other → Associate',
    insufficientStock: 'Insufficient stock!',
    insufficientCaisse: 'Insufficient cash register balance!',
    allFieldsRequired: 'Required fields missing',
    saleSuccess: 'Sale initiated — Pending finalization', purchaseSuccess: 'Purchase recorded!',
    expenseSuccess: 'Expense recorded!', withdrawalSuccess: 'Withdrawal recorded!',
    settingsUpdated: 'Settings updated!', logoutSuccess: 'Logged out successfully', welcome: 'Welcome',
    filterByDate: 'By date', searchByType: 'By type',
    journalLog: 'Activity Log', journalEmpty: 'No activity recorded',
    sourceAccount: 'Purchase source', useCaisse: 'Pay from Cash Register',
    restock: 'Fund Cash Register', restockDesc: 'Transfer from Deposit to Cash Register',
    restockAmount: 'Amount to transfer', transferSuccess: 'Transfer completed!',
    clientRequired: 'Client name is required',
    supplierRequired: 'Supplier is required',
    globalShare: 'Global split (default)',
    customShare: 'Customize for this sale',
    generalSituation: 'Overall situation',
    clientSituation: 'Client situation',
    supplierSituation: 'Supplier situation',
    responsibilityByUser: 'Responsibility by user',
    clientsReceivable: 'Client receivables',
    clientsCredit: 'Client credit',
    suppliersPayable: 'Supplier payables',
    suppliersCredit: 'Supplier credit',
    netBalance: 'Net balance',
    responsible: 'Responsible',
    part: 'Share',
    depotDesc: 'Own funds (deposit)', caisseDesc: 'Operational funds',
    loginFailed: 'Incorrect email or password',
    sessionDuration: 'Session duration',
    logTypes: {
      connexion: 'Login', deconnexion: 'Logout', vente: 'Sale',
      achat: 'Purchase', depense: 'Expense', retrait: 'Withdrawal',
      restock: 'Cash funding', settings: 'Settings', error: 'Error',
      connexion_echouee: 'Failed attempt', finalisation: 'Finalization', edition: 'Edit',
      pdf: 'PDF Receipt', filtre: 'Filter', cmup: 'CMUP Adjust.'
    },
    deviseVente: 'Sale currency', tauxConversion: 'Conversion rate',
    tauxConversionHint: 'How many units = 1 USDT?',
    tauxAchatCalc: 'Purchase rate XAF (CMUP ÷ conversion)',
    tauxVenteVisible: 'Sale rate (XAF)',
    tauxVenteCache: 'HIDDEN sale rate (XAF)', afficherCachee: 'View hidden data 🔒', masquerCachee: 'Hide',
    valeurAchatXAF: 'Purchase value (XAF)', valeurVenteVisible: 'Sale value (XAF)',
    valeurVenteCachee: 'HIDDEN value (XAF)', beneficeVisible: 'Profit',
    beneficeCachee: 'HIDDEN profit', stockUsdtConsomme: 'USDT consumed',
    stockUsdtRestant: 'Remaining USDT', repartitionVisible: 'Distribution',
    repartitionCachee: 'HIDDEN distribution', incorrectPassword: 'Incorrect password',
    passwordPromptTitle: 'Hidden data access', passwordLabel: 'Password',
    customShareCache: 'Customize hidden distribution',
    manageCurrencies: 'Currencies', addCurrency: 'Add', currencyCode: 'Code',
    currencyName: 'Full name', currencySymbol: 'Symbol', currencyAdded: 'Currency added!',
    currencyDeleted: 'Currency deleted!', defaultCurrencies: 'Default currencies',
    customCurrencies: 'Added currencies', restockTip: 'Amount added to Cash Register',
    currentCaisse: 'Current Cash Register', obligatoire: 'required',
    paymentClient: 'Client Payment',
    paymentSupplier: 'Supplier Payment',
    manageClients: 'Client Management',
    manageSuppliers: 'Supplier Management',
    newClient: 'New client',
    newSupplier: 'New supplier',
    supplierType: 'Type',
    principalSupplier: 'Principal',
    secondarySupplier: 'Secondary',
    transferSupplier: 'USDT Transfer',
    sourceSupplier: 'Source supplier',
    destinationSupplier: 'Destination supplier',
    transferAmountLabel: 'USDT amount',
    transferHistory: 'Transfer history',
    transferOperation: 'Supplier transfer',
    transferDateTrace: 'Transfer made on',
    showAllTransfers: 'Show all transfers',
    showLessTransfers: 'Show less',
    createClient: 'Create client',
    createSupplier: 'Create supplier',
    create: 'Create',
    clientCodeHint: 'Code generated automatically (CLT-001, CLT-002...)',
    supplierCodeHint: 'Code generated automatically (FRN-001, FRN-002...)',
    noClientRegistered: 'No clients recorded',
    noSupplierRegistered: 'No suppliers recorded',
    name: 'Name',
    firstName: 'First name',
    phone: 'Phone',
    city: 'City',
    addressDistrict: 'Address / District',
    fullName: 'Full Name',
    addressCity: 'Address / City',
    salesValue: 'Sales Value',
    amountToPay: 'Amount Due',
    amountPaidTitle: 'Amount Paid',
    actions: 'Actions',
    pay: 'Pay',
    recordPayment: 'Record payment',
    statement: 'Account statement',
    delete: 'Delete',
    edit: 'Edit',
    clientStatementTitle: 'Client · Full account statement',
    supplierStatementTitle: 'Supplier · Full account statement',
    totalSalesCard: 'TOTAL SALES',
    totalReceivedCard: 'AMOUNT RECEIVED',
    totalDueCard: 'TOTAL DUE',
    totalPaidCard: 'TOTAL PAID',
    purchasesCard: 'PURCHASES',
    linkedSalesCard: 'LINKED SALES',
    paymentsCard: 'PAYMENTS',
    paidPrefix: 'Paid',
    remainingPrefix: 'Balance',
    pendingStatus: 'Pending',
    settledAccount: 'Account settled',
    noAllocationAvailable: 'No allocation available',
    noTransactionRecorded: 'No transactions recorded',
    usersCountSuffix: 'user(s)',
    ownerShort: 'Owner',
    associateShort: 'Associate',
    nameRequired: 'Name required',
    clientCreatedSuccess: 'Client created ✓',
    supplierCreatedSuccess: 'Supplier created ✓',
    clientUpdatedSuccess: 'Client updated ✓',
    supplierUpdatedSuccess: 'Supplier updated ✓',
    deleteClientConfirm: 'Delete this client?',
    deleteSupplierConfirm: 'Delete this supplier?',
    deletedSuccess: 'Deleted',
    statementUnavailable: 'Statement unavailable',
    salesCountLabel: 'sale(s)',
    paymentsCountLabel: 'payment(s)',
    purchasesCountLabel: 'purchase(s)',
    operationsCountLabel: 'op(s)',
    purchaseSaleLabel: '(purchase+sale+payment)',
    dueShort: 'DUE',
    receivedShort: 'RECEIVED',
    paidShort: 'PAID',
    dateLabel: 'DATE',
    typeLabel: 'TYPE',
    numberPlaceholder: 'Number',
    digitsLabel: 'digit(s)',
    downloadPdf: 'Download PDF',
    newPayment: 'New payment',
    recordedOn: 'Recorded on',
    updatedOn: 'Updated on',
    currentLabel: 'Current',
    newStockValue: 'New stock value',
    topLogout: 'Logout',
    operationDate: 'Operation date',
    operationDateHint: '(may differ from registration date)',
    currentBalances: 'Current balances',
    amountToCreditCash: 'Amount to credit to Cash Register (XAF)',
    cashAfterDeposit: 'Cash after deposit',
    usdtStockTitle: 'USDT Stock',
    totalStockValue: 'Total stock value',
    linkedRates: 'Rates — editing one recalculates the other',
    autoCalculated: 'Auto-calculated',
    selectClient: '— Select a client —',
    selectSupplier: '— Select a supplier —',
    chooseSupplier: '— Choose supplier —',
    viaSupplier: 'Via supplier',
    paymentReceived: 'Payment received',
    saleAmountLabel: 'Sale amount:',
    amountReceivedOptional: 'Amount received (XAF) — leave empty if unpaid',
    statusPaid: '✅ Paid',
    statusPartial: '⚡ Partial',
    statusOverpaid: '⭐ Surplus',
    statusUnpaid: '⏳ Unpaid',
    remainingToCollect: 'Remaining:',
    surplusCredit: 'Surplus (credit):',
    transactionSettled: 'Fully paid ✅',
    stockAfterSale: 'Stock after sale',
    referenceCalculation: 'Reference calculation',
    referenceRate: 'Ref. rate',
    referenceProfit: 'Ref. profit',
    collapse: 'collapse',
    splitShort: 'Split',
    customizeLower: 'customize',
    purchaseRateXaf: 'Purchase Rate (XAF)',
    totalXafAuto: 'Total XAF amount (auto-calculated)',
    totalCost: 'Total cost',
    debitFromCash: 'Debit from Cash Register',
    availableCash: 'Available:',
    totalSalesLabel: 'TOTAL SALES',
    alreadyReceived: 'ALREADY RECEIVED',
    balanceDue: 'BALANCE DUE',
    amountReceivedClient: 'Amount received (XAF)',
    afterPayment: 'After this payment:',
    exceedsBalanceDue: 'Exceeds balance due',
    settled: '✓ Settled',
    amountDue: 'AMOUNT DUE',
    alreadyPaid: 'ALREADY PAID',
    balanceLabel: 'BALANCE',
    remainingShort: 'Balance',
    amountPaidSupplier: 'Amount paid (XAF)',
    accountSettled: 'Account already settled',
    amountRequired: 'Amount required',
    purchasedCurrency: 'Purchased currency',
    currentCmup: 'Current CMUP',
    newStock: 'New stock',
    saleRecordedAfterSubmit: 'This sale will be recorded immediately after submission.',
    profitShareInSale: 'Distribution for this sale',
    pending: 'Pending', committed: 'Finalized',
    finaliserVente: 'Finalize sale', finaliserDesc: 'Add hidden data',
    finaliserSuccess: 'Sale finalized with hidden data!',
    prixAchatTotal: 'Total purchase price (XAF)',
    tauxUnitaireCalc: 'Calculated unit rate',
    nouveauCMUP: 'New CMUP after purchase',
    stockCourant: 'Current stock',
    soldeDisponible: 'Available balance',
    modifierTx: 'Edit', editSuccess: 'Transaction updated!',
    stockNegatif: 'Edit blocked — negative USDT stock detected on',
    depuisCaisse: 'From Cash Register',
    infoAchat: 'Stock information', infoCaisse: 'Cash information',
    prixAchatHint: 'Total amount paid to supplier',
    // ── Stock Movement ──
    stockMovement: 'USDT Stock Movements',
    stockMovementDesc: 'Detailed history of USDT inflows/outflows',
    entree: 'Inflow', sortie: 'Outflow',
    stockAvant: 'Stock before', stockApres: 'Stock after',
    variation: 'Change', libelle: 'Label',
    typeOp: 'Type', refOp: 'Reference',
    noMovements: 'No stock movements recorded',
    exportCSV: 'Export CSV',
    soldeActuel: 'Current balance',
    totalEntrees: 'Total inflows', totalSorties: 'Total outflows',
    cmupActuel: 'Current CMUP', valeurStock: 'Stock value',
    supplierStockBreakdown: 'Supplier stock breakdown',
    supplierStockAvailable: 'Available',
    supplierStockDebt: 'Stock debt',
    supplierStockBefore: 'Supplier stock before',
    supplierStockAfter: 'Supplier stock after',
    noSupplierStock: 'No supplier stock',
    sourceAchat: 'Funding source', clientVente: 'Client',
    deviseSortie: 'Out currency', qteDevise: 'Currency qty',
    tauxConvUsdt: 'Conv. rate USDT', tauxAchatXaf: 'Purchase rate XAF',
    tauxVenteXaf: 'Sale rate XAF', valAchatXaf: 'Purchase value XAF',
    valVenteXaf: 'Sale value XAF', beneficeOp: 'Profit',
    fournisseurAchat: 'Supplier', newCmup: 'New CMUP',
    searchMovement: 'Search...', filterAll: 'All',
    evolutionStock: 'Stock evolution',
    editCmup: 'Manually edit CMUP',
    cmupManuel: 'New CMUP (XAF/USDT)',
    cmupUpdated: 'CMUP updated successfully!',
    cmupWarning: 'Warning: manually editing the CMUP affects all future calculations.',
    confirmCmup: 'Confirm change',
    cmupHistory: 'CMUP History',
    passwordRequired: 'Password required to edit CMUP',
    cmupLog: 'CMUP Adjustment',
    inputCmup: 'Enter CMUP',
    addCurrencyButton: 'Add currency',
    newCurrency: 'New currency',
    codeExample: 'Code * (e.g. EUR)',
    currencyRateFormula: 'Rate (1 USDT = ? currency) *',
    optional: 'Optional',
    noCurrency: 'No currency',
    defaultLabel: 'DEFAULT',
    deleteCurrencyConfirm: 'Delete this currency?',
    deletedCurrencySuccess: 'Deleted',
    currencyCreatedSuccess: 'Currency created',
    currencyUpdatedSuccess: 'Currency updated ✓',
    codeAndRateRequired: 'Code and rate required',
    rateRequired: 'Rate required',
    currencyNamePlaceholder: 'Currency name',
    stockMovementRecordedCount: 'operation(s) recorded',
    stockSearchPlaceholder: 'Ref., client, supplier…',
    clearFilters: 'Clear',
    noMovementFound: 'No movement found',
    filterIncoming: '↑ Entries',
    filterOutgoing: '↓ Exits',
    recordedShortLabel: 'Rec.',
    editedShortLabel: 'Edited',
    operationLabel: 'Operation',
    referenceLabel: 'Reference',
    recordedDateLabel: 'Recorded date',
    modifiedDateLabel: 'Edited date',
    userLabel: 'User',
    statusLabel: 'Status',
    fundingSupplyLabel: 'Supply',
    saleMovementLabel: 'Sale',
    marketEvolution: 'Market Evolution',
    marketDailyVariation: 'Daily sales & profit variations',
    profitXafLabel: 'Profit XAF',
    purchasesXafLabel: 'Purchases XAF',
    salesXafLabel: 'Sales XAF',
    periodPurchases: 'Period purchases',
    periodProfit: 'Period profit',
    operationsCountFull: 'Operations count',
  }
};

// ─────────────────────────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────────────────────────
const DEVISES = ['USDT'];
const DEVISES_VENTE = [
  { code: 'RMB', label: 'RMB — Yuan Chinois' },
  { code: 'USD', label: 'USD — Dollar Américain' },
];
const HIDDEN_PASSWORD = '1234';
const DEFAULT_PROFIT_SHARE = { porteur: 70, associe: 30 };
const CATEGORIES = ['Loyer/Rent', 'Salaires/Salaries', 'Matériel/Equipment', 'Transport', 'Marketing', 'Assurance/Insurance', 'Autre/Other'];

// ─────────────────────────────────────────────────────────────
// UTILITAIRES
// ─────────────────────────────────────────────────────────────
const calculerCMUP = (ancienStock, ancienCMUP, nouvelleQte, nouveauTaux) => {
  if (!isFinite(ancienStock) || !isFinite(ancienCMUP) || !isFinite(nouvelleQte) || !isFinite(nouveauTaux)) return ancienCMUP || 0;
  if (ancienStock <= 0) return nouveauTaux;
  if (nouvelleQte <= 0) return ancienCMUP;
  const result = ((ancienStock * ancienCMUP) + (nouvelleQte * nouveauTaux)) / (ancienStock + nouvelleQte);
  return Math.round(result * 1000000) / 1000000;
};

const createLog = (type, description, userId, meta = {}) => ({
  id: `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
  dateHeure: new Date(),
  typeEvenement: type,
  description,
  idUtilisateur: userId,
  idOperation: meta.opId || null,
  ip: meta.ip || 'local',
  userAgent: navigator.userAgent.substring(0, 80),
  statut: meta.statut || 'success',
});

// Retourne le delta USDT d'une transaction (positif = entrée, négatif = sortie)
const getUsdtDelta = (tx) => {
  if (tx.type === 'achat' && tx.devise === 'USDT') return tx.quantite;
  if (tx.type === 'vente') return -(tx.usdtConsomme || 0);
  return 0;
};

const isPrincipalSupplier = (supplier) =>
  String(supplier?.type_fournisseur || '').trim().toLowerCase() === 'principal';

const formatTransferDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return format(date, 'dd/MM/yyyy');
};

const formatXafAmount = (value, digits = 0) =>
  `${parseThousands(value).toLocaleString('fr-FR', { maximumFractionDigits: digits })} XAF`;

const formatSignedXafAmount = (value, digits = 0) => {
  const amount = parseThousands(value);
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${prefix}${Math.abs(amount).toLocaleString('fr-FR', { maximumFractionDigits: digits })} XAF`;
};

const getTxUserKey = (tx) => String(tx.userId ?? tx.user_id ?? tx.userName ?? tx.user_name ?? 'unknown');
const getTxUserLabel = (tx) => tx.userName || tx.user_name || `Utilisateur #${tx.userId ?? tx.user_id ?? '?'}`;

const addSignedBalance = (bucket, prefix, delta) => {
  if (!delta) return;
  if (delta > 0) bucket[`${prefix}Debt`] += delta;
  else bucket[`${prefix}Credit`] += Math.abs(delta);
};

const buildAccountUserSummary = (transactions = [], scope = 'client') => {
  const byUser = new Map();

  const ensureUser = (tx) => {
    const key = getTxUserKey(tx);
    if (!byUser.has(key)) {
      byUser.set(key, {
        key,
        name: getTxUserLabel(tx),
        role: tx.userRole || tx.user_role || '',
        debt: 0,
        credit: 0,
        activityCount: 0,
      });
    }
    const bucket = byUser.get(key);
    bucket.activityCount += 1;
    if (!bucket.name || bucket.name.startsWith('Utilisateur #')) bucket.name = getTxUserLabel(tx);
    if (!bucket.role) bucket.role = tx.userRole || tx.user_role || '';
    return bucket;
  };

  const record = (bucket, delta) => {
    if (!delta) return;
    if (delta > 0) bucket.debt += delta;
    else bucket.credit += Math.abs(delta);
  };

  (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
    const bucket = ensureUser(tx);

    if (scope === 'client') {
      if (tx.type === 'vente') {
        const due = parseThousands(tx.montant_a_payer ?? tx.valeur_vente_visible ?? tx.montant ?? 0);
        const paid = parseThousands(tx.montant_paye ?? 0);
        record(bucket, due - paid);
      } else if (tx.type === 'paiement_client') {
        record(bucket, -parseThousands(tx.montant_paye ?? tx.montant ?? 0));
      }
      return;
    }

    if (scope === 'supplier') {
      if (tx.type === 'achat') {
        record(bucket, -parseThousands(tx.prix_achat_total ?? tx.montant_paye ?? tx.montant ?? 0));
      } else if (tx.type === 'vente') {
        record(bucket, parseThousands(tx.valeur_achat_xaf ?? tx.valeurAchat ?? tx.montant_a_payer ?? 0));
      } else if (tx.type === 'paiement_fournisseur') {
        record(bucket, -parseThousands(tx.montant_paye ?? 0));
      }
    }
  });

  const rowsBase = Array.from(byUser.values()).map((row) => {
    const net = row.debt - row.credit;
    return { ...row, net };
  });

  const pool = rowsBase.reduce((sum, row) => sum + Math.abs(row.net), 0);

  return rowsBase
    .map((row) => ({
      ...row,
      share: pool > 0 ? (Math.abs(row.net) / pool) * 100 : 0,
    }))
    .sort((a, b) =>
      Math.abs(b.net) - Math.abs(a.net)
      || b.activityCount - a.activityCount
      || a.name.localeCompare(b.name)
    );
};

const buildResponsibilitySummary = ({ transactions = [], clients = [], fournisseurs = [] }) => {
  const buildAccountSummary = (rows = []) => rows.reduce((acc, row) => {
    const due = parseThousands(row.total_a_payer ?? row.total_a_payer_global ?? 0);
    const paid = parseThousands(row.total_paye ?? row.total_paye_global ?? 0);
    const balance = parseThousands(row.reste ?? row.reste_global ?? (due - paid));

    acc.totalDue += due;
    acc.totalPaid += paid;
    if (balance > 0) {
      acc.debt += balance;
      acc.debtCount += 1;
    } else if (balance < 0) {
      acc.credit += Math.abs(balance);
      acc.creditCount += 1;
    }
    return acc;
  }, {
    totalDue: 0,
    totalPaid: 0,
    debt: 0,
    credit: 0,
    debtCount: 0,
    creditCount: 0,
  });

  const clientsSummary = buildAccountSummary(Array.isArray(clients) ? clients : []);
  const suppliersSummary = buildAccountSummary(Array.isArray(fournisseurs) ? fournisseurs : []);

  const byUser = new Map();
  const ensureUser = (tx) => {
    const key = getTxUserKey(tx);
    if (!byUser.has(key)) {
      byUser.set(key, {
        key,
        name: getTxUserLabel(tx),
        role: tx.userRole || tx.user_role || '',
        clientDebt: 0,
        clientCredit: 0,
        supplierDebt: 0,
        supplierCredit: 0,
        activityCount: 0,
      });
    }
    const bucket = byUser.get(key);
    bucket.activityCount += 1;
    if (!bucket.name || bucket.name.startsWith('Utilisateur #')) bucket.name = getTxUserLabel(tx);
    if (!bucket.role) bucket.role = tx.userRole || tx.user_role || '';
    return bucket;
  };

  (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
    const bucket = ensureUser(tx);

    if (tx.type === 'vente') {
      const clientDue = parseThousands(tx.montant_a_payer ?? tx.valeur_vente_visible ?? tx.montant ?? 0);
      const clientPaid = parseThousands(tx.montant_paye ?? 0);
      addSignedBalance(bucket, 'client', clientDue - clientPaid);

      const supplierDue = parseThousands(tx.valeur_achat_xaf ?? tx.valeurAchat ?? 0);
      if (supplierDue > 0) addSignedBalance(bucket, 'supplier', supplierDue);
      return;
    }

    if (tx.type === 'paiement_client') {
      addSignedBalance(bucket, 'client', -parseThousands(tx.montant_paye ?? tx.montant ?? 0));
      return;
    }

    if (tx.type === 'achat') {
      addSignedBalance(bucket, 'supplier', -parseThousands(tx.prix_achat_total ?? tx.montant_paye ?? tx.montant ?? 0));
      return;
    }

    if (tx.type === 'paiement_fournisseur') {
      addSignedBalance(bucket, 'supplier', -parseThousands(tx.montant_paye ?? 0));
    }
  });

  const userRowsBase = Array.from(byUser.values()).map((row) => {
    const clientNet = row.clientDebt - row.clientCredit;
    const supplierNet = row.supplierDebt - row.supplierCredit;
    return {
      ...row,
      clientNet,
      supplierNet,
      totalNet: clientNet + supplierNet,
    };
  });

  const responsibilityPool = userRowsBase.reduce(
    (sum, row) => sum + Math.abs(row.clientNet) + Math.abs(row.supplierNet),
    0
  );

  const userRows = userRowsBase
    .map((row) => ({
      ...row,
      share: responsibilityPool > 0
        ? ((Math.abs(row.clientNet) + Math.abs(row.supplierNet)) / responsibilityPool) * 100
        : 0,
    }))
    .sort((a, b) =>
      ((Math.abs(b.clientNet) + Math.abs(b.supplierNet)) - (Math.abs(a.clientNet) + Math.abs(a.supplierNet)))
      || b.activityCount - a.activityCount
      || a.name.localeCompare(b.name)
    );

  return {
    clientsSummary,
    suppliersSummary,
    userRows,
    clientUserRows: buildAccountUserSummary(transactions, 'client'),
    supplierUserRows: buildAccountUserSummary(transactions, 'supplier'),
  };
};

const LEDGER_ROLES = ['porteur', 'associe'];

const normalizeEntityName = (...values) => values
  .filter(Boolean)
  .join(' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildSupplierStockSummary = (transactions = [], fournisseurs = []) => {
  const normalizeKeyName = (value) => normalizeEntityName(value).toLowerCase();
  const fournisseurById = new Map();
  const fournisseurByName = new Map();

  (Array.isArray(fournisseurs) ? fournisseurs : []).forEach((fournisseur) => {
    const id = parseInt(fournisseur?.id, 10);
    const name = normalizeEntityName(fournisseur?.nom, fournisseur?.prenom);
    if (Number.isFinite(id) && id > 0) fournisseurById.set(id, fournisseur);
    if (name) fournisseurByName.set(normalizeKeyName(name), fournisseur);
  });

  const resolveSupplier = (source = {}) => {
    const rawId = parseInt(source.id_fournisseur ?? source.idFournisseur, 10);
    const byId = Number.isFinite(rawId) && rawId > 0 ? fournisseurById.get(rawId) : null;
    const rawName = normalizeEntityName(source.fournisseur);
    const byName = rawName ? fournisseurByName.get(normalizeKeyName(rawName)) : null;
    const supplier = byId || byName || null;
    const id = supplier?.id ?? (Number.isFinite(rawId) && rawId > 0 ? rawId : null);
    const name = normalizeEntityName(supplier?.nom, supplier?.prenom) || rawName || (id ? `FRN-${String(id).padStart(4, '0')}` : '');
    if (!id && !name) return null;
    return {
      key: id ? `id:${id}` : `name:${normalizeKeyName(name)}`,
      id,
      name,
    };
  };

  const buckets = new Map();
  const ensureBucket = (identity) => {
    if (!identity) return null;
    if (!buckets.has(identity.key)) {
      buckets.set(identity.key, {
        key: identity.key,
        id: identity.id,
        name: identity.name,
        bought: 0,
        sold: 0,
        stock: 0,
        activityCount: 0,
      });
    }
    const bucket = buckets.get(identity.key);
    bucket.name = bucket.name || identity.name;
    return bucket;
  };

  const movementById = new Map();
  const stockTransactions = (Array.isArray(transactions) ? transactions : [])
    .filter((tx) => tx?.type === 'vente' || (tx?.type === 'achat' && (tx.devise === 'USDT' || !tx.deviseVente)))
    .sort((a, b) => new Date(a.date || a.date_enregistrement || 0) - new Date(b.date || b.date_enregistrement || 0));

  stockTransactions.forEach((tx) => {
    const identity = resolveSupplier(tx);
    const bucket = ensureBucket(identity);
    if (!bucket) return;

    const qty = tx.type === 'achat'
      ? parseThousands(tx.quantite ?? 0)
      : parseThousands(tx.usdtConsomme ?? tx.usdt_consomme ?? 0);
    if (!(qty > 0)) return;

    const before = bucket.stock;
    if (tx.type === 'achat') {
      bucket.bought += qty;
      bucket.stock += qty;
    } else {
      bucket.sold += qty;
      bucket.stock -= qty;
    }
    bucket.activityCount += 1;

    movementById.set(tx.id, {
      supplierKey: bucket.key,
      supplierId: bucket.id,
      supplierName: bucket.name,
      before,
      after: bucket.stock,
      qty,
      isDebt: bucket.stock < 0,
    });
  });

  (Array.isArray(fournisseurs) ? fournisseurs : []).forEach((fournisseur) => {
    const identity = resolveSupplier({
      id_fournisseur: fournisseur?.id,
      fournisseur: normalizeEntityName(fournisseur?.nom, fournisseur?.prenom),
    });
    const bucket = ensureBucket(identity);
    if (!bucket) return;

    const hasBackendStock = fournisseur?.stock_usdt !== undefined
      || fournisseur?.total_achats_usdt !== undefined
      || fournisseur?.total_ventes_usdt !== undefined;
    if (!hasBackendStock) return;

    bucket.bought = parseThousands(fournisseur.total_achats_usdt ?? bucket.bought);
    bucket.sold = parseThousands(fournisseur.total_ventes_usdt ?? bucket.sold);
    bucket.stock = parseThousands(fournisseur.stock_usdt ?? (bucket.bought - bucket.sold));
    bucket.activityCount = Math.max(bucket.activityCount, parseInt(fournisseur.nb_transactions || 0, 10) || 0);
  });

  const rows = Array.from(buckets.values())
    .filter((row) => row.activityCount > 0 || Math.abs(row.stock) > 0.000001 || Math.abs(row.bought) > 0.000001 || Math.abs(row.sold) > 0.000001)
    .sort((a, b) => {
      const debtPriority = (a.stock < 0 ? 0 : 1) - (b.stock < 0 ? 0 : 1);
      if (debtPriority !== 0) return debtPriority;
      return Math.abs(b.stock) - Math.abs(a.stock) || a.name.localeCompare(b.name);
    });

  return {
    rows,
    movementById,
    available: rows.reduce((sum, row) => sum + Math.max(0, row.stock), 0),
    debt: rows.reduce((sum, row) => sum + Math.max(0, -row.stock), 0),
  };
};

const getLedgerAmounts = (tx, scope = 'client') => {
  if (scope === 'client') {
    if (tx.type === 'vente') {
      return {
        due: parseThousands(tx.montant_a_payer ?? tx.valeur_vente_visible ?? tx.montant ?? 0),
        paid: parseThousands(tx.montant_paye ?? 0),
      };
    }
    if (tx.type === 'paiement_client') {
      return {
        due: 0,
        paid: parseThousands(tx.montant_paye ?? tx.montant ?? 0),
      };
    }
    return { due: 0, paid: 0 };
  }

  if (scope === 'supplier') {
    if (tx.type === 'achat') {
      return {
        due: 0,
        paid: parseThousands(tx.prix_achat_total ?? tx.montant_paye ?? tx.montant ?? 0),
      };
    }
    if (tx.type === 'vente') {
      return {
        due: parseThousands(tx.valeur_achat_xaf ?? tx.valeurAchat ?? tx.montant_a_payer ?? 0),
        paid: 0,
      };
    }
    if (tx.type === 'paiement_fournisseur') {
      return {
        due: 0,
        paid: parseThousands(tx.montant_paye ?? 0),
      };
    }
  }

  return { due: 0, paid: 0 };
};

const buildRoleLedgerSummary = (transactions = [], scope = 'client') => {
  const buckets = {
    porteur: { role: 'porteur', name: '', due: 0, paid: 0, rest: 0, activityCount: 0 },
    associe: { role: 'associe', name: '', due: 0, paid: 0, rest: 0, activityCount: 0 },
  };

  (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
    const role = String(tx.userRole || tx.user_role || '').toLowerCase();
    if (!LEDGER_ROLES.includes(role)) return;

    const { due, paid } = getLedgerAmounts(tx, scope);
    const bucket = buckets[role];
    bucket.name = bucket.name || getTxUserLabel(tx);
    bucket.due += due;
    bucket.paid += paid;
    bucket.rest = bucket.due - bucket.paid;
    bucket.activityCount += 1;
  });

  return LEDGER_ROLES.map((role) => buckets[role]);
};

const getRoleBreakdownForTransaction = (tx, scope = 'client') => {
  const role = String(tx.userRole || tx.user_role || '').toLowerCase();
  const { due, paid } = getLedgerAmounts(tx, scope);
  return {
    totalDue: due,
    totalPaid: paid,
    totalRest: due - paid,
    porteurDue: role === 'porteur' ? due : 0,
    porteurPaid: role === 'porteur' ? paid : 0,
    associeDue: role === 'associe' ? due : 0,
    associePaid: role === 'associe' ? paid : 0,
  };
};

const matchClientTransaction = (tx, client) => {
  if (!tx || !client || !['vente', 'paiement_client'].includes(tx.type)) return false;
  const clientId = parseInt(tx.client_id ?? tx.id_client, 10);
  if (Number.isFinite(clientId) && clientId === Number(client.id)) return true;
  return normalizeEntityName(tx.client) === normalizeEntityName(client.nom, client.prenom);
};

const matchSupplierTransaction = (tx, fournisseur) => {
  if (!tx || !fournisseur || !['achat', 'vente', 'paiement_fournisseur'].includes(tx.type)) return false;
  const fournisseurId = parseInt(tx.id_fournisseur ?? tx.idFournisseur, 10);
  if (Number.isFinite(fournisseurId) && fournisseurId === Number(fournisseur.id)) return true;
  if (tx.type === 'achat') {
    return normalizeEntityName(tx.fournisseur) === normalizeEntityName(fournisseur.nom, fournisseur.prenom);
  }
  return false;
};

const allocateRoleSituationFromAccounts = (accounts = [], transactions = [], scope = 'client') => {
  const matcher = scope === 'client' ? matchClientTransaction : matchSupplierTransaction;
  const totals = {
    porteur: { debt: 0, credit: 0 },
    associe: { debt: 0, credit: 0 },
  };

  const allocate = (targetKey, amount, candidates) => {
    const normalizedAmount = parseThousands(amount);
    if (normalizedAmount <= 0) return;

    const valid = (candidates || []).filter((item) => item.amount > 0 && LEDGER_ROLES.includes(item.role));
    const pool = valid.reduce((sum, item) => sum + item.amount, 0);
    if (pool <= 0) return;

    let allocated = 0;
    valid.forEach((item, index) => {
      const share = index === valid.length - 1
        ? (normalizedAmount - allocated)
        : (normalizedAmount * item.amount) / pool;
      totals[item.role][targetKey] += share;
      allocated += share;
    });
  };

  (Array.isArray(accounts) ? accounts : []).forEach((account) => {
    const balance = parseThousands(
      account?.reste
      ?? account?.reste_global
      ?? (parseThousands(account?.total_a_payer ?? account?.total_a_payer_global ?? 0)
        - parseThousands(account?.total_paye ?? account?.total_paye_global ?? 0))
    );

    if (Math.abs(balance) < 0.01) return;

    const roleRows = buildRoleLedgerSummary(
      (Array.isArray(transactions) ? transactions : []).filter((tx) => matcher(tx, account)),
      scope
    );

    if (balance > 0) {
      allocate('debt', balance, roleRows.map((row) => ({
        role: row.role,
        amount: Math.max(0, parseThousands(row.rest || 0)),
      })));
      return;
    }

    allocate('credit', Math.abs(balance), roleRows.map((row) => ({
      role: row.role,
      amount: Math.max(0, Math.abs(Math.min(0, parseThousands(row.rest || 0)))),
    })));
  });

  return totals;
};

const canAssociateEditTransaction = (tx, user, nowMs = Date.now()) => {
  if (!tx || !user || user.role !== 'associe') return false;
  if (tx.statut === 'committed') return false;
  if (String(tx.userId ?? tx.user_id ?? '') !== String(user.id ?? '')) return false;
  const createdAt = tx.dateEnregistrement || tx.date_enregistrement || tx.date;
  const createdMs = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  if (!Number.isFinite(createdMs)) return false;
  return ((nowMs - createdMs) / 60000) <= 5;
};

const getRemainingBalance = (totalDue, totalPaid) =>
  Math.max(0, parseThousands(totalDue) - parseThousands(totalPaid));

const getSignedBalance = (totalDue, totalPaid = 0) => {
  const balance = parseThousands(totalDue) - parseThousands(totalPaid);
  return Math.abs(balance) < 0.01 ? 0 : balance;
};

const getBalanceColor = (value) => {
  const balance = getSignedBalance(value, 0);
  if (balance > 0) return '#F59E0B';
  if (balance < 0) return '#7C3AED';
  return '#22C55E';
};

const formatBalanceText = (value, langue = 'fr') => {
  const balance = getSignedBalance(value, 0);
  if (balance > 0) return `${Math.round(balance).toLocaleString('fr-FR')} XAF`;
  if (balance < 0) return `-${Math.round(Math.abs(balance)).toLocaleString('fr-FR')} XAF`;
  return langue === 'fr' ? '✓ Soldé' : '✓ Settled';
};

const formatRemainingAmount = (value) => {
  return formatBalanceText(value, 'fr');
};

const formatRoleRemainingAmount = (value) =>
  formatBalanceText(value, 'fr');

const buildDashboardRoleMetrics = (
  transactions = [],
  { useHiddenPartner = false, currentStockUsdt = 0, currentCashXaf = 0 } = {}
) => {
  const metrics = {
    stock: {
      totalFed: 0,
      remaining: parseThousands(currentStockUsdt),
      used: { porteur: 0, associe: 0 },
    },
    cash: {
      totalFed: 0,
      remaining: parseThousands(currentCashXaf),
      used: { porteur: 0, associe: 0 },
    },
    profit: { total: 0, porteur: 0, associe: 0 },
    transactions: { total: 0, porteur: 0, associe: 0 },
  };

  (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
    const role = String(tx.userRole || tx.user_role || '').toLowerCase();
    const hasRole = LEDGER_ROLES.includes(role);

    if (hasRole) {
      metrics.transactions[role] += 1;
    }

    if (tx.type === 'vente') {
      if (hasRole) {
        metrics.stock.used[role] += parseThousands(tx.usdtConsomme ?? 0);
      }

      const useHiddenValues = useHiddenPartner && parseThousands(tx.beneficeCachee ?? tx.benefice_cache ?? 0) > 0;
      metrics.profit.porteur += parseThousands(
        useHiddenValues ? (tx.partPorteurCache ?? tx.part_porteur_cachee ?? 0) : (tx.partPorteur ?? tx.part_porteur_visible ?? 0)
      );
      metrics.profit.associe += parseThousands(
        useHiddenValues ? (tx.partAssocieCache ?? tx.part_associe_cachee ?? 0) : (tx.partAssocie ?? tx.part_associe_visible ?? 0)
      );
      return;
    }

    if (!hasRole) return;

    if (tx.type === 'achat') {
      if (tx.sourceCompte === 'caisse' || tx.use_caisse || tx.useCaisse) {
        metrics.cash.used[role] += parseThousands(tx.prix_achat_total ?? tx.montant ?? 0);
      }
      return;
    }

    if (tx.type === 'paiement_fournisseur') {
      metrics.cash.used[role] += parseThousands(tx.montant_paye ?? tx.montant ?? 0);
      return;
    }

    if (tx.type === 'depense' || tx.type === 'retrait') {
      metrics.cash.used[role] += parseThousands(tx.montant ?? 0);
    }
  });

  metrics.stock.totalFed = metrics.stock.remaining + metrics.stock.used.porteur + metrics.stock.used.associe;
  metrics.cash.totalFed = metrics.cash.remaining + metrics.cash.used.porteur + metrics.cash.used.associe;
  metrics.profit.total = metrics.profit.porteur + metrics.profit.associe;
  metrics.transactions.total = metrics.transactions.porteur + metrics.transactions.associe;

  return metrics;
};

// Simule la chaîne de stock à partir d'une transaction modifiée
// Retourne { valid, failDate, failStock }
const simulerChaineStock = (transactions, modifiedTxId, newDelta) => {
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const modIdx = sorted.findIndex(tx => tx.id === modifiedTxId);
  if (modIdx === -1) return { valid: true };

  const stockAvant = sorted[modIdx].stockUsdt_avant ?? 0;
  let current = stockAvant;

  for (let i = modIdx; i < sorted.length; i++) {
    const tx = sorted[i];
    const delta = tx.id === modifiedTxId ? newDelta : getUsdtDelta(tx);
    current += delta;
    if (current < 0) {
      return { valid: false, failDate: tx.date, failStock: current };
    }
  }
  return { valid: true };
};

// ─────────────────────────────────────────────────────────────
// QR CODE
// ─────────────────────────────────────────────────────────────
const genererQRDataURL = (contenu) => {
  try {
    const qr = qrcode(0, 'M');
    qr.addData(contenu);
    qr.make();
    const taille = qr.getModuleCount();
    const cellSize = 4;
    const canvas = document.createElement('canvas');
    canvas.width = taille * cellSize;
    canvas.height = taille * cellSize;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < taille; r++) {
      for (let c = 0; c < taille; c++) {
        if (qr.isDark(r, c)) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
        }
      }
    }
    return canvas.toDataURL('image/png');
  } catch (e) {
    return null;
  }
};

const loadImageDataURL = async (url) => {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};


// ─────────────────────────────────────────────────────────────
// FACTURE / REÇU GOD WIN CARGO
// Mise en page large inspirée du modèle fourni par l'utilisateur:
// logo à gauche, titre centré, infos client à gauche, solde à droite,
// puis tableau simple Date / Montant.
// ─────────────────────────────────────────────────────────────
const genererFacturePDF = async (transaction, langue) => {
  const isEn = langue === 'en';
  const locale = isEn ? enUS : dateFr;
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });

  const toPdfNumber = (value, fallback = 0) => {
    const amount = parseThousands(value);
    return Number.isFinite(amount) ? amount : fallback;
  };
  const formatPdfNumber = (value, digits = 0) => {
    const amount = toPdfNumber(value);
    if (!Number.isFinite(amount)) return '0';
    const fixed = digits > 0 ? amount.toFixed(digits) : Math.round(amount).toString();
    const [intPartRaw, decimalPart] = fixed.split('.');
    const sign = intPartRaw.startsWith('-') ? '-' : '';
    const intPart = intPartRaw.replace('-', '');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return decimalPart ? `${sign}${grouped}.${decimalPart}` : `${sign}${grouped}`;
  };
  const formatFcfa = (value, digits = 0) => `${formatPdfNumber(value, digits)} fcfa`;
  const safeDate = transaction.date instanceof Date
    ? transaction.date
    : new Date(transaction.date || Date.now());
  const dateText = Number.isNaN(safeDate.getTime())
    ? format(new Date(), 'dd/MM/yyyy', { locale })
    : format(safeDate, 'dd/MM/yyyy', { locale });

  const typeLabels = {
    vente: isEn ? 'Sale' : 'Vente',
    achat: isEn ? 'Currency Purchase' : 'Achat de Devise',
    paiement_client: isEn ? 'Client Payment' : 'Versement Client',
    paiement_fournisseur: isEn ? 'Supplier Payment' : 'Paiement Fournisseur',
    depense: isEn ? 'Expense' : 'Dépense',
    retrait: isEn ? 'Withdrawal' : 'Retrait',
    versement: isEn ? 'Cash Funding' : 'Alimentation Caisse',
  };
  const typeLabel = typeLabels[transaction.type] || (transaction.type || '').toUpperCase();
  const entityName = transaction.client
    || transaction.fournisseur
    || transaction.beneficiaire
    || transaction.userName
    || 'GOD WIN CARGO';
  const montantDisplay = transaction.type === 'vente'
    ? (transaction.valeurVenteVisible || transaction.montant || 0)
    : ['paiement_client', 'paiement_fournisseur'].includes(transaction.type)
      ? (transaction.montantPaye || transaction.montant_paye || transaction.montant || 0)
      : (transaction.montant || transaction.prix_achat_total || 0);
  const explicitBalance = transaction.reste
    ?? transaction.reste_xaf
    ?? transaction.montant_reste
    ?? transaction.montantReste;
  const hasExplicitBalance = explicitBalance !== undefined && explicitBalance !== null && String(explicitBalance).trim() !== '';
  const calculatedBalance = transaction.type === 'vente'
    ? toPdfNumber(transaction.montant_a_payer ?? transaction.valeurVenteVisible ?? transaction.montant, montantDisplay)
      - toPdfNumber(transaction.montantPaye ?? transaction.montant_paye, 0)
    : montantDisplay;
  const soldeDisplay = hasExplicitBalance
    ? explicitBalance
    : calculatedBalance;
  const currencyLine = transaction.type === 'vente'
    ? `${formatPdfNumber(transaction.quantiteDevise || transaction.quantite_vente || 0, 4)} ${transaction.deviseVente || transaction.devise_vente || ''}`.trim()
    : transaction.type === 'achat'
      ? `${formatPdfNumber(transaction.quantite || 0, 4)} ${transaction.devise || ''}`.trim()
      : formatFcfa(montantDisplay);
  const rateLine = transaction.type === 'vente'
    ? `${formatPdfNumber(transaction.tauxVisible || transaction.taux_vente_visible || 0)} fcfa`
    : transaction.type === 'achat'
      ? `${formatPdfNumber(transaction.taux || transaction.taux_achat_unitaire || 0)} fcfa`
      : transaction.id || '-';
  const paidLine = formatFcfa(transaction.montantPaye || transaction.montant_paye || 0);
  const summaryLabel = ['paiement_client', 'paiement_fournisseur'].includes(transaction.type)
    ? (hasExplicitBalance ? (isEn ? 'Balance:' : 'Solde :') : (isEn ? 'Amount:' : 'Montant :'))
    : transaction.type === 'vente'
      ? (isEn ? 'Balance:' : 'Solde :')
      : (isEn ? 'Total:' : 'Total :');
  const summaryAmount = ['paiement_client', 'paiement_fournisseur'].includes(transaction.type) && !hasExplicitBalance
    ? montantDisplay
    : transaction.type === 'achat'
      ? montantDisplay
      : soldeDisplay;
  const invoiceFields = (() => {
    switch (transaction.type) {
      case 'vente':
        return [
          { label: isEn ? 'Client' : 'Nom', value: entityName },
          { label: isEn ? 'Currency sold' : 'Devise vendue', value: currencyLine },
          { label: isEn ? 'Rate' : 'Taux', value: rateLine },
          { label: isEn ? 'Total' : 'Total', value: formatFcfa(montantDisplay) },
          toPdfNumber(transaction.montantPaye || transaction.montant_paye, 0) > 0
            ? { label: isEn ? 'Received' : 'Reçu', value: paidLine }
            : null,
        ].filter(Boolean);
      case 'achat':
        return [
          { label: isEn ? 'Supplier' : 'Fournisseur', value: entityName },
          { label: isEn ? 'Currency bought' : 'Devise achetée', value: currencyLine },
          { label: isEn ? 'Purchase rate' : "Taux d'achat", value: rateLine },
          { label: isEn ? 'Total' : 'Total', value: formatFcfa(montantDisplay) },
        ];
      case 'paiement_client':
        return [
          { label: isEn ? 'Client' : 'Nom', value: entityName },
          { label: isEn ? 'Amount received' : 'Montant reçu', value: formatFcfa(montantDisplay) },
          hasExplicitBalance ? { label: isEn ? 'Balance after' : 'Solde après', value: formatFcfa(soldeDisplay) } : null,
        ].filter(Boolean);
      case 'paiement_fournisseur':
        return [
          { label: isEn ? 'Supplier' : 'Fournisseur', value: entityName },
          { label: isEn ? 'Amount paid' : 'Montant payé', value: formatFcfa(montantDisplay) },
          hasExplicitBalance ? { label: isEn ? 'Balance after' : 'Solde après', value: formatFcfa(soldeDisplay) } : null,
        ].filter(Boolean);
      case 'depense':
      case 'retrait':
        return [
          { label: isEn ? 'Beneficiary' : 'Bénéficiaire', value: entityName },
          { label: isEn ? 'Amount' : 'Montant', value: formatFcfa(montantDisplay) },
          transaction.description || transaction.motif
            ? { label: isEn ? 'Reason' : 'Motif', value: transaction.description || transaction.motif }
            : null,
        ].filter(Boolean);
      default:
        return [
          { label: isEn ? 'Name' : 'Nom', value: entityName },
          { label: isEn ? 'Amount' : 'Montant', value: formatFcfa(montantDisplay) },
        ];
    }
  })();

  const W = 297;
  const H = 210;
  const ML = 12;
  const MR = 12;
  const INK = [0, 0, 0];
  const GREEN = [0, 128, 0];
  const DEEP_RED = [120, 0, 0];
  const LIGHT_BLUE = [231, 238, 251];
  const BORDER = [65, 65, 65];
  const SOFT_GREY = [235, 235, 235];

  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, 'F');

  // Logo bateau fourni par l'utilisateur.
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(248, 248, 248);
  doc.rect(ML, 10, 72, 30, 'FD');
  const logoDataUrl = await loadImageDataURL('/god-win-cargo-logo.jpg');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'JPEG', ML, 10, 72, 30);
  } else {
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('GOD WIN CARGO', ML + 36, 27, { align: 'center' });
  }

  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('GOD WIN CARGO', W / 2, 30, { align: 'center' });

  doc.setFontSize(11);
  doc.text(dateText, W - 28, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Tél. 677 52 68 42', W - 28, 30, { align: 'right' });

  const leftLabel = (label, value, y, valueColor = INK) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...GREEN);
    doc.text(label, ML + 4, y);
    doc.setTextColor(...valueColor);
    doc.text(String(value || '-'), ML + 55, y);
  };
  invoiceFields.slice(0, 5).forEach((field, index) => {
    leftLabel(field.label, field.value, 58 + (index * 11));
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  doc.text(typeLabel, 220, 64, { align: 'center' });

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.35);
  doc.roundedRect(180, 76, 104, 20, 3, 3, 'S');
  doc.setFontSize(16);
  doc.setTextColor(...GREEN);
  doc.text(summaryLabel, 185, 89);
  doc.setTextColor(...DEEP_RED);
  doc.text(formatFcfa(summaryAmount), 274, 89, { align: 'right' });

  doc.setFillColor(...LIGHT_BLUE);
  doc.setDrawColor(255, 255, 255);
  doc.rect(ML, 108, W - ML - MR, 16, 'F');
  doc.setTextColor(...INK);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Date', 72, 118, { align: 'center' });
  doc.text('Montant', 215, 118, { align: 'center' });
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.line(W / 2, 108, W / 2, 124);

  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(dateText, 72, 137, { align: 'center' });
  doc.text(formatPdfNumber(montantDisplay, 2), 215, 137, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.text('Total :', 118, 154);
  doc.text(formatPdfNumber(montantDisplay), 215, 154, { align: 'center' });

  doc.setDrawColor(...SOFT_GREY);
  doc.setLineWidth(0.3);
  doc.line(ML, 170, W - MR, 170);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  const footerParts = [
    transaction.userName ? `${isEn ? 'Operator' : 'Operateur'}: ${transaction.userName}` : '',
    transaction.client ? `${isEn ? 'Client' : 'Client'}: ${transaction.client}` : '',
    transaction.fournisseur ? `${isEn ? 'Supplier' : 'Fournisseur'}: ${transaction.fournisseur}` : '',
  ].filter(Boolean);
  if (footerParts.length) {
    doc.text(footerParts.join('  |  '), ML, 180);
  }
  doc.text('GOD WIN CARGO 2026', W - MR, 180, { align: 'right' });

  doc.save(`GOD_WIN_CARGO_${transaction.id || 'facture'}.pdf`);
};

// ═════════════════════════════════════════════════════════════
// genererExtraitXLSX — Extrait de compte Excel (Client ou Fournisseur)
// Fix 4 : remplace le PDF par un fichier .xlsx téléchargeable
// ═════════════════════════════════════════════════════════════
const genererExtraitXLSX = ({ type, entite, transactions, totals, cmupUsdt = 0 }) => {
  const isFourn   = type === 'fournisseur';
  const nomComplet = [entite.nom, entite.prenom].filter(Boolean).join(' ');
  const dateNow   = new Date();
  const dateStr   = dateNow.toLocaleDateString('fr-FR');
  const formatExportBalance = (value) => {
    const balance = getSignedBalance(value, 0);
    if (balance > 0) return Math.round(balance);
    if (balance < 0) return Math.round(Math.abs(balance));
    return 'Soldé';
  };

  // ── Construction CSV (compatible Excel sans lib externe) ──────
  const BOM   = '\uFEFF'; // BOM UTF-8 pour Excel Windows
  const SEP   = ';';       // Séparateur point-virgule pour Excel FR
  const lines = [];

  // Titre
  lines.push(['FOREXIUM — EXTRAIT DE COMPTE'].join(SEP));
  lines.push([isFourn ? 'FOURNISSEUR' : 'CLIENT', nomComplet].join(SEP));
  lines.push(['Généré le', dateStr].join(SEP));
  lines.push([''].join(SEP));

  // Récap totaux
  if (isFourn) {
    lines.push(['TOTAL À PAYER (XAF)', 'TOTAL PAYÉ (XAF)', 'RESTE DÛ (XAF)'].join(SEP));
    lines.push([
      Math.round(totals?.total_a_payer_global||0),
      Math.round(totals?.total_paye_global||0),
      Math.round(totals?.reste_global||0),
    ].join(SEP));
    if (cmupUsdt > 0) {
      lines.push(['TOTAL À PAYER (USDT)', 'TOTAL PAYÉ (USDT)', 'RESTE DÛ (USDT)'].join(SEP));
      lines.push([
        ((totals?.total_a_payer_global||0)/cmupUsdt).toFixed(4),
        ((totals?.total_paye_global||0)/cmupUsdt).toFixed(4),
        ((Math.abs(totals?.reste_global||0))/cmupUsdt).toFixed(4),
      ].join(SEP));
    }
    lines.push([''].join(SEP));
    lines.push(['ACHATS','VENTES LIÉES','PAIEMENTS'].join(SEP));
    lines.push([
      `${Math.round(totals?.total_achats||0)} XAF (${totals?.nb_achats||0})`,
      `${Math.round(totals?.total_ventes||0)} XAF (${totals?.nb_ventes||0})`,
      `${Math.round(totals?.total_paiements_paye||0)} XAF (${totals?.nb_paiements||0})`,
    ].join(SEP));
    lines.push(['STOCK USDT FOURNISSEUR', `${Number(totals?.stock_usdt||0).toFixed(4)} USDT`].join(SEP));
  } else {
    lines.push(['TOTAL VENTES (XAF)', 'MONTANT REÇU (XAF)', 'RESTE DÛ (XAF)'].join(SEP));
    lines.push([
      Math.round(totals?.total_a_payer||0),
      Math.round(totals?.total_paye||0),
      Math.round(totals?.total_reste||0),
    ].join(SEP));
  }
  lines.push([''].join(SEP));

  const userRows = buildAccountUserSummary(transactions || [], isFourn ? 'supplier' : 'client');
  if (userRows.length > 0) {
    lines.push(['RÉPARTITION PAR UTILISATEUR'].join(SEP));
    lines.push(['UTILISATEUR', 'RÔLE', 'OPÉRATIONS', 'DÛ (XAF)', 'CRÉDIT (XAF)', 'SOLDE (XAF)', 'PART (%)'].join(SEP));
    userRows.forEach((row) => {
      const role = row.role === 'porteur'
        ? 'Porteur'
        : row.role === 'associe'
          ? 'Associé'
          : row.role || '';
      lines.push([
        row.name || '—',
        role,
        row.activityCount || 0,
        Math.round(row.debt || 0),
        Math.round(row.credit || 0),
        row.net !== 0 ? Math.round(row.net) : 0,
        `${row.share.toFixed(0)}%`,
      ].join(SEP));
    });
    lines.push([''].join(SEP));
  }

  // En-tête colonnes
  if (isFourn) {
    lines.push(['DATE','TYPE','À PAYER (XAF)','PAYÉ (XAF)','RESTE (XAF)','MODE'].join(SEP));
  } else {
    lines.push(['DATE','TYPE','MONTANT (XAF)','REÇU (XAF)','RESTE (XAF)'].join(SEP));
  }

  // Lignes transactions
  (transactions||[]).forEach(tx => {
    const aPayer = parseFloat(tx.montant_a_payer||0);
    const paye   = parseFloat(tx.montant_paye||0);
    const reste  = parseFloat(tx.reste_courant ?? (aPayer - paye));
    const dateFmt = tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '—';
    const typeFmt = tx.type === 'achat' ? 'Achat'
      : tx.type === 'vente' ? 'Vente'
      : tx.type === 'paiement_fournisseur' ? 'Paiement'
      : tx.type === 'paiement_client' ? 'Paiement'
      : tx.type;
    if (isFourn) {
      lines.push([
        dateFmt, typeFmt,
        aPayer > 0 ? Math.round(aPayer) : '',
        paye   > 0 ? Math.round(paye)   : '',
        formatExportBalance(reste),
        tx.mode_paiement || 'XAF',
      ].join(SEP));
    } else {
      lines.push([
        dateFmt, typeFmt,
        aPayer > 0 ? Math.round(aPayer) : '',
        paye   > 0 ? Math.round(paye)   : '',
        formatExportBalance(reste),
      ].join(SEP));
    }
  });

  // Ligne totaux finale
  lines.push([''].join(SEP));
  if (isFourn) {
    lines.push([
      'TOTAUX', '',
      Math.round(totals?.total_a_payer_global||0),
      Math.round(totals?.total_paye_global||0),
      (totals?.reste_global||0) > 0 ? Math.round(totals.reste_global) : 'Soldé',
      '',
    ].join(SEP));
  } else {
    lines.push([
      'TOTAUX', '',
      Math.round(totals?.total_a_payer||0),
      Math.round(totals?.total_paye||0),
      (totals?.total_reste||0) > 0 ? Math.round(totals.total_reste) : 'Soldé',
    ].join(SEP));
  }

  // ── Téléchargement ────────────────────────────────────────────
  const csvContent = BOM + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const safeNom = nomComplet.replace(/[^a-zA-Z0-9]/g, '_');
  a.href     = url;
  a.download = `FOREXIUM_Extrait_${isFourn?'Fournisseur':'Client'}_${safeNom}_${dateNow.toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
// Vrai PDF imprimable pour les extraits de compte client/fournisseur.
// L'export CSV reste disponible via genererExtraitXLSX, mais le bouton PDF
// doit produire un document imprimable et non plus un fichier CSV.
const genererExtraitPDF = async ({ type, entite, transactions, totals, cmupUsdt = 0, langue = 'fr' }) => {
  const isFourn = type === 'fournisseur';
  const isEn = langue === 'en';
  const rows = Array.isArray(transactions) ? transactions : [];
  const doc = new jsPDF({ format: 'a4', unit: 'mm', orientation: 'landscape' });

  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const ML = 12;
  const MR = 12;
  const INK = [8, 22, 45];
  const MUTED = [104, 121, 158];
  const FAINT = [155, 170, 200];
  const BORDER = [222, 230, 242];
  const BLUE = [14, 165, 233];
  const GREEN = [34, 197, 94];
  const RED = [239, 68, 68];
  const ORANGE = [245, 158, 11];
  const LIGHT_BLUE = [233, 244, 255];
  const LIGHT_GREEN = [235, 252, 242];
  const LIGHT_ORANGE = [255, 247, 237];
  const LIGHT_RED = [255, 241, 242];

  const toNumber = (value, fallback = 0) => {
    const amount = parseThousands(value);
    return Number.isFinite(amount) ? amount : fallback;
  };
  const formatPdfNumber = (value, digits = 0) => {
    const amount = toNumber(value);
    const fixed = digits > 0 ? amount.toFixed(digits) : Math.round(amount).toString();
    const [intPartRaw, decimalPart] = fixed.split('.');
    const sign = intPartRaw.startsWith('-') ? '-' : '';
    const intPart = intPartRaw.replace('-', '');
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimalPart ? `${sign}${grouped}.${decimalPart}` : `${sign}${grouped}`;
  };
  const money = (value) => `${formatPdfNumber(value)} XAF`;
  const usdt = (value) => `${formatPdfNumber(value, 4)} USDT`;
  const balanceText = (value) => {
    const balance = toNumber(value);
    if (Math.abs(balance) < 0.01) return isEn ? 'Settled' : 'Soldé';
    if (balance > 0) return money(balance);
    return `${isEn ? 'Credit' : 'Surplus'} ${money(Math.abs(balance))}`;
  };
  const balanceColor = (value) => {
    const balance = toNumber(value);
    if (Math.abs(balance) < 0.01) return GREEN;
    if (balance < 0) return [124, 58, 237];
    return ORANGE;
  };
  const safeText = (value, fallback = '-') => {
    const text = String(value ?? '').trim();
    return text || fallback;
  };
  const entityName = safeText([entite?.nom, entite?.prenom].filter(Boolean).join(' '), isFourn ? 'Fournisseur' : 'Client');
  const dateNow = new Date();
  const dateStr = dateNow.toLocaleDateString('fr-FR');
  const fileSafeName = entityName.replace(/[^a-zA-Z0-9_-]+/g, '_');

  const totalDue = isFourn ? toNumber(totals?.total_a_payer_global) : toNumber(totals?.total_a_payer);
  const totalPaid = isFourn ? toNumber(totals?.total_paye_global) : toNumber(totals?.total_paye);
  const totalRest = isFourn ? toNumber(totals?.reste_global) : toNumber(totals?.total_reste);
  const userRows = buildAccountUserSummary(rows, isFourn ? 'supplier' : 'client');

  let y = 14;

  const addFooter = () => {
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.line(ML, H - 12, W - MR, H - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...MUTED);
    doc.text('GOD WIN CARGO 2026', ML, H - 7);
    doc.text(`${isEn ? 'Page' : 'Page'} ${doc.internal.getNumberOfPages()}`, W - MR, H - 7, { align: 'right' });
  };

  const drawHeader = async (compact = false) => {
    if (!compact) {
      const logoDataUrl = await loadImageDataURL('/god-win-cargo-logo.jpg');
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 248, 248);
      doc.rect(ML, 8, 56, 23, 'FD');
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'JPEG', ML, 8, 56, 23);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...INK);
        doc.text('GOD WIN CARGO', ML + 28, 21, { align: 'center' });
      }
    }

    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(compact ? 13 : 22);
    doc.text('GOD WIN CARGO', W / 2, compact ? 12 : 18, { align: 'center' });
    doc.setFontSize(compact ? 9 : 13);
    doc.setTextColor(...MUTED);
    doc.text(isFourn
      ? (isEn ? 'Supplier account statement' : 'Extrait de compte fournisseur')
      : (isEn ? 'Client account statement' : 'Extrait de compte client'),
      W / 2,
      compact ? 18 : 27,
      { align: 'center' }
    );

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(dateStr, W - MR, compact ? 12 : 13, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('Tel. 677 52 68 42', W - MR, compact ? 18 : 21, { align: 'right' });

    y = compact ? 26 : 40;
  };

  const ensureSpace = async (needed, redrawTable = false) => {
    if (y + needed <= H - 18) return;
    addFooter();
    doc.addPage();
    await drawHeader(true);
    if (redrawTable) drawTableHeader();
  };

  const sectionTitle = (text) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    doc.text(text, ML, y);
    y += 6;
  };

  const drawCard = (x, width, label, value, color, bg, sub = '') => {
    doc.setFillColor(...bg);
    doc.setDrawColor(...BORDER);
    doc.roundedRect(x, y, width, 24, 3, 3, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), x + 5, y + 7);
    doc.setFontSize(12);
    doc.setTextColor(...color);
    doc.text(value, x + 5, y + 15);
    if (sub) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...FAINT);
      doc.text(sub, x + 5, y + 21);
    }
  };

  const drawTableHeader = () => {
    doc.setFillColor(232, 238, 251);
    doc.setDrawColor(255, 255, 255);
    doc.rect(ML, y, W - ML - MR, 9, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(isEn ? 'DATE' : 'DATE', ML + 2, y + 6);
    doc.text(isEn ? 'TYPE' : 'TYPE', ML + 32, y + 6);
    doc.text(isFourn ? (isEn ? 'TO PAY' : 'A PAYER') : (isEn ? 'AMOUNT' : 'MONTANT'), ML + 95, y + 6, { align: 'right' });
    doc.text(isFourn ? (isEn ? 'PAID' : 'PAYE') : (isEn ? 'RECEIVED' : 'RECU'), ML + 143, y + 6, { align: 'right' });
    doc.text(isEn ? 'BALANCE' : 'RESTE', ML + 220, y + 6, { align: 'right' });
    y += 10;
  };

  await drawHeader(false);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text(`${isFourn ? (isEn ? 'Supplier' : 'Fournisseur') : (isEn ? 'Client' : 'Client')} : ${entityName}`, ML, y);
  y += 10;

  const cardW = (W - ML - MR - 12) / 3;
  drawCard(ML, cardW, isFourn ? (isEn ? 'Total to pay' : 'Total a payer') : (isEn ? 'Total sales' : 'Total ventes'), money(totalDue), isFourn ? RED : BLUE, isFourn ? LIGHT_RED : LIGHT_BLUE, `${rows.length} ${isEn ? 'operations' : 'operations'}`);
  drawCard(ML + cardW + 6, cardW, isFourn ? (isEn ? 'Total paid' : 'Total paye') : (isEn ? 'Amount received' : 'Montant recu'), money(totalPaid), GREEN, LIGHT_GREEN);
  drawCard(ML + (cardW + 6) * 2, cardW, isEn ? 'Balance' : 'Solde', balanceText(totalRest), balanceColor(totalRest), LIGHT_ORANGE);
  y += 32;

  if (false && isFourn) {
    sectionTitle(isEn ? 'Supplier details' : 'Detail fournisseur');
    const stockColor = toNumber(totals?.stock_usdt) < 0 ? RED : GREEN;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(`${isEn ? 'Purchases' : 'Achats'} : ${money(totals?.total_achats || 0)} (${totals?.nb_achats || 0})`, ML, y);
    doc.text(`${isEn ? 'Linked sales' : 'Ventes liees'} : ${money(totals?.total_ventes || 0)} (${totals?.nb_ventes || 0})`, ML + 75, y);
    doc.text(`${isEn ? 'Payments' : 'Paiements'} : ${money(totals?.total_paiements_paye || 0)} (${totals?.nb_paiements || 0})`, ML + 155, y);
    doc.setTextColor(...stockColor);
    doc.text(`${isEn ? 'USDT stock' : 'Stock USDT'} : ${usdt(totals?.stock_usdt || 0)}`, ML + 220, y);
    y += 10;
  }

  if (false && userRows.length > 0) {
    await ensureSpace(18);
    sectionTitle(isEn ? 'Responsibility by user' : 'Repartition par utilisateur');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(isEn ? 'USER' : 'UTILISATEUR', ML, y);
    doc.text(isEn ? 'ROLE' : 'ROLE', ML + 62, y);
    doc.text(isEn ? 'OPS' : 'OPS', ML + 98, y, { align: 'right' });
    doc.text(isEn ? 'DUE' : 'DU', ML + 137, y, { align: 'right' });
    doc.text(isEn ? 'CREDIT' : 'CREDIT', ML + 181, y, { align: 'right' });
    doc.text(isEn ? 'BALANCE' : 'SOLDE', ML + 229, y, { align: 'right' });
    y += 3;
    doc.setDrawColor(...BORDER);
    doc.line(ML, y, W - MR, y);
    y += 5;
    for (const row of userRows.slice(0, 8)) {
      await ensureSpace(8);
      const roleLabel = row.role === 'porteur'
        ? (isEn ? 'Owner' : 'Porteur')
        : row.role === 'associe'
          ? (isEn ? 'Associate' : 'Associe')
          : safeText(row.role);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...INK);
      doc.text(safeText(row.name), ML, y);
      doc.setTextColor(...MUTED);
      doc.text(roleLabel, ML + 62, y);
      doc.text(String(row.activityCount || 0), ML + 98, y, { align: 'right' });
      doc.setTextColor(...RED);
      doc.text(money(row.debt || 0), ML + 137, y, { align: 'right' });
      doc.setTextColor(...GREEN);
      doc.text(money(row.credit || 0), ML + 181, y, { align: 'right' });
      doc.setTextColor(...balanceColor(row.net || 0));
      doc.text(balanceText(row.net || 0), ML + 229, y, { align: 'right' });
      y += 6;
    }
    y += 5;
  }

  await ensureSpace(22);
  sectionTitle(isEn ? 'Chronological statement' : 'Detail chronologique');
  drawTableHeader();

  if (rows.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(isEn ? 'No transaction recorded.' : 'Aucune transaction enregistree.', ML, y + 8);
    y += 18;
  } else {
    for (let index = 0; index < rows.length; index += 1) {
      const tx = rows[index];
      await ensureSpace(9, true);
      const breakdown = getRoleBreakdownForTransaction(tx, isFourn ? 'supplier' : 'client');
      const aPayer = breakdown.totalDue;
      const paye = breakdown.totalPaid;
      const resteCourant = toNumber(tx.reste_courant ?? (aPayer - paye));
      const dateFmt = tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '-';
      const typeFmt = tx.type === 'achat'
        ? (isEn ? 'Purchase' : 'Achat')
        : tx.type === 'vente'
          ? (isEn ? 'Sale' : 'Vente')
          : (isEn ? 'Payment' : 'Paiement');
      const rowY = y;

      if (index % 2 === 0) {
        doc.setFillColor(249, 251, 255);
        doc.rect(ML, rowY - 4, W - ML - MR, 8, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(dateFmt, ML + 2, rowY);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...INK);
      doc.text(typeFmt, ML + 32, rowY);
      doc.setTextColor(isFourn ? RED[0] : BLUE[0], isFourn ? RED[1] : BLUE[1], isFourn ? RED[2] : BLUE[2]);
      doc.text(aPayer > 0 ? money(aPayer) : '-', ML + 95, rowY, { align: 'right' });
      doc.setTextColor(...GREEN);
      doc.text(paye > 0 ? money(paye) : '-', ML + 143, rowY, { align: 'right' });
      doc.setTextColor(...balanceColor(resteCourant));
      doc.text(balanceText(resteCourant), ML + 220, rowY, { align: 'right' });
      y += 8;
    }
  }

  y += 3;
  await ensureSpace(12);
  doc.setDrawColor(...BORDER);
  doc.line(ML, y, W - MR, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(isEn ? 'Totals' : 'Totaux', ML, y);
  doc.text(money(totalDue), ML + 95, y, { align: 'right' });
  doc.text(money(totalPaid), ML + 143, y, { align: 'right' });
  doc.setTextColor(...balanceColor(totalRest));
  doc.text(balanceText(totalRest), ML + 220, y, { align: 'right' });

  addFooter();
  doc.save(`GOD_WIN_CARGO_Extrait_${isFourn ? 'Fournisseur' : 'Client'}_${fileSafeName}_${dateNow.toISOString().slice(0, 10)}.pdf`);
};
// COMPOSANTS UI DE BASE
// ─────────────────────────────────────────────────────────────
const Logo = ({ dark }) => (
  <div className="flex items-center gap-2 sm:gap-3">
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-accent via-accent-light to-accent-dark flex items-center justify-center shadow-xl flex-shrink-0">
      <DollarSign className="w-5 h-5 sm:w-7 sm:h-7 text-primary" strokeWidth={2.5} />
    </div>
    <div>
      <h1 className={`text-lg sm:text-xl font-display font-bold tracking-tight ${dark ? 'text-white' : 'text-primary'}`}>FOREXIUM</h1>
      <p className="text-xs text-gray-500 tracking-widest hidden sm:block">PREMIUM EXCHANGE</p>
    </div>
  </div>
);

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, type = 'button', disabled }) => {
  const variants = {
    primary: 'gradient-gold text-primary hover:shadow-xl hover:scale-105',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
    outline: 'border-2 border-accent text-accent hover:bg-accent hover:text-primary',
    danger: 'bg-danger text-white hover:bg-red-600',
    warning: 'bg-warning/20 text-warning hover:bg-warning/30',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`px-4 sm:px-5 py-2.5 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 ${variants[variant]} ${className}`}>
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
};

const Input = ({ label, icon: Icon, error, numericOnly, dark, required, ...props }) => {
  const handleKeyDown = (e) => {
    if (numericOnly) {
      const allowed = ['Backspace','Delete','Tab','Escape','Enter','ArrowLeft','ArrowRight','.',','];
      if (!allowed.includes(e.key) && !/^\d$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    }
  };
  return (
    <div className="space-y-1.5">
      {label && (
        <label className={`block text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />}
        <input onKeyDown={handleKeyDown}
          className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-3 rounded-xl border-2 text-sm outline-none transition-all
            ${error ? 'border-red-400' : dark ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500' : 'border-gray-200 bg-white'}
            focus:border-accent focus:ring-4 focus:ring-accent/10`}
          {...props} />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
};

const Select = ({ label, options, dark, ...props }) => (
  <div className="space-y-1.5">
    {label && <label className={`block text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{label}</label>}
    <select className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-all font-medium text-sm
      ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'}
      focus:border-accent focus:ring-4 focus:ring-accent/10`} {...props}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const StatCard = ({ title, value, subtitle, icon: Icon, trend, color = 'accent', dark, badge }) => {
  const colors = {
    accent: 'from-accent/20 to-accent/5 text-accent',
    success: 'from-success/20 to-success/5 text-success',
    warning: 'from-warning/20 to-warning/5 text-warning',
    primary: dark ? 'from-white/10 to-white/5 text-white' : 'from-primary/10 to-primary/5 text-primary'
  };
  return (
    <div className={`rounded-2xl p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 ${dark ? 'bg-gray-800' : 'bg-white'}`}>
      <div className="flex justify-between items-start mb-3">
        <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
        </div>
        {badge && <span className="text-xs font-bold px-2 py-1 rounded-lg bg-accent/10 text-accent">{badge}</span>}
        {trend !== undefined && !badge && (
          <span className={`text-xs font-bold px-2 py-1 rounded-lg ${trend >= 0 ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <h3 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{title}</h3>
      <p className={`text-xl sm:text-2xl font-display font-bold mb-0.5 ${dark ? 'text-white' : 'text-primary'}`}>{value}</p>
      {subtitle && <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>}
    </div>
  );
};

// Panneau contextuel bleu — affiché dans les onglets pour donner le contexte
const ContextPanel = ({ dark, children, title, icon: Icon }) => (
  <div className={`p-4 rounded-xl border-2 ${dark ? 'bg-blue-900/20 border-blue-700/40' : 'bg-blue-50 border-blue-200'}`}>
    {title && (
      <div className="flex items-center gap-2 mb-2.5">
        {Icon && <Icon className={`w-4 h-4 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />}
        <p className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-blue-400' : 'text-blue-700'}`}>{title}</p>
      </div>
    )}
    <div className="space-y-1.5">{children}</div>
  </div>
);

// Ligne info dans un ContextPanel
const InfoRow = ({ label, value, accent, dark }) => (
  <div className="flex justify-between items-center">
    <span className={`text-xs ${dark ? 'text-blue-300/70' : 'text-blue-600'}`}>{label}</span>
    <span className={`text-xs font-bold ${accent ? 'text-accent' : dark ? 'text-white' : 'text-primary'}`}>{value}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────
// ÉCRAN DE CONNEXION
// ─────────────────────────────────────────────────────────────
const LoginScreen = ({ onLogin, onRegister, langue, setLangue, dark, setDark, t }) => {
  const [tab, setTab] = useState('login'); // 'login' | 'register'

  // ── Champs Login ──
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading]   = useState(false);

  // ── Champs Inscription ──
  const [regName, setRegName]         = useState('');
  const [regEmail, setRegEmail]       = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPassword2, setRegPassword2] = useState('');
  const [regRole, setRegRole]         = useState('');
  const [regLoading, setRegLoading]   = useState(false);
  const [slots, setSlots]             = useState({ porteur: false, associe: false }); // true = déjà pris

  // Charger les slots disponibles quand on ouvre l'onglet inscription
  React.useEffect(() => {
    if (tab === 'register') {
      apiCheckSlots().then(res => {
        setSlots({ porteur: res.porteur_taken, associe: res.associe_taken });
        // Pré-sélectionner automatiquement le rôle libre
        if (!res.porteur_taken) setRegRole('porteur');
        else if (!res.associe_taken) setRegRole('associe');
      }).catch(() => {});
    }
  }, [tab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) { toast.error(t.allFieldsRequired); return; }
    setLoginLoading(true);
    try { await onLogin(loginEmail, loginPassword); }
    finally { setLoginLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword || !regPassword2 || !regRole) {
      toast.error(t.allFieldsRequired); return;
    }
    if (regPassword !== regPassword2) {
      toast.error(langue === 'fr' ? 'Les mots de passe ne correspondent pas' : 'Passwords do not match'); return;
    }
    if (regPassword.length < 4) {
      toast.error(langue === 'fr' ? 'Mot de passe trop court (min 4 caractères)' : 'Password too short (min 4 chars)'); return;
    }
    setRegLoading(true);
    try {
      await onRegister(regName, regEmail, regPassword, regRole);
      // Après inscription réussie → basculer vers login
      setTab('login');
      setLoginEmail(regEmail);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setRegLoading(false);
    }
  };

  const inputCls = 'w-full px-5 py-3.5 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder-white/60 focus:border-accent outline-none transition-all backdrop-blur-sm text-sm';
  const bothTaken = slots.porteur && slots.associe;

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${dark ? 'bg-gray-950' : 'bg-gradient-to-br from-primary via-primary-light to-primary'}`}>
      {/* Arrière-plan décoratif */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-accent rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent-light rounded-full blur-3xl" />
      </div>

      {/* Boutons langue + thème */}
      <div className="absolute top-4 right-4 flex gap-2 z-20">
        <button onClick={() => setLangue(langue === 'fr' ? 'en' : 'fr')}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all backdrop-blur-sm">
          <Globe className="w-3.5 h-3.5" />{langue === 'fr' ? 'EN' : 'FR'}
        </button>
        <button onClick={() => setDark(!dark)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-all backdrop-blur-sm">
          {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 sm:p-10 shadow-2xl">

          {/* Logo */}
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-accent via-accent-light to-accent-dark flex items-center justify-center shadow-2xl mx-auto mb-4">
              <DollarSign className="w-10 h-10 text-primary" strokeWidth={3} />
            </div>
            <h1 className="text-4xl font-display font-bold text-white mb-1">FOREXIUM</h1>
            <p className="text-gray-300 text-sm">{t.appSubtitle}</p>
          </div>

          {/* Onglets */}
          <div className="flex gap-2 mb-6 p-1 bg-white/10 rounded-2xl">
            <button onClick={() => setTab('login')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === 'login' ? 'gradient-gold text-primary shadow-lg' : 'text-white/70 hover:text-white'
              }`}>
              {langue === 'fr' ? '🔑 Connexion' : '🔑 Login'}
            </button>
            <button onClick={() => setTab('register')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                tab === 'register' ? 'gradient-gold text-primary shadow-lg' : 'text-white/70 hover:text-white'
              }`}>
              {langue === 'fr' ? '✍️ Inscription' : '✍️ Register'}
            </button>
          </div>

          {/* ── ONGLET LOGIN ── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="email" placeholder={t.email} value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                className={inputCls} required />
              <input type="password" placeholder={t.password} value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                className={inputCls} required />
              <button type="submit" disabled={loginLoading}
                className="w-full py-3.5 rounded-xl gradient-gold text-primary font-bold hover:shadow-xl hover:scale-105 transition-all disabled:opacity-70">
                {loginLoading ? '...' : t.login}
              </button>
            </form>
          )}

          {/* ── ONGLET INSCRIPTION ── */}
          {tab === 'register' && (
            <>
              {bothTaken ? (
                /* Les 2 comptes sont déjà créés */
                <div className="text-center py-6 space-y-3">
                  <div className="text-5xl">🔒</div>
                  <p className="text-white font-bold text-lg">
                    {langue === 'fr' ? 'Inscription fermée' : 'Registration closed'}
                  </p>
                  <p className="text-white/60 text-sm">
                    {langue === 'fr'
                      ? 'Les deux comptes (Porteur & Associé) sont déjà créés. Connectez-vous.'
                      : 'Both accounts (Carrier & Associate) are already created. Please log in.'}
                  </p>
                  <button onClick={() => setTab('login')}
                    className="mt-4 px-6 py-2.5 rounded-xl gradient-gold text-primary font-bold text-sm">
                    {langue === 'fr' ? 'Aller à la connexion' : 'Go to login'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* Nom */}
                  <input type="text"
                    placeholder={langue === 'fr' ? 'Votre prénom / nom' : 'Your name'}
                    value={regName} onChange={e => setRegName(e.target.value)}
                    className={inputCls} required />

                  {/* Email */}
                  <input type="email" placeholder={t.email}
                    value={regEmail} onChange={e => setRegEmail(e.target.value)}
                    className={inputCls} required />

                  {/* Mot de passe */}
                  <input type="password"
                    placeholder={langue === 'fr' ? 'Mot de passe' : 'Password'}
                    value={regPassword} onChange={e => setRegPassword(e.target.value)}
                    className={inputCls} required />

                  {/* Confirmer mot de passe */}
                  <input type="password"
                    placeholder={langue === 'fr' ? 'Confirmer le mot de passe' : 'Confirm password'}
                    value={regPassword2} onChange={e => setRegPassword2(e.target.value)}
                    className={inputCls} required />

                  {/* Choix du rôle */}
                  <div>
                    <p className="text-white/70 text-xs font-semibold mb-2 uppercase tracking-wide">
                      {langue === 'fr' ? 'Votre rôle' : 'Your role'}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Porteur */}
                      <button type="button"
                        disabled={slots.porteur}
                        onClick={() => !slots.porteur && setRegRole('porteur')}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                          slots.porteur
                            ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5'
                            : regRole === 'porteur'
                              ? 'border-accent bg-accent/20'
                              : 'border-white/20 bg-white/5 hover:border-white/40'
                        }`}>
                        <div className="text-2xl mb-1">💼</div>
                        <div className="text-white font-bold text-sm">
                          {langue === 'fr' ? "Porteur d'affaire" : 'Business Owner'}
                        </div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {langue === 'fr' ? 'Gère les opérations' : 'Manages operations'}
                        </div>
                        {slots.porteur && (
                          <div className="absolute top-2 right-2 text-[10px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full font-bold">
                            {langue === 'fr' ? 'Pris' : 'Taken'}
                          </div>
                        )}
                        {regRole === 'porteur' && !slots.porteur && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-4 h-4 text-accent" />
                          </div>
                        )}
                      </button>

                      {/* Associé */}
                      <button type="button"
                        disabled={slots.associe}
                        onClick={() => !slots.associe && setRegRole('associe')}
                        className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                          slots.associe
                            ? 'opacity-40 cursor-not-allowed border-white/10 bg-white/5'
                            : regRole === 'associe'
                              ? 'border-accent bg-accent/20'
                              : 'border-white/20 bg-white/5 hover:border-white/40'
                        }`}>
                        <div className="text-2xl mb-1">🤝</div>
                        <div className="text-white font-bold text-sm">
                          {langue === 'fr' ? 'Associé' : 'Associate'}
                        </div>
                        <div className="text-white/50 text-xs mt-0.5">
                          {langue === 'fr' ? 'Suit les résultats' : 'Tracks results'}
                        </div>
                        {slots.associe && (
                          <div className="absolute top-2 right-2 text-[10px] bg-red-500/80 text-white px-1.5 py-0.5 rounded-full font-bold">
                            {langue === 'fr' ? 'Pris' : 'Taken'}
                          </div>
                        )}
                        {regRole === 'associe' && !slots.associe && (
                          <div className="absolute top-2 right-2">
                            <CheckCircle2 className="w-4 h-4 text-accent" />
                          </div>
                        )}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={regLoading || !regRole}
                    className="w-full py-3.5 rounded-xl gradient-gold text-primary font-bold hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                    {regLoading ? '...' : (langue === 'fr' ? "S'inscrire" : 'Register')}
                  </button>

                  <p className="text-white/40 text-xs text-center">
                    {langue === 'fr'
                      ? '⚠️ Une seule inscription par rôle est possible.'
                      : '⚠️ Only one registration per role is allowed.'}
                  </p>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL TRANSACTION — redesignée
// Vente PORTEUR : section visible + section cachée (protégée par MDP) dans le même formulaire
// Vente ASSOCIÉ : uniquement les champs visibles, pas de section cachée
// Achat: prix total → taux calculé, context panel stock+CMUP
// ─────────────────────────────────────────────────────────────
const TransactionModal = ({ data, profitShare, user, onClose, onSubmit, t, dark, langue, initialType = 'vente', fournisseurs = [], clients = [], devises = [], initialValues = null, isEdit = false }) => {
  const [type, setType] = useState(initialType);
  const [useCaisse, setUseCaisse] = useState(Boolean(initialValues?.use_caisse ?? initialValues?.useCaisse ?? false));
  const isPorteur = user?.role === 'porteur';

  // Liste devises disponibles pour la vente
  const devisesVenteOptions = devises.length > 0
    ? devises.map(d => ({ code: d.code, label: `${d.code} — ${d.nom}` }))
    : DEVISES_VENTE;

  // ── Fix 5 : pré-remplir depuis une transaction existante (mode édition) ──
  const getInitDate = () => {
    if (initialValues?.date) {
      try { return new Date(initialValues.date).toISOString().split('T')[0]; } catch {}
    }
    return new Date().toISOString().split('T')[0];
  };
  const todayStr = new Date().toISOString().split('T')[0];
  const [dateOperation, setDateOperation] = useState(getInitDate);

  // État commun — pré-rempli si mode édition
  const [form, setForm] = useState({
    devise: initialValues?.devise || 'USDT',
    quantite: initialValues?.quantite?.toString() || '',
    client: initialValues?.client || '',
    fournisseur: initialValues?.fournisseur || '',
    id_fournisseur: initialValues?.id_fournisseur?.toString() || '',
    categorie: initialValues?.categorie || CATEGORIES[0],
    description: initialValues?.description || '',
    beneficiaire: initialValues?.beneficiaire || '',
    transfertMontant: initialValues?.montant?.toString() || '',
    montantPaye: initialValues?.montant_paye?.toString() || '',
    montantAPayer: initialValues?.montant_a_payer?.toString() || '',
    devisePaiement: 'XAF',
  });

  // États formulaire nouveau client inline
  const [showNewClient, setShowNewClient] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ nom:'', prenom:'', telephone:'', ville:'', quartier:'' });
  const [savingClient, setSavingClient] = useState(false);
  const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  // ── Fix 5 : État VENTE pré-rempli si édition ──
  const [deviseVente, setDeviseVente] = useState(initialValues?.deviseVente || initialValues?.devise_vente || 'RMB');
  const [tauxConv, setTauxConv] = useState(initialValues?.tauxConversion?.toString() || '');
  const [cmupBaseInput, setCmupBaseInput] = useState(() => {
    const fallbackCmup = initialValues?.ancien_cmup ?? initialValues?.cmupUsdt ?? data?.devises?.find(d => d.devise === 'USDT')?.cmup ?? 0;
    return fallbackCmup > 0 ? fallbackCmup.toString() : '';
  });
  const [cmupOperation, setCmupOperation] = useState(() => {
    const op = String(initialValues?.cmup_operation ?? initialValues?.cmupOperation ?? '').toLowerCase();
    if (op === 'multiply' || op === 'divide') return op;
    const initialCmup = parseFloat(initialValues?.ancien_cmup ?? initialValues?.cmupUsdt ?? 0) || 0;
    const initialConv = parseFloat(initialValues?.tauxConversion ?? 0) || 0;
    const initialRate = parseFloat(initialValues?.tauxAchatXAF ?? 0) || 0;
    if (initialCmup > 0 && initialConv > 0 && initialRate > 0) {
      const multiplyDiff = Math.abs(initialRate - (initialCmup * initialConv));
      const divideDiff = Math.abs(initialRate - (initialCmup / initialConv));
      return multiplyDiff <= divideDiff ? 'multiply' : 'divide';
    }
    return 'divide';
  });
  const [tauxAchatXAFInput, setTauxAchatXAFInput] = useState(initialValues?.tauxAchatXAF?.toString() || '');
  const [tauxVisib, setTauxVisib] = useState(initialValues?.tauxVisible?.toString() || '');
  const [customShareV, setCustomShareV] = useState(Boolean(isEdit));
  const [porteurPctV, setPorteurPctV] = useState(initialValues?.porteurPct ?? profitShare.porteur);

  // ── État SECTION CACHÉE (porteur uniquement) — déverrouillage par raccourci ──
  const [hiddenUnlocked, setHiddenUnlocked] = useState(false);
  const [tauxCache, setTauxCache] = useState(
    (initialValues?.tauxCache ?? initialValues?.taux_vente_cache ?? '').toString()
  );
  // Triple-tap pour mobile
  const hiddenTapRef = React.useRef({ count: 0, timer: null });

  // Ctrl+Shift+H → toggle section cachée
  React.useEffect(() => {
    if (!isPorteur) return;
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        e.stopPropagation();
        setHiddenUnlocked(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [isPorteur]);

  const handleHiddenTap = () => {
    const ref = hiddenTapRef.current;
    ref.count += 1;
    if (ref.timer) clearTimeout(ref.timer);
    ref.timer = setTimeout(() => { ref.count = 0; }, 800);
    if (ref.count >= 3) {
      ref.count = 0;
      setHiddenUnlocked(prev => !prev);
    }
  };

  // ── État ACHAT ──
  const [tauxAchatInput, setTauxAchatInput] = useState(
    initialValues?.taux?.toString()
    || initialValues?.taux_achat_unitaire?.toString()
    || ''
  ); // taux par unité saisi

  // ── Calculs VENTE ──
  const usdtStock   = data.devises.find(d => d.devise === 'USDT');
  const cmupUsdt    = usdtStock ? usdtStock.cmup : 0;
  const stockActuel = usdtStock ? usdtStock.quantite : 0;
  const ancienneConsoEdit = isEdit && initialType === 'vente'
    ? parseFloat(initialValues?.usdtConsomme ?? initialValues?.usdt_consomme ?? 0) || 0
    : 0;
  const stockDisponibleEdition = stockActuel + ancienneConsoEdit;
  const qte         = parseFloat(form.quantite) || 0;
  const conv        = parseFloat(tauxConv) || 0;
  const cmupBase    = parseFloat(cmupBaseInput) || 0;
  const tvV         = parseThousands(tauxVisib) || 0;
  const usdtConso   = conv > 0
    ? (cmupOperation === 'multiply' ? qte * conv : qte / conv)
    : 0;
  const tauxAchatXAF = conv > 0 && cmupBase > 0
    ? (cmupOperation === 'multiply' ? cmupBase * conv : cmupBase / conv)
    : (parseFloat(tauxAchatXAFInput) || 0);
  const valAchat    = qte * tauxAchatXAF;
  const valVenteV   = qte * tvV;
  const benV        = valVenteV - valAchat;
  const pctPV       = customShareV ? porteurPctV : profitShare.porteur;
  const pctAV       = 100 - pctPV;
  const partPV      = benV * (pctPV / 100);
  const partAV      = benV * (pctAV / 100);
  const stockRestant = stockDisponibleEdition - usdtConso;

  // ── Calculs SECTION CACHÉE (porteur uniquement) ──
  const tauxC  = parseThousands(tauxCache) || 0;
  const valVenteC = qte * tauxC;
  const benC   = valVenteC - valAchat;
  const partAC = partAV;
  const partPC = benC - partAC;

  // ── Calculs ACHAT ──
  const deviseStockAchat = data.devises.find(d => d.devise === form.devise);
  const quantite   = parseFloat(form.quantite) || 0;
  const ancienneQuantiteAchat = isEdit && initialType === 'achat'
    ? parseFloat(initialValues?.quantite || 0) || 0
    : 0;
  const tauxAchat  = parseThousands(tauxAchatInput) || 0;
  const prixAchat  = quantite * tauxAchat; // auto-calculé
  const ancienStock = deviseStockAchat ? deviseStockAchat.quantite : 0;
  const ancienCMUP  = deviseStockAchat ? deviseStockAchat.cmup : 0;
  const stockAvantAchatEdition = isEdit && initialType === 'achat'
    ? parseFloat(initialValues?.stockUsdt_avant ?? initialValues?.stock_usdt_avant ?? 0) || 0
    : ancienStock;
  const cmupAvantAchatEdition = isEdit && initialType === 'achat'
    ? parseFloat(initialValues?.ancien_cmup ?? initialValues?.ancienCmup ?? ancienCMUP) || ancienCMUP
    : ancienCMUP;
  const nouveauCMUP = quantite > 0 && tauxAchat > 0
    ? calculerCMUP(stockAvantAchatEdition, cmupAvantAchatEdition, quantite, tauxAchat)
    : ancienCMUP;
  const stockApresAchatEdition = ancienStock - ancienneQuantiteAchat + quantite;

  // Liaison bidirectionnelle tauxConv ↔ tauxAchatXAF
  const handleTauxConvChange = (val) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTauxConv(clean);
    const v = parseFloat(clean);
    if (v > 0 && cmupBase > 0) {
      setTauxAchatXAFInput(
        cmupOperation === 'multiply'
          ? (cmupBase * v).toFixed(6)
          : (cmupBase / v).toFixed(6)
      );
    } else {
      setTauxAchatXAFInput('');
    }
  };

  const handleTauxAchatChange = (val) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTauxAchatXAFInput(clean);
    const v = parseFloat(clean);
    if (v > 0 && cmupBase > 0) {
      setTauxConv(
        cmupOperation === 'multiply'
          ? (v / cmupBase).toFixed(6)
          : (cmupBase / v).toFixed(6)
      );
    } else {
      setTauxConv('');
    }
  };

  React.useEffect(() => {
    const convValue = parseFloat(tauxConv) || 0;
    const cmupValue = parseFloat(cmupBaseInput) || 0;
    if (convValue > 0 && cmupValue > 0) {
      setTauxAchatXAFInput(
        cmupOperation === 'multiply'
          ? (cmupValue * convValue).toFixed(6)
          : (cmupValue / convValue).toFixed(6)
      );
    }
  }, [cmupBaseInput, cmupOperation, tauxConv]);

  const handleSubmit = (e) => {
    e.preventDefault();

    // RESTOCK
    if (type === 'restock') {
      const m = parseFloat(form.transfertMontant) || 0;
      if (!m || m <= 0) { toast.error(t.allFieldsRequired); return; }
      onSubmit({ type: 'restock', montant: m, date: dateOperation }); return;
    }

    // VENTE → porteur: soumis comme committed avec données cachées si section déverrouillée
    //         associé: soumis comme pending (sans données cachées)
    if (type === 'vente') {
      if (!form.client.trim()) { toast.error(t.clientRequired); return; }
      if (!form.id_fournisseur || !form.fournisseur.trim()) { toast.error(t.supplierRequired); return; }
      if (!qte || !conv || !tvV) { toast.error(t.allFieldsRequired); return; }
      if (usdtConso > stockDisponibleEdition) { toast.error(t.insufficientStock + ' (USDT)'); return; }

      const montantPayeNum = form.montantPaye
        ? parseFloat(form.montantPaye.replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0
        : null;

      const basePayload = {
        type: 'vente',
        devise: 'USDT',
        deviseVente,
        quantite: usdtConso,
        quantiteDevise: qte,
        tauxConversion: conv,
        tauxAchatXAF,
        ancien_cmup: cmupBase,
        cmup_operation: cmupOperation,
        tauxVisible: tvV,
        montant: valVenteV,
        valeurAchat: valAchat,
        valeurVenteVisible: valVenteV,
        beneficeVisible: benV,
        profit: benV,
        partPorteur: partPV,
        partAssocie: partAV,
        porteurPct: pctPV,
        associePct: pctAV,
        usdtConsomme: usdtConso,
        client: form.client,
        fournisseur: form.fournisseur,
        idFournisseur: parseInt(form.id_fournisseur),
        montant_paye: montantPayeNum,
        date: dateOperation,
      };

      // Statut 'pending' : enregistré mais modifiable — Valider = verrouiller uniquement
      const payload = { ...basePayload, statut: 'pending' };
      if (isPorteur && hiddenUnlocked && tauxC > 0) {
        Object.assign(payload, {
          tauxCache: tauxC,
          valeurVenteCachee: valVenteC,
          beneficeCachee: benC,
          partPorteurCache: partPC,
          partAssocieCache: partAC,
        });
      }
      onSubmit(payload);
      return;
    }

    // ACHAT
    if (type === 'achat') {
      if (!form.id_fournisseur || !form.fournisseur.trim()) { toast.error(t.supplierRequired); return; }
      if (!quantite || !tauxAchat) { toast.error(t.allFieldsRequired); return; }
      const oldAchatCaisse = isEdit && initialType === 'achat' && Boolean(initialValues?.use_caisse ?? initialValues?.useCaisse)
        ? parseThousands(initialValues?.montant || 0)
        : 0;
      const caisseDisponibleAchat = data.caisse + oldAchatCaisse;
      if (useCaisse && prixAchat > caisseDisponibleAchat) { toast.error(t.insufficientCaisse); return; }
      onSubmit({
        type: 'achat',
        statut: 'pending',
        devise: form.devise,
        quantite,
        taux: tauxAchat,
        montant: prixAchat,
        fournisseur: form.fournisseur,
        idFournisseur: parseInt(form.id_fournisseur, 10),
        sourceCompte: useCaisse ? 'caisse' : 'depot',
        profit: null, partPorteur: null, partAssocie: null,
        date: dateOperation,
      }); return;
    }

    // DÉPENSE
    if (type === 'depense') {
      const montant = parseThousands(form.quantite) || 0;
      if (!montant) { toast.error(t.allFieldsRequired); return; }
      const ancienneValeur = isEdit && initialType === 'depense' ? parseThousands(initialValues?.montant || 0) : 0;
      if (montant > data.caisse + ancienneValeur) { toast.error(t.insufficientCaisse); return; }
      onSubmit({
        type: 'depense', statut: 'committed',
        montant, taux: montant, quantite: 1,
        categorie: form.categorie, description: form.description,
        profit: null, partPorteur: null, partAssocie: null,
        date: dateOperation,
      }); return;
    }

    // RETRAIT
    if (type === 'retrait') {
      const montant = parseThousands(form.quantite) || 0;
      if (!montant) { toast.error(t.allFieldsRequired); return; }
      const ancienneValeur = isEdit && initialType === 'retrait' ? parseThousands(initialValues?.montant || 0) : 0;
      if (montant > data.caisse + ancienneValeur) { toast.error(t.insufficientCaisse); return; }
      onSubmit({
        type: 'retrait', statut: 'committed',
        montant, taux: montant, quantite: 1,
        beneficiaire: form.beneficiaire, description: form.description,
        profit: null, partPorteur: null, partAssocie: null,
        date: dateOperation,
      }); return;
    }

    // ── PAIEMENT CLIENT ──────────────────────────────────────
    if (type === 'paiement_client') {
      if (!form.client) { toast.error(t.clientRequired); return; }
      const clientObj = clients.find(c => c.nom === form.client || [c.nom, c.prenom].filter(Boolean).join(' ') === form.client);
      const paiementActuel = isEdit && initialType === 'paiement_client'
        ? parseThousands(initialValues?.montant_paye || 0)
        : 0;
      const mAPayer = getRemainingBalance(clientObj?.total_a_payer, clientObj?.total_paye) + paiementActuel;
      const mPaye = parseFloat((form.montantPaye||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0;
      if (!mPaye) { toast.error(t.amountRequired); return; }
      onSubmit({
        type: 'paiement_client',
        id_client: clientObj?.id,
        client: form.client,
        montant_a_payer: mAPayer,
        montant_paye: mPaye,
        date: dateOperation,
      }); return;
    }

    // ── PAIEMENT FOURNISSEUR ─────────────────────────────────
    if (type === 'paiement_fournisseur') {
      if (!form.id_fournisseur) { toast.error(t.supplierRequired); return; }
      const fournObj = fournisseurs.find(f => String(f.id) === String(form.id_fournisseur));
      const paiementActuel = isEdit && initialType === 'paiement_fournisseur'
        ? parseThousands(initialValues?.montant_paye || 0)
        : 0;
      const mAPayer = getRemainingBalance(fournObj?.total_a_payer, fournObj?.total_paye) + paiementActuel;
      const mPaye = parseFloat((form.montantPaye||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0;
      if (!mPaye) { toast.error(t.amountRequired); return; }
      onSubmit({
        type: 'paiement_fournisseur',
        id_fournisseur: parseInt(form.id_fournisseur),
        montant_a_payer: mAPayer,
        montant_paye: mPaye,
        devise: form.devisePaiement || 'XAF',
        date: dateOperation,
      }); return;
    }
  };

  const bg = dark ? 'bg-gray-900 text-white' : 'bg-white';
  const tabs = [
    { id: 'vente',               label: t.sale,                                 icon: ArrowUpRight },
    { id: 'achat',               label: t.purchase,                             icon: ArrowDownLeft },
    { id: 'depense',             label: t.expense,                              icon: FileText },
    { id: 'retrait',             label: t.withdrawal,                           icon: DollarSign },
    { id: 'restock',             label: t.restock,                              icon: RefreshCw },
    { id: 'paiement_client',     label: t.paymentClient,                        icon: Users },
    { id: 'paiement_fournisseur',label: t.paymentSupplier,                      icon: Store },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${bg} rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl`}>
        <div className="flex justify-between items-center mb-5">
          <h2 className={`text-xl font-display font-bold ${dark ? 'text-white' : 'text-primary'}`}>{t.newTransaction}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        {/* Onglets */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setType(id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-semibold transition-all whitespace-nowrap text-xs
                ${type === id ? 'gradient-gold text-primary shadow-lg' : dark ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── DATE DE L'OPÉRATION ─────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10,
            background: dark ? 'rgba(255,200,50,0.08)' : 'rgba(255,160,0,0.07)',
            border: `1px solid ${dark ? 'rgba(255,200,50,0.25)' : 'rgba(255,160,0,0.3)'}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark?'#fbbf24':'#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <label style={{ fontSize:12, fontWeight:600, color: dark?'#fbbf24':'#d97706', flex:1 }}>
              {t.operationDate}
              <span style={{ fontWeight:400, fontSize:11, marginLeft:6, color: dark?'#9ca3af':'#9ca3af' }}>
                {t.operationDateHint}
              </span>
            </label>
            <input type="date" value={dateOperation} max={new Date().toISOString().split('T')[0]}
              onChange={e => setDateOperation(e.target.value)}
              style={{ fontSize:13, fontWeight:600, border:'none', background:'transparent',
                color: dark?'#fbbf24':'#d97706', outline:'none', cursor:'pointer' }} />
          </div>

          {/* ── RESTOCK ─────────────────────── */}
          {type === 'restock' && (
            <div className="space-y-4">
              <ContextPanel dark={dark} title={t.currentBalances} icon={Info}>
                <InfoRow dark={dark} label={t.currentCaisse} value={`${data.caisse.toLocaleString('fr-FR')} XAF`} accent />
                <InfoRow dark={dark} label={t.depot} value={`${data.depot.toLocaleString('fr-FR')} XAF`} />
              </ContextPanel>
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.amountToCreditCash}
                </label>
                <input type="text" inputMode="numeric"
                  value={form.transfertMontant}
                  onChange={e => setForm({ ...form, transfertMontant: e.target.value.replace(/[^0-9]/g, '') })}
                  placeholder="Ex : 500 000"
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500' : 'border-gray-200 bg-white'} focus:border-accent`}
                  required />
                {form.transfertMontant && (
                  <div className={`mt-2 flex justify-between text-xs px-2 ${dark?'text-gray-400':'text-gray-500'}`}>
                    <span>{t.cashAfterDeposit} :</span>
                    <span className="font-bold text-accent">
                      {(data.caisse + (parseInt(form.transfertMontant)||0)).toLocaleString('fr-FR')} XAF
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════
              ── VENTE USDT → RMB / USD ──────────────────────────
              ══════════════════════════════════════════════════════ */}
          {type === 'vente' && (
            <>
              {/* Context panel USDT — toujours visible */}
              <ContextPanel dark={dark} title={t.usdtStockTitle} icon={Warehouse}>
                <InfoRow dark={dark} label={t.stockCourant} value={`${stockActuel.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT`} accent />
                <InfoRow dark={dark} label="CMUP" value={`${cmupUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF/USDT`} />
                <InfoRow dark={dark} label={t.totalStockValue}
                  value={`${(stockActuel * cmupUsdt).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} XAF`} />
              </ContextPanel>

              {/* 1. Devise de vente — badge + dropdown */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{t.deviseVente}</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-shrink-0 px-4 py-3 rounded-xl font-bold text-sm border-2 border-accent bg-accent/10 text-accent min-w-[72px] text-center">
                    {deviseVente}
                  </div>
                  <select value={deviseVente} onChange={e => setDeviseVente(e.target.value)}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}>
                    {devisesVenteOptions.map(dv => (
                      <option key={dv.code} value={dv.code}>{dv.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. Taux de conversion ↔ Taux achat XAF (bidirectionnel) */}
              <div className={`p-4 rounded-xl border-2 space-y-3 ${dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {t.linkedRates}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-3">
                  <div className="space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                          CMUP (XAF/USDT)
                        </label>
                        <input type="text" inputMode="decimal"
                          placeholder={`Ex: ${cmupUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}`}
                          value={cmupBaseInput}
                          onChange={e => setCmupBaseInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className={`w-full px-3 py-2 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                      </div>
                      <select
                        value={cmupOperation}
                        onChange={e => setCmupOperation(e.target.value === 'multiply' ? 'multiply' : 'divide')}
                        className={`w-16 px-2 py-2 rounded-xl border-2 text-sm font-bold outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}>
                        <option value="divide">÷</option>
                        <option value="multiply">×</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.tauxConversion} ({deviseVente}/USDT)
                      </label>
                      <input type="text" inputMode="decimal"
                        placeholder={deviseVente === 'RMB' ? 'Ex: 6.94' : 'Ex: 1.08'}
                        value={tauxConv}
                        onChange={e => handleTauxConvChange(e.target.value)}
                        className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {t.tauxAchatCalc} (XAF/{deviseVente})
                    </label>
                    <input type="text" inputMode="decimal"
                      placeholder={t.autoCalculated}
                      value={tauxAchatXAFInput}
                      onChange={e => handleTauxAchatChange(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-accent/50 bg-gray-700 text-accent' : 'border-accent/30 bg-accent/5 text-accent font-semibold'} focus:border-accent`} />
                  </div>
                </div>
              </div>

              {/* 3. Quantité + Taux vente visible */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.quantity} ({deviseVente})
                  </label>
                  <input type="text" inputMode="numeric"
                    value={form.quantite}
                    onChange={e => setForm({ ...form, quantite: e.target.value.replace(/[^0-9.]/g, '') })}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}
                    required />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.tauxVenteVisible} (XAF/{deviseVente})
                  </label>
                  <input type="text" inputMode="numeric"
                    value={tauxVisib}
                    onChange={handleDecInput(setTauxVisib)}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}
                    required />
                </div>
              </div>

              {/* 4. Client — dropdown + création rapide */}
              <div className={`rounded-2xl border-2 overflow-hidden ${dark?'border-gray-700':'border-gray-100'}`}>
                <div className={`px-4 py-3 flex items-center border-b ${dark?'bg-gray-700/60 border-gray-600':'bg-white border-gray-100'}`}>
                  <span className={`text-xs font-bold uppercase tracking-wider ${dark?'text-gray-300':'text-gray-500'}`}>
                    👤 Client <span className="text-red-400 ml-1">*</span>
                  </span>
                </div>
                  <div className="p-3">
                    <select value={form.client} onChange={e=>setForm({...form,client:e.target.value})}
                      className={`w-full px-4 py-3 rounded-xl border text-sm outline-none ${dark?'border-gray-600 bg-gray-700 text-white':'border-gray-200 bg-white'} focus:border-accent`}>
                      <option value="">{t.selectClient}</option>
                      {clients.map(c=>(
                        <option key={c.id} value={[c.nom,c.prenom].filter(Boolean).join(' ')}>
                          {c.nom}{c.prenom?` ${c.prenom}`:''}{c.numero?` · #${c.numero}`:''}{c.ville?` · ${c.ville}`:''}
                        </option>
                      ))}
                    </select>
                    {form.client&&<div className="flex items-center gap-2 mt-2 px-1"><div className="w-2 h-2 rounded-full bg-accent"/><span className={`text-xs font-semibold ${dark?'text-gray-300':'text-gray-600'}`}>{form.client}</span></div>}
                  </div>
              </div>

              {/* 4b. Fournisseur obligatoire */}
              <div className="space-y-1.5">
                <label className={`block text-sm font-semibold ${dark?'text-gray-300':'text-gray-700'}`}>
                  🏭 {t.viaSupplier} <span className={`text-xs font-normal ml-1 ${dark?'text-gray-500':'text-gray-400'}`}>({t.obligatoire})</span> <span className="text-red-500">*</span>
                </label>
                <select value={form.id_fournisseur}
                  onChange={e=>setForm({...form,id_fournisseur:e.target.value,fournisseur:e.target.options[e.target.selectedIndex]?.text||''})}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none ${dark?'border-gray-600 bg-gray-800 text-white':'border-gray-200 bg-white'} focus:border-accent`}>
                  <option value="">{t.chooseSupplier}</option>
                  {fournisseurs.filter(f => !isPrincipalSupplier(f)).map(f=>(
                    <option key={f.id} value={f.id}>{f.nom}{f.prenom?` ${f.prenom}`:''}{f.ville?` (${f.ville})`:''}{f.numero?` · #${f.numero}`:''}</option>
                  ))}
                </select>
              </div>

              {/* 5. PAIEMENT — montant reçu unique */}
              {(() => {
                const montantVente = valVenteV || 0;
                const montantRecu = parseFloat((form.montantPaye||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0;
                const reste = montantVente - montantRecu;
                const status = !form.montantPaye ? null
                  : montantRecu <= 0 ? 'unpaid'
                  : montantRecu > montantVente ? 'overpaid'
                  : montantRecu < montantVente ? 'partial'
                  : 'paid';
                const statusCfg = {
                  paid:    {label:t.statusPaid,    color:'#10B981',bg:'#10B98118',border:'border-emerald-500'},
                  partial: {label:t.statusPartial, color:'#D97706',bg:'#F59E0B18',border:'border-amber-500'},
                  overpaid:{label:t.statusOverpaid,color:'#7C3AED',bg:'#7C3AED18',border:'border-violet-500'},
                  unpaid:  {label:t.statusUnpaid,  color:'#EF4444',bg:'#EF444418',border:'border-red-500'},
                };
                const cfg = status ? statusCfg[status] : null;
                return (
                  <div className={`rounded-2xl border-2 overflow-hidden transition-all ${cfg?cfg.border:(dark?'border-gray-700':'border-gray-200')}`}>
                    <div className={`px-4 py-3 border-b flex items-center justify-between ${dark?'border-gray-700 bg-gray-800/40':'border-gray-100 bg-gray-50'}`}>
                      <span className={`text-xs font-bold uppercase tracking-wider ${dark?'text-gray-300':'text-gray-500'}`}>💳 {t.paymentReceived}</span>
                      {cfg&&<span className="text-xs font-bold px-3 py-1 rounded-full" style={{color:cfg.color,background:cfg.bg}}>{cfg.label}</span>}
                    </div>
                    <div className="p-4 space-y-3">
                      {montantVente>0&&(
                        <div className={`flex items-center justify-between px-3 py-2 rounded-xl ${dark?'bg-gray-700/50':'bg-gray-100'}`}>
                          <span className={`text-xs font-semibold ${dark?'text-gray-400':'text-gray-500'}`}>{t.saleAmountLabel}</span>
                          <span className={`text-sm font-bold ${dark?'text-white':'text-gray-800'}`}>{Math.round(montantVente).toLocaleString('fr-FR')} XAF</span>
                        </div>
                      )}
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${dark?'text-gray-400':'text-gray-500'}`}>
                          {t.amountReceivedOptional}
                        </label>
                        <div className={`flex items-center border-2 rounded-xl overflow-hidden ${cfg?cfg.border:(dark?'border-gray-600':'border-gray-200')} ${dark?'bg-gray-800':'bg-white'}`}>
                          <input type="text" inputMode="numeric" value={form.montantPaye||''}
                            onChange={e=>{
                              const raw=e.target.value.replace(/[^0-9]/g,'');
                              setForm({...form,montantPaye:raw?parseInt(raw).toLocaleString('fr-FR'):''});
                            }}
                            placeholder="0"
                            className={`flex-1 px-4 py-3 text-right text-base font-bold bg-transparent outline-none ${dark?'text-white':'text-gray-800'}`}/>
                          <span className={`px-4 text-sm font-bold flex-shrink-0 ${dark?'text-gray-400':'text-gray-500'}`}>XAF</span>
                        </div>
                      </div>
                      {form.montantPaye&&montantVente>0&&(
                        <div className={`flex items-center justify-between px-3 py-2 rounded-xl`} style={{background:cfg?.bg||'transparent'}}>
                          <span className="text-xs font-semibold" style={{color:cfg?.color}}>
                            {reste>0?t.remainingToCollect:reste<0?t.surplusCredit:t.transactionSettled}
                          </span>
                          {reste!==0&&<span className="text-sm font-bold" style={{color:cfg?.color}}>{Math.abs(Math.round(reste)).toLocaleString('fr-FR')} XAF</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* 5. Répartition visible */}
              <div className={`rounded-xl border-2 p-4 ${dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-sm font-bold ${dark ? 'text-white' : 'text-primary'}`}>{t.repartitionVisible}</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t.customShare}</span>
                    <div onClick={() => setCustomShareV(!customShareV)} className={`w-10 h-5 rounded-full transition-all cursor-pointer relative ${customShareV ? 'bg-accent' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: customShareV ? '22px' : '2px' }} />
                    </div>
                  </label>
                </div>
                {customShareV ? (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={dark ? 'text-gray-300' : 'text-gray-600'}>{t.partner}</span>
                      <span className="font-bold text-accent">{porteurPctV}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={porteurPctV} onChange={e => setPorteurPctV(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-accent" />
                    <div className="flex justify-between text-xs mt-1">
                      <span className={dark ? 'text-gray-300' : 'text-gray-600'}>{t.associate}</span>
                      <span className={`font-bold ${dark ? 'text-white' : 'text-primary'}`}>{100 - porteurPctV}%</span>
                    </div>
                  </div>
                ) : (
                  <div className={`flex justify-between text-xs px-2 py-1.5 rounded-lg ${dark ? 'bg-gray-700' : 'bg-white'}`}>
                    <span>{t.partner} : <strong className="text-accent">{profitShare.porteur}%</strong></span>
                    <span>{t.associate} : <strong>{profitShare.associe}%</strong></span>
                  </div>
                )}
              </div>

              {/* 6. Calculs automatiques — partie VISIBLE */}
              {qte > 0 && conv > 0 && tvV > 0 && (
                <div className={`rounded-xl p-4 border-2 ${dark ? 'bg-gray-800 border-accent/30' : 'bg-accent/5 border-accent/20'}`}>
                  <h4 className={`font-bold text-sm flex items-center gap-2 mb-3 ${dark ? 'text-white' : 'text-primary'}`}>
                    <BarChart3 className="w-4 h-4" />{t.autoCalc}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-dashed border-accent/20">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.stockUsdtConsomme}</span>
                      <span className="font-bold text-orange-500">{usdtConso.toFixed(6)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.valeurAchatXAF}</span>
                      <span className="font-semibold">{valAchat.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.valeurVenteVisible}</span>
                      <span className="font-semibold text-accent">{valVenteV.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-dashed border-gray-200 pt-1 mt-1">
                      <span>{t.beneficeVisible}</span>
                      <span className={benV >= 0 ? 'text-green-500' : 'text-red-500'}>{benV.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.partner} ({pctPV}%)</span>
                      <span className="text-accent font-semibold">{partPV.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.associate} ({pctAV}%)</span>
                      <span className="font-semibold">{partAV.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF</span>
                    </div>
                    <div className={`flex justify-between font-bold pt-2 border-t mt-1 ${dark ? 'border-gray-600' : 'border-accent/20'}`}>
                      <span>{t.stockAfterSale}</span>
                      <span className={stockRestant < 0 ? 'text-red-500' : 'text-success'}>
                        {stockRestant.toFixed(4)} USDT
                      </span>
                    </div>

                    {/* ── Calcul de référence (porteur + déverrouillé) ── */}
                    {isPorteur && hiddenUnlocked && tauxC > 0 && (
                      <div className={`mt-2 pt-2 border-t border-dashed ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                        <p className={`text-[10px] font-medium mb-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {t.referenceCalculation}
                        </p>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{t.referenceRate}</span>
                          <span className={`font-semibold text-xs ${dark?'text-gray-300':'text-gray-600'}`}>{tauxC.toLocaleString('fr-FR')} XAF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{t.referenceProfit}</span>
                          <span className={`font-semibold text-xs ${benC >= 0 ? 'text-green-500' : 'text-red-500'}`}>{benC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{t.partner}</span>
                          <span className={`font-semibold text-xs ${dark?'text-gray-300':'text-gray-600'}`}>{partPC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Zone secrète — invisible tant que verrouillée, active par Ctrl+Shift+H ou 3 taps */}
              {isPorteur && (
                <div>
                  {/* Tap zone invisible permanente */}
                  {!hiddenUnlocked && (
                    <div
                      className="w-full h-0 overflow-hidden cursor-default"
                      onTouchEnd={handleHiddenTap}
                      onDoubleClick={handleHiddenTap}
                    />
                  )}
                  {/* Contenu déverrouillé */}
                  {hiddenUnlocked && (
                    <div className={`rounded-xl overflow-hidden ${dark ? 'border border-white/[0.05]' : 'border border-gray-100'}`}>
                      <div className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none ${dark ? 'bg-white/[0.02]' : 'bg-gray-50'}`}
                        onTouchEnd={handleHiddenTap} onDoubleClick={handleHiddenTap}>
                        <span className={`text-[10px] font-semibold tracking-widest uppercase ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                          {t.referenceCalculation}
                        </span>
                        <button type="button" onClick={() => { setHiddenUnlocked(false); setTauxCache(''); }}
                          className={`text-[10px] font-medium ${dark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}>
                          {t.collapse}
                        </button>
                      </div>
                      <div className={`px-3 pb-3 pt-2 space-y-3 ${dark ? 'bg-transparent' : 'bg-white'}`}>
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {`${t.referenceRate} (XAF/${deviseVente})`}
                          </label>
                          <input type="text" inputMode="numeric"
                            placeholder="0"
                            value={tauxCache}
                            onChange={handleDecInput(setTauxCache)}
                            className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all ${dark ? 'border-white/[0.08] bg-white/[0.03] text-white placeholder-white/20' : 'border-gray-200 bg-white'} focus:border-gray-300`} />
                        </div>
                        <div className={`rounded-lg p-2.5 ${dark ? 'bg-white/[0.02] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                          <div className="flex justify-between text-[10px]">
                            <span className={dark?'text-gray-500':'text-gray-400'}>{t.partner} {partPC.toLocaleString('fr-FR')} XAF</span>
                            <span className={dark?'text-gray-500':'text-gray-400'}>{t.associate} {partAC.toLocaleString('fr-FR')} XAF</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Note associé — transaction enregistrée immédiatement */}
              {!isPorteur && (
                <div className={`flex items-center gap-2 p-3 rounded-xl ${dark ? 'bg-success/10 border border-success/30' : 'bg-green-50 border border-green-200'}`}>
                  <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${dark ? 'text-success' : 'text-green-600'}`} />
                  <p className={`text-xs ${dark ? 'text-green-300' : 'text-green-700'}`}>
                    {t.saleRecordedAfterSubmit}
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── ACHAT ───────────────────────── */}
          {type === 'achat' && (
            <>
              {/* Context panel stock courant */}
              <ContextPanel dark={dark} title={t.infoAchat} icon={Info}>
                {DEVISES.map(d => {
                  const s = data.devises.find(ds => ds.devise === d);
                  return s ? (
                    <div key={d}>
                      <InfoRow dark={dark} label={`${d} — ${t.stockCourant}`} value={`${s.quantite.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} ${d}`} accent />
                      <InfoRow dark={dark} label={t.currentCmup} value={`${s.cmup.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF/${d}`} />
                    </div>
                  ) : (
                    <InfoRow key={d} dark={dark} label={d} value={t.newStock} />
                  );
                })}
              </ContextPanel>

              <Select label={t.purchasedCurrency} dark={dark}
                options={DEVISES.map(d => ({ value: d, label: d }))}
                value={form.devise} onChange={e => setForm({ ...form, devise: e.target.value })} />

              {/* Quantité + Taux d'achat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.quantity} ({form.devise}) <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    placeholder="Ex: 1000"
                    value={form.quantite}
                    onChange={e => setForm({ ...form, quantite: e.target.value.replace(/[^0-9.]/g, '') })}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.purchaseRateXaf} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    placeholder="Ex: 650"
                    value={tauxAchatInput}
                    onChange={handleDecInput(setTauxAchatInput)}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                </div>
              </div>

              {/* Taux calculé automatiquement + nouveau CMUP */}
              {quantite > 0 && tauxAchat > 0 && (
                <div className={`p-3 rounded-xl space-y-1.5 ${dark ? 'bg-gray-700' : 'bg-accent/5'}`}>
                  <div className="flex justify-between text-xs">
                    <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.totalXafAuto}</span>
                    <span className="font-bold text-accent">{prixAchat.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.nouveauCMUP}</span>
                    <span className={`font-bold ${dark ? 'text-white' : 'text-primary'}`}>{nouveauCMUP.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF/{form.devise}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold border-t pt-1.5">
                    <span>{t.totalCost}</span>
                    <span className={dark ? 'text-white' : 'text-primary'}>{prixAchat.toLocaleString('fr-FR')} XAF</span>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={`block text-sm font-semibold mb-1.5 ${dark?'text-gray-300':'text-gray-700'}`}>
                  {t.supplier} <span className="text-red-500">*</span>
                </label>
                <select value={form.id_fournisseur}
                  onChange={e=>setForm({...form,id_fournisseur:e.target.value,fournisseur:e.target.options[e.target.selectedIndex]?.text||''})}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none ${dark?'border-gray-600 bg-gray-800 text-white':'border-gray-200 bg-white'} focus:border-accent`}>
                  <option value="">{t.chooseSupplier}</option>
                  {fournisseurs.filter(isPrincipalSupplier).map(f=>(
                    <option key={f.id} value={f.id}>{f.nom}{f.prenom?` ${f.prenom}`:''}{f.ville?` (${f.ville})`:''}{f.numero?` · #${f.numero}`:''}</option>
                  ))}
                </select>
              </div>

              {/* Source : Caisse ou Dépôt */}
              <div className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all ${useCaisse ? 'border-accent bg-accent/5' : dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div>
                  <p className={`text-sm font-semibold ${dark ? 'text-white' : 'text-primary'}`}>
                    {t.debitFromCash}
                  </p>
                  <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {t.availableCash} <strong>{data.caisse.toLocaleString('fr-FR')} XAF</strong>
                  </p>
                </div>
                <div onClick={() => setUseCaisse(!useCaisse)}
                  className={`w-11 h-6 rounded-full transition-all cursor-pointer relative flex-shrink-0 ${useCaisse ? 'bg-accent' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                  <div className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: useCaisse ? '23px' : '4px' }} />
                </div>
              </div>

              {/* Warning si caisse insuffisante */}
              {useCaisse && prixAchat > data.caisse && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                  <p className="text-xs text-danger font-semibold">{t.insufficientCaisse}</p>
                </div>
              )}
            </>
          )}

          {/* ── DÉPENSE ─────────────────────── */}
          {type === 'depense' && (
            <>
              <ContextPanel dark={dark} title={t.infoCaisse} icon={Info}>
                <InfoRow dark={dark} label={t.soldeDisponible} value={`${data.caisse.toLocaleString('fr-FR')} XAF`} accent />
              </ContextPanel>
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.amount} <span className="text-red-500">*</span>
                </label>
                <input type="text" inputMode="numeric"
                  value={form.quantite}
                  onChange={e => { const r=e.target.value.replace(/[\s\u00A0]/g,'').replace(/[^0-9]/g,''); setForm({...form, quantite: r===''?'':fmtThousands(r)}); }}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
              </div>
              <Select label={t.category} dark={dark} options={CATEGORIES.map(c => ({ value: c, label: c }))}
                value={form.categorie} onChange={e => setForm({ ...form, categorie: e.target.value })} />
              <Input label={t.description} dark={dark}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              {parseThousands(form.quantite) > data.caisse && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                  <p className="text-xs text-danger font-semibold">{t.insufficientCaisse}</p>
                </div>
              )}
            </>
          )}

          {/* ── RETRAIT ─────────────────────── */}
          {type === 'retrait' && (
            <>
              <ContextPanel dark={dark} title={t.infoCaisse} icon={Info}>
                <InfoRow dark={dark} label={t.soldeDisponible} value={`${data.caisse.toLocaleString('fr-FR')} XAF`} accent />
              </ContextPanel>
              <div>
                <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.amount} <span className="text-red-500">*</span>
                </label>
                <input type="text" inputMode="numeric"
                  value={form.quantite}
                  onChange={e => { const r=e.target.value.replace(/[\s\u00A0]/g,'').replace(/[^0-9]/g,''); setForm({...form, quantite: r===''?'':fmtThousands(r)}); }}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
              </div>
              <Input label={t.beneficiary} dark={dark}
                value={form.beneficiaire} onChange={e => setForm({ ...form, beneficiaire: e.target.value })} required />
              <Input label={t.reason} dark={dark}
                value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              {parseThousands(form.quantite) > data.caisse && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                  <AlertTriangle className="w-4 h-4 text-danger flex-shrink-0" />
                  <p className="text-xs text-danger font-semibold">{t.insufficientCaisse}</p>
                </div>
              )}
            </>
          )}

          {/* ── PAIEMENT CLIENT ─────────────────────── */}
          {type === 'paiement_client' && (() => {
            const mPaye       = parseFloat((form.montantPaye||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0;
            // Récupérer les infos du client sélectionné depuis la liste
            const clientObj   = clients.find(c => c.nom === form.client || [c.nom, c.prenom].filter(Boolean).join(' ') === form.client);
            const detteAPayer = parseFloat(clientObj?.total_a_payer||0);
            const dettePaye   = parseFloat(clientObj?.total_paye||0);
            const detteReste  = getSignedBalance(detteAPayer, dettePaye);
            const apresP      = detteReste - mPaye;
            return (
              <div className="space-y-4">
                {/* Sélection client */}
                <div className={`rounded-2xl border-2 overflow-hidden ${dark?'border-gray-700':'border-gray-200'}`}>
                  <div className={`px-4 py-3 border-b flex items-center ${dark?'bg-gray-700/60 border-gray-600':'bg-gray-50 border-gray-100'}`}>
                    <span className={`text-xs font-bold uppercase tracking-wider ${dark?'text-gray-300':'text-gray-500'}`}>👤 {t.client.replace(' *', '')} <span className="text-red-400 ml-1">*</span></span>
                  </div>
                  <div className="p-3">
                    <select value={form.client} onChange={e=>setForm({...form,client:e.target.value})}
                      className={`w-full px-4 py-3 rounded-xl border text-sm outline-none ${dark?'border-gray-600 bg-gray-700 text-white':'border-gray-200 bg-white'} focus:border-accent`}>
                      <option value="">{t.selectClient}</option>
                      {clients.map(c=>(
                        <option key={c.id} value={c.nom}>{c.nom}{c.prenom?` ${c.prenom}`:''}{c.numero?` · #${c.numero}`:''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ✅ Fix 2 : Récap dette client si sélectionné */}
                {clientObj && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[
                      {lbl:t.totalSalesLabel,  val:detteAPayer, color:'#0EA5E9'},
                      {lbl:t.alreadyReceived,  val:dettePaye,   color:'#22C55E'},
                      {lbl:t.balanceDue,       val:detteReste,  color:getBalanceColor(detteReste)},
                    ].map(r=>(
                      <div key={r.lbl} className={`rounded-xl p-3 ${dark?'bg-gray-800':'bg-gray-50'}`}>
                        <div style={{fontSize:8,fontWeight:700,color:'#9CA3AF',marginBottom:4,letterSpacing:0.4}}>{r.lbl}</div>
                        <div style={{fontSize:12,fontWeight:800,color:r.color}}>
                          {r.lbl === t.balanceDue ? formatBalanceText(r.val, langue) : (r.val > 0 ? `${Math.round(r.val).toLocaleString('fr-FR')} XAF` : '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Montant reçu (1 seul champ) */}
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark?'text-gray-300':'text-gray-700'}`}>
                    {t.amountReceivedClient} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={form.montantPaye||''}
                    onChange={e=>{ const r=e.target.value.replace(/[^0-9]/g,''); setForm({...form,montantPaye:r===''?'':parseInt(r).toLocaleString('fr-FR'),montantAPayer:r===''?'':r}); }}
                    placeholder={clientObj ? formatBalanceText(detteReste, langue) : '0'}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all font-bold ${dark?'border-gray-600 bg-gray-800 text-white':'border-gray-200 bg-white'} focus:border-accent`}/>
                </div>

                {/* Récap résultat */}
                {mPaye > 0 && (
                  <div className={`px-4 py-3 rounded-xl border ${dark?'bg-gray-800 border-gray-700':'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${dark?'text-gray-400':'text-gray-500'}`}>
                        {t.afterPayment}
                      </span>
                      <span className="text-sm font-bold" style={{ color: getBalanceColor(apresP) }}>
                        {formatBalanceText(apresP, langue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── PAIEMENT FOURNISSEUR ─────────────────────── */}
          {type === 'paiement_fournisseur' && (() => {
            const mPaye     = parseFloat((form.montantPaye||'').replace(/\s/g,'').replace(',','.').replace(/[^0-9.]/g,''))||0;
            // Récupérer les infos du fournisseur sélectionné
            const fournObj  = fournisseurs.find(f => String(f.id) === String(form.id_fournisseur));
            const detteAPayer = parseFloat(fournObj?.total_a_payer||0);
            const dettePaye   = parseFloat(fournObj?.total_paye||0);
            const detteReste  = getSignedBalance(detteAPayer, dettePaye);
            const apresP      = detteReste - mPaye;
            return (
              <div className="space-y-4">
                {/* Sélection fournisseur */}
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark?'text-gray-300':'text-gray-700'}`}>
                    🏭 {t.supplier} <span className="text-red-500">*</span>
                  </label>
                  <select value={form.id_fournisseur}
                    onChange={e=>setForm({...form,id_fournisseur:e.target.value,fournisseur:e.target.options[e.target.selectedIndex]?.text||'',montantPaye:''})}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none ${dark?'border-gray-600 bg-gray-800 text-white':'border-gray-200 bg-white'} focus:border-accent`}>
                    <option value="">{t.selectSupplier}</option>
                    {fournisseurs.map(f=>(
                      <option key={f.id} value={f.id}>{f.nom}{f.prenom?` ${f.prenom}`:''}{f.ville?` (${f.ville})`:''}</option>
                    ))}
                  </select>
                </div>

                {/* ✅ Fix 2+6 : Récap dette fournisseur si sélectionné */}
                {fournObj && (
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    {[
                      {lbl:t.amountDue,    val:detteAPayer, color:'#EF4444'},
                      {lbl:t.alreadyPaid,  val:dettePaye,   color:'#22C55E'},
                      {lbl:t.balanceLabel, val:detteReste,  color:getBalanceColor(detteReste)},
                    ].map(r=>(
                      <div key={r.lbl} className={`rounded-xl p-3 ${dark?'bg-gray-800':'bg-gray-50'}`}>
                        <div style={{fontSize:8,fontWeight:700,color:'#9CA3AF',marginBottom:4,letterSpacing:0.4}}>{r.lbl}</div>
                        <div style={{fontSize:12,fontWeight:800,color:r.color}}>
                          {r.lbl === t.balanceLabel ? formatBalanceText(r.val, langue) : (r.val > 0 ? `${Math.round(r.val).toLocaleString('fr-FR')} XAF` : '—')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ✅ Fix 6 : 1 seul champ — montant payé maintenant */}
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark?'text-gray-300':'text-gray-700'}`}>
                    {t.amountPaidSupplier} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={form.montantPaye||''}
                    onChange={e=>{ const r=e.target.value.replace(/[^0-9]/g,''); setForm({...form,montantPaye:r===''?'':parseInt(r).toLocaleString('fr-FR'),montantAPayer:r===''?'':r}); }}
                    placeholder={fournObj ? formatBalanceText(detteReste, langue) : '0'}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all font-bold ${dark?'border-gray-600 bg-gray-800 text-white':'border-gray-200 bg-white'} focus:border-accent`}
                    autoFocus={!!fournObj}/>
                </div>

                {/* Récap résultat */}
                {mPaye > 0 && fournObj && (
                  <div className={`px-4 py-3 rounded-xl border ${dark?'bg-gray-800 border-gray-700':'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${dark?'text-gray-400':'text-gray-500'}`}>
                        {t.afterPayment}
                      </span>
                      <span className="text-sm font-bold" style={{color:getBalanceColor(apresP)}}>
                        {formatBalanceText(apresP, langue)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t.cancel}</Button>
            <Button type="submit" className="flex-1">{t.save}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL FINALISATION — porteur finalise une vente pending
// Protégé par mot de passe, ajoute les données cachées
// ─────────────────────────────────────────────────────────────
const FinalisationModal = ({ transaction, profitShare, onClose, onFinalize, t, dark, langue }) => {
  const [unlocked, setUnlocked] = useState(false);
  const [tauxCache, setTauxCache] = useState('');
  const finTapRef = React.useRef({ count: 0, timer: null });

  React.useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'H') { e.preventDefault(); setUnlocked(prev => !prev); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleFinTap = () => {
    const ref = finTapRef.current;
    ref.count += 1;
    if (ref.timer) clearTimeout(ref.timer);
    ref.timer = setTimeout(() => { ref.count = 0; }, 800);
    if (ref.count >= 3) { ref.count = 0; setUnlocked(prev => !prev); }
  };

  const qteDevise = transaction.quantiteDevise || 0;
  const tauxC = parseFloat(tauxCache) || 0;
  const valVenteC = qteDevise * tauxC;
  const benC = valVenteC - (transaction.valeurAchat || 0);
  const partAC = transaction.partAssocie ?? transaction.part_associe_visible ?? benC * profitShare.associe / 100;
  const partPC = benC - partAC;

  const handleFinalize = (e) => {
    e.preventDefault();
    if (!tauxC) { toast.error(t.allFieldsRequired); return; }
    onFinalize(transaction.id, { tauxCache: tauxC });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${dark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full sm:max-w-lg max-h-[95vh] overflow-y-auto shadow-2xl`}>
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className={`text-lg font-display font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-primary'}`}>
              <Lock className="w-5 h-5 text-amber-500" />{t.finaliserVente}
            </h2>
            <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t.finaliserDesc}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Résumé de la transaction */}
        <ContextPanel dark={dark} title="Résumé vente" icon={Info}>
          <InfoRow dark={dark} label="Client" value={transaction.client || '-'} />
          <InfoRow dark={dark} label={`Quantité (${transaction.deviseVente})`} value={`${transaction.quantiteDevise?.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} ${transaction.deviseVente}`} />
          <InfoRow dark={dark} label="USDT consommé" value={`${transaction.usdtConsomme?.toFixed(6)} USDT`} />
          <InfoRow dark={dark} label="Valeur achat" value={`${transaction.valeurAchat?.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF`} />
          <InfoRow dark={dark} label="Taux visible" value={`${transaction.tauxVisible} XAF/${transaction.deviseVente}`} />
          <InfoRow dark={dark} label="Bénéfice visible" value={`${transaction.beneficeVisible?.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF`} accent />
        </ContextPanel>

        {/* Zone secrète déverrouillage — invisible quand verrouillée */}
        {!unlocked ? (
          <div
            className="mt-2 h-3 cursor-pointer select-none rounded"
            style={{ opacity: 0 }}
            onTouchEnd={handleFinTap}
            onDoubleClick={handleFinTap}
          />
        ) : (
          <form onSubmit={handleFinalize} className="mt-4 space-y-4">
            <div className={`rounded-xl overflow-hidden ${dark ? 'border border-white/[0.05]' : 'border border-gray-100'}`}>
              <div className={`px-3 py-2 ${dark ? 'bg-white/[0.02]' : 'bg-gray-50'}`}>
                <span className={`text-[10px] font-semibold tracking-widest uppercase ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                  {langue === 'fr' ? 'Taux de référence' : 'Reference rate'}
                </span>
              </div>
              <div className={`px-3 pb-3 pt-2 space-y-3 ${dark ? '' : 'bg-white'}`}>
                <div>
                  <label className={`block text-xs font-medium mb-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {langue === 'fr' ? `XAF / ${transaction.deviseVente}` : `XAF / ${transaction.deviseVente}`}
                  </label>
                  <input type="text" inputMode="numeric"
                    placeholder="0"
                    value={tauxCache}
                    onChange={handleDecInput(setTauxCache)}
                    className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all ${dark ? 'border-white/[0.08] bg-white/[0.03] text-white' : 'border-gray-200 bg-white'} focus:border-gray-300`} />
                </div>

                {tauxC > 0 && (
                  <div className={`p-2.5 rounded-lg text-xs space-y-1 ${dark ? 'bg-white/[0.02] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{langue==='fr'?'Bénéfice réf.':'Ref. profit'}</span>
                      <span className={`font-semibold ${benC >= 0 ? 'text-green-500' : 'text-red-500'}`}>{benC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{t.partner}</span>
                      <span className={`font-medium ${dark?'text-gray-300':'text-gray-600'}`}>{partPC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                  </div>
                )}

                {/* Répartition cachée */}
                <div className={`rounded-xl p-3 ${dark ? 'bg-gray-700' : 'bg-amber-100/50'}`}>
                  <div className="space-y-2">
                    <span className={`block text-xs font-bold ${dark ? 'text-white' : 'text-gray-700'}`}>{t.repartitionCachee}</span>
                    <div className={`flex justify-between text-xs px-2 py-1 rounded-lg ${dark ? 'bg-gray-600' : 'bg-white/70'}`}>
                      <span>{t.partner} : <strong className="text-accent">{partPC.toLocaleString('fr-FR')} XAF</strong></span>
                      <span>{t.associate} : <strong>{partAC.toLocaleString('fr-FR')} XAF</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t.cancel}</Button>
              <Button type="submit" className="flex-1">{t.finaliserVente}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL ÉDITION — interface identique à la saisie originale selon le type
// ─────────────────────────────────────────────────────────────
const EditModal = ({ transaction, data, allTransactions, onClose, onEdit, t, dark, langue }) => {
  const isPorteur = true; // EditModal n'est accessible qu'au porteur

  // ── Date de l'opération (modifiable) ──
  const getDateStr = (tx) => {
    try { return new Date(tx.date).toISOString().split('T')[0]; } catch { return new Date().toISOString().split('T')[0]; }
  };
  const [dateOperation, setDateOperation] = useState(getDateStr(transaction));

  // ── État VENTE ──
  const [deviseVente, setDeviseVente] = useState(transaction.deviseVente || 'RMB');
  const [tauxConv, setTauxConv] = useState(transaction.tauxConversion?.toString() || '');
  const [cmupBaseInput, setCmupBaseInput] = useState(() => {
    const fallbackCmup = transaction.ancien_cmup ?? transaction.cmup_usdt ?? transaction.cmupUsdt ?? data?.devises?.find(d => d.devise === 'USDT')?.cmup ?? 0;
    return fallbackCmup > 0 ? fallbackCmup.toString() : '';
  });
  const [cmupOperation, setCmupOperation] = useState(() => {
    const op = String(transaction.cmup_operation ?? transaction.cmupOperation ?? '').toLowerCase();
    if (op === 'multiply' || op === 'divide') return op;
    const initialCmup = parseFloat(transaction.ancien_cmup ?? transaction.cmup_usdt ?? transaction.cmupUsdt ?? 0) || 0;
    const initialConv = parseFloat(transaction.tauxConversion ?? transaction.taux_conversion ?? 0) || 0;
    const initialRate = parseFloat(transaction.tauxAchatXAF ?? transaction.taux_achat_xaf ?? 0) || 0;
    if (initialCmup > 0 && initialConv > 0 && initialRate > 0) {
      const multiplyDiff = Math.abs(initialRate - (initialCmup * initialConv));
      const divideDiff = Math.abs(initialRate - (initialCmup / initialConv));
      return multiplyDiff <= divideDiff ? 'multiply' : 'divide';
    }
    return 'divide';
  });
  const [tauxAchatXAFInput, setTauxAchatXAFInput] = useState(
    transaction.tauxAchatXAF?.toString() || ''
  );
  const [tauxVisib, setTauxVisib] = useState(transaction.tauxVisible?.toString() || '');
  const [quantiteDeviseEdit, setQuantiteDeviseEdit] = useState(transaction.quantiteDevise?.toString() || '');
  const [clientVal, setClientVal] = useState(transaction.client || '');
  const [customShareV, setCustomShareV] = useState(false);
  const [porteurPctV, setPorteurPctV] = useState(transaction.porteurPct ?? 70);

  // ── Section cachée (porteur) ──
  const [hiddenUnlocked, setHiddenUnlocked] = useState(false);
  const [tauxCache, setTauxCache] = useState(transaction.tauxCache?.toString() || '');
  const hiddenTapRef = React.useRef({ count: 0, timer: null });

  React.useEffect(() => {
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        e.stopPropagation();
        setHiddenUnlocked(prev => !prev);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  const handleHiddenTap = () => {
    const ref = hiddenTapRef.current;
    ref.count += 1;
    if (ref.timer) clearTimeout(ref.timer);
    ref.timer = setTimeout(() => { ref.count = 0; }, 800);
    if (ref.count >= 3) { ref.count = 0; setHiddenUnlocked(prev => !prev); }
  };

  // ── État ACHAT ──
  const [quantiteAchat, setQuantiteAchat] = useState(transaction.quantite?.toString() || '');
  const [tauxAchatInput, setTauxAchatInput] = useState(transaction.taux?.toString() || '');

  // ── État DÉPENSE / RETRAIT ──
  const [montantEdit, setMontantEdit] = useState(transaction.montant?.toString() || '');
  const [descriptionEdit, setDescriptionEdit] = useState(transaction.description || '');
  const [beneficiaireEdit, setBeneficiaireEdit] = useState(transaction.beneficiaire || '');
  const [fournisseurEdit, setFournisseurEdit] = useState(transaction.fournisseur || '');

  // ── Calculs VENTE ──
  const usdtStock = data.devises.find(d => d.devise === 'USDT');
  const cmupUsdt  = usdtStock ? usdtStock.cmup : 0;
  const stockActuel = usdtStock ? usdtStock.quantite : 0;
  const qte  = parseFloat(quantiteDeviseEdit || transaction.quantiteDevise || 0);
  const conv = parseFloat(tauxConv) || 0;
  const cmupBase = parseFloat(cmupBaseInput) || 0;
  const tvV  = parseFloat(tauxVisib) || 0;
  const usdtConso  = conv > 0
    ? (cmupOperation === 'multiply' ? qte * conv : qte / conv)
    : 0;
  const tauxAchatXAF = conv > 0 && cmupBase > 0
    ? (cmupOperation === 'multiply' ? cmupBase * conv : cmupBase / conv)
    : (parseFloat(tauxAchatXAFInput) || 0);
  const valAchat   = qte * tauxAchatXAF;
  const valVenteV  = qte * tvV;
  const benV       = valVenteV - valAchat;
  const pctPV      = customShareV ? porteurPctV : (transaction.porteurPct ?? 70);
  const pctAV      = 100 - pctPV;
  const partPV     = benV * (pctPV / 100);
  const partAV     = benV * (pctAV / 100);

  // ── Calculs SECTION CACHÉE ──
  const tauxC     = parseFloat(tauxCache) || 0;
  const valVenteC = qte * tauxC;
  const benC      = valVenteC - valAchat;
  const partAC    = transaction.partAssocie ?? transaction.part_associe_visible ?? benC * (transaction.associePct ?? 30) / 100;
  const partPC    = benC - partAC;

  // ── Calculs ACHAT ──
  const qteAchat  = parseFloat(quantiteAchat) || 0;
  const tauxAchat = parseFloat(tauxAchatInput) || 0;
  const prixAchat = qteAchat * tauxAchat;

  // ── Liaison bidirectionnelle taux conv ↔ taux achat XAF ──
  const handleTauxConvChange = (val) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTauxConv(clean);
    const v = parseFloat(clean);
    if (v > 0 && cmupBase > 0) setTauxAchatXAFInput(cmupOperation === 'multiply' ? (cmupBase * v).toFixed(6) : (cmupBase / v).toFixed(6));
    else setTauxAchatXAFInput('');
  };
  const handleTauxAchatChange = (val) => {
    const clean = val.replace(/[^0-9.]/g, '');
    setTauxAchatXAFInput(clean);
    const v = parseFloat(clean);
    if (v > 0 && cmupBase > 0) setTauxConv(cmupOperation === 'multiply' ? (v / cmupBase).toFixed(6) : (cmupBase / v).toFixed(6));
    else setTauxConv('');
  };

  React.useEffect(() => {
    const convValue = parseFloat(tauxConv) || 0;
    const cmupValue = parseFloat(cmupBaseInput) || 0;
    if (convValue > 0 && cmupValue > 0) {
      setTauxAchatXAFInput(
        cmupOperation === 'multiply'
          ? (cmupValue * convValue).toFixed(6)
          : (cmupValue / convValue).toFixed(6)
      );
    }
  }, [cmupBaseInput, cmupOperation, tauxConv]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const changes = { dateModification: new Date(), date: dateOperation };

    if (transaction.type === 'vente') {
      if (!clientVal.trim()) {
        toast.error(t.clientRequired);
        return;
      }
      if (!fournisseurEdit.trim()) {
        toast.error(t.supplierRequired);
        return;
      }
      const newQteDevise = qte;
      const newConv = conv;
      const newUsdtConso = newConv > 0
        ? (cmupOperation === 'multiply' ? newQteDevise * newConv : newQteDevise / newConv)
        : transaction.usdtConsomme;
      const newDelta = -newUsdtConso;
      const sim = simulerChaineStock(allTransactions, transaction.id, newDelta);
      if (!sim.valid) {
        toast.error(`${t.stockNegatif} ${format(new Date(sim.failDate), 'dd/MM/yyyy HH:mm')} (${sim.failStock?.toFixed(4)} USDT)`);
        return;
      }
      changes.quantiteDevise  = newQteDevise;
      changes.tauxConversion  = newConv;
      changes.tauxAchatXAF    = tauxAchatXAF;
      changes.ancien_cmup     = cmupBase;
      changes.cmup_operation  = cmupOperation;
      changes.usdtConsomme    = newUsdtConso;
      changes.quantite        = newUsdtConso;
      changes.client          = clientVal;
      changes.tauxVisible     = tvV;
      changes.deviseVente     = deviseVente;
      changes.valeurAchat     = valAchat;
      changes.valeurVenteVisible = valVenteV;
      changes.beneficeVisible = benV;
      changes.partPorteur     = partPV;
      changes.partAssocie     = partAV;
      changes.porteurPct      = pctPV;
      changes.associePct      = pctAV;
      // Données cachées si déverrouillées
      if (hiddenUnlocked && tauxC > 0) {
        changes.tauxCache           = tauxC;
        changes.valeurVenteCachee   = valVenteC;
        changes.beneficeCachee      = benC;
        changes.partPorteurCache    = partPC;
        changes.partAssocieCache    = partAC;
        changes.statut              = 'committed';
      }
    } else if (transaction.type === 'achat' && transaction.devise === 'USDT') {
      const newDelta = qteAchat;
      const sim = simulerChaineStock(allTransactions, transaction.id, newDelta);
      if (!sim.valid) {
        toast.error(`${t.stockNegatif} ${format(new Date(sim.failDate), 'dd/MM/yyyy HH:mm')}`);
        return;
      }
      changes.montant     = prixAchat;
      changes.quantite    = qteAchat;
      changes.taux        = tauxAchat;
      changes.fournisseur = fournisseurEdit;
    } else {
      const newMontant = parseFloat(montantEdit) || transaction.montant;
      if (newMontant > data.caisse + transaction.montant) {
        toast.error(t.insufficientCaisse); return;
      }
      changes.montant      = newMontant;
      changes.taux         = newMontant;
      changes.description  = descriptionEdit;
      changes.beneficiaire = beneficiaireEdit;
      changes.fournisseur  = fournisseurEdit;
    }

    onEdit(transaction.id, changes);
    onClose();
  };

  const bg = dark ? 'bg-gray-900 text-white' : 'bg-white';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${bg} rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto shadow-2xl`}>

        {/* Header */}
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className={`text-xl font-display font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-primary'}`}>
              <Edit2 className="w-5 h-5 text-accent" />
              {langue === 'fr' ? 'Modifier la transaction' : 'Edit transaction'}
            </h2>
            <p className={`text-xs mt-0.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
              <span className={`font-semibold uppercase px-1.5 py-0.5 rounded mr-1 ${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>{transaction.type}</span>
              {transaction.id} · {langue === 'fr' ? 'Enregistré le' : 'Recorded on'} {format(new Date(transaction.date), 'dd/MM/yyyy HH:mm')}
              {transaction.dateModification && (
                <span className={`ml-2 ${dark ? 'text-amber-400' : 'text-amber-600'}`}>
                  · {langue === 'fr' ? 'Modifié le' : 'Modified on'} {format(new Date(transaction.dateModification), 'dd/MM/yyyy HH:mm')}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* ── DATE DE L'OPÉRATION ─────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:10,
            background: dark ? 'rgba(255,200,50,0.08)' : 'rgba(255,160,0,0.07)',
            border: `1px solid ${dark ? 'rgba(255,200,50,0.25)' : 'rgba(255,160,0,0.3)'}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={dark?'#fbbf24':'#d97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <label style={{ fontSize:12, fontWeight:600, color: dark?'#fbbf24':'#d97706', flex:1 }}>
              {langue==='fr' ? "Date de l'opération" : "Operation date"}
            </label>
            <input type="date" value={dateOperation}
              onChange={e => setDateOperation(e.target.value)}
              style={{ fontSize:13, fontWeight:600, border:'none', background:'transparent',
                color: dark?'#fbbf24':'#d97706', outline:'none', cursor:'pointer' }} />
          </div>

          {/* ══ VENTE ══ */}
          {transaction.type === 'vente' && (
            <>
              {/* Context USDT */}
              <ContextPanel dark={dark} title={t.usdtStockTitle} icon={Warehouse}>
                <InfoRow dark={dark} label={t.stockCourant} value={`${stockActuel.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT`} accent />
                <InfoRow dark={dark} label="CMUP" value={`${cmupUsdt.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF/USDT`} />
              </ContextPanel>

              {/* Note modification */}
              <div className={`p-3 rounded-xl border ${dark ? 'bg-blue-900/20 border-blue-700/30' : 'bg-blue-50 border-blue-200'}`}>
                <p className={`text-xs ${dark ? 'text-blue-400' : 'text-blue-700'}`}>
                  ⚠️ {langue === 'fr' ? 'Modifier les quantités recalcule la chaîne de stock.' : 'Editing quantities recalculates the stock chain.'}
                </p>
              </div>

              {/* Devise de vente */}
              <div>
                <label className={`block text-sm font-semibold mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{t.deviseVente}</label>
                <div className="flex gap-3">
                  {DEVISES_VENTE.map(dv => (
                    <button key={dv.code} type="button" onClick={() => setDeviseVente(dv.code)}
                      className={`flex-1 py-3 rounded-xl font-bold text-sm border-2 transition-all ${
                        deviseVente === dv.code
                          ? 'border-accent bg-accent/10 text-accent'
                          : dark ? 'border-gray-600 bg-gray-800 text-gray-300' : 'border-gray-200 bg-gray-50 text-gray-600'
                      }`}>
                      {dv.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Taux conv ↔ Taux achat XAF */}
              <div className={`p-4 rounded-xl border-2 space-y-3 ${dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wide ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                  {langue === 'fr' ? 'Taux — modifier l\'un recalcule l\'autre' : 'Rates — editing one recalculates the other'}
                </p>
                <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-3">
                  <div className="space-y-3">
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                          CMUP (XAF/USDT)
                        </label>
                        <input type="text" inputMode="decimal"
                          value={cmupBaseInput}
                          onChange={e => setCmupBaseInput(e.target.value.replace(/[^0-9.]/g, ''))}
                          className={`w-full px-3 py-2 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                      </div>
                      <select
                        value={cmupOperation}
                        onChange={e => setCmupOperation(e.target.value === 'multiply' ? 'multiply' : 'divide')}
                        className={`w-16 px-2 py-2 rounded-xl border-2 text-sm font-bold outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}>
                        <option value="divide">÷</option>
                        <option value="multiply">×</option>
                      </select>
                    </div>
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {t.tauxConversion} ({deviseVente}/USDT)
                      </label>
                      <input type="text" inputMode="decimal"
                        value={tauxConv} onChange={e => handleTauxConvChange(e.target.value)}
                        className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-700 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                    </div>
                  </div>
                  <div>
                    <label className={`block text-xs font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-600'}`}>
                      {t.tauxAchatCalc} (XAF/{deviseVente})
                    </label>
                    <input type="text" inputMode="decimal"
                      value={tauxAchatXAFInput} onChange={e => handleTauxAchatChange(e.target.value)}
                      className={`w-full px-3 py-2.5 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-accent/50 bg-gray-700 text-accent' : 'border-accent/30 bg-accent/5 text-accent font-semibold'} focus:border-accent`} />
                  </div>
                </div>
              </div>

              {/* Quantité + Taux vente visible */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.quantity} ({deviseVente}) <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={quantiteDeviseEdit}
                    onChange={e => setQuantiteDeviseEdit(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}
                    required />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.tauxVenteVisible} (XAF/{deviseVente}) <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={tauxVisib} onChange={e => setTauxVisib(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`}
                    required />
                </div>
              </div>

              {/* Client */}
              <div className="space-y-1.5">
                <label className={`block text-sm font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.client} <span className="text-red-500 ml-1 text-xs">({t.obligatoire})</span>
                </label>
                <input type="text" value={clientVal}
                  onChange={e => setClientVal(e.target.value)}
                  placeholder={t.clientPlaceholder}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white placeholder-gray-500' : 'border-gray-200 bg-white'} focus:border-accent`} />
              </div>

              {/* Répartition visible */}
              <div className={`rounded-xl border-2 p-4 ${dark ? 'bg-gray-800 border-gray-600' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h4 className={`text-sm font-bold ${dark ? 'text-white' : 'text-primary'}`}>{t.repartitionVisible}</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{t.customShare}</span>
                    <div onClick={() => setCustomShareV(!customShareV)} className={`w-10 h-5 rounded-full transition-all cursor-pointer relative ${customShareV ? 'bg-accent' : dark ? 'bg-gray-600' : 'bg-gray-300'}`}>
                      <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all" style={{ left: customShareV ? '22px' : '2px' }} />
                    </div>
                  </label>
                </div>
                {customShareV ? (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={dark ? 'text-gray-300' : 'text-gray-600'}>{t.partner}</span>
                      <span className="font-bold text-accent">{porteurPctV}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={porteurPctV} onChange={e => setPorteurPctV(parseInt(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-accent" />
                    <div className="flex justify-between text-xs mt-1">
                      <span className={dark ? 'text-gray-300' : 'text-gray-600'}>{t.associate}</span>
                      <span className={`font-bold ${dark ? 'text-white' : 'text-primary'}`}>{100 - porteurPctV}%</span>
                    </div>
                  </div>
                ) : (
                  <div className={`flex justify-between text-xs px-2 py-1.5 rounded-lg ${dark ? 'bg-gray-700' : 'bg-white'}`}>
                    <span>{t.partner} : <strong className="text-accent">{transaction.porteurPct ?? 70}%</strong></span>
                    <span>{t.associate} : <strong>{100 - (transaction.porteurPct ?? 70)}%</strong></span>
                  </div>
                )}
              </div>

              {/* Calculs automatiques */}
              {conv > 0 && tvV > 0 && (
                <div className={`rounded-xl p-4 border-2 ${dark ? 'bg-gray-800 border-accent/30' : 'bg-accent/5 border-accent/20'}`}>
                  <h4 className={`font-bold text-sm flex items-center gap-2 mb-3 ${dark ? 'text-white' : 'text-primary'}`}>
                    <BarChart3 className="w-4 h-4" />{t.autoCalc}
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between pb-2 border-b border-dashed border-accent/20">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.stockUsdtConsomme}</span>
                      <span className="font-bold text-orange-500">{usdtConso.toFixed(6)} USDT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.valeurAchatXAF}</span>
                      <span className="font-semibold">{valAchat.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{t.valeurVenteVisible}</span>
                      <span className="font-semibold text-accent">{valVenteV.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-dashed border-gray-200 pt-1 mt-1">
                      <span>{t.beneficeVisible}</span>
                      <span className={benV >= 0 ? 'text-green-500' : 'text-red-500'}>{benV.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.partner} ({pctPV}%)</span>
                      <span className="text-accent font-semibold">{partPV.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">{t.associate} ({pctAV}%)</span>
                      <span className="font-semibold">{partAV.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                    </div>
                    {hiddenUnlocked && tauxC > 0 && (
                      <div className={`mt-2 pt-2 border-t border-dashed ${dark ? 'border-white/[0.06]' : 'border-gray-200'}`}>
                        <p className={`text-[10px] font-medium mb-1.5 ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
                          {langue === 'fr' ? 'Calcul de référence' : 'Reference calculation'}
                        </p>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{langue==='fr'?'Taux réf.':'Ref. rate'}</span>
                          <span className={`font-semibold text-xs ${dark?'text-gray-300':'text-gray-600'}`}>{tauxC.toLocaleString('fr-FR')} XAF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{langue==='fr'?'Bénéfice réf.':'Ref. profit'}</span>
                          <span className={`font-semibold text-xs ${benC >= 0 ? 'text-green-500' : 'text-red-500'}`}>{benC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                        </div>
                        <div className="flex justify-between">
                          <span className={dark ? 'text-gray-500' : 'text-gray-400'}>{t.partner}</span>
                          <span className={`font-semibold text-xs ${dark?'text-gray-300':'text-gray-600'}`}>{partPC.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Section cachée porteur — zone secrète invisible quand verrouillée */}
              <div>
                {!hiddenUnlocked && (
                  <div className="w-full h-0 overflow-hidden cursor-default"
                    onTouchEnd={handleHiddenTap} onDoubleClick={handleHiddenTap} />
                )}
                {hiddenUnlocked && (
                  <div className={`rounded-xl overflow-hidden ${dark ? 'border border-white/[0.05]' : 'border border-gray-100'}`}>
                    <div className={`flex items-center justify-between px-3 py-2 cursor-pointer select-none ${dark ? 'bg-white/[0.02]' : 'bg-gray-50'}`}
                      onTouchEnd={handleHiddenTap} onDoubleClick={handleHiddenTap}>
                      <span className={`text-[10px] font-semibold tracking-widest uppercase ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                        {langue === 'fr' ? 'Taux de référence' : 'Reference rate'}
                      </span>
                      <button type="button" onClick={() => setHiddenUnlocked(false)}
                        className={`text-[10px] font-medium ${dark ? 'text-gray-600 hover:text-gray-400' : 'text-gray-400 hover:text-gray-600'}`}>
                        {langue === 'fr' ? 'réduire' : 'collapse'}
                      </button>
                    </div>
                    <div className={`px-3 pb-3 pt-2 space-y-3 ${dark ? 'bg-transparent' : 'bg-white'}`}>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {langue === 'fr' ? `XAF / ${deviseVente}` : `XAF / ${deviseVente}`}
                        </label>
                        <input type="text" inputMode="numeric"
                          placeholder="0"
                          value={tauxCache}
                          onChange={handleDecInput(setTauxCache)}
                          className={`w-full px-3 py-2.5 rounded-lg border text-sm outline-none transition-all ${dark ? 'border-white/[0.08] bg-white/[0.03] text-white placeholder-white/20' : 'border-gray-200 bg-white'} focus:border-gray-300`} />
                      </div>
                      <div className={`rounded-lg p-2.5 ${dark ? 'bg-white/[0.02] border border-white/[0.05]' : 'bg-gray-50 border border-gray-100'}`}>
                        <div className="flex justify-between text-[10px]">
                          <span className={dark?'text-gray-500':'text-gray-400'}>{t.partner} {partPC.toLocaleString('fr-FR')} XAF</span>
                          <span className={dark?'text-gray-500':'text-gray-400'}>{t.associate} {partAC.toLocaleString('fr-FR')} XAF</span>
                        </div>
                      </div>
                      {tauxC > 0 && (
                        <div className={`p-2 rounded-lg text-[10px] font-medium ${dark ? 'bg-green-900/20 text-green-400' : 'bg-green-50 text-green-700'}`}>
                          ✓ {langue === 'fr' ? 'Enregistrement définitif à la sauvegarde' : 'Will commit on save'}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ ACHAT ══ */}
          {transaction.type === 'achat' && (
            <>
              <ContextPanel dark={dark} title={t.infoAchat} icon={Info}>
                <InfoRow dark={dark} label={`${transaction.devise} — ${t.stockCourant}`}
                  value={`${(data.devises.find(d=>d.devise===transaction.devise)?.quantite||0).toLocaleString('fr-FR',{maximumFractionDigits:6})} ${transaction.devise}`} accent />
                <InfoRow dark={dark} label={t.currentCmup}
                  value={`${(data.devises.find(d=>d.devise===transaction.devise)?.cmup||0).toLocaleString('fr-FR',{maximumFractionDigits:6})} XAF/${transaction.devise}`} />
              </ContextPanel>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t.quantity} ({transaction.devise}) <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={quantiteAchat}
                    onChange={e => setQuantiteAchat(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                </div>
                <div>
                  <label className={`block text-sm font-semibold mb-1.5 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {langue === 'fr' ? "Taux d'achat (XAF)" : 'Purchase Rate (XAF)'} <span className="text-red-500">*</span>
                  </label>
                  <input type="text" inputMode="numeric"
                    value={tauxAchatInput}
                    onChange={e => setTauxAchatInput(e.target.value.replace(/[^0-9.]/g, ''))}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm outline-none transition-all ${dark ? 'border-gray-600 bg-gray-800 text-white' : 'border-gray-200 bg-white'} focus:border-accent`} />
                </div>
              </div>

              {qteAchat > 0 && tauxAchat > 0 && (
                <div className={`p-3 rounded-xl space-y-1.5 ${dark ? 'bg-gray-700' : 'bg-accent/5'}`}>
                  <div className="flex justify-between text-xs">
                    <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{langue === 'fr' ? 'Montant total XAF' : 'Total XAF'}</span>
                    <span className="font-bold text-accent">{prixAchat.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                  </div>
                </div>
              )}

              <Input label={`${t.supplier} *`} dark={dark}
                value={fournisseurEdit} onChange={e => setFournisseurEdit(e.target.value)} />
            </>
          )}

          {/* ══ DÉPENSE / RETRAIT ══ */}
          {(transaction.type === 'depense' || transaction.type === 'retrait') && (
            <>
              <ContextPanel dark={dark} title={t.infoCaisse} icon={Info}>
                <InfoRow dark={dark} label={t.currentCaisse} value={`${data.caisse.toLocaleString('fr-FR')} XAF`} accent />
              </ContextPanel>

              <Input label={t.amount} dark={dark}
                value={montantEdit} onChange={e => setMontantEdit(e.target.value)} />
              {transaction.type === 'retrait' && (
                <Input label={t.beneficiary} dark={dark}
                  value={beneficiaireEdit} onChange={e => setBeneficiaireEdit(e.target.value)} />
              )}
              <Input label={t.description} dark={dark}
                value={descriptionEdit} onChange={e => setDescriptionEdit(e.target.value)} />
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">{t.cancel}</Button>
            <Button type="submit" className="flex-1">{t.save}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL JOURNAL
// ─────────────────────────────────────────────────────────────
const JournalModal = ({ logs, onClose, t, dark }) => {
  const [filterType, setFilterType] = useState('tous');
  const [filterDate, setFilterDate] = useState('');
  const logTypes = Object.keys(t.logTypes);
  const filtered = [...logs].reverse().filter(log => {
    const matchType = filterType === 'tous' || log.typeEvenement === filterType;
    const matchDate = !filterDate || format(log.dateHeure, 'yyyy-MM-dd') === filterDate;
    return matchType && matchDate;
  });
  const iconByType = {
    connexion: <CheckCircle2 className="w-3.5 h-3.5" />, deconnexion: <LogOut className="w-3.5 h-3.5" />,
    connexion_echouee: <XCircle className="w-3.5 h-3.5" />, vente: <ArrowUpRight className="w-3.5 h-3.5" />,
    achat: <ArrowDownLeft className="w-3.5 h-3.5" />, depense: <FileText className="w-3.5 h-3.5" />,
    retrait: <DollarSign className="w-3.5 h-3.5" />, restock: <RefreshCw className="w-3.5 h-3.5" />,
    settings: <Settings className="w-3.5 h-3.5" />, error: <AlertTriangle className="w-3.5 h-3.5" />,
    finalisation: <CheckCircle2 className="w-3.5 h-3.5" />, edition: <Edit2 className="w-3.5 h-3.5" />,
  };
  const colorByType = {
    connexion: 'bg-success/20 text-success', deconnexion: 'bg-gray-200 text-gray-600',
    connexion_echouee: 'bg-red-100 text-red-600', vente: 'bg-accent/20 text-accent',
    achat: 'bg-blue-100 text-blue-600', depense: 'bg-red-100 text-red-500',
    retrait: 'bg-warning/20 text-warning', restock: 'bg-purple-100 text-purple-600',
    settings: 'bg-gray-100 text-gray-600', error: 'bg-red-200 text-red-700',
    finalisation: 'bg-amber-100 text-amber-700', edition: 'bg-indigo-100 text-indigo-600',
  };
  const statutIcon = {
    success: <CheckCircle2 className="w-3 h-3 text-success" />,
    failed: <XCircle className="w-3 h-3 text-danger" />,
    warning: <AlertTriangle className="w-3 h-3 text-warning" />,
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${dark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl`}>
        <div className="flex justify-between items-center mb-4 flex-shrink-0">
          <h2 className={`text-lg font-display font-bold flex items-center gap-2 ${dark ? 'text-white' : 'text-primary'}`}>
            <ShieldCheck className="w-5 h-5 text-accent" />{t.journalLog}
            <span className={`text-xs font-normal px-2 py-0.5 rounded-full ${dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-500'}`}>
              {logs.length} entrées
            </span>
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex gap-2 flex-wrap mb-4 flex-shrink-0">
          <div className="flex gap-1.5 flex-wrap">
            {['tous', ...logTypes].map(tp => (
              <button key={tp} onClick={() => setFilterType(tp)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterType === tp ? 'gradient-gold text-primary' : dark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'
                }`}>
                {tp === 'tous' ? t.all : (t.logTypes[tp] || tp)}
              </button>
            ))}
          </div>
          <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
            className={`px-2.5 py-1 rounded-lg border text-xs outline-none focus:border-accent ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200'}`} />
          {filterDate && <button onClick={() => setFilterDate('')} className="text-danger"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {filtered.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-sm">{t.journalEmpty}</p>
          ) : filtered.map(log => (
            <div key={log.id} className={`p-3 rounded-xl border ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start gap-2.5">
                <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 ${colorByType[log.typeEvenement] || 'bg-gray-100 text-gray-600'}`}>
                  {iconByType[log.typeEvenement]}{t.logTypes[log.typeEvenement] || log.typeEvenement}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{log.description}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">{statutIcon[log.statut]}</span>
                    <span className={`text-xs ${dark ? 'text-gray-500' : 'text-gray-400'}`}>{format(log.dateHeure, 'dd/MM/yyyy HH:mm:ss')}</span>
                    <span className={`text-xs ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
                      · {formatDistanceToNow(log.dateHeure, { addSuffix: true, locale: dateFr })}
                    </span>
                    {log.idUtilisateur && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${dark ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                        {log.idUtilisateur}
                      </span>
                    )}
                    {log.idOperation && (
                      <span className={`text-xs font-mono ${dark ? 'text-gray-600' : 'text-gray-400'}`}>#{log.idOperation}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL PARAMÈTRES
// ─────────────────────────────────────────────────────────────
const SettingsModal = ({ profitShare, onClose, onUpdate, t, dark }) => {
  const [porteur, setPorteur] = useState(profitShare.porteur);
  const [customMode, setCustomMode] = useState(false);
  const associe = 100 - porteur;
  const presets = [
    { label: '70 / 30', porteur: 70, associe: 30 },
    { label: '60 / 40', porteur: 60, associe: 40 },
    { label: '50 / 50', porteur: 50, associe: 50 },
    { label: '80 / 20', porteur: 80, associe: 20 },
  ];
  const handlePreset = (preset) => {
    setPorteur(preset.porteur);
    setCustomMode(false);
  };
  const handleCustomChange = (value) => {
    const num = parseInt(value) || 0;
    setPorteur(Math.min(100, Math.max(0, num)));
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`${dark ? 'bg-gray-900' : 'bg-white'} rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 w-full sm:max-w-md shadow-2xl`}>
        <div className="flex justify-between items-center mb-5">
          <h2 className={`text-lg font-display font-bold ${dark ? 'text-white' : 'text-primary'}`}>{t.settings}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-5">
          <div>
            <label className={`block text-sm font-semibold mb-3 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>{t.globalShare}</label>
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handlePreset(preset)}
                    className={`py-2.5 px-3 rounded-lg font-semibold text-sm transition-all ${
                      porteur === preset.porteur && !customMode
                        ? 'bg-accent text-primary border-2 border-accent'
                        : `border-2 ${dark ? 'border-gray-700 hover:border-gray-600' : 'border-gray-200 hover:border-gray-300'} ${dark ? 'text-gray-300' : 'text-gray-600'}`
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className={`border-t-2 ${dark ? 'border-gray-700' : 'border-gray-200'} pt-4`}>
                <button
                  onClick={() => setCustomMode(!customMode)}
                  className={`w-full py-2 px-3 rounded-lg font-semibold text-sm transition-all text-left flex justify-between items-center ${
                    customMode
                      ? 'bg-accent/10 border-2 border-accent text-accent'
                      : `border-2 ${dark ? 'border-gray-700 text-gray-400' : 'border-gray-200 text-gray-600'}`
                  }`}
                >
                  <span>{t.customShare || 'Personnalisé'}</span>
                  <span className="text-xs font-bold">{porteur} / {associe}%</span>
                </button>
                {customMode && (
                  <div className="mt-3 space-y-3 p-3 bg-accent/5 rounded-lg border border-accent/20">
                    <div>
                      <div className="flex justify-between items-center mb-1.5 text-sm">
                        <label className={dark ? 'text-gray-300' : 'text-gray-700'}>{t.partner}</label>
                        <span className="font-bold text-accent">{porteur}%</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={porteur}
                        onChange={e => handleCustomChange(e.target.value)}
                        className={`w-full px-3 py-2 rounded-lg border-2 ${dark ? 'bg-gray-800 border-gray-700 text-white' : 'bg-gray-50 border-gray-200 text-black'} font-semibold text-center`}
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1.5 text-sm">
                        <label className={dark ? 'text-gray-300' : 'text-gray-700'}>{t.associate}</label>
                        <span className="font-bold" style={{color: dark ? '#6B7280' : '#9CA3AF'}}>{associe}%</span>
                      </div>
                      <div className={`w-full px-3 py-2 rounded-lg border-2 ${dark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'} font-semibold text-center ${dark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {associe}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className={`text-xs p-3 rounded-xl border ${dark ? 'bg-gray-800 border-gray-700 text-gray-400' : 'bg-accent/5 border-accent/20 text-gray-500'}`}>
            ℹ️ {t.noteSettings}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1">{t.cancel}</Button>
            <Button onClick={() => { onUpdate({ porteur, associe }); toast.success(t.settingsUpdated); onClose(); }} className="flex-1">{t.save}</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// MODAL MOUVEMENTS DE STOCK USDT — Registre complet
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// REGISTRE MOUVEMENTS DE STOCK USDT
// Design registre comptable professionnel
// ─────────────────────────────────────────────────────────────
const StockMovementModal = ({ data, user, fournisseurs = [], onClose, t, dark, langue }) => {
  const [filterDir, setFilterDir]     = useState('all');
  const [dateFrom,  setDateFrom]      = useState('');
  const [dateTo,    setDateTo]        = useState('');
  const [query,     setQuery]         = useState('');
  const [expanded,  setExpanded]      = useState(null);
  const isPorteur = user?.role === 'porteur';

  const usdtStock = data.devises.find(d => d.devise === 'USDT') || { quantite: 0, cmup: 0 };
  const supplierStockSummary = buildSupplierStockSummary(data.transactions || [], fournisseurs);
  const supplierStockRows = supplierStockSummary.rows;
  const formatSupplierStock = (value) => {
    const amount = parseThousands(value);
    const prefix = amount < 0 ? '-' : '';
    return `${prefix}${Math.abs(amount).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} USDT`;
  };

  // ── Construire les lignes du registre ──
  const allLines = [...data.transactions]
    .filter(tx => tx.type === 'vente' || (tx.type === 'achat' && tx.devise === 'USDT'))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((tx) => {
      const isIn  = tx.type === 'achat';
      const qty   = Math.abs(isIn ? (tx.quantite || 0) : (tx.usdtConsomme || 0));
      const sAvant = tx.stockUsdt_avant ?? 0;
      const sApres = tx.stockUsdt_apres ?? (isIn ? sAvant + qty : sAvant - qty);
      const supplierStock = supplierStockSummary.movementById.get(tx.id) || null;
      const libelle = isIn
        ? `${t.fundingSupplyLabel}${tx.sourceCompte === 'caisse' ? ` — ${t.caisse}` : ` — ${t.depot}`}${tx.fournisseur ? '  ·  ' + tx.fournisseur : ''}`
        : `${t.saleMovementLabel} ${tx.deviseVente || ''}${tx.client ? '  ·  ' + tx.client : ''}${tx.fournisseur ? '  ·  ' + tx.fournisseur : ''}`;
      return { ...tx, isIn, qty, sAvant, sApres, supplierStock, libelle };
    });

  const rows = allLines.filter(m => {
    if (filterDir !== 'all' && ((filterDir === 'in') !== m.isIn)) return false;
    if (dateFrom && new Date(m.date) < new Date(dateFrom)) return false;
    if (dateTo   && new Date(m.date) > new Date(dateTo + 'T23:59:59')) return false;
    if (query) {
      const q = query.toLowerCase();
      return [m.id, m.libelle, m.client, m.fournisseur, m.userName]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  const totalIn  = allLines.filter(m => m.isIn).reduce((s, m) => s + m.qty, 0);
  const totalOut = allLines.filter(m => !m.isIn).reduce((s, m) => s + m.qty, 0);
  const stockVal = usdtStock.quantite * usdtStock.cmup;

  const exportCSV = () => {
    const h = ['Date enregistrement','Date modification','Réf.','Sens','USDT','Stock avant','Stock après','Stock fournisseur avant','Stock fournisseur après','Libellé','Client','Fournisseur','Source','Devise','Qté devise','Taux conv.','Taux achat','Taux vente','Val. achat','Val. vente','Bénéfice','Utilisateur'];
    const d = rows.map(m => [
      format(new Date(m.dateEnregistrement || m.date), 'dd/MM/yyyy HH:mm:ss'),
      m.dateModification ? format(new Date(m.dateModification), 'dd/MM/yyyy HH:mm:ss') : '',
      m.id,
      m.isIn ? 'Entrée' : 'Sortie',
      m.qty.toFixed(6), m.sAvant.toFixed(6), m.sApres.toFixed(6),
      m.supplierStock ? m.supplierStock.before.toFixed(6) : '',
      m.supplierStock ? m.supplierStock.after.toFixed(6) : '',
      m.libelle, m.client||'', m.fournisseur||'', m.sourceCompte||'',
      m.deviseVente||'', m.quantiteDevise?.toString()||'',
      m.tauxConversion?.toFixed(6)||'', m.taux?.toFixed(6)||'',
      m.tauxVisible?.toString()||'', m.valeurAchat?.toFixed(0)||'',
      m.valeurVenteVisible?.toFixed(0)||'', m.beneficeVisible?.toFixed(0)||'',
      m.userName||''
    ]);
    const csv = [h,...d].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FOREXIUM_Stock_USDT_${format(new Date(),'yyyyMMdd')}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Thème ──
  const th = {
    overlay:  'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-5',
    shell:    `w-full sm:max-w-5xl max-h-[97vh] flex flex-col rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl border ${dark ? 'bg-[#0f1117] border-white/[0.07]' : 'bg-white border-slate-200'}`,
    border:   dark ? 'border-white/[0.07]' : 'border-slate-100',
    ink:      dark ? 'text-white'           : 'text-slate-900',
    sub:      dark ? 'text-slate-400'       : 'text-slate-500',
    faint:    dark ? 'text-slate-600'       : 'text-slate-400',
    card:     dark ? 'bg-white/[0.04]'     : 'bg-slate-50',
    cardBdr:  dark ? 'border-white/[0.06]' : 'border-slate-200',
    rowHov:   dark ? 'hover:bg-white/[0.03]' : 'hover:bg-slate-50/70',
    rowExp:   dark ? 'bg-white/[0.04]'     : 'bg-blue-50/40',
    inp:      dark ? 'bg-white/[0.05] border-white/[0.08] text-white placeholder-slate-500 focus:border-blue-500/60'
                   : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-blue-400',
    chip:     dark ? 'border-white/[0.08] text-slate-400 hover:border-white/20 hover:text-white'
                   : 'border-slate-200 text-slate-500 hover:border-slate-400 hover:text-slate-800',
    chipSel:  (color) => color === 'green'
                ? 'bg-emerald-500 border-emerald-500 text-white'
                : color === 'red'
                  ? 'bg-rose-500 border-rose-500 text-white'
                  : dark ? 'bg-white text-slate-900 border-white' : 'bg-slate-900 text-white border-slate-900',
  };

  // ── Composant cellule KPI ──
  const KPI = ({ label, value, unit, sub: subVal, accent }) => (
    <div className={`${th.card} border ${th.cardBdr} rounded-xl px-5 py-4 flex flex-col gap-2`}>
      <span className={`text-xs font-medium uppercase tracking-widest ${th.faint}`}>{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-xl font-semibold tracking-tight tabular-nums ${accent || th.ink}`}>{value}</span>
        <span className={`text-xs ${th.sub}`}>{unit}</span>
      </div>
      {subVal && <span className={`text-xs ${th.faint}`}>{subVal}</span>}
    </div>
  );

  return (
    <div className={th.overlay}>
      <div className={th.shell}>

        {/* ══ TOPBAR ══ */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${th.border} flex-shrink-0`}>
          <div className="flex items-center gap-3.5">
            <div className={`w-10 h-10 rounded-xl border ${th.cardBdr} ${th.card} flex items-center justify-center`}>
              <Activity className={`w-5 h-5 ${dark ? 'text-blue-400' : 'text-blue-600'}`} />
            </div>
            <div>
              <h2 className={`text-[15px] font-semibold ${th.ink}`}>{t.stockMovement}</h2>
              <p className={`text-xs mt-0.5 ${th.sub}`}>{allLines.length} {t.stockMovementRecordedCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV}
              className={`hidden sm:inline-flex items-center gap-2 h-8 px-3.5 rounded-lg border text-xs font-medium transition-all ${th.chip}`}>
              <Download className="w-3.5 h-3.5" />{t.exportCSV}
            </button>
            <button onClick={onClose}
              className={`w-8 h-8 flex items-center justify-center rounded-lg border text-xs transition-all ${th.chip}`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ══ KPIs ══ */}
        <div className={`flex-shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b ${th.border}`}>
          <KPI label={t.soldeActuel}
            value={usdtStock.quantite.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
            unit="USDT"
            accent={dark ? 'text-blue-400' : 'text-blue-600'}
          />
          <KPI label={t.totalEntrees}
            value={`+${totalIn.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}`}
            unit="USDT"
            accent={dark ? 'text-emerald-400' : 'text-emerald-600'}
          />
          <KPI label={t.totalSorties}
            value={`-${totalOut.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}`}
            unit="USDT"
            accent={dark ? 'text-rose-400' : 'text-rose-500'}
          />
          <KPI label="CMUP"
            value={usdtStock.cmup.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
            unit="XAF/USDT"
            sub={`${t.valeurStock} : ${stockVal.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF`}
            accent={dark ? 'text-amber-400' : 'text-amber-600'}
          />
        </div>

        {/* ══ Répartition du stock par fournisseur ══ */}
        <div className={`flex-shrink-0 px-6 py-4 border-b ${th.border}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <div className={`text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{t.supplierStockBreakdown}</div>
              <div className={`text-xs mt-0.5 ${th.sub}`}>
                {t.supplierStockAvailable}: {formatSupplierStock(supplierStockSummary.available)}
                {supplierStockSummary.debt > 0 && (
                  <span className={dark ? 'text-rose-400' : 'text-rose-600'}>
                    {' '}• {t.supplierStockDebt}: {formatSupplierStock(-supplierStockSummary.debt)}
                  </span>
                )}
              </div>
            </div>
            <span className={`text-xs ${th.faint}`}>{supplierStockRows.length} {langue === 'fr' ? 'fournisseur(s)' : 'supplier(s)'}</span>
          </div>
          {supplierStockRows.length === 0 ? (
            <div className={`text-xs ${th.faint}`}>{t.noSupplierStock}</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto pr-1">
              {supplierStockRows.map((row) => {
                const isDebt = row.stock < -0.000001;
                return (
                  <div key={row.key} className={`rounded-lg border px-3 py-2 ${th.cardBdr} ${isDebt ? (dark ? 'bg-rose-500/10' : 'bg-rose-50') : th.card}`}>
                    <div className="flex items-center justify-between gap-3">
                      <span className={`text-xs font-semibold truncate ${th.ink}`}>{row.name}</span>
                      <span className={`text-xs font-bold tabular-nums ${isDebt ? (dark ? 'text-rose-400' : 'text-rose-600') : (dark ? 'text-emerald-400' : 'text-emerald-600')}`}>
                        {formatSupplierStock(row.stock)}
                      </span>
                    </div>
                    <div className={`text-[10px] mt-1 ${th.faint}`}>
                      +{row.bought.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} / -{row.sold.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                      {isDebt && <span className={dark ? 'text-rose-400' : 'text-rose-600'}> • {t.supplierStockDebt}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ══ TOOLBAR FILTRES ══ */}
        <div className={`flex-shrink-0 flex flex-wrap items-center gap-2.5 px-6 py-3 border-b ${th.border}`}>
          {/* Direction */}
          <div className={`inline-flex items-center gap-1 p-1 rounded-lg border ${th.cardBdr} ${th.card}`}>
            {[
              { val: 'all',  label: t.filterAll },
              { val: 'in',   label: t.filterIncoming,  color: 'green' },
              { val: 'out',  label: t.filterOutgoing,  color: 'red'   },
            ].map(({ val, label, color }) => (
              <button key={val} onClick={() => setFilterDir(val)}
                className={`h-7 px-3 rounded-md text-xs font-medium transition-all border ${
                  filterDir === val ? th.chipSel(color || '') : 'border-transparent ' + th.sub
                }`}>{label}</button>
            ))}
          </div>

          {/* Recherche */}
          <div className="relative flex-1 min-w-[120px]">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${th.faint}`} />
            <input type="text" placeholder={t.stockSearchPlaceholder} value={query}
              onChange={e => setQuery(e.target.value)}
              className={`w-full h-9 pl-9 pr-3 rounded-lg border text-xs outline-none transition-colors ${th.inp}`} />
          </div>

          {/* Dates */}
          <div className="flex items-center gap-1.5">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className={`h-9 px-2.5 rounded-lg border text-xs outline-none transition-colors ${th.inp}`} />
            <span className={`text-xs ${th.faint}`}>–</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className={`h-9 px-2.5 rounded-lg border text-xs outline-none transition-colors ${th.inp}`} />
          </div>

          {(dateFrom || dateTo || query) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setQuery(''); }}
              className="text-xs text-rose-500 hover:text-rose-400 flex items-center gap-1 font-medium">
              <X className="w-3 h-3" />{t.clearFilters}
            </button>
          )}
          <span className={`ml-auto text-xs tabular-nums font-medium ${th.faint}`}>{rows.length} / {allLines.length}</span>
        </div>

        {/* ══ REGISTRE ══ */}
        <div className="flex-1 overflow-y-auto">
          {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-20">
                <div className={`w-14 h-14 rounded-2xl ${th.card} border ${th.cardBdr} flex items-center justify-center`}>
                  <Package className={`w-6 h-6 ${th.faint}`} />
                </div>
              <p className={`text-sm ${th.sub}`}>{t.noMovementFound}</p>
            </div>
          ) : (
            <table className="w-full border-collapse">
              {/* En-têtes colonnes */}
              <thead className={`sticky top-0 z-10 ${dark ? 'bg-[#0f1117]' : 'bg-white'} border-b ${th.border}`}>
                <tr>
                  <th className={`w-10 px-4 py-3 text-left`}></th>
                  <th className={`px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{t.operationLabel}</th>
                  <th className={`hidden md:table-cell px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{t.variation}</th>
                  <th className={`hidden lg:table-cell px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{t.stockAvant}</th>
                  <th className={`px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{t.stockApres}</th>
                  <th className={`w-8`}></th>
                </tr>
              </thead>
              <tbody className={`divide-y ${th.border}`}>
                {rows.map((m, idx) => {
                  const isExp = expanded === m.id;
                  return (
                    <>
                      {/* ── Ligne principale ── */}
                      <tr key={m.id}
                        onClick={() => setExpanded(isExp ? null : m.id)}
                        className={`cursor-pointer transition-colors ${isExp ? th.rowExp : th.rowHov}`}>

                        {/* Indicateur */}
                        <td className="px-4 py-3.5">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                            m.isIn
                              ? dark ? 'bg-emerald-500/10' : 'bg-emerald-50'
                              : dark ? 'bg-rose-500/10'    : 'bg-rose-50'
                          }`}>
                            {m.isIn
                              ? <TrendingUp   className={`w-3.5 h-3.5 ${dark ? 'text-emerald-400' : 'text-emerald-600'}`} strokeWidth={2.5} />
                              : <TrendingDown className={`w-3.5 h-3.5 ${dark ? 'text-rose-400'    : 'text-rose-600'}`}    strokeWidth={2.5} />
                            }
                          </div>
                        </td>

                        {/* Opération info */}
                        <td className="px-4 py-3.5 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold tracking-wide uppercase ${
                              m.isIn ? (dark ? 'text-emerald-400' : 'text-emerald-700') : (dark ? 'text-rose-400' : 'text-rose-700')
                            }`}>{m.isIn ? `↑ ${t.entree}` : `↓ ${t.sortie}`}</span>
                            <code className={`text-[10px] ${th.faint}`}>{m.id}</code>
                            {m.statut === 'pending' && (
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${dark ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                                {t.pending.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 truncate max-w-[240px] ${th.sub}`}>{m.libelle}</p>
                          <p className={`text-[10px] mt-0.5 ${th.faint}`}>
                            {t.recordedShortLabel} {format(new Date(m.dateEnregistrement || m.date), 'dd/MM/yy · HH:mm')} · {m.userName}
                            {m.dateModification && (
                              <span className="text-amber-500 ml-1">· {t.editedShortLabel} {format(new Date(m.dateModification), 'dd/MM/yy · HH:mm')}</span>
                            )}
                          </p>
                        </td>

                        {/* Variation */}
                        <td className="hidden md:table-cell px-4 py-3.5 text-right">
                          <span className={`text-sm font-semibold tabular-nums ${
                            m.isIn ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-rose-400' : 'text-rose-500')
                          }`}>
                            {m.isIn ? '+' : '−'}{m.qty.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                          </span>
                          <div className={`text-[10px] ${th.faint}`}>USDT</div>
                        </td>

                        {/* Stock avant */}
                        <td className="hidden lg:table-cell px-4 py-3.5 text-right">
                          <span className={`text-sm tabular-nums ${th.sub}`}>
                            {m.sAvant.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                          </span>
                        </td>

                        {/* Stock après */}
                        <td className="px-4 py-3.5 text-right">
                          <span className={`text-sm font-semibold tabular-nums ${th.ink}`}>
                            {m.sApres.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                          </span>
                        </td>

                        {/* Chevron */}
                        <td className="pr-3 py-3.5">
                          {isExp
                            ? <ChevronUp   className={`w-4 h-4 ${th.faint}`} />
                            : <ChevronDown className={`w-4 h-4 ${th.faint}`} />
                          }
                        </td>
                      </tr>

                      {/* ── Panneau de détail ── */}
                      {isExp && (
                        <tr key={`${m.id}-detail`}>
                          <td colSpan={6} className={`px-6 pt-2 pb-5 ${dark ? 'bg-[#131520]' : 'bg-slate-50/70'} border-b ${th.border}`}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">

                              {/* Bloc 1 — Identité */}
                              <RegCard title={t.operationLabel} icon={<FileText className="w-3.5 h-3.5" />} dark={dark} th={th}>
                                <RegRow k={t.referenceLabel}    v={m.id}       mono th={th} />
                                <RegRow k={t.typeLabel}         v={m.type === 'achat' ? `${t.purchase} USDT` : `${t.sale} ${m.deviseVente || ''}`} th={th} />
                                <RegRow k={t.recordedDateLabel}  v={format(new Date(m.dateEnregistrement || m.date),'dd/MM/yyyy HH:mm:ss')} th={th} />
                                {m.dateModification && (
                                  <RegRow k={t.modifiedDateLabel} v={format(new Date(m.dateModification),'dd/MM/yyyy HH:mm:ss')} accent="text-amber-500" th={th} />
                                )}
                                <RegRow k={t.userLabel}  v={m.userName || '—'} th={th} />
                                <RegRow k={t.statusLabel}
                                  v={m.statut === 'pending' ? `⏳ ${t.pending}` : `✓ ${t.committed}`}
                                  accent={m.statut === 'pending' ? 'text-amber-500' : (dark ? 'text-emerald-400' : 'text-emerald-600')}
                                  th={th} />
                              </RegCard>

                              {/* Bloc 2 — Mouvement USDT */}
                              <RegCard title={t.stockMovement} icon={<Layers className="w-3.5 h-3.5" />} dark={dark} th={th}>
                                <RegRow k={t.stockAvant} v={`${m.sAvant.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT`} th={th} />
                                <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg my-1 ${
                                  m.isIn ? (dark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (dark ? 'bg-rose-500/10' : 'bg-rose-50')
                                }`}>
                                  <span className={`text-xs ${th.sub}`}>{t.variation}</span>
                                  <span className={`text-sm font-bold tabular-nums ${m.isIn ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-rose-400' : 'text-rose-500')}`}>
                                    {m.isIn ? '+' : '−'}{m.qty.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT
                                  </span>
                                </div>
                                <RegRow k={t.stockApres} v={`${m.sApres.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} USDT`} bold th={th} />
                                {m.supplierStock && (
                                  <>
                                    <div className={`my-1 border-t ${th.border}`} />
                                    <RegRow
                                      k={t.supplierStockBefore}
                                      v={`${m.supplierStock.supplierName} · ${formatSupplierStock(m.supplierStock.before)}`}
                                      th={th}
                                    />
                                    <RegRow
                                      k={t.supplierStockAfter}
                                      v={`${formatSupplierStock(m.supplierStock.after)}${m.supplierStock.after < 0 ? ` (${t.supplierStockDebt})` : ''}`}
                                      accent={m.supplierStock.after < 0 ? (dark ? 'text-rose-400' : 'text-rose-600') : (dark ? 'text-emerald-400' : 'text-emerald-600')}
                                      bold
                                      th={th}
                                    />
                                  </>
                                )}
                                <div className={`my-1 border-t ${th.border}`} />
                                {m.type === 'achat' && <>
                                  <RegRow k={t.tauxAchatXaf} v={`${m.taux?.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF/USDT`} accent={dark ? 'text-blue-400' : 'text-blue-600'} th={th} />
                                  <RegRow k={t.amountPaidTitle} v={`${m.montant?.toLocaleString('fr-FR')} XAF`} bold th={th} />
                                </>}
                                {m.type === 'vente' && <>
                                  <RegRow k={langue === 'fr' ? 'CMUP utilisé' : 'CMUP used'} v={`${m.tauxAchatXAF?.toLocaleString('fr-FR',{maximumFractionDigits:6}) || '—'} XAF/USDT`} th={th} />
                                  <RegRow k={langue === 'fr' ? 'Coût achat' : 'Purchase cost'}   v={`${m.valeurAchat?.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`} th={th} />
                                </>}
                              </RegCard>

                              {/* Bloc 3 — Détails spécifiques */}
                              <RegCard
                                title={m.type === 'achat' ? (langue === 'fr' ? 'Détails achat' : 'Purchase details') : (langue === 'fr' ? 'Détails vente' : 'Sale details')}
                                icon={m.type === 'achat'
                                  ? <ArrowDownLeft className={`w-3.5 h-3.5 ${dark ? 'text-blue-400' : 'text-blue-500'}`} />
                                  : <ArrowUpRight  className={`w-3.5 h-3.5 ${dark ? 'text-emerald-400' : 'text-emerald-500'}`} />}
                                dark={dark} th={th}>
                                {m.type === 'achat' ? (<>
                                  <RegRow k={t.supplier} v={m.fournisseur || '—'} bold={!!m.fournisseur} th={th} />
                                  <RegRow k={langue === 'fr' ? 'Financement' : 'Funding'} v={m.sourceCompte === 'caisse' ? `💳 ${t.caisse}` : `🏦 ${t.depot}`} th={th} />
                                  <RegRow k={t.quantity}    v={`${m.quantite?.toLocaleString('fr-FR',{maximumFractionDigits:6})} USDT`} bold th={th} />
                                  <RegRow k={langue === 'fr' ? 'Taux unitaire' : 'Unit rate'} v={`${m.taux?.toLocaleString('fr-FR',{maximumFractionDigits:6})} XAF`} accent={dark ? 'text-blue-400' : 'text-blue-600'} th={th} />
                                  <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg mt-1 ${dark ? 'bg-white/[0.04]' : 'bg-slate-100'}`}>
                                    <span className={`text-xs font-medium ${th.sub}`}>{t.totalCost}</span>
                                    <span className={`text-sm font-bold ${th.ink}`}>{m.montant?.toLocaleString('fr-FR')} XAF</span>
                                  </div>
                                </>) : (<>
                                  <RegRow k={t.client}      v={m.client || '—'} bold={!!m.client} th={th} />
                                  <RegRow k={t.currency}      v={m.deviseVente || '—'} th={th} />
                                  <RegRow k={t.qteDevise}  v={`${m.quantiteDevise?.toLocaleString('fr-FR',{maximumFractionDigits:4})} ${m.deviseVente||''}`} th={th} />
                                  <RegRow k={t.tauxConvUsdt}  v={`${m.tauxConversion?.toLocaleString('fr-FR',{maximumFractionDigits:6})} ${m.deviseVente}/USDT`} th={th} />
                                  <RegRow k={t.tauxVenteXaf}  v={`${m.tauxVisible?.toLocaleString('fr-FR')} XAF`} accent={dark ? 'text-amber-400' : 'text-amber-600'} th={th} />
                                  <RegRow k={t.valVenteXaf}  v={`${m.valeurVenteVisible?.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`} th={th} />
                                  <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg mt-1 ${
                                    (m.beneficeVisible||0) >= 0 ? (dark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (dark ? 'bg-rose-500/10' : 'bg-rose-50')
                                  }`}>
                                    <span className={`text-xs font-medium ${th.sub}`}>{t.beneficeOp}</span>
                                    <span className={`text-sm font-bold ${(m.beneficeVisible||0) >= 0 ? (dark ? 'text-emerald-400' : 'text-emerald-600') : (dark ? 'text-rose-400' : 'text-rose-500')}`}>
                                      {(m.beneficeVisible||0) >= 0 ? '+' : ''}{m.beneficeVisible?.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF
                                    </span>
                                  </div>
                                  {isPorteur && m.partPorteur != null && (
                                    <div className={`mt-2 pt-2 border-t ${th.border} space-y-1.5`}>
                                      <RegRow k={`Porteur (${m.porteurPct}%)`} v={`${m.partPorteur?.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`} accent={dark ? 'text-amber-400' : 'text-amber-600'} th={th} />
                                      <RegRow k={`Associé (${m.associePct}%)`} v={`${m.partAssocie?.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`} th={th} />
                                    </div>
                                  )}
                                </>)}
                              </RegCard>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ══ STATUSBAR ══ */}
        <div className={`flex-shrink-0 flex items-center justify-between gap-3 flex-wrap px-6 py-3 border-t ${th.border} ${dark ? 'bg-[#0f1117]' : 'bg-slate-50'}`}>
          <div className={`flex items-center gap-5 text-xs ${th.faint}`}>
            <span>{t.soldeActuel} : <strong className={th.ink}>{usdtStock.quantite.toLocaleString('fr-FR',{maximumFractionDigits:4})} USDT</strong></span>
            <span className="hidden sm:inline">{t.valeurStock} : <strong className={th.ink}>{stockVal.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF</strong></span>
            <span className="hidden sm:inline">CMUP : <strong className={th.ink}>{usdtStock.cmup.toLocaleString('fr-FR',{maximumFractionDigits:2})} XAF</strong></span>
          </div>
          <button onClick={exportCSV} className="sm:hidden flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium bg-accent text-primary">
            <Download className="w-3.5 h-3.5" />{t.exportCSV}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sous-composants du registre ──
const RegCard = ({ title, icon, dark, th, children }) => (
  <div className={`rounded-xl border ${th.cardBdr} ${dark ? 'bg-[#0f1117]' : 'bg-white'} overflow-hidden`}>
    <div className={`flex items-center gap-2 px-4 py-3 border-b ${th.border} ${dark ? 'bg-white/[0.02]' : 'bg-slate-50'}`}>
      <span className={th.faint}>{icon}</span>
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${th.faint}`}>{title}</span>
    </div>
    <div className="px-4 py-3 space-y-2.5">{children}</div>
  </div>
);

const RegRow = ({ k, v, bold, mono, accent, th }) => (
  <div className="flex items-start justify-between gap-4">
    <span className={`text-xs flex-shrink-0 ${th.sub}`}>{k}</span>
    <span className={`text-xs text-right leading-relaxed ${bold ? 'font-semibold' : ''} ${mono ? 'font-mono text-[11px]' : ''} ${accent || th.ink}`}>
      {v}
    </span>
  </div>
);

const DetailItem = ({ label, value, bold, color, mono, dark }) => (
  <div className="flex justify-between items-start gap-2">
    <span className={`text-xs flex-shrink-0 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>{label}</span>
    <span className={`text-xs text-right ${bold ? 'font-bold' : 'font-medium'} ${color || (dark ? 'text-white' : 'text-gray-800')} ${mono ? 'font-mono' : ''}`}>
      {value}
    </span>
  </div>
);

// ─────────────────────────────────────────────────────────────
// DEVISE CARD — avec édition CMUP manuelle protégée (porteur)
// ─────────────────────────────────────────────────────────────
const DeviseCard = ({ devise: d, onCmupEdit, t, dark, langue }) => {
  const [showCmupModal, setShowCmupModal] = useState(false);
  const [newCmup, setNewCmup]   = useState('');
  const valeur = d.quantite * d.cmup;

  const openModal = () => {
    setNewCmup(d.cmup.toFixed(6));
    setShowCmupModal(true);
  };

  const handleConfirm = () => {
    const v = parseFloat(newCmup);
    if (!isFinite(v) || v <= 0) { toast.error(t.allFieldsRequired); return; }
    onCmupEdit(d.devise, v);
    setShowCmupModal(false);
  };

  return (
    <>
      <div className={`group relative rounded-xl p-3 sm:p-4 border-2 transition-all ${dark ? 'bg-gray-800 border-gray-700 hover:border-accent/50' : 'bg-gray-50 border-gray-100 hover:border-accent/30'}`}>
        <div className="flex items-start justify-between">
          <span className="text-base sm:text-xl font-bold text-accent">{d.devise}</span>
          {onCmupEdit && (
            <button onClick={openModal} title={t.editCmup}
              className={`opacity-100 transition-opacity p-1 rounded-lg ${dark ? 'hover:bg-gray-700 text-gray-500 hover:text-accent' : 'hover:bg-white text-gray-400 hover:text-accent'}`}>
              <PenLine className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className={`text-sm sm:text-lg font-bold mt-1 ${dark ? 'text-white' : 'text-primary'}`}>
          {d.quantite.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
        </div>
        <div className={`text-xs mt-1 ${dark ? 'text-gray-400' : 'text-gray-500'} flex items-center gap-1`}>
          CMUP
          {onCmupEdit && <PenLine className="w-2.5 h-2.5 opacity-50" />}
          <span className={`font-semibold ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
            {d.cmup.toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
          </span>
        </div>
        {valeur > 0 && (
          <div className={`text-xs mt-0.5 ${dark ? 'text-gray-600' : 'text-gray-400'}`}>
            ≈ {valeur.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF
          </div>
        )}
      </div>

      {showCmupModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowCmupModal(false)}>
          <div className={`${dark ? 'bg-gray-900' : 'bg-white'} rounded-2xl p-6 w-full max-w-sm shadow-2xl border ${dark ? 'border-gray-700' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                  <PenLine className={`w-4 h-4 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />
                </div>
                <div>
                  <h3 className={`text-sm font-bold ${dark ? 'text-white' : 'text-gray-900'}`}>{t.editCmup}</h3>
                  <p className={`text-xs ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {d.devise} · {langue === 'fr' ? 'Actuel' : 'Current'} : {d.cmup.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF
                  </p>
                </div>
              </div>
              <button onClick={() => setShowCmupModal(false)} className="text-gray-400 hover:text-gray-600 transition-colors"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-4">
              <div className={`rounded-xl p-3 flex items-start gap-2 ${dark ? 'bg-orange-900/20 border border-orange-700/30' : 'bg-orange-50 border border-orange-200'}`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${dark ? 'text-orange-400' : 'text-orange-600'}`} />
                <p className={`text-xs ${dark ? 'text-orange-300' : 'text-orange-700'}`}>{t.cmupWarning}</p>
              </div>
              <div>
                <label className={`block text-xs font-semibold mb-2 ${dark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t.cmupManuel}
                </label>
                <input type="text" inputMode="decimal" autoFocus
                  value={newCmup}
                  onChange={e => setNewCmup(e.target.value.replace(/[^0-9.]/g, ''))}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-mono outline-none transition-all ${dark ? 'border-accent/50 bg-gray-800 text-white' : 'border-accent/50'} focus:border-accent`}
                  placeholder="655.500000"
                />
                {parseFloat(newCmup) > 0 && (
                  <div className={`mt-2 px-3 py-2 rounded-lg text-xs flex justify-between ${dark ? 'bg-gray-800' : 'bg-gray-50'}`}>
                    <span className={dark ? 'text-gray-400' : 'text-gray-500'}>{langue === 'fr' ? 'Nouvelle valeur stock' : 'New stock value'}</span>
                    <span className="font-bold text-accent">{(d.quantite * parseFloat(newCmup)).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} XAF</span>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" onClick={() => setShowCmupModal(false)} className="flex-1">{t.cancel}</Button>
                <Button onClick={handleConfirm} className="flex-1">{t.confirmCmup}</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────
// v5.6.0+ PAGE COMPONENTS — reçoivent tk, dark, langue en props
// ─────────────────────────────────────────────────────────────

// ── Composant indicatif téléphonique ──────────────────────────
const COUNTRY_CODES = [
  {code:'+237',flag:'🇨🇲',name:'Cameroun'},{code:'+242',flag:'🇨🇬',name:'Congo'},{code:'+243',flag:'🇨🇩',name:'RDC'},
  {code:'+241',flag:'🇬🇦',name:'Gabon'},{code:'+236',flag:'🇨🇫',name:'Centrafrique'},{code:'+240',flag:'🇬🇶',name:'Guinée Éq.'},
  {code:'+235',flag:'🇹🇩',name:'Tchad'},{code:'+221',flag:'🇸🇳',name:'Sénégal'},{code:'+225',flag:'🇨🇮',name:'Côte d\'Ivoire'},
  {code:'+223',flag:'🇲🇱',name:'Mali'},{code:'+226',flag:'🇧🇫',name:'Burkina'},{code:'+229',flag:'🇧🇯',name:'Bénin'},
  {code:'+228',flag:'🇹🇬',name:'Togo'},{code:'+227',flag:'🇳🇪',name:'Niger'},{code:'+234',flag:'🇳🇬',name:'Nigeria'},
  {code:'+233',flag:'🇬🇭',name:'Ghana'},{code:'+212',flag:'🇲🇦',name:'Maroc'},{code:'+213',flag:'🇩🇿',name:'Algérie'},
  {code:'+216',flag:'🇹🇳',name:'Tunisie'},{code:'+20',flag:'🇪🇬',name:'Égypte'},
  {code:'+33',flag:'🇫🇷',name:'France'},{code:'+32',flag:'🇧🇪',name:'Belgique'},{code:'+41',flag:'🇨🇭',name:'Suisse'},
  {code:'+1',flag:'🇺🇸',name:'USA/Canada'},{code:'+44',flag:'🇬🇧',name:'UK'},
  {code:'+86',flag:'🇨🇳',name:'Chine'},{code:'+971',flag:'🇦🇪',name:'Émirats'},
];

const PhoneInput = ({ value, onChange, inputStyle, tk, dark, placeholder = 'Numéro' }) => {
  const [indicatif, setIndicatif] = React.useState('+237');
  const [local, setLocal] = React.useState('');
  const [showList, setShowList] = React.useState(false);

  React.useEffect(() => {
    // Parse existing value
    if (value) {
      const found = COUNTRY_CODES.find(c => value.startsWith(c.code));
      if (found) { setIndicatif(found.code); setLocal(value.slice(found.code.length).trim()); }
      else setLocal(value);
    }
  }, []);

  const update = (ind, loc) => {
    // Pas d'espace : +237XXXXXXXXX (valide directement côté backend)
    const full = loc ? `${ind}${loc}` : '';
    onChange(full);
  };

  const sel = COUNTRY_CODES.find(c => c.code === indicatif) || COUNTRY_CODES[0];

  return (
    <div style={{ display:'flex', gap:6, position:'relative' }}>
      <button type="button" onClick={()=>setShowList(v=>!v)} style={{
        padding:'8px 10px', borderRadius:8, border:`1px solid ${tk.border}`, background:tk.cardB,
        color:tk.ink, fontSize:12, cursor:'pointer', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:4, flexShrink:0,
      }}>
        <span>{sel.flag}</span><span style={{fontSize:11}}>{sel.code}</span><span style={{fontSize:9,color:tk.faint}}>▾</span>
      </button>
      {showList && (
        <div style={{
          position:'absolute', top:'100%', left:0, zIndex:200,
          background:tk.card, border:`1px solid ${tk.border}`, borderRadius:10,
          boxShadow:'0 8px 24px rgba(0,0,0,0.18)', maxHeight:220, overflowY:'auto', minWidth:200,
        }}>
          {COUNTRY_CODES.map(c => (
            <div key={c.code} onClick={()=>{ setIndicatif(c.code); setShowList(false); update(c.code, local); }}
              style={{ padding:'7px 12px', cursor:'pointer', fontSize:12, color:tk.ink, display:'flex', alignItems:'center', gap:8,
                background: c.code===indicatif ? (dark?'rgba(212,175,55,0.1)':'rgba(212,175,55,0.07)') : 'transparent',
                fontWeight: c.code===indicatif ? 700 : 400,
              }}>
              <span>{c.flag}</span><span style={{fontSize:11,color:tk.faint,minWidth:36}}>{c.code}</span><span>{c.name}</span>
            </div>
          ))}
        </div>
      )}
      <input style={{...inputStyle, flex:1}} value={local} inputMode="numeric"
        onChange={e=>{ const v=e.target.value.replace(/[^0-9]/g,''); setLocal(v); update(indicatif,v); }}
        placeholder={placeholder} onClick={()=>setShowList(false)}/>
    </div>
  );
};

// Compteur de chiffres affiché sous le champ téléphone
const PhoneCounter = ({ value, langue = 'fr' }) => {
  const digits = (value || '').replace(/\D/g,'').replace(/^237/,'');
  if (!value || digits.length === 0) return null;
  return <div style={{ fontSize:10, marginTop:3, color: '#22C55E', fontWeight:600 }}>
    {digits.length} {langue === 'fr' ? 'chiffre(s)' : 'digit(s)'} ✓
  </div>;
};

// ─────────────────────────────────────────────────────────────

const ClientsPageInline = ({ clients, transactions, dark, langue, tk, onCreateClient, onDeleteClient, onUpdateClient, apiGetClientExtrait, onPayClient, onReloadClients }) => {
  const t = TRANSLATIONS[langue];
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extraitData, setExtraitData] = useState(null);
  const [extraitClient, setExtraitClient] = useState(null);
  const [editClient, setEditClient] = useState(null);
  const [showClientAlerts, setShowClientAlerts] = useState(false);
  const [showPayClient, setShowPayClient] = useState(null);
  const [payClientAPayer, setPayClientAPayer] = useState('');
  const [payClientPaye, setPayClientPaye] = useState('');
  const [payClientDate, setPayClientDate] = useState(''); // Fix 6

  const emptyForm = { nom:'', prenom:'', telephone:'', adresse:'', ville:'' };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const card = { background:tk.card, borderRadius:14, border:`1px solid ${tk.border}`, padding:'18px 20px', boxShadow:dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)' };
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${tk.border}`, background:tk.cardB, color:tk.ink, fontSize:12, outline:'none', boxSizing:'border-box' };
  const label = (txt, required = false) => (
    <div style={{fontSize:10,color:tk.sub,marginBottom:4,fontWeight:600}}>
      {txt}{required && <span style={{color:'#EF4444',marginLeft:4}}>*</span>}
    </div>
  );

  const handleCreate = async () => {
    if (!form.nom.trim()) { toast.error(t.nameRequired); return; }
    setLoading(true);
    try {
      await onCreateClient(form.nom.trim(), form.prenom.trim(), form.telephone.trim(), [form.adresse,form.ville].filter(Boolean).join(', '));
      toast.success(t.clientCreatedSuccess); setForm(emptyForm); setShowForm(false);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteClientConfirm)) return;
    try { await onDeleteClient(id); toast.success(t.deletedSuccess); } catch(e) { toast.error(e.message); }
  };
  const openEdit = (c) => {
    setEditClient(c);
    const parts = (c.adresse||'').split(',');
    setEditForm({ nom:c.nom||'', prenom:c.prenom||'', telephone:c.telephone||c.numero||'', adresse:parts[0]?.trim()||'', ville:parts[1]?.trim()||c.ville||'' });
  };
  const handleUpdate = async () => {
    if (!editForm.nom.trim()) { toast.error(t.nameRequired); return; }
    try {
      await onUpdateClient(editClient.id, editForm.nom.trim(), editForm.prenom.trim(), editForm.telephone.trim(), [editForm.adresse,editForm.ville].filter(Boolean).join(', '));
      toast.success(t.clientUpdatedSuccess); setEditClient(null);
    } catch(e) { toast.error(e.message); }
  };
  const handleExtrait = async (c) => {
    try {
      const d = await apiGetClientExtrait(c.id);
      setExtraitData(d);
      setExtraitClient(c);
    } catch(e) { toast.error(`${t.statementUnavailable}: ${e.message}`); }
  };
  const getClientPaymentSnapshot = (clientRecord = showPayClient) => {
    const openedFromExtract = clientRecord && extraitClient && extraitData && Number(extraitClient.id) === Number(clientRecord.id);
    const totalDue = openedFromExtract
      ? parseFloat(extraitData?.totals?.total_a_payer || 0)
      : parseFloat(clientRecord?.total_a_payer || 0);
    const totalPaid = openedFromExtract
      ? parseFloat(extraitData?.totals?.total_paye || 0)
      : parseFloat(clientRecord?.total_paye || 0);
    return {
      totalDue,
      totalPaid,
      remaining: getSignedBalance(totalDue, totalPaid),
    };
  };
  const handlePayClientSubmit = async () => {
    if (!showPayClient) return;
    const mPaye = parseFloat((payClientPaye||'').replace(/\s/g,'').replace(/[^0-9]/g,''))||0;
    if (!mPaye) { toast.error(t.amountRequired); return; }
    const { remaining: detteReste } = getClientPaymentSnapshot(showPayClient);
    setLoading(true);
    try {
      await onPayClient({
        type: 'paiement_client',
        id_client: showPayClient.id,
        client: [showPayClient.nom, showPayClient.prenom].filter(Boolean).join(' '),
        montant_a_payer: detteReste,
        montant_paye: mPaye,
        devise: 'XAF',
        date: payClientDate || null,
      });
      toast.success(langue === 'fr' ? 'Paiement enregistré ✓' : 'Payment recorded ✓');
      setShowPayClient(null); setPayClientAPayer(''); setPayClientPaye(''); setPayClientDate('');
      if (onReloadClients) await onReloadClients();
      if (extraitClient && extraitClient.id === showPayClient.id) {
        const d = await apiGetClientExtrait(showPayClient.id);
        setExtraitData(d);
      }
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const fmtNum = (id) => `CLT-${String(id).padStart(3,'0')}`;
  const clientUserRows = buildAccountUserSummary(extraitData?.transactions || [], 'client');
  const clientRoleRows = buildRoleLedgerSummary(extraitData?.transactions || [], 'client');
  const clientRoleSummaryById = new Map(
    (clients || []).map((client) => [
      client.id,
      buildRoleLedgerSummary((transactions || []).filter((tx) => matchClientTransaction(tx, client)), 'client'),
    ])
  );
  const debtorClients = (clients || [])
    .map((client) => {
      const totalDue = parseFloat(client.total_a_payer || 0);
      const totalPaid = parseFloat(client.total_paye || 0);
      const remaining = getRemainingBalance(totalDue, totalPaid);
      return { ...client, totalDue, totalPaid, remaining };
    })
    .filter((client) => client.remaining > 0.0001)
    .sort((a, b) => b.remaining - a.remaining || (a.nom || '').localeCompare(b.nom || ''));
  const debtorClientsTotal = debtorClients.reduce((sum, client) => sum + client.remaining, 0);
  const renderRoleAmountCell = (roleRows, total, color, accessor, totalFormatter = null) => {
    const formattedTotal = totalFormatter
      ? totalFormatter(total)
      : accessor === 'rest'
        ? formatBalanceText(total, langue)
        : (total > 0 ? `${Math.round(total).toLocaleString('fr-FR')} XAF` : null);
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
        <span style={{fontWeight:800,color:accessor === 'rest' ? getBalanceColor(total) : color}}>
          {formattedTotal || <span style={{color:tk.faint}}>—</span>}
        </span>
        {roleRows.map((row) => (
          <span key={`${row.role}-${accessor}`} style={{fontSize:9,color:tk.faint}}>
            {row.role === 'porteur' ? 'P' : 'A'}:{' '}
            {accessor === 'rest'
              ? formatBalanceText(row[accessor] || 0, langue)
              : `${Math.round(row[accessor] || 0).toLocaleString('fr-FR')} XAF`}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap'}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800,color:tk.ink,display:'flex',alignItems:'center',gap:8}}>
          <Users size={18} color={tk.accent}/> {t.manageClients}
          <span style={{fontSize:11,fontWeight:500,color:tk.faint}}>({clients.length})</span>
        </h2>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <button
            onClick={()=>setShowClientAlerts(v=>!v)}
            disabled={debtorClients.length === 0}
            title={langue === 'fr' ? 'Voir les clients débiteurs' : 'View debtors'}
            style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:'1px solid #F59E0B',background:'rgba(245,158,11,0.1)',color:'#F59E0B',cursor:debtorClients.length === 0 ? 'default' : 'pointer',fontSize:10,fontWeight:700,opacity:debtorClients.length === 0 ? 0.55 : 1}}>
            🔔 {langue === 'fr' ? 'Alertes' : 'Alerts'} ({debtorClients.length})
          </button>
          <button onClick={()=>setShowForm(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'none',background:tk.accent,color:'#0A1628',cursor:'pointer',fontSize:11,fontWeight:700}}>
            <Plus size={14}/> {t.newClient}
          </button>
        </div>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <>
        <div style={{...card,borderColor:'#D4AF3740'}}>
          <h4 style={{margin:'0 0 14px',fontSize:12,fontWeight:700,color:tk.ink}}>
            {t.createClient}
            <span style={{fontSize:10,fontWeight:400,color:tk.faint,marginLeft:8}}>— {t.clientCodeHint}</span>
          </h4>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>{label(`${t.name} *`)}<input style={inputStyle} value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.name}/></div>
            <div>{label(t.firstName)}<input style={inputStyle} value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.firstName}/></div>
            <div style={{gridColumn:'1/-1'}}>{label(t.phone)}<PhoneInput value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} inputStyle={inputStyle} tk={tk} dark={dark} placeholder={t.numberPlaceholder}/><PhoneCounter value={form.telephone} langue={langue}/></div>
            <div>{label(t.addressDistrict)}<input style={inputStyle} value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))} placeholder={langue === 'fr' ? 'Rue, quartier' : 'Street, district'}/></div>
            <div>{label(t.city)}<input style={inputStyle} value={form.ville} onChange={e=>setForm(f=>({...f,ville:e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-'.]/g,'')}))} placeholder={langue === 'fr' ? 'Douala, Yaoundé…' : 'Douala, Yaounde…'}/></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleCreate} disabled={loading} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#22C55E',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>{loading?'…':t.create}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:11}}>{t.cancel}</button>
          </div>
        </div>
        </>
      )}

      {/* TABLE clients */}
      {clients.length === 0 ? (
        <div style={{...card,textAlign:'center',padding:'32px 0',color:tk.faint,fontSize:13}}>{t.noClientRegistered}</div>
      ) : (
        <div style={{...card,padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:860}}>
              <thead><tr style={{borderBottom:`2px solid ${tk.border}`}}>
                {['N°',t.fullName,t.phone,t.addressCity,t.salesValue,langue === 'fr' ? 'Reçu' : 'Received',t.balanceDue,t.actions].map((h,i)=>(
                  <th key={i} style={{padding:'8px 12px',textAlign:i>=4?'right':'left',color:tk.faint,fontSize:10,fontWeight:700,letterSpacing:0.5}}>{h.toUpperCase()}</th>
                ))}
              </tr></thead>
              <tbody>
                {clients.map((c,i)=>{
                  const aPayer = parseFloat(c.total_a_payer||0);
                  const paye   = parseFloat(c.total_paye||0);
                  const reste  = aPayer - paye;
                  const roleRows = clientRoleSummaryById.get(c.id) || buildRoleLedgerSummary([], 'client');
                  return (
                    <tr key={c.id} style={{borderBottom:i<clients.length-1?`1px solid ${tk.border}`:'none'}}>
                      <td style={{padding:'10px 12px',color:tk.faint,fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{fmtNum(c.id)}</td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{fontWeight:700,color:tk.ink}}>{c.nom}{c.prenom?` ${c.prenom}`:''}</div>
                        <div style={{fontSize:10,color:tk.faint}}>{c.nb_transactions||0} {t.salesCountLabel}</div>
                      </td>
                      <td style={{padding:'10px 12px',color:tk.sub,whiteSpace:'nowrap'}}>{c.telephone||c.numero||'—'}</td>
                      <td style={{padding:'10px 12px',color:tk.faint,fontSize:11}}>{c.adresse||c.ville||'—'}</td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(roleRows, aPayer, '#0EA5E9', 'due')}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(roleRows, paye, '#22C55E', 'paid')}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(
                          roleRows,
                          reste,
                          getBalanceColor(reste),
                          'rest',
                          (value) => {
                            if (aPayer <= 0 && paye <= 0) return null;
                            return formatBalanceText(value, langue);
                          }
                        )}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                          <button
                            onClick={()=>{
                              const reste2 = getRemainingBalance(c.total_a_payer, c.total_paye);
                              setShowPayClient(c);
                              setPayClientAPayer(reste2>0 ? Math.round(reste2).toString() : '');
                              setPayClientPaye('');
                            }}
                            title={t.recordPayment}
                            style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:'1px solid #22C55E',background:'rgba(34,197,94,0.1)',color:'#22C55E',cursor:'pointer',fontSize:10,fontWeight:700}}>
                            💳 {t.pay}
                          </button>
                          <button onClick={()=>handleExtrait(c)} title={t.statement} style={{background:'none',border:'none',cursor:'pointer',color:tk.accent}}><FileText size={14}/></button>
                          <button onClick={()=>openEdit(c)} title={t.edit} style={{background:'none',border:'none',cursor:'pointer',color:'#F59E0B'}}><Edit2 size={14}/></button>
                          <button onClick={()=>handleDelete(c.id)} title={t.delete} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444'}}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal alertes clients */}
      {showClientAlerts && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:tk.card,borderRadius:16,padding:24,width:'94%',maxWidth:860,maxHeight:'85vh',overflow:'auto',border:`1px solid ${tk.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16}}>
              <div>
                <h3 style={{margin:0,fontSize:14,fontWeight:800,color:tk.ink}}>Clients debiteurs</h3>
                <div style={{fontSize:11,color:tk.faint}}>
                  {debtorClients.length} client(s) • {Math.round(debtorClientsTotal).toLocaleString('fr-FR')} XAF
                </div>
              </div>
              <button onClick={()=>setShowClientAlerts(false)} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
            </div>
            {debtorClients.length === 0 ? (
              <div style={{padding:'18px 0',textAlign:'center',color:tk.faint,fontSize:13}}>Aucun client debiteur</div>
            ) : (
              <div style={{display:'flex',flexDirection:'column',gap:10}}>
                {debtorClients.map((c) => (
                  <div key={c.id} style={{border:`1px solid ${tk.border}`,borderRadius:12,padding:14,background:dark?'rgba(255,255,255,0.02)':'#F8FAFF'}}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start',flexWrap:'wrap'}}>
                      <div style={{minWidth:0}}>
                        <div style={{fontWeight:800,color:tk.ink}}>
                          {c.nom}{c.prenom?` ${c.prenom}`:''}
                          <span style={{fontSize:10,fontWeight:600,color:tk.faint,marginLeft:8}}>{fmtNum(c.id)}</span>
                        </div>
                        <div style={{fontSize:10,color:tk.faint,marginTop:3}}>
                          {c.telephone || c.numero || '—'} • {c.adresse || c.ville || '—'} • {c.nb_transactions || 0} {t.salesCountLabel}
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontWeight:800,color:'#F59E0B'}}>
                          {Math.round(c.remaining).toLocaleString('fr-FR')} XAF
                        </div>
                        <div style={{fontSize:10,color:tk.faint,marginTop:3}}>
                          Dû {Math.round(c.totalDue).toLocaleString('fr-FR')} XAF • Reçu {Math.round(c.totalPaid).toLocaleString('fr-FR')} XAF
                        </div>
                      </div>
                    </div>
                    <div style={{display:'flex',justifyContent:'flex-end',gap:8,marginTop:12,flexWrap:'wrap'}}>
                      <button
                        onClick={()=>{
                          const reste2 = getRemainingBalance(c.total_a_payer, c.total_paye);
                          setShowClientAlerts(false);
                          setShowPayClient(c);
                          setPayClientAPayer(reste2>0 ? Math.round(reste2).toString() : '');
                          setPayClientPaye('');
                          setPayClientDate('');
                        }}
                        style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:'1px solid #22C55E',background:'rgba(34,197,94,0.1)',color:'#22C55E',cursor:'pointer',fontSize:10,fontWeight:700}}>
                        💳 {t.pay}
                      </button>
                      <button
                        onClick={()=>{
                          setShowClientAlerts(false);
                          handleExtrait(c);
                        }}
                        style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:'1px solid #D4AF37',background:'rgba(212,175,55,0.1)',color:tk.accent,cursor:'pointer',fontSize:10,fontWeight:700}}>
                        <FileText size={12}/> {t.statement}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {editClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:tk.card,borderRadius:16,padding:24,width:420,maxHeight:'90vh',overflow:'auto',border:`1px solid ${tk.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:800,color:tk.ink}}>{t.edit} — {fmtNum(editClient.id)}</h3>
              <button onClick={()=>setEditClient(null)} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>{label(`${t.name} *`)}<input style={inputStyle} value={editForm.nom} onChange={e=>setEditForm(f=>({...f,nom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.name}/></div>
                <div>{label(t.firstName)}<input style={inputStyle} value={editForm.prenom} onChange={e=>setEditForm(f=>({...f,prenom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.firstName}/></div>
              </div>
              <div>{label(t.phone)}<PhoneInput value={editForm.telephone} onChange={v=>setEditForm(f=>({...f,telephone:v}))} inputStyle={inputStyle} tk={tk} dark={dark} placeholder={t.numberPlaceholder}/><PhoneCounter value={editForm.telephone} langue={langue}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>{label(t.addressDistrict)}<input style={inputStyle} value={editForm.adresse} onChange={e=>setEditForm(f=>({...f,adresse:e.target.value}))} placeholder={langue === 'fr' ? 'Quartier' : 'District'}/></div>
                <div>{label(t.city)}<input style={inputStyle} value={editForm.ville} onChange={e=>setEditForm(f=>({...f,ville:e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-'.]/g,'')}))} placeholder={t.city}/></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button onClick={handleUpdate} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:tk.accent,color:'#0A1628',cursor:'pointer',fontWeight:700,fontSize:12}}>{t.save}</button>
              <button onClick={()=>setEditClient(null)} style={{flex:1,padding:'9px',borderRadius:8,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:12}}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL PAIEMENT CLIENT — Fix 4 simplifié ══ */}
      {showPayClient && (() => {
        const mPaye       = parseFloat((payClientPaye||'').replace(/\s/g,'').replace(/[^0-9]/g,''))||0;
        const { totalDue: detteAPayer, totalPaid: dettePaye, remaining: detteReste } = getClientPaymentSnapshot(showPayClient);
        const apresP      = detteReste - mPaye;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:tk.card,borderRadius:18,padding:26,width:380,maxHeight:'90vh',overflowY:'auto',border:`1px solid ${tk.border}`,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>

              {/* Header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:18}}>
                <div>
                  <h3 style={{margin:0,fontSize:15,fontWeight:800,color:tk.ink}}>💳 {t.paymentClient}</h3>
                  <div style={{fontSize:11,color:tk.faint,marginTop:3}}>{showPayClient.nom}{showPayClient.prenom?` ${showPayClient.prenom}`:''} · XAF</div>
                </div>
                <button onClick={()=>{setShowPayClient(null);setPayClientPaye('');setPayClientDate('');}} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
              </div>

              {/* Rappel infos dette */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:18}}>
                {[
                  {lbl:t.dueShort,       val:detteAPayer, color:'#0EA5E9'},
                  {lbl:t.receivedShort,  val:dettePaye,   color:'#22C55E'},
                  {lbl:t.balanceLabel,   val:detteReste,  color:getBalanceColor(detteReste)},
                ].map(r=>(
                  <div key={r.lbl} style={{background:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.03)',borderRadius:8,padding:'8px 10px',border:`1px solid ${tk.border}`}}>
                    <div style={{fontSize:9,fontWeight:700,color:tk.faint,marginBottom:3,letterSpacing:0.4}}>{r.lbl}</div>
                    <div style={{fontSize:11,fontWeight:800,color:r.color}}>
                      {r.lbl===t.balanceLabel
                        ? formatBalanceText(r.val, langue)
                        : (r.val>0 ? `${Math.round(r.val).toLocaleString('fr-FR')} XAF` : '—')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Date de l'opération */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:tk.faint,marginBottom:6,letterSpacing:0.5}}>{t.operationDate.toUpperCase()}</div>
                <input type="date"
                  value={payClientDate || new Date().toISOString().split('T')[0]}
                  onChange={e=>setPayClientDate(e.target.value)}
                  style={{width:'100%',padding:'10px 14px',borderRadius:10,border:`2px solid ${tk.border}`,background:tk.cardB,color:tk.ink,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>

              {/* Montant reçu */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:tk.faint,marginBottom:6,letterSpacing:0.5}}>{`${t.amountReceivedClient.toUpperCase()} *`}</div>
                <input type="text" inputMode="numeric" autoFocus
                  value={payClientPaye}
                  onChange={e=>{const r=e.target.value.replace(/[^0-9]/g,'');setPayClientPaye(r===''?'':parseInt(r).toLocaleString('fr-FR'));}}
                  placeholder={formatBalanceText(detteReste, langue)}
                  style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`2px solid ${tk.border}`,background:tk.cardB,color:tk.ink,fontSize:16,fontWeight:700,outline:'none',boxSizing:'border-box'}}/>
              </div>

              {/* Résultat après paiement */}
              {mPaye > 0 && (
                <div style={{padding:'10px 14px',borderRadius:10,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center',
                  background:apresP === 0 ? (dark?'rgba(34,197,94,0.12)':'rgba(34,197,94,0.08)') : apresP < 0 ? (dark?'rgba(124,58,237,0.14)':'rgba(124,58,237,0.08)') : (dark?'rgba(245,158,11,0.12)':'rgba(245,158,11,0.08)'),
                  border:`1px solid ${apresP === 0 ? 'rgba(34,197,94,0.3)' : apresP < 0 ? 'rgba(124,58,237,0.35)' : 'rgba(245,158,11,0.3)'}`}}>
                  <span style={{fontSize:11,fontWeight:600,color:tk.faint}}>{t.afterPayment}</span>
                  <span style={{fontSize:13,fontWeight:800,color:getBalanceColor(apresP)}}>
                    {formatBalanceText(apresP, langue)}
                  </span>
                </div>
              )}

              {/* Boutons */}
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>{setShowPayClient(null);setPayClientPaye('');setPayClientDate('');}}
                  style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  {t.cancel}
                </button>
                <button onClick={handlePayClientSubmit} disabled={loading||!mPaye}
                  style={{flex:2,padding:'11px',borderRadius:10,border:'none',background:loading||!mPaye?'#6B7280':'#22C55E',color:'#fff',cursor:loading||!mPaye?'default':'pointer',fontSize:13,fontWeight:800}}>
                  {loading?'…':`${t.save} (XAF)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ MODAL EXTRAIT CLIENT ══
 */}
      {extraitData && extraitClient && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:tk.card,borderRadius:16,padding:24,width:'94%',maxWidth:860,maxHeight:'85vh',overflow:'auto',border:`1px solid ${tk.border}`}}>

            {/* Header */}
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <h3 style={{margin:0,fontSize:14,fontWeight:800,color:tk.ink}}>{extraitClient.nom}{extraitClient.prenom?` ${extraitClient.prenom}`:''}</h3>
                <div style={{fontSize:11,color:tk.faint}}>{t.clientStatementTitle} · <span style={{color:'#0EA5E9',fontWeight:600}}>XAF</span></div>
              </div>
              <button onClick={()=>setExtraitData(null)} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
            </div>

            {/* Récap totaux */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div style={{background:dark?'rgba(14,165,233,0.1)':'rgba(14,165,233,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(14,165,233,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700,letterSpacing:0.3}}>{t.totalSalesCard}</div>
                <div style={{fontSize:13,fontWeight:800,color:'#0EA5E9'}}>
                  {Math.round(extraitData.totals?.total_a_payer||0).toLocaleString('fr-FR')} XAF
                </div>
                <div style={{fontSize:9,color:tk.faint,marginTop:2}}>{extraitData.totals?.nb_ventes||0} {t.salesCountLabel}</div>
              </div>
              <div style={{background:dark?'rgba(34,197,94,0.1)':'rgba(34,197,94,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(34,197,94,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700,letterSpacing:0.3}}>{t.totalReceivedCard}</div>
                <div style={{fontSize:13,fontWeight:800,color:'#22C55E'}}>
                  {Math.round(extraitData.totals?.total_paye||0).toLocaleString('fr-FR')} XAF
                </div>
                <div style={{fontSize:9,color:tk.faint,marginTop:2}}>{extraitData.totals?.nb_paiements||0} {t.paymentsCountLabel}</div>
              </div>
              <div style={{background:dark?'rgba(245,158,11,0.1)':'rgba(245,158,11,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(245,158,11,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700,letterSpacing:0.3}}>{t.balanceDue}</div>
                <div style={{fontSize:13,fontWeight:800,color:getBalanceColor(extraitData.totals?.total_reste||0)}}>
                  {formatBalanceText(extraitData.totals?.total_reste || 0, langue)}
                </div>
                <div style={{fontSize:9,color:tk.faint,marginTop:2}}>
                  {(extraitData.totals?.total_reste||0)>0 ? t.pendingStatus : (extraitData.totals?.total_reste||0)<0 ? (langue === 'fr' ? 'Compte créditeur' : 'Account in credit') : t.settledAccount}
                </div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              {clientRoleRows.map((row) => {
                const isPorteurRow = row.role === 'porteur';
                const remaining = getSignedBalance(row.rest, 0);
                const restColor = getBalanceColor(remaining);
                return (
                  <div key={row.role} style={{
                    border:`1px solid ${tk.border}`,
                    borderRadius:12,
                    padding:'12px 14px',
                    background:isPorteurRow ? (dark?'rgba(212,175,55,0.08)':'rgba(212,175,55,0.06)') : (dark?'rgba(59,130,246,0.08)':'rgba(59,130,246,0.06)'),
                  }}>
                    <div style={{fontSize:10,fontWeight:800,color:tk.ink,letterSpacing:0.4,textTransform:'uppercase'}}>
                      {row.name || (isPorteurRow ? (langue === 'fr' ? 'Porteur d\'affaire' : 'Business Owner') : (langue === 'fr' ? 'Associé' : 'Associate'))}
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:isPorteurRow ? tk.accent : tk.blue,marginTop:3}}>
                      {Math.round(row.due || 0).toLocaleString('fr-FR')} XAF
                    </div>
                    <div style={{fontSize:10,color:tk.sub,marginTop:4}}>
                      {t.paidPrefix}: {Math.round(row.paid || 0).toLocaleString('fr-FR')} XAF
                    </div>
                    <div style={{fontSize:10,color:restColor,fontWeight:700,marginTop:2}}>
                      {t.remainingPrefix}: {formatBalanceText(remaining, langue)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{border:`1px solid ${tk.border}`,borderRadius:12,padding:'12px',marginBottom:12,background:dark?'rgba(14,165,233,0.04)':'rgba(14,165,233,0.03)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:800,color:tk.ink,letterSpacing:0.3,textTransform:'uppercase'}}>
                  {t.responsibilityByUser}
                </div>
                <div style={{fontSize:9,color:tk.faint}}>{clientUserRows.length} {t.usersCountSuffix}</div>
              </div>
              {clientUserRows.length === 0 ? (
                <div style={{fontSize:9,color:tk.faint}}>{t.noAllocationAvailable}</div>
              ) : (
                <div style={{display:'grid',gap:6}}>
                  {clientUserRows.map((row, idx) => {
                    const roleLabel = row.role === 'porteur'
                      ? (langue === 'fr' ? 'Porteur' : 'Owner')
                      : row.role === 'associe'
                        ? (langue === 'fr' ? 'Associé' : 'Associate')
                        : '';
                    return (
                      <div key={row.key} style={{
                        display:'grid',
                        gridTemplateColumns:'1.35fr 0.5fr 0.7fr 0.7fr 0.7fr 0.42fr',
                        gap:8,
                        alignItems:'center',
                        padding:'6px 0',
                        borderTop: idx === 0 ? 'none' : `1px solid ${tk.border}`,
                        fontSize:10,
                      }}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,color:tk.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {row.name}
                          </div>
                          {roleLabel && (
                            <div style={{fontSize:8,color:tk.faint}}>{roleLabel}</div>
                          )}
                        </div>
                        <div style={{textAlign:'center',fontWeight:700,color:tk.sub}}>
                          {row.activityCount}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:'#EF4444'}}>
                          {formatXafAmount(row.debt)}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:'#22C55E'}}>
                          {formatXafAmount(row.credit)}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:row.net >= 0 ? '#F59E0B' : '#22C55E'}}>
                          {formatSignedXafAmount(row.net)}
                        </div>
                        <div style={{textAlign:'right',fontSize:8,color:tk.faint}}>
                          {row.share.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* En-tête colonnes */}
            <div style={{display:'grid',gridTemplateColumns:'80px 110px 150px 150px 150px',alignItems:'center',gap:6,
              padding:'6px 0',borderBottom:`2px solid ${tk.border}`,
              fontSize:9,fontWeight:700,color:tk.faint,letterSpacing:0.5,marginBottom:4}}>
              <span>{t.dateLabel}</span><span>{t.typeLabel}</span>
              <span style={{textAlign:'right'}}>{langue === 'fr' ? 'MONTANT (XAF)' : 'AMOUNT (XAF)'}</span>
              <span style={{textAlign:'right'}}>{`${langue === 'fr' ? 'Reçu' : 'Received'} (XAF)`.toUpperCase()}</span>
              <span style={{textAlign:'right'}}>{t.balanceLabel}</span>
            </div>

            {/* Lignes transactions */}
            {(extraitData.transactions||[]).length === 0 ? (
              <div style={{textAlign:'center',padding:'20px 0',color:tk.faint,fontSize:12}}>
                {t.noTransactionRecorded}
              </div>
            ) : (extraitData.transactions||[]).map((tx, i) => {
              const breakdown = getRoleBreakdownForTransaction(tx, 'client');
              const aPayer = breakdown.totalDue;
              const paye   = breakdown.totalPaid;
              const resteCourant = parseFloat(tx.reste_courant ?? breakdown.totalRest);
              const porteurReste = getSignedBalance(tx.porteur_reste_courant, 0);
              const associeReste = getSignedBalance(tx.associe_reste_courant, 0);
              const soldé  = Math.abs(resteCourant) < 0.01;
              const isVente = tx.type === 'vente';
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'80px 110px 150px 150px 150px',
                  alignItems:'center',gap:6,padding:'9px 0',
                  borderBottom:`1px solid ${tk.border}`,fontSize:11}}>
                  <span style={{color:tk.faint,fontSize:10}}>
                    {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : '—'}
                  </span>
                  {/* Badge type */}
                  <span style={{fontWeight:700,fontSize:10,padding:'2px 7px',borderRadius:4,whiteSpace:'nowrap',
                    color:isVente?'#0EA5E9':'#22C55E',
                    background:isVente?'rgba(14,165,233,0.1)':'rgba(34,197,94,0.1)'}}>
                    {isVente ? `🛒 ${t.sale}` : `💳 ${langue === 'fr' ? 'Paiement' : 'Payment'}`}
                  </span>
                  {/* Montant à payer */}
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:'#0EA5E9'}}>
                      {aPayer > 0 ? `${Math.round(aPayer).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>}
                    </div>
                    <div style={{fontSize:9,color:tk.faint}}>P: {Math.round(breakdown.porteurDue || 0).toLocaleString('fr-FR')} XAF</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {Math.round(breakdown.associeDue || 0).toLocaleString('fr-FR')} XAF</div>
                  </div>
                  {/* Montant reçu */}
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:'#22C55E'}}>
                      {paye > 0 ? `${Math.round(paye).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>}
                    </div>
                    <div style={{fontSize:9,color:tk.faint}}>P: {Math.round(breakdown.porteurPaid || 0).toLocaleString('fr-FR')} XAF</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {Math.round(breakdown.associePaid || 0).toLocaleString('fr-FR')} XAF</div>
                  </div>
                  {/* Reste */}
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:getBalanceColor(resteCourant)}}>
                      <span style={{fontSize:9}}>{formatBalanceText(resteCourant, langue)}</span>
                    </div>
                    <div style={{fontSize:9,color:tk.faint}}>P: {formatBalanceText(porteurReste, langue)}</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {formatBalanceText(associeReste, langue)}</div>
                  </div>
                </div>
              );
            })}

            {/* Boutons actions */}
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:16}}>
              <button
                onClick={()=>genererExtraitPDF({
                  type: 'client',
                  entite: extraitClient,
                  transactions: extraitData.transactions,
                  totals: extraitData.totals,
                  langue,
                })}
                style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:10,
                  border:`1px solid ${tk.border}`,
                  background:dark?'rgba(14,165,233,0.1)':'rgba(14,165,233,0.07)',
                  color:'#0EA5E9',cursor:'pointer',fontSize:12,fontWeight:700}}>
                <Download size={14}/> {t.downloadPdf}
              </button>
              <button
                onClick={()=>{
                  const reste = getRemainingBalance(extraitData?.totals?.total_a_payer, extraitData?.totals?.total_paye);
                  setShowPayClient(extraitClient);
                  setPayClientAPayer(reste>0 ? Math.round(reste).toString() : '');
                  setPayClientPaye('');
                }}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 18px',borderRadius:10,
                  border:'none',background:'#22C55E',color:'#fff',cursor:'pointer',
                  fontSize:12,fontWeight:800,boxShadow:'0 4px 16px rgba(34,197,94,0.35)'}}>
                💳 {t.newPayment}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────

const FournisseursPageInline = ({ fournisseurs, transactions, dark, langue, tk, onCreateFournisseur, onDeleteFournisseur, onUpdateFournisseur, apiGetFournisseurExtrait, onPayFourn, onReloadFournisseurs, cmupUsdt }) => {
  const t = TRANSLATIONS[langue];
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [extraitData, setExtraitData] = useState(null);
  const [extraitFournisseur, setExtraitFournisseur] = useState(null);
  const [editFourn, setEditFourn] = useState(null);
  const [showPayFourn, setShowPayFourn] = useState(null);
  const [payFournAPayer, setPayFournAPayer] = useState('');
  const [payFournPaye, setPayFournPaye] = useState('');
  const [payFournDevise, setPayFournDevise] = useState('XAF');
  const [payFournDate, setPayFournDate] = useState(''); // Fix 6
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [showAllTransfers, setShowAllTransfers] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [transferForm, setTransferForm] = useState({
    source_id: '',
    destination_id: '',
    montant_usdt: '',
    date: '',
    notes: '',
  });

  // Form fields
  const emptyForm = { nom:'', prenom:'', telephone:'', adresse:'', ville:'', type_fournisseur:'principal' };
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState(emptyForm);

  const card = { background:tk.card, borderRadius:14, border:`1px solid ${tk.border}`, padding:'18px 20px', boxShadow:dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)' };
  const inputStyle = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${tk.border}`, background:tk.cardB, color:tk.ink, fontSize:12, outline:'none', boxSizing:'border-box' };
  const label = (txt) => <div style={{fontSize:10,color:tk.sub,marginBottom:4,fontWeight:600}}>{txt}</div>;

  const handleCreate = async () => {
    if (!form.nom.trim()) { toast.error(t.nameRequired); return; }
    setLoading(true);
    try {
      await onCreateFournisseur(form.nom.trim(), form.telephone.trim(), [form.adresse,form.ville].filter(Boolean).join(', '), form.prenom.trim(), form.type_fournisseur);
      toast.success(t.supplierCreatedSuccess); setForm(emptyForm); setShowForm(false);
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteSupplierConfirm)) return;
    try { await onDeleteFournisseur(id); toast.success(t.deletedSuccess); } catch(e) { toast.error(e.message); }
  };
  const openEdit = (f) => {
    setEditFourn(f);
    const parts = (f.adresse||'').split(',');
    setEditForm({ nom:f.nom||'', prenom:f.prenom||'', telephone:f.telephone||f.numero||'', adresse:parts[0]?.trim()||'', ville:parts[1]?.trim()||f.ville||'', type_fournisseur:f.type_fournisseur || 'secondaire' });
  };
  const handleUpdate = async () => {
    if (!editForm.nom.trim()) { toast.error(t.nameRequired); return; }
    try {
      await onUpdateFournisseur(editFourn.id, {
        nom: editForm.nom.trim(),
        prenom: editForm.prenom.trim(),
        telephone: editForm.telephone.trim(),
        adresse: [editForm.adresse,editForm.ville].filter(Boolean).join(', '),
        type_fournisseur: editForm.type_fournisseur,
      });
      toast.success(t.supplierUpdatedSuccess); setEditFourn(null);
    } catch(e) { toast.error(e.message); }
  };
  const handleTransfer = async () => {
    const sourceId = parseInt(transferForm.source_id, 10);
    const destinationId = parseInt(transferForm.destination_id, 10);
    const amount = parseFloat(String(transferForm.montant_usdt || '').replace(',', '.'));
    if (!sourceId || !destinationId || !(amount > 0) || !transferForm.date) {
      toast.error(t.allFieldsRequired);
      return;
    }
    setLoading(true);
    try {
      await apiTransferFournisseur({
        source_id: sourceId,
        destination_id: destinationId,
        montant_usdt: amount,
        date: transferForm.date,
        notes: transferForm.notes || undefined,
      });
      toast.success(t.transferSuccess);
      setTransferForm({ source_id: '', destination_id: '', montant_usdt: '', date: '', notes: '' });
      if (onReloadFournisseurs) await onReloadFournisseurs();
      const transferRows = await apiGetTransfertsFournisseurs().catch(() => null);
      if (transferRows?.transferts) setTransfers(transferRows.transferts);
      if (extraitFournisseur && (Number(extraitFournisseur.id) === sourceId || Number(extraitFournisseur.id) === destinationId)) {
        const d = await apiGetFournisseurExtrait(extraitFournisseur.id);
        setExtraitData(d);
      }
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const handleExtrait = async (f) => {
    try {
      const d = await apiGetFournisseurExtrait(f.id);
      setExtraitData(d);
      setExtraitFournisseur(f);
    } catch(e) { toast.error(`${t.statementUnavailable}: ${e.message}`); }
  };
  const getSupplierPaymentSnapshot = (supplierRecord = showPayFourn) => {
    const openedFromExtract = supplierRecord && extraitFournisseur && extraitData && Number(extraitFournisseur.id) === Number(supplierRecord.id);
    const totalDue = openedFromExtract
      ? parseFloat(extraitData?.totals?.total_a_payer_global || 0)
      : parseFloat(supplierRecord?.total_a_payer || 0);
    const totalPaid = openedFromExtract
      ? parseFloat(extraitData?.totals?.total_paye_global || 0)
      : parseFloat(supplierRecord?.total_paye || 0);
    return {
      totalDue,
      totalPaid,
      remaining: getSignedBalance(totalDue, totalPaid),
    };
  };

  // Soumission paiement fournisseur — Fix 6: 1 seul champ, XAF uniquement
  const handlePayFournSubmit = async () => {
    if (!showPayFourn) return;
    const mPaye = parseFloat((payFournPaye||'').replace(/\s/g,'').replace(/[^0-9]/g,''))||0;
    if (!mPaye) { toast.error(t.amountRequired); return; }
    const { remaining: detteReste } = getSupplierPaymentSnapshot(showPayFourn);
    setLoading(true);
    try {
      await onPayFourn({
        type: 'paiement_fournisseur',
        id_fournisseur: showPayFourn.id,
        montant_a_payer: detteReste,
        montant_paye: mPaye,
        devise: 'XAF',
        // Fix 6 : date saisie dans le modal
        date: payFournDate || null,
      });
      toast.success(langue === 'fr' ? 'Paiement enregistré ✓' : 'Payment recorded ✓');
      setShowPayFourn(null); setPayFournPaye(''); setPayFournDate('');
      if (onReloadFournisseurs) await onReloadFournisseurs();
      if (extraitFournisseur && extraitFournisseur.id === showPayFourn.id) {
        const d = await apiGetFournisseurExtrait(showPayFourn.id);
        setExtraitData(d);
      }
    } catch(e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const fmtNum = (id) => `FRN-${String(id).padStart(4,'0')}`;
  const supplierUserRows = buildAccountUserSummary(extraitData?.transactions || [], 'supplier');
  const supplierRoleRows = buildRoleLedgerSummary(extraitData?.transactions || [], 'supplier');
  const supplierRoleSummaryById = new Map(
    (fournisseurs || []).map((fournisseur) => [
      fournisseur.id,
      buildRoleLedgerSummary((transactions || []).filter((tx) => matchSupplierTransaction(tx, fournisseur)), 'supplier'),
    ])
  );
  const totalTransferredUsdt = transfers.reduce((sum, transfer) => sum + parseFloat(transfer.montant_usdt || 0), 0);
  const visibleTransfers = showAllTransfers ? transfers : transfers.slice(0, 6);
  const renderRoleAmountCell = (roleRows, total, color, accessor, totalFormatter = null) => {
    const formattedTotal = totalFormatter
      ? totalFormatter(total)
      : accessor === 'rest'
        ? formatBalanceText(total, langue)
        : (total > 0 ? `${Math.round(total).toLocaleString('fr-FR')} XAF` : null);
    return (
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
        <span style={{fontWeight:800,color:accessor === 'rest' ? getBalanceColor(total) : color}}>
          {formattedTotal || <span style={{color:tk.faint}}>—</span>}
        </span>
        {roleRows.map((row) => (
          <span key={`${row.role}-${accessor}`} style={{fontSize:9,color:tk.faint}}>
            {row.role === 'porteur' ? 'P' : 'A'}:{' '}
            {accessor === 'rest'
              ? formatBalanceText(row[accessor] || 0, langue)
              : `${Math.round(row[accessor] || 0).toLocaleString('fr-FR')} XAF`}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <h2 style={{margin:0,fontSize:16,fontWeight:800,color:tk.ink,display:'flex',alignItems:'center',gap:8}}>
          <Store size={18} color={tk.accent}/> {t.manageSuppliers}
          <span style={{fontSize:11,fontWeight:500,color:tk.faint}}>({fournisseurs.length})</span>
        </h2>
        <button onClick={()=>setShowForm(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:'none',background:tk.accent,color:'#0A1628',cursor:'pointer',fontSize:11,fontWeight:700}}>
          <Plus size={14}/> {t.newSupplier}
        </button>
        <button onClick={()=>setShowTransferForm(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:8,border:`1px solid ${tk.border}`,background:tk.cardB,color:tk.ink,cursor:'pointer',fontSize:11,fontWeight:700,marginLeft:8}}>
          <RefreshCw size={14}/> {t.transferSupplier}
        </button>
      </div>

      {/* Formulaire création */}
      {showForm && (
        <div style={{...card,borderColor:'#D4AF3740'}}>
          <h4 style={{margin:'0 0 14px',fontSize:12,fontWeight:700,color:tk.ink}}>
            {t.createSupplier}
            <span style={{fontSize:10,fontWeight:400,color:tk.faint,marginLeft:8}}>— {t.supplierCodeHint}</span>
          </h4>
          <div style={{marginBottom:10}}>{label(`${t.supplierType} *`)}<select style={inputStyle} value={form.type_fournisseur} onChange={e=>setForm(f=>({...f,type_fournisseur:e.target.value}))}>
            <option value="principal">{t.principalSupplier}</option>
            <option value="secondaire">{t.secondarySupplier}</option>
          </select></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>{label(`${t.name} *`)}<input style={inputStyle} value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.name}/></div>
            <div>{label(t.firstName)}<input style={inputStyle} value={form.prenom} onChange={e=>setForm(f=>({...f,prenom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.firstName}/></div>
            <div style={{gridColumn:'1/-1'}}>{label(t.phone)}<PhoneInput value={form.telephone} onChange={v=>setForm(f=>({...f,telephone:v}))} inputStyle={inputStyle} tk={tk} dark={dark} placeholder={t.numberPlaceholder}/><PhoneCounter value={form.telephone} langue={langue}/></div>
            <div>{label(t.addressDistrict)}<input style={inputStyle} value={form.adresse} onChange={e=>setForm(f=>({...f,adresse:e.target.value}))} placeholder={langue === 'fr' ? 'Rue, quartier' : 'Street, district'}/></div>
            <div>{label(t.city)}<input style={inputStyle} value={form.ville} onChange={e=>setForm(f=>({...f,ville:e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-'.]/g,'')}))} placeholder={langue === 'fr' ? 'Douala, Yaoundé…' : 'Douala, Yaounde…'}/></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleCreate} disabled={loading} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#22C55E',color:'#fff',cursor:'pointer',fontSize:11,fontWeight:700}}>{loading?'…':t.create}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:11}}>{t.cancel}</button>
          </div>
        </div>
      )}

      {showTransferForm && (
        <div style={{...card,borderColor:'#38BDF840'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h4 style={{margin:0,fontSize:12,fontWeight:800,color:tk.ink}}>{t.transferSupplier}</h4>
            <span style={{fontSize:10,color:tk.faint}}>{t.transferHistory}</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div>{label(`${t.sourceSupplier} *`)}<select style={inputStyle} value={transferForm.source_id} onChange={e=>setTransferForm(f=>({...f,source_id:e.target.value}))}>
              <option value="">{t.chooseSupplier}</option>
              {fournisseurs.filter(isPrincipalSupplier).map(f=><option key={f.id} value={f.id}>{f.nom}{f.prenom ? ` ${f.prenom}` : ''}</option>)}
            </select></div>
            <div>{label(`${t.destinationSupplier} *`)}<select style={inputStyle} value={transferForm.destination_id} onChange={e=>setTransferForm(f=>({...f,destination_id:e.target.value}))}>
              <option value="">{t.chooseSupplier}</option>
              {fournisseurs.filter(f=>!isPrincipalSupplier(f)).map(f=><option key={f.id} value={f.id}>{f.nom}{f.prenom ? ` ${f.prenom}` : ''}</option>)}
            </select></div>
            <div>{label(`${t.transferAmountLabel} *`)}<input type="number" min="0.0001" step="0.0001" style={inputStyle} value={transferForm.montant_usdt} onChange={e=>setTransferForm(f=>({...f,montant_usdt:e.target.value}))} placeholder="0.0000"/></div>
            <div>{label(`${t.operationDate} *`)}<input type="date" style={inputStyle} value={transferForm.date} onChange={e=>setTransferForm(f=>({...f,date:e.target.value}))}/></div>
            <div style={{gridColumn:'1/-1'}}>{label(t.description)}<input style={inputStyle} value={transferForm.notes} onChange={e=>setTransferForm(f=>({...f,notes:e.target.value}))} placeholder={t.optional}/></div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button onClick={handleTransfer} disabled={loading} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#0EA5E9',color:'#fff',cursor:loading?'default':'pointer',fontSize:11,fontWeight:700}}>{loading?'…':t.transferSupplier}</button>
            <button onClick={()=>setShowTransferForm(false)} style={{padding:'8px 16px',borderRadius:8,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:11}}>{t.cancel}</button>
          </div>
        </div>
      )}

      {transfers.length > 0 && (
        <details open={showAllTransfers} onToggle={e=>setShowAllTransfers(e.currentTarget.open)} style={{...card,padding:'12px 16px'}}>
          <summary style={{cursor:'pointer',fontSize:12,fontWeight:800,color:tk.ink,listStyle:'none',display:'flex',justifyContent:'space-between'}}>
            <span>{t.transferHistory} <span style={{fontSize:10,color:tk.faint}}>({transfers.length})</span></span>
            <span style={{fontSize:11,color:'#0EA5E9'}}>{totalTransferredUsdt.toLocaleString('fr-FR',{maximumFractionDigits:4})} USDT</span>
          </summary>
          <div style={{display:'grid',gap:6,marginTop:10}}>
            {visibleTransfers.map((tr) => (
              <div key={tr.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,padding:'8px 10px',borderRadius:8,background:tk.cardB,fontSize:11}}>
                <span style={{color:tk.ink}}>{tr.source_nom} → {tr.destination_nom}</span>
                <span style={{color:tk.faint,fontSize:10,whiteSpace:'nowrap'}}>{formatTransferDate(tr.date)}</span>
                <strong style={{color:'#0EA5E9',whiteSpace:'nowrap'}}>{Number(tr.montant_usdt || 0).toLocaleString('fr-FR',{minimumFractionDigits:4,maximumFractionDigits:4})} USDT</strong>
              </div>
            ))}
          </div>
          {transfers.length > 6 && <div style={{fontSize:10,color:tk.faint,marginTop:8}}>{showAllTransfers ? t.showLessTransfers : t.showAllTransfers}</div>}
        </details>
      )}

      {/* ── TABLE fournisseurs (identique clients) ── */}
      {fournisseurs.length === 0 ? (
        <div style={{...card,textAlign:'center',padding:'32px 0',color:tk.faint,fontSize:13}}>{t.noSupplierRegistered}</div>
      ) : (
        <div style={{...card,padding:0,overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',minWidth:860}}>
              <thead><tr style={{borderBottom:`2px solid ${tk.border}`}}>
                {['N°',t.fullName,t.phone,t.addressCity,t.amountToPay,t.amountPaidTitle,t.balanceLabel,t.actions].map((h,i)=>(
                  <th key={i} style={{padding:'8px 12px',textAlign:i>=4?'right':'left',color:tk.faint,fontSize:10,fontWeight:700,letterSpacing:0.5}}>{h.toUpperCase()}</th>
                ))}
              </tr></thead>
              <tbody>
                {fournisseurs.map((f,i)=>{
                  const aPayer = parseFloat(f.total_a_payer||0);
                  const paye   = parseFloat(f.total_paye||0);
                  const reste  = aPayer - paye;
                  const supplierStock = parseFloat(f.stock_usdt || 0);
                  const roleRows = supplierRoleSummaryById.get(f.id) || buildRoleLedgerSummary([], 'supplier');
                  return (
                    <tr key={f.id} style={{borderBottom:i<fournisseurs.length-1?`1px solid ${tk.border}`:'none'}}>
                      <td style={{padding:'10px 12px',color:tk.faint,fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{fmtNum(f.id)}</td>
                      <td style={{padding:'10px 12px'}}>
                        <div style={{fontWeight:700,color:tk.ink}}>{f.nom}{f.prenom?` ${f.prenom}`:''}</div>
                        <div style={{fontSize:10,color:tk.faint}}>
                          {f.nb_transactions||0} {t.operationsCountLabel} {t.purchaseSaleLabel}
                          <span style={{color:supplierStock < 0 ? '#EF4444' : tk.faint}}>
                            {` • ${t.usdtStockTitle}: ${supplierStock.toLocaleString('fr-FR', { maximumFractionDigits: 4 })} USDT${supplierStock < 0 ? ` (${t.supplierStockDebt})` : ''}`}
                          </span>
                        </div>
                      </td>
                      <td style={{padding:'10px 12px',color:tk.sub,whiteSpace:'nowrap'}}>{f.telephone||f.numero||'—'}</td>
                      <td style={{padding:'10px 12px',color:tk.faint,fontSize:11}}>{f.adresse||f.ville||'—'}</td>
                      {/* Fournisseur: vente = créance, achat = paiement, paiement fournisseur = paiement. */}
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(roleRows, aPayer, '#EF4444', 'due')}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(roleRows, paye, '#22C55E', 'paid')}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        {renderRoleAmountCell(
                          roleRows,
                          reste,
                          getBalanceColor(reste),
                          'rest',
                          (value) => {
                            if (aPayer <= 0 && paye <= 0) return null;
                            return formatBalanceText(value, langue);
                          }
                        )}
                      </td>
                      <td style={{padding:'10px 12px',textAlign:'right'}}>
                        <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                          <button
                            onClick={()=>{
                              const reste2 = getRemainingBalance(f.total_a_payer, f.total_paye);
                              setShowPayFourn(f);
                              setPayFournAPayer(reste2>0 ? Math.round(reste2).toString() : '');
                              setPayFournPaye('');
                            }}
                            title={t.recordPayment}
                            style={{display:'flex',alignItems:'center',gap:4,padding:'4px 8px',borderRadius:6,border:'1px solid #0EA5E9',background:'rgba(14,165,233,0.1)',color:'#0EA5E9',cursor:'pointer',fontSize:10,fontWeight:700}}>
                            💳 {t.pay}
                          </button>
                          <button onClick={()=>handleExtrait(f)} title={t.statement} style={{background:'none',border:'none',cursor:'pointer',color:tk.accent}}><FileText size={14}/></button>
                          <button onClick={()=>openEdit(f)} title={t.edit} style={{background:'none',border:'none',cursor:'pointer',color:'#F59E0B'}}><Edit2 size={14}/></button>
                          <button onClick={()=>handleDelete(f.id)} title={t.delete} style={{background:'none',border:'none',cursor:'pointer',color:'#EF4444'}}><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Modifier */}
      {editFourn && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:tk.card,borderRadius:16,padding:24,width:420,maxHeight:'90vh',overflow:'auto',border:`1px solid ${tk.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <h3 style={{margin:0,fontSize:14,fontWeight:800,color:tk.ink}}>{t.edit} — {fmtNum(editFourn.id)}</h3>
              <button onClick={()=>setEditFourn(null)} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              <div>{label(`${t.supplierType} *`)}<select style={inputStyle} value={editForm.type_fournisseur} onChange={e=>setEditForm(f=>({...f,type_fournisseur:e.target.value}))}>
                <option value="principal">{t.principalSupplier}</option>
                <option value="secondaire">{t.secondarySupplier}</option>
              </select></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>{label(`${t.name} *`)}<input style={inputStyle} value={editForm.nom} onChange={e=>setEditForm(f=>({...f,nom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.name}/></div>
                <div>{label(t.firstName)}<input style={inputStyle} value={editForm.prenom} onChange={e=>setEditForm(f=>({...f,prenom:e.target.value.replace(/[^a-zA-ZÀ-ÿ0-9\s\-'.]/g,'')}))} placeholder={t.firstName}/></div>
              </div>
              <div>{label(t.phone)}<PhoneInput value={editForm.telephone} onChange={v=>setEditForm(f=>({...f,telephone:v}))} inputStyle={inputStyle} tk={tk} dark={dark} placeholder={t.numberPlaceholder}/><PhoneCounter value={editForm.telephone} langue={langue}/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <div>{label(t.addressDistrict)}<input style={inputStyle} value={editForm.adresse} onChange={e=>setEditForm(f=>({...f,adresse:e.target.value}))} placeholder={langue === 'fr' ? 'Quartier' : 'District'}/></div>
                <div>{label(t.city)}<input style={inputStyle} value={editForm.ville} onChange={e=>setEditForm(f=>({...f,ville:e.target.value.replace(/[^a-zA-ZÀ-ÿ\s-'.]/g,'')}))} placeholder={t.city}/></div>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button onClick={handleUpdate} style={{flex:1,padding:'9px',borderRadius:8,border:'none',background:tk.accent,color:'#0A1628',cursor:'pointer',fontWeight:700,fontSize:12}}>{t.save}</button>
              <button onClick={()=>setEditFourn(null)} style={{flex:1,padding:'9px',borderRadius:8,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:12}}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL PAIEMENT FOURNISSEUR — simplifié Fix 6 ══ */}
      {showPayFourn && (() => {
        const mPaye      = parseFloat((payFournPaye||'').replace(/\s/g,'').replace(/[^0-9]/g,''))||0;
        const { totalDue: detteAPayer, totalPaid: dettePaye, remaining: detteReste } = getSupplierPaymentSnapshot(showPayFourn);
        const apresP      = detteReste - mPaye;
        return (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
            <div style={{background:tk.card,borderRadius:18,padding:28,width:400,maxHeight:'90vh',overflowY:'auto',border:`1px solid ${tk.border}`,boxShadow:'0 20px 60px rgba(0,0,0,0.3)'}}>

              {/* Header */}
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:18}}>
                <div>
                  <h3 style={{margin:0,fontSize:15,fontWeight:800,color:tk.ink}}>💳 {t.paymentSupplier}</h3>
                  <div style={{fontSize:11,color:tk.faint,marginTop:4}}>{showPayFourn.nom}{showPayFourn.prenom?` ${showPayFourn.prenom}`:''}</div>
                </div>
                <button onClick={()=>{setShowPayFourn(null);setPayFournPaye('');setPayFournDate('');}} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
              </div>

              {/* Récap dette */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:20}}>
                {[
                  {lbl:t.totalDueCard, val:detteAPayer, color:'#EF4444', bg:dark?'rgba(239,68,68,0.1)':'rgba(239,68,68,0.07)'},
                  {lbl:t.paidShort,    val:dettePaye,   color:'#22C55E', bg:dark?'rgba(34,197,94,0.1)':'rgba(34,197,94,0.07)'},
                  {lbl:t.balanceLabel, val:detteReste,  color:getBalanceColor(detteReste), bg:dark?'rgba(245,158,11,0.1)':'rgba(245,158,11,0.07)'},
                ].map(r=>(
                  <div key={r.lbl} style={{background:r.bg,borderRadius:8,padding:'8px 10px'}}>
                    <div style={{fontSize:9,color:tk.faint,marginBottom:3,fontWeight:700,letterSpacing:0.3}}>{r.lbl}</div>
                    <div style={{fontSize:11,fontWeight:800,color:r.color}}>
                      {r.lbl===t.balanceLabel ? formatBalanceText(r.val, langue) : (r.val>0 ? `${Math.round(r.val).toLocaleString('fr-FR')} XAF` : '—')}
                    </div>
                  </div>
                ))}
              </div>


              {/* Fix 6 : champ date de l'opération */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,fontWeight:700,color:tk.faint,marginBottom:7,letterSpacing:0.5}}>{t.operationDate.toUpperCase()}</div>
                <input type="date"
                  value={payFournDate || new Date().toISOString().split('T')[0]}
                  onChange={e=>setPayFournDate(e.target.value)}
                  style={{width:'100%',padding:'10px 14px',borderRadius:10,border:`2px solid ${tk.border}`,background:tk.cardB,color:tk.ink,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              </div>
              {/* Fix 6 : 1 seul champ montant */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,color:tk.faint,marginBottom:7,letterSpacing:0.5}}>{`${t.amountPaidSupplier.toUpperCase()} *`}</div>
                <input
                  type="text" inputMode="numeric"
                  value={payFournPaye}
                  onChange={e=>{ const r=e.target.value.replace(/[^0-9]/g,''); setPayFournPaye(r===''?'':parseInt(r).toLocaleString('fr-FR')); }}
                  placeholder={formatBalanceText(detteReste, langue)}
                  style={{width:'100%',padding:'12px 14px',borderRadius:10,border:`2px solid ${tk.border}`,background:tk.cardB,color:tk.ink,fontSize:16,fontWeight:700,outline:'none',boxSizing:'border-box'}}
                  autoFocus/>
              </div>

              {/* Résultat après paiement */}
              {mPaye > 0 && (
                <div style={{padding:'10px 14px',borderRadius:10,marginBottom:20,display:'flex',justifyContent:'space-between',alignItems:'center',
                  background:apresP === 0?(dark?'rgba(34,197,94,0.1)':'rgba(34,197,94,0.08)'):apresP < 0?(dark?'rgba(124,58,237,0.14)':'rgba(124,58,237,0.08)'):(dark?'rgba(245,158,11,0.1)':'rgba(245,158,11,0.08)'),
                  border:`1px solid ${apresP === 0?'rgba(34,197,94,0.3)':apresP < 0?'rgba(124,58,237,0.35)':'rgba(245,158,11,0.3)'}`}}>
                  <span style={{fontSize:11,fontWeight:600,color:tk.faint}}>{t.afterPayment}</span>
                  <span style={{fontSize:14,fontWeight:800,color:getBalanceColor(apresP)}}>
                    {formatBalanceText(apresP, langue)}
                  </span>
                </div>
              )}

              {/* Boutons */}
              <div style={{display:'flex',gap:10}}>
                <button onClick={()=>{setShowPayFourn(null);setPayFournPaye('');setPayFournDate('');}}
                  style={{flex:1,padding:'11px',borderRadius:10,border:`1px solid ${tk.border}`,background:'none',color:tk.sub,cursor:'pointer',fontSize:12,fontWeight:600}}>
                  {t.cancel}
                </button>
                <button onClick={handlePayFournSubmit} disabled={loading||!mPaye}
                  style={{flex:2,padding:'11px',borderRadius:10,border:'none',background:loading||!mPaye?'#6B7280':'#0EA5E9',color:'#fff',cursor:loading||!mPaye?'default':'pointer',fontSize:13,fontWeight:800}}>
                  {loading?'…':`${t.save} (XAF)`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal Extrait Fournisseur */}
      {extraitData && extraitFournisseur && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:999}}>
          <div style={{background:tk.card,borderRadius:16,padding:24,width:'94%',maxWidth:860,maxHeight:'85vh',overflow:'auto',border:`1px solid ${tk.border}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
              <div>
                <h3 style={{margin:0,fontSize:14,fontWeight:800,color:tk.ink}}>{extraitFournisseur.nom}{extraitFournisseur.prenom?` ${extraitFournisseur.prenom}`:''}</h3>
                <div style={{fontSize:11,color:tk.faint}}>{t.supplierStatementTitle}</div>
              </div>
              <button onClick={()=>setExtraitData(null)} style={{background:'none',border:'none',cursor:'pointer',color:tk.faint}}><X size={16}/></button>
            </div>

            {/* ✅ Récap totaux globaux */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
              <div style={{background:dark?'rgba(239,68,68,0.1)':'rgba(239,68,68,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(239,68,68,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700}}>{t.totalDueCard}</div>
                <div style={{fontSize:13,fontWeight:800,color:'#EF4444'}}>
                  {Math.round(extraitData.totals?.total_a_payer_global||0).toLocaleString('fr-FR')} XAF
                </div>
                {(cmupUsdt||0)>0 && (
                  <div style={{fontSize:10,color:tk.faint,marginTop:2}}>
                    ≈ {((extraitData.totals?.total_a_payer_global||0)/cmupUsdt).toFixed(4)} USDT
                  </div>
                )}
              </div>
              <div style={{background:dark?'rgba(34,197,94,0.1)':'rgba(34,197,94,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(34,197,94,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700}}>{t.totalPaidCard}</div>
                <div style={{fontSize:13,fontWeight:800,color:'#22C55E'}}>
                  {Math.round(extraitData.totals?.total_paye_global||0).toLocaleString('fr-FR')} XAF
                </div>
                {(cmupUsdt||0)>0 && (
                  <div style={{fontSize:10,color:tk.faint,marginTop:2}}>
                    ≈ {((extraitData.totals?.total_paye_global||0)/cmupUsdt).toFixed(4)} USDT
                  </div>
                )}
              </div>
              <div style={{background:dark?'rgba(245,158,11,0.1)':'rgba(245,158,11,0.07)',borderRadius:10,padding:'10px 14px',border:'1px solid rgba(245,158,11,0.2)'}}>
                <div style={{fontSize:9,color:tk.faint,marginBottom:4,fontWeight:700}}>{t.balanceDue}</div>
                <div style={{fontSize:13,fontWeight:800,color:getBalanceColor(extraitData.totals?.reste_global||0)}}>
                  {formatBalanceText(extraitData.totals?.reste_global || 0, langue)}
                </div>
                {(cmupUsdt||0)>0 && Math.abs(extraitData.totals?.reste_global||0) > 0 && (
                  <div style={{fontSize:10,color:tk.faint,marginTop:2}}>
                    ≈ {(Math.abs(extraitData.totals?.reste_global||0)/cmupUsdt).toFixed(4)} USDT
                  </div>
                )}
              </div>
            </div>

            {/* ✅ Détail par type */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(145px, 1fr))',gap:8,marginBottom:16}}>
              <div style={{background:dark?'rgba(99,102,241,0.08)':'rgba(99,102,241,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(99,102,241,0.15)'}}>
                <div style={{fontSize:9,color:'#818CF8',fontWeight:700,marginBottom:2}}>{`🛒 ${t.purchasesCard}`}</div>
                <div style={{fontSize:11,fontWeight:700,color:tk.ink}}>{Math.round(extraitData.totals?.total_achats||0).toLocaleString('fr-FR')} XAF</div>
                <div style={{fontSize:9,color:tk.faint}}>{extraitData.totals?.nb_achats||0} {t.purchasesCountLabel}</div>
              </div>
              <div style={{background:dark?'rgba(236,72,153,0.08)':'rgba(236,72,153,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(236,72,153,0.15)'}}>
                <div style={{fontSize:9,color:'#F472B6',fontWeight:700,marginBottom:2}}>{`💹 ${t.linkedSalesCard}`}</div>
                <div style={{fontSize:11,fontWeight:700,color:tk.ink}}>{Math.round(extraitData.totals?.total_ventes||0).toLocaleString('fr-FR')} XAF</div>
                <div style={{fontSize:9,color:tk.faint}}>{extraitData.totals?.nb_ventes||0} {t.salesCountLabel}</div>
              </div>
              <div style={{background:dark?'rgba(14,165,233,0.08)':'rgba(14,165,233,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(14,165,233,0.15)'}}>
                <div style={{fontSize:9,color:'#0EA5E9',fontWeight:700,marginBottom:2}}>{`💳 ${t.paymentsCard}`}</div>
                <div style={{fontSize:11,fontWeight:700,color:'#22C55E'}}>{Math.round(extraitData.totals?.total_paiements_paye||0).toLocaleString('fr-FR')} XAF</div>
                <div style={{fontSize:9,color:tk.faint}}>{extraitData.totals?.nb_paiements||0} {t.paymentsCountLabel}</div>
              </div>
              <div style={{background:dark?'rgba(34,197,94,0.08)':'rgba(34,197,94,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(34,197,94,0.15)'}}>
                <div style={{fontSize:9,color:'#22C55E',fontWeight:700,marginBottom:2}}>{`📦 ${t.usdtStockTitle}`}</div>
                <div style={{fontSize:11,fontWeight:700,color:(parseFloat(extraitData.totals?.stock_usdt || 0) < 0 ? '#EF4444' : tk.ink)}}>
                  {(parseFloat(extraitData.totals?.stock_usdt || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 4 })} USDT
                  {parseFloat(extraitData.totals?.stock_usdt || 0) < 0 ? ` (${t.supplierStockDebt})` : ''}
                </div>
                <div style={{fontSize:9,color:tk.faint}}>
                  +{(parseFloat(extraitData.totals?.total_achats_usdt || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                  {' / -'}
                  {(parseFloat(extraitData.totals?.total_ventes_usdt || 0)).toLocaleString('fr-FR', { maximumFractionDigits: 4 })}
                </div>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
              {supplierRoleRows.map((row) => {
                const isPorteurRow = row.role === 'porteur';
                const remaining = getSignedBalance(row.rest, 0);
                const restColor = getBalanceColor(remaining);
                return (
                  <div key={row.role} style={{
                    border:`1px solid ${tk.border}`,
                    borderRadius:12,
                    padding:'12px 14px',
                    background:isPorteurRow ? (dark?'rgba(212,175,55,0.08)':'rgba(212,175,55,0.06)') : (dark?'rgba(59,130,246,0.08)':'rgba(59,130,246,0.06)'),
                  }}>
                    <div style={{fontSize:10,fontWeight:800,color:tk.ink,letterSpacing:0.4,textTransform:'uppercase'}}>
                      {row.name || (isPorteurRow ? (langue === 'fr' ? 'Porteur d\'affaire' : 'Business Owner') : (langue === 'fr' ? 'Associé' : 'Associate'))}
                    </div>
                    <div style={{fontSize:16,fontWeight:800,color:isPorteurRow ? tk.accent : tk.blue,marginTop:3}}>
                      {Math.round(row.due || 0).toLocaleString('fr-FR')} XAF
                    </div>
                    <div style={{fontSize:10,color:tk.sub,marginTop:4}}>
                      {t.paidPrefix}: {Math.round(row.paid || 0).toLocaleString('fr-FR')} XAF
                    </div>
                    <div style={{fontSize:10,color:restColor,fontWeight:700,marginTop:2}}>
                      {t.remainingPrefix}: {formatBalanceText(remaining, langue)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{border:`1px solid ${tk.border}`,borderRadius:12,padding:'12px',marginBottom:12,background:dark?'rgba(239,68,68,0.04)':'rgba(239,68,68,0.03)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <div style={{fontSize:10,fontWeight:800,color:tk.ink,letterSpacing:0.3,textTransform:'uppercase'}}>
                  {t.responsibilityByUser}
                </div>
                <div style={{fontSize:9,color:tk.faint}}>{supplierUserRows.length} {t.usersCountSuffix}</div>
              </div>
              {supplierUserRows.length === 0 ? (
                <div style={{fontSize:9,color:tk.faint}}>{t.noAllocationAvailable}</div>
              ) : (
                <div style={{display:'grid',gap:6}}>
                  {supplierUserRows.map((row, idx) => {
                    const roleLabel = row.role === 'porteur'
                      ? (langue === 'fr' ? 'Porteur' : 'Owner')
                      : row.role === 'associe'
                        ? (langue === 'fr' ? 'Associé' : 'Associate')
                        : '';
                    return (
                      <div key={row.key} style={{
                        display:'grid',
                        gridTemplateColumns:'1.35fr 0.5fr 0.7fr 0.7fr 0.7fr 0.42fr',
                        gap:8,
                        alignItems:'center',
                        padding:'6px 0',
                        borderTop: idx === 0 ? 'none' : `1px solid ${tk.border}`,
                        fontSize:10,
                      }}>
                        <div style={{minWidth:0}}>
                          <div style={{fontWeight:800,color:tk.ink,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                            {row.name}
                          </div>
                          {roleLabel && (
                            <div style={{fontSize:8,color:tk.faint}}>{roleLabel}</div>
                          )}
                        </div>
                        <div style={{textAlign:'center',fontWeight:700,color:tk.sub}}>
                          {row.activityCount}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:'#EF4444'}}>
                          {formatXafAmount(row.debt)}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:'#22C55E'}}>
                          {formatXafAmount(row.credit)}
                        </div>
                        <div style={{textAlign:'right',fontWeight:700,color:row.net >= 0 ? '#F59E0B' : '#22C55E'}}>
                          {formatSignedXafAmount(row.net)}
                        </div>
                        <div style={{textAlign:'right',fontSize:8,color:tk.faint}}>
                          {row.share.toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* En-tête colonnes */}
            <div style={{display:'grid',gridTemplateColumns:'80px 110px 150px 150px 150px',alignItems:'center',gap:6,padding:'6px 0',borderBottom:`2px solid ${tk.border}`,fontSize:9,fontWeight:700,color:tk.faint,letterSpacing:0.5,marginBottom:4}}>
              <span>{t.dateLabel}</span><span>{t.typeLabel}</span><span style={{textAlign:'right'}}>{t.amountToPay.toUpperCase()}</span><span style={{textAlign:'right'}}>{t.paidShort}</span><span style={{textAlign:'right'}}>{t.balanceLabel}</span>
            </div>

            {(extraitData.transactions||[]).length===0?(
              <div style={{textAlign:'center',padding:'20px 0',color:tk.faint,fontSize:12}}>{t.noTransactionRecorded}</div>
            ):(extraitData.transactions||[]).map((tx,i)=>{
              const isTransfer = tx.type === 'transfert_fournisseur';
              const transferXaf = isTransfer
                ? (Number(tx.montant_xaf || 0) || Number(tx.montant_usdt || 0) * Number(cmupUsdt || 0))
                : 0;
              const breakdown = getRoleBreakdownForTransaction(tx, 'supplier');
              const aPayer = breakdown.totalDue;
              const paye   = breakdown.totalPaid;
              const resteCourant = parseFloat(tx.reste_courant ?? breakdown.totalRest);
              const porteurReste = getSignedBalance(tx.porteur_reste_courant, 0);
              const associeReste = getSignedBalance(tx.associe_reste_courant, 0);
              const soldé  = Math.abs(resteCourant) < 0.01;
              // Badges par type
              const typeBadge = isTransfer
                ? {label:`↔ ${t.transferSupplier}`, color:'#0EA5E9', bg:'rgba(14,165,233,0.1)'}
                : tx.type === 'achat'
                ? {label:`🛒 ${t.purchase}`, color:'#818CF8', bg:'rgba(99,102,241,0.1)'}
                : tx.type === 'vente'
                  ? {label:`💹 ${t.sale}`, color:'#F472B6', bg:'rgba(236,72,153,0.1)'}
                  : {label:`💳 ${langue === 'fr' ? 'Paiement' : 'Payment'}`, color:'#0EA5E9', bg:'rgba(14,165,233,0.1)'};
              return (
                <div key={i} style={{display:'grid',gridTemplateColumns:'80px 110px 150px 150px 150px',alignItems:'center',gap:6,padding:'9px 0',borderBottom:`1px solid ${tk.border}`,fontSize:11}}>
                  <span style={{color:tk.faint,fontSize:10}}>{tx.date?new Date(tx.date).toLocaleDateString('fr-FR'):'—'}</span>
                  <span style={{fontWeight:700,fontSize:10,background:typeBadge.bg,color:typeBadge.color,padding:'2px 7px',borderRadius:4,whiteSpace:'nowrap'}}>
                    {typeBadge.label}
                  </span>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:'#EF4444'}}>
                      {isTransfer ? (Number(tx.source_id) === Number(extraitFournisseur.id) ? `${Math.round(transferXaf).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>) : (aPayer>0 ? `${Math.round(aPayer).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>)}
                    </div>
                    {!isTransfer && <><div style={{fontSize:9,color:tk.faint}}>P: {Math.round(breakdown.porteurDue || 0).toLocaleString('fr-FR')} XAF</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {Math.round(breakdown.associeDue || 0).toLocaleString('fr-FR')} XAF</div></>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:'#22C55E'}}>
                      {isTransfer ? (Number(tx.destination_id) === Number(extraitFournisseur.id) ? `${Math.round(transferXaf).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>) : (paye>0 ? `${Math.round(paye).toLocaleString('fr-FR')} XAF` : <span style={{color:tk.faint}}>—</span>)}
                    </div>
                    {!isTransfer && <><div style={{fontSize:9,color:tk.faint}}>P: {Math.round(breakdown.porteurPaid || 0).toLocaleString('fr-FR')} XAF</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {Math.round(breakdown.associePaid || 0).toLocaleString('fr-FR')} XAF</div></>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color:getBalanceColor(resteCourant)}}>
                      <span style={{fontSize:9}}>{formatBalanceText(resteCourant, langue)}</span>
                    </div>
                    <div style={{fontSize:9,color:tk.faint}}>P: {formatBalanceText(porteurReste, langue)}</div>
                    <div style={{fontSize:9,color:tk.faint}}>A: {formatBalanceText(associeReste, langue)}</div>
                  </div>
                </div>
              );
            })}

            {/* Bouton nouveau paiement */}
            <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:16}}>
              <button
                onClick={()=>genererExtraitPDF({
                  type: 'fournisseur',
                  entite: extraitFournisseur,
                  transactions: extraitData.transactions,
                  totals: extraitData.totals,
                  cmupUsdt: cmupUsdt || 0,
                  langue,
                })}
                style={{display:'flex',alignItems:'center',gap:6,padding:'10px 16px',borderRadius:10,border:`1px solid ${tk.border}`,background:dark?'rgba(14,165,233,0.1)':'rgba(14,165,233,0.07)',color:'#0EA5E9',cursor:'pointer',fontSize:12,fontWeight:700}}>
                <Download size={14}/> {t.downloadPdf}
              </button>
              <button
                onClick={()=>{
                  const reste = getRemainingBalance(extraitData?.totals?.total_a_payer_global, extraitData?.totals?.total_paye_global);
                  setShowPayFourn(extraitFournisseur);
                  setPayFournAPayer(reste>0?Math.round(reste).toString():'');
                  setPayFournPaye('');
                  setPayFournDevise('XAF');
                }}
                style={{display:'flex',alignItems:'center',gap:8,padding:'10px 18px',borderRadius:10,border:'none',background:'#0EA5E9',color:'#fff',cursor:'pointer',fontSize:12,fontWeight:800,boxShadow:'0 4px 16px rgba(14,165,233,0.35)'}}>
                💳 {t.newPayment}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────

const DevisesPageInline = ({ devises, dark, langue, tk, onCreateDevise, onDeleteDevise, onUpdateDevise }) => {
  const t = TRANSLATIONS[langue];
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState(''); const [nomD, setNomD] = useState(''); const [taux, setTaux] = useState(''); const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [editDevise, setEditDevise] = useState(null);
  const [editNom, setEditNom] = useState(''); const [editTaux, setEditTaux] = useState(''); const [editDesc, setEditDesc] = useState('');

  const card = { background: tk.card, borderRadius: 14, border: `1px solid ${tk.border}`, padding: '18px 20px', boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)' };
  const inputStyle = { width: '100%', padding: '9px 12px', borderRadius: 8, border: `1px solid ${tk.border}`, background: tk.cardB, color: tk.ink, fontSize: 12, outline: 'none', boxSizing:'border-box' };

  const handleCreate = async () => {
    if (!code || !taux) { toast.error(t.codeAndRateRequired); return; }
    setLoading(true);
    try { await onCreateDevise(code.toUpperCase(), nomD||code.toUpperCase(), parseFloat(taux), desc); toast.success(t.currencyCreatedSuccess); setCode(''); setNomD(''); setTaux(''); setDesc(''); setShowForm(false); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };
  const handleDelete = async (id) => {
    if (!window.confirm(t.deleteCurrencyConfirm)) return;
    try { await onDeleteDevise(id); toast.success(t.deletedCurrencySuccess); }
    catch (e) { toast.error(e.message); }
  };
  const openEdit = (d) => { setEditDevise(d); setEditNom(d.nom||''); setEditTaux(String(d.taux_conversion||'')); setEditDesc(d.description||''); };
  const handleUpdate = async () => {
    if (!editTaux) { toast.error(t.rateRequired); return; }
    try { await onUpdateDevise(editDevise.id, { nom: editNom||editDevise.code, taux_conversion: parseFloat(editTaux), description: editDesc }); toast.success(t.currencyUpdatedSuccess); setEditDevise(null); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tk.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
          <CreditCard size={18} color={tk.accent}/> {t.manageCurrencies}
        </h2>
        <button onClick={() => setShowForm(v=>!v)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, border: 'none', background: tk.accent, color: '#0A1628', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
          <Plus size={14}/> {t.addCurrencyButton}
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, borderColor: '#D4AF3740' }}>
          <h4 style={{ margin: '0 0 14px', fontSize: 12, fontWeight: 700, color: tk.ink }}>{t.newCurrency}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontSize: 10, color: tk.sub, marginBottom: 4 }}>{t.codeExample}</div>
              <input style={inputStyle} value={code} onChange={e=>setCode(e.target.value.replace(/[^A-Za-z]/g,'').toUpperCase())} placeholder="EUR" maxLength={10}/>
            </div>
            <div><div style={{ fontSize: 10, color: tk.sub, marginBottom: 4 }}>{t.name}</div>
              <input style={inputStyle} value={nomD} onChange={e=>setNomD(e.target.value)} placeholder="Euro"/>
            </div>
            <div><div style={{ fontSize: 10, color: tk.sub, marginBottom: 4 }}>{t.currencyRateFormula}</div>
              <input type="text" inputMode="decimal" style={inputStyle} value={taux} onChange={e=>setTaux(e.target.value.replace(/[^0-9.]/g,''))} placeholder="Ex: 7.25"/>
            </div>
            <div><div style={{ fontSize: 10, color: tk.sub, marginBottom: 4 }}>{t.description}</div>
              <input style={inputStyle} value={desc} onChange={e=>setDesc(e.target.value)} placeholder={t.optional}/>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleCreate} disabled={loading} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{loading?'…':t.create}</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${tk.border}`, background: 'none', color: tk.sub, cursor: 'pointer', fontSize: 11 }}>{t.cancel}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 14 }}>
        {devises.length === 0 ? (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: tk.faint, fontSize: 13 }}>{t.noCurrency}</div>
        ) : devises.map(d => (
          <div key={d.id||d.code} style={{ background: tk.card, borderRadius: 12, border: `1px solid ${d.is_default?tk.accent+'40':tk.border}`, padding: '16px', position:'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 900, color: tk.accent, letterSpacing: 1 }}>{d.code}</div>
                <div style={{ fontSize: 11, color: tk.sub }}>{d.nom}</div>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                {d.is_default ? (
                  <span style={{ fontSize: 9, padding: '3px 7px', borderRadius: 5, background: '#22C55E20', color: '#22C55E', fontWeight: 700 }}>{t.defaultLabel}</span>
                ) : (
                  <>
                    <button onClick={() => openEdit(d)} title={t.edit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#F59E0B' }}><Edit2 size={13}/></button>
                    <button onClick={() => handleDelete(d.id)} title={t.delete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}><Trash2 size={13}/></button>
                  </>
                )}
              </div>
            </div>
            <div style={{ fontSize: 10, color: tk.faint }}>{langue === 'fr' ? 'Taux (1 USDT)' : 'Rate (1 USDT)'}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: tk.ink }}>{parseFloat(d.taux_conversion||0).toFixed(5)} {d.code}</div>
            {d.description && <div style={{ fontSize: 10, color: tk.faint, marginTop: 6 }}>{d.description}</div>}
            {d.quantite > 0 && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${tk.border}`, display:'flex', justifyContent:'space-between', fontSize:10 }}>
                <span style={{color:tk.faint}}>{langue === 'fr' ? 'Stock' : 'Stock'}</span>
                <span style={{fontWeight:700, color:tk.ink}}>{parseFloat(d.quantite).toLocaleString('fr-FR',{maximumFractionDigits:4})} {d.code}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal modifier devise */}
      {editDevise && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:999 }}>
          <div style={{ background:tk.card, borderRadius:16, padding:24, width:380, border:`1px solid ${tk.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:14, fontWeight:800, color:tk.ink }}>{t.edit} — {editDevise.code}</h3>
              <button onClick={()=>setEditDevise(null)} style={{ background:'none', border:'none', cursor:'pointer', color:tk.faint }}><X size={16}/></button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div>
                <div style={{ fontSize:10, color:tk.sub, marginBottom:4 }}>{t.name}</div>
                <input style={inputStyle} value={editNom} onChange={e=>setEditNom(e.target.value)} placeholder={t.currencyNamePlaceholder}/>
              </div>
              <div>
                <div style={{ fontSize:10, color:tk.sub, marginBottom:4 }}>{langue === 'fr' ? `Taux (1 USDT = ? ${editDevise.code}) *` : `Rate (1 USDT = ? ${editDevise.code}) *`}</div>
                <input type="text" inputMode="decimal" style={inputStyle} value={editTaux}
                  onChange={e=>setEditTaux(e.target.value.replace(/[^0-9.]/g,''))}
                  placeholder="Ex: 7.25"/>
              </div>
              <div>
                <div style={{ fontSize:10, color:tk.sub, marginBottom:4 }}>{t.description}</div>
                <input style={inputStyle} value={editDesc} onChange={e=>setEditDesc(e.target.value)} placeholder={t.optional}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={handleUpdate} style={{ flex:1, padding:'9px', borderRadius:8, border:'none', background:tk.accent, color:'#0A1628', cursor:'pointer', fontWeight:700, fontSize:12 }}>{t.save}</button>
              <button onClick={()=>setEditDevise(null)} style={{ flex:1, padding:'9px', borderRadius:8, border:`1px solid ${tk.border}`, background:'none', color:tk.sub, cursor:'pointer', fontSize:12 }}>{t.cancel}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const DistributionPageInline = ({ distributionDetails, distributionActive, dark, langue, tk, fmtN, onToggleDistribution }) => {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try { const r = await onToggleDistribution(); toast.success(r?.message || 'Mis à jour'); }
    catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  const card = { background: tk.card, borderRadius: 14, border: `1px solid ${tk.border}`, padding: '18px 20px', marginBottom: 16, boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)' };

  const PartnerSection = ({ role, color, data, label }) => (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }}/>
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: tk.ink }}>{label}</h3>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Ventes', value: data?.nb_ventes||0, plain: true },
          { label: 'Bénéf. Visible', value: fmtN(data?.total_visible||0)+' XAF', color: '#22C55E' },
          ...(distributionActive ? [{ label: 'Bénéf. Caché', value: fmtN(data?.total_cache||0)+' XAF', color: '#D4AF37' }] : []),
          { label: 'Total', value: fmtN(data?.total||0)+' XAF', color: color },
        ].map((kpi,i) => (
          <div key={i} style={{ background: dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: tk.faint, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: kpi.color||tk.ink }}>{kpi.value}</div>
          </div>
        ))}
      </div>
      {/* Tableau détail */}
      {distributionDetails?.distributions?.[role]?.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead><tr style={{ borderBottom: `1px solid ${tk.border}` }}>
              {['Date','Devise','Quantité','Taux Visible','Bénéfice', ...(distributionActive?['Taux Caché','Bénéfice']:[])].map((h,i)=>(
                <th key={i} style={{ padding:'6px 8px', textAlign:i<2?'left':'right', color:tk.faint, fontSize:9, fontWeight:700, letterSpacing:0.4 }}>{h.toUpperCase()}</th>
              ))}
            </tr></thead>
            <tbody>
              {distributionDetails.distributions[role].map((d, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${tk.border}` }}>
                  <td style={{ padding:'7px 8px', color:tk.sub }}>{d.date ? new Date(d.date).toLocaleDateString('fr-FR') : '—'}</td>
                  <td style={{ padding:'7px 8px', color:tk.ink, fontWeight:600 }}>{d.devise||'—'}</td>
                  <td style={{ padding:'7px 8px', textAlign:'right', color:tk.sub }}>{parseFloat(d.quantite||0).toFixed(4)}</td>
                  <td style={{ padding:'7px 8px', textAlign:'right', color:tk.sub }}>{fmtN(parseFloat(d.taux_visible||0))}</td>
                  <td style={{ padding:'7px 8px', textAlign:'right', color:'#22C55E', fontWeight:700 }}>{fmtN(parseFloat(d.benefice_visible||0))}</td>
                  {distributionActive && <>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:tk.faint }}>{fmtN(parseFloat(d.taux_cache||0))}</td>
                    <td style={{ padding:'7px 8px', textAlign:'right', color:'#D4AF37', fontWeight:700 }}>{fmtN(parseFloat(d.benefice_cache||0))}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tk.ink, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} color={tk.accent}/> {langue==='fr'?'Distribution des Partenaires':'Partner Distribution'}
        </h2>
        <button onClick={handleToggle} disabled={loading} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 16px', borderRadius:8, border:'none', background: distributionActive?'#EF444415':'#22C55E15', color: distributionActive?'#EF4444':'#22C55E', cursor:'pointer', fontSize:11, fontWeight:700 }}>
          {loading ? '…' : distributionActive ? '🔒 Masquer cachés' : '🔓 Afficher cachés'}
        </button>
      </div>

      <div style={{ ...card, background: dark?'rgba(212,175,55,0.06)':'rgba(212,175,55,0.04)', borderColor: '#D4AF3730', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: distributionActive?'#22C55E':'#F59E0B' }}/>
          <span style={{ fontSize: 12, fontWeight: 700, color: tk.ink }}>Mode: {distributionActive ? '✅ ACTIF — Bénéfices visibles + cachés' : '⏸️ INACTIF — Bénéfices visibles uniquement'}</span>
        </div>
      </div>

      {!distributionDetails ? (
        <div style={{ textAlign:'center', padding:'40px 0', color:tk.faint, fontSize:13 }}>
          {langue==='fr'?'Données de distribution non disponibles — vérifiez que le backend v5.6.0+ est actif':'Distribution data unavailable'}
        </div>
      ) : (
        <>
          <PartnerSection role="porteur" color={tk.accent} label={langue==='fr'?"Porteur d'Affaire":'Business Owner'} data={distributionDetails.totals?.porteur}/>
          <PartnerSection role="associe" color="#3B82F6" label={langue==='fr'?'Associé':'Associate'} data={distributionDetails.totals?.associe}/>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────
const Dashboard = ({
  user, data, profitShare, t, langue, setLangue, dark, setDark, logs, addLog,
  onLogout, onTransaction, onUpdateProfitShare, onFinalize, onEditTransaction, onDeleteTransaction, onCmupUpdate,
  clients, fournisseurs, devises, distributionDetails, distributionActive,
  onCreateClient, onDeleteClient, onUpdateClient, onPayClient, onReloadClients,
  onCreateFournisseur, onDeleteFournisseur, onUpdateFournisseur, onPayFourn, onReloadFournisseurs,
  onCreateDevise, onDeleteDevise, onUpdateDevise,
  onToggleDistribution,
  apiGetClientExtrait, apiGetFournisseurExtrait,
  genererFacturePDF, loadDataFromAPI,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [initialTxType, setInitialTxType] = useState('vente');
  const [showSettings, setShowSettings] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showStockMovement, setShowStockMovement] = useState(false);
  const [filterType, setFilterType] = useState('tous');
  const [filterStart, setFilterStart] = useState('');
  const [filterEnd, setFilterEnd] = useState('');
  const [finalisationTx, setFinalisationTx] = useState(null);
  const [editTx, setEditTx] = useState(null);
  const [chartPeriod, setChartPeriod] = useState('30');
  const [chartMetric, setChartMetric] = useState('profit');
  const [showRealPartner, setShowRealPartner] = useState(false);
  const [showVenteDetail, setShowVenteDetail] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [transactionPage, setTransactionPage] = useState(1);
  // ── v5.6.0+ navigation par onglets ──
  const [page, setPage] = useState('main'); // 'main'|'clients'|'fournisseurs'|'devises'|'distribution'

  const isPorteur = user.role === 'porteur';

  // Écouter le toggle secret du tableau partenaires (Ctrl+Shift+H)
  React.useEffect(() => {
    if (!isPorteur) return;
    const handler = (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) {
        e.preventDefault();
        e.stopPropagation();
        setShowRealPartner(v => !v);
      }
    };
    window.addEventListener('keydown', handler, true); // capture phase
    return () => window.removeEventListener('keydown', handler, true);
  }, [isPorteur]);

  React.useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const visibleTransactions = (data.transactions || []).filter((tx) => {
    if (!['paiement_client', 'paiement_fournisseur'].includes(tx.type)) return true;
    const paymentAmount = parseThousands(tx.montantPaye ?? tx.montant_paye ?? tx.montant ?? 0);
    return paymentAmount > 0;
  }); // le dashboard ignore les paiements nuls ou corrompus

  const ventesCommitted = visibleTransactions.filter(tx => tx.type === 'vente');
  const totalProfit = ventesCommitted.reduce((s, tx) => {
    // Cached seulement si porteur ET touche secrète activée
    const benefice = isPorteur && showRealPartner && tx.beneficeCachee > 0
      ? tx.beneficeCachee
      : (tx.beneficeVisible || tx.profit || 0);
    return s + benefice;
  }, 0);

  const filtered = visibleTransactions.filter(tx => {
    const matchType = filterType === 'tous' || tx.type === filterType;
    let matchDate = true;
    if (filterStart) matchDate = matchDate && new Date(tx.date) >= new Date(filterStart);
    if (filterEnd)   matchDate = matchDate && new Date(tx.date) <= new Date(filterEnd + 'T23:59:59');
    return matchType && matchDate;
  });

  const sortedFilteredTransactions = [...filtered]
    .sort((a, b) => (b.dateEnregistrement || b.date) - (a.dateEnregistrement || a.date));
  const transactionsPerPage = 10;
  const transactionPageCount = Math.max(1, Math.ceil(sortedFilteredTransactions.length / transactionsPerPage));
  const activeTransactionPage = Math.min(transactionPage, transactionPageCount);
  const paginatedTransactions = sortedFilteredTransactions.slice(
    (activeTransactionPage - 1) * transactionsPerPage,
    activeTransactionPage * transactionsPerPage
  );

  React.useEffect(() => {
    setTransactionPage(1);
  }, [filterType, filterStart, filterEnd]);

  React.useEffect(() => {
    if (transactionPage > transactionPageCount) setTransactionPage(transactionPageCount);
  }, [transactionPage, transactionPageCount]);

  // ── Données graphique marché ──
  const buildChartData = () => {
    const days = chartPeriod === 'all' ? 9999 : parseInt(chartPeriod);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    // Toutes les tx triées du plus ancien au plus récent (pour simuler le CMUP)
    const allSorted = [...visibleTransactions]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    // Simuler le CMUP réel cumulé jusqu'à la coupure
    let runStock = 0;
    let runCmup  = 0;
    allSorted.forEach(tx => {
      if (new Date(tx.date) < cutoff) {
        if (tx.type === 'achat' && tx.devise === 'USDT') {
          const newCmup = runStock <= 0
            ? tx.taux
            : ((runStock * runCmup) + (tx.quantite * tx.taux)) / (runStock + tx.quantite);
          runStock += tx.quantite;
          runCmup  = newCmup;
        } else if (tx.type === 'vente') {
          runStock = Math.max(0, runStock - (tx.usdtConsomme || 0));
          // CMUP ne change pas à la vente (méthode CMUP)
        }
      }
    });
    // runCmup est maintenant le CMUP réel au début de la période

    // Agréger par jour dans la période
    const byDay = {};
    allSorted
      .filter(tx => new Date(tx.date) >= cutoff)
      .forEach(tx => {
        const key = format(new Date(tx.date), 'dd/MM');
        if (!byDay[key]) byDay[key] = {
          date: key,
          cmup: null, // calculé après
          _stockAvant: runStock,
          _cmupAvant: runCmup,
          volume: 0, profit: 0, achats: 0, ventes: 0, nbTx: 0
        };
        byDay[key].volume += tx.montant || 0;
        byDay[key].nbTx   += 1;
        if (tx.type === 'vente') {
          byDay[key].profit += tx.beneficeVisible || 0;
          byDay[key].ventes += tx.montant || 0;
          runStock = Math.max(0, runStock - (tx.usdtConsomme || 0));
          // CMUP inchangé sur vente (méthode CMUP standard)
        }
        if (tx.type === 'achat' && tx.devise === 'USDT') {
          byDay[key].achats += tx.montant || 0;
          const nc = runStock <= 0
            ? tx.taux
            : ((runStock * runCmup) + (tx.quantite * tx.taux)) / (runStock + tx.quantite);
          runStock += tx.quantite;
          runCmup  = nc;
          byDay[key].cmup = Math.round(runCmup * 100) / 100;
        }
      });

    // Remplir les CMUP manquants avec la dernière valeur connue
    let lastCmup = data.devises.find(d => d.devise === 'USDT')?.cmup || 0;
    const result = Object.values(byDay).map(d => {
      if (d.cmup !== null) lastCmup = d.cmup;
      else d.cmup = Math.round(lastCmup * 100) / 100;
      return d;
    });

    return result.length > 0
      ? result
      : [{ date: 'Auj.', cmup: Math.round(lastCmup * 100) / 100, volume: 0, profit: 0, achats: 0, ventes: 0, nbTx: 0 }];
  };

  const chartData = buildChartData();
  const usdtInfo = data.devises.find(d => d.devise === 'USDT') || { quantite: 0, cmup: 0 };
  const totalVolume = visibleTransactions.reduce((s, tx) => s + (tx.montant || 0), 0);
  const totalVentes = visibleTransactions.filter(tx => tx.type === 'vente').length;
  const dashboardRoleMetrics = buildDashboardRoleMetrics(visibleTransactions, {
    useHiddenPartner: isPorteur && showRealPartner,
    currentStockUsdt: usdtInfo.quantite,
    currentCashXaf: data.caisse,
  });
  const responsibilitySummary = buildResponsibilitySummary({
    transactions: visibleTransactions,
    clients,
    fournisseurs,
  });
  const dashboardRoleRows = [
    { key: 'associe', label: 'A' },
    { key: 'porteur', label: 'P' },
  ];
  const formatDashboardUsdt = (value, digits = 2) =>
    `${parseThousands(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} USDT`;
  const formatDashboardXaf = (value) =>
    `${Math.round(parseThousands(value)).toLocaleString('fr-FR')} XAF`;
  const formatDashboardNumber = (value, digits = 0) =>
    parseThousands(value).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const formatDashboardSignedNumber = (value, digits = 0) => {
    const amount = parseThousands(value);
    const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';
    return `${prefix}${Math.abs(amount).toLocaleString('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
  };
  const stockUsedTotal = parseThousands(dashboardRoleMetrics.stock.used.porteur) + parseThousands(dashboardRoleMetrics.stock.used.associe);
  const cashUsedTotal = parseThousands(dashboardRoleMetrics.cash.used.porteur) + parseThousands(dashboardRoleMetrics.cash.used.associe);
  const clientsNet = responsibilitySummary.clientsSummary.debt - responsibilitySummary.clientsSummary.credit;
  const suppliersNet = responsibilitySummary.suppliersSummary.debt - responsibilitySummary.suppliersSummary.credit;
  const usedLabel = (roleLabel) => langue === 'fr' ? `${roleLabel} utilisé` : `${roleLabel} used`;
  const clientRoleDebtCredit = allocateRoleSituationFromAccounts(clients, visibleTransactions, 'client');
  const supplierRoleDebtCredit = allocateRoleSituationFromAccounts(fournisseurs, visibleTransactions, 'supplier');
  const supplierStockSummary = buildSupplierStockSummary(visibleTransactions, fournisseurs || []);
  const supplierStockRows = supplierStockSummary.rows;
  const supplierStockAvailable = parseThousands(supplierStockSummary.available);
  const supplierStockDebt = parseThousands(supplierStockSummary.debt);
  const supplierStockNet = supplierStockAvailable - supplierStockDebt;
  const supplierStockUnassigned = parseThousands(dashboardRoleMetrics.stock.remaining) - supplierStockNet;
  const supplierStockPositiveRows = supplierStockRows.filter((row) => parseThousands(row.stock) > 0.0001);
  const supplierStockKpiRows = supplierStockRows.length
    ? [
        ...(supplierStockPositiveRows.length
          ? [
              { label: langue === 'fr' ? 'Stock fournisseurs' : 'Supplier stock', section: true },
              ...supplierStockPositiveRows.map((row) => ({
                label: row.name,
                value: formatDashboardNumber(row.stock, 4),
              })),
            ]
          : []),
        ...(Math.abs(supplierStockUnassigned) > 0.0001
          ? [
              { label: langue === 'fr' ? 'Non attribué' : 'Unassigned', section: true },
              { label: langue === 'fr' ? 'Stock global' : 'Global stock', value: formatDashboardSignedNumber(supplierStockUnassigned, 4) },
            ]
          : []),
      ]
    : [{ label: t.noSupplierStock, value: '0,0000' }];

  // ── Palette thème ──
  const tk = {
    bg:      dark ? '#060B14' : '#F4F6FB',
    card:    dark ? '#0D1520' : '#FFFFFF',
    cardB:   dark ? '#1a2535' : '#F0F4FF',
    border:  dark ? '#1e2d42' : '#E8EDF5',
    ink:     dark ? '#F0F4FF' : '#0A1628',
    sub:     dark ? '#6B80A0' : '#7B8BAA',
    faint:   dark ? '#3A4D65' : '#BCC5D8',
    accent:  '#D4AF37',
    orange:  '#F57C20',
    green:   '#10B981',
    blue:    '#3B82F6',
    red:     '#EF4444',
    purple:  '#8B5CF6',
  };

  const txConfig = {
    vente:   { bg: dark ? '#10B98115' : '#DCFCE7', text: '#10B981', icon: ArrowUpRight,  label: langue==='fr'?'Vente':'Sale' },
    achat:   { bg: dark ? '#3B82F615' : '#DBEAFE', text: '#3B82F6', icon: ArrowDownLeft, label: langue==='fr'?'Achat':'Purchase' },
    depense: { bg: dark ? '#EF444415' : '#FEE2E2', text: '#EF4444', icon: FileText,      label: langue==='fr'?'Dépense':'Expense' },
    retrait: { bg: dark ? '#F59E0B15' : '#FEF3C7', text: '#F59E0B', icon: DollarSign,    label: langue==='fr'?'Retrait':'Withdrawal' },
    restock:    { bg: dark ? '#8B5CF615' : '#EDE9FE', text: '#8B5CF6', icon: RefreshCw,     label: langue==='fr'?'Restock':'Restock' },
    versement:           { bg: dark ? '#7C3AED15' : '#EDE9FE', text: '#7C3AED', icon: ArrowDownLeft, label: langue==='fr'?'Alimenter la Caisse':'Cash In' },
    paiement_client:     { bg: dark ? '#22C55E15' : '#DCFCE7', text: '#22C55E', icon: Users,        label: langue==='fr'?'Paiement Client':'Client Payment' },
    paiement_fournisseur:{ bg: dark ? '#0EA5E915' : '#E0F2FE', text: '#0EA5E9', icon: Store,        label: langue==='fr'?'Paiement Fournisseur':'Supplier Payment' },
    transfert_fournisseur:{ bg: dark ? '#06B6D415' : '#CFFAFE', text: '#0891B2', icon: RefreshCw, label: langue==='fr'?'Transfert':'Transfer' },
  };

  // ── Tooltip personnalisé recharts ──
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={{ background: tk.card, border: `1px solid ${tk.border}`, borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
        <p style={{ color: tk.sub, fontSize: 11, marginBottom: 6 }}>{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color, fontSize: 12, fontWeight: 600 }}>
            {p.name} : {typeof p.value === 'number' ? p.value.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : p.value}
            {p.name?.includes('CMUP') || p.name?.includes('Rate') ? ' XAF/USDT' :
             p.name?.includes('Vol') || p.name?.includes('Profit') ? ' XAF' : ''}
          </p>
        ))}
      </div>
    );
  };

  const chartColor = {
    cmup:   { stroke: tk.orange, fill: tk.orange },
    volume: { stroke: tk.blue,   fill: tk.blue },
    profit: { stroke: tk.green,  fill: tk.green },
    split:  null,
  };

  return (
    <div style={{ minHeight: '100vh', background: tk.bg, fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════════════════════════════════
          HEADER — barre fixe premium
      ══════════════════════════════════════ */}
      <header style={{
        background: dark ? 'rgba(13,21,32,0.97)' : 'rgba(255,255,255,0.97)',
        borderBottom: `1px solid ${tk.border}`,
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(212,175,55,0.35)',
              }}>
                <DollarSign size={18} color="#0A1628" strokeWidth={2.5} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: tk.ink, letterSpacing: '-0.3px', fontFamily: "'Playfair Display', serif" }}>FOREXIUM</div>
                <div style={{ fontSize: 9, color: tk.sub, letterSpacing: 3, fontWeight: 600 }}>PREMIUM EXCHANGE</div>
              </div>
            </div>

            {/* Centre — Métriques clés */}
            <div className="hidden md:flex" style={{ alignItems: 'center', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: tk.sub }}>{t.currentCmup}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: tk.orange }}>{usdtInfo.cmup.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} XAF</div>
              </div>
              <div style={{ width: 1, height: 28, background: tk.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: tk.sub }}>{t.usdtStockTitle}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: tk.ink }}>{usdtInfo.quantite.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</div>
              </div>
              <div style={{ width: 1, height: 28, background: tk.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: tk.sub }}>{t.caisse}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#3B82F6' }}>{data.caisse.toLocaleString('fr-FR')} <span style={{fontSize:10}}>XAF</span></div>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ marginRight: 8, textAlign: 'right' }}>
                <div style={{ fontSize: 9, color: tk.sub, letterSpacing: 0.5 }}>{t.connectedAs}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: isPorteur ? 'linear-gradient(135deg,#D4AF37,#B8941F)' : 'linear-gradient(135deg,#3B82F6,#1D4ED8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 800, fontSize: 11, flexShrink: 0,
                  }}>
                    {user.name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: tk.ink, lineHeight: 1 }}>{user.name}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: isPorteur ? '#D4AF37' : '#3B82F6', letterSpacing: 0.5 }}>
                      {(isPorteur ? t.partner : t.associate).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
              {[
                { onClick: () => { const nl = langue==='fr'?'en':'fr'; setLangue(nl); addLog('settings',`Langue → ${nl.toUpperCase()}`,user.id); }, icon: <Globe size={16}/>, title: langue==='fr'?'EN':'FR', isText: true },
                { onClick: () => { setDark(!dark); addLog('settings',`Thème → ${!dark?'Sombre':'Clair'}`,user.id); }, icon: dark ? <Sun size={16}/> : <Moon size={16}/>, color: dark?'#F59E0B':undefined },
                { onClick: () => { setShowJournal(true); addLog('settings','Journal',user.id); }, icon: <ShieldCheck size={16}/>, badge: logs.length > 0 },
                { onClick: () => setShowStockMovement(true), icon: <Activity size={16}/>, color: tk.blue },
                ...(isPorteur ? [{ onClick: () => { setShowSettings(true); addLog('settings','Paramètres',user.id); }, icon: <Settings size={16}/> }] : []),
              ].map((btn, i) => (
                <button key={i} onClick={btn.onClick} title={btn.title} style={{
                  width: btn.isText ? 'auto' : 34, height: 34,
                  padding: btn.isText ? '0 10px' : undefined,
                  borderRadius: 8, border: `1px solid ${tk.border}`,
                  background: tk.cardB, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: btn.color || tk.sub, fontSize: 11, fontWeight: 700,
                  position: 'relative', transition: 'all 0.15s',
                }}>
                  {btn.icon}
                  {btn.isText && <span style={{ marginLeft: 4 }}>{btn.title}</span>}
                  {btn.badge && <span style={{ position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: '50%', background: tk.accent }} />}
                </button>
              ))}
              <button onClick={onLogout} style={{
                height: 34, padding: '0 14px', borderRadius: 8, border: 'none',
                background: '#EF444415', color: '#EF4444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              }}>
                <LogOut size={14}/><span className="hidden sm:inline">{t.topLogout}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Navigation onglets v5.6.0+ ── */}
      <div style={{ background: dark ? '#0f1520' : '#fff', borderBottom: `1px solid ${tk.border}`, padding: '0 20px' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', gap: 0 }}>
          {[
            { id: 'main',          icon: <LayoutDashboard size={13}/>, label: langue==='fr'?'Tableau de bord':'Dashboard' },
            { id: 'clients',       icon: <Users size={13}/>,           label: langue==='fr'?'Clients':'Clients' },
            { id: 'fournisseurs',  icon: <Store size={13}/>,           label: langue==='fr'?'Fournisseurs':'Suppliers' },
            { id: 'devises',       icon: <CreditCard size={13}/>,      label: langue==='fr'?'Devises':'Currencies' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setPage(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              color: page === tab.id ? tk.accent : tk.sub,
              borderBottom: page === tab.id ? `2px solid ${tk.accent}` : '2px solid transparent',
              transition: 'all 0.15s',
              letterSpacing: 0.3,
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 20px' }}>

        {/* Bannière "en attente" supprimée : le bouton Valider sur chaque ligne suffit */}

        {page === 'main' && <React.Fragment>

        {/* ══════════════════════════════════════
            ROW 1 — KPI CARDS
        ══════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 14, marginBottom: 24 }} className="grid-kpi">
          {[
            {
              label: langue === 'fr' ? 'Total achat' : 'Total purchases',
              value: dashboardRoleMetrics.stock.totalFed.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
              unit: 'USDT',
              sub: `${langue === 'fr' ? 'Restant' : 'Remaining'} ${formatDashboardNumber(dashboardRoleMetrics.stock.remaining, 2)}`,
              icon: <Warehouse size={18}/>, color: tk.orange, delta: null,
              rows: supplierStockKpiRows,
            },
            {
              label: t.caisse,
              value: Math.round(dashboardRoleMetrics.cash.remaining).toLocaleString('fr-FR'),
              unit: 'XAF',
              sub: '',
              icon: <Banknote size={18}/>, color: '#3B82F6', delta: null,
              rows: [
                { label: usedLabel(dashboardRoleRows[0].label), value: formatDashboardNumber(dashboardRoleMetrics.cash.used.associe) },
                { label: usedLabel(dashboardRoleRows[1].label), value: formatDashboardNumber(dashboardRoleMetrics.cash.used.porteur) },
                { label: langue === 'fr' ? 'Total dépensé' : 'Total spent', value: formatDashboardNumber(cashUsedTotal) },
              ],
            },
            {
              label: t.totalProfit,
              value: Math.round(
                showRealPartner ? dashboardRoleMetrics.profit.porteur + dashboardRoleMetrics.profit.associe :
                  visibleTransactions.reduce((total, tx) => total + parseThousands(tx.partPorteur ?? tx.part_porteur_visible ?? 0) + parseThousands(tx.partAssocie ?? tx.part_associe_visible ?? 0), 0)
              ).toLocaleString('fr-FR'),
              unit: 'XAF',
              sub: `${totalVentes} vente${totalVentes>1?'s':''}`,
              icon: <TrendingUp size={18}/>, color: tk.green, delta: null,
              rows: [
                { label: dashboardRoleRows[0].label, value: formatDashboardNumber(showRealPartner ? dashboardRoleMetrics.profit.associe : visibleTransactions.reduce((total, tx) => total + parseThousands(tx.partAssocie ?? tx.part_associe_visible ?? 0), 0)) },
                { label: dashboardRoleRows[1].label, value: formatDashboardNumber(showRealPartner ? dashboardRoleMetrics.profit.porteur : visibleTransactions.reduce((total, tx) => total + parseThousands(tx.partPorteur ?? tx.part_porteur_visible ?? 0), 0)) },
              ],
            },
            {
              label: t.clientSituation,
              value: formatDashboardSignedNumber(clientsNet),
              unit: 'XAF',
              sub: `${responsibilitySummary.clientsSummary.debtCount} ${langue === 'fr' ? 'débiteurs' : 'debtors'} • ${responsibilitySummary.clientsSummary.creditCount} ${langue === 'fr' ? 'créditeurs' : 'creditors'}`,
              icon: <Users size={18}/>, color: '#38BDF8', delta: null,
              valueColor: clientsNet >= 0 ? '#38BDF8' : tk.red,
              rows: [
                {
                  label: langue === 'fr' ? 'Créance' : 'Receivable',
                  value: formatDashboardNumber(responsibilitySummary.clientsSummary.debt),
                  meta: `P ${formatDashboardNumber(clientRoleDebtCredit.porteur.debt)} • A ${formatDashboardNumber(clientRoleDebtCredit.associe.debt)}`,
                },
                {
                  label: langue === 'fr' ? 'Crédit' : 'Credit',
                  value: formatDashboardNumber(responsibilitySummary.clientsSummary.credit),
                  meta: `P ${formatDashboardNumber(clientRoleDebtCredit.porteur.credit)} • A ${formatDashboardNumber(clientRoleDebtCredit.associe.credit)}`,
                },
              ],
            },
            {
              label: t.supplierSituation,
              value: formatDashboardSignedNumber(suppliersNet),
              unit: 'XAF',
              sub: `${responsibilitySummary.suppliersSummary.debtCount} ${langue === 'fr' ? 'débiteurs' : 'debtors'} • ${responsibilitySummary.suppliersSummary.creditCount} ${langue === 'fr' ? 'créditeurs' : 'creditors'}`,
              icon: <Store size={18}/>, color: '#F97316', delta: null,
              valueColor: suppliersNet >= 0 ? '#F97316' : tk.green,
              rows: [
                {
                  label: langue === 'fr' ? 'Dette' : 'Payable',
                  value: formatDashboardNumber(responsibilitySummary.suppliersSummary.debt),
                  meta: `P ${formatDashboardNumber(supplierRoleDebtCredit.porteur.debt)} • A ${formatDashboardNumber(supplierRoleDebtCredit.associe.debt)}`,
                },
                {
                  label: langue === 'fr' ? 'Crédit' : 'Credit',
                  value: formatDashboardNumber(responsibilitySummary.suppliersSummary.credit),
                  meta: `P ${formatDashboardNumber(supplierRoleDebtCredit.porteur.credit)} • A ${formatDashboardNumber(supplierRoleDebtCredit.associe.credit)}`,
                },
              ],
            },
            {
              label: t.transactions,
              value: dashboardRoleMetrics.transactions.total,
              unit: '',
              sub: `Vol. ${formatDashboardNumber(totalVolume)}`,
              icon: <FileText size={18}/>, color: tk.purple, delta: null,
              rows: [
                { label: dashboardRoleRows[0].label, value: formatDashboardNumber(dashboardRoleMetrics.transactions.associe) },
                { label: dashboardRoleRows[1].label, value: formatDashboardNumber(dashboardRoleMetrics.transactions.porteur) },
              ],
            },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: tk.card, borderRadius: 16,
              border: `1px solid ${tk.border}`,
              padding: '18px 20px', position: 'relative', overflow: 'hidden',
              boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)',
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: kpi.color, borderRadius: '16px 16px 0 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10,
                  background: kpi.color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: kpi.color,
                }}>
                  {kpi.icon}
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tk.sub, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: kpi.valueColor || tk.ink, letterSpacing: '-0.5px', lineHeight: 1 }}>{kpi.value}</span>
                {kpi.unit && <span style={{ fontSize: 11, fontWeight: 600, color: tk.sub }}>{kpi.unit}</span>}
              </div>
              {kpi.sub ? (
                <div style={{ fontSize: 11, color: tk.faint, marginTop: 5 }}>{kpi.sub}</div>
              ) : null}
              <div style={{
                marginTop: kpi.sub ? 14 : 10,
                paddingTop: 12,
                borderTop: `1px dashed ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(10,22,40,0.10)'}`,
                display: 'grid',
                gap: 6,
              }}>
                {(kpi.rows || []).map((row, rowIdx) => row.section ? (
                  <div key={`${kpi.label}-${rowIdx}`} style={{
                    fontSize: 9,
                    color: kpi.color,
                    fontWeight: 900,
                    letterSpacing: 0.7,
                    textTransform: 'uppercase',
                    paddingTop: rowIdx === 0 ? 0 : 4,
                  }}>
                    {row.label}
                  </div>
                ) : (
                  <div key={`${kpi.label}-${rowIdx}`} style={{ display:'flex', justifyContent:'space-between', gap:8, alignItems:'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: tk.sub, fontWeight: 700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.label}</div>
                      {row.meta && (
                        <div style={{ fontSize: 8, color: tk.faint, marginTop: 2, lineHeight: 1.35 }}>
                          {row.meta}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: tk.ink, fontWeight: 800, textAlign: 'right' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════
            ROW 2 — GRAPHIQUE MARCHÉ (full width)
        ══════════════════════════════════════ */}
        <div style={{
          background: tk.card, borderRadius: 20,
          border: `1px solid ${tk.border}`,
          padding: '24px 28px', marginBottom: 24,
          boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)',
        }}>
          {/* Titre + contrôles */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tk.ink, fontFamily: "'Playfair Display', serif" }}>
                {t.marketEvolution}
              </h2>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: tk.sub }}>
                {t.marketDailyVariation}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {/* Sélecteur métrique courbe */}
              <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: tk.cardB, border: `1px solid ${tk.border}` }}>
                {[['profit', langue==='fr'?'Bénéfice':'Profit'], ['ventes', langue==='fr'?'Ventes':'Sales'], ['cmup','CMUP']].map(([k,l]) => (
                  <button key={k} onClick={() => setChartMetric(k)} style={{
                    padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: chartMetric===k ? tk.green : 'transparent',
                    color: chartMetric===k ? '#fff' : tk.sub,
                    transition: 'all 0.2s',
                  }}>{l}</button>
                ))}
              </div>
              {/* Sélecteur période */}
              <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 10, background: tk.cardB, border: `1px solid ${tk.border}` }}>
                {[['7','7j'],['30','30j'],['90','90j'],['all','Tout']].map(([k,l]) => (
                  <button key={k} onClick={() => setChartPeriod(k)} style={{
                    padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: chartPeriod===k ? tk.orange : 'transparent',
                    color: chartPeriod===k ? '#fff' : tk.sub,
                    transition: 'all 0.2s',
                  }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Graphique — courbe dynamique selon métrique sélectionnée */}
          <div>
            <div style={{ fontSize: 11, color: tk.sub, marginBottom: 8, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ display:'inline-block', width:22, height:3, background: chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green, borderRadius:2, verticalAlign:'middle' }}/>
                <span>{chartMetric==='cmup' ? 'CMUP (XAF/USDT)' : chartMetric==='ventes' ? t.salesXafLabel : t.profitXafLabel}</span>
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:tk.blue+'AA' }}/>
                <span>{t.purchasesXafLabel}</span>
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span style={{ display:'inline-block', width:10, height:10, borderRadius:2, background:tk.green+'AA' }}/>
                <span>{t.salesXafLabel}</span>
              </span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 24, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradMetric" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green} stopOpacity={0.18}/>
                    <stop offset="100%" stopColor={chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green} stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={tk.faint} strokeOpacity={0.3} vertical={false}/>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: tk.sub }} axisLine={false} tickLine={false}/>
                <YAxis yAxisId="metric"
                  tick={{ fontSize: 10, fill: chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green }} axisLine={false} tickLine={false}
                  domain={['auto','auto']}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(1)}K` : v}/>
                <YAxis yAxisId="tx" orientation="right"
                  tick={{ fontSize: 10, fill: tk.sub }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : v}/>
                <Tooltip content={<CustomTooltip />}/>
                <Bar yAxisId="tx" dataKey="achats" name={t.purchasesXafLabel}
                  fill={tk.blue} opacity={0.45} radius={[3,3,0,0]} maxBarSize={18}/>
                <Bar yAxisId="tx" dataKey="ventes" name={t.salesXafLabel}
                  fill={tk.green} opacity={0.45} radius={[3,3,0,0]} maxBarSize={18}/>
                <Area yAxisId="metric" type="monotone"
                  dataKey={chartMetric === 'ventes' ? 'ventes' : chartMetric === 'cmup' ? 'cmup' : 'profit'}
                  name={chartMetric==='cmup' ? 'CMUP XAF/USDT' : chartMetric==='ventes' ? t.salesXafLabel : t.profitXafLabel}
                  stroke={chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green}
                  fill="url(#gradMetric)" strokeWidth={2.5}
                  dot={chartData.length <= 20 ? { fill: chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green, r: 3.5, strokeWidth: 2, stroke: tk.card } : false}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: tk.card, fill: chartMetric==='cmup' ? tk.orange : chartMetric==='ventes' ? tk.blue : tk.green }}/>
              </ComposedChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 10, color: tk.faint, marginTop: 4 }}>
              💡 {langue==='fr'
                ? 'Chaque achat recalcule le CMUP par pondération. Les ventes consomment le stock sans modifier le CMUP.'
                : 'Each purchase recalculates the CMUP by weighting. Sales consume stock without changing the CMUP.'}
            </div>
          </div>

          {/* Mini KPIs graphique */}
          <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${tk.border}`, flexWrap: 'wrap' }}>
            {[ 
              { label: t.currentCmup, value: `${usdtInfo.cmup.toLocaleString('fr-FR',{maximumFractionDigits:2})} XAF/USDT`, color: tk.orange },
              { label: t.periodPurchases, value: `${chartData.reduce((s,d)=>s+d.achats,0).toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`, color: tk.blue },
              { label: t.periodProfit, value: `+${chartData.reduce((s,d)=>s+d.profit,0).toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF`, color: tk.green },
              { label: t.operationsCountFull, value: chartData.reduce((s,d)=>s+d.nbTx,0), color: tk.purple },
            ].map((kpi,i) => (
              <div key={i} style={{ flex: 1, minWidth: 100 }}>
                <div style={{ fontSize: 10, color: tk.sub, marginBottom: 3 }}>{kpi.label}</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════
            ROW 3 — TRANSACTIONS + SIDEBAR
        ══════════════════════════════════════ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }} className="grid-main">

          {/* ── COL GAUCHE : Transactions ── */}
          <div>
            {/* ── Actions rapides — haut gauche ── */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: tk.faint, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>{t.quickActions}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { type:'vente',   label:t.sellCurrency,  icon:ArrowUpRight,  color:tk.green },
                  { type:'achat',   label:t.buyCurrency,   icon:ArrowDownLeft, color:tk.blue },
                  { type:'depense', label:t.recordExpense, icon:FileText,      color:tk.red },
                  { type:'retrait', label:t.makeWithdrawal,icon:DollarSign,    color:'#F59E0B' },
                  { type:'restock', label:t.restock,       icon:RefreshCw,     color:tk.purple },
                ].map(a => {
                  const AIcon = a.icon;
                  return (
                    <button key={a.type} onClick={()=>{setInitialTxType(a.type);setShowModal(true);}}
                      style={{
                        display:'flex', alignItems:'center', gap:7,
                        padding:'8px 14px', borderRadius:10,
                        border:`1px solid ${tk.border}`,
                        background: tk.card, cursor:'pointer',
                        transition:'all 0.15s',
                        boxShadow: dark?'none':'0 1px 3px rgba(10,22,40,0.06)',
                      }}
                      onMouseEnter={e=>{ e.currentTarget.style.background=tk.cardB; e.currentTarget.style.borderColor=a.color+'60'; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=tk.card; e.currentTarget.style.borderColor=tk.border; }}>
                      <div style={{
                        width:26, height:26, borderRadius:7, flexShrink:0,
                        background: a.color+'18',
                        display:'flex', alignItems:'center', justifyContent:'center', color:a.color,
                      }}><AIcon size={13} strokeWidth={2.5}/></div>
                      <span style={{ fontSize:12, fontWeight:600, color:tk.ink }}>{a.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Titre + bouton Nouvelle transaction */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: tk.ink, fontFamily: "'Playfair Display', serif" }}>{t.transactions}</h2>
              <button onClick={() => { setInitialTxType('vente'); setShowModal(true); }} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: 'linear-gradient(135deg, #D4AF37, #B8941F)',
                color: '#0A1628', fontWeight: 700, fontSize: 12,
                boxShadow: '0 4px 12px rgba(212,175,55,0.30)',
              }}>
                <Plus size={14} strokeWidth={2.5}/>{t.newTransaction}
              </button>
            </div>

            {/* Filtres */}
            <div style={{
              background: tk.card, borderRadius: 14, border: `1px solid ${tk.border}`,
              padding: '14px 18px', marginBottom: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                <Filter size={13} color={tk.faint}/>
                {['tous','vente','achat','depense','retrait','restock','transfert_fournisseur'].map(tp => (
                  <button key={tp} onClick={() => setFilterType(tp)} style={{
                    padding: '4px 12px', borderRadius: 20, border: `1px solid ${filterType===tp ? 'transparent' : tk.border}`,
                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                    background: filterType===tp ? (tp==='vente'?tk.green:tp==='achat'?tk.blue:tp==='depense'?tk.red:tp==='retrait'?'#F59E0B':tp==='restock'?tk.purple:tk.ink) : 'transparent',
                    color: filterType===tp ? '#fff' : tk.sub,
                    transition: 'all 0.15s',
                  }}>
                    {tp==='tous'?t.all:tp==='vente'?t.sale:tp==='achat'?t.purchase:tp==='depense'?t.expense:tp==='retrait'?t.withdrawal:tp==='restock'?t.restock:(langue==='fr'?'Transferts':'Transfers')}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: tk.faint, letterSpacing: 1, textTransform: 'uppercase' }}>Période :</span>
                <input type="date" value={filterStart} onChange={e => setFilterStart(e.target.value)} style={{
                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${tk.border}`,
                  background: tk.cardB, color: tk.ink, fontSize: 11, outline: 'none',
                }}/>
                <span style={{ color: tk.faint, fontSize: 12 }}>→</span>
                <input type="date" value={filterEnd} onChange={e => setFilterEnd(e.target.value)} style={{
                  padding: '4px 10px', borderRadius: 8, border: `1px solid ${tk.border}`,
                  background: tk.cardB, color: tk.ink, fontSize: 11, outline: 'none',
                }}/>
                {(filterStart||filterEnd) && (
                  <button onClick={()=>{setFilterStart('');setFilterEnd('');}} style={{ background:'none', border:'none', cursor:'pointer', color: tk.red }}><X size={14}/></button>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 11, color: tk.faint }}>{filtered.length} résultat{filtered.length!==1?'s':''}</span>
              </div>
            </div>

            {/* Liste transactions */}
            {filtered.length === 0 ? (
              <div style={{ background: tk.card, borderRadius: 14, border: `1px solid ${tk.border}`, padding: '48px 20px', textAlign: 'center' }}>
                <Package size={36} color={tk.faint} style={{ margin: '0 auto 12px' }}/>
                <p style={{ color: tk.sub, fontSize: 13 }}>{t.noTransactions}</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* Fix Bug 3 : trier par dateEnregistrement DESC (plus récente en tête)
                    L'API trie par date_operation qui est souvent minuit → même valeur pour
                    plusieurs tx du même jour → ordre non garanti. On force ici. */}
                {paginatedTransactions.map(tx => {
                  const cfg = txConfig[tx.type] || txConfig.depense;
                  const Icon = cfg.icon;
                  const isPending = tx.statut === 'pending';
                  const isAssocPending = tx.statut === 'assoc_pending';
                  const isPorteurPending = tx.statut === 'porteur_pending';
                  const canEditTx = tx.statut !== 'committed' && (isPorteur || canAssociateEditTransaction(tx, user, nowTick));
                  const canDeleteTx = isPorteur;
                  // Dot orange pulsant : visible pour porteur sur vente ET achat assoc_pending
                  const showOrangeDot = isPorteur && isAssocPending;
                  const isTransfer = tx.type === 'transfert_fournisseur';
                  const displayAmount = ['paiement_client', 'paiement_fournisseur'].includes(tx.type)
                    ? parseThousands(tx.montantPaye ?? tx.montant_paye ?? tx.montant ?? 0)
                    : parseThousands(tx.montant ?? 0);
                  return (
                    <div key={tx.id} style={{
                      background: tk.card, borderRadius: 14,
                      border: `1px solid ${(isPending || isAssocPending) && isPorteur ? '#F59E0B40' : tk.border}`,
                      padding: '14px 18px',
                      position: 'relative',
                      boxShadow: dark?'none':'0 1px 4px rgba(10,22,40,0.05)',
                      transition: 'box-shadow 0.15s',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                          {/* Icône avec dot orange pulsant pour assoc_pending */}
                          <div style={{ position:'relative', flexShrink:0 }}>
                            <div style={{
                              width: 38, height: 38, borderRadius: 10,
                              background: cfg.bg,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <Icon size={16} color={cfg.text} strokeWidth={2.5}/>
                            </div>
                            {showOrangeDot && (
                              <div style={{
                                position:'absolute', top:-3, right:-3,
                                width:10, height:10, borderRadius:'50%',
                                background:'#F59E0B',
                                boxShadow:'0 0 0 2px ' + tk.card,
                              }}/>
                            )}
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                              <span style={{ fontSize: 11, fontWeight: 800, color: cfg.text, letterSpacing: 0.5 }}>{cfg.label.toUpperCase()}</span>
                              {isPorteur && isPending && (
                                <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 4, background:'#F59E0B20', color:'#F59E0B', fontWeight:700 }}>{t.pending.toUpperCase()}</span>
                              )}
                              {/* porteur_pending et assoc_pending : pas de badge texte */}
                              {tx.type === 'vente' && tx.deviseVente && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: tk.ink }}>{tx.quantiteDevise?.toLocaleString('fr-FR',{maximumFractionDigits:4})} {tx.deviseVente} → {tx.usdtConsomme?.toFixed(4)} USDT</span>
                              )}
                              {tx.type === 'achat' && tx.devise && (
                                <span style={{ fontSize: 12, fontWeight: 600, color: tk.ink }}>{tx.quantite?.toLocaleString('fr-FR',{maximumFractionDigits:4})} {tx.devise}</span>
                              )}
                            </div>
                            <p style={{ fontSize: 11, color: tk.sub, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {format(tx.date, 'dd/MM/yyyy HH:mm')}
                              {tx.client && ` · ${tx.client}`}
                              {tx.fournisseur && ` · ${tx.fournisseur}`}
                              {isTransfer && ` · ${tx.source_nom} → ${tx.destination_nom}`}
                              {tx.beneficiaire && ` · ${tx.beneficiaire}`}
                            </p>
                            {tx.userName && (
                              <p style={{ fontSize: 10, color: tk.faint, margin: '2px 0 0', display:'flex', alignItems:'center', gap:4 }}>
                                <span style={{ width:5, height:5, borderRadius:'50%', background: tx.userId === user.id ? tk.accent : tk.blue, display:'inline-block', flexShrink:0 }}/>
                                {tx.userName}
                              </p>
                            )}

                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: tk.ink, margin: '0 0 2px' }}>{isTransfer ? `${parseThousands(tx.montant_usdt || 0).toLocaleString('fr-FR',{minimumFractionDigits:4,maximumFractionDigits:4})} USDT` : `${displayAmount.toLocaleString('fr-FR')} XAF`}</p>
                          {isTransfer && <p style={{ fontSize: 11, fontWeight: 700, color: tk.sub, margin: '0 0 6px' }}>{parseThousands(tx.montant_xaf || 0).toLocaleString('fr-FR')} XAF</p>}
                          {(tx.beneficeVisible > 0 || tx.profit > 0) && (
                            <p style={{ fontSize: 11, fontWeight: 700, color: tk.green, margin: '0 0 6px' }}>+{(tx.beneficeVisible||tx.profit||0).toLocaleString('fr-FR',{maximumFractionDigits:0})}</p>
                          )}
                          <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'flex-end', flexWrap:'wrap' }}>
                            {/* PDF */}
                            {['vente', 'achat', 'paiement_client', 'paiement_fournisseur'].includes(tx.type) && (
                              <button onClick={()=>{genererFacturePDF(tx,langue);addLog('pdf',`PDF ${tx.id}`,user.id,{opId:tx.id});}} style={{
                                fontSize:10, fontWeight:700, color: tk.accent,
                                background:'none', border:'none', cursor:'pointer',
                                display:'flex', alignItems:'center', gap:3,
                              }}><Download size={11}/>{t.invoicePDF}</button>
                            )}

                            {/* ✅ Bouton VALIDER — visible pour toutes les tx non verrouillées */}
                            {/* Rôle UNIQUE : verrouiller la tx (statut committed = plus modifiable) */}
                            {isPorteur && tx.statut !== 'committed' && (
                              <button onClick={async () => {
                                try {
                                  // Fix Bug 1 : apiValiderTransaction (PUT /:id/valider) et non apiValiderAssoc (404)
                                  await apiValiderTransaction(tx.id);
                                  toast.success(langue==='fr' ? '🔒 Transaction verrouillée' : '🔒 Transaction locked');
                                  if (typeof loadDataFromAPI === 'function') await loadDataFromAPI();
                                } catch(e) { toast.error(e.message || 'Erreur'); }
                              }} style={{
                                fontSize:10, fontWeight:700, padding:'3px 9px',
                                borderRadius:6, border:'none', cursor:'pointer',
                                background:'#10B981', color:'#fff',
                                display:'flex', alignItems:'center', gap:3,
                              }} title={langue==='fr'?'Verrouiller la transaction':'Lock transaction'}>
                                <CheckCircle2 size={10} strokeWidth={2.5}/>
                                {langue==='fr'?'Valider':'Validate'}
                              </button>
                            )}

                            {/* 🔒 Badge verrouillé */}
                            {tx.statut === 'committed' && (
                              <span style={{
                                fontSize:10, fontWeight:600, padding:'3px 8px',
                                borderRadius:6, color:'#10B981',
                                display:'flex', alignItems:'center', gap:3,
                                background: dark?'rgba(16,185,129,0.1)':'rgba(16,185,129,0.08)',
                                border:'1px solid rgba(16,185,129,0.3)',
                              }}>
                                <Lock size={9}/>{langue==='fr'?'Verrouillé':'Locked'}
                              </span>
                            )}

                            {/* ✏️ Bouton MODIFIER — visible seulement si pas verrouillé */}
                            {canEditTx && (<>
                              <button onClick={()=>setEditTx(tx)} style={{
                                fontSize:10, fontWeight:700, padding:'3px 9px',
                                borderRadius:6, border:`1px solid ${tk.border}`, cursor:'pointer',
                                background: tk.cardB, color: tk.sub,
                                display:'flex', alignItems:'center', gap:3,
                              }}><Edit2 size={10}/>{t.modifierTx}</button>
                              {canDeleteTx && (
                                <button onClick={async () => {
                                  if (!window.confirm(langue === 'fr' ? 'Supprimer cette opération ?' : 'Delete this operation?')) return;
                                  try {
                                    await onDeleteTransaction(tx.id);
                                    toast.success(langue === 'fr' ? 'Opération supprimée' : 'Operation deleted');
                                  } catch(e) { toast.error(e.message || 'Erreur'); }
                                }} style={{
                                  fontSize:10, fontWeight:700, padding:'3px 9px',
                                  borderRadius:6, border:'none', cursor:'pointer',
                                  background:'#EF4444', color:'#fff',
                                  display:'flex', alignItems:'center', gap:3,
                                }} title={langue === 'fr' ? 'Supprimer l\'opération' : 'Delete operation'}>
                                  <Trash2 size={10} strokeWidth={2.5}/>
                                  {langue === 'fr' ? 'Supprimer' : 'Delete'}
                                </button>
                              )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {transactionPageCount > 1 && (
                  <div style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
                    padding:'8px 0 2px', flexWrap:'wrap',
                  }}>
                    <button
                      onClick={() => setTransactionPage(page => Math.max(1, page - 1))}
                      disabled={activeTransactionPage === 1}
                      aria-label={langue === 'fr' ? 'Page précédente' : 'Previous page'}
                      style={{
                        width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
                        borderRadius:8, border:`1px solid ${tk.border}`, cursor:activeTransactionPage === 1 ? 'default' : 'pointer',
                        background:tk.card, color:activeTransactionPage === 1 ? tk.faint : tk.ink,
                        opacity:activeTransactionPage === 1 ? 0.55 : 1,
                      }}
                    ><ChevronLeft size={15}/></button>
                    {Array.from({ length: transactionPageCount }, (_, index) => index + 1).map(pageNumber => (
                      <button
                        key={pageNumber}
                        onClick={() => setTransactionPage(pageNumber)}
                        aria-label={`${langue === 'fr' ? 'Page' : 'Page'} ${pageNumber}`}
                        aria-current={activeTransactionPage === pageNumber ? 'page' : undefined}
                        style={{
                          minWidth:30, height:30, padding:'0 8px', borderRadius:8,
                          border:`1px solid ${activeTransactionPage === pageNumber ? tk.accent : tk.border}`,
                          cursor:'pointer', fontSize:11, fontWeight:800,
                          background:activeTransactionPage === pageNumber ? tk.accent : tk.card,
                          color:activeTransactionPage === pageNumber ? '#0A1628' : tk.sub,
                        }}
                      >{pageNumber}</button>
                    ))}
                    <button
                      onClick={() => setTransactionPage(page => Math.min(transactionPageCount, page + 1))}
                      disabled={activeTransactionPage === transactionPageCount}
                      aria-label={langue === 'fr' ? 'Page suivante' : 'Next page'}
                      style={{
                        width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center',
                        borderRadius:8, border:`1px solid ${tk.border}`, cursor:activeTransactionPage === transactionPageCount ? 'default' : 'pointer',
                        background:tk.card, color:activeTransactionPage === transactionPageCount ? tk.faint : tk.ink,
                        opacity:activeTransactionPage === transactionPageCount ? 0.55 : 1,
                      }}
                    ><ChevronRight size={15}/></button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── COL DROITE : Sidebar ── */}
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

            {/* Stock devises */}
            <div style={{ background:tk.card, borderRadius:20, border:`1px solid ${tk.border}`, padding:'22px', boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)', position:'relative', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                <h3 style={{ margin:0, fontSize:13, fontWeight:800, color:tk.ink }}>{t.currencyStock}</h3>
                <button onClick={()=>setShowStockMovement(true)} style={{
                  fontSize:10, fontWeight:700, padding:'4px 10px', borderRadius:7,
                  border:`1px solid ${tk.border}`, background:tk.cardB, color:tk.blue, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:4,
                }}><Activity size={11}/>{langue==='fr'?'Mouvements':'Movements'}</button>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {data.devises.map(d => (
                  <DeviseCard key={d.devise} devise={d} onCmupEdit={onCmupUpdate} t={t} dark={dark} langue={langue}/>
                ))}
              </div>
            </div>

            {/* Répartition profits */}
            <div style={{ background:tk.card, borderRadius:16, border:`1px solid ${tk.border}`, padding:'20px', boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)' }}>
              <h3 style={{ margin:'0 0 14px', fontSize:13, fontWeight:800, color:tk.ink, display:'flex', alignItems:'center', gap:8 }}>
                <Users size={15} color={tk.accent}/>{t.profitShare}
              </h3>
              {/* Barre visuelle */}
              <div style={{ marginBottom:14 }}>
                <div style={{ display:'flex', borderRadius:8, overflow:'hidden', height:10, marginBottom:6 }}>
                  <div style={{ width:`${profitShare.porteur}%`, background:'linear-gradient(90deg,#D4AF37,#B8941F)', transition:'width 0.4s' }}/>
                  <div style={{ flex:1, background: dark?'#1e2d42':'#E8EDF5', transition:'width 0.4s' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:tk.sub }}>
                  <span>Porteur {profitShare.porteur}%</span>
                  <span>Associé {profitShare.associe}%</span>
                </div>
              </div>
              {(() => {
                const toutesVentesRep = data.transactions.filter(tx => tx.type === 'vente');
                const totalPorteurRep = toutesVentesRep.reduce((s, tx) =>
                  s + (isPorteur && showRealPartner && tx.beneficeCachee > 0 ? (tx.partPorteurCache || 0) : (tx.partPorteur || 0)), 0);
                const totalAssocieRep = toutesVentesRep.reduce((s, tx) =>
                  s + (isPorteur && showRealPartner && tx.beneficeCachee > 0 ? (tx.partAssocieCache || 0) : (tx.partAssocie || 0)), 0);
                return [
                  { label:`${t.partner} (${profitShare.porteur}%)`, value: totalPorteurRep, color:tk.accent, bg: dark?'#D4AF3710':'#FFFBEB' },
                  { label:`${t.associate} (${profitShare.associe}%)`, value: totalAssocieRep, color:tk.ink, bg: tk.cardB },
                ].map((row,i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', borderRadius:10, background:row.bg, marginBottom:6 }}>
                    <span style={{ fontSize:12, color:tk.sub }}>{row.label}</span>
                    <span style={{ fontSize:14, fontWeight:800, color:row.color }}>{row.value.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF</span>
                  </div>
                ));
              })()}
            </div>

            {/* Tableau de Bord des Partenaires */}
            {(() => {
              const toutesVentes = data.transactions.filter(tx => tx.type === 'vente');

              // ── Vue VISIBLE ──────────────────────────────────────────────
              const partPorteurVisible   = toutesVentes.reduce((s, tx) => s + (tx.partPorteur || 0), 0);
              const partAssocieVisible   = toutesVentes.reduce((s, tx) => s + (tx.partAssocie || 0), 0);
              const beneficeTotalVisible = toutesVentes.reduce((s, tx) => s + (tx.beneficeVisible || tx.profit || 0), 0);

              // ── Vue RÉELLE (Ctrl+Shift+H) ────────────────────────────────
              // Cumul correct : ventes SANS taux caché → valeur visible ; ventes AVEC → valeur cachée
              // Ex : 50 visible + 10 visible = 60 visible | 50 visible + 12 caché = 62 réel
              const partPorteurReel   = toutesVentes.reduce((s, tx) =>
                s + (tx.beneficeCachee > 0 ? (tx.partPorteurCache || 0) : (tx.partPorteur || 0)), 0);
              const partAssocieReel   = toutesVentes.reduce((s, tx) =>
                s + (tx.beneficeCachee > 0 ? (tx.partAssocieCache || 0) : (tx.partAssocie || 0)), 0);
              const beneficeTotalReel  = toutesVentes.reduce((s, tx) =>
                s + (tx.beneficeCachee > 0 ? tx.beneficeCachee : (tx.beneficeVisible || tx.profit || 0)), 0);

              const pPorteur = isPorteur && showRealPartner ? partPorteurReel  : partPorteurVisible;
              const pAssocie = isPorteur && showRealPartner ? partAssocieReel  : partAssocieVisible;
              const bTotal   = isPorteur && showRealPartner ? beneficeTotalReel : beneficeTotalVisible;

              return (
                <div style={{
                  background: isPorteur && showRealPartner
                    ? (dark ? 'rgba(212,175,55,0.07)' : 'rgba(212,175,55,0.05)')
                    : tk.card,
                  borderRadius:16,
                  border: isPorteur && showRealPartner
                    ? '2px solid rgba(212,175,55,0.55)'
                    : `2px solid ${isPorteur ? '#D4AF3730':'#3B82F630'}`,
                  padding:'18px 20px',
                  boxShadow: dark?'0 2px 12px rgba(0,0,0,0.25)':'0 2px 8px rgba(10,22,40,0.06)',
                  transition: 'border-color 0.3s, background 0.3s',
                }}>
                  <h3 style={{ margin:'0 0 12px', fontSize:13, fontWeight:800, color:tk.ink, display:'flex', alignItems:'center', gap:8 }}>
                    <Shield size={15} color={isPorteur && showRealPartner ? '#D4AF37' : (isPorteur ? tk.accent : tk.blue)}/>
                    {langue==='fr' ? 'Tableau des Partenaires' : 'Partners Overview'}
                  </h3>

                  {/* Porteur */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:tk.accent, letterSpacing:1, textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:tk.accent}}/> {langue==='fr' ? "Porteur d'affaire" : 'Business Owner'}
                    </div>
                    {[
                      { label: langue==='fr' ? 'Part sur bénéfices' : 'Profit share', value: pPorteur },
                      { label: langue==='fr' ? 'Total cumulé porteur' : 'Total owner', value: pPorteur, bold:true, accent:true },
                    ].map((r,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:7, marginBottom:3, background: r.bold ? (dark?'#D4AF3715':'#FFFBEB') : 'transparent' }}>
                        <span style={{ fontSize:11, color: r.bold ? tk.accent : tk.sub }}>{r.label}</span>
                        <span style={{ fontSize:12, fontWeight: r.bold?800:600, color: r.accent ? tk.accent : (dark?'#F0F4FF':'#0A1628') }}>{r.value.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ height:1, background: dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.05)', margin:'8px 0' }} />

                  {/* Associé */}
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:tk.blue, letterSpacing:1, textTransform:'uppercase', marginBottom:6, display:'flex', alignItems:'center', gap:4 }}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:tk.blue}}/> {langue==='fr' ? 'Associé' : 'Associate'}
                    </div>
                    {[
                      { label: langue==='fr' ? 'Part sur bénéfices' : 'Profit share', value: pAssocie },
                      { label: langue==='fr' ? 'Total cumulé associé' : 'Total associate', value: pAssocie, bold:true, blue:true },
                    ].map((r,i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'5px 8px', borderRadius:7, marginBottom:3, background: r.bold ? (dark?'#3B82F615':'#EFF6FF') : 'transparent' }}>
                        <span style={{ fontSize:11, color: r.bold ? tk.blue : tk.sub }}>{r.label}</span>
                        <span style={{ fontSize:12, fontWeight: r.bold?800:600, color: r.blue ? tk.blue : (dark?'#F0F4FF':'#0A1628') }}>{r.value.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF</span>
                      </div>
                    ))}
                  </div>

                  {/* ── Détail par vente ── */}
                  <div style={{ marginTop:10 }}>
                    <button
                      onClick={() => setShowVenteDetail(v => !v)}
                      style={{
                        width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                        padding:'7px 10px', borderRadius:8, border:`1px solid ${tk.border}`,
                        background: dark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.02)',
                        cursor:'pointer', color:tk.sub, fontSize:10, fontWeight:700,
                      }}
                    >
                      <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <TrendingUp size={10}/>
                        {langue==='fr' ? `Détail par vente (${toutesVentes.filter(tx=>tx.statut==='committed'||tx.statut==='assoc_pending'||tx.statut==='porteur_pending').length})` : `Per-sale breakdown (${toutesVentes.filter(tx=>tx.statut==='committed'||tx.statut==='assoc_pending'||tx.statut==='porteur_pending').length})`}
                      </span>
                      <span style={{ fontSize:9, color:tk.faint }}>{showVenteDetail ? '▲' : '▼'}</span>
                    </button>

                    {showVenteDetail && (() => {
                      const ventesDetail = toutesVentes
                        .filter(tx => tx.statut === 'committed' || tx.statut === 'assoc_pending' || tx.statut === 'porteur_pending')
                        .sort((a, b) => new Date(b.date) - new Date(a.date));
                      const showCache = isPorteur && showRealPartner;
                      return (
                        <div style={{ marginTop:6, maxHeight:300, overflowY:'auto', borderRadius:8, border:`1px solid ${tk.border}` }}>
                          {/* Header */}
                          <div style={{
                            display:'grid',
                            gridTemplateColumns: showCache ? '1fr 80px 80px 80px 80px' : '1fr 80px 70px 70px',
                            gap:4, padding:'5px 8px',
                            background: dark?'rgba(255,255,255,0.04)':'rgba(0,0,0,0.03)',
                            borderBottom:`1px solid ${tk.border}`,
                            position:'sticky', top:0,
                          }}>
                            {['Date', langue==='fr'?'Bén. visible':'Visible', ...(showCache ? [langue==='fr'?'Bén. caché':'Hidden'] : []), langue==='fr'?'Part porteur':'Owner', langue==='fr'?'Part associé':'Assoc.'].map((h,i) => (
                              <span key={i} style={{ fontSize:9, fontWeight:700, color:tk.faint, textAlign: i===0?'left':'right', textTransform:'uppercase', letterSpacing:0.4 }}>{h}</span>
                            ))}
                          </div>

                          {ventesDetail.length === 0 ? (
                            <div style={{ padding:'12px', textAlign:'center', fontSize:11, color:tk.faint }}>{langue==='fr'?'Aucune vente enregistrée':'No recorded sales'}</div>
                          ) : ventesDetail.map((tx, i) => {
                            const benV = tx.beneficeVisible || tx.profit || 0;
                            const benC = tx.beneficeCachee || 0;
                            const pP   = showCache && benC > 0 ? (tx.partPorteurCache || 0) : (tx.partPorteur || 0);
                            const pA   = showCache && benC > 0 ? (tx.partAssocieCache || 0) : (tx.partAssocie || 0);
                            const isPending = tx.statut === 'assoc_pending' || tx.statut === 'porteur_pending';
                            return (
                              <div key={tx.id} style={{
                                display:'grid',
                                gridTemplateColumns: showCache ? '1fr 80px 80px 80px 80px' : '1fr 80px 70px 70px',
                                gap:4, padding:'6px 8px',
                                borderBottom: i < ventesDetail.length-1 ? `1px solid ${tk.border}` : 'none',
                                background: isPending ? (dark?'rgba(245,158,11,0.04)':'rgba(245,158,11,0.03)') : 'transparent',
                                alignItems:'center',
                              }}>
                                {/* Date + devise */}
                                <div style={{ minWidth:0 }}>
                                  <div style={{ fontSize:10, fontWeight:600, color:tk.ink, display:'flex', alignItems:'center', gap:4 }}>
                                    {tx.deviseVente && <span style={{ fontSize:9, padding:'1px 4px', borderRadius:3, background: dark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)', color:tk.sub }}>{tx.deviseVente}</span>}
                                    {isPending && <span style={{ fontSize:8, padding:'1px 4px', borderRadius:3, background:'rgba(245,158,11,0.15)', color:'#F59E0B' }}>•</span>}
                                  </div>
                                  <div style={{ fontSize:9, color:tk.faint }}>{format(tx.date,'dd/MM/yy')}</div>
                                </div>
                                {/* Bénéfice visible */}
                                <span style={{ fontSize:10, fontWeight:700, color:tk.green, textAlign:'right' }}>
                                  {benV > 0 ? `+${benV.toLocaleString('fr-FR',{maximumFractionDigits:0})}` : '—'}
                                </span>
                                {/* Bénéfice caché (porteur+réel seulement) */}
                                {showCache && (
                                  <span style={{ fontSize:10, fontWeight:700, color:'#D4AF37', textAlign:'right' }}>
                                    {benC > 0 ? `+${benC.toLocaleString('fr-FR',{maximumFractionDigits:0})}` : '—'}
                                  </span>
                                )}
                                {/* Part porteur */}
                                <span style={{ fontSize:10, fontWeight:600, color:tk.accent, textAlign:'right' }}>
                                  {pP > 0 ? pP.toLocaleString('fr-FR',{maximumFractionDigits:0}) : '—'}
                                </span>
                                {/* Part associé */}
                                <span style={{ fontSize:10, fontWeight:600, color:tk.blue, textAlign:'right' }}>
                                  {pA > 0 ? pA.toLocaleString('fr-FR',{maximumFractionDigits:0}) : '—'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ marginTop:10, padding:'8px 10px', borderRadius:8, background: dark?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.02)', border:`1px solid ${tk.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:10, color:tk.faint }}>{langue==='fr' ? 'Bénéfice total opérations' : 'Total operations profit'}</span>
                    <span style={{ fontSize:13, fontWeight:800, color:tk.ink }}>{bTotal.toLocaleString('fr-FR',{maximumFractionDigits:0})} XAF</span>
                  </div>
                </div>
              );
            })()}


          </div>
        </div>
        {/* ── FIN page principale ── */}
        </React.Fragment>}

        {/* ═══════════════════════════════════════
            PAGE CLIENTS
        ════════════════════════════════════════ */}
        {page === 'clients' && <ClientsPageInline
          clients={clients} transactions={data.transactions} dark={dark} langue={langue} tk={tk}
          onCreateClient={onCreateClient} onDeleteClient={onDeleteClient}
          onUpdateClient={onUpdateClient}
          apiGetClientExtrait={apiGetClientExtrait}
          onPayClient={onPayClient}
          onReloadClients={onReloadClients}
        />}

        {/* ═══════════════════════════════════════
            PAGE FOURNISSEURS
        ════════════════════════════════════════ */}
        {page === 'fournisseurs' && <FournisseursPageInline
          fournisseurs={fournisseurs} transactions={data.transactions} dark={dark} langue={langue} tk={tk}
          onCreateFournisseur={onCreateFournisseur} onDeleteFournisseur={onDeleteFournisseur}
          onUpdateFournisseur={onUpdateFournisseur}
          apiGetFournisseurExtrait={apiGetFournisseurExtrait}
          onPayFourn={onPayFourn}
          onReloadFournisseurs={onReloadFournisseurs}
          cmupUsdt={(data.devises?.find(d=>d.devise==='USDT')?.cmup)||0}
        />}

        {/* ═══════════════════════════════════════
            PAGE DEVISES
        ════════════════════════════════════════ */}
        {page === 'devises' && <DevisesPageInline
          devises={devises} dark={dark} langue={langue} tk={tk}
          onCreateDevise={onCreateDevise} onDeleteDevise={onDeleteDevise}
          onUpdateDevise={onUpdateDevise}
        />}

        {/* ═══════════════════════════════════════
            PAGE DISTRIBUTION
        ════════════════════════════════════════ */}
        {page === 'distribution' && <DistributionPageInline
          distributionDetails={distributionDetails} distributionActive={distributionActive}
          dark={dark} langue={langue} tk={tk} fmtN={(v) => Math.round(v).toLocaleString('fr-FR')}
          onToggleDistribution={onToggleDistribution}
        />}

      </main>

      {/* ── Modales ── */}
      {showModal && (
        <TransactionModal data={data} profitShare={profitShare} user={user}
          onClose={()=>setShowModal(false)}
          onSubmit={tx=>{onTransaction(tx);setShowModal(false);}}
          t={t} dark={dark} langue={langue} initialType={initialTxType}
          fournisseurs={fournisseurs||[]} clients={clients||[]} devises={devises||[]}/>
      )}
      {showSettings && isPorteur && (
        <SettingsModal profitShare={profitShare} onClose={()=>setShowSettings(false)}
          onUpdate={s=>onUpdateProfitShare(s)} t={t} dark={dark}/>
      )}
      {showJournal && (
        <JournalModal logs={logs} onClose={()=>setShowJournal(false)} t={t} dark={dark}/>
      )}
      {showStockMovement && (
        <StockMovementModal data={data} user={user} fournisseurs={fournisseurs || []}
          onClose={()=>setShowStockMovement(false)}
          t={t} dark={dark} langue={langue}/>
      )}
      {finalisationTx && isPorteur && (
        <FinalisationModal
          transaction={finalisationTx} profitShare={profitShare}
          onClose={()=>setFinalisationTx(null)} onFinalize={onFinalize}
          t={t} dark={dark} langue={langue}/>
      )}
      {/* Fix 5 : EditModal remplacé par TransactionModal identique à la création */}
      {editTx && (isPorteur || canAssociateEditTransaction(editTx, user, nowTick)) && (
        <TransactionModal
          data={data} profitShare={profitShare} user={user}
          onClose={()=>setEditTx(null)}
          onSubmit={tx=>{ onEditTransaction(editTx.id, { ...tx, _isEdit: true }); setEditTx(null); }}
          t={t} dark={dark} langue={langue}
          initialType={editTx.type === 'paiement_client' ? 'paiement_client'
            : editTx.type === 'paiement_fournisseur' ? 'paiement_fournisseur'
            : editTx.type === 'achat' ? 'achat'
            : editTx.type === 'depense' ? 'depense'
            : editTx.type === 'retrait' ? 'retrait'
            : editTx.type === 'versement' ? 'restock'
            : 'vente'}
          initialValues={{
            date: editTx.date,
            devise: editTx.devise,
            deviseVente: editTx.deviseVente || editTx.devise_vente,
            tauxConversion: editTx.tauxConversion,
            tauxAchatXAF: editTx.tauxAchatXAF,
            ancien_cmup: editTx.ancien_cmup,
            cmup_operation: editTx.cmup_operation ?? editTx.cmupOperation ?? null,
            tauxVisible: editTx.tauxVisible,
            tauxCache: editTx.tauxCache ?? editTx.taux_vente_cache,
            taux: editTx.taux,
            quantite: editTx.quantiteDevise || editTx.quantite,
            usdtConsomme: editTx.usdtConsomme,
            stockUsdt_avant: editTx.stockUsdt_avant,
            nouveau_cmup: editTx.nouveau_cmup,
            client: editTx.client,
            id_client: editTx.idClient || editTx.id_client,
            fournisseur: editTx.fournisseur,
            id_fournisseur: editTx.idFournisseur || editTx.id_fournisseur,
            porteurPct: editTx.porteurPct,
            associePct: editTx.associePct,
            partPorteur: editTx.partPorteur,
            partAssocie: editTx.partAssocie,
            porteurPctCache: editTx.porteurPctCache,
            montant: editTx.montant,
            montant_paye: editTx.montantPaye || editTx.montant_paye,
            montant_a_payer: editTx.montantAPayer || editTx.montant_a_payer,
            categorie: editTx.categorie,
            description: editTx.description,
            beneficiaire: editTx.beneficiaire,
            use_caisse: editTx.useCaisse || editTx.use_caisse,
          }}
          isEdit={true}
          fournisseurs={fournisseurs||[]} clients={clients||[]} devises={devises||[]}/>
      )}
    </div>
  );
};


// ─────────────────────────────────────────────────────────────
// APP PRINCIPALE
// ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [langue, setLangue] = useState('fr');
  const [dark, setDark] = useState(false);
  const [profitShare, setProfitShare] = useState(DEFAULT_PROFIT_SHARE);
  const [logs, setLogs] = useState([]);
  const [sessionStart, setSessionStart] = useState(null);
  const [loading, setLoading] = useState(false);

  // ── v5.6.0+ nouveaux états ──
  const [clients, setClients] = useState([]);
  const [fournisseurs, setFournisseurs] = useState([]);
  const [devises, setDevises] = useState([]);
  const [distributionDetails, setDistributionDetails] = useState(null);
  const [distributionActive, setDistributionActive] = useState(false);

  const [data, setData] = useState({
    depot: 0,
    caisse: 500000,
    devises: [{ devise: 'USDT', quantite: 0, cmup: 0 }],
    transactions: []
  });

  const t = TRANSLATIONS[langue];

  const addLog = (type, desc, userId = null, meta = {}) => {
    const log = createLog(type, desc, userId, meta);
    setLogs(prev => [...prev, log]);
    return log;
  };

  // ── Persistance préférences UI uniquement (pas les données métier) ──
  useEffect(() => {
    try {
      const slang = localStorage.getItem('fx_lang');
      const sdark = localStorage.getItem('fx_dark');
      const stoken = localStorage.getItem('fx_token');
      const suser = localStorage.getItem('fx_user');
      if (slang) setLangue(slang);
      if (sdark) setDark(JSON.parse(sdark));
      // Restaurer session si token encore valide
      if (stoken && suser) {
        const u = JSON.parse(suser);
        setUser(u);
        setSessionStart(new Date());
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem('fx_lang', langue);
    localStorage.setItem('fx_dark', JSON.stringify(dark));
  }, [langue, dark]);

  // ── loadDataFromAPI ──────────────────────────────────────────
  const loadDataFromAPI = useCallback(async () => {
    const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const tok  = localStorage.getItem('fx_token');
    const hdr  = { 'Content-Type':'application/json', ...(tok?{Authorization:`Bearer ${tok}`}:{}) };
    const safe = async (res) => { try { const j = await res.json(); return res.ok ? j : null; } catch { return null; } };

    try {
      setLoading(true);

      // ── 1. Chargements principaux en parallèle ──
      const [cRes, txRes, stRes, repRes, settingsRes] = await Promise.all([
        fetch(`${BASE}/stats/comptes`,     {headers:hdr}),
        fetch(`${BASE}/transactions?limit=500`,{headers:hdr}),
        fetch(`${BASE}/stock`,             {headers:hdr}),
        fetch(`${BASE}/stats/repartition`, {headers:hdr}),
        fetch(`${BASE}/settings`,           {headers:hdr}),
      ]);
      const [comptes, txData, stock, repartition, settings] = await Promise.all([cRes,txRes,stRes,repRes,settingsRes].map(safe));
      if (!comptes || !txData) throw new Error('Données principales indisponibles');

      // ── 2. Normaliser transactions ──
      const transactions = (txData.transactions || []).map(tx => ({
        ...tx,
        id: tx.id, type: tx.type,
        date: new Date(tx.date_operation || tx.date || tx.date_enregistrement || Date.now()),
        dateEnregistrement: tx.date_enregistrement ? new Date(tx.date_enregistrement) : new Date(),
        dateModification: tx.date_modification ? new Date(tx.date_modification) : null,
        montant: ['paiement_client', 'paiement_fournisseur'].includes(tx.type)
          ? parseFloat(tx.montant_paye || tx.montant || 0)
          : tx.type === 'vente'
            ? parseFloat(tx.valeur_vente_visible || tx.montant || tx.prix_achat_total || 0)
            : parseFloat(tx.montant || tx.prix_achat_total || tx.valeur_vente_visible || 0),
        montantPaye: parseFloat(tx.montant_paye || 0),
        quantite: parseFloat(tx.quantite || 0),
        taux: parseFloat(tx.taux_achat_unitaire || 0),
        devise: tx.devise || 'USDT',
        deviseVente: tx.devise_vente,
        tauxConversion: parseFloat(tx.taux_conversion || 0),
        tauxAchatXAF: parseFloat(tx.taux_achat_xaf || 0),
        ancien_cmup: parseFloat(tx.ancien_cmup || tx.cmupUsdt || 0),
        cmup_operation: tx.cmup_operation || tx.cmupOperation || null,
        quantiteDevise: parseFloat(tx.quantite_vente || 0),
        tauxVisible: parseFloat(tx.taux_vente_visible || 0),
        tauxCache: parseFloat(tx.taux_vente_cache || 0),
        valeurAchat: parseFloat(tx.valeur_achat_xaf || 0),
        valeurVenteVisible: parseFloat(tx.valeur_vente_visible || 0),
        valeurVenteCachee: parseFloat(tx.valeur_vente_cachee || 0),
        beneficeVisible: parseFloat(tx.benefice_visible || 0),
        beneficeCachee: parseFloat(tx.benefice_cache || 0),
        partPorteur: parseFloat(tx.part_porteur_visible || 0),
        partAssocie: parseFloat(tx.part_associe_visible || 0),
        partPorteurCache: parseFloat(tx.part_porteur_cachee || 0),
        partAssocieCache: parseFloat(tx.part_associe_cachee || 0),
        porteurPct: parseFloat(tx.pourcentage_porteur ?? tx.pct_porteur ?? tx.porteurPct ?? 70),
        associePct: parseFloat(tx.pourcentage_associe ?? tx.pct_associe ?? tx.associePct ?? 30),
        usdtConsomme: parseFloat(tx.usdt_consomme || 0),
        client: tx.client, fournisseur: tx.fournisseur, beneficiaire: tx.beneficiaire,
        sourceCompte: tx.use_caisse ? 'caisse' : 'depot',
        statut: tx.statut, userId: tx.user_id, userName: tx.user_name, userRole: tx.user_role,
        stockUsdt_avant: 0, stockUsdt_apres: 0,
      }));

      // ── 3. Chaîne stock ──
      const sorted = [...transactions].sort((a, b) => a.date - b.date);
      let sc = 0;
      const withStock = sorted.map(row => {
        if (row.type === 'achat' && (row.devise === 'USDT' || !row.deviseVente)) {
          const av = sc; sc = av + (row.quantite||0);
          return { ...row, stockUsdt_avant: av, stockUsdt_apres: sc };
        } else if (row.type === 'vente') {
          const av = sc; sc = Math.max(0, av - (row.usdtConsomme||0));
          return { ...row, stockUsdt_avant: av, stockUsdt_apres: sc };
        }
        return row;
      });
      const transactionsWithStock = transactions.map(r => withStock.find(w => w.id === r.id) || r);

      setData({
        depot: parseFloat(comptes.depot || 0),
        caisse: parseFloat(comptes.caisse || 0),
        devises: [{ devise:'USDT', quantite: parseFloat(stock?.quantite||0), cmup: parseFloat(stock?.cmup||0) }],
        transactions: transactionsWithStock,
      });

      if (settings?.profit_share_porteur !== undefined || settings?.profit_share_associe !== undefined) {
        const porteur = parseFloat(settings.profit_share_porteur ?? 70);
        const associe = parseFloat(settings.profit_share_associe ?? (100 - porteur));
        setProfitShare({ porteur, associe });
      } else if (repartition) {
        const pR = repartition.repartition?.find(r => r.role === 'porteur');
        const aR = repartition.repartition?.find(r => r.role === 'associe');
        if (pR) setProfitShare({ porteur: parseFloat(pR.pourcentage_defaut||70), associe: parseFloat(aR?.pourcentage_defaut||30) });
      }

      // ── 4. Secondaire silencieux ──
      const [cliR, fournR, devR] = await Promise.allSettled([apiGetClients(), apiGetFournisseurs(), apiGetDevises()]);
      if (cliR.status==='fulfilled')   setClients(cliR.value?.clients||[]);
      if (fournR.status==='fulfilled') setFournisseurs(fournR.value?.fournisseurs||[]);
      if (devR.status==='fulfilled')   setDevises(devR.value?.devises||[]);
      try { setDistributionDetails(await apiGetDistributionDetails()); } catch {}

    } catch (err) {
      console.error('loadDataFromAPI:', err);
      toast.error('Erreur chargement : ' + (err.message || 'inconnue'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Charger les données dès que l'utilisateur est connecté
  useEffect(() => {
    if (user && localStorage.getItem('fx_token')) {
      loadDataFromAPI();
    }
  }, [user, loadDataFromAPI]);

  // ── Connexion ──
  const handleLogin = async (email, password) => {
    if (!email || !password) { toast.error(t.allFieldsRequired); return; }
    try {
      setLoading(true);
      const result = await apiLogin(email, password);
      const loggedUser = result.user;
      localStorage.setItem('fx_token', result.token);
      localStorage.setItem('fx_user', JSON.stringify(loggedUser));
      setUser(loggedUser);
      setSessionStart(new Date());
      addLog('connexion', `Connexion réussie : ${email} — Rôle: ${loggedUser.role}`, loggedUser.id, { statut: 'success' });
      toast.success(`${t.welcome} ${loggedUser.name} !`);
    } catch (err) {
      addLog('connexion_echouee', `Tentative échouée : ${email}`, null, { statut: 'failed' });
      toast.error(t.loginFailed);
    } finally {
      setLoading(false);
    }
  };

  // ── Inscription ──
  const handleRegister = async (name, email, password, role) => {
    const result = await apiRegister(name, email, password, role);
    toast.success(
      langue === 'fr'
        ? `Compte créé ! Bienvenue ${name} — connectez-vous maintenant.`
        : `Account created! Welcome ${name} — please log in.`
    );
    return result;
  };

  // ── Déconnexion ──
  const handleLogout = async () => {
    const duree = sessionStart ? formatDistanceToNow(sessionStart, { locale: dateFr }) : '—';
    addLog('deconnexion', `Déconnexion : ${user?.email} — ${t.sessionDuration} : ${duree}`, user?.id, { statut: 'success' });
    try { await apiLogout(); } catch {}
    setUser(null);
    setSessionStart(null);
    localStorage.removeItem('fx_token');
    localStorage.removeItem('fx_user');
    toast.info(t.logoutSuccess);
  };

  // ── Traitement des transactions → API ──
  const handleTransaction = async (tx) => {
    try {
      // Validation locale rapide
      const usdtStock = data.devises.find(d => d.devise === 'USDT');
      if (tx.type === 'vente' && usdtStock && tx.usdtConsomme > usdtStock.quantite) {
        toast.error(t.insufficientStock + ' (USDT)'); return;
      }
      if ((tx.type === 'depense' || tx.type === 'retrait') && tx.montant > data.caisse) {
        toast.error(t.insufficientCaisse); return;
      }

      // Construire payload API
      let payload = {};
      if (tx.type === 'restock') {
        payload = { type: 'versement', montant: tx.montant };
      } else if (tx.type === 'vente') {
        const pctPorteur = tx.porteurPct ?? tx.pct_porteur ?? 70;
        const pctAssocie = tx.associePct ?? tx.pct_associe ?? (100 - parseFloat(pctPorteur || 0));
        payload = {
          type: 'vente',
          devise_vente: tx.deviseVente,
          taux_conversion: tx.tauxConversion,
          quantite_vente: tx.quantiteDevise,
          ancien_cmup: tx.ancien_cmup ?? tx.cmupUsdt ?? 0,
          cmup_operation: tx.cmup_operation ?? tx.cmupOperation ?? 'divide',
          taux_vente_visible: tx.tauxVisible,
          pct_porteur: pctPorteur,
          pct_associe: pctAssocie,
          client: tx.client,
          fournisseur: tx.fournisseur,
          id_client: tx.id_client ?? tx.idClient ?? null,
          taux_vente_cache: tx.tauxCache || null,
          id_fournisseur: tx.id_fournisseur ?? tx.idFournisseur ?? null,
          // Fix 3 : montant_paye = acompte client versé à la vente (créé en paiement_client séparé)
          montant_paye: tx.montant_paye !== undefined ? parseFloat(tx.montant_paye) || 0 : 0,
          date: tx.date || null,
        };
      } else if (tx.type === 'achat') {
        payload = {
          type: 'achat',
          quantite: tx.quantite,
          taux_unitaire: tx.taux,
          use_caisse: tx.sourceCompte === 'caisse',
          fournisseur: tx.fournisseur || null,
          id_fournisseur: tx.idFournisseur || null,
          date: tx.date || null,
        };
      } else if (tx.type === 'depense') {
        payload = { type: 'depense', montant: tx.montant, categorie: tx.categorie, description: tx.description, date: tx.date || null };
      } else if (tx.type === 'retrait') {
        payload = { type: 'retrait', montant: tx.montant, beneficiaire: tx.beneficiaire, date: tx.date || null };
      } else if (tx.type === 'paiement_client') {
        // Fix 1 : paiement_client manquait dans le mapping → "type requis"
        payload = {
          type: 'paiement_client',
          client: tx.client,
          id_client: tx.id_client || null,
          montant_a_payer: tx.montant_a_payer || tx.montantAPayer || 0,
          montant_paye: tx.montant_paye || tx.montantPaye || 0,
          date: tx.date || null,
        };
      } else if (tx.type === 'paiement_fournisseur') {
        // Fix 1 : paiement_fournisseur manquait dans le mapping → "type requis"
        payload = {
          type: 'paiement_fournisseur',
          id_fournisseur: tx.id_fournisseur || tx.idFournisseur,
          montant_a_payer: tx.montant_a_payer || tx.montantAPayer || 0,
          montant_paye: tx.montant_paye || tx.montantPaye || 0,
          devise: 'XAF',
          date: tx.date || null,
        };
      }

      await apiCreateTransaction(payload);
      await loadDataFromAPI(); // Recharger tout depuis la DB

      const msgs = {
        restock: t.transferSuccess,
        vente: langue === 'fr' ? 'Vente enregistrée !' : 'Sale recorded!',
        achat: t.purchaseSuccess,
        depense: t.expenseSuccess,
        retrait: t.withdrawalSuccess,
      };
      addLog(tx.type || 'vente', `${(tx.type||'').toUpperCase()} enregistré`, user.id);
      toast.success(msgs[tx.type] || 'Enregistré !');
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Finalisation d'une vente (porteur) → API ──
  const handleFinalize = async (txId, hiddenData) => {
    try {
      await apiFinaliserVente(txId, hiddenData);
      await loadDataFromAPI();
      addLog('finalisation', `Vente finalisée — Transaction ${txId}`, user?.id, { opId: txId });
      toast.success(t.finaliserSuccess);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Édition d'une transaction → API + recalcul chaîne locale ──
  const handleEditTransaction = async (txId, changes) => {
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;

    // Recalcul chaîne stock (validation locale avant d'envoyer à l'API)
    const allTx = data.transactions.map(row => row.id === txId ? { ...row, ...changes } : row);
    const sorted = [...allTx].sort((a, b) => new Date(a.date) - new Date(b.date));
    let stockCourant = 0;
    let cmupCourant  = 0;
    const rebuilt = sorted.map(row => {
      if (row.type === 'achat' && row.devise === 'USDT') {
        const qte = row.quantite || 0;
        const prixTotal = row.montant || 0;
        if (qte > 0) {
          const totalValeur = (stockCourant * cmupCourant) + prixTotal;
          const totalQte = stockCourant + qte;
          cmupCourant = totalQte > 0 ? totalValeur / totalQte : cmupCourant;
        }
        const avant = stockCourant;
        stockCourant = avant + qte;
        return { ...row, stockUsdt_avant: avant, stockUsdt_apres: stockCourant };
      } else if (row.type === 'vente') {
        const usdtConso = row.usdtConsomme || 0;
        const avant = stockCourant;
        stockCourant = Math.max(0, stockCourant - usdtConso);
        return { ...row, stockUsdt_avant: avant, stockUsdt_apres: stockCourant };
      }
      return row;
    });

    const negatif = rebuilt.find(t => t.stockUsdt_apres !== undefined && t.stockUsdt_apres < -0.000001);
    if (negatif) {
      toast.error(`${t.stockNegatif} ${format(new Date(negatif.date), 'dd/MM/yyyy HH:mm')} (${negatif.stockUsdt_apres?.toFixed(4)} USDT)`);
      return;
    }

    try {
      // Préserver les valeurs explicites à 0 et normaliser les alias UI -> API avant l'envoi.
      const normalizedChanges = {
        ...changes,
        porteurPct: changes.porteurPct ?? changes.pct_porteur,
        associePct: changes.associePct ?? changes.pct_associe,
        porteurPctCache: changes.porteurPctCache ?? changes.pct_porteur_cache,
        associePctCache: changes.associePctCache ?? changes.pct_associe_cache,
        id_fournisseur: changes.id_fournisseur ?? changes.idFournisseur,
        id_client: changes.id_client ?? changes.idClient,
        devise_vente: changes.devise_vente ?? changes.deviseVente,
        taux_conversion: changes.taux_conversion ?? changes.tauxConversion,
        ancien_cmup: changes.ancien_cmup ?? changes.cmupUsdt,
        cmup_operation: changes.cmup_operation ?? changes.cmupOperation,
        taux_vente_visible: changes.taux_vente_visible ?? changes.tauxVisible,
        taux_vente_cache: changes.taux_vente_cache ?? changes.tauxCache,
        quantite_vente: changes.quantite_vente ?? changes.quantiteDevise,
        valeur_achat_xaf: changes.valeur_achat_xaf ?? changes.valeurAchat,
        valeur_vente_visible: changes.valeur_vente_visible ?? changes.valeurVenteVisible,
        valeur_vente_cachee: changes.valeur_vente_cachee ?? changes.valeurVenteCachee,
        benefice_visible: changes.benefice_visible ?? changes.beneficeVisible,
        benefice_cache: changes.benefice_cache ?? changes.beneficeCachee,
        part_porteur_visible: changes.part_porteur_visible ?? changes.partPorteur,
        part_associe_visible: changes.part_associe_visible ?? changes.partAssocie,
        part_porteur_cachee: changes.part_porteur_cachee ?? changes.partPorteurCache,
        part_associe_cachee: changes.part_associe_cachee ?? changes.partAssocieCache,
        montant_a_payer: changes.montant_a_payer ?? changes.montantAPayer,
        montant_paye: changes.montant_paye ?? changes.montantPaye,
        mode_paiement: changes.mode_paiement ?? changes.modePaiement,
        use_caisse: changes.use_caisse ?? changes.useCaisse,
        notes: changes.notes ?? changes.description,
      };
      await apiEditTransaction(txId, normalizedChanges);
      await loadDataFromAPI();
      addLog('edition', `Transaction modifiée : ${txId}`, user?.id, { opId: txId });
      toast.success(langue === 'fr' ? 'Modifié ✓' : 'Updated ✓');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteTransaction = async (txId) => {
    try {
      await apiDeleteTransaction(txId);
      await loadDataFromAPI();
      addLog('suppression', `Transaction supprimée : ${txId}`, user?.id, { opId: txId });
    } catch (err) {
      throw err;
    }
  };

  const handleUpdateProfitShare = async (newShare) => {
    try {
      await apiUpdateProfitShare(newShare.porteur, newShare.associe);
      setProfitShare(newShare);
      addLog('settings', `Répartition modifiée : Porteur ${profitShare.porteur}% → ${newShare.porteur}%`, user?.id);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── Mise à jour manuelle du CMUP → API ──
  const handleCmupUpdate = async (devise, newCmup) => {
    if (!isFinite(newCmup) || newCmup <= 0) { toast.error(t.allFieldsRequired); return; }
    try {
      await apiUpdateCmup(devise, newCmup);
      await loadDataFromAPI();
      addLog('cmup', `CMUP ${devise} ajusté → ${newCmup.toLocaleString('fr-FR', { maximumFractionDigits: 6 })} XAF`, user?.id);
      toast.success(t.cmupUpdated);
    } catch (err) {
      toast.error(err.message);
    }
  };

  // ── v5.6.0+ handlers clients ──
  const handleCreateClient = async (nom, prenom, telephone, adresse) => {
    await apiCreateClient(nom, telephone, adresse, prenom);
    const r = await apiGetClients();
    setClients(r?.clients || []);
  };
  const handleDeleteClient = async (id) => {
    await apiDeleteClient(id);
    const r = await apiGetClients();
    setClients(r?.clients || []);
  };
  const handleUpdateClient = async (id, nom, prenom, telephone, adresse) => {
    await apiUpdateClient(id, { nom, prenom, telephone, adresse });
    const r = await apiGetClients();
    setClients(r?.clients || []);
  };
  // ── v5.6.0+ handlers fournisseurs ──
  const handleCreateFournisseur = async (nom, telephone, adresse, prenom, type_fournisseur) => {
    await apiCreateFournisseur(nom, telephone, adresse, prenom, type_fournisseur);
    const r = await apiGetFournisseurs();
    setFournisseurs(r?.fournisseurs || []);
  };
  const handleUpdateFournisseur = async (id, changes) => {
    await apiUpdateFournisseur(id, changes);
    const r = await apiGetFournisseurs();
    setFournisseurs(r?.fournisseurs || []);
  };
  const handleDeleteFournisseur = async (id) => {
    await apiDeleteFournisseur(id);
    const r = await apiGetFournisseurs();
    setFournisseurs(r?.fournisseurs || []);
  };
  // Paiement client (crée une transaction paiement_client)
  const handlePayClient = async (payload) => {
    await apiCreateTransaction(payload);
    await loadDataFromAPI();
  };
  const handleReloadClients = async () => {
    const r = await apiGetClients();
    setClients(r.clients || []);
  };

  // Nouveau paiement fournisseur — crée une transaction paiement_fournisseur
  const handlePayFourn = async (payload) => {
    await apiCreateTransaction(payload);
    await loadDataFromAPI();
  };
  const handleReloadFournisseurs = async () => {
    const r = await apiGetFournisseurs();
    setFournisseurs(r?.fournisseurs || []);
  };
  // ── v5.6.0+ handlers devises ──
  const handleCreateDevise = async (code, nom, taux, description) => {
    await apiCreateDevise(code, nom, taux, description);
    const r = await apiGetDevises();
    setDevises(r?.devises || []);
  };
  const handleDeleteDevise = async (id) => {
    await apiDeleteDevise(id);
    const r = await apiGetDevises();
    setDevises(r?.devises || []);
  };
  const handleUpdateDevise = async (id, data) => {
    await apiUpdateDevise(id, data);
    const r = await apiGetDevises();
    setDevises(r?.devises || []);
  };
  // ── v5.6.0+ handler distribution toggle ──
  const handleToggleDistribution = async () => {
    const result = await apiToggleDistribution();
    setDistributionActive(v => !v);
    const d = await apiGetDistributionDetails();
    setDistributionDetails(d);
    return result;
  };

  if (loading && !user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: dark ? '#0f1117' : '#f8f9fa' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⚡</div>
        <div style={{ fontSize:14, color: dark ? '#9ca3af' : '#6b7280' }}>Connexion à la base de données…</div>
      </div>
    </div>
  );

  if (!user) return (
    <>
      <Toaster position="top-right" richColors duration={2500} />
      <LoginScreen onLogin={handleLogin} onRegister={handleRegister} langue={langue} setLangue={setLangue} dark={dark} setDark={setDark} t={t} />
    </>
  );

  return (
    <>
      <Toaster position="top-right" richColors duration={2500} />
      <Dashboard
        user={user} data={data} profitShare={profitShare}
        onLogout={handleLogout}
        onTransaction={handleTransaction}
        onUpdateProfitShare={handleUpdateProfitShare}
        onFinalize={handleFinalize}
        onEditTransaction={handleEditTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onCmupUpdate={handleCmupUpdate}
        t={t} langue={langue} setLangue={setLangue} dark={dark} setDark={setDark} logs={logs} addLog={addLog}
        clients={clients} fournisseurs={fournisseurs} devises={devises}
        distributionDetails={distributionDetails} distributionActive={distributionActive}
        onCreateClient={handleCreateClient} onDeleteClient={handleDeleteClient} onUpdateClient={handleUpdateClient}
        onPayClient={handlePayClient} onReloadClients={handleReloadClients}
        onCreateFournisseur={handleCreateFournisseur} onDeleteFournisseur={handleDeleteFournisseur}
        onUpdateFournisseur={handleUpdateFournisseur}
        onPayFourn={handlePayFourn} onReloadFournisseurs={handleReloadFournisseurs}
        onCreateDevise={handleCreateDevise} onDeleteDevise={handleDeleteDevise} onUpdateDevise={handleUpdateDevise}
        onToggleDistribution={handleToggleDistribution}
        apiGetClientExtrait={apiGetClientExtrait} apiGetFournisseurExtrait={apiGetFournisseurExtrait}
        genererFacturePDF={genererFacturePDF} loadDataFromAPI={loadDataFromAPI}
      />
    </>
  );
}
