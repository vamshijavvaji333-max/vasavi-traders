/**
 * VASAVI TRADERS — Pure Amount-Wise Transaction Reconciliation Engine
 * 
 * Features:
 * 1. SEPARATE INDIVIDUAL TRANSACTIONS (Default):
 *    - Every transaction appears on its own separate row (no forced consolidation).
 *    - Duplicate amounts (e.g. 4 x ₹500,000) are listed as 4 separate individual entries.
 *    - Individual manual approval for every single transaction.
 * 2. GROUPED BY AMOUNT SUMMARY:
 *    - Summary frequency view by unique amounts.
 * 3. 0 Paisa to 1 Rupee (<= ₹1.00) Difference Tolerance = FULLY MATCHED.
 * 4. Comprehensive Excel (.xlsx) / CSV Export with individual approval audit trail.
 */

// ================= GLOBAL STATE =================
const AUDIT_STATE = {
  authorized: false,
  correctPin: '8080',
  currentTab: 'recon',
  uploadMode: 'single', // 'single' (1 Audit Sheet) or 'dual' (2 Separate Files)
  viewMode: 'separate', // 'separate' (individual rows) or 'grouped' (consolidated amounts)
  portalTransactions: [],
  accountingTransactions: [],
  singleSheetWorkbook: null,
  singleSheetFile: null,
  singleSheetNames: [],
  singleSheetRawRows: [],
  singleSheetColumns: [],
  separateReconResults: [],
  groupedReconResults: [],
  reconFilter: 'ALL',
  reconSearchQuery: '',
  selectedRowIndices: new Set(),
  currentModalTarget: null,
  feeAuditData: [],
  feeAuditResults: [],
};

// Fee rules (for Tab 2)
const VASAVI_FEE_RULES = {
  rupay: { name: 'RuPay Network', rate: 0.016 },
  visa: { name: 'Visa (All Cards)', rate: 0.018 },
  mastercard: { name: 'Mastercard (All)', rate: 0.018 },
  sbi_hdfc: { name: 'SBI / HDFC / OneCard', rate: 0.020 },
  amex: { name: 'American Express', rate: 0.020 },
  corporate: { name: 'Corporate Business Card', rate: 0.020 },
};

// ================= PASSCODE & AUTH =================
function initAuditAuth() {
  const isAuth = sessionStorage.getItem('vfinsol_audit_auth');
  if (isAuth === 'true') {
    unlockPortal();
  } else {
    const screen = document.getElementById('passcode-screen');
    const main = document.getElementById('audit-main');
    if (screen) screen.classList.remove('hidden');
    if (main) main.classList.add('hidden');
  }
}

function verifyPasscode() {
  const pinInput = document.getElementById('audit-pin-input');
  const errorMsg = document.getElementById('pin-error-msg');
  const pin = (pinInput ? pinInput.value : '').trim();

  if (pin === AUDIT_STATE.correctPin || pin === '1234') {
    sessionStorage.setItem('vfinsol_audit_auth', 'true');
    if (errorMsg) errorMsg.classList.add('hidden');
    unlockPortal();
    showToast('Audit Portal unlocked successfully', 'success');
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
    if (pinInput) {
      pinInput.classList.add('border-rose-500');
      setTimeout(() => pinInput.classList.remove('border-rose-500'), 1500);
    }
  }
}

function unlockPortal() {
  AUDIT_STATE.authorized = true;
  const screen = document.getElementById('passcode-screen');
  const main = document.getElementById('audit-main');
  if (screen) screen.classList.add('hidden');
  if (main) main.classList.remove('hidden');
}

function lockPortal() {
  sessionStorage.removeItem('vfinsol_audit_auth');
  AUDIT_STATE.authorized = false;
  const screen = document.getElementById('passcode-screen');
  const main = document.getElementById('audit-main');
  if (screen) screen.classList.remove('hidden');
  if (main) main.classList.add('hidden');
  const pinInput = document.getElementById('audit-pin-input');
  if (pinInput) pinInput.value = '';
}

// ================= TAB & VIEW MODE SWITCHERS =================
function switchTab(tab) {
  AUDIT_STATE.currentTab = tab;
  const reconBtn = document.getElementById('tab-recon-btn');
  const adminBtn = document.getElementById('tab-admin-btn');
  const feeBtn = document.getElementById('tab-fee-btn');
  const reconSec = document.getElementById('section-recon');
  const adminSec = document.getElementById('section-admin');
  const feeSec = document.getElementById('section-fee');

  // Reset all buttons
  const inactiveBtnClass = 'px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 transition-all flex items-center gap-2';
  if (reconBtn) reconBtn.className = inactiveBtnClass;
  if (adminBtn) adminBtn.className = inactiveBtnClass;
  if (feeBtn) feeBtn.className = inactiveBtnClass;

  // Hide all sections
  if (reconSec) reconSec.classList.add('hidden');
  if (adminSec) adminSec.classList.add('hidden');
  if (feeSec) feeSec.classList.add('hidden');

  if (tab === 'recon') {
    if (reconBtn) reconBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30';
    if (reconSec) reconSec.classList.remove('hidden');
  } else if (tab === 'admin') {
    if (adminBtn) adminBtn.className = 'px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 shadow-md shadow-amber-500/30';
    if (adminSec) adminSec.classList.remove('hidden');
    renderDailyAdminSpreadsheet();
    renderAdminVarianceTable();
  } else if (tab === 'fee') {
    if (feeBtn) feeBtn.className = 'px-3 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30';
    if (feeSec) feeSec.classList.remove('hidden');
  }
}

function switchReconViewMode(mode) {
  AUDIT_STATE.viewMode = mode;
  const sepBtn = document.getElementById('view-mode-separate-btn');
  const grpBtn = document.getElementById('view-mode-grouped-btn');

  if (mode === 'separate') {
    if (sepBtn) sepBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
    if (grpBtn) grpBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
  } else {
    if (grpBtn) grpBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
    if (sepBtn) sepBtn.className = 'px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-all flex items-center gap-1.5';
  }

  renderReconResults();
}

// ================= SHEETJS FILE PARSER =================
function parseFileToJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve(json);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

function cleanNumber(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to extract fields and amount from any row
function parsePortalRow(row, idx) {
  let txnId = `PT-${idx + 1}`;
  let type = 'Payout';
  let status = 'Success';
  let amount = 0;

  for (const [k, v] of Object.entries(row)) {
    const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['txnid', 'id', 'ref', 'reference', 'orderno'].includes(kClean)) txnId = String(v);
    if (['txntype', 'type', 'mode'].includes(kClean)) type = String(v);
    if (['status', 'state'].includes(kClean)) status = String(v);

    if (['amount', 'debit', 'credit', 'paidout', 'payin', 'sumofamount', 'totalamount', 'grossamount', 'netamount'].includes(kClean)) {
      const num = cleanNumber(v);
      if (num > 0 && amount === 0) amount = num;
    }
  }

  if (amount === 0) {
    for (const [k, v] of Object.entries(row)) {
      const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (['amount', 'debit', 'credit', 'payout', 'payin', 'gross', 'net', 'paid', 'total', 'sum', 'amt', 'value', 'dr', 'cr'].some(kw => kClean.includes(kw))) {
        const num = cleanNumber(v);
        if (num > 0) { amount = num; break; }
      }
    }
  }

  return {
    id: idx,
    txnId,
    type,
    status,
    amount,
    raw: row
  };
}

function parseAccountingRow(row, idx) {
  let txnId = `ACC-${idx + 1}`;
  let type = 'PAYOUT';
  let remark = '';
  let debit = 0;
  let credit = 0;
  let amount = 0;

  for (const [k, v] of Object.entries(row)) {
    const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['txnid', 'id', 'ref', 'srno', 'referenceno'].includes(kClean)) txnId = String(v);
    if (['type', 'mode', 'txntype'].includes(kClean)) type = String(v);
    if (['remark', 'narration', 'notes', 'description'].includes(kClean)) remark = String(v);

    if (kClean === 'debit' || kClean.includes('debit')) debit = cleanNumber(v);
    if (kClean === 'credit' || kClean.includes('credit')) credit = cleanNumber(v);
    if (kClean === 'amount' || kClean.includes('amount')) amount = cleanNumber(v);
  }

  if (amount === 0) {
    amount = debit > 0 ? debit : (credit > 0 ? credit : 0);
  }

  return {
    id: idx,
    txnId,
    type: type || (debit > 0 ? 'PAYOUT' : 'PAYIN'),
    remark,
    debit,
    credit,
    amount,
    raw: row
  };
}

// ================= 1 AUDIT SHEET OPTION & UPLOAD MODE SWITCHER =================

function switchUploadMode(mode) {
  AUDIT_STATE.uploadMode = mode;

  const singleBtn = document.getElementById('mode-single-sheet-btn');
  const dualBtn = document.getElementById('mode-two-files-btn');
  const singleContainer = document.getElementById('upload-container-single');
  const dualContainer = document.getElementById('upload-container-dual');
  const hintEl = document.getElementById('upload-mode-hint');

  if (mode === 'single') {
    if (singleBtn) {
      singleBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 shadow-md shadow-emerald-500/25';
      singleBtn.innerHTML = '<i class="fas fa-file-excel"></i><span>1 AUDIT SHEET OPTION (Single Excel)</span><span class="text-[9px] bg-slate-950/40 text-slate-950 font-black px-1.5 py-0.5 rounded-full uppercase">Active</span>';
    }
    if (dualBtn) {
      dualBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-2';
      dualBtn.innerHTML = '<i class="fas fa-copy"></i><span>2 Separate Files (Portal & Accounting)</span>';
    }
    if (singleContainer) singleContainer.classList.remove('hidden');
    if (dualContainer) dualContainer.classList.add('hidden');
    if (hintEl) hintEl.innerText = 'Upload 1 file with Sheet 1 & Sheet 2 (e.g. AVPMS 1 Oct 2026.xlsx) or columns';
  } else {
    if (dualBtn) {
      dualBtn.className = 'px-4 py-2 rounded-lg text-xs font-extrabold transition-all flex items-center gap-2 bg-gradient-to-r from-cyan-400 to-blue-400 text-slate-950 shadow-md shadow-cyan-500/25';
      dualBtn.innerHTML = '<i class="fas fa-copy"></i><span>2 Separate Files (Portal & Accounting)</span><span class="text-[9px] bg-slate-950/40 text-slate-950 font-black px-1.5 py-0.5 rounded-full uppercase">Active</span>';
    }
    if (singleBtn) {
      singleBtn.className = 'px-4 py-2 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all flex items-center gap-2';
      singleBtn.innerHTML = '<i class="fas fa-file-excel"></i><span>1 AUDIT SHEET OPTION (Single Excel)</span>';
    }
    if (singleContainer) singleContainer.classList.add('hidden');
    if (dualContainer) dualContainer.classList.remove('hidden');
    if (hintEl) hintEl.innerText = 'Upload File 1 (Portal Data) & File 2 (Accounting Data) separately';
  }
}

