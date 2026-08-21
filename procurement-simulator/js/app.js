// ─────────────────────────────────────────────────────────────
// App — boot, event delegation, re-render orchestration.
// No framework: click handling is delegated once on #root;
// state changes come from Store actions and trigger a re-render
// of just the containers that need it. Text inputs in the
// Create Requirement / Create PR forms are left "uncontrolled"
// (read from the DOM on save/submit) so typing never triggers a
// re-render and never loses focus/cursor position.
// ─────────────────────────────────────────────────────────────
(function () {
  const root = document.getElementById('root');

  function emptyReqItem() {
    return { itemCode: '', description: '', qty: 1, unit: 'Nos', estimatedPrice: 0, warehouse: 'Chennai Plant 1', notes: '' };
  }
  function freshReqForm() {
    return { items: [emptyReqItem()], attachments: {} };
  }
  function emptyPrItem() {
    return { materialCode: '', description: '', qty: 1, unit: 'Nos', price: 0, requiredDate: new Date().toISOString().slice(0, 10), tax: 0, discount: 0 };
  }
  function freshPrForm() {
    return { items: [emptyPrItem()] };
  }
  function emptyVendorContact() {
    return { name: '', designation: '', phone: '', email: '' };
  }
  function freshVendorForm() {
    return { contacts: [emptyVendorContact()] };
  }
  function freshRfqForm() {
    const eligible = Store.state.prs.filter((p) => p.status === 'Approved' && !p.linkedRfqId);
    return { prId: eligible[0] ? eligible[0].id : null, vendorIds: [] };
  }
  function freshPoForm() {
    const eligible = Selectors.eligibleRfqsForPO(Store.state);
    return { rfqId: eligible[0] ? eligible[0].id : null };
  }
  function emptyContractItem() {
    return { materialCode: '', description: '', unit: 'Nos', rate: 0 };
  }
  function freshContractForm() {
    const eligible = Selectors.eligibleVendorsForRFQ(Store.state);
    return { vendorId: eligible[0] ? eligible[0].id : null, items: [emptyContractItem()] };
  }
  function emptyMilestone() {
    return { title: '', description: '', dueDate: new Date().toISOString().slice(0, 10), amount: 0 };
  }
  function freshServicePoForm() {
    const eligible = Selectors.eligibleVendorsForRFQ(Store.state);
    return { vendorId: eligible[0] ? eligible[0].id : null, milestones: [emptyMilestone()] };
  }
  function freshDeliveryForm() {
    const eligible = Selectors.eligiblePOsForDelivery(Store.state);
    return { poId: eligible[0] ? eligible[0].id : null };
  }
  function freshGrnForm() {
    const eligible = Selectors.eligiblePOsForGRN(Store.state);
    return { poId: eligible[0] ? eligible[0].id : null };
  }
  function freshInvoiceForm() {
    const eligible = Selectors.eligiblePOsForInvoice(Store.state);
    return { poId: eligible[0] ? eligible[0].id : null };
  }
  function freshPaymentForm() {
    const eligible = Selectors.eligibleInvoicesForPayment(Store.state);
    return { invoiceId: eligible[0] ? eligible[0].id : null };
  }

  const uiState = {
    currentModule: 'dashboard', // 'dashboard' | 'requirement' | 'pr' | 'approval' | 'budget' | 'vendor' | 'rfq' | 'quotation'
    tab: 'overview',            // dashboard tabs
    reqTab: 'list',             // requirement module tabs
    prTab: 'list',              // PR module tabs
    approvalTab: 'pending',     // approval module tabs
    budgetTab: 'overview',      // budget module tabs
    vendorTab: 'directory',     // vendor module tabs
    rfqTab: 'list',             // RFQ module tabs
    quotationTab: 'inbox',      // quotation module tabs
    comparisonRfqId: null,      // module 9 selected RFQ
    selectionRfqId: null,       // module 10 selected RFQ
    poTab: 'list',              // PO module tabs
    deliveryTab: 'board',       // delivery module tabs
    grnTab: 'list',             // GRN module tabs
    invoiceTab: 'list',         // invoice module tabs
    paymentTab: 'list',         // payment module tabs
    tourOpen: false,
    tourStep: 0,
    resetConfirmOpen: false,
    settingsOpen: false,
    adminGateOpen: false,
    adminGateError: null,
    glossaryOpen: false,
    toast: null,
    ephemeral: {
      justActed: {},            // PR approve/reject flash state
      reqListFilter: 'All',
      reqForm: freshReqForm(),
      prListFilter: 'All',
      prForm: freshPrForm(),
      approvalDrawerOpenId: null,
      budgetListFilter: 'All',
      budgetDrawerOpenId: null,
      vendorCategoryFilter: 'All',
      vendorStatusFilter: 'All',
      vendorDrawerOpenId: null,
      vendorApprovalDrawerOpenId: null,
      vendorForm: freshVendorForm(),
      rfqListFilter: 'All',
      rfqDrawerOpenId: null,
      rfqForm: freshRfqForm(),
      quotationListFilter: 'All',
      quotationDrawerOpenId: null,
      quotationAttachName: '',
      poListFilter: 'All',
      poDrawerOpenId: null,
      poAmendFormOpenId: null,
      poForm: freshPoForm(),
      contractListFilter: 'All',
      contractDrawerOpenId: null,
      contractCallOffFormOpenId: null,
      contractForm: freshContractForm(),
      servicePoForm: freshServicePoForm(),
      deliveryListFilter: 'All',
      deliveryDrawerOpenId: null,
      deliveryForm: freshDeliveryForm(),
      grnDrawerOpenId: null,
      grnForm: freshGrnForm(),
      invoiceListFilter: 'All',
      invoiceDrawerOpenId: null,
      invoiceForm: freshInvoiceForm(),
      disputeListFilter: 'All',
      disputeDrawerOpenId: null,
      paymentListFilter: 'All',
      paymentDrawerOpenId: null,
      paymentForm: freshPaymentForm(),
      reportsAuditFilter: 'All',
      reportsAuditQuery: '',
      instructorOpenStudentId: null,
    },
  };

  function renderFull() {
    root.innerHTML = authenticated ? Render.app(uiState) : Render.loginScreen(authState);
  }

  // ── Sign-in gate ─────────────────────────────────────────────
  const SESSION_KEY = 'procurement-simulator-active-session'; // sessionStorage — this tab only, cleared on close
  let authenticated = false;
  let authState = { screen: 'login', studentId: '', error: null, notice: null, forgotQuestion: null, captchaCode: Auth.generateCaptcha() };

  function hasSessionStorage() {
    try { return typeof sessionStorage !== 'undefined' && sessionStorage !== null; } catch (e) { return false; }
  }

  function completeLogin(studentId) {
    Store.setActiveUser(studentId);
    if (hasSessionStorage()) { try { sessionStorage.setItem(SESSION_KEY, studentId); } catch (e) { /* ignore */ } }
    authenticated = true;
    uiState.currentModule = 'dashboard';
    uiState.tab = 'overview';
    renderFull();
    if (hasLocalStorage()) {
      try { if (!localStorage.getItem(TOUR_SEEN_KEY)) openTour(true); } catch (e) { /* ignore */ }
    }
  }

  function doLogout() {
    if (hasSessionStorage()) { try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ } }
    Store.logout();
    authenticated = false;
    authState = { screen: 'login', studentId: '', error: null, notice: null, forgotQuestion: null, captchaCode: Auth.generateCaptcha() };
    renderFull();
  }

  function submitAuthForm(isRegister) {
    const studentIdVal = (document.getElementById('auth-studentId') || {}).value || '';
    const passwordVal = (document.getElementById('auth-password') || {}).value || '';
    const captchaVal = (document.getElementById('auth-captcha') || {}).value || '';

    function fail(message) {
      authState.studentId = studentIdVal;
      authState.error = message;
      authState.notice = null;
      authState.captchaCode = Auth.generateCaptcha();
      renderFull();
    }

    if (!Auth.captchaMatches(authState.captchaCode, captchaVal)) {
      fail('Security code did not match. Please try again.');
      return;
    }
    if (isRegister) {
      const confirmVal = (document.getElementById('auth-confirmPassword') || {}).value || '';
      if (passwordVal !== confirmVal) { fail('Passwords do not match.'); return; }
      const securityQuestion = (document.getElementById('auth-securityQuestion') || {}).value || Auth.SECURITY_QUESTIONS[0];
      const securityAnswer = (document.getElementById('auth-securityAnswer') || {}).value || '';
      const result = Auth.register(studentIdVal, passwordVal, securityQuestion, securityAnswer);
      if (!result.ok) { fail(result.error); return; }
      completeLogin(result.studentId);
    } else {
      const result = Auth.login(studentIdVal, passwordVal);
      if (!result.ok) { fail(result.error); return; }
      completeLogin(result.studentId);
    }
  }

  function submitForgotLookup() {
    const studentIdVal = (document.getElementById('auth-studentId') || {}).value || '';
    const question = Auth.getSecurityQuestion(studentIdVal);
    if (!question) {
      authState.error = 'No account found for that Student ID on this computer.';
      authState.notice = null;
      renderFull();
      return;
    }
    authState.studentId = studentIdVal;
    authState.forgotQuestion = question;
    authState.error = null;
    renderFull();
  }

  function submitForgotReset() {
    const studentIdVal = authState.studentId;
    const answerVal = (document.getElementById('auth-securityAnswer') || {}).value || '';
    const passwordVal = (document.getElementById('auth-password') || {}).value || '';
    const confirmVal = (document.getElementById('auth-confirmPassword') || {}).value || '';
    if (passwordVal !== confirmVal) { authState.error = 'Passwords do not match.'; renderFull(); return; }
    const result = Auth.resetPasswordWithSecurityAnswer(studentIdVal, answerVal, passwordVal);
    if (!result.ok) { authState.error = result.error; renderFull(); return; }
    authState.screen = 'login';
    authState.forgotQuestion = null;
    authState.error = null;
    authState.notice = 'Password reset — sign in with your new password.';
    authState.captchaCode = Auth.generateCaptcha();
    renderFull();
  }

  function tryResumeSession() {
    if (!hasSessionStorage()) return false;
    try {
      const sid = sessionStorage.getItem(SESSION_KEY);
      if (sid && Auth.accountExists(sid)) {
        Store.setActiveUser(sid);
        authenticated = true;
        return true;
      }
    } catch (e) { /* ignore */ }
    return false;
  }

  function currentTabContentHtml() {
    const d = Store.state;
    if (uiState.currentModule === 'dashboard') return Render.tabContent(uiState.tab, d, uiState.ephemeral);
    if (uiState.currentModule === 'requirement') return Render.reqTabContent(uiState.reqTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'pr') return Render.prTabContent(uiState.prTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'approval') return Render.approvalTabContent(uiState.approvalTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'budget') return Render.budgetTabContent(uiState.budgetTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'vendor') return Render.vendorTabContent(uiState.vendorTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'rfq') return Render.rfqTabContent(uiState.rfqTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'quotation') return Render.quotationTabContent(uiState.quotationTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'comparison') return Render.comparisonScreen(d, uiState.comparisonRfqId);
    if (uiState.currentModule === 'selection') return Render.selectionScreen(d, uiState.selectionRfqId);
    if (uiState.currentModule === 'po') return Render.poTabContent(uiState.poTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'delivery') return Render.deliveryTabContent(uiState.deliveryTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'grn') return Render.grnTabContent(uiState.grnTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'invoice') return Render.invoiceTabContent(uiState.invoiceTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'payment') return Render.paymentTabContent(uiState.paymentTab, d, uiState.ephemeral);
    if (uiState.currentModule === 'instructor') {
      return (d.activeRole === 'Administrator') ? Render.instructorConsoleScreen(uiState.ephemeral.instructorOpenStudentId) : Render.instructorAccessDenied();
    }
    return Render.reportsScreen(d, uiState.ephemeral);
  }

  function currentTabsBarHtml() {
    const d = Store.state;
    if (uiState.currentModule === 'dashboard') return Render.tabs(uiState.tab, d);
    if (uiState.currentModule === 'requirement') return Render.reqTabs(uiState.reqTab, d);
    if (uiState.currentModule === 'pr') return Render.prTabs(uiState.prTab, d);
    if (uiState.currentModule === 'approval') return Render.approvalTabs(uiState.approvalTab, d);
    if (uiState.currentModule === 'budget') return Render.budgetTabs(uiState.budgetTab, d);
    if (uiState.currentModule === 'vendor') return Render.vendorTabs(uiState.vendorTab, d);
    if (uiState.currentModule === 'rfq') return Render.rfqTabs(uiState.rfqTab, d);
    if (uiState.currentModule === 'quotation') return Render.quotationTabs(uiState.quotationTab, d);
    if (uiState.currentModule === 'po') return Render.poTabs(uiState.poTab, d);
    if (uiState.currentModule === 'delivery') return Render.deliveryTabs(uiState.deliveryTab, d);
    if (uiState.currentModule === 'grn') return Render.grnTabs(uiState.grnTab);
    if (uiState.currentModule === 'invoice') return Render.invoiceTabs(uiState.invoiceTab, d);
    if (uiState.currentModule === 'payment') return Render.paymentTabs(uiState.paymentTab, d);
    return '';
  }

  function renderContentOnly() {
    const slot = document.getElementById('tab-content-slot');
    if (slot) slot.innerHTML = currentTabContentHtml();
    const tabsSlot = document.getElementById('tabs-slot');
    if (tabsSlot) tabsSlot.innerHTML = currentTabsBarHtml();
  }

  function renderShellChrome() {
    const d = Store.state;
    const kpiSlot = document.getElementById('kpi-slot');
    if (kpiSlot) kpiSlot.innerHTML = Render.kpiStrip(d);
    const tickerSlot = document.getElementById('ticker-slot');
    if (tickerSlot) tickerSlot.innerHTML = Render.ticker(d);
    const topbarSlot = document.getElementById('topbar-slot');
    if (topbarSlot) topbarSlot.innerHTML = Render.topbar(d);
    const shell = document.querySelector('.shell');
    if (shell) {
      const oldSidebar = shell.querySelector('.sidebar');
      if (oldSidebar) oldSidebar.outerHTML = Render.sidebar(uiState.currentModule);
    }
  }

  function renderModalOnly() {
    const slot = document.getElementById('modal-slot');
    if (slot) slot.innerHTML = Render.modals(uiState);
  }

  let toastTimer = null;
  function showToast(text, type) {
    uiState.toast = { text, type: type || 'success' };
    renderModalOnly();
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      uiState.toast = null;
      renderModalOnly();
    }, 3200);
  }

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; }
  }
  const TOUR_SEEN_KEY = 'procurement-simulator-tour-seen';

  function openTour(fromStart) {
    uiState.tourOpen = true;
    uiState.tourStep = fromStart ? 0 : uiState.tourStep;
    renderModalOnly();
  }
  function closeTour() {
    uiState.tourOpen = false;
    if (hasLocalStorage()) { try { localStorage.setItem(TOUR_SEEN_KEY, '1'); } catch (e) { /* ignore */ } }
    renderModalOnly();
  }

  function downloadTextFile(filename, text, mime) {
    const blob = new window.Blob([text], { type: mime || 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportSnapshot() {
    const json = Store.actions.exportSnapshot();
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadTextFile('procurement-simulator-' + stamp + '.json', json);
    showToast('Exported your work as a JSON file.', 'success');
  }

  function importSnapshotFromFile(file) {
    const reader = new window.FileReader();
    reader.onload = function () {
      const result = Store.actions.importSnapshot(String(reader.result));
      if (result.ok) {
        showToast('Import successful — your saved work has been restored.', 'success');
        renderFull();
      } else {
        showToast(result.error || 'Import failed.', 'error');
      }
    };
    reader.onerror = function () {
      showToast('Could not read that file.', 'error');
    };
    reader.readAsText(file);
  }

  function goToModule(moduleKey) {
    uiState.currentModule = moduleKey;
    uiState.ephemeral.justActed = {};
    uiState.ephemeral.approvalDrawerOpenId = null;
    uiState.ephemeral.budgetDrawerOpenId = null;
    uiState.ephemeral.vendorDrawerOpenId = null;
    uiState.ephemeral.vendorApprovalDrawerOpenId = null;
    uiState.ephemeral.rfqDrawerOpenId = null;
    uiState.ephemeral.quotationDrawerOpenId = null;
    uiState.ephemeral.poDrawerOpenId = null;
    uiState.ephemeral.contractDrawerOpenId = null;
    uiState.ephemeral.contractCallOffFormOpenId = null;
    uiState.ephemeral.deliveryDrawerOpenId = null;
    uiState.ephemeral.grnDrawerOpenId = null;
    uiState.ephemeral.invoiceDrawerOpenId = null;
    uiState.ephemeral.paymentDrawerOpenId = null;
    uiState.ephemeral.instructorOpenStudentId = null;
    uiState.ephemeral.poAmendFormOpenId = null;
    uiState.comparisonRfqId = null;
    uiState.selectionRfqId = null;
    if (moduleKey === 'rfq') uiState.ephemeral.rfqForm = freshRfqForm();
    if (moduleKey === 'po') uiState.ephemeral.poForm = freshPoForm();
    if (moduleKey === 'delivery') uiState.ephemeral.deliveryForm = freshDeliveryForm();
    if (moduleKey === 'grn') uiState.ephemeral.grnForm = freshGrnForm();
    if (moduleKey === 'invoice') uiState.ephemeral.invoiceForm = freshInvoiceForm();
    if (moduleKey === 'payment') uiState.ephemeral.paymentForm = freshPaymentForm();
    renderFull();
  }

  function goToTab(tabKey) {
    uiState.tab = tabKey;
    uiState.ephemeral.justActed = {};
    renderContentOnly();
    renderShellChrome();
  }

  function goToReqTab(tabKey) {
    uiState.reqTab = tabKey;
    renderContentOnly();
    renderShellChrome();
  }

  function goToPrTab(tabKey) {
    uiState.prTab = tabKey;
    renderContentOnly();
    renderShellChrome();
  }

  function goToApprovalTab(tabKey) {
    uiState.approvalTab = tabKey;
    uiState.ephemeral.approvalDrawerOpenId = null;
    renderContentOnly();
    renderShellChrome();
  }

  function goToBudgetTab(tabKey) {
    uiState.budgetTab = tabKey;
    uiState.ephemeral.budgetDrawerOpenId = null;
    renderContentOnly();
    renderShellChrome();
  }

  function goToVendorTab(tabKey) {
    uiState.vendorTab = tabKey;
    uiState.ephemeral.vendorDrawerOpenId = null;
    uiState.ephemeral.vendorApprovalDrawerOpenId = null;
    renderContentOnly();
    renderShellChrome();
  }

  function goToRfqTab(tabKey) {
    uiState.rfqTab = tabKey;
    uiState.ephemeral.rfqDrawerOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.rfqForm = freshRfqForm();
    renderContentOnly();
    renderShellChrome();
  }

  function goToQuotationTab(tabKey) {
    uiState.quotationTab = tabKey;
    uiState.ephemeral.quotationDrawerOpenId = null;
    renderContentOnly();
    renderShellChrome();
  }

  function goToPoTab(tabKey) {
    uiState.poTab = tabKey;
    uiState.ephemeral.poDrawerOpenId = null;
    uiState.ephemeral.contractDrawerOpenId = null;
    uiState.ephemeral.contractCallOffFormOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.poForm = freshPoForm();
    if (tabKey === 'contract-create') uiState.ephemeral.contractForm = freshContractForm();
    if (tabKey === 'service-create') uiState.ephemeral.servicePoForm = freshServicePoForm();
    renderContentOnly();
    renderShellChrome();
  }

  function goToDeliveryTab(tabKey) {
    uiState.deliveryTab = tabKey;
    uiState.ephemeral.deliveryDrawerOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.deliveryForm = freshDeliveryForm();
    renderContentOnly();
    renderShellChrome();
  }

  function goToGrnTab(tabKey) {
    uiState.grnTab = tabKey;
    uiState.ephemeral.grnDrawerOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.grnForm = freshGrnForm();
    renderContentOnly();
    renderShellChrome();
  }

  function goToInvoiceTab(tabKey) {
    uiState.invoiceTab = tabKey;
    uiState.ephemeral.invoiceDrawerOpenId = null;
    uiState.ephemeral.disputeDrawerOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.invoiceForm = freshInvoiceForm();
    renderContentOnly();
    renderShellChrome();
  }

  function goToPaymentTab(tabKey) {
    uiState.paymentTab = tabKey;
    uiState.ephemeral.paymentDrawerOpenId = null;
    if (tabKey === 'create') uiState.ephemeral.paymentForm = freshPaymentForm();
    renderContentOnly();
    renderShellChrome();
  }

  // ── Requirement item grid DOM <-> state sync ────────────────
  function syncReqItemGridFromDom() {
    const tbody = document.querySelector('#req-item-grid tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    uiState.ephemeral.reqForm.items = rows.map((row) => {
      const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
      return {
        itemCode: get('itemCode'), description: get('description'),
        qty: Number(get('qty')) || 0, unit: get('unit') || 'Nos',
        estimatedPrice: Number(get('estimatedPrice')) || 0,
        warehouse: get('warehouse') || 'Chennai Plant 1', notes: get('notes'),
      };
    });
  }
  function rerenderReqItemGridOnly() {
    const grid = document.getElementById('req-item-grid');
    if (!grid) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = Render.requirementCreate(uiState.ephemeral.reqForm.items, uiState.ephemeral.reqForm.attachments);
    grid.parentElement.replaceChild(tmp.querySelector('#req-item-grid'), grid);
  }

  // ── PR item grid DOM <-> state sync ─────────────────────────
  function syncPrItemGridFromDom() {
    const tbody = document.querySelector('#pr-item-grid tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    uiState.ephemeral.prForm.items = rows.map((row) => {
      const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
      return {
        materialCode: get('materialCode'), description: get('description'),
        qty: Number(get('qty')) || 0, unit: get('unit') || 'Nos',
        price: Number(get('price')) || 0, requiredDate: get('requiredDate') || new Date().toISOString().slice(0, 10),
        tax: Number(get('tax')) || 0, discount: Number(get('discount')) || 0,
      };
    });
  }
  function rerenderPrItemGridOnly() {
    const grid = document.getElementById('pr-item-grid');
    if (!grid) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = Render.prCreate(uiState.ephemeral.prForm.items);
    grid.parentElement.replaceChild(tmp.querySelector('#pr-item-grid'), grid);
  }

  function syncContractItemGridFromDom() {
    const tbody = document.querySelector('#contract-item-grid tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    uiState.ephemeral.contractForm.items = rows.map((row) => {
      const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
      return { materialCode: get('materialCode'), description: get('description'), unit: get('unit') || 'Nos', rate: Number(get('rate')) || 0 };
    });
  }
  function rerenderContractItemGridOnly() {
    const grid = document.getElementById('contract-item-grid');
    if (!grid) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = Render.contractCreateScreen(Store.state, uiState.ephemeral.contractForm);
    grid.parentElement.replaceChild(tmp.querySelector('#contract-item-grid'), grid);
  }
  function readContractHeaderFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
      type: val('cf-type') || 'Rate Contract', vendorId: val('cf-vendorId'), department: val('cf-department') || 'Procurement',
      validFrom: val('cf-validFrom') || new Date().toISOString().slice(0, 10), validTo: val('cf-validTo') || new Date().toISOString().slice(0, 10),
      valueCeiling: val('cf-valueCeiling'), quantityCeiling: val('cf-quantityCeiling'),
    };
  }
  function resetContractFormAndShowList() {
    uiState.ephemeral.contractForm = freshContractForm();
    uiState.poTab = 'contracts';
    renderContentOnly();
    renderShellChrome();
  }

  function syncMilestoneGridFromDom() {
    const tbody = document.querySelector('#milestone-item-grid tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    uiState.ephemeral.servicePoForm.milestones = rows.map((row) => {
      const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
      return { title: get('title'), description: get('description'), dueDate: get('dueDate') || new Date().toISOString().slice(0, 10), amount: Number(get('amount')) || 0 };
    });
  }
  function rerenderMilestoneGridOnly() {
    const grid = document.getElementById('milestone-item-grid');
    if (!grid) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = Render.servicePoCreateScreen(Store.state, uiState.ephemeral.servicePoForm);
    grid.parentElement.replaceChild(tmp.querySelector('#milestone-item-grid'), grid);
  }
  function readServicePoHeaderFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return { vendorId: val('sf-vendorId'), department: val('sf-department') || 'Procurement', paymentTerms: val('sf-paymentTerms') || 'Net 30', sla: val('sf-sla') };
  }
  function resetServicePoFormAndShowList() {
    uiState.ephemeral.servicePoForm = freshServicePoForm();
    uiState.poTab = 'list';
    renderContentOnly();
    renderShellChrome();
  }

  // ── Vendor contact grid DOM <-> state sync ──────────────────
  function syncVendorContactGridFromDom() {
    const tbody = document.querySelector('#vendor-contact-grid tbody');
    if (!tbody) return;
    const rows = Array.from(tbody.querySelectorAll('tr'));
    uiState.ephemeral.vendorForm.contacts = rows.map((row) => {
      const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
      return { name: get('name'), designation: get('designation'), phone: get('phone'), email: get('email') };
    });
  }
  function rerenderVendorContactGridOnly() {
    const grid = document.getElementById('vendor-contact-grid');
    if (!grid) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = Render.vendorRegisterScreen(uiState.ephemeral.vendorForm.contacts);
    grid.parentElement.replaceChild(tmp.querySelector('#vendor-contact-grid'), grid);
  }

  function readVendorHeaderFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
      name: val('vf-name') || 'Unnamed Vendor',
      category: val('vf-category') || 'Domestic',
      city: val('vf-city') || 'Chennai',
      gst: val('vf-gst') || '—',
      pan: val('vf-pan') || '—',
      tradeLicense: val('vf-tradeLicense') || '—',
      accountHolder: val('vf-accountHolder') || val('vf-name') || 'Unnamed Vendor',
      accountNumber: val('vf-accountNumber') || '—',
      ifsc: val('vf-ifsc') || '—',
      bankName: val('vf-bankName') || '—',
      branch: val('vf-branch') || '—',
    };
  }

  function resetVendorFormAndShowDirectory() {
    uiState.ephemeral.vendorForm = freshVendorForm();
    uiState.vendorTab = 'directory';
    renderContentOnly();
    renderShellChrome();
  }

  function readVendorActionFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return { comment: val('vendor-action-comment'), signature: val('vendor-action-signature') || 'Unsigned' };
  }

  function readReqHeaderFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
      department: val('f-department') || 'Operations',
      requestedBy: val('f-requestedBy') || 'Unnamed Requester',
      costCenter: val('f-costCenter') || 'BC-GEN-01',
      project: val('f-project'),
      priority: val('f-priority') || 'Medium',
      requiredDate: val('f-requiredDate') || new Date().toISOString().slice(0, 10),
      itemCategory: val('f-itemCategory') || 'MRO Spares',
      justification: val('f-justification') || 'No justification provided.',
      attachments: Object.values(uiState.ephemeral.reqForm.attachments || {}),
    };
  }

  function readPrHeaderFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
      prDate: val('pf-date') || new Date().toISOString().slice(0, 10),
      department: val('pf-department') || 'Operations',
      requester: val('pf-requester') || 'Unnamed Requester',
      budgetCode: val('pf-budgetCode') || 'BC-GEN-01',
      currency: val('pf-currency') || 'INR',
      deliveryLocation: val('pf-deliveryLocation') || 'Chennai Plant 1',
    };
  }

  function resetReqFormAndShowList() {
    uiState.ephemeral.reqForm = freshReqForm();
    uiState.reqTab = 'list';
    renderContentOnly();
    renderShellChrome();
  }

  function resetPrFormAndShowList() {
    uiState.ephemeral.prForm = freshPrForm();
    uiState.prTab = 'list';
    renderContentOnly();
    renderShellChrome();
  }

  function readDrawerFields() {
    const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    return {
      comment: val('drawer-comment'),
      signature: val('drawer-signature') || 'Unsigned',
      forwardTo: val('drawer-forward-to'),
    };
  }

  function printOrExportAwardLetter(rfqId) {
    const rfq = Store.state.rfqs.find((r) => r.id === rfqId);
    if (!rfq || rfq.selection.status !== 'Awarded') return;
    const html = Render.buildAwardLetterHtml(Store.state, rfq);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    if (win.print) win.print();
  }

  function printOrExportRFQ(rfqId) {
    const rfq = Store.state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return;
    const html = Render.buildRfqPrintableHtml(Store.state, rfq);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    if (win.print) win.print();
  }

  function emailRFQ(rfqId) {
    const rfq = Store.state.rfqs.find((r) => r.id === rfqId);
    if (!rfq) return;
    const vendors = rfq.vendorIds.map((id) => Store.state.vendors.find((v) => v.id === id)).filter(Boolean);
    const to = vendors.map((v) => (v.contacts[0] ? v.contacts[0].email : '')).filter(Boolean).join(',');
    const subject = encodeURIComponent('RFQ ' + rfq.rfqNumber + ' — quotation requested');
    const itemLines = rfq.items.map((it) => '- ' + it.description + ' (Qty: ' + it.qty + ' ' + it.unit + ')').join('\n');
    const bodyText = 'Dear Vendor,\n\nPlease submit your quotation for the following items by ' + rfq.closingDate + ':\n\n' + itemLines + '\n\nRegards,\n' + rfq.buyer;
    const mailto = 'mailto:' + encodeURIComponent(to) + '?subject=' + subject + '&body=' + encodeURIComponent(bodyText);
    window.open(mailto);
  }

  function printOrExportPR(prId) {
    const pr = Store.state.prs.find((p) => p.id === prId);
    if (!pr) return;
    const html = Render.buildPrintableHtml(Store.state, pr);
    const win = window.open('', '_blank');
    if (!win) return; // popup blocked — silently no-op, nothing else to fall back to client-side
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    if (win.print) win.print();
  }

  function printOrExportPO(poId) {
    const po = Store.state.pos.find((p) => p.id === poId);
    if (!po) return;
    const html = Render.buildPoPrintableHtml(Store.state, po);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    if (win.print) win.print();
  }

  function printOrExportPaymentVoucher(paymentId) {
    const payment = Store.state.payments.find((p) => p.id === paymentId);
    if (!payment) return;
    const html = Render.buildPaymentVoucherHtml(Store.state, payment);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    if (win.print) win.print();
  }

  function printReportsScreen() {
    window.print();
  }

  // ── Event delegation (clicks) ───────────────────────────────
  // ── Sign-in gate — Enter key submits the visible form ─────────
  root.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const authFieldIds = ['auth-studentId', 'auth-password', 'auth-confirmPassword', 'auth-captcha', 'auth-securityAnswer'];
    if (!authFieldIds.includes(e.target.id)) return;
    e.preventDefault();
    if (authState.screen === 'forgot') {
      if (authState.forgotQuestion) submitForgotReset(); else submitForgotLookup();
    } else {
      submitAuthForm(authState.screen === 'register');
    }
  });

  root.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');

    // ── Sign-in gate — checked first; these elements only exist    ──
    // ── on the login screen, so they're a no-op once signed in.    ──
    if (action === 'auth-switch-screen') {
      authState.screen = btn.getAttribute('data-screen');
      authState.error = null;
      authState.notice = null;
      authState.forgotQuestion = null;
      authState.studentId = (document.getElementById('auth-studentId') || {}).value || authState.studentId;
      authState.captchaCode = Auth.generateCaptcha();
      renderFull();
      return;
    }
    if (action === 'auth-refresh-captcha') {
      authState.captchaCode = Auth.generateCaptcha();
      renderFull();
      return;
    }
    if (action === 'auth-login' || action === 'auth-register') {
      submitAuthForm(action === 'auth-register');
      return;
    }
    if (action === 'auth-forgot-lookup') { submitForgotLookup(); return; }
    if (action === 'auth-forgot-reset') { submitForgotReset(); return; }
    if (action === 'logout') { doLogout(); return; }

    // ── Role-based access guard — checked once, centrally, for       ──
    // ── every remaining action. Navigation/filters/drawers/print/     ──
    // ── export are unrestricted (not in Roles.ACTION_ROLE); only      ──
    // ── decisions and commitments require the role that owns them.    ──
    if (!authenticated) return; // nothing below this line applies pre-login
    const activeRole = Store.state.activeRole || 'Employee';
    let roleContext = {};
    if (Roles.LEVEL_AWARE_ACTIONS[action]) {
      const prId = btn.getAttribute('data-id');
      const pr = Store.state.prs.find((p) => p.id === prId);
      roleContext.approvalLevel = pr ? pr.approval.currentLevel : null;
    }
    if (!Roles.canPerform(action, activeRole, roleContext)) {
      const required = Roles.requiredRoleFor(action, roleContext);
      showToast('This action needs the "' + required + '" role — switch roles in the topbar to continue.', 'error');
      return;
    }

    if (action === 'goto-module') { goToModule(btn.getAttribute('data-module')); return; }
    if (action === 'goto-notifications') {
      uiState.currentModule = 'dashboard';
      uiState.tab = 'notifications';
      uiState.ephemeral.justActed = {};
      renderFull();
      return;
    }
    if (action === 'goto-tab') { goToTab(btn.getAttribute('data-tab')); return; }
    if (action === 'goto-req-tab') { goToReqTab(btn.getAttribute('data-req-tab')); return; }
    if (action === 'goto-pr-tab') { goToPrTab(btn.getAttribute('data-pr-tab')); return; }
    if (action === 'goto-approval-tab') { goToApprovalTab(btn.getAttribute('data-approval-tab')); return; }
    if (action === 'goto-budget-tab') { goToBudgetTab(btn.getAttribute('data-budget-tab')); return; }
    if (action === 'goto-vendor-tab') { goToVendorTab(btn.getAttribute('data-vendor-tab')); return; }
    if (action === 'goto-rfq-tab') { goToRfqTab(btn.getAttribute('data-rfq-tab')); return; }
    if (action === 'goto-quotation-tab') { goToQuotationTab(btn.getAttribute('data-quotation-tab')); return; }
    if (action === 'goto-module-pr') { goToModule('pr'); return; }
    if (action === 'goto-module-quotation') { goToModule('quotation'); return; }
    if (action === 'goto-module-po') { goToModule('po'); return; }
    if (action === 'goto-module-delivery') { goToModule('delivery'); return; }
    if (action === 'goto-module-grn') { goToModule('grn'); return; }
    if (action === 'goto-module-invoice') { goToModule('invoice'); return; }
    if (action === 'goto-module-payment') { goToModule('payment'); return; }
    if (action === 'goto-po-tab') { goToPoTab(btn.getAttribute('data-po-tab')); return; }
    if (action === 'goto-delivery-tab') { goToDeliveryTab(btn.getAttribute('data-delivery-tab')); return; }
    if (action === 'goto-grn-tab') { goToGrnTab(btn.getAttribute('data-grn-tab')); return; }
    if (action === 'goto-invoice-tab') { goToInvoiceTab(btn.getAttribute('data-invoice-tab')); return; }
    if (action === 'goto-payment-tab') { goToPaymentTab(btn.getAttribute('data-payment-tab')); return; }
    if (action === 'goto-module-budget') {
      uiState.currentModule = 'budget';
      uiState.budgetTab = 'validate';
      uiState.ephemeral.budgetListFilter = 'Insufficient';
      renderFull();
      return;
    }

    if (action === 'filter-req-list') {
      uiState.ephemeral.reqListFilter = btn.getAttribute('data-filter');
      renderContentOnly();
      return;
    }
    if (action === 'filter-pr-list') {
      uiState.ephemeral.prListFilter = btn.getAttribute('data-filter');
      renderContentOnly();
      return;
    }

    if (action === 'approve-pr') {
      const id = btn.getAttribute('data-id');
      Store.actions.approvePR(id);
      uiState.ephemeral.justActed[id] = 'approved';
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-pr') {
      const id = btn.getAttribute('data-id');
      Store.actions.rejectPR(id);
      uiState.ephemeral.justActed[id] = 'rejected';
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'dismiss-notif') {
      Store.actions.markNotificationRead(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'mark-all-read') {
      Store.actions.markAllNotificationsRead();
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 2 actions ───────────────────────────────────────
    if (action === 'submit-draft-req') {
      Store.actions.submitRequirement(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'convert-req-to-pr') {
      Store.actions.convertRequirementToPR(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-req') {
      Store.actions.rejectRequirement(btn.getAttribute('data-id'), 'Rejected from requirement list');
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'add-req-item-row') {
      syncReqItemGridFromDom();
      uiState.ephemeral.reqForm.items.push(emptyReqItem());
      rerenderReqItemGridOnly();
      return;
    }
    if (action === 'remove-req-item-row') {
      syncReqItemGridFromDom();
      const idx = Number(btn.getAttribute('data-index'));
      if (uiState.ephemeral.reqForm.items.length > 1) uiState.ephemeral.reqForm.items.splice(idx, 1);
      rerenderReqItemGridOnly();
      return;
    }
    if (action === 'cancel-req-form') { resetReqFormAndShowList(); return; }
    if (action === 'save-req-draft' || action === 'submit-req') {
      syncReqItemGridFromDom();
      const header = readReqHeaderFields();
      const payload = Object.assign({}, header, { items: uiState.ephemeral.reqForm.items });
      const status = action === 'save-req-draft' ? 'Draft' : 'Submitted';
      Store.actions.createRequirement(payload, status);
      resetReqFormAndShowList();
      return;
    }

    // ── Module 3 actions ───────────────────────────────────────
    if (action === 'submit-draft-pr') {
      Store.actions.submitDraftPR(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'close-pr') {
      Store.actions.closePR(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'print-pr') {
      printOrExportPR(btn.getAttribute('data-id'));
      return;
    }
    if (action === 'add-pr-item-row') {
      syncPrItemGridFromDom();
      uiState.ephemeral.prForm.items.push(emptyPrItem());
      rerenderPrItemGridOnly();
      return;
    }
    if (action === 'remove-pr-item-row') {
      syncPrItemGridFromDom();
      const idx = Number(btn.getAttribute('data-index'));
      if (uiState.ephemeral.prForm.items.length > 1) uiState.ephemeral.prForm.items.splice(idx, 1);
      rerenderPrItemGridOnly();
      return;
    }
    if (action === 'cancel-pr-form') { resetPrFormAndShowList(); return; }
    if (action === 'save-pr-draft' || action === 'submit-pr') {
      syncPrItemGridFromDom();
      const header = readPrHeaderFields();
      const payload = Object.assign({}, header, { items: uiState.ephemeral.prForm.items });
      const status = action === 'save-pr-draft' ? 'Draft' : 'Submitted';
      Store.actions.createPR(payload, status);
      resetPrFormAndShowList();
      return;
    }

    // ── Module 4 actions ───────────────────────────────────────
    if (action === 'toggle-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.approvalDrawerOpenId = uiState.ephemeral.approvalDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'close-drawer') {
      uiState.ephemeral.approvalDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'drawer-approve') {
      const id = btn.getAttribute('data-id');
      const prCheck = Store.state.prs.find((p) => p.id === id);
      if (prCheck && prCheck.budgetCheck && prCheck.budgetCheck.status === 'Insufficient') {
        return; // blocked by the budget gate — button should be disabled anyway, this is defense-in-depth
      }
      const fields = readDrawerFields();
      Store.actions.approveCurrentLevel(id, fields);
      uiState.ephemeral.approvalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'drawer-reject') {
      const fields = readDrawerFields();
      Store.actions.rejectCurrentLevel(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.approvalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'drawer-return') {
      const fields = readDrawerFields();
      Store.actions.returnCurrentLevel(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.approvalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'drawer-forward') {
      const fields = readDrawerFields();
      if (!fields.forwardTo) return; // require a name before forwarding
      Store.actions.forwardCurrentLevel(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.approvalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 5 actions ───────────────────────────────────────
    if (action === 'filter-budget-list') {
      uiState.ephemeral.budgetListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.budgetDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-budget-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.budgetDrawerOpenId = uiState.ephemeral.budgetDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'close-budget-drawer') {
      uiState.ephemeral.budgetDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'budget-revalidate') {
      Store.actions.revalidateBudget(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'budget-continue') {
      // "YES — Continue" simply acknowledges a Sufficient check; nothing
      // to change, just close the drawer (the PR is already clear to
      // proceed through Module 4's approval pipeline).
      uiState.ephemeral.budgetDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'budget-override') {
      const fields = readDrawerFields();
      Store.actions.overrideBudgetCheck(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.budgetDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'budget-reject') {
      const fields = readDrawerFields();
      Store.actions.rejectFromBudgetCheck(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.budgetDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 6 actions ───────────────────────────────────────
    if (action === 'filter-vendor-category') {
      uiState.ephemeral.vendorCategoryFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.vendorDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'filter-vendor-status') {
      uiState.ephemeral.vendorStatusFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.vendorDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-vendor-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.vendorDrawerOpenId = uiState.ephemeral.vendorDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'add-vendor-review') {
      const id = btn.getAttribute('data-id');
      const val = (elId) => { const el = document.getElementById(elId); return el ? el.value : ''; };
      Store.actions.addPerformanceReview(id, {
        ratingGiven: val('review-rating') || 5,
        qualityScore: val('review-quality') || 90,
        onTime: val('review-ontime') === 'true',
        notes: val('review-notes'),
        reviewer: 'You',
      });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'blacklist-vendor') {
      const fields = readVendorActionFields();
      Store.actions.blacklistVendor(btn.getAttribute('data-id'), fields);
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reinstate-vendor') {
      const fields = readVendorActionFields();
      Store.actions.reinstateVendor(btn.getAttribute('data-id'), fields);
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'update-vendor-risk') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.updateVendorRisk(btn.getAttribute('data-id'), { riskTier: val('vendor-risk-tier'), riskNote: val('vendor-risk-note') });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'add-vendor-contact-row') {
      syncVendorContactGridFromDom();
      uiState.ephemeral.vendorForm.contacts.push(emptyVendorContact());
      rerenderVendorContactGridOnly();
      return;
    }
    if (action === 'remove-vendor-contact-row') {
      syncVendorContactGridFromDom();
      const idx = Number(btn.getAttribute('data-index'));
      if (uiState.ephemeral.vendorForm.contacts.length > 1) uiState.ephemeral.vendorForm.contacts.splice(idx, 1);
      rerenderVendorContactGridOnly();
      return;
    }
    if (action === 'cancel-vendor-form') { resetVendorFormAndShowDirectory(); return; }
    if (action === 'save-vendor-draft' || action === 'submit-vendor') {
      syncVendorContactGridFromDom();
      const header = readVendorHeaderFields();
      const payload = Object.assign({}, header, { contacts: uiState.ephemeral.vendorForm.contacts });
      const status = action === 'save-vendor-draft' ? 'Draft' : 'Pending';
      Store.actions.registerVendor(payload, status);
      resetVendorFormAndShowDirectory();
      return;
    }
    if (action === 'toggle-vendor-approval-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.vendorApprovalDrawerOpenId = uiState.ephemeral.vendorApprovalDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'close-vendor-drawer') {
      uiState.ephemeral.vendorApprovalDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'approve-vendor') {
      const fields = readDrawerFields();
      const coiEl = document.getElementById('vendor-coi-declared');
      const coiDeclared = coiEl ? coiEl.checked : false;
      if (!coiDeclared) { showToast('Confirm the conflict-of-interest declaration before approving this vendor.', 'error'); return; }
      Store.actions.approveVendor(btn.getAttribute('data-id'), Object.assign({}, fields, { coiDeclared }));
      uiState.ephemeral.vendorApprovalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-vendor') {
      const fields = readDrawerFields();
      Store.actions.rejectVendor(btn.getAttribute('data-id'), fields);
      uiState.ephemeral.vendorApprovalDrawerOpenId = null;
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 7 actions ───────────────────────────────────────
    if (action === 'filter-rfq-list') {
      uiState.ephemeral.rfqListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.rfqDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-rfq-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.rfqDrawerOpenId = uiState.ephemeral.rfqDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'issue-rfq') {
      Store.actions.issueRFQDraft(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'close-rfq') {
      Store.actions.closeRFQ(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'cancel-rfq') {
      Store.actions.cancelRFQ(btn.getAttribute('data-id'), { comment: 'Cancelled from RFQ detail view' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'duplicate-rfq') {
      const newId = Store.actions.duplicateRFQ(btn.getAttribute('data-id'));
      uiState.ephemeral.rfqDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'print-rfq') { printOrExportRFQ(btn.getAttribute('data-id')); return; }
    if (action === 'email-rfq') { emailRFQ(btn.getAttribute('data-id')); return; }

    if (action === 'cancel-rfq-form') {
      uiState.ephemeral.rfqForm = freshRfqForm();
      uiState.rfqTab = 'list';
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'save-rfq-draft' || action === 'issue-rfq-form') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const prSelect = document.getElementById('rf-prId');
      const payload = {
        prId: prSelect ? prSelect.value : uiState.ephemeral.rfqForm.prId,
        issueDate: val('rf-issueDate') || new Date().toISOString().slice(0, 10),
        closingDate: val('rf-closingDate') || new Date().toISOString().slice(0, 10),
        buyer: val('rf-buyer') || 'Priya Nair',
        deliveryTerms: val('rf-deliveryTerms') || 'Door Delivery',
        paymentTerms: val('rf-paymentTerms') || 'Net 30',
        incoterms: val('rf-incoterms') || 'DAP',
        vendorIds: Array.from(document.querySelectorAll('[data-vendor-checkbox]:checked')).map((el) => el.value),
      };
      if (!payload.prId || payload.vendorIds.length === 0) return; // need a source PR and at least one vendor
      const status = action === 'save-rfq-draft' ? 'Draft' : 'Issued';
      Store.actions.createRFQ(payload, status);
      uiState.ephemeral.rfqForm = freshRfqForm();
      uiState.rfqTab = 'list';
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 8 actions ───────────────────────────────────────
    if (action === 'filter-quotation-list') {
      uiState.ephemeral.quotationListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.quotationDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-quotation-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.quotationDrawerOpenId = uiState.ephemeral.quotationDrawerOpenId === id ? null : id;
      uiState.ephemeral.quotationAttachName = '';
      renderContentOnly();
      return;
    }
    if (action === 'submit-quotation') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const filenameEl = document.querySelector('[data-quotation-filename]');
      const payload = {
        price: val('q-price'), leadTimeDays: val('q-leadTimeDays'), tax: val('q-tax'), discount: val('q-discount'),
        warrantyMonths: val('q-warrantyMonths'), validityDate: val('q-validityDate'),
        technicalOffer: val('q-technicalOffer'), commercialOffer: val('q-commercialOffer'),
        attachmentName: uiState.ephemeral.quotationAttachName || (filenameEl && filenameEl.textContent !== 'No file selected' ? filenameEl.textContent : ''),
      };
      Store.actions.submitQuotation(btn.getAttribute('data-id'), payload);
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'accept-quotation') {
      Store.actions.acceptQuotation(btn.getAttribute('data-id'), { signature: 'You' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-quotation') {
      Store.actions.rejectQuotation(btn.getAttribute('data-id'), { comment: 'Rejected from Quotation Management' });
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 9 actions ───────────────────────────────────────
    if (action === 'set-tech-qualified') {
      const value = btn.getAttribute('data-value') === 'true';
      Store.actions.setTechnicalQualification(btn.getAttribute('data-id'), value);
      renderContentOnly();
      return;
    }
    if (action === 'toggle-recommended') {
      Store.actions.toggleRecommended(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 10 actions ──────────────────────────────────────
    if (action === 'add-committee-review') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.addCommitteeReview(btn.getAttribute('data-id'), {
        reviewer: val('rev-reviewer') || 'Unnamed Reviewer',
        role: val('rev-role'),
        vendorId: val('rev-vendorId'),
        comment: val('rev-comment'),
      });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'record-negotiation') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.recordNegotiation(btn.getAttribute('data-id'), {
        vendorId: val('neg-vendorId'),
        toPrice: val('neg-toPrice'),
        notes: val('neg-notes'),
        by: val('neg-by') || 'You',
      });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'approve-selection') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.approveVendorSelection(btn.getAttribute('data-id'), {
        vendorId: val('award-vendorId'),
        comment: val('award-comment'),
        signature: val('award-signature') || 'Unsigned',
      });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'award-vendor') {
      Store.actions.awardVendor(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'generate-award-letter') {
      printOrExportAwardLetter(btn.getAttribute('data-id'));
      return;
    }

    // ── Module 11: Purchase Order actions ──────────────────────
    if (action === 'filter-po-list') {
      uiState.ephemeral.poListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.poDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-po-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.poDrawerOpenId = uiState.ephemeral.poDrawerOpenId === id ? null : id;
      uiState.ephemeral.poAmendFormOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-amend-po') {
      uiState.ephemeral.poAmendFormOpenId = btn.getAttribute('data-id');
      renderContentOnly();
      return;
    }
    if (action === 'cancel-amend-po') {
      uiState.ephemeral.poAmendFormOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'amend-po') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const newId = Store.actions.amendPO(btn.getAttribute('data-id'), {
        subtotal: val('amend-subtotal'), taxTotal: val('amend-taxTotal'), discountTotal: val('amend-discountTotal'),
        paymentTerms: val('amend-paymentTerms'), deliveryTerms: val('amend-deliveryTerms'), deliveryLocation: val('amend-deliveryLocation'),
        reason: val('amend-reason'), signature: val('amend-signature'),
      });
      uiState.ephemeral.poAmendFormOpenId = null;
      if (newId) showToast('PO amendment saved.', 'success'); else showToast('Could not amend this PO — it may be locked by a verified invoice.', 'error');
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'create-po') {
      const rfqSelect = document.getElementById('po-rfqId');
      const rfqId = rfqSelect ? rfqSelect.value : btn.getAttribute('data-rfq-id');
      const payload = {
        deliveryLocation: (document.getElementById('po-deliveryLocation') || {}).value,
        paymentTerms: (document.getElementById('po-paymentTerms') || {}).value,
      };
      const newId = Store.actions.createPO(rfqId, payload);
      uiState.ephemeral.poForm = freshPoForm();
      uiState.poTab = 'list';
      uiState.ephemeral.poDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'approve-po') {
      const fields = readDrawerFields();
      const coiEl = document.getElementById('po-coi-declared');
      const coiDeclared = coiEl ? coiEl.checked : false;
      if (!coiDeclared) { showToast('Confirm the conflict-of-interest declaration before approving this PO.', 'error'); return; }
      const coiNote = document.getElementById('po-coi-note');
      Store.actions.approvePO(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature, coiDeclared, coiNote: coiNote ? coiNote.value : '' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-po') {
      const fields = readDrawerFields();
      Store.actions.rejectPO(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'release-po') {
      Store.actions.releasePO(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'cancel-po') {
      Store.actions.cancelPO(btn.getAttribute('data-id'), { reason: 'Cancelled from Purchase Order module' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'vendor-accept-po') {
      const noteEl = document.getElementById('va-note');
      Store.actions.recordVendorAcceptance(btn.getAttribute('data-id'), { status: 'Accepted', note: noteEl ? noteEl.value : '' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'vendor-decline-po') {
      const noteEl = document.getElementById('va-note');
      Store.actions.recordVendorAcceptance(btn.getAttribute('data-id'), { status: 'Declined', note: noteEl ? noteEl.value : '' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'print-po') { printOrExportPO(btn.getAttribute('data-id')); return; }

    // ── Contract Types actions ──────────────────────────────────
    if (action === 'filter-contract-list') {
      uiState.ephemeral.contractListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.contractDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-contract-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.contractDrawerOpenId = uiState.ephemeral.contractDrawerOpenId === id ? null : id;
      uiState.ephemeral.contractCallOffFormOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'add-contract-item-row') {
      syncContractItemGridFromDom();
      uiState.ephemeral.contractForm.items.push(emptyContractItem());
      rerenderContractItemGridOnly();
      return;
    }
    if (action === 'remove-contract-item-row') {
      syncContractItemGridFromDom();
      const idx = Number(btn.getAttribute('data-index'));
      if (uiState.ephemeral.contractForm.items.length > 1) uiState.ephemeral.contractForm.items.splice(idx, 1);
      rerenderContractItemGridOnly();
      return;
    }
    if (action === 'cancel-contract-form') { resetContractFormAndShowList(); return; }
    if (action === 'submit-contract') {
      syncContractItemGridFromDom();
      const header = readContractHeaderFields();
      const payload = Object.assign({}, header, { items: uiState.ephemeral.contractForm.items });
      const newId = Store.actions.createContract(payload);
      if (!newId) { showToast('Add at least one item with a material code and a rate above zero.', 'error'); return; }
      resetContractFormAndShowList();
      uiState.ephemeral.contractDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'approve-contract') {
      const fields = readDrawerFields();
      Store.actions.approveContract(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-contract') {
      const fields = readDrawerFields();
      Store.actions.rejectContract(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'close-contract') {
      Store.actions.closeContract(btn.getAttribute('data-id'), { reason: 'Closed early from Contracts tab' });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'toggle-calloff-form') {
      uiState.ephemeral.contractCallOffFormOpenId = btn.getAttribute('data-id');
      renderContentOnly();
      return;
    }
    if (action === 'cancel-calloff-form') {
      uiState.ephemeral.contractCallOffFormOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'submit-calloff') {
      const contractId = btn.getAttribute('data-id');
      const contract = Store.state.contracts.find((c) => c.id === contractId);
      const qtyInputs = Array.from(document.querySelectorAll('[data-calloff-idx]'));
      const items = contract ? contract.items.map((it, idx) => {
        const input = qtyInputs.find((el) => Number(el.getAttribute('data-calloff-idx')) === idx);
        return { qty: input ? Number(input.value) || 0 : 0 };
      }) : [];
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const newId = Store.actions.createCallOffPO(contractId, {
        items, paymentTerms: val('calloff-paymentTerms'), deliveryLocation: val('calloff-deliveryLocation'),
      });
      if (!newId) { showToast('Could not raise the call-off — check quantities are above zero and within the remaining balance.', 'error'); return; }
      uiState.ephemeral.contractCallOffFormOpenId = null;
      showToast('Call-off PO raised. Find it in the Purchase Order list.', 'success');
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Service Procurement mode actions ────────────────────────
    if (action === 'add-milestone-row') {
      syncMilestoneGridFromDom();
      uiState.ephemeral.servicePoForm.milestones.push(emptyMilestone());
      rerenderMilestoneGridOnly();
      return;
    }
    if (action === 'remove-milestone-row') {
      syncMilestoneGridFromDom();
      const idx = Number(btn.getAttribute('data-index'));
      if (uiState.ephemeral.servicePoForm.milestones.length > 1) uiState.ephemeral.servicePoForm.milestones.splice(idx, 1);
      rerenderMilestoneGridOnly();
      return;
    }
    if (action === 'cancel-service-po-form') { resetServicePoFormAndShowList(); return; }
    if (action === 'submit-service-po') {
      syncMilestoneGridFromDom();
      const header = readServicePoHeaderFields();
      const payload = Object.assign({}, header, { milestones: uiState.ephemeral.servicePoForm.milestones });
      const newId = Store.actions.createServicePO(payload);
      if (!newId) { showToast('Add at least one deliverable with a title and an amount above zero.', 'error'); return; }
      resetServicePoFormAndShowList();
      uiState.ephemeral.poDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'signoff-milestone') {
      const fields = readDrawerFields();
      const ok = Store.actions.signOffMilestone(btn.getAttribute('data-id'), btn.getAttribute('data-milestone-id'), { signature: fields.signature, remarks: fields.comment });
      if (!ok) { showToast('Could not sign off this deliverable — it may already be signed off.', 'error'); return; }
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-milestone') {
      const fields = readDrawerFields();
      Store.actions.rejectMilestone(btn.getAttribute('data-id'), btn.getAttribute('data-milestone-id'), { signature: fields.signature, reason: fields.comment });
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 12: Delivery Tracking actions ───────────────────
    if (action === 'filter-delivery-list') {
      uiState.ephemeral.deliveryListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.deliveryDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-delivery-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.deliveryDrawerOpenId = uiState.ephemeral.deliveryDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'create-delivery') {
      const poSelect = document.getElementById('del-poId');
      const poId = poSelect ? poSelect.value : btn.getAttribute('data-po-id');
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const payload = { courier: val('del-courier'), trackingNumber: val('del-trackingNumber'), dispatchDate: val('del-dispatchDate'), eta: val('del-eta') };
      Store.actions.createDelivery(poId, payload);
      uiState.ephemeral.deliveryForm = freshDeliveryForm();
      uiState.deliveryTab = 'board';
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'report-delay') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.reportDelay(btn.getAttribute('data-id'), { delayDays: val('del-days'), remarks: val('del-remarks') });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'mark-delivery-partial') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      Store.actions.markDeliveryPartial(btn.getAttribute('data-id'), { remarks: val('del-remarks') });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'mark-delivery-complete') {
      Store.actions.markDeliveryComplete(btn.getAttribute('data-id'));
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 13: GRN actions ──────────────────────────────────
    if (action === 'toggle-grn-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.grnDrawerOpenId = uiState.ephemeral.grnDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'post-grn') {
      const poSelect = document.getElementById('grn-poId');
      const poId = poSelect ? poSelect.value : btn.getAttribute('data-po-id');
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const tbody = document.querySelector('#grn-item-grid tbody');
      const items = tbody ? Array.from(tbody.querySelectorAll('tr')).map((row) => {
        const get = (field) => { const el = row.querySelector('[data-field="' + field + '"]'); return el ? el.value : ''; };
        return { receivedQty: get('receivedQty'), acceptedQty: get('acceptedQty'), remarks: get('remarks') };
      }) : [];
      const payload = { grnDate: val('grn-date'), warehouse: val('grn-warehouse'), inspector: val('grn-inspector'), items };
      const newId = Store.actions.createGRN(poId, payload);
      uiState.ephemeral.grnForm = freshGrnForm();
      uiState.grnTab = 'list';
      uiState.ephemeral.grnDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 14: Invoice Verification actions ─────────────────
    if (action === 'filter-invoice-list') {
      uiState.ephemeral.invoiceListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.invoiceDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-invoice-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.invoiceDrawerOpenId = uiState.ephemeral.invoiceDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'submit-invoice') {
      const poSelect = document.getElementById('inv-poId');
      const poId = poSelect ? poSelect.value : btn.getAttribute('data-po-id');
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const payload = {
        vendorInvoiceNumber: val('inv-vendorInvoiceNumber'), invoiceDate: val('inv-invoiceDate'),
        subtotal: val('inv-subtotal'), taxTotal: val('inv-taxTotal'), discountTotal: val('inv-discountTotal'),
      };
      const newId = Store.actions.submitInvoice(poId, payload);
      uiState.ephemeral.invoiceForm = freshInvoiceForm();
      uiState.invoiceTab = 'list';
      uiState.ephemeral.invoiceDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'verify-invoice') {
      const fields = readDrawerFields();
      Store.actions.verifyInvoice(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'reject-invoice') {
      const fields = readDrawerFields();
      Store.actions.rejectInvoice(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'override-invoice-block') {
      const fields = readDrawerFields();
      Store.actions.overrideInvoiceBlock(btn.getAttribute('data-id'), { comment: fields.comment, signature: fields.signature });
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Dispute / Escalation flow actions ───────────────────────
    if (action === 'filter-dispute-list') {
      uiState.ephemeral.disputeListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.disputeDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-dispute-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.disputeDrawerOpenId = uiState.ephemeral.disputeDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'raise-dispute') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const newId = Store.actions.raiseDispute({
        source: btn.getAttribute('data-source'), sourceId: btn.getAttribute('data-id'),
        reason: val('dispute-reason'), signature: val('dispute-raiser-signature') || 'You',
      });
      if (!newId) { showToast('Enter a reason before raising a dispute.', 'error'); return; }
      showToast('Dispute raised. Track it from the Disputes tab in Invoice Verification.', 'success');
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'respond-dispute') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const ok = Store.actions.addDisputeVendorResponse(btn.getAttribute('data-id'), { response: val('dispute-vendor-response'), signature: val('dispute-vendor-signature') || 'Vendor' });
      if (!ok) { showToast('Enter the vendor\'s response before submitting.', 'error'); return; }
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'resolve-dispute') {
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const ok = Store.actions.resolveDispute(btn.getAttribute('data-id'), { outcome: val('dispute-outcome'), resolution: val('dispute-resolution'), signature: val('dispute-resolver-signature') || 'You' });
      if (!ok) { showToast('Enter resolution notes before closing this dispute.', 'error'); return; }
      renderContentOnly();
      renderShellChrome();
      return;
    }

    // ── Module 15: Payment Processing actions ───────────────────
    if (action === 'filter-payment-list') {
      uiState.ephemeral.paymentListFilter = btn.getAttribute('data-filter');
      uiState.ephemeral.paymentDrawerOpenId = null;
      renderContentOnly();
      return;
    }
    if (action === 'toggle-payment-drawer') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.paymentDrawerOpenId = uiState.ephemeral.paymentDrawerOpenId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'create-payment') {
      const invSelect = document.getElementById('pay-invoiceId');
      const invoiceId = invSelect ? invSelect.value : btn.getAttribute('data-invoice-id');
      const val = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
      const payload = { paymentDate: val('pay-paymentDate'), mode: val('pay-mode'), bankRef: val('pay-bankRef') };
      const newId = Store.actions.createPayment(invoiceId, payload);
      uiState.ephemeral.paymentForm = freshPaymentForm();
      uiState.paymentTab = 'list';
      uiState.ephemeral.paymentDrawerOpenId = newId;
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'process-payment') {
      const fields = readDrawerFields();
      Store.actions.processPayment(btn.getAttribute('data-id'), { signature: fields.signature, comment: fields.comment });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'mark-payment-failed') {
      const fields = readDrawerFields();
      Store.actions.markPaymentFailed(btn.getAttribute('data-id'), { signature: fields.signature, comment: fields.comment });
      renderContentOnly();
      renderShellChrome();
      return;
    }
    if (action === 'print-payment') { printOrExportPaymentVoucher(btn.getAttribute('data-id')); return; }

    // ── Module 16: Reports & Audit actions ──────────────────────
    if (action === 'filter-audit-log') {
      uiState.ephemeral.reportsAuditFilter = btn.getAttribute('data-filter');
      renderContentOnly();
      return;
    }
    if (action === 'print-report') { printReportsScreen(); return; }

    // ── Instructor Console (Administrator only) ──────────────────
    if (action === 'toggle-instructor-student') {
      const id = btn.getAttribute('data-id');
      uiState.ephemeral.instructorOpenStudentId = uiState.ephemeral.instructorOpenStudentId === id ? null : id;
      renderContentOnly();
      return;
    }
    if (action === 'save-instructor-grade') {
      const studentId = btn.getAttribute('data-id');
      const scoreVal = (document.getElementById('instructor-score') || {}).value;
      const feedbackVal = (document.getElementById('instructor-feedback') || {}).value;
      Instructor.saveGrade(studentId, scoreVal, feedbackVal, Store.activeStudentId);
      showToast('Saved grade for ' + studentId + '.', 'success');
      renderContentOnly();
      return;
    }

    // ── Onboarding tour / Reset / Export / Import ────────────────
    if (action === 'noop') { return; }
    if (action === 'open-tour') { openTour(true); return; }
    if (action === 'close-tour') { closeTour(); return; }
    if (action === 'tour-next') { uiState.tourStep = Math.min(uiState.tourStep + 1, TOUR_STEPS.length - 1); renderModalOnly(); return; }
    if (action === 'tour-prev') { uiState.tourStep = Math.max(uiState.tourStep - 1, 0); renderModalOnly(); return; }
    if (action === 'open-reset-confirm') { uiState.resetConfirmOpen = true; renderModalOnly(); return; }
    if (action === 'cancel-reset') { uiState.resetConfirmOpen = false; renderModalOnly(); return; }
    if (action === 'open-settings') { uiState.settingsOpen = true; renderModalOnly(); return; }
    if (action === 'close-settings') { uiState.settingsOpen = false; renderModalOnly(); return; }
    if (action === 'open-glossary') { uiState.glossaryOpen = true; renderModalOnly(); return; }
    if (action === 'close-glossary') { uiState.glossaryOpen = false; renderModalOnly(); return; }
    if (action === 'cancel-admin-gate') { uiState.adminGateOpen = false; uiState.adminGateError = null; renderModalOnly(); return; }
    if (action === 'confirm-admin-gate') {
      const codeVal = (document.getElementById('admin-gate-code') || {}).value || '';
      if (codeVal.trim() !== Roles.ADMIN_ACCESS_CODE) {
        uiState.adminGateError = 'Incorrect access code.';
        renderModalOnly();
        return;
      }
      uiState.adminGateOpen = false;
      uiState.adminGateError = null;
      Store.setActiveRole('Administrator');
      renderModalOnly();
      renderShellChrome();
      showToast('Now acting as Administrator.', 'success');
      return;
    }
    if (action === 'confirm-reset') {
      Store.actions.resetAll();
      uiState.resetConfirmOpen = false;
      uiState.currentModule = 'dashboard';
      uiState.tab = 'overview';
      renderFull();
      showToast('Everything has been reset — starting fresh.', 'success');
      return;
    }
    if (action === 'export-snapshot') { exportSnapshot(); return; }
    if (action === 'trigger-import') {
      const input = document.getElementById('import-file-input');
      if (input) input.click();
      return;
    }
  });

  // ── Comparison / Selection RFQ selectors ─────────────────────
  root.addEventListener('change', function (e) {
    if (e.target.id === 'role-switcher') {
      const chosen = e.target.value;
      if (chosen === 'Administrator' && Store.state.activeRole !== 'Administrator') {
        uiState.adminGateOpen = true;
        uiState.adminGateError = null;
        renderModalOnly();
        renderShellChrome(); // revert the select's visible value until the code is confirmed
        return;
      }
      Store.setActiveRole(chosen);
      renderShellChrome();
      showToast('Now acting as ' + chosen + '.', 'success');
      return;
    }
    if (e.target.id === 'cmp-rfqId') {
      uiState.comparisonRfqId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'sel-rfqId') {
      uiState.selectionRfqId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'po-rfqId') {
      uiState.ephemeral.poForm.rfqId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'del-poId') {
      uiState.ephemeral.deliveryForm.poId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'grn-poId') {
      uiState.ephemeral.grnForm.poId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'inv-poId') {
      uiState.ephemeral.invoiceForm.poId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.id === 'pay-invoiceId') {
      uiState.ephemeral.paymentForm.invoiceId = e.target.value;
      renderContentOnly();
      return;
    }
  });

  // ── Audit log live search (Module 16) — pure DOM filter, no re-render churn ──
  root.addEventListener('input', function (e) {
    if (e.target.id !== 'audit-search-input') return;
    uiState.ephemeral.reportsAuditQuery = e.target.value;
    const query = e.target.value.trim().toLowerCase();
    const table = document.getElementById('audit-log-table');
    if (!table) return;
    Array.from(table.querySelectorAll('tr.audit-row')).forEach((row) => {
      const matches = !query || (row.getAttribute('data-audit-text') || '').includes(query);
      row.style.display = matches ? '' : 'none';
    });
  });

  // ── Quotation attachment input (no re-render — direct DOM update) ──
  root.addEventListener('change', function (e) {
    const input = e.target.closest('[data-quotation-attach]');
    if (!input) return;
    const filename = input.files && input.files[0] ? input.files[0].name : 'No file selected';
    uiState.ephemeral.quotationAttachName = input.files && input.files[0] ? input.files[0].name : '';
    const label = root.querySelector('[data-quotation-filename]');
    if (label) label.textContent = filename;
  });

  // ── RFQ create form: switching the source PR re-renders the items
  // preview; vendor checkboxes sync into state without a re-render. ──
  root.addEventListener('change', function (e) {
    if (e.target.id === 'rf-prId') {
      uiState.ephemeral.rfqForm.prId = e.target.value;
      renderContentOnly();
      return;
    }
    if (e.target.matches && e.target.matches('[data-vendor-checkbox]')) {
      uiState.ephemeral.rfqForm.vendorIds = Array.from(document.querySelectorAll('[data-vendor-checkbox]:checked')).map((el) => el.value);
      const countEl = document.getElementById('vendor-selected-count');
      if (countEl) countEl.textContent = uiState.ephemeral.rfqForm.vendorIds.length + ' selected';
      return;
    }
  });

  // ── Live client-side vendor search (no re-render — pure DOM filter) ──
  root.addEventListener('input', function (e) {
    if (e.target.id !== 'vendor-search-input') return;
    const query = e.target.value.trim().toLowerCase();
    const table = document.getElementById('vendor-directory-table');
    if (!table) return;
    Array.from(table.querySelectorAll('tr.vendor-row')).forEach((row) => {
      const matches = !query || (row.getAttribute('data-vendor-name') || '').includes(query);
      row.style.display = matches ? '' : 'none';
      const drawerRow = row.nextElementSibling;
      if (drawerRow && drawerRow.classList.contains('drawer-row')) {
        drawerRow.style.display = matches ? '' : 'none';
      }
    });
  });

  // ── File attachment inputs (no re-render needed — direct DOM update) ──
  root.addEventListener('change', function (e) {
    const input = e.target.closest('[data-attach-type]');
    if (!input) return;
    const type = input.getAttribute('data-attach-type');
    const filename = input.files && input.files[0] ? input.files[0].name : 'No file selected';
    uiState.ephemeral.reqForm.attachments[type] = input.files && input.files[0] ? input.files[0].name : undefined;
    const label = root.querySelector('[data-attach-filename="' + type + '"]');
    if (label) label.textContent = filename;
  });

  // ── Import file picker (Module-independent persistence control) ──
  root.addEventListener('change', function (e) {
    if (e.target.id !== 'import-file-input') return;
    const file = e.target.files && e.target.files[0];
    if (file) importSnapshotFromFile(file);
    e.target.value = '';
  });

  // ── Boot ─────────────────────────────────────────────────────
  // If this tab already had a signed-in student (e.g. a page refresh),
  // resume straight into the app. Otherwise show the sign-in gate —
  // a fresh browser/tab always starts at login so the next student
  // never lands in someone else's session by default.
  if (tryResumeSession()) {
    renderFull();
  } else {
    renderFull(); // renders the login screen since authenticated is still false
  }
})();
