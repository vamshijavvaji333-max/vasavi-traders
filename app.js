// VASAVI TRADERS Financial Services & Credit Card Withdrawal Platform JS

document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  initCalculator();
  initWithdrawalModal();
  initLiveLedger();
  initFAQ();
  initChatbot();
  initTicker();
});

// App State
const state = {
  currency: 'INR', // 'INR', 'USD', 'EUR'
  symbols: { INR: '₹', USD: '$', EUR: '€' },
  rates: { INR: 1, USD: 0.012, EUR: 0.011 },
  cardFeeRates: {
    visa:       { fee: 0.018,  rewards: 2.5, name: 'Visa (All Cards)',              tag: '1.8%' },
    mastercard: { fee: 0.018,  rewards: 2.0, name: 'Mastercard (All Cards)',        tag: '1.8%' },
    rupay:      { fee: 0.016,  rewards: 3.0, name: 'RuPay Network (All Cards)',     tag: '1.6%' },
    sbi_hdfc:   { fee: 0.020,  rewards: 2.0, name: 'SBI / HDFC / OneCard',         tag: '2.0%' },
    amex:       { fee: 0.020,  rewards: 4.0, name: 'American Express (All Cards)',  tag: '2.0%' },
    corporate:  { fee: 0.020,  rewards: 1.5, name: 'Corporate Business Card',      tag: '2.0%' }
  },
  currentAmount: 50000, // base amount in INR
  currentCardType: 'visa',
  modalStep: 1,
  otpCountdown: 30,
  otpTimer: null
};