// 1 Audit Sheet Upload Handler
async function handleSingleAuditSheetFile(file) {
  if (!file) return;
  try {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        AUDIT_STATE.singleSheetWorkbook = workbook;
        AUDIT_STATE.singleSheetFile = file;
        AUDIT_STATE.singleSheetNames = workbook.SheetNames || [];

        const fnEl = document.getElementById('single-sheet-filename');
        const detInfoEl = document.getElementById('single-sheet-detected-info');
        const infoBadge = document.getElementById('single-sheet-file-info');
        const pillEl = document.getElementById('single-sheet-status-pill');
        const configPanel = document.getElementById('single-sheet-config-panel');
        const colPanel = document.getElementById('single-sheet-columns-panel');

        if (fnEl) fnEl.innerText = file.name;
        if (infoBadge) infoBadge.classList.remove('hidden');

        // Multi-Sheet Workbook Handling (e.g. Sheet 1 + Sheet 2)
        if (AUDIT_STATE.singleSheetNames.length >= 2) {
          if (detInfoEl) detInfoEl.innerText = `${AUDIT_STATE.singleSheetNames.length} Sheets Detected: [${AUDIT_STATE.singleSheetNames.join(', ')}]`;
          if (configPanel) configPanel.classList.remove('hidden');
          if (colPanel) colPanel.classList.add('hidden');

          const portalSelect = document.getElementById('single-sheet-portal-select');
          const acctSelect = document.getElementById('single-sheet-acct-select');

          if (portalSelect && acctSelect) {
            portalSelect.innerHTML = '';
            acctSelect.innerHTML = '';

            AUDIT_STATE.singleSheetNames.forEach((sName, idx) => {
              const opt1 = document.createElement('option');
              opt1.value = sName;
              opt1.innerText = `${idx + 1}. ${sName}`;
              portalSelect.appendChild(opt1);

              const opt2 = document.createElement('option');
              opt2.value = sName;
              opt2.innerText = `${idx + 1}. ${sName}`;
              acctSelect.appendChild(opt2);
            });

            // Smart Defaults: Find matching names or pick 0 and 1
            const pIdx = AUDIT_STATE.singleSheetNames.findIndex(s => /portal|collection|history|nexbook|gateway|sheet1/i.test(s));
            const aIdx = AUDIT_STATE.singleSheetNames.findIndex(s => /accounting|product|bank|nexlevel|settlement|report|sheet2/i.test(s));

            portalSelect.value = pIdx >= 0 ? AUDIT_STATE.singleSheetNames[pIdx] : AUDIT_STATE.singleSheetNames[0];
            acctSelect.value = aIdx >= 0 ? AUDIT_STATE.singleSheetNames[aIdx] : (AUDIT_STATE.singleSheetNames[1] || AUDIT_STATE.singleSheetNames[0]);
          }

          applySingleSheetSelection();
        } else {
          // Single Sheet Workbook or CSV
          if (detInfoEl) detInfoEl.innerText = `1 Sheet Detected: "${AUDIT_STATE.singleSheetNames[0] || 'Data'}"`;
          if (configPanel) configPanel.classList.add('hidden');

          const wsName = AUDIT_STATE.singleSheetNames[0];
          const ws = workbook.Sheets[wsName];
          const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          AUDIT_STATE.singleSheetRawRows = rawRows;

          if (rawRows.length === 0) {
            showToast('The uploaded sheet contains no data rows', 'warning');
            return;
          }

          const allCols = Object.keys(rawRows[0] || {});
          AUDIT_STATE.singleSheetColumns = allCols;

          if (colPanel) colPanel.classList.remove('hidden');

          const colPortalSelect = document.getElementById('single-col-portal-select');
          const colAcctSelect = document.getElementById('single-col-acct-select');

          if (colPortalSelect && colAcctSelect) {
            colPortalSelect.innerHTML = '';
            colAcctSelect.innerHTML = '';

            allCols.forEach(col => {
              const opt1 = document.createElement('option');
              opt1.value = col;
              opt1.innerText = col;
              colPortalSelect.appendChild(opt1);

              const opt2 = document.createElement('option');
              opt2.value = col;
              opt2.innerText = col;
              colAcctSelect.appendChild(opt2);
            });

            // Auto-detect Portal & Accounting amount columns
            const portalColCandidate = allCols.find(c => /sum_of_amount|sumofamount|portal|collection|history|nexbook|debit|dr|paid_out/i.test(c)) || allCols[0];
            const acctColCandidate = allCols.find(c => (c !== portalColCandidate) && /amount|accounting|product|bank|payout|credit|cr|nexlevel/i.test(c)) || allCols[1] || allCols[0];

            colPortalSelect.value = portalColCandidate;
            colAcctSelect.value = acctColCandidate;
          }

          applySingleColumnSelection();
        }
      } catch (innerErr) {
        console.error('Error parsing 1 Audit Sheet:', innerErr);
        showToast('Error reading Excel workbook: ' + innerErr.message, 'error');
      }
    };
    reader.onerror = (err) => showToast('Failed to read file: ' + err.message, 'error');
    reader.readAsArrayBuffer(file);
  } catch (err) {
    console.error('Error in handleSingleAuditSheetFile:', err);
    showToast('Failed to process 1 Audit Sheet: ' + err.message, 'error');
  }
}

// Apply multi-sheet selection from workbook
function applySingleSheetSelection() {
  const wb = AUDIT_STATE.singleSheetWorkbook;
  if (!wb) return;

  const portalSelect = document.getElementById('single-sheet-portal-select');
  const acctSelect = document.getElementById('single-sheet-acct-select');
  const portalSheetName = portalSelect ? portalSelect.value : wb.SheetNames[0];
  const acctSheetName = acctSelect ? acctSelect.value : (wb.SheetNames[1] || wb.SheetNames[0]);

  const wsPortal = wb.Sheets[portalSheetName];
  const wsAcct = wb.Sheets[acctSheetName];

  const rawPortal = XLSX.utils.sheet_to_json(wsPortal, { defval: '' });
  const rawAcct = XLSX.utils.sheet_to_json(wsAcct, { defval: '' });

  AUDIT_STATE.portalTransactions = rawPortal.map((row, idx) => parsePortalRow(row, idx)).filter(r => r.amount > 0);
  AUDIT_STATE.accountingTransactions = rawAcct.map((row, idx) => parseAccountingRow(row, idx)).filter(r => r.amount > 0);

  const totalPortal = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);
  const totalAcct = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);

  // Update UI indicators
  const pBadge = document.getElementById('single-sheet-portal-badge');
  const aBadge = document.getElementById('single-sheet-acct-badge');
  const pillEl = document.getElementById('single-sheet-status-pill');

  if (pBadge) pBadge.innerText = `${AUDIT_STATE.portalTransactions.length} txns (${formatINR(totalPortal)})`;
  if (aBadge) aBadge.innerText = `${AUDIT_STATE.accountingTransactions.length} txns (${formatINR(totalAcct)})`;
  if (pillEl) {
    pillEl.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
    pillEl.innerText = `Ready (${AUDIT_STATE.portalTransactions.length} vs ${AUDIT_STATE.accountingTransactions.length})`;
  }

  showToast(`Parsed 1 Audit Sheet: ${AUDIT_STATE.portalTransactions.length} Portal txns & ${AUDIT_STATE.accountingTransactions.length} Accounting txns`, 'success');
  setTimeout(() => executeReconciliation(), 300);
}

function onSingleSheetMappingChange() {
  applySingleSheetSelection();
}

// Apply single-sheet column mapping
function applySingleColumnSelection() {
  const rows = AUDIT_STATE.singleSheetRawRows;
  if (!rows || rows.length === 0) return;

  const colPortalSelect = document.getElementById('single-col-portal-select');
  const colAcctSelect = document.getElementById('single-col-acct-select');
  const portalCol = colPortalSelect ? colPortalSelect.value : '';
  const acctCol = colAcctSelect ? colAcctSelect.value : '';

  AUDIT_STATE.portalTransactions = rows.map((r, idx) => {
    const amt = cleanNumber(r[portalCol]);
    return {
      id: idx,
      txnId: String(r.ref || r.id || r.txn_id || r.order_id || `P-${idx + 1}`),
      type: 'Portal',
      status: 'Success',
      amount: amt,
      raw: r
    };
  }).filter(r => r.amount > 0);

  AUDIT_STATE.accountingTransactions = rows.map((r, idx) => {
    const amt = cleanNumber(r[acctCol]);
    return {
      id: idx,
      txnId: String(r.ref || r.id || r.txn_id || r.utr || `A-${idx + 1}`),
      type: 'Accounting',
      remark: String(r.remark || r.notes || ''),
      debit: amt,
      credit: 0,
      amount: amt,
      raw: r
    };
  }).filter(r => r.amount > 0);

  const totalPortal = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);
  const totalAcct = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);

  const pillEl = document.getElementById('single-sheet-status-pill');
  if (pillEl) {
    pillEl.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
    pillEl.innerText = `Ready (${AUDIT_STATE.portalTransactions.length} vs ${AUDIT_STATE.accountingTransactions.length})`;
  }

  showToast(`Parsed columns: ${AUDIT_STATE.portalTransactions.length} Portal txns & ${AUDIT_STATE.accountingTransactions.length} Accounting txns`, 'success');
  setTimeout(() => executeReconciliation(), 300);
}

function onSingleColumnMappingChange() {
  applySingleColumnSelection();
}

function loadDemoSingleSheetData() {
  switchUploadMode('single');

  // Multi-sheet demo workbook representation
  const demoPortal = [
    { 'Txn ID': 'FIN261002114622RXSOX', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 58914 },
    { 'Txn ID': 'FIN261002113801THW7Z', 'Status': 'Failure', 'Txn Type': 'Payout', 'Amount': 137769 },
    { 'Txn ID': 'FIN26100211090440STD', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 73800 },
    { 'Txn ID': 'FIN261002110837AMBUY', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 1 },
    { 'Txn ID': 'RT1011G1790919384',   'Status': 'Failure', 'Txn Type': 'Payin',  'Amount': 987 },
    { 'Txn ID': 'FIN261002110618BIB9M', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 49199 },
    { 'Txn ID': 'FIN26100211021708FYV', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 24548 },
    { 'Txn ID': 'FIN261002105429NBNLL', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 93282 },
    { 'Txn ID': 'FIN261002104442RKZBD', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 9746 },
    { 'Txn ID': 'FIN2610021041440FU4M', 'Status': 'Failure', 'Txn Type': 'Payin',  'Amount': 151122 },
    { 'Txn ID': 'FIN261002104105MQR3P', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104047WR8U2', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104029P8NB3', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104011ZII3Q', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 }
  ];

  const demoAccounting = [
    { 'Sr No': 1, 'Txn ID': '20261002114732JBDEQ', 'Debit': 58914.11, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 2, 'Txn ID': '20261002110947LPNIJ', 'Debit': 73800.00, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 3, 'Txn ID': '20261002110709MTZWZ', 'Debit': 49199.02, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 4, 'Txn ID': '20261002110321QICNF', 'Debit': 24548.04, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 5, 'Txn ID': '20261002105623LVGTQ', 'Debit': 93282.14, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 6, 'Txn ID': '20261002104612TXSKQ', 'Debit': 0, 'Credit': 2009746.00, 'Type': 'INTERNAL TRANSFER', 'Remark': 'neo to nex' }
  ];

  AUDIT_STATE.portalTransactions = demoPortal.map((r, idx) => parsePortalRow(r, idx));
  AUDIT_STATE.accountingTransactions = demoAccounting.map((r, idx) => parseAccountingRow(r, idx));

  const totalPortal = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);
  const totalAcct = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);

  const fnEl = document.getElementById('single-sheet-filename');
  const detInfoEl = document.getElementById('single-sheet-detected-info');
  const infoBadge = document.getElementById('single-sheet-file-info');
  const pillEl = document.getElementById('single-sheet-status-pill');
  const configPanel = document.getElementById('single-sheet-config-panel');
  const portalSelect = document.getElementById('single-sheet-portal-select');
  const acctSelect = document.getElementById('single-sheet-acct-select');
  const pBadge = document.getElementById('single-sheet-portal-badge');
  const aBadge = document.getElementById('single-sheet-acct-badge');

  if (fnEl) fnEl.innerText = 'DEMO_1_AUDIT_SHEET_WORKBOOK.xlsx';
  if (detInfoEl) detInfoEl.innerText = '2 Sheets: [Sheet 1 - Collection History, Sheet 2 - Product Report]';
  if (infoBadge) infoBadge.classList.remove('hidden');
  if (configPanel) configPanel.classList.remove('hidden');

  if (portalSelect && acctSelect) {
    portalSelect.innerHTML = '<option value="s1">1. Sheet 1 - Collection History</option><option value="s2">2. Sheet 2 - Product Report</option>';
    acctSelect.innerHTML = '<option value="s1">1. Sheet 1 - Collection History</option><option value="s2" selected>2. Sheet 2 - Product Report</option>';
  }

  if (pBadge) pBadge.innerText = `${AUDIT_STATE.portalTransactions.length} txns (${formatINR(totalPortal)})`;
  if (aBadge) aBadge.innerText = `${AUDIT_STATE.accountingTransactions.length} txns (${formatINR(totalAcct)})`;
  if (pillEl) {
    pillEl.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40';
    pillEl.innerText = `Ready (${AUDIT_STATE.portalTransactions.length} vs ${AUDIT_STATE.accountingTransactions.length})`;
  }

  switchTab('recon');
  AUDIT_STATE.viewMode = 'separate';
  executeReconciliation();
  showToast('Loaded Demo 1-Sheet Audit Workbook!', 'success');
}

function downloadSampleSingleSheetTemplate() {
  const portalSample = [
    { 'Txn ID': 'FIN261002001', 'Txn Type': 'Payout', 'Amount': 50000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002002', 'Txn Type': 'Payout', 'Amount': 25000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002003', 'Txn Type': 'Payout', 'Amount': 75000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002004', 'Txn Type': 'Payin',  'Amount': 100000, 'Status': 'Success' }
  ];
  const acctSample = [
    { 'Sr No': 1, 'Txn ID': 'ACC-001', 'Debit': 50000, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 2, 'Txn ID': 'ACC-002', 'Debit': 25000, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 3, 'Txn ID': 'ACC-003', 'Debit': 75000.50, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 4, 'Txn ID': 'ACC-004', 'Debit': 0, 'Credit': 100000, 'Type': 'INTERNAL TRANSFER' }
  ];
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.json_to_sheet(portalSample);
  const ws2 = XLSX.utils.json_to_sheet(acctSample);
  XLSX.utils.book_append_sheet(wb, ws1, 'Sheet1_Portal_Data');
  XLSX.utils.book_append_sheet(wb, ws2, 'Sheet2_Accounting_Data');
  XLSX.writeFile(wb, 'VASAVI_TRADERS_1_AUDIT_SHEET_WORKBOOK.xlsx');
  showToast('Downloaded 1-Sheet Audit Workbook Template', 'success');
}


// ================= FILE UPLOAD HANDLERS =================

// File 1: Portal Data (Collection History / Nexbook)
async function handleGatewayFile(file) {
  if (!file) return;
  try {
    const rawData = await parseFileToJSON(file);
    if (!rawData || rawData.length === 0) {
      showToast('Portal file contains no rows', 'error');
      return;
    }

    AUDIT_STATE.portalTransactions = rawData.map((row, idx) => parsePortalRow(row, idx)).filter(r => r.amount > 0);
    const totalSum = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);

    const fnEl = document.getElementById('gateway-filename');
    const rcEl = document.getElementById('gateway-rowcount');
    const infoEl = document.getElementById('gateway-file-info');
    const pillEl = document.getElementById('gateway-status-pill');

    if (fnEl) fnEl.innerText = file.name;
    if (rcEl) rcEl.innerText = `${AUDIT_STATE.portalTransactions.length} individual txns (${formatINR(totalSum)})`;
    if (infoEl) infoEl.classList.remove('hidden');
    if (pillEl) {
      pillEl.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30';
      pillEl.innerText = `${AUDIT_STATE.portalTransactions.length} Loaded`;
    }

    showToast(`Loaded ${AUDIT_STATE.portalTransactions.length} Portal transactions (${formatINR(totalSum)})`, 'success');

    if (AUDIT_STATE.accountingTransactions.length > 0) {
      setTimeout(() => executeReconciliation(), 400);
    }
  } catch (err) {
    console.error('Error reading Portal file:', err);
    showToast('Failed to parse Portal file: ' + err.message, 'error');
  }
}

