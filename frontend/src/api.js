// ============================================================
// FOREXIUM v5.8.0 — Service API (Frontend → Backend)
// Paiements via transactions (paiement_client / paiement_fournisseur)
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getToken = () => localStorage.getItem('fx_token');
const headers = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});
const handle = async (res) => {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || json.message || `Erreur ${res.status}`);
  return json;
};

// ── AUTH ─────────────────────────────────────────────────────
export const apiLogin = async (email, password) => handle(await fetch(`${BASE_URL}/auth/login`, { method:'POST', headers:headers(), body:JSON.stringify({email,password}) }));
export const apiLogout = async () => handle(await fetch(`${BASE_URL}/auth/logout`, { method:'POST', headers:headers() }));
export const apiRegister = async (name, email, password, role) => handle(await fetch(`${BASE_URL}/auth/register`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name,email,password,role}) }));
export const apiCheckSlots = async () => handle(await fetch(`${BASE_URL}/auth/slots`));

// ── DATA ─────────────────────────────────────────────────────
export const apiLoadAll = async () => {
  const [c,t,s,se,r] = await Promise.all([
    fetch(`${BASE_URL}/stats/comptes`,{headers:headers()}),
    fetch(`${BASE_URL}/transactions?limit=500`,{headers:headers()}),
    fetch(`${BASE_URL}/stock`,{headers:headers()}),
    fetch(`${BASE_URL}/settings`,{headers:headers()}),
    fetch(`${BASE_URL}/stats/repartition`,{headers:headers()}),
  ]);
  const [comptes,txData,stock,settings,repartition] = await Promise.all([c,t,s,se,r].map(handle));
  return {comptes,txData,stock,settings,repartition};
};

// ── TRANSACTIONS ─────────────────────────────────────────────
export const apiCreateTransaction = async (payload) => handle(await fetch(`${BASE_URL}/transactions`, { method:'POST', headers:headers(), body:JSON.stringify(payload) }));
export const apiFinaliserVente = async (txId, d) => handle(await fetch(`${BASE_URL}/transactions/${txId}/finaliser`, { method:'PUT', headers:headers(), body:JSON.stringify({taux_vente_cache:d.tauxCache,pct_porteur:d.porteurPctC,pct_associe:d.associePctC}) }));
export const apiEditTransaction = async (txId, changes) => handle(await fetch(`${BASE_URL}/transactions/${txId}/edit`, { method:'PUT', headers:headers(), body:JSON.stringify(changes) }));
export const apiDeleteTransaction = async (txId) => {
  return handle(await fetch(`${BASE_URL}/transactions/delete/${txId}`, { method:'DELETE', headers:headers() }));
};
export const apiValiderAssoc = async (txId) => handle(await fetch(`${BASE_URL}/transactions/${txId}/valider-assoc`, { method:'PUT', headers:headers() }));
export const apiValiderTransaction = async (txId, paymentStatus, montantPaye=null) => handle(await fetch(`${BASE_URL}/transactions/${txId}/valider`, { method:'PUT', headers:headers(), body:JSON.stringify({payment_status:paymentStatus,...(montantPaye!==null&&{montant_paye:montantPaye})}) }));

// ── STOCK ────────────────────────────────────────────────────
export const apiUpdateCmup = async (devise, newCmup) => handle(await fetch(`${BASE_URL}/stock/cmup`, { method:'PUT', headers:headers(), body:JSON.stringify({devise,cmup:newCmup}) }));

// ── SETTINGS ─────────────────────────────────────────────────
export const apiUpdateSetting = async (key, valeur) => handle(await fetch(`${BASE_URL}/settings/${key}`, { method:'PUT', headers:headers(), body:JSON.stringify({valeur}) }));
export const apiUpdateProfitShare = async (porteur, associe) => Promise.all([apiUpdateSetting('profit_share_porteur',String(porteur)),apiUpdateSetting('profit_share_associe',String(associe))]);

// ── CLIENTS ──────────────────────────────────────────────────
// Retourne total_a_payer, total_paye (agrégés depuis les transactions paiement_client)
export const apiGetClients = async () => handle(await fetch(`${BASE_URL}/accounts/clients`, {headers:headers()}));

export const apiCreateClient = async (nom, telephone, adresse, prenom='') =>
  handle(await fetch(`${BASE_URL}/accounts/clients`, {
    method:'POST', headers:headers(),
    body:JSON.stringify({nom, prenom, telephone, adresse}),
  }));