// 1. Particle Canvas Background Effect
function initParticleCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = Array.from({ length: 45 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 2 + 1,
    vx: (Math.random() - 0.5) * 0.5,
    vy: (Math.random() - 0.5) * 0.5,
    alpha: Math.random() * 0.5 + 0.2
  }));

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    const gridSize = 60;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Floating particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 230, 153, ${p.alpha})`;
      ctx.fill();
    });

    requestAnimationFrame(animate);
  }
  animate();
}

// Helper: Format Money
function formatCurrency(amountINR, targetCurr = state.currency) {
  const converted = amountINR * state.rates[targetCurr];
  const symbol = state.symbols[targetCurr];
  
  if (targetCurr === 'INR') {
    return symbol + Math.round(converted).toLocaleString('en-IN');
  } else {
    return symbol + converted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}

// 2. Withdrawal Calculator Logic
function initCalculator() {
  const slider = document.getElementById('calc-slider');
  const customInput = document.getElementById('calc-custom-input');
  const currencySelect = document.getElementById('currency-select');
  const cardTypeSelect = document.getElementById('card-type-select');

  if (!slider || !customInput) return;

  // Currency Switch
  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      state.currency = e.target.value;
      updateCalculatorUI();
      updateTickerCurrency();
    });
  }

  // Card Type Select
  if (cardTypeSelect) {
    cardTypeSelect.addEventListener('change', (e) => {
      state.currentCardType = e.target.value;
      updateCalculatorUI();
      updateCreditCardPreview();
    });
  }

  // Slider Input
  slider.addEventListener('input', (e) => {
    state.currentAmount = parseFloat(e.target.value);
    customInput.value = Math.round(state.currentAmount * state.rates[state.currency]);
    updateCalculatorUI();
  });

  // Custom Input
  customInput.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value) || 0;
    state.currentAmount = val / state.rates[state.currency];
    slider.value = state.currentAmount;
    updateCalculatorUI();
  });

  updateCalculatorUI();
}

function updateCalculatorUI() {
  const cardConfig = state.cardFeeRates[state.currentCardType];
  if (!cardConfig) return; // guard against unknown card type

  const grossINR   = state.currentAmount;
  const feeINR     = grossINR * cardConfig.fee;
  const netBankINR = grossINR - feeINR;
  const rewardPoints = Math.round((grossINR / 100) * cardConfig.rewards);

  // Update Display Elements
  const grossEl   = document.getElementById('display-gross');
  const feePerEl  = document.getElementById('display-fee-percent');
  const feeAmtEl  = document.getElementById('display-fee-amount');
  const netEl     = document.getElementById('display-net-payout');
  const rewardEl  = document.getElementById('display-rewards');
  const nameEl    = document.getElementById('calc-card-name');

  if (grossEl)  grossEl.innerText  = formatCurrency(grossINR);
  if (feePerEl) feePerEl.innerText = (cardConfig.fee * 100).toFixed(1) + '%';
  if (feeAmtEl) feeAmtEl.innerText = '- ' + formatCurrency(feeINR);
  if (netEl)    netEl.innerText    = formatCurrency(netBankINR);
  if (rewardEl) rewardEl.innerText = '+' + rewardPoints.toLocaleString() + ' PTS';
  if (nameEl)   nameEl.innerText   = cardConfig.name;

  // Highlight active preset button
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.remove('bg-emerald-500/20', 'border-emerald-400', 'text-emerald-400');
    if (parseFloat(btn.dataset.amount) === state.currentAmount) {
      btn.classList.add('bg-emerald-500/20', 'border-emerald-400', 'text-emerald-400');
    }
  });
}

function selectPresetAmount(amountINR) {
  state.currentAmount = amountINR;
  const slider = document.getElementById('calc-slider');
  const customInput = document.getElementById('calc-custom-input');
  if (slider) slider.value = amountINR;
  if (customInput) customInput.value = Math.round(amountINR * state.rates[state.currency]);
  updateCalculatorUI();
}

function updateCreditCardPreview() {
  const cardConfig = state.cardFeeRates[state.currentCardType];
  const logoEl = document.getElementById('preview-card-logo');
  const badgeEl = document.getElementById('preview-card-badge');

  if (badgeEl) badgeEl.innerText = cardConfig.name.toUpperCase();
  
  if (logoEl) {
    if (state.currentCardType === 'visa')        logoEl.innerHTML = '<span class="font-extrabold text-blue-400 text-xl tracking-wider">VISA</span>';
    else if (state.currentCardType === 'mastercard') logoEl.innerHTML = '<span class="font-extrabold text-orange-500 text-xl tracking-wider">Mastercard</span>';
    else if (state.currentCardType === 'rupay')   logoEl.innerHTML = '<span class="font-extrabold text-green-400 text-xl tracking-wider">RuPay</span>';
    else if (state.currentCardType === 'amex')    logoEl.innerHTML = '<span class="font-extrabold text-cyan-400 text-xl tracking-wider">AMEX</span>';
    else if (state.currentCardType === 'sbi_hdfc') logoEl.innerHTML = '<span class="font-extrabold text-rose-400 text-xl tracking-wider">SBI/HDFC</span>';
    else                                           logoEl.innerHTML = '<span class="font-extrabold text-amber-400 text-xl tracking-wider">CORPORATE</span>';
  }
}

// 3. Interactive 4-Step Withdrawal Execution Wizard
function initWithdrawalModal() {
  const modalOverlay = document.getElementById('withdrawal-modal');
  const triggerBtns = document.querySelectorAll('.trigger-withdraw-modal');
  const closeBtn = document.getElementById('close-modal-btn');

  triggerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      openWithdrawalModal();
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeWithdrawalModal);
  }

  // Step 1 Form Handler
  const step1Form = document.getElementById('wizard-step1-form');
  if (step1Form) {
    step1Form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Validate card details simulation
      showToast('Card Details Verified! Proceeding to Destination Bank Account setup.', 'success');
      goToModalStep(2);
    });
  }

  // Step 2 Form Handler
  const step2Form = document.getElementById('wizard-step2-form');
  if (step2Form) {
    step2Form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Penny drop simulation loader
      const btn = document.getElementById('btn-step2-proceed');
      btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Verifying Bank Account (Penny Drop)...';
      btn.disabled = true;

      setTimeout(() => {
        btn.innerHTML = 'Proceed to 2FA Security Step <i class="fas fa-arrow-right"></i>';
        btn.disabled = false;
        showToast('Penny-Drop Verified! Instant IMPS routing activated.', 'success');
        goToModalStep(3);
        startOTPTimer();
      }, 1500);
    });
  }

  // Step 3 OTP Form Handler
  const step3Form = document.getElementById('wizard-step3-form');
  if (step3Form) {
    step3Form.addEventListener('submit', (e) => {
      e.preventDefault();
      const otpVal = document.getElementById('otp-input').value;
      if (otpVal.length < 6) {
        showToast('Please enter a valid 6-digit OTP code', 'error');
        return;
      }
      
      showToast('OTP Authenticated! Initiating instant card cashout...', 'info');
      goToModalStep(4);
      simulatePayoutProgress();
    });
  }

  // Card Number Auto-Formatter
  const cardNumberInput = document.getElementById('card-number-input');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      let v = e.target.value.replace(/\D/g, '').substring(0, 16);
      let matches = v.match(/\d{4,16}/g);
      let match = (matches && matches[0]) || '';
      let parts = [];
      for (let i = 0, len = match.length; i < len; i += 4) {
        parts.push(match.substring(i, i + 4));
      }
      if (parts.length) {
        e.target.value = parts.join(' ');
      } else {
        e.target.value = v;
      }
    });
  }
}

function openWithdrawalModal() {
  const modalOverlay = document.getElementById('withdrawal-modal');
  if (!modalOverlay) return;

  // Sync amount display inside modal
  const cardConfig = state.cardFeeRates[state.currentCardType];
  const grossINR = state.currentAmount;
  const netBankINR = grossINR - (grossINR * cardConfig.fee);

  document.getElementById('modal-summary-amount').innerText = formatCurrency(grossINR);
  document.getElementById('modal-summary-payout').innerText = formatCurrency(netBankINR);
  document.getElementById('modal-summary-card').innerText = cardConfig.name;

  goToModalStep(1);
  modalOverlay.classList.add('active');
}

function closeWithdrawalModal() {
  const modalOverlay = document.getElementById('withdrawal-modal');
  if (modalOverlay) modalOverlay.classList.remove('active');
  if (state.otpTimer) clearInterval(state.otpTimer);
}

function goToModalStep(stepNumber) {
  state.modalStep = stepNumber;
  
  // Hide all step containers
  for (let i = 1; i <= 4; i++) {
    const stepEl = document.getElementById(`wizard-step-${i}`);
    const indicatorEl = document.getElementById(`step-indicator-${i}`);
    if (stepEl) stepEl.classList.add('hidden');
    if (indicatorEl) {
      indicatorEl.classList.remove('bg-emerald-500', 'text-black', 'border-emerald-400');
      indicatorEl.classList.add('bg-slate-800', 'text-slate-400', 'border-slate-700');
    }
  }

  // Show target step
  const targetStep = document.getElementById(`wizard-step-${stepNumber}`);
  if (targetStep) targetStep.classList.remove('hidden');

  // Highlight indicator step circles
  for (let i = 1; i <= stepNumber; i++) {
    const indicatorEl = document.getElementById(`step-indicator-${i}`);
    if (indicatorEl) {
      indicatorEl.classList.remove('bg-slate-800', 'text-slate-400', 'border-slate-700');
      indicatorEl.classList.add('bg-emerald-500', 'text-black', 'border-emerald-400');
    }
  }
}

function fillDemoOTP() {
  const otpInput = document.getElementById('otp-input');
  if (otpInput) {
    otpInput.value = '849204';
    showToast('Demo OTP 849204 auto-filled!', 'success');
  }
}

function startOTPTimer() {
  let timeLeft = 30;
  const timerEl = document.getElementById('otp-timer');
  if (state.otpTimer) clearInterval(state.otpTimer);

  state.otpTimer = setInterval(() => {
    timeLeft--;
    if (timerEl) timerEl.innerText = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(state.otpTimer);
      if (timerEl) timerEl.innerText = 'Resend available';
    }
  }, 1000);
}

function simulatePayoutProgress() {
  const progressLine = document.getElementById('payout-progress-bar');
  const statusBadge = document.getElementById('payout-status-badge');
  const step1Dot = document.getElementById('payout-step-1');
  const step2Dot = document.getElementById('payout-step-2');
  const step3Dot = document.getElementById('payout-step-3');
  const refNumEl = document.getElementById('payout-ref-num');

  const refCode = 'TXN-' + Math.floor(10000000 + Math.random() * 90000000);
  if (refNumEl) refNumEl.innerText = refCode;

  // Step 1: Card Charge
  setTimeout(() => {
    if (progressLine) progressLine.style.width = '33%';
    if (step1Dot) step1Dot.className = 'w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold shadow-lg shadow-emerald-500/50';
  }, 500);

  // Step 2: Fraud Shield Clear
  setTimeout(() => {
    if (progressLine) progressLine.style.width = '66%';
    if (step2Dot) step2Dot.className = 'w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold shadow-lg shadow-emerald-500/50';
    if (statusBadge) statusBadge.innerText = 'INSTANT IMPS DISPATCH IN PROGRESS';
  }, 1800);

  // Step 3: Bank Deposited
  setTimeout(() => {
    if (progressLine) progressLine.style.width = '100%';
    if (step3Dot) step3Dot.className = 'w-10 h-10 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold shadow-lg shadow-emerald-500/50';
    if (statusBadge) {
      statusBadge.className = 'px-4 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-400 font-bold text-xs uppercase tracking-wider inline-flex items-center gap-2';
      statusBadge.innerHTML = '<span class="pulse-dot"></span> FUNDS SUCCESSFULLY DEPOSITED TO BANK';
    }
    document.getElementById('payout-done-actions').classList.remove('hidden');
    showToast(`Success! Payout ${formatCurrency(state.currentAmount)} credited to bank account!`, 'success');
  }, 3200);
}

// 4. Live Ledger & Recent Transactions Feed
const sampleNames = ['Rohan M.', 'Ananya S.', 'Vikram P.', 'Deepak K.', 'Priya R.', 'Arjun T.', 'Kavita B.', 'Siddharth G.'];
const sampleBanks = ['HDFC Bank', 'ICICI Bank', 'SBI Bank', 'Axis Bank', 'Chase Bank', 'Bank of America'];

function initLiveLedger() {
  const ledgerBody = document.getElementById('live-ledger-body');
  if (!ledgerBody) return;

  // Initial Population
  for (let i = 0; i < 5; i++) {
    addLedgerRow(ledgerBody, false);
  }

  // Periodic insertion simulation
  setInterval(() => {
    addLedgerRow(ledgerBody, true);
  }, 5000);
}

function addLedgerRow(container, isNew = false) {
  const name = sampleNames[Math.floor(Math.random() * sampleNames.length)];
  const bank = sampleBanks[Math.floor(Math.random() * sampleBanks.length)];
  const cardTypes = ['Visa Platinum', 'Mastercard World', 'RuPay Select', 'Amex Platinum'];
  const card = cardTypes[Math.floor(Math.random() * cardTypes.length)];
  const amountINR = Math.floor(Math.random() * 80 + 10) * 1000;
  const time = 'Just now';

  const tr = document.createElement('tr');
  tr.className = 'border-b border-slate-800/60 hover:bg-slate-800/30 transition-colors ' + (isNew ? 'bg-emerald-500/10' : '');
  tr.innerHTML = `
    <td class="py-3 px-4 flex items-center gap-3">
      <div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400">
        ${name.substring(0, 2)}
      </div>
      <div>
        <div class="font-medium text-slate-200">${name}</div>
        <div class="text-xs text-slate-500">${card}</div>
      </div>
    </td>
    <td class="py-3 px-4 font-mono font-bold text-emerald-400">${formatCurrency(amountINR)}</td>
    <td class="py-3 px-4 text-slate-300 text-sm">
      <span class="inline-flex items-center gap-1.5"><i class="fas fa-university text-xs text-slate-500"></i> ${bank}</span>
    </td>
    <td class="py-3 px-4 text-right">
      <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <i class="fas fa-check-circle text-xs"></i> IMPS SETTLED
      </span>
    </td>
  `;

  if (isNew && container.firstChild) {
    container.insertBefore(tr, container.firstChild);
    if (container.children.length > 7) {
      container.removeChild(container.lastChild);
    }
  } else {
    container.appendChild(tr);
  }
}

// 5. FAQ Accordion & Search Filter
function initFAQ() {
  const faqItems = document.querySelectorAll('.faq-header');
  faqItems.forEach(header => {
    header.addEventListener('click', () => {
      const content = header.nextElementSibling;
      const icon = header.querySelector('.faq-icon');
      
      const isOpen = !content.classList.contains('hidden');
      
      // Close all others
      document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => i.style.transform = 'rotate(0deg)');

      if (!isOpen) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
      }
    });
  });
}

// 6. Floating Support Chatbot Widget
function initChatbot() {
  const toggleBtn = document.getElementById('chat-toggle-btn');
  const chatWindow = document.getElementById('chat-window');
  const closeBtn = document.getElementById('chat-close-btn');
  const sendBtn = document.getElementById('chat-send-btn');
  const inputEl = document.getElementById('chat-input');
  const messagesContainer = document.getElementById('chat-messages');

  if (!toggleBtn || !chatWindow) return;

  toggleBtn.addEventListener('click', () => {
    chatWindow.classList.toggle('hidden');
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      chatWindow.classList.add('hidden');
    });
  }

  function handleSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    // User Message
    appendChatMessage(text, 'user');
    inputEl.value = '';

    // Bot Response Simulation
    setTimeout(() => {
      let botReply = "Thank you for reaching out! Our 24/7 instant cashout support team is monitoring all credit card withdrawals. Processing time is usually under 60 seconds via IMPS.";
      
      const lower = text.toLowerCase();
      if (lower.includes('fee') || lower.includes('charge')) {
        botReply = "Our processing fee starts at just 1.6% for RuPay, 1.8% for Visa & Mastercard, 1.8% for Corporate, and 2.0% for SBI, HDFC, OneCard & Amex with 0 hidden charges.";
      } else if (lower.includes('time') || lower.includes('fast')) {
        botReply = "Withdrawals are settled instantly via 24/7 IMPS/UPI bank routing directly into your account.";
      } else if (lower.includes('limit') || lower.includes('maximum')) {
        botReply = "You can withdraw from ₹1,000 up to ₹500,000 per transaction depending on your credit card limit.";
      }

      appendChatMessage(botReply, 'bot');
    }, 800);
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (inputEl) {
    inputEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }
}

function appendChatMessage(msg, sender) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `flex ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-3`;
  
  if (sender === 'user') {
    div.innerHTML = `
      <div class="bg-emerald-600 text-slate-950 font-medium px-3.5 py-2 rounded-2xl rounded-tr-none text-xs max-w-[80%]">
        ${msg}
      </div>
    `;
  } else {
    div.innerHTML = `
      <div class="bg-slate-800 text-slate-200 border border-slate-700 px-3.5 py-2 rounded-2xl rounded-tl-none text-xs max-w-[80%]">
        ${msg}
      </div>
    `;
  }
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

// 7. Toast Notification System
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  let iconClass = 'fa-info-circle text-cyan-400';
  let borderClass = 'border-cyan-500/40';

  if (type === 'success') {
    iconClass = 'fa-check-circle text-emerald-400';
    borderClass = 'border-emerald-500/40';
  } else if (type === 'error') {
    iconClass = 'fa-exclamation-triangle text-rose-400';
    borderClass = 'border-rose-500/40';
  }

  toast.className = `flex items-center gap-3 bg-slate-900/95 backdrop-blur-md border ${borderClass} text-slate-100 px-4 py-3 rounded-12 shadow-2xl transition-all transform translate-y-2 opacity-0 text-sm font-medium pointer-events-auto`;
  toast.innerHTML = `<i class="fas ${iconClass} text-base"></i> <span>${message}</span>`;

  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 50);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Ticker Rate Marquee Updater
function initTicker() {
  // Static ticker rate elements stay active
}

function updateTickerCurrency() {
  // Sync display formatting
}

// ============================================================
// BIN CHECKER MODULE  — api-ninjas.com API + Local DB Fallback
// ============================================================

// ── API Ninjas BIN config ──
// Endpoint: GET https://api.api-ninjas.com/v2/bin?bin=XXXXXX
// Header  : X-Api-Key: BIN_API_KEY
// Response: Array → use data[0]
const BIN_API_BASE = 'https://api.api-ninjas.com/v2/bin';
const BIN_API_KEY  = '4GLDoX5FPu65QTqFqUgDIXy7S1BDCiRMZ8hcEi8L';

// In-memory cache — avoids re-fetching the same BIN twice
const _binCache = {};

// ── Local fallback DB (used only when API is unreachable) ──
const BIN_DATABASE = {
  '411111': { bank: 'Generic / Test Visa',   network: 'Visa',       type: 'Credit', category: 'Classic',   country: '🌍 International', feeKey: 'visa' },
  '459150': { bank: 'HDFC Bank',             network: 'Visa',       type: 'Credit', category: 'Platinum',  country: '🇮🇳 India',        feeKey: 'sbi_hdfc' },
  '524715': { bank: 'SBI Card',              network: 'Mastercard', type: 'Credit', category: 'Prime',     country: '🇮🇳 India',        feeKey: 'sbi_hdfc' },
  '508500': { bank: 'SBI Card',              network: 'RuPay',      type: 'Credit', category: 'Select',    country: '🇮🇳 India',        feeKey: 'rupay'    },
  '607710': { bank: 'HDFC Bank',             network: 'RuPay',      type: 'Credit', category: 'Platinum',  country: '🇮🇳 India',        feeKey: 'rupay'    },
  '607714': { bank: 'ICICI Bank',            network: 'RuPay',      type: 'Credit', category: 'Coral',     country: '🇮🇳 India',        feeKey: 'rupay'    },
  '374251': { bank: 'American Express',      network: 'Amex',       type: 'Credit', category: 'Platinum',  country: '🌍 International', feeKey: 'amex'     },
  '519717': { bank: 'OneCard',               network: 'Mastercard', type: 'Credit', category: 'Metal',     country: '🇮🇳 India',        feeKey: 'sbi_hdfc' },
};

// ── Network prefix fallback (last resort) ──
const NETWORK_PREFIXES = [
  { test: /^4/,                             network: 'Visa',       feeKey: 'visa',       icon: '<i class="fab fa-cc-visa text-blue-400 text-3xl"></i>',        badge: 'bg-blue-500/10 border-blue-400/30 text-blue-300' },
  { test: /^5[1-5]/,                        network: 'Mastercard', feeKey: 'mastercard', icon: '<i class="fab fa-cc-mastercard text-orange-400 text-3xl"></i>', badge: 'bg-orange-500/10 border-orange-400/30 text-orange-300' },
  { test: /^3[47]/,                         network: 'Amex',       feeKey: 'amex',       icon: '<i class="fab fa-cc-amex text-cyan-400 text-3xl"></i>',         badge: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300' },
  { test: /^(508[0-9]|6074|6075|6521|608)/, network: 'RuPay',      feeKey: 'rupay',      icon: '<i class="fas fa-credit-card text-emerald-400 text-3xl"></i>',  badge: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' },
  { test: /^6011|^65|^64[4-9]/,            network: 'Discover',   feeKey: 'visa',       icon: '<i class="fas fa-credit-card text-amber-400 text-3xl"></i>',    badge: 'bg-amber-500/10 border-amber-400/30 text-amber-300' },
];

// ── Fee labels shown in result panel ──
const FEE_LABELS = {
  visa:       '1.8% — Visa All Cards',
  mastercard: '1.8% — Mastercard All',
  rupay:      '1.6% — RuPay Network',
  sbi_hdfc:   '2.0% — SBI / HDFC / OneCard',
  amex:       '2.0% — Amex All Cards',
  corporate:  '2.0% — Corporate Card',
};

// Stored result for "Apply to Calculator"
let _binResult = null;

// ── Map API scheme → internal feeKey ──
function schemeTofeeKey(scheme, bankName) {
  const s = (scheme || '').toLowerCase();
  const b = (bankName || '').toLowerCase();

  if (s === 'rupay' || b.includes('rupay'))       return 'rupay';
  if (s === 'amex'  || b.includes('american exp')) return 'amex';
  if (b.includes('sbi') || b.includes('hdfc') || b.includes('onecard') || b.includes('one card'))
                                                   return 'sbi_hdfc';
  if (s === 'mastercard')                          return 'mastercard';
  if (s === 'visa')                                return 'visa';
  return 'visa'; // safe default
}

// ── Map API scheme → network icon + badge CSS ──
function schemeToMeta(scheme) {
  const s = (scheme || '').toLowerCase();
  if (s === 'visa')       return { icon: '<i class="fab fa-cc-visa text-blue-400 text-3xl"></i>',        badge: 'bg-blue-500/10 border-blue-400/30 text-blue-300' };
  if (s === 'mastercard') return { icon: '<i class="fab fa-cc-mastercard text-orange-400 text-3xl"></i>', badge: 'bg-orange-500/10 border-orange-400/30 text-orange-300' };
  if (s === 'amex')       return { icon: '<i class="fab fa-cc-amex text-cyan-400 text-3xl"></i>',         badge: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300' };
  if (s === 'rupay')      return { icon: '<i class="fas fa-credit-card text-emerald-400 text-3xl"></i>',  badge: 'bg-emerald-500/10 border-emerald-400/30 text-emerald-300' };
  return                         { icon: '<i class="fas fa-credit-card text-slate-400 text-3xl"></i>',   badge: 'bg-slate-800 border-slate-600 text-slate-300' };
}

// ─────────────────────────────────────────────────
// INPUT HANDLER — debounce auto-lookup
// ─────────────────────────────────────────────────
function handleBINInput(val) {
  const strip       = document.getElementById('bin-live-strip');
  const resultPanel = document.getElementById('bin-result-panel');
  const notFound    = document.getElementById('bin-notfound-panel');

  resultPanel.classList.add('hidden');
  notFound.classList.add('hidden');

  if (val.length >= 6) {
    strip.classList.remove('hidden');
    clearTimeout(window._binTimer);
    window._binTimer = setTimeout(() => {
      runBINCheck();
    }, 500);
  } else {
    strip.classList.add('hidden');
  }
}

// ─────────────────────────────────────────────────
// MAIN CHECK — instant local result + background API
// ─────────────────────────────────────────────────
function runBINCheck() {
  const val = document.getElementById('bin-input').value.trim();
  if (val.length < 6) {
    showToast('Please enter at least 6 digits', 'warning');
    return;
  }

  const bin6 = val.substring(0, 6);

  // ── Step 1: Show local result INSTANTLY (no waiting) ──
  const local = localLookupBIN(bin6);
  _binResult  = local;
  displayBINResult(local);

  // ── Step 2: Silently fetch API in background to get country data ──
  fetchBINCountryFromAPI(bin6).then(countryInfo => {
    if (!countryInfo || !_binResult) return;
    // Merge country data from API into the shown result
    _binResult.country = countryInfo.country;
    _binResult.source  = '🌐 api-ninjas.com + Local';
    // Update just the country field without full re-render
    const el = document.getElementById('bin-country');
    if (el) el.innerText = countryInfo.country;
    const subEl = document.getElementById('bin-card-subtitle');
    if (subEl) subEl.innerText = `BIN: ${bin6}  •  🌐 api-ninjas.com + Local`;
  }).catch(() => {}); // silent — local result already shown
}

// ─────────────────────────────────────────────────
// API FETCH — gets ONLY country data (free tier)
// Returns { country: "🇮🇳 India" } or null
// ─────────────────────────────────────────────────
async function fetchBINCountryFromAPI(bin6) {
  if (_binCache[bin6]) return _binCache[bin6];

  const resp = await fetch(`${BIN_API_BASE}?bin=${bin6}`, {
    headers: { 'X-Api-Key': BIN_API_KEY }
  });

  if (!resp.ok) return null;

  const dataArr = await resp.json();
  if (!Array.isArray(dataArr) || dataArr.length === 0) return null;

  const data = dataArr[0];
  if (!data.country) return null;

  const countryFlag = countryCodeToEmoji((data.country_iso2 || '').toUpperCase());
  const countryName = toTitleCase(data.country || 'Unknown');

  const regionTags = [
    data.is_eu   ? '🇪🇺 EU'  : '',
    data.is_eea  ? 'EEA'      : '',
    data.is_sepa ? 'SEPA'     : '',
  ].filter(Boolean).join(' • ');

  const countryStr = `${countryFlag} ${countryName}${regionTags ? ' (' + regionTags + ')' : ''}`;

  const cached = { country: countryStr };
  _binCache[bin6] = cached;
  return cached;
}



// ── Helper: Title Case ──
function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Helper: ISO-2 country code → flag emoji ──
function countryCodeToEmoji(code) {
  if (!code || code.length !== 2) return '🌍';
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))
  );
}



// ─────────────────────────────────────────────────
// LOCAL FALLBACK LOOKUP
// ─────────────────────────────────────────────────
function localLookupBIN(bin6) {
  if (BIN_DATABASE[bin6]) {
    return { ...BIN_DATABASE[bin6], bin: bin6, matched: 'local', source: '📦 Local Database' };
  }
  for (const p of NETWORK_PREFIXES) {
    if (p.test.test(bin6)) {
      return {
        bin: bin6, bank: 'Unknown Issuer', network: p.network,
        type: 'Credit', category: 'Unknown', country: '🌍 Unknown',
        feeKey: p.feeKey, matched: 'prefix', source: '⚡ Prefix Match',
      };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────
// DISPLAY RESULT
// ─────────────────────────────────────────────────
function displayBINResult(result) {
  const resultPanel = document.getElementById('bin-result-panel');
  const notFound    = document.getElementById('bin-notfound-panel');

  if (!result) {
    notFound.classList.remove('hidden');
    resultPanel.classList.add('hidden');
    return;
  }

  const meta     = schemeToMeta(result.network);
  const feeLabel = FEE_LABELS[result.feeKey] || '—';
  const matchBadge = result.matched === 'api'    ? '🌐 Live API Result'
                   : result.matched === 'local'  ? '📦 Local Database'
                   :                               '⚡ Prefix Detected';

  // Header
  document.getElementById('bin-network-badge').innerHTML  = meta.icon;
  document.getElementById('bin-card-title').innerText     = result.bank;
  document.getElementById('bin-card-subtitle').innerText  =
    `BIN: ${result.bin}  •  ${result.source || matchBadge}`;
  document.getElementById('bin-status-badge').className   =
    `px-3 py-1.5 rounded-full text-xs font-bold border ${meta.badge}`;
  document.getElementById('bin-status-badge').innerText   = matchBadge;

  // Detail cells
  document.getElementById('bin-network').innerText        = result.network;
  document.getElementById('bin-bank').innerText           = result.bank;
  document.getElementById('bin-card-type').innerText      = result.type       || '—';
  document.getElementById('bin-card-category').innerText  = result.category   || '—';
  document.getElementById('bin-country').innerText        = result.country     || '—';
  document.getElementById('bin-fee-rate').innerText       = feeLabel;

  // Extra API fields (Luhn, length, bank URL) — update if elements exist
  const luhnEl   = document.getElementById('bin-luhn');
  const lenEl    = document.getElementById('bin-length');
  const phoneEl  = document.getElementById('bin-bank-phone');
  const urlEl    = document.getElementById('bin-bank-url');
  if (luhnEl)  luhnEl.innerText  = result.luhn     || '—';
  if (lenEl)   lenEl.innerText   = result.length   || '—';
  if (phoneEl) phoneEl.innerText = result.bankPhone || '—';
  if (urlEl) {
    if (result.bankUrl) {
      urlEl.innerHTML = `<a href="https://${result.bankUrl}" target="_blank" class="text-emerald-400 underline">${result.bankUrl}</a>`;
    } else {
      urlEl.innerText = '—';
    }
  }

  resultPanel.classList.remove('hidden');
  notFound.classList.add('hidden');

  showToast(
    result.matched === 'api'
      ? `✅ Live BIN lookup: ${result.network} — ${result.bank}`
      : `📦 Local match: ${result.network} — ${result.bank}`,
    'success'
  );
}

// ─────────────────────────────────────────────────
// LOADING STATE
// ─────────────────────────────────────────────────
function setBINLoading(on) {
  const strip   = document.getElementById('bin-live-strip');
  const btn     = document.querySelector('[onclick="runBINCheck()"]');
  if (on) {
    strip.innerHTML = '<i class="fas fa-circle-notch fa-spin text-emerald-400"></i> <span>Fetching live BIN data…</span>';
    strip.classList.remove('hidden');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Checking…'; }
  } else {
    strip.classList.add('hidden');
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-search"></i> Check BIN'; }
  }
}

// ─────────────────────────────────────────────────
// APPLY TO CALCULATOR
// ─────────────────────────────────────────────────
function applyBINToCalculator() {
  if (!_binResult) return;
  state.currentCardType = _binResult.feeKey;

  document.querySelectorAll('input[name="cardType"]').forEach(r => {
    r.checked = (r.value === _binResult.feeKey);
  });

  updateCalculatorUI();
  updateCreditCardPreview();
  showToast(`Applied ${_binResult.network} — ${FEE_LABELS[_binResult.feeKey]} to calculator!`, 'success');
  document.getElementById('calculator').scrollIntoView({ behavior: 'smooth' });
}

// ─────────────────────────────────────────────────
// CLEAR
// ─────────────────────────────────────────────────
function clearBINChecker() {
  document.getElementById('bin-input').value = '';
  document.getElementById('bin-result-panel').classList.add('hidden');
  document.getElementById('bin-notfound-panel').classList.add('hidden');
  document.getElementById('bin-live-strip').classList.add('hidden');
  _binResult = null;
}

// ─────────────────────────────────────────────────
// QUICK TEST BIN BUTTONS
// ─────────────────────────────────────────────────
function testBIN(bin) {
  document.getElementById('bin-input').value = bin;
  runBINCheck();
  document.getElementById('bin-checker').scrollIntoView({ behavior: 'smooth' });
}