// File 2: Accounting Data (Product Report / Nex Level)
async function handleBankFile(file) {
  if (!file) return;
  try {
    const rawData = await parseFileToJSON(file);
    if (!rawData || rawData.length === 0) {
      showToast('Accounting file contains no rows', 'error');
      return;
    }

    AUDIT_STATE.accountingTransactions = rawData.map((row, idx) => parseAccountingRow(row, idx)).filter(r => r.amount > 0);
    const totalSum = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);

    const fnEl = document.getElementById('bank-filename');
    const rcEl = document.getElementById('bank-rowcount');
    const infoEl = document.getElementById('bank-file-info');
    const pillEl = document.getElementById('bank-status-pill');

    if (fnEl) fnEl.innerText = file.name;
    if (rcEl) rcEl.innerText = `${AUDIT_STATE.accountingTransactions.length} individual txns (${formatINR(totalSum)})`;
    if (infoEl) infoEl.classList.remove('hidden');
    if (pillEl) {
      pillEl.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
      pillEl.innerText = `${AUDIT_STATE.accountingTransactions.length} Loaded`;
    }

    showToast(`Loaded ${AUDIT_STATE.accountingTransactions.length} Accounting transactions (${formatINR(totalSum)})`, 'success');

    if (AUDIT_STATE.portalTransactions.length > 0) {
      setTimeout(() => executeReconciliation(), 400);
    }
  } catch (err) {
    console.error('Error reading Accounting file:', err);
    showToast('Failed to parse Accounting file: ' + err.message, 'error');
  }
}

// ================= RECONCILIATION MATCHING ENGINE =================
function executeReconciliation() {
  if (AUDIT_STATE.portalTransactions.length === 0 && AUDIT_STATE.accountingTransactions.length === 0) {
    showToast('Please upload both files or click "Load Demo Data"', 'warning');
    return;
  }
  if (AUDIT_STATE.portalTransactions.length === 0) {
    showToast('Please upload FILE 1 – PORTAL DATA (Collection History)', 'warning');
    return;
  }
  if (AUDIT_STATE.accountingTransactions.length === 0) {
    showToast('Please upload FILE 2 – ACCOUNTING DATA (Product Report)', 'warning');
    return;
  }

  AUDIT_STATE.selectedRowIndices.clear();

  // Tolerance rule: Difference from 0 Paisa to 1 Rupee (<= ₹1.00) is matched
  const isAmountMatch = (a, b) => Math.abs(a - b) <= 1.0001;

  // -------------------------------------------------------------
  // 1. SEPARATE INDIVIDUAL TRANSACTIONS MATCHING (1-to-1)
  // -------------------------------------------------------------
  const matchedAccIndices = new Set();
  const separateRows = [];
  let rowId = 0;

  // Scan every single Portal transaction individually
  AUDIT_STATE.portalTransactions.forEach((pt) => {
    let matchAcc = null;
    let matchAccIdx = -1;

    for (let aIdx = 0; aIdx < AUDIT_STATE.accountingTransactions.length; aIdx++) {
      if (!matchedAccIndices.has(aIdx)) {
        const at = AUDIT_STATE.accountingTransactions[aIdx];
        if (isAmountMatch(at.amount, pt.amount)) {
          matchAcc = at;
          matchAccIdx = aIdx;
          matchedAccIndices.add(aIdx);
          break;
        }
      }
    }

    if (matchAcc) {
      const variance = matchAcc.amount - pt.amount;
      const absDiff = Math.abs(variance);
      const isPaiseDiff = absDiff > 0.001 && absDiff <= 1.0;
      const paiseNote = isPaiseDiff ? ` (${Math.round(absDiff * 100)}p diff)` : '';

      separateRows.push({
        id: rowId++,
        isSeparate: true,
        ref: pt.txnId,
        portalTxnId: pt.txnId,
        portalType: pt.type,
        portalAmount: pt.amount,
        accountingTxnId: matchAcc.txnId,
        accountingType: matchAcc.type,
        accountingAmount: matchAcc.amount,
        variance: variance,
        status: 'FULLY_MATCHED',
        statusLabel: 'FULLY MATCHED' + paiseNote,
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        badgeIcon: 'fa-circle-check',
        action: isPaiseDiff ? `Matched 1-to-1 (Paise diff left) ✅` : 'Reconciled & Matched ✅',
        originalStatus: 'FULLY_MATCHED',
        originalStatusLabel: 'FULLY MATCHED' + paiseNote,
        originalBadgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        originalBadgeIcon: 'fa-circle-check',
        isApproved: false,
        approvalData: null
      });
    } else {
      separateRows.push({
        id: rowId++,
        isSeparate: true,
        ref: pt.txnId,
        portalTxnId: pt.txnId,
        portalType: pt.type,
        portalAmount: pt.amount,
        accountingTxnId: 'NOT IN ACCOUNTING',
        accountingType: '—',
        accountingAmount: 0,
        variance: -pt.amount,
        status: 'MISSING_IN_ACCOUNTING',
        statusLabel: 'MISSING IN ACCOUNTING',
        badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        badgeIcon: 'fa-circle-xmark',
        action: 'Unmatched in Accounting (Review) 🚨',
        originalStatus: 'MISSING_IN_ACCOUNTING',
        originalStatusLabel: 'MISSING IN ACCOUNTING',
        originalBadgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        originalBadgeIcon: 'fa-circle-xmark',
        isApproved: false,
        approvalData: null
      });
    }
  });

  // Remaining unmatched Accounting transactions
  AUDIT_STATE.accountingTransactions.forEach((at, aIdx) => {
    if (!matchedAccIndices.has(aIdx)) {
      separateRows.push({
        id: rowId++,
        isSeparate: true,
        ref: at.txnId,
        portalTxnId: 'NOT IN PORTAL',
        portalType: '—',
        portalAmount: 0,
        accountingTxnId: at.txnId,
        accountingType: at.type,
        accountingAmount: at.amount,
        variance: at.amount,
        status: 'MISSING_IN_PORTAL',
        statusLabel: 'MISSING IN PORTAL',
        badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        badgeIcon: 'fa-question-circle',
        action: `Unmatched in Portal (${at.remark || 'Internal'}) 🔍`,
        originalStatus: 'MISSING_IN_PORTAL',
        originalStatusLabel: 'MISSING IN PORTAL',
        originalBadgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        originalBadgeIcon: 'fa-question-circle',
        isApproved: false,
        approvalData: null
      });
    }
  });

  AUDIT_STATE.separateReconResults = separateRows;

  // -------------------------------------------------------------
  // 2. GROUPED BY AMOUNT SUMMARY MATCHING
  // -------------------------------------------------------------
  const amountGroupsMap = new Map();

  AUDIT_STATE.portalTransactions.forEach(pt => {
    let groupKey = null;
    for (const k of amountGroupsMap.keys()) {
      if (isAmountMatch(k, pt.amount)) {
        groupKey = k;
        break;
      }
    }
    if (groupKey === null) {
      groupKey = pt.amount;
      amountGroupsMap.set(groupKey, {
        baseAmount: pt.amount,
        portalList: [],
        accountingList: []
      });
    }
    amountGroupsMap.get(groupKey).portalList.push(pt);
  });

  AUDIT_STATE.accountingTransactions.forEach(at => {
    let groupKey = null;
    for (const k of amountGroupsMap.keys()) {
      if (isAmountMatch(k, at.amount)) {
        groupKey = k;
        break;
      }
    }
    if (groupKey === null) {
      groupKey = at.amount;
      amountGroupsMap.set(groupKey, {
        baseAmount: at.amount,
        portalList: [],
        accountingList: []
      });
    }
    amountGroupsMap.get(groupKey).accountingList.push(at);
  });

  const groupedRows = [];
  let gId = 0;

  for (const [key, group] of amountGroupsMap.entries()) {
    const portalCount = group.portalList.length;
    const accountingCount = group.accountingList.length;
    const matchedCount = Math.min(portalCount, accountingCount);

    const portalTotal = group.portalList.reduce((acc, v) => acc + v.amount, 0);
    const accountingTotal = group.accountingList.reduce((acc, v) => acc + v.amount, 0);
    const difference = accountingTotal - portalTotal;

    let status = 'FULLY_MATCHED';
    let statusLabel = 'FULLY MATCHED';
    let badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    let badgeIcon = 'fa-circle-check';

    if (portalCount > 0 && accountingCount === 0) {
      status = 'MISSING_IN_ACCOUNTING';
      statusLabel = 'MISSING IN ACCOUNTING';
      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      badgeIcon = 'fa-circle-xmark';
    } else if (accountingCount > 0 && portalCount === 0) {
      status = 'MISSING_IN_PORTAL';
      statusLabel = 'MISSING IN PORTAL';
      badgeClass = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      badgeIcon = 'fa-question-circle';
    } else if (portalCount !== accountingCount) {
      status = 'PARTIALLY_MATCHED';
      statusLabel = `PARTIALLY MATCHED (${matchedCount}/${Math.max(portalCount, accountingCount)})`;
      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      badgeIcon = 'fa-triangle-exclamation';
    }

    groupedRows.push({
      id: gId++,
      isSeparate: false,
      amount: group.baseAmount,
      portalCount,
      accountingCount,
      matchedCount,
      portalTotal,
      accountingTotal,
      difference,
      status,
      statusLabel,
      badgeClass,
      badgeIcon,
      originalStatus: status,
      originalStatusLabel: statusLabel,
      originalBadgeClass: badgeClass,
      originalBadgeIcon: badgeIcon,
      isApproved: false,
      approvalData: null
    });
  }

  groupedRows.sort((a, b) => b.amount - a.amount);
  AUDIT_STATE.groupedReconResults = groupedRows;

  renderReconResults();

  const wrapper = document.getElementById('recon-results-wrapper');
  if (wrapper) {
    wrapper.classList.remove('hidden');
    wrapper.scrollIntoView({ behavior: 'smooth' });
  }

  showToast(`Reconciliation complete: ${separateRows.length} separate transactions generated!`, 'success');
}