export const apiUpdateClient = async (clientId, data) =>
  handle(await fetch(`${BASE_URL}/accounts/clients/${clientId}`, {
    method:'PUT', headers:headers(), body:JSON.stringify(data),
  }));

export const apiDeleteClient = async (clientId) =>
  handle(await fetch(`${BASE_URL}/accounts/clients/${clientId}`, {method:'DELETE', headers:headers()}));

// Extrait client : transactions de type 'paiement_client' avec montant_a_payer, montant_paye, reste calculé
export const apiGetClientExtrait = async (clientId) =>
  handle(await fetch(`${BASE_URL}/accounts/extrait/clients/${clientId}`, {headers:headers()}));

// ── FOURNISSEURS ─────────────────────────────────────────────
// Retourne total_a_payer, total_paye, total_a_payer_usdt, total_paye_usdt (agrégés)
export const apiGetFournisseurs = async () => handle(await fetch(`${BASE_URL}/accounts/fournisseurs`, {headers:headers()}));

export const apiCreateFournisseur = async (nom, telephone, adresse, prenom='', type_fournisseur='secondaire') =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs`, {
    method:'POST', headers:headers(),
    body:JSON.stringify({nom, prenom, telephone, adresse, type_fournisseur}),
  }));

export const apiUpdateFournisseur = async (fournisseurId, data) =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/${fournisseurId}`, {
    method:'PUT', headers:headers(), body:JSON.stringify(data),
  }));

export const apiDeleteFournisseur = async (fournisseurId) =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/${fournisseurId}`, {method:'DELETE', headers:headers()}));

export const apiFournisseurPayment = async (fournisseurId, mode, montant) =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/${fournisseurId}/payment`, {
    method:'POST', headers:headers(), body:JSON.stringify({mode, montant}),
  }));

// Extrait fournisseur : transactions de type 'paiement_fournisseur' avec montant_a_payer, montant_paye, reste calculé, par devise
export const apiGetFournisseurExtrait = async (fournisseurId) =>
  handle(await fetch(`${BASE_URL}/accounts/extrait/fournisseurs/${fournisseurId}`, {headers:headers()}));

export const apiGetFournisseurTransferts = async (fournisseurId) =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/${fournisseurId}/transferts`, {headers:headers()}));

export const apiGetTransfertsFournisseurs = async () =>
  handle(await fetch(`${BASE_URL}/accounts/transferts`, {headers:headers()}));

export const apiTransferFournisseur = async (payload) =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/transferts`, {
    method:'POST', headers:headers(), body:JSON.stringify(payload),
  }));

// ── PAIEMENTS (conservés pour compatibilité ancienne) ────────
export const apiPayClient = async (clientId, transaction_id, montant_paye, mode_paiement='XAF') =>
  handle(await fetch(`${BASE_URL}/accounts/clients/${clientId}/payment`, {
    method:'PUT', headers:headers(), body:JSON.stringify({transaction_id, montant_paye, mode_paiement}),
  }));

export const apiPayFournisseur = async (fournisseurId, transaction_id, montant_paye, mode_paiement='XAF') =>
  handle(await fetch(`${BASE_URL}/accounts/fournisseurs/${fournisseurId}/payment`, {
    method:'PUT', headers:headers(), body:JSON.stringify({transaction_id, montant_paye, mode_paiement}),
  }));

// ── DEVISES ──────────────────────────────────────────────────
export const apiGetDevises = async () => handle(await fetch(`${BASE_URL}/devises`, {headers:headers()}));
export const apiCreateDevise = async (code, nom, taux_conversion, description) => handle(await fetch(`${BASE_URL}/devises`, {method:'POST', headers:headers(), body:JSON.stringify({code,nom,taux_conversion,description})}));
export const apiUpdateDevise = async (deviseId, data) => handle(await fetch(`${BASE_URL}/devises/${deviseId}`, {method:'PUT', headers:headers(), body:JSON.stringify(data)}));
export const apiDeleteDevise = async (deviseId) => handle(await fetch(`${BASE_URL}/devises/${deviseId}`, {method:'DELETE', headers:headers()}));

// ── DISTRIBUTION ─────────────────────────────────────────────
export const apiGetDistributionDetails = async () => handle(await fetch(`${BASE_URL}/stats/distribution-details`, {headers:headers()}));
export const apiToggleDistribution = async () => handle(await fetch(`${BASE_URL}/stats/toggle-distribution`, {method:'POST', headers:headers()}));

// ── RESET DONNÉES ─────────────────────────────────────────────
export const apiResetData = async () =>
  handle(await fetch(`${BASE_URL}/settings/reset-data`, { method:'POST', headers:headers() }));