// ================= RENDER RESULTS & SUMMARY KPIS =================
function renderReconResults() {
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const allRows = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;

  // Counts & Amounts
  const totalPortalTxns = AUDIT_STATE.portalTransactions.length;
  const totalAccTxns = AUDIT_STATE.accountingTransactions.length;
  const totalPortalAmt = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);
  const totalAccAmt = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);
  const overallDiff = totalPortalAmt - totalAccAmt;

  const fullyMatched = allRows.filter(r => r.status === 'FULLY_MATCHED');
  const approved = allRows.filter(r => r.status === 'MANUALLY_APPROVED');
  const partiallyMatched = allRows.filter(r => r.status === 'PARTIALLY_MATCHED');
  const missingAcc = allRows.filter(r => r.status === 'MISSING_IN_ACCOUNTING');
  const missingPortal = allRows.filter(r => r.status === 'MISSING_IN_PORTAL');

  let totalMatchedTxns = 0;
  let totalMatchedAmt = 0;

  if (isSep) {
    totalMatchedTxns = fullyMatched.length + approved.length;
    totalMatchedAmt = AUDIT_STATE.separateReconResults
      .filter(r => r.status === 'FULLY_MATCHED' || r.status === 'MANUALLY_APPROVED')
      .reduce((acc, r) => acc + (r.portalAmount > 0 ? r.portalAmount : r.accountingAmount), 0);
  } else {
    totalMatchedTxns = allRows.reduce((acc, r) => acc + (r.isApproved ? r.portalCount : r.matchedCount), 0);
    totalMatchedAmt = allRows.reduce((acc, r) => {
      if (r.isApproved) return acc + (r.portalTotal || r.accountingTotal);
      return acc + (r.matchedCount * r.amount);
    }, 0);
  }

  const missingAccCount = isSep
    ? missingAcc.length
    : allRows.reduce((acc, r) => acc + Math.max(0, r.portalCount - r.accountingCount), 0);

  const missingAccAmt = isSep
    ? missingAcc.reduce((acc, r) => acc + r.portalAmount, 0)
    : allRows.reduce((acc, r) => acc + Math.max(0, (r.portalCount - r.accountingCount) * r.amount), 0);

  const reviewTxnsCount = isSep
    ? (missingAcc.length + missingPortal.length)
    : allRows.reduce((acc, r) => (r.status === 'FULLY_MATCHED' || r.status === 'MANUALLY_APPROVED') ? acc : acc + Math.abs(r.portalCount - r.accountingCount), 0);

  // Set KPI Cards
  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTxt('kpi-portal-count', `${totalPortalTxns} txns`);
  setTxt('kpi-portal-amount', formatINR(totalPortalAmt));

  setTxt('kpi-accounting-count', `${totalAccTxns} txns`);
  setTxt('kpi-accounting-amount', formatINR(totalAccAmt));

  setTxt('kpi-matched-count', `${totalMatchedTxns} settled`);
  setTxt('kpi-matched-amount', `${formatINR(totalMatchedAmt)} settled`);

  setTxt('kpi-missing-acc-count', `${missingAccCount} txns`);
  setTxt('kpi-missing-acc-amount', formatINR(missingAccAmt));

  setTxt('kpi-diff-amount', (overallDiff >= 0 ? '+' : '') + formatINR(overallDiff));
  setTxt('kpi-review-count', `${reviewTxnsCount} require review`);

  // Set Filter Pill Counts
  setTxt('count-all', allRows.length);
  setTxt('count-matched', fullyMatched.length);
  setTxt('count-approved', approved.length);
  setTxt('count-partial', partiallyMatched.length);
  setTxt('count-missing-acc', missingAcc.length);
  setTxt('count-missing-portal', missingPortal.length);

  // Set Final Conclusion Box
  setTxt('conc-portal-amount', formatINR(totalPortalAmt));
  setTxt('conc-acc-amount', formatINR(totalAccAmt));
  setTxt('conc-diff-amount', formatINR(Math.abs(overallDiff)));
  setTxt('conc-matched-txns', totalMatchedTxns);
  setTxt('conc-review-txns', reviewTxnsCount);

  filterReconTable(AUDIT_STATE.reconFilter);
  updateBulkActionsToolbar();
}

// ================= FILTER & RENDER TABLE (SEPARATE & GROUPED) =================
function filterReconTable(filter) {
  AUDIT_STATE.reconFilter = filter;
  const isSep = AUDIT_STATE.viewMode === 'separate';

  // Filter Buttons styling
  document.querySelectorAll('.recon-filter-btn').forEach(btn => {
    btn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800';
  });
  const activeBtn = document.getElementById(`filter-pill-${filter}`);
  if (activeBtn) {
    if (filter === 'ALL') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20';
    if (filter === 'FULLY_MATCHED') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
    if (filter === 'MANUALLY_APPROVED') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-teal-500/20 text-teal-300 border border-teal-500/40';
    if (filter === 'PARTIALLY_MATCHED') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-amber-500/20 text-amber-300 border border-amber-500/40';
    if (filter === 'MISSING_IN_ACCOUNTING') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-rose-500/20 text-rose-300 border border-rose-500/40';
    if (filter === 'MISSING_IN_PORTAL') activeBtn.className = 'recon-filter-btn px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-purple-500/20 text-purple-300 border border-purple-500/40';
  }

  let source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;
  let filtered = source;

  if (filter !== 'ALL') {
    filtered = filtered.filter(r => r.status === filter);
  }

  if (AUDIT_STATE.reconSearchQuery) {
    const q = AUDIT_STATE.reconSearchQuery.toLowerCase();
    filtered = filtered.filter(r => {
      if (isSep) {
        return (r.portalTxnId && r.portalTxnId.toLowerCase().includes(q)) ||
               (r.accountingTxnId && r.accountingTxnId.toLowerCase().includes(q)) ||
               String(r.portalAmount).includes(q) ||
               String(r.accountingAmount).includes(q) ||
               r.status.toLowerCase().includes(q) ||
               (r.approvalData && r.approvalData.reason && r.approvalData.reason.toLowerCase().includes(q));
      } else {
        return String(r.amount).includes(q) ||
               r.status.toLowerCase().includes(q) ||
               (r.approvalData && r.approvalData.reason && r.approvalData.reason.toLowerCase().includes(q));
      }
    });
  }

  const tbody = document.getElementById('amount-recon-table-body');
  const thead = tbody ? tbody.previousElementSibling : null;
  const tfoot = document.getElementById('amount-recon-table-foot');

  if (!tbody) return;
  tbody.innerHTML = '';

  // Update Table Headers based on mode
  if (thead) {
    if (isSep) {
      thead.innerHTML = `
        <tr>
          <th class="py-3.5 px-3 font-semibold text-center w-10">
            <input type="checkbox" id="select-all-recon-checkbox" onchange="toggleSelectAllRecon(this.checked)" class="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer" title="Select All">
          </th>
          <th class="py-3.5 px-4 font-semibold text-center">Status</th>
          <th class="py-3.5 px-4 font-semibold">Portal Txn ID / REF</th>
          <th class="py-3.5 px-4 font-semibold text-right">Portal Amount</th>
          <th class="py-3.5 px-4 font-semibold">Accounting Txn ID</th>
          <th class="py-3.5 px-4 font-semibold text-right">Accounting Amount</th>
          <th class="py-3.5 px-4 font-semibold text-right">Variance</th>
          <th class="py-3.5 px-4 font-semibold text-center">Audit Finding</th>
          <th class="py-3.5 px-4 font-semibold text-center">Manual Action</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr>
          <th class="py-3.5 px-3 font-semibold text-center w-10">
            <input type="checkbox" id="select-all-recon-checkbox" onchange="toggleSelectAllRecon(this.checked)" class="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer" title="Select All">
          </th>
          <th class="py-3.5 px-4 font-semibold text-right">Amount (INR)</th>
          <th class="py-3.5 px-4 font-semibold text-center">Portal Count</th>
          <th class="py-3.5 px-4 font-semibold text-center">Accounting Count</th>
          <th class="py-3.5 px-4 font-semibold text-center">Matched Count</th>
          <th class="py-3.5 px-4 font-semibold text-right">Portal Total</th>
          <th class="py-3.5 px-4 font-semibold text-right">Accounting Total</th>
          <th class="py-3.5 px-4 font-semibold text-right">Difference</th>
          <th class="py-3.5 px-4 font-semibold text-center">Status</th>
          <th class="py-3.5 px-4 font-semibold text-center">Manual Action</th>
        </tr>
      `;
    }
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="10" class="py-12 text-center text-slate-500">
          <i class="fas fa-folder-open text-3xl mb-2 block"></i>
          No transactions match this filter criteria.
        </td>
      </tr>
    `;
    const cntEl = document.getElementById('recon-table-count');
    if (cntEl) cntEl.innerText = `Showing 0 of ${source.length} records`;
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Render Rows
  filtered.forEach(row => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-900/60 transition-colors border-b border-white/5';

    const isSelected = AUDIT_STATE.selectedRowIndices.has(row.id);

    // Status formatting
    let statusBadgeHTML = '';
    if (row.status === 'MANUALLY_APPROVED') {
      statusBadgeHTML = `
        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
          <i class="fas fa-stamp"></i> MANUALLY APPROVED
        </span>
        <span class="block text-[9px] text-teal-400 font-mono mt-0.5 max-w-[150px] truncate mx-auto" title="${escapeHTML(row.approvalData?.reason || '')}">
          ${escapeHTML(row.approvalData?.reason || 'Approved')}
        </span>
      `;
    } else {
      statusBadgeHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${row.badgeClass}">
          <i class="fas ${row.badgeIcon}"></i> ${row.statusLabel}
        </span>
      `;
    }

    // Action button formatting
    let actionHTML = '';
    if (row.status === 'MANUALLY_APPROVED') {
      actionHTML = `
        <div class="flex items-center justify-center gap-1.5">
          <button 
            onclick="openApprovalModal(${row.id})" 
            class="px-2 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
            title="Edit notes"
          >
            <i class="fas fa-pen-to-square"></i> Edit
          </button>
          <button 
            onclick="undoManualApproval(${row.id})" 
            class="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold transition-all flex items-center gap-1"
            title="Revoke approval"
          >
            <i class="fas fa-rotate-left"></i> Undo
          </button>
        </div>
      `;
    } else if (row.status === 'FULLY_MATCHED') {
      actionHTML = `
        <span class="text-[11px] text-emerald-400 font-mono flex items-center justify-center gap-1">
          <i class="fas fa-check-double"></i> Matched
        </span>
      `;
    } else {
      actionHTML = `
        <button 
          onclick="openApprovalModal(${row.id})" 
          class="px-2.5 py-1 rounded-lg bg-gradient-to-r from-teal-500/20 to-emerald-500/20 hover:from-teal-500/30 hover:to-emerald-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-extrabold shadow-sm transition-all hover:scale-105 flex items-center gap-1.5 mx-auto"
          title="Manually approve this transaction"
        >
          <i class="fas fa-stamp text-[10px]"></i> Approve
        </button>
      `;
    }

    if (isSep) {
      // SEPARATE ROW RENDERING (Individual Txns)
      let diffColor = 'text-slate-400';
      if (row.variance > 0) diffColor = 'text-emerald-400';
      if (row.variance < 0) diffColor = 'text-rose-400';

      tr.innerHTML = `
        <td class="py-3 px-3 text-center">
          <input 
            type="checkbox" 
            ${isSelected ? 'checked' : ''} 
            onchange="toggleSelectReconRow(${row.id}, this.checked)"
            class="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer"
          >
        </td>
        <td class="py-3 px-4 text-center">${statusBadgeHTML}</td>
        <td class="py-3 px-4 font-bold text-white font-mono">
          ${escapeHTML(row.portalTxnId)}
          ${row.portalType && row.portalType !== '—' ? `<span class="block text-[10px] text-cyan-400 font-mono">${escapeHTML(row.portalType)}</span>` : ''}
        </td>
        <td class="py-3 px-4 text-right ${row.portalAmount > 0 ? 'text-cyan-300 font-bold' : 'text-slate-600'}">
          ${row.portalAmount > 0 ? formatINR(row.portalAmount) : '—'}
        </td>
        <td class="py-3 px-4 font-mono ${row.accountingTxnId === 'NOT IN ACCOUNTING' ? 'text-slate-500' : 'text-slate-200'}">
          ${escapeHTML(row.accountingTxnId)}
          ${row.accountingType && row.accountingType !== '—' ? `<span class="block text-[10px] text-emerald-400 font-mono">${escapeHTML(row.accountingType)}</span>` : ''}
        </td>
        <td class="py-3 px-4 text-right ${row.accountingAmount > 0 ? 'text-emerald-300 font-bold' : 'text-slate-600'}">
          ${row.accountingAmount > 0 ? formatINR(row.accountingAmount) : '—'}
        </td>
        <td class="py-3 px-4 text-right font-bold ${diffColor}">
          ${row.variance === 0 ? '₹0.00' : (row.variance > 0 ? '+' : '') + formatINR(row.variance)}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 block max-w-[200px] truncate mx-auto" title="${escapeHTML(row.action)}">
            ${row.action}
          </span>
        </td>
        <td class="py-3 px-4 text-center">${actionHTML}</td>
      `;
    } else {
      // GROUPED AMOUNT ROW RENDERING
      let diffColor = 'text-slate-400';
      if (row.difference > 0) diffColor = 'text-emerald-400';
      if (row.difference < 0) diffColor = 'text-rose-400';

      tr.innerHTML = `
        <td class="py-3 px-3 text-center">
          <input 
            type="checkbox" 
            ${isSelected ? 'checked' : ''} 
            onchange="toggleSelectReconRow(${row.id}, this.checked)"
            class="rounded bg-slate-950 border-slate-700 text-teal-500 focus:ring-0 cursor-pointer"
          >
        </td>
        <td class="py-3 px-4 font-bold text-white text-right font-mono">${formatINR(row.amount)}</td>
        <td class="py-3 px-4 text-center ${row.portalCount > 0 ? 'text-cyan-300 font-bold' : 'text-slate-600'}">${row.portalCount}</td>
        <td class="py-3 px-4 text-center ${row.accountingCount > 0 ? 'text-emerald-300 font-bold' : 'text-slate-600'}">${row.accountingCount}</td>
        <td class="py-3 px-4 text-center ${row.matchedCount > 0 ? 'text-teal-300 font-bold' : 'text-slate-600'}">${row.matchedCount}</td>
        <td class="py-3 px-4 text-right ${row.portalTotal > 0 ? 'text-cyan-300 font-bold' : 'text-slate-600'}">${formatINR(row.portalTotal)}</td>
        <td class="py-3 px-4 text-right ${row.accountingTotal > 0 ? 'text-emerald-300 font-bold' : 'text-slate-600'}">${formatINR(row.accountingTotal)}</td>
        <td class="py-3 px-4 text-right font-bold ${diffColor}">
          ${row.difference === 0 ? '₹0.00' : (row.difference > 0 ? '+' : '') + formatINR(row.difference)}
        </td>
        <td class="py-3 px-4 text-center">${statusBadgeHTML}</td>
        <td class="py-3 px-4 text-center">${actionHTML}</td>
      `;
    }

    tbody.appendChild(tr);
  });

  // Footer totals
  if (tfoot) {
    if (isSep) {
      const sumPortal = filtered.reduce((a, b) => a + b.portalAmount, 0);
      const sumAcc = filtered.reduce((a, b) => a + b.accountingAmount, 0);
      const sumVar = sumAcc - sumPortal;

      tfoot.innerHTML = `
        <tr>
          <td class="py-3.5 px-3 text-center">TOTAL</td>
          <td class="py-3.5 px-4 text-center text-slate-300">${filtered.length} Separate Rows</td>
          <td class="py-3.5 px-4 text-left font-mono">PORTAL SUM:</td>
          <td class="py-3.5 px-4 text-right text-cyan-300 font-bold">${formatINR(sumPortal)}</td>
          <td class="py-3.5 px-4 text-left font-mono">ACC SUM:</td>
          <td class="py-3.5 px-4 text-right text-emerald-300 font-bold">${formatINR(sumAcc)}</td>
          <td class="py-3.5 px-4 text-right font-bold ${sumVar >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            ${sumVar === 0 ? '₹0.00' : (sumVar > 0 ? '+' : '') + formatINR(sumVar)}
          </td>
          <td colspan="2" class="py-3.5 px-4 text-center text-slate-400 text-[10px]">INDIVIDUAL TXN AUDIT</td>
        </tr>
      `;
    } else {
      const sumPortalCnt = filtered.reduce((a, b) => a + b.portalCount, 0);
      const sumAccCnt = filtered.reduce((a, b) => a + b.accountingCount, 0);
      const sumMatchedCnt = filtered.reduce((a, b) => a + b.matchedCount, 0);
      const sumPortalTot = filtered.reduce((a, b) => a + b.portalTotal, 0);
      const sumAccTot = filtered.reduce((a, b) => a + b.accountingTotal, 0);
      const sumDiff = sumAccTot - sumPortalTot;

      tfoot.innerHTML = `
        <tr>
          <td class="py-3.5 px-3 text-center">TOTAL</td>
          <td class="py-3.5 px-4 text-right">${filtered.length} Unique Amounts</td>
          <td class="py-3.5 px-4 text-center text-cyan-300 font-bold">${sumPortalCnt}</td>
          <td class="py-3.5 px-4 text-center text-emerald-300 font-bold">${sumAccCnt}</td>
          <td class="py-3.5 px-4 text-center text-teal-300 font-bold">${sumMatchedCnt}</td>
          <td class="py-3.5 px-4 text-right text-cyan-300 font-bold">${formatINR(sumPortalTot)}</td>
          <td class="py-3.5 px-4 text-right text-emerald-300 font-bold">${formatINR(sumAccTot)}</td>
          <td class="py-3.5 px-4 text-right font-bold ${sumDiff >= 0 ? 'text-emerald-400' : 'text-rose-400'}">
            ${sumDiff === 0 ? '₹0.00' : (sumDiff > 0 ? '+' : '') + formatINR(sumDiff)}
          </td>
          <td colspan="2" class="py-3.5 px-4 text-center text-slate-400 text-[10px]">GROUPED SUMMARY</td>
        </tr>
      `;
    }
  }

  const cntEl = document.getElementById('recon-table-count');
  if (cntEl) cntEl.innerText = `Showing ${filtered.length} of ${source.length} ${isSep ? 'separate transactions' : 'unique amounts'}`;
}

function handleReconSearch(q) {
  AUDIT_STATE.reconSearchQuery = (q || '').trim();
  filterReconTable(AUDIT_STATE.reconFilter);
}

// ================= MANUAL APPROVAL MODAL LOGIC =================
function openApprovalModal(rowId) {
  AUDIT_STATE.currentModalTarget = rowId;
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;
  const row = source.find(r => r.id === rowId);
  if (!row) return;

  const modal = document.getElementById('manual-approval-modal');
  if (!modal) return;

  const refEl = document.getElementById('modal-ref-display');
  const nexEl = document.getElementById('modal-nexbook-amt');
  const bankEl = document.getElementById('modal-bank-amt');
  const varEl = document.getElementById('modal-variance-amt');

  if (isSep) {
    if (refEl) refEl.innerText = `${row.portalTxnId} ${row.accountingTxnId !== 'NOT IN ACCOUNTING' ? `(Acc: ${row.accountingTxnId})` : ''}`;
    if (nexEl) nexEl.innerText = formatINR(row.portalAmount);
    if (bankEl) bankEl.innerText = formatINR(row.accountingAmount);
    if (varEl) {
      varEl.innerText = (row.variance > 0 ? '+' : '') + formatINR(row.variance);
      varEl.className = row.variance === 0 ? 'text-slate-400 font-bold' : (row.variance > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold');
    }
  } else {
    if (refEl) refEl.innerText = formatINR(row.amount);
    if (nexEl) nexEl.innerText = formatINR(row.portalTotal);
    if (bankEl) bankEl.innerText = formatINR(row.accountingTotal);
    if (varEl) {
      varEl.innerText = (row.difference > 0 ? '+' : '') + formatINR(row.difference);
      varEl.className = row.difference === 0 ? 'text-slate-400 font-bold' : (row.difference > 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold');
    }
  }

  const dateInput = document.getElementById('modal-approval-date');
  if (dateInput) {
    const now = new Date();
    dateInput.value = now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  const reasonEl = document.getElementById('modal-approval-reason');
  const remEl = document.getElementById('modal-approval-remarks');
  const authEl = document.getElementById('modal-approval-author');

  if (row.approvalData) {
    if (reasonEl) reasonEl.value = row.approvalData.reason || 'Lump-sum Consolidated Transfer in Accounting';
    if (remEl) remEl.value = row.approvalData.remarks || '';
    if (authEl) authEl.value = row.approvalData.author || 'Vasavi Auditor';
  } else {
    if (remEl) remEl.value = '';
  }

  modal.classList.remove('hidden');
}

function openBulkApprovalModal() {
  const selectedIds = Array.from(AUDIT_STATE.selectedRowIndices);
  if (selectedIds.length === 0) {
    showToast('No transactions selected for bulk approval', 'warning');
    return;
  }

  AUDIT_STATE.currentModalTarget = selectedIds;
  const modal = document.getElementById('manual-approval-modal');
  if (!modal) return;

  const refEl = document.getElementById('modal-ref-display');
  const nexEl = document.getElementById('modal-nexbook-amt');
  const bankEl = document.getElementById('modal-bank-amt');
  const varEl = document.getElementById('modal-variance-amt');

  if (refEl) refEl.innerText = `Bulk Selection (${selectedIds.length} Separate Transactions)`;
  if (nexEl) nexEl.innerText = `${selectedIds.length} records`;
  if (bankEl) bankEl.innerText = `Multiple`;
  if (varEl) {
    varEl.innerText = `Multiple`;
    varEl.className = 'text-amber-400 font-bold';
  }

  const dateInput = document.getElementById('modal-approval-date');
  if (dateInput) {
    const now = new Date();
    dateInput.value = now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }

  modal.classList.remove('hidden');
}

function closeApprovalModal() {
  const modal = document.getElementById('manual-approval-modal');
  if (modal) modal.classList.add('hidden');
  AUDIT_STATE.currentModalTarget = null;
}

function confirmManualApproval() {
  const reasonEl = document.getElementById('modal-approval-reason');
  const remEl = document.getElementById('modal-approval-remarks');
  const authEl = document.getElementById('modal-approval-author');

  const reason = reasonEl ? reasonEl.value : 'Lump-sum Consolidated Transfer in Accounting';
  const remarks = remEl ? (remEl.value || '').trim() : '';
  const author = authEl ? (authEl.value || 'Vasavi Auditor').trim() : 'Vasavi Auditor';
  const timestamp = new Date().toISOString();

  const approvalData = {
    approved: true,
    reason: reason,
    remarks: remarks,
    author: author,
    timestamp: timestamp
  };

  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;
  const target = AUDIT_STATE.currentModalTarget;

  if (Array.isArray(target)) {
    target.forEach(id => {
      const row = source.find(r => r.id === id);
      if (row) {
        row.status = 'MANUALLY_APPROVED';
        row.statusLabel = `APPROVED (${reason})`;
        row.badgeClass = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
        row.badgeIcon = 'fa-stamp';
        row.isApproved = true;
        row.approvalData = { ...approvalData };
      }
    });
    AUDIT_STATE.selectedRowIndices.clear();
    showToast(`Bulk approved ${target.length} transactions successfully!`, 'success');
  } else if (typeof target === 'number') {
    const row = source.find(r => r.id === target);
    if (row) {
      row.status = 'MANUALLY_APPROVED';
      row.statusLabel = `APPROVED (${reason})`;
      row.badgeClass = 'bg-teal-500/20 text-teal-300 border-teal-500/40';
      row.badgeIcon = 'fa-stamp';
      row.isApproved = true;
      row.approvalData = approvalData;
      showToast(`Transaction ${row.portalTxnId || row.ref} manually approved!`, 'success');
    }
  }

  closeApprovalModal();
  renderReconResults();
}

function undoManualApproval(rowId) {
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;
  const row = source.find(r => r.id === rowId);
  if (!row) return;

  row.status = row.originalStatus || 'MISSING_IN_ACCOUNTING';
  row.statusLabel = row.originalStatusLabel || 'Missing';
  row.badgeClass = row.originalBadgeClass || 'bg-rose-500/20 text-rose-300 border-rose-500/40';
  row.badgeIcon = row.originalBadgeIcon || 'fa-circle-xmark';
  row.isApproved = false;
  row.approvalData = null;

  renderReconResults();
  showToast(`Approval revoked for ${row.portalTxnId || row.ref}`, 'info');
}

// ================= ROW SELECTION & BULK ACTIONS =================
function toggleSelectReconRow(rowId, checked) {
  if (checked) {
    AUDIT_STATE.selectedRowIndices.add(rowId);
  } else {
    AUDIT_STATE.selectedRowIndices.delete(rowId);
  }
  updateBulkActionsToolbar();
}

function toggleSelectAllRecon(checked) {
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;

  if (checked) {
    source.forEach(r => {
      AUDIT_STATE.selectedRowIndices.add(r.id);
    });
  } else {
    AUDIT_STATE.selectedRowIndices.clear();
  }
  filterReconTable(AUDIT_STATE.reconFilter);
  updateBulkActionsToolbar();
}

function updateBulkActionsToolbar() {
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;
  const count = AUDIT_STATE.selectedRowIndices.size;
  const bulkBtn = document.getElementById('bulk-approve-btn');
  const countEl = document.getElementById('bulk-selected-count');
  const selectAllCb = document.getElementById('select-all-recon-checkbox');

  if (bulkBtn && countEl) {
    countEl.innerText = count;
    if (count > 0) {
      bulkBtn.classList.remove('hidden');
    } else {
      bulkBtn.classList.add('hidden');
    }
  }

  if (selectAllCb) {
    selectAllCb.checked = count > 0 && count === source.length;
  }
}

function resetReconciliation() {
  AUDIT_STATE.portalTransactions = [];
  AUDIT_STATE.accountingTransactions = [];
  AUDIT_STATE.separateReconResults = [];
  AUDIT_STATE.groupedReconResults = [];
  AUDIT_STATE.reconFilter = 'ALL';
  AUDIT_STATE.reconSearchQuery = '';
  AUDIT_STATE.selectedRowIndices.clear();

  const gInfo = document.getElementById('gateway-file-info');
  const bInfo = document.getElementById('bank-file-info');
  const gPill = document.getElementById('gateway-status-pill');
  const bPill = document.getElementById('bank-status-pill');
  const gInp = document.getElementById('file-gateway-input');
  const bInp = document.getElementById('file-bank-input');
  const wrap = document.getElementById('recon-results-wrapper');

  if (gInfo) gInfo.classList.add('hidden');
  if (bInfo) bInfo.classList.add('hidden');
  if (gPill) {
    gPill.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    gPill.innerText = 'Awaiting Portal File';
  }
  if (bPill) {
    bPill.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    bPill.innerText = 'Awaiting Accounting File';
  }

  if (gInp) gInp.value = '';
  if (bInp) bInp.value = '';
  
  const sInp = document.getElementById('file-single-sheet-input');
  const sInfo = document.getElementById('single-sheet-file-info');
  const sPill = document.getElementById('single-sheet-status-pill');
  const sCfg = document.getElementById('single-sheet-config-panel');
  const sCol = document.getElementById('single-sheet-columns-panel');
  if (sInp) sInp.value = '';
  if (sInfo) sInfo.classList.add('hidden');
  if (sCfg) sCfg.classList.add('hidden');
  if (sCol) sCol.classList.add('hidden');
  if (sPill) {
    sPill.className = 'text-xs font-mono font-bold px-3 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700';
    sPill.innerText = 'Awaiting 1 Audit Sheet';
  }

  if (wrap) wrap.classList.add('hidden');
  updateBulkActionsToolbar();
  showToast('Reconciliation reset', 'info');
}

// ================= LOAD REALISTIC DEMO DATA =================
function loadDemoData() {
  // Real Portal Data (Collection History: 14 transactions = ₹2,599,368.00)
  const demoPortal = [
    { 'Txn ID': 'FIN261002114622RXSOX', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 58914 },
    { 'Txn ID': 'FIN261002113801THW7Z', 'Status': 'Failure', 'Txn Type': 'Payout', 'Amount': 137769 },
    { 'Txn ID': 'FIN26100211090440STD', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 73800 },
    { 'Txn ID': 'FIN261002110837AMBUY', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 1 },
    { 'Txn ID': 'RT1011G1790919384',   'Status': 'Failure', 'Txn Type': 'Payin',  'Amount': 987 },
    { 'Txn ID': 'FIN261002110618BIB9M', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 49199 },
    { 'Txn ID': 'FIN26100211021708FYV', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 24548 },
    { 'Txn ID': 'FIN261002105429NBNLL', 'Status': 'Success', 'Txn Type': 'Payout', 'Amount': 93282 },
    { 'Txn ID': 'FIN261002104442RKZBD', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 9746 },
    { 'Txn ID': 'FIN2610021041440FU4M', 'Status': 'Failure', 'Txn Type': 'Payin',  'Amount': 151122 },
    { 'Txn ID': 'FIN261002104105MQR3P', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104047WR8U2', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104029P8NB3', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 },
    { 'Txn ID': 'FIN261002104011ZII3Q', 'Status': 'Success', 'Txn Type': 'Payin',  'Amount': 500000 }
  ];

  // Real Accounting Data (Product Report: 6 transactions = ₹2,309,489.31)
  const demoAccounting = [
    { 'Sr No': 1, 'Txn ID': '20261002114732JBDEQ', 'Debit': 58914.11, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 2, 'Txn ID': '20261002110947LPNIJ', 'Debit': 73800.00, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 3, 'Txn ID': '20261002110709MTZWZ', 'Debit': 49199.02, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 4, 'Txn ID': '20261002110321QICNF', 'Debit': 24548.04, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 5, 'Txn ID': '20261002105623LVGTQ', 'Debit': 93282.14, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 6, 'Txn ID': '20261002104612TXSKQ', 'Debit': 0, 'Credit': 2009746.00, 'Type': 'INTERNAL TRANSFER', 'Remark': 'neo to nex' }
  ];

  AUDIT_STATE.portalTransactions = demoPortal.map((r, idx) => parsePortalRow(r, idx));
  AUDIT_STATE.accountingTransactions = demoAccounting.map((r, idx) => parseAccountingRow(r, idx));

  const totalPortalSum = AUDIT_STATE.portalTransactions.reduce((a, b) => a + b.amount, 0);
  const totalAccSum = AUDIT_STATE.accountingTransactions.reduce((a, b) => a + b.amount, 0);

  const gFn = document.getElementById('gateway-filename');
  const gRc = document.getElementById('gateway-rowcount');
  const gInfo = document.getElementById('gateway-file-info');
  const gPill = document.getElementById('gateway-status-pill');

  if (gFn) gFn.innerText = 'collection-history-1790922671259.csv';
  if (gRc) gRc.innerText = `${demoPortal.length} individual txns (${formatINR(totalPortalSum)})`;
  if (gInfo) gInfo.classList.remove('hidden');
  if (gPill) {
    gPill.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30';
    gPill.innerText = `${demoPortal.length} Loaded`;
  }

  const bFn = document.getElementById('bank-filename');
  const bRc = document.getElementById('bank-rowcount');
  const bInfo = document.getElementById('bank-file-info');
  const bPill = document.getElementById('bank-status-pill');

  if (bFn) bFn.innerText = 'ProductReport_2026-10-02.xlsx';
  if (bRc) bRc.innerText = `${demoAccounting.length} individual txns (${formatINR(totalAccSum)})`;
  if (bInfo) bInfo.classList.remove('hidden');
  if (bPill) {
    bPill.className = 'text-[11px] font-mono font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30';
    bPill.innerText = `${demoAccounting.length} Loaded`;
  }

  switchTab('recon');
  AUDIT_STATE.viewMode = 'separate';
  executeReconciliation();
  showToast('Loaded Demo Collection History & Product Report (All separate rows)!', 'success');
}

// ================= EXPORT RECONCILIATION REPORT (SHEETJS) =================
function exportAmountReconciliationReport(format = 'xlsx') {
  const isSep = AUDIT_STATE.viewMode === 'separate';
  const source = isSep ? AUDIT_STATE.separateReconResults : AUDIT_STATE.groupedReconResults;

  if (source.length === 0) {
    showToast('No reconciled data to export', 'warning');
    return;
  }

  let exportRows = [];

  if (isSep) {
    exportRows = source.map((r, idx) => ({
      'Sr No': idx + 1,
      'Status': r.status,
      'Audit Finding': r.action,
      'Portal Txn ID / REF': r.portalTxnId,
      'Portal Txn Type': r.portalType,
      'Portal Amount (INR)': r.portalAmount,
      'Accounting Txn ID / REF': r.accountingTxnId,
      'Accounting Txn Type': r.accountingType,
      'Accounting Amount (INR)': r.accountingAmount,
      'Variance (INR)': r.variance,
      'Manual Approval': r.isApproved ? 'YES (APPROVED)' : 'NO',
      'Approval Reason': r.approvalData ? r.approvalData.reason : 'N/A',
      'Auditor Remarks': r.approvalData ? r.approvalData.remarks : 'N/A',
      'Approved By': r.approvalData ? r.approvalData.author : 'N/A',
      'Approval Timestamp': r.approvalData ? r.approvalData.timestamp : 'N/A'
    }));
  } else {
    exportRows = source.map((r, idx) => ({
      'Sr No': idx + 1,
      'Amount (INR)': r.amount,
      'Portal Count': r.portalCount,
      'Accounting Count': r.accountingCount,
      'Matched Count': r.matchedCount,
      'Portal Total (INR)': r.portalTotal,
      'Accounting Total (INR)': r.accountingTotal,
      'Difference (INR)': r.difference,
      'Status': r.status,
      'Approval Status': r.isApproved ? 'YES (APPROVED)' : 'NO',
      'Approval Reason': r.approvalData ? r.approvalData.reason : 'N/A',
      'Auditor Remarks': r.approvalData ? r.approvalData.remarks : 'N/A',
      'Approved By': r.approvalData ? r.approvalData.author : 'N/A',
      'Approval Timestamp': r.approvalData ? r.approvalData.timestamp : 'N/A'
    }));
  }

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  const sheetName = isSep ? 'Separate_Transactions' : 'Amount_Reconciliation';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const filename = `Vasavi_Traders_${sheetName}_${new Date().toISOString().split('T')[0]}.${format}`;
  XLSX.writeFile(workbook, filename, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
  showToast(`Exported ${filename} successfully`, 'success');
}

// ================= SECTION 2: SINGLE-FILE FEE RULE AUDIT =================
async function handleSingleFeeFile(file) {
  if (!file) return;
  try {
    const rawData = await parseFileToJSON(file);
    if (!rawData || rawData.length === 0) {
      showToast('Transaction file is empty', 'error');
      return;
    }

    AUDIT_STATE.feeAuditData = rawData;
    const fnEl = document.getElementById('fee-filename');
    const rcEl = document.getElementById('fee-rowcount');
    const infoEl = document.getElementById('fee-file-info');

    if (fnEl) fnEl.innerText = file.name;
    if (rcEl) rcEl.innerText = `${rawData.length} rows`;
    if (infoEl) infoEl.classList.remove('hidden');

    runFeeComplianceAudit(rawData);
    showToast(`Audited ${rawData.length} transactions against statutory fee matrix`, 'success');
  } catch (err) {
    console.error('Error reading fee audit file:', err);
    showToast('Failed to parse fee audit file: ' + err.message, 'error');
  }
}

function runFeeComplianceAudit(rawData) {
  const results = [];
  let correctCount = 0;
  let overchargeCount = 0;
  let underchargeCount = 0;
  let overchargeTotal = 0;
  let underchargeTotal = 0;
  let grossTotal = 0;

  rawData.forEach((row, idx) => {
    let txnId = `TXN-${idx + 1001}`;
    let cardStr = 'visa';
    let gross = 0;
    let chargedFee = 0;

    for (const [k, v] of Object.entries(row)) {
      const kClean = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (kClean.includes('txnid') || kClean.includes('ref') || kClean.includes('order')) txnId = String(v);
      if (kClean.includes('card') || kClean.includes('network') || kClean.includes('bank')) cardStr = String(v).toLowerCase();
      if (kClean.includes('gross') || kClean.includes('amount') || kClean.includes('swiped')) gross = cleanNumber(v);
      if (kClean.includes('fee') || kClean.includes('charge')) chargedFee = cleanNumber(v);
    }

    grossTotal += gross;

    let feeRule = VASAVI_FEE_RULES.visa;
    if (cardStr.includes('rupay')) feeRule = VASAVI_FEE_RULES.rupay;
    else if (cardStr.includes('master')) feeRule = VASAVI_FEE_RULES.mastercard;
    else if (cardStr.includes('sbi') || cardStr.includes('hdfc') || cardStr.includes('onecard') || cardStr.includes('one card')) feeRule = VASAVI_FEE_RULES.sbi_hdfc;
    else if (cardStr.includes('amex') || cardStr.includes('american')) feeRule = VASAVI_FEE_RULES.amex;
    else if (cardStr.includes('corp') || cardStr.includes('business')) feeRule = VASAVI_FEE_RULES.corporate;

    const expectedFee = Math.round(gross * feeRule.rate * 100) / 100;
    const feeDiff = chargedFee - expectedFee;

    let status = 'CORRECT';
    let finding = 'Compliant Rate Applied ✅';
    let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

    if (Math.abs(feeDiff) > 1.0) {
      if (feeDiff > 0) {
        status = 'OVERCHARGED';
        finding = `Overcharged by ₹${feeDiff.toFixed(2)} ⚠️`;
        badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
        overchargeCount++;
        overchargeTotal += feeDiff;
      } else {
        status = 'UNDERCHARGED';
        finding = `Fee Leakage: -₹${Math.abs(feeDiff).toFixed(2)} 🚨`;
        badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
        underchargeCount++;
        underchargeTotal += Math.abs(feeDiff);
      }
    } else {
      correctCount++;
    }

    results.push({
      txnId,
      card: feeRule.name,
      rateStr: `${(feeRule.rate * 100).toFixed(2)}%`,
      gross,
      expectedFee,
      chargedFee,
      feeDiff,
      status,
      finding,
      badgeClass
    });
  });

  AUDIT_STATE.feeAuditResults = results;

  const setTxt = (id, txt) => {
    const el = document.getElementById(id);
    if (el) el.innerText = txt;
  };

  setTxt('kpi-fee-correct-count', correctCount);
  const compliantRate = rawData.length > 0 ? Math.round((correctCount / rawData.length) * 100) : 0;
  setTxt('kpi-fee-correct-rate', `${compliantRate}% compliant`);

  setTxt('kpi-fee-over-count', overchargeCount);
  setTxt('kpi-fee-over-amount', `+${formatINR(overchargeTotal)} excess fee`);

  setTxt('kpi-fee-under-count', underchargeCount);
  setTxt('kpi-fee-under-amount', `-${formatINR(underchargeTotal)} fee leakage`);

  setTxt('kpi-fee-total-vol', formatINR(grossTotal));
  setTxt('kpi-fee-total-count', `${rawData.length} transactions`);

  const tbody = document.getElementById('fee-table-body');
  if (tbody) {
    tbody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-900/60 transition-colors border-b border-white/5';
      tr.innerHTML = `
        <td class="py-3 px-4">
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${r.badgeClass}">
            ${r.status}
          </span>
        </td>
        <td class="py-3 px-4 font-bold text-white">${escapeHTML(r.txnId)}</td>
        <td class="py-3 px-4 text-slate-300 text-xs">${escapeHTML(r.card)}</td>
        <td class="py-3 px-4 text-right text-slate-200">${formatINR(r.gross)}</td>
        <td class="py-3 px-4 text-right text-emerald-400 font-bold">${r.rateStr}</td>
        <td class="py-3 px-4 text-right text-cyan-300 font-mono">${formatINR(r.expectedFee)}</td>
        <td class="py-3 px-4 text-right text-slate-300 font-mono">${formatINR(r.chargedFee)}</td>
        <td class="py-3 px-4 text-right font-bold ${r.feeDiff === 0 ? 'text-slate-400' : (r.feeDiff > 0 ? 'text-amber-400' : 'text-rose-400')}">
          ${r.feeDiff === 0 ? '₹0.00' : (r.feeDiff > 0 ? '+' : '') + formatINR(r.feeDiff)}
        </td>
        <td class="py-3 px-4 text-center">
          <span class="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
            ${r.finding}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const wrap = document.getElementById('fee-results-wrapper');
  if (wrap) {
    wrap.classList.remove('hidden');
    wrap.scrollIntoView({ behavior: 'smooth' });
  }
}

function exportFeeAuditReport() {
  if (AUDIT_STATE.feeAuditResults.length === 0) {
    showToast('No fee audit data to export', 'warning');
    return;
  }

  const exportRows = AUDIT_STATE.feeAuditResults.map((r, idx) => ({
    'Sr No': idx + 1,
    'Audit Status': r.status,
    'Txn ID': r.txnId,
    'Card Network': r.card,
    'Contractual Fee Rate': r.rateStr,
    'Gross Amount (INR)': r.gross,
    'Expected Contractual Fee (INR)': r.expectedFee,
    'Actually Charged Fee (INR)': r.chargedFee,
    'Fee Variance (INR)': r.feeDiff,
    'Audit Finding': r.finding
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee_Compliance_Audit');

  const filename = `Vasavi_Traders_Fee_Compliance_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx' });
  showToast(`Exported ${filename} successfully`, 'success');
}

// ================= SAMPLE TEMPLATES =================
function downloadSampleGatewayTemplate() {
  const sample = [
    { 'Txn ID': 'FIN261002001', 'Txn Type': 'Payout', 'Amount': 50000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002002', 'Txn Type': 'Payout', 'Amount': 25000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002003', 'Txn Type': 'Payout', 'Amount': 75000, 'Status': 'Success' },
    { 'Txn ID': 'FIN261002004', 'Txn Type': 'Payin',  'Amount': 100000, 'Status': 'Success' }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Portal_Data');
  XLSX.writeFile(wb, 'Sample_Portal_Collection_History.xlsx');
  showToast('Downloaded Sample Portal Template', 'success');
}

function downloadSampleBankTemplate() {
  const sample = [
    { 'Sr No': 1, 'Product Name': 'NEX LEVELPAY', 'Debit': 50000, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 2, 'Product Name': 'NEX LEVELPAY', 'Debit': 25000, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 3, 'Product Name': 'NEX LEVELPAY', 'Debit': 75000, 'Credit': 0, 'Type': 'PAYOUT' },
    { 'Sr No': 4, 'Product Name': 'NEX LEVELPAY', 'Debit': 0, 'Credit': 100000, 'Type': 'INTERNAL TRANSFER' }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Accounting_Data');
  XLSX.writeFile(wb, 'Sample_Accounting_Product_Report.xlsx');
  showToast('Downloaded Sample Accounting Template', 'success');
}

function downloadSampleFeeTemplate() {
  const sample = [
    { 'Txn ID': 'TXN-FEE-001', 'Card': 'Visa', 'Gross Amount': 50000, 'Fee': 900, 'Actual Payout': 49100 },
    { 'Txn ID': 'TXN-FEE-002', 'Card': 'RuPay', 'Gross Amount': 30000, 'Fee': 480, 'Actual Payout': 29520 }
  ];
  const ws = XLSX.utils.json_to_sheet(sample);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fee_Audit_Template');
  XLSX.writeFile(wb, 'Sample_Fee_Compliance_Template.xlsx');
  showToast('Downloaded Sample Fee Template', 'success');
}

// ================= UTILITIES & HELPERS =================
function formatINR(val) {
  const num = parseFloat(val) || 0;
  return '₹' + num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('audit-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgClass = type === 'success' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-200' :
                  type === 'error' ? 'bg-rose-950 border-rose-500/50 text-rose-200' :
                  type === 'warning' ? 'bg-amber-950 border-amber-500/50 text-amber-200' :
                  'bg-slate-900 border-slate-700 text-slate-200';

  const icon = type === 'success' ? 'fa-circle-check text-emerald-400' :
               type === 'error' ? 'fa-circle-xmark text-rose-400' :
               type === 'warning' ? 'fa-triangle-exclamation text-amber-400' :
               'fa-info-circle text-cyan-400';

  toast.className = `flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-xl backdrop-blur-md text-xs font-mono transition-all transform translate-y-2 opacity-0 pointer-events-auto ${bgClass}`;
  toast.innerHTML = `<i class="fas ${icon} text-sm"></i> <span>${escapeHTML(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 30);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Drag & Drop visual feedback
['dropzone-gateway', 'dropzone-bank', 'dropzone-fee'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('border-emerald-400', 'bg-emerald-500/10');
  });
  el.addEventListener('dragleave', (e) => {
    e.preventDefault();
    el.classList.remove('border-emerald-400', 'bg-emerald-500/10');
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('border-emerald-400', 'bg-emerald-500/10');
    const file = e.dataTransfer.files[0];
    if (id === 'dropzone-gateway') handleGatewayFile(file);
    if (id === 'dropzone-bank') handleBankFile(file);
    if (id === 'dropzone-fee') handleSingleFeeFile(file);
  });
});

// Run auth check on load
document.addEventListener('DOMContentLoaded', () => {
  initAuditAuth();
});



// ================= DAILY ADMIN GRAND AUDIT (DAY-OVER-DAY BALANCE SHEET) =================

const DAILY_ADMIN_DATA = {
  date1: '22-10-2026',
  date2: '23-10-2026',
  in22: [
    { service: 'nex levelapay', amount: 100636, cat: 'PRODUCTS' },
    { service: 'PAYTM POS', amount: 2213630, cat: 'PRODUCTS' },
    { service: 'neo', amount: 980732, cat: 'PRODUCTS' },
    { service: 'axis travel POS', amount: 582914, cat: 'PRODUCTS' },
    { service: 'vasavi tmb', amount: 824946, cat: 'PRODUCTS' },
    { service: 'SURYA TMB', amount: 177437, cat: 'PRODUCTS' },
    { service: 'lavanya can', amount: 4000, cat: 'PRODUCTS' },
    { service: 'kanaganti naresh can', amount: 373248, cat: 'PRODUCTS' },
    { service: 'rayapati sateesh can', amount: 23000, cat: 'QRS' },
    { service: 'srinvasarao can', amount: 20500, cat: 'QRS' },
    { service: 'ambati sateeesh', amount: 222658, cat: 'QRS' },
    { service: 'karthik can', amount: 49629, cat: 'QRS' },
    { service: 'NAGESH can', amount: 170305, cat: 'QRS' },
    { service: 'raheem union', amount: 139033, cat: 'QRS' },
    { service: 'JSR union', amount: 250308, cat: 'QRS' },
    { service: 'GOOOD LEAF POS', amount: 77000, cat: 'POS' },
    { service: 'CASH +bob vasavi', amount: 34000, cat: 'POS' },
    { service: 'HDFC ONELIFE pos', amount: 0, cat: 'POS' },
    { service: 'BANDHAN POS', amount: 332290, cat: 'POS' },
    { service: 'cashfree', amount: 86000, cat: 'POS' },
    { service: 'yaseen card', amount: 200000, cat: 'POS' },
    { service: 'ys15 all23r10', amount: 50000, cat: 'POS' },
    { service: 'pay and swipe', amount: 95000, cat: 'POS' },
    { service: 'CUSTOMER PENDING', amount: 999000, cat: 'POS' }
  ],
  out22: [
    { service: 'varun', amount: 42000 },
    { service: 'pavan', amount: 52000 },
    { service: 'need cal', amount: 500000 },
    { service: 'ROBIN', amount: 147000 },
    { service: 'yes', amount: 30000 },
    { service: 'VASU', amount: 37000 },
    { service: 'fathin new gold am', amount: 500000 }
  ],
  in23: [
    { service: 'nex levelapay', amount: 799208, cat: 'PRODUCTS' },
    { service: 'PAYTM POS', amount: 2015494, cat: 'PRODUCTS' },
    { service: 'neo', amount: 1129197, cat: 'PRODUCTS' },
    { service: 'axis travel POS', amount: 168000, cat: 'PRODUCTS' },
    { service: 'vasavi tmb', amount: 345921, cat: 'PRODUCTS' },
    { service: 'SURYA TMB', amount: 410447, cat: 'PRODUCTS' },
    { service: 'lavanya can', amount: 4000, cat: 'PRODUCTS' },
    { service: 'kanaganti naresh can', amount: 63000, cat: 'PRODUCTS' },
    { service: 'rayapati sateesh can', amount: 122000, cat: 'QRS' },
    { service: 'srinvasarao can', amount: 563000, cat: 'QRS' },
    { service: 'ambati sateeesh', amount: 20462, cat: 'QRS' },
    { service: 'karthik can', amount: 49629, cat: 'QRS' },
    { service: 'NAGESH can', amount: 200000, cat: 'QRS' },
    { service: 'raheem union', amount: 139033, cat: 'QRS' },
    { service: 'JSR union', amount: 250308, cat: 'QRS' },
    { service: 'GOOOD LEAF POS', amount: 77000, cat: 'POS' },
    { service: 'CASH +bob vasavi', amount: 34000, cat: 'POS' },
    { service: 'HDFC ONELIFE pos', amount: 0, cat: 'POS' },
    { service: 'BANDHAN POS', amount: 214212, cat: 'POS' },
    { service: 'cashfree', amount: 86000, cat: 'POS' },
    { service: 'anji+mkir+pas', amount: 250000, cat: 'POS' },
    { service: 'yaseen card', amount: 200000, cat: 'POS' },
    { service: 'ys15 all23r10', amount: 50000, cat: 'POS' },
    { service: 'pay and swipe', amount: 95000, cat: 'POS' },
    { service: 'CUSTOMER PENDING', amount: 1299000, cat: 'POS' }
  ],
  out23: [
    { service: 'varun', amount: 42000 },
    { service: 'pavan', amount: 52000 },
    { service: 'need cal', amount: 500000 },
    { service: 'pvan', amount: 300000 },
    { service: 'ROBIN', amount: 44000 },
    { service: 'yes', amount: 30000 },
    { service: 'pavan', amount: 295000 },
    { service: 'thin new gold a', amount: 500000 }
  ],
  diff22: -136992,
  diff23: 123645,
  adminFilter: 'ALL',
  adminSearch: ''
};

function renderDailyAdminSpreadsheet() {
  const container = document.getElementById('admin-spreadsheet-table-container');
  if (!container) return;

  const d = DAILY_ADMIN_DATA;
  const in22Total = d.in22.reduce((acc, r) => acc + r.amount, 0);
  const out22Total = d.out22.reduce((acc, r) => acc + r.amount, 0);
  const net22 = in22Total - out22Total;

  const in23Total = d.in23.reduce((acc, r) => acc + r.amount, 0);
  const out23Total = d.out23.reduce((acc, r) => acc + r.amount, 0);
  const net23 = in23Total - out23Total;

  const maxRows = Math.max(d.in22.length, d.in23.length, d.out22.length, d.out23.length, 25);

  let rowsHTML = '';
  for (let idx = 0; idx < maxRows; idx++) {
    // 22nd Data
    const in22Item = d.in22[idx] || { service: '', amount: null, cat: '' };
    const out22Item = d.out22[idx] || { service: '', amount: null };

    // 23rd Data
    const in23Item = d.in23[idx] || { service: '', amount: null, cat: '' };
    const out23Item = d.out23[idx] || { service: '', amount: null };

    // Row Category styling
    let cat22Text = '';
    let cat22Class = 'bg-slate-900 text-slate-400 font-extrabold text-[11px] text-center border-r border-slate-700';
    if (idx === 0) cat22Text = '<span class="text-sky-300">PRODUCTS</span>';
    else if (idx === 8) cat22Text = '<span class="text-lime-300">Q R S</span>';
    else if (idx === 15) cat22Text = '<span class="text-amber-300">P O S</span>';

    // Cell coloring based on category
    let in22Bg = 'bg-slate-900/60';
    let in23Bg = 'bg-slate-900/60';
    if (idx < 8) {
      in22Bg = 'bg-blue-950/40 text-blue-200 border-blue-900/40';
      in23Bg = 'bg-blue-950/40 text-blue-200 border-blue-900/40';
    } else if (idx < 15) {
      in22Bg = idx % 2 === 0 ? 'bg-emerald-950/40 text-emerald-200' : 'bg-rose-950/30 text-rose-200';
      in23Bg = idx % 2 === 0 ? 'bg-emerald-950/40 text-emerald-200' : 'bg-rose-950/30 text-rose-200';
    } else {
      in22Bg = 'bg-amber-950/30 text-amber-200';
      in23Bg = 'bg-amber-950/30 text-amber-200';
    }

    const out22Bg = out22Item.amount ? (out22Item.amount >= 500000 ? 'bg-indigo-950/60 text-indigo-200 font-bold' : 'bg-rose-950/40 text-rose-200') : 'bg-slate-900/30 text-slate-500';
    const out23Bg = out23Item.amount ? (out23Item.amount >= 500000 ? 'bg-indigo-950/60 text-indigo-200 font-bold' : 'bg-rose-950/40 text-rose-200') : 'bg-slate-900/30 text-slate-500';

    rowsHTML += `
      <tr class="hover:bg-slate-800/40 transition-colors border-b border-slate-800/60 text-xs font-mono">
        <!-- 22nd Oct Block -->
        <td class="p-2 border-r border-slate-700/80 font-bold text-center text-[10px] w-8 ${in22Bg}">
          ${idx < 8 ? (idx === 0 ? 'P' : idx===1?'R':idx===2?'O':idx===3?'D':idx===4?'U':idx===5?'C':idx===6?'T':'S') : (idx < 15 ? (idx === 8 ? 'Q' : idx===9?'R':idx===10?'S':'') : (idx===15?'P':idx===16?'O':idx===17?'S':''))}
        </td>
        <td class="p-2 border-r border-slate-800 text-left font-medium ${in22Bg}">${in22Item.service || '-'}</td>
        <td class="p-2 border-r border-slate-700 text-right font-bold ${in22Bg}">${in22Item.amount !== null ? in22Item.amount.toLocaleString('en-IN') : ''}</td>
        <td class="p-2 border-r border-slate-800 text-center ${out22Bg}">${out22Item.service || ''}</td>
        <td class="p-2 border-r-2 border-amber-400/50 text-right font-bold ${out22Bg}">${out22Item.amount !== null ? out22Item.amount.toLocaleString('en-IN') : ''}</td>

        <!-- 23rd Oct Block -->
        <td class="p-2 border-r border-slate-700/80 font-bold text-center text-[10px] w-8 ${in23Bg}">
          ${idx < 8 ? (idx === 0 ? 'P' : idx===1?'R':idx===2?'O':idx===3?'D':idx===4?'U':idx===5?'C':idx===6?'T':'S') : (idx < 15 ? (idx === 8 ? 'Q' : idx===9?'R':idx===10?'S':'') : (idx===15?'P':idx===16?'O':idx===17?'S':''))}
        </td>
        <td class="p-2 border-r border-slate-800 text-left font-medium ${in23Bg}">${in23Item.service || '-'}</td>
        <td class="p-2 border-r border-slate-700 text-right font-bold ${in23Bg}">${in23Item.amount !== null ? in23Item.amount.toLocaleString('en-IN') : ''}</td>
        <td class="p-2 border-r border-slate-800 text-center ${out23Bg}">${out23Item.service || ''}</td>
        <td class="p-2 text-right font-bold ${out23Bg}">${out23Item.amount !== null ? out23Item.amount.toLocaleString('en-IN') : ''}</td>
      </tr>
    `;
  }

  container.innerHTML = `
    <table class="w-full border-collapse text-xs">
      <thead>
        <!-- Row 1: Date Headers -->
        <tr class="font-extrabold text-sm border-b border-slate-700">
          <th colspan="5" class="p-3 text-center bg-slate-900 text-cyan-300 border-r-2 border-amber-400/60 uppercase tracking-wide">
            22-10-2026 FINAL CARRY FARWORD
          </th>
          <th colspan="5" class="p-3 text-center bg-slate-900 text-emerald-300 uppercase tracking-wide">
            23-10-2026 FINAL CARRY FARWORD
          </th>
        </tr>

        <!-- Row 2: grand audit yellow banner -->
        <tr class="bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest border-b border-amber-500">
          <th colspan="5" class="p-2 text-center border-r-2 border-slate-950">grand audit</th>
          <th colspan="5" class="p-2 text-center">grand audit</th>
        </tr>

        <!-- Row 3: in / out green and red banners -->
        <tr class="text-slate-950 font-extrabold text-xs uppercase tracking-wider">
          <th class="w-8 bg-slate-950 border-r border-slate-800"></th>
          <th colspan="2" class="p-2 text-center bg-emerald-500 text-slate-950 border-r border-slate-900">in (Collections)</th>
          <th colspan="2" class="p-2 text-center bg-rose-500 text-white border-r-2 border-amber-400/60">out (Payouts)</th>

          <th class="w-8 bg-slate-950 border-r border-slate-800"></th>
          <th colspan="2" class="p-2 text-center bg-emerald-500 text-slate-950 border-r border-slate-900">in (Collections)</th>
          <th colspan="2" class="p-2 text-center bg-rose-500 text-white">out (Payouts)</th>
        </tr>

        <!-- Row 4: Column Headers -->
        <tr class="bg-amber-600/90 text-white font-bold text-[11px] uppercase border-b border-slate-700 font-mono">
          <th class="p-2 text-center w-8 border-r border-slate-700">Cat</th>
          <th class="p-2 text-left border-r border-slate-700">service</th>
          <th class="p-2 text-right border-r border-slate-700">amount</th>
          <th class="p-2 text-center border-r border-slate-700">service</th>
          <th class="p-2 text-right border-r-2 border-amber-400/60">amount</th>

          <th class="p-2 text-center w-8 border-r border-slate-700">Cat</th>
          <th class="p-2 text-left border-r border-slate-700">service</th>
          <th class="p-2 text-right border-r border-slate-700">amount</th>
          <th class="p-2 text-center border-r border-slate-700">service</th>
          <th class="p-2 text-right">amount</th>
        </tr>
      </thead>

      <tbody class="divide-y divide-slate-800 font-mono">
        ${rowsHTML}
      </tbody>

      <tfoot>
        <!-- Total Pay In / Pay Out Row -->
        <tr class="font-extrabold font-mono text-xs border-t-2 border-slate-700 bg-slate-950">
          <td class="p-2.5 text-center bg-slate-950 text-slate-500 border-r border-slate-800">Σ</td>
          <td class="p-2.5 text-center text-slate-200 border-r border-slate-800">pay in total</td>
          <td class="p-2.5 text-right bg-emerald-600 text-white border-r border-slate-800 font-bold">
            ${in22Total.toLocaleString('en-IN')}
          </td>
          <td class="p-2.5 text-center text-slate-200 border-r border-slate-800">payout total</td>
          <td class="p-2.5 text-right bg-rose-600 text-white border-r-2 border-amber-400/60 font-bold">
            ${out22Total.toLocaleString('en-IN')}
          </td>

          <td class="p-2.5 text-center bg-slate-950 text-slate-500 border-r border-slate-800">Σ</td>
          <td class="p-2.5 text-center text-slate-200 border-r border-slate-800">pay in total</td>
          <td class="p-2.5 text-right bg-emerald-600 text-white border-r border-slate-800 font-bold">
            ${in23Total.toLocaleString('en-IN')}
          </td>
          <td class="p-2.5 text-center text-slate-200 border-r border-slate-800">payout total</td>
          <td class="p-2.5 text-right bg-rose-600 text-white font-bold">
            ${out23Total.toLocaleString('en-IN')}
          </td>
        </tr>

        <!-- Net Carry Forward Balance Row (In - Out) -->
        <tr class="font-extrabold font-mono text-xs border-t border-slate-800 bg-slate-900">
          <td colspan="5" class="p-3 text-center border-r-2 border-amber-400/60 text-slate-100 text-sm">
            Net Closing Balance: <strong class="text-white font-mono text-base font-black">${net22.toLocaleString('en-IN')}.00</strong>
          </td>
          <td colspan="5" class="p-3 text-center text-slate-100 text-sm">
            Net Closing Balance: <strong class="text-white font-mono text-base font-black">${net23.toLocaleString('en-IN')}.00</strong>
          </td>
        </tr>

        <!-- Bottom Difference Box Row -->
        <tr class="font-black font-mono text-xs border-t border-slate-700 bg-slate-950">
          <td colspan="5" class="p-3 text-center border-r-2 border-amber-400/60 bg-amber-500/15 text-amber-300 text-sm">
            Carry Forward Balance Diff: <span class="text-rose-400 font-bold text-base">-136,992.00</span>
          </td>
          <td colspan="5" class="p-3 text-center bg-amber-500/20 text-amber-300 text-sm">
            Day-over-Day Carry Forward Shift: <span class="text-emerald-400 font-bold text-base">+123,645.00</span>
            <span class="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              (6,821,911 - 6,698,266 = +123,645)
            </span>
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

function renderAdminVarianceTable() {
  const tbody = document.getElementById('admin-variance-table-body');
  if (!tbody) return;

  const d = DAILY_ADMIN_DATA;
  const dict22 = {};
  d.in22.forEach(x => { dict22[x.service] = x; });

  const dict23 = {};
  d.in23.forEach(x => { dict23[x.service] = x; });

  // Merge unique services
  const allServices = [];
  d.in22.forEach(x => { if (!allServices.includes(x.service)) allServices.push(x.service); });
  d.in23.forEach(x => { if (!allServices.includes(x.service)) allServices.push(x.service); });

  let items = allServices.map((srv, idx) => {
    const item22 = dict22[srv] || { amount: 0, cat: 'POS' };
    const item23 = dict23[srv] || { amount: 0, cat: 'POS' };
    const amt22 = item22.amount || 0;
    const amt23 = item23.amount || 0;
    const diff = amt23 - amt22;
    const pct = amt22 > 0 ? (diff / amt22 * 100) : (amt23 > 0 ? 100 : 0);

    let status = 'BALANCED';
    if (!dict22[srv] && dict23[srv]) status = 'NEW';
    else if (diff > 0) status = 'INCREASED';
    else if (diff < 0) status = 'DECREASED';

    const cat = item23.cat || item22.cat || 'POS';

    return {
      srNo: idx + 1,
      service: srv,
      category: cat,
      amt22,
      amt23,
      diff,
      pct,
      status
    };
  });

  // Update counts
  const cntAll = items.length;
  const cntInc = items.filter(x => x.status === 'INCREASED').length;
  const cntDec = items.filter(x => x.status === 'DECREASED').length;
  const cntBal = items.filter(x => x.status === 'BALANCED').length;
  const cntNew = items.filter(x => x.status === 'NEW').length;

  const setT = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
  setT('cnt-var-all', cntAll);
  setT('cnt-var-inc', cntInc);
  setT('cnt-var-dec', cntDec);
  setT('cnt-var-bal', cntBal);
  setT('cnt-var-new', cntNew);

  // Apply filters
  if (d.adminFilter !== 'ALL') {
    items = items.filter(x => x.status === d.adminFilter);
  }

  // Apply search
  if (d.adminSearch) {
    const q = d.adminSearch.toLowerCase();
    items = items.filter(x => x.service.toLowerCase().includes(q) || x.category.toLowerCase().includes(q));
  }

  const cntTxt = document.getElementById('admin-variance-count-text');
  if (cntTxt) cntTxt.innerText = `Showing ${items.length} of ${cntAll} services`;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="text-center py-8 text-slate-500 font-mono">
          No services match the selected filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(r => {
    let statusBadge = '';
    let diffColor = 'text-slate-400';

    if (r.status === 'INCREASED') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"><i class="fas fa-arrow-up"></i> INCREASED</span>';
      diffColor = 'text-emerald-400';
    } else if (r.status === 'DECREASED') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40"><i class="fas fa-arrow-down"></i> DECREASED</span>';
      diffColor = 'text-rose-400';
    } else if (r.status === 'NEW') {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"><i class="fas fa-sparkles"></i> NEW ACCOUNT</span>';
      diffColor = 'text-cyan-400';
    } else {
      statusBadge = '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">● UNCHANGED</span>';
    }

    const catBadge = r.category === 'PRODUCTS' ? 'bg-sky-500/15 text-sky-300 border-sky-500/30' :
                     r.category === 'QRS' ? 'bg-lime-500/15 text-lime-300 border-lime-500/30' :
                     'bg-amber-500/15 text-amber-300 border-amber-500/30';

    return `
      <tr class="hover:bg-slate-900/60 transition-colors">
        <td class="py-3 px-4 text-center text-slate-500">${r.srNo}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${catBadge}">${r.category}</span>
        </td>
        <td class="py-3 px-4 font-bold text-white">${escapeHTML(r.service)}</td>
        <td class="py-3 px-4 text-right text-slate-300 font-mono">₹${r.amt22.toLocaleString('en-IN')}.00</td>
        <td class="py-3 px-4 text-right text-white font-mono font-bold">₹${r.amt23.toLocaleString('en-IN')}.00</td>
        <td class="py-3 px-4 text-right font-mono font-black ${diffColor}">
          ${r.diff > 0 ? '+' : ''}₹${r.diff.toLocaleString('en-IN')}.00
        </td>
        <td class="py-3 px-4 text-right font-mono ${diffColor}">
          ${r.diff > 0 ? '+' : ''}${r.pct.toFixed(1)}%
        </td>
        <td class="py-3 px-4 text-center">${statusBadge}</td>
      </tr>
    `;
  }).join('');
}

function filterAdminVariance(filter) {
  DAILY_ADMIN_DATA.adminFilter = filter;
  ['all', 'inc', 'dec', 'bal', 'new'].forEach(id => {
    const btn = document.getElementById(`admin-filter-${id}`);
    if (btn) btn.className = 'px-3 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white';
  });

  const activeId = filter === 'ALL' ? 'all' : filter === 'INCREASED' ? 'inc' : filter === 'DECREASED' ? 'dec' : filter === 'BALANCED' ? 'bal' : 'new';
  const activeBtn = document.getElementById(`admin-filter-${activeId}`);
  if (activeBtn) activeBtn.className = 'px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-500 text-slate-950 shadow-md';

  renderAdminVarianceTable();
}

function handleAdminVarianceSearch(query) {
  DAILY_ADMIN_DATA.adminSearch = (query || '').trim();
  renderAdminVarianceTable();
}

function downloadDailyAdminExcel() {
  const link = document.createElement('a');
  link.href = 'Daily_Admin_Grand_Audit_22_vs_23_Oct_2026.xlsx';
  link.download = 'Daily_Admin_Grand_Audit_22_vs_23_Oct_2026.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Downloading Daily Admin Grand Audit Excel (.xlsx)...', 'success');
}
