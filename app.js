/* ============================================
   BUDGET BUDDY — app.js (FINAL BUILD)
   Part 1 of 4: Data, Helpers, Tabs, Quick-Add
   ============================================ */

// ===== DEFAULT CATEGORIES =====
var DEFAULT_EXPENSE_CATS = [
    { id: 1, name: 'Food', limit: 0 },
    { id: 2, name: 'Transportation', limit: 0 },
    { id: 3, name: 'Shopping', limit: 0 },
    { id: 4, name: 'Health', limit: 0 },
    { id: 5, name: 'Entertainment', limit: 0 },
    { id: 6, name: 'Utilities', limit: 0 },
    { id: 7, name: 'Rent', limit: 0 },
    { id: 8, name: 'Others', limit: 0 }
];

var DEFAULT_INCOME_CATS = [
    { id: 101, name: 'Salary' },
    { id: 102, name: 'Sideline' },
    { id: 103, name: 'Others' }
];

var PIE_COLORS = ['#22c55e','#ef4444','#3b82f6','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316','#6366f1','#06b6d4'];

// ===== DATA STORE =====
var appData = {
    monthlyBudget: 0,
    payday: 10,
    expenseCategories: JSON.parse(JSON.stringify(DEFAULT_EXPENSE_CATS)),
    incomeCategories: JSON.parse(JSON.stringify(DEFAULT_INCOME_CATS)),
    transactions: [],
    bills: [],
    goals: [],
    balanceHidden: false,
    streakDates: []
};

// ===== STATE =====
var currentMonth = getCurrentMonth();
var currentTxFilter = 'all';
var editingTxId = null;
var editingBillId = null;
var editingGoalId = null;
var confirmCallback = null;
var quickAddType = 'expense';
var quickAddNeedWant = 'need';
var currentBillType = 'recurring';

// ===== LOCAL STORAGE =====
function saveData() {
    localStorage.setItem('budgetBuddyData', JSON.stringify(appData));
}

function loadData() {
    var saved = localStorage.getItem('budgetBuddyData');
    if (saved) {
        var parsed = JSON.parse(saved);
        appData = Object.assign({}, appData, parsed);
    }
}

// ===== DATE HELPERS =====
function getCurrentMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function formatMonth(monthStr) {
    var parts = monthStr.split('-');
    var months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
    return months[parseInt(parts[1]) - 1] + ' ' + parts[0];
}

function shortMonth(monthStr) {
    var parts = monthStr.split('-');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[parseInt(parts[1]) - 1];
}

function shiftMonth(monthStr, direction) {
    var parts = monthStr.split('-');
    var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1 + direction, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function getDaysInMonth(monthStr) {
    var parts = monthStr.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]), 0).getDate();
}

function getDaysRemaining() {
    var payday = appData.payday || 1;
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var thisMonthPayday = new Date(today.getFullYear(), today.getMonth(), payday);
    var nextPayday;

    if (today < thisMonthPayday) {
        nextPayday = thisMonthPayday;
    } else {
        nextPayday = new Date(today.getFullYear(), today.getMonth() + 1, payday);
    }

    var diff = Math.ceil((nextPayday - today) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1);
}

function formatDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
}

function shortDate(dateStr) {
    var d = new Date(dateStr + 'T00:00:00');
    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getDate();
}

function getToday() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function getMonthFromDate(dateStr) {
    return dateStr.substring(0, 7);
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function formatPeso(amount) {
    var num = parseFloat(amount) || 0;
    return '\u20B1' + num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPesoShort(amount) {
    var num = parseFloat(amount) || 0;
    if (num >= 1000000) return '\u20B1' + (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return '\u20B1' + (num / 1000).toFixed(1) + 'K';
    return '\u20B1' + num.toFixed(0);
}

// ===== DATA HELPERS =====
function getMonthTransactions(monthStr) {
    return appData.transactions.filter(function(tx) {
        return getMonthFromDate(tx.date) === monthStr;
    });
}

function getMonthExpenses(monthStr) {
    var total = 0;
    getMonthTransactions(monthStr).forEach(function(tx) {
        if (tx.type === 'expense') total += parseFloat(tx.amount) || 0;
    });
    return total;
}

function getMonthIncome(monthStr) {
    var total = 0;
    getMonthTransactions(monthStr).forEach(function(tx) {
        if (tx.type === 'income') total += parseFloat(tx.amount) || 0;
    });
    return total;
}

function getMonthSavings(monthStr) {
    var total = 0;
    getMonthTransactions(monthStr).forEach(function(tx) {
        if (tx.type === 'save') total += parseFloat(tx.amount) || 0;
    });
    return total;
}

function getMonthBills(monthStr) {
    return appData.bills.filter(function(b) {
        // Payable: hide only if fully paid BEFORE this month
        if (b.billType === 'payable') {
            var totalOwed = parseFloat(b.totalOwed) || 0;
            var totalPaid = parseFloat(b.totalPaid) || 0;
            if (totalOwed > 0 && totalPaid >= totalOwed) {
                // Find the month it was fully paid (last paidMonth entry)
                var paidMonths = (b.paidMonths || []).slice().sort();
                var lastPaidMonth = paidMonths.length > 0 ? paidMonths[paidMonths.length - 1] : '';
                // Show in the month it was completed, hide after
                if (lastPaidMonth && monthStr > lastPaidMonth) return false;
            }
            return true;
        }
        // Recurring: always show
        if (b.billType === 'recurring') return true;
        // One-time: only show in the month it was created
        return b.monthCreated === monthStr;
    });
}

function getMonthBillsTotal(monthStr) {
    var total = 0;
    getMonthBills(monthStr).forEach(function(b) { total += parseFloat(b.amount) || 0; });
    return total;
}

function isBillPaid(bill, monthStr) {
    if (!bill.paidMonths) return false;
    return bill.paidMonths.includes(monthStr);
}

function toggleBillPaid(billId, monthStr) {
    var bill = appData.bills.find(function(b) { return b.id === billId; });
    if (!bill) return;
    if (!bill.paidMonths) bill.paidMonths = [];
    var idx = bill.paidMonths.indexOf(monthStr);
    if (idx >= 0) {
        bill.paidMonths.splice(idx, 1);
        if (bill.billType === 'payable') {
            bill.totalPaid = Math.max((parseFloat(bill.totalPaid) || 0) - (parseFloat(bill.amount) || 0), 0);
        }
    } else {
        bill.paidMonths.push(monthStr);
        if (bill.billType === 'payable') {
            bill.totalPaid = (parseFloat(bill.totalPaid) || 0) + (parseFloat(bill.amount) || 0);
        }
    }
    saveData();
}

function getCategorySpending(monthStr, categoryId) {
    var total = 0;
    getMonthTransactions(monthStr).forEach(function(tx) {
        if (tx.type === 'expense' && tx.categoryId === categoryId) total += parseFloat(tx.amount) || 0;
    });
    return total;
}

function getTodayExpenses() {
    var today = getToday();
    var total = 0;
    appData.transactions.forEach(function(tx) {
        if (tx.date === today && tx.type === 'expense') total += parseFloat(tx.amount) || 0;
    });
    return total;
}

function getTotalSavingsAllocations() {
    var total = 0;
    appData.goals.forEach(function(g) { total += parseFloat(g.allocation) || 0; });
    return total;
}

function getCategoryName(categoryId, type) {
    var cats = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
    var cat = cats.find(function(c) { return c.id === categoryId; });
    return cat ? cat.name : 'Unknown';
}

// ===== STREAK =====
function updateStreak() {
    var today = getToday();
    if (!appData.streakDates.includes(today)) {
        appData.streakDates.push(today);
        saveData();
    }
}

function getStreakCount() {
    var dates = appData.streakDates.slice().sort().reverse();
    if (dates.length === 0) return 0;
    var count = 0;
    var d = new Date();
    for (var i = 0; i < 365; i++) {
        var dateStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        if (dates.includes(dateStr)) {
            count++;
            d.setDate(d.getDate() - 1);
        } else {
            break;
        }
    }
    return count;
}

// ===== CONFIRM DIALOG =====
function showConfirm(message, onConfirm) {
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmDialog').classList.remove('hidden');
    confirmCallback = onConfirm;
}

function closeConfirm() {
    document.getElementById('confirmDialog').classList.add('hidden');
    confirmCallback = null;
}

// ===== TAB SWITCHING =====
function switchTab(tabName) {
    document.querySelectorAll('.tab-page').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
    document.getElementById(tabName + 'Tab').classList.add('active');
    document.querySelector('.tab-btn[data-tab="' + tabName + '"]').classList.add('active');

    if (tabName === 'dashboard') renderDashboard();
    if (tabName === 'transactions') renderTransactions();
    if (tabName === 'bills') renderBills();
    if (tabName === 'insights') renderInsights();
}

// ===== MONTH NAVIGATION =====
function updateMonthDisplay() {
    document.getElementById('monthBtn').textContent = formatMonth(currentMonth);
}

function refreshCurrentTab() {
    var active = document.querySelector('.tab-btn.active');
    if (active) switchTab(active.dataset.tab);
}

function monthPick() {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:999;display:flex;align-items:center;justify-content:center;';
    var box = document.createElement('div');
    box.style.cssText = 'background:white;border-radius:16px;padding:24px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.15);min-width:260px;';
    var label = document.createElement('div');
    label.textContent = 'Select month';
    label.style.cssText = 'font-size:0.9rem;font-weight:600;color:#555;margin-bottom:14px;';
    var input = document.createElement('input');
    input.type = 'month';
    input.value = currentMonth;
    input.style.cssText = 'font-size:1rem;padding:10px 14px;border:1px solid #ddd;border-radius:10px;width:100%;';
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = 'flex:1;padding:12px;border-radius:10px;border:1px solid #ddd;background:white;font-size:0.9rem;cursor:pointer;';
    var okBtn = document.createElement('button');
    okBtn.textContent = 'Go';
    okBtn.style.cssText = 'flex:1;padding:12px;border-radius:10px;border:none;background:#0d9488;color:white;font-size:0.9rem;font-weight:700;cursor:pointer;';
    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(okBtn);
    box.appendChild(label);
    box.appendChild(input);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    function cleanup() { if (document.body.contains(overlay)) document.body.removeChild(overlay); }
    okBtn.addEventListener('click', function() { if (input.value) { currentMonth = input.value; updateMonthDisplay(); refreshCurrentTab(); } cleanup(); });
    cancelBtn.addEventListener('click', cleanup);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) cleanup(); });
}

// ===== QUICK-ADD PANEL =====
function openQuickAdd(txId) {
    editingTxId = txId || null;
    var panel = document.getElementById('quickAddPanel');
    var overlay = document.getElementById('quickAddOverlay');
    var amountInput = document.getElementById('txAmount');
    var dateInput = document.getElementById('txDate');
    var noteInput = document.getElementById('txNote');
    var deleteBtn = document.getElementById('deleteTxBtn');

    if (txId) {
        var tx = appData.transactions.find(function(t) { return t.id === txId; });
        if (!tx) return;
        document.getElementById('quickAddTitle').textContent = 'Edit Transaction';
        quickAddType = tx.type;
        quickAddNeedWant = tx.needWant || 'need';
        amountInput.value = tx.amount;
        dateInput.value = tx.date;
        noteInput.value = tx.note || '';
        deleteBtn.classList.remove('hidden');
        updateTypeToggles();
        populateCategoryDropdown(tx.type);
        document.getElementById('txCategory').value = tx.categoryId;
        if (tx.type === 'save' && tx.goalId) {
            populateGoalDropdown();
            document.getElementById('txGoal').value = tx.goalId;
        }
        updateNeedWantToggles();
    } else {
        document.getElementById('quickAddTitle').textContent = 'Add Expense';
        quickAddType = 'expense';
        quickAddNeedWant = 'need';
        amountInput.value = '';
        dateInput.value = getToday();
        noteInput.value = '';
        deleteBtn.classList.add('hidden');
        updateTypeToggles();
        populateCategoryDropdown('expense');
        updateNeedWantToggles();
    }

    updateQuickAddVisibility();
    panel.classList.add('open');
    overlay.classList.add('open');
    amountInput.focus();
}

function closeQuickAdd() {
    document.getElementById('quickAddPanel').classList.remove('open');
    document.getElementById('quickAddOverlay').classList.remove('open');
    editingTxId = null;
}

function updateTypeToggles() {
    document.querySelectorAll('.type-toggle').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.type === quickAddType);
    });
    var titles = { expense: 'Expense', income: 'Income', save: 'Savings' };
    document.getElementById('quickAddTitle').textContent = editingTxId ? 'Edit Transaction' : 'Add ' + titles[quickAddType];
}

function updateNeedWantToggles() {
    document.querySelectorAll('.need-want-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.nw === quickAddNeedWant);
    });
}

function updateQuickAddVisibility() {
    var goalRow = document.getElementById('txGoalRow');
    var nwRow = document.getElementById('txNeedWantRow');
    var catLabel = document.getElementById('txCategoryLabel');
    var catSelect = document.getElementById('txCategory');

    if (quickAddType === 'save') {
        goalRow.classList.remove('hidden');
        nwRow.style.display = 'none';
        catLabel.style.display = 'none';
        catSelect.style.display = 'none';
        populateGoalDropdown();
    } else if (quickAddType === 'income') {
        goalRow.classList.add('hidden');
        nwRow.style.display = 'none';
        catLabel.style.display = '';
        catSelect.style.display = '';
    } else {
        goalRow.classList.add('hidden');
        nwRow.style.display = '';
        catLabel.style.display = '';
        catSelect.style.display = '';
    }
}

function populateCategoryDropdown(type) {
    var select = document.getElementById('txCategory');
    var cats = type === 'expense' ? appData.expenseCategories : appData.incomeCategories;
    select.innerHTML = cats.map(function(c) {
        return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join('');
}

function populateGoalDropdown() {
    var select = document.getElementById('txGoal');
    if (appData.goals.length === 0) {
        select.innerHTML = '<option value="">No goals yet</option>';
        return;
    }
    select.innerHTML = appData.goals.map(function(g) {
        return '<option value="' + g.id + '">' + g.name + '</option>';
    }).join('');
}

function saveTransaction() {
    var amount = parseFloat(document.getElementById('txAmount').value);
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }

    var date = document.getElementById('txDate').value;
    if (!date) { alert('Select a date.'); return; }

    var categoryId = parseInt(document.getElementById('txCategory').value) || 0;
    var note = document.getElementById('txNote').value.trim();
    var goalId = null;
    var needWant = null;

    if (quickAddType === 'save') {
        goalId = document.getElementById('txGoal').value;
        if (!goalId) { alert('Select a goal.'); return; }
        // Add to goal's saved amount
        var goal = appData.goals.find(function(g) { return g.id === goalId; });
        if (goal && !editingTxId) {
            goal.saved = (parseFloat(goal.saved) || 0) + amount;
        }
    }

    if (quickAddType === 'expense') {
        needWant = quickAddNeedWant;
    }

    if (editingTxId) {
        var tx = appData.transactions.find(function(t) { return t.id === editingTxId; });
        if (tx) {
            // If editing a save transaction, adjust goal
            if (tx.type === 'save' && tx.goalId) {
                var oldGoal = appData.goals.find(function(g) { return g.id === tx.goalId; });
                if (oldGoal) oldGoal.saved = Math.max((parseFloat(oldGoal.saved) || 0) - (parseFloat(tx.amount) || 0), 0);
            }
            if (quickAddType === 'save' && goalId) {
                var newGoal = appData.goals.find(function(g) { return g.id === goalId; });
                if (newGoal) newGoal.saved = (parseFloat(newGoal.saved) || 0) + amount;
            }
            tx.type = quickAddType;
            tx.amount = amount;
            tx.categoryId = categoryId;
            tx.date = date;
            tx.note = note;
            tx.goalId = goalId;
            tx.needWant = needWant;
        }
    } else {
        appData.transactions.push({
            id: generateId(),
            type: quickAddType,
            amount: amount,
            categoryId: categoryId,
            date: date,
            note: note,
            goalId: goalId,
            needWant: needWant
        });
    }

    updateStreak();
    saveData();
    closeQuickAdd();
    refreshCurrentTab();
}

function deleteTransaction() {
    if (!editingTxId) return;
    var tx = appData.transactions.find(function(t) { return t.id === editingTxId; });
    showConfirm('Delete this transaction?', function() {
        if (tx && tx.type === 'save' && tx.goalId) {
            var goal = appData.goals.find(function(g) { return g.id === tx.goalId; });
            if (goal) goal.saved = Math.max((parseFloat(goal.saved) || 0) - (parseFloat(tx.amount) || 0), 0);
        }
        appData.transactions = appData.transactions.filter(function(t) { return t.id !== editingTxId; });
        saveData();
        closeQuickAdd();
        refreshCurrentTab();
    });
}

/* ============================================
   BUDGET BUDDY — app.js
   Part 2 of 4: Dashboard & Transactions
   ============================================ */

// ===== DASHBOARD — MAIN RENDER =====
function renderDashboard() {
    var budget = parseFloat(appData.monthlyBudget) || 0;
    var expenses = getMonthExpenses(currentMonth);
    var billsTotal = getMonthBillsTotal(currentMonth);
    var income = getMonthIncome(currentMonth);
    var savingsDeposits = getMonthSavings(currentMonth);
    var remaining = budget + income - expenses - billsTotal - savingsDeposits;

    // Balance card
    renderBalanceCard(remaining);

    // Summary row
    document.getElementById('dashExpense').textContent = formatPeso(expenses);
    document.getElementById('dashBills').textContent = formatPeso(billsTotal);

    // Sections
    renderDailyReminder();
    renderStreak();
    renderBillsWarning();
    renderCategoryWarnings();
    renderDashGoals();
    renderDashChart();
    renderRecentTransactions();
}

// ===== BALANCE CARD =====
function renderBalanceCard(remaining) {
    var amountEl = document.getElementById('dashBalance');
    var dailyEl = document.getElementById('dashDaily');
    var toggleEl = document.getElementById('balanceToggle');

    if (appData.balanceHidden) {
        amountEl.textContent = '\u2022\u2022\u2022\u2022\u2022\u2022';
        amountEl.classList.add('hidden-amount');
        dailyEl.textContent = '';
        toggleEl.textContent = 'Tap to show';
    } else {
        amountEl.textContent = formatPeso(remaining);
        amountEl.classList.remove('hidden-amount');
        amountEl.style.color = remaining >= 0 ? 'white' : '#fecaca';

        var daysLeft = getDaysRemaining();
        if (remaining > 0) {
            var daily = remaining / daysLeft;
            dailyEl.textContent = formatPeso(daily) + '/day for ' + daysLeft + ' days';
        } else {
            dailyEl.textContent = 'Over budget!';
        }
        toggleEl.textContent = 'Tap to hide';
    }
}

function toggleBalance() {
    appData.balanceHidden = !appData.balanceHidden;
    saveData();
    renderDashboard();
}

// ===== DAILY REMINDER =====
function renderDailyReminder() {
    var el = document.getElementById('dailyReminder');
    var isCurrentMonth = currentMonth === getCurrentMonth();

    if (!isCurrentMonth) { el.style.display = 'none'; return; }
    el.style.display = '';

    var todaySpent = getTodayExpenses();
    if (todaySpent > 0) {
        el.className = 'reminder-card logged';
        el.textContent = 'Today: ' + formatPeso(todaySpent) + ' spent so far.';
    } else {
        el.className = 'reminder-card';
        el.textContent = 'Wala ka pang nai-log na gastos ngayong araw.';
    }
}

// ===== STREAK =====
function renderStreak() {
    var el = document.getElementById('streakCard');
    var count = getStreakCount();
    if (count >= 2) {
        el.classList.remove('hidden');
        el.textContent = '\uD83D\uDD25 ' + count + '-day logging streak!';
    } else {
        el.classList.add('hidden');
    }
}

// ===== BILLS WARNING =====
function renderBillsWarning() {
    var el = document.getElementById('billsWarning');
    var bills = getMonthBills(currentMonth);
    var unpaid = bills.filter(function(b) { return !isBillPaid(b, currentMonth); });

    if (unpaid.length === 0) { el.classList.add('hidden'); return; }

    var totalUnpaid = 0;
    unpaid.forEach(function(b) { totalUnpaid += parseFloat(b.amount) || 0; });

    var today = new Date().getDate();
    var nearest = null;
    unpaid.forEach(function(b) {
        var due = parseInt(b.dueDay) || 0;
        if (due >= today && (!nearest || due < nearest)) nearest = due;
    });

    var text = unpaid.length + ' unpaid bill' + (unpaid.length > 1 ? 's' : '') +
        ' \u2014 ' + formatPeso(totalUnpaid) + ' total.';
    if (nearest) text += ' Nearest due: day ' + nearest + '.';

    el.classList.remove('hidden');
    el.textContent = text;
}

// ===== CATEGORY WARNINGS =====
function renderCategoryWarnings() {
    var container = document.getElementById('categoryWarnings');
    var html = '';
    appData.expenseCategories.forEach(function(cat) {
        if (!cat.limit || cat.limit <= 0) return;
        var spent = getCategorySpending(currentMonth, cat.id);
        var pct = (spent / cat.limit) * 100;
        if (pct >= 80) {
            var msg = pct >= 100
                ? 'Over budget! ' + cat.name + ': ' + formatPeso(spent) + ' / ' + formatPeso(cat.limit)
                : 'Warning: ' + Math.round(pct) + '% na ng ' + cat.name + ' budget (' + formatPeso(spent) + ' / ' + formatPeso(cat.limit) + ')';
            html += '<div class="cat-warning">' + msg + '</div>';
        }
    });
    container.innerHTML = html;
}

// ===== DASHBOARD — SAVINGS GOALS =====
function renderDashGoals() {
    var container = document.getElementById('dashGoals');
    if (appData.goals.length === 0) { container.innerHTML = ''; return; }

    var html = '<div class="section-label">Savings Goals</div>';
    appData.goals.forEach(function(g) {
        var target = parseFloat(g.target) || 1;
        var saved = parseFloat(g.saved) || 0;
        var pct = Math.min(Math.round((saved / target) * 100), 100);
        var alloc = parseFloat(g.allocation) || 0;

        html += '<div class="dash-goal-card">' +
            '<div class="dash-goal-header">' +
                '<span class="dash-goal-name">' + g.name + '</span>' +
                '<span class="dash-goal-pct">' + pct + '%</span>' +
            '</div>' +
            '<div class="dash-goal-bar"><div class="dash-goal-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="dash-goal-amounts">' +
                '<span>' + formatPesoShort(saved) + ' saved</span>' +
                '<span>' + formatPesoShort(target) + ' target</span>' +
            '</div>' +
            (alloc > 0 ? '<div class="dash-goal-alloc">' + formatPeso(alloc) + '/month allocated</div>' : '') +
            '</div>';
    });

    html += '<div class="dash-goals-link" onclick="switchTab(\'insights\')">Manage goals ></div>';
    container.innerHTML = html;
}

// ===== DASHBOARD — SPENDING CHART =====
function renderDashChart() {
    var container = document.getElementById('dashChart');
    var txs = getMonthTransactions(currentMonth).filter(function(tx) { return tx.type === 'expense'; });

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No expenses this month.</div></div>';
        return;
    }

    var catTotals = {};
    txs.forEach(function(tx) {
        var catName = getCategoryName(tx.categoryId, 'expense');
        if (!catTotals[catName]) catTotals[catName] = 0;
        catTotals[catName] += parseFloat(tx.amount) || 0;
    });

    var sorted = Object.entries(catTotals).sort(function(a, b) { return b[1] - a[1]; });
    var total = 0;
    sorted.forEach(function(s) { total += s[1]; });

    container.innerHTML = '<div class="pie-wrapper">' + buildPieSvg(sorted, total) +
        '<div class="pie-legend">' + buildPieLegend(sorted, total) + '</div></div>';
}

function buildPieSvg(sorted, total) {
    var size = 140, r = 60, cx = size / 2, cy = size / 2;
    var startAngle = 0;
    var paths = '';

    sorted.forEach(function(entry, idx) {
        var pct = entry[1] / total;
        var angle = pct * 360;
        var endAngle = startAngle + angle;
        var large = angle > 180 ? 1 : 0;
        var color = PIE_COLORS[idx % PIE_COLORS.length];

        if (sorted.length === 1) {
            paths += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + color + '"/>';
        } else {
            var x1 = cx + r * Math.cos((startAngle - 90) * Math.PI / 180);
            var y1 = cy + r * Math.sin((startAngle - 90) * Math.PI / 180);
            var x2 = cx + r * Math.cos((endAngle - 90) * Math.PI / 180);
            var y2 = cy + r * Math.sin((endAngle - 90) * Math.PI / 180);
            paths += '<path d="M ' + cx + ' ' + cy + ' L ' + x1 + ' ' + y1 +
                ' A ' + r + ' ' + r + ' 0 ' + large + ' 1 ' + x2 + ' ' + y2 + ' Z" fill="' + color + '"/>';
        }
        startAngle = endAngle;
    });

    return '<svg class="pie-svg" viewBox="0 0 ' + size + ' ' + size + '">' + paths + '</svg>';
}

function buildPieLegend(sorted, total) {
    return sorted.map(function(entry, idx) {
        var color = PIE_COLORS[idx % PIE_COLORS.length];
        var pct = Math.round((entry[1] / total) * 100);
        return '<div class="pie-legend-item">' +
            '<div class="pie-legend-dot" style="background:' + color + '"></div>' +
            '<span class="pie-legend-label">' + entry[0] + ' (' + pct + '%)</span>' +
            '<span class="pie-legend-value">' + formatPeso(entry[1]) + '</span></div>';
    }).join('');
}

// ===== DASHBOARD — RECENT TRANSACTIONS =====
function renderRecentTransactions() {
    var container = document.getElementById('recentTransactions');
    var txs = appData.transactions.slice().sort(function(a, b) {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return appData.transactions.indexOf(b) - appData.transactions.indexOf(a);
    }).slice(0, 5);

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No transactions yet. Tap + to add.</div></div>';
        return;
    }

    container.innerHTML = txs.map(function(tx) {
        return buildTxCard(tx);
    }).join('');
}

// ===== TRANSACTIONS TAB =====
function renderTransactions() {
    var container = document.getElementById('transactionList');
    var txs = getMonthTransactions(currentMonth);

    if (currentTxFilter !== 'all') {
        txs = txs.filter(function(tx) { return tx.type === currentTxFilter; });
    }

    txs.sort(function(a, b) {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return appData.transactions.indexOf(b) - appData.transactions.indexOf(a);
    });

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No transactions this month.</div></div>';
        return;
    }

    var grouped = {};
    txs.forEach(function(tx) {
        if (!grouped[tx.date]) grouped[tx.date] = [];
        grouped[tx.date].push(tx);
    });

    var html = '';
    Object.keys(grouped).sort(function(a, b) { return b.localeCompare(a); }).forEach(function(date) {
        html += '<div class="section-label" style="margin-top:14px">' + formatDate(date) + '</div>';
        grouped[date].forEach(function(tx) { html += buildTxCard(tx); });
    });

    container.innerHTML = html;
}

function buildTxCard(tx) {
    var catName = tx.type === 'save'
        ? (appData.goals.find(function(g) { return g.id === tx.goalId; }) || {}).name || 'Savings'
        : getCategoryName(tx.categoryId, tx.type);
    var note = tx.note || catName;
    var amountClass = tx.type;
    var prefix = tx.type === 'income' ? '+' : tx.type === 'save' ? '' : '-';
    var nwBadge = '';
    if (tx.type === 'expense' && tx.needWant) {
        var nwClass = tx.needWant === 'need' ? 'need' : 'want';
        var nwLabel = tx.needWant === 'need' ? 'Need' : 'Want';
        nwBadge = '<span class="tx-nw-badge ' + nwClass + '">' + nwLabel + '</span>';
    }

    return '<div class="tx-card" onclick="openQuickAdd(\'' + tx.id + '\')">' +
        '<div class="tx-left">' +
            '<span class="tx-category">' + catName + '</span>' +
            '<span class="tx-note">' + note + '</span>' +
            '<span class="tx-date">' + shortDate(tx.date) + '</span>' +
        '</div>' +
        '<div class="tx-right">' +
            '<span class="tx-amount ' + amountClass + '">' + prefix + formatPeso(tx.amount) + '</span>' +
            nwBadge +
        '</div></div>';
}

/* ============================================
   BUDGET BUDDY — app.js
   Part 3 of 4: Bills & Insights
   ============================================ */

// ===== BILLS TAB — MAIN RENDER =====
function renderBills() {
    var bills = getMonthBills(currentMonth);
    var recurring = bills.filter(function(b) { return b.billType === 'recurring'; });
    var onetime = bills.filter(function(b) { return b.billType === 'onetime'; });
    var payable = bills.filter(function(b) { return b.billType === 'payable'; });

    // Combine recurring + onetime for the recurring list
    var regularBills = recurring.concat(onetime);

    // Sort: unpaid first, then by due day
    function sortBills(arr) {
        return arr.sort(function(a, b) {
            var aPaid = isBillPaid(a, currentMonth) ? 1 : 0;
            var bPaid = isBillPaid(b, currentMonth) ? 1 : 0;
            if (aPaid !== bPaid) return aPaid - bPaid;
            return (parseInt(a.dueDay) || 0) - (parseInt(b.dueDay) || 0);
        });
    }

    regularBills = sortBills(regularBills);
    payable = sortBills(payable);

    // Summary
    renderBillsSummary(bills);

    // Recurring + One-time list
    var recurringContainer = document.getElementById('recurringBillList');
    if (regularBills.length === 0) {
        recurringContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text">No recurring bills. Tap "+ Add" to start.</div></div>';
    } else {
        recurringContainer.innerHTML = regularBills.map(function(b) { return buildBillCard(b); }).join('');
    }

    // Payables list
    var payableContainer = document.getElementById('payableBillList');
    if (payable.length === 0) {
        payableContainer.innerHTML = '<div class="empty-state"><div class="empty-state-text">No payables / utang.</div></div>';
    } else {
        payableContainer.innerHTML = payable.map(function(b) { return buildPayableCard(b); }).join('');
    }
}

function renderBillsSummary(bills) {
    var el = document.getElementById('billsSummary');
    if (bills.length === 0) { el.classList.add('hidden'); return; }

    var totalBills = 0;
    var totalPaid = 0;
    var countPaid = 0;
    bills.forEach(function(b) {
        var amt = parseFloat(b.amount) || 0;
        totalBills += amt;
        if (isBillPaid(b, currentMonth)) { totalPaid += amt; countPaid++; }
    });

    el.classList.remove('hidden');
    el.innerHTML = '<div class="bills-summary-left">' +
        '<strong>' + formatPeso(totalPaid) + '</strong> / ' + formatPeso(totalBills) + ' paid' +
        '</div><div class="bills-summary-right">' + countPaid + ' / ' + bills.length + ' bills</div>';
}

function buildBillCard(b) {
    var paid = isBillPaid(b, currentMonth);
    var paidClass = paid ? 'paid' : '';
    var checked = paid ? 'checked' : '';
    var badgeClass = b.billType === 'recurring' ? 'recurring' : 'onetime';
    var badgeLabel = b.billType === 'recurring' ? 'Recurring' : 'One-time';

    return '<div class="bill-card ' + paidClass + '" onclick="openBillPanel(\'' + b.id + '\')">' +
        '<div class="bill-left">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
                '<span class="bill-name">' + b.name + '</span>' +
                '<span class="bill-badge ' + badgeClass + '">' + badgeLabel + '</span>' +
            '</div>' +
            '<span class="bill-meta">Due: Day ' + (b.dueDay || '\u2014') + (b.notes ? ' \u00b7 ' + b.notes : '') + '</span>' +
        '</div>' +
        '<div class="bill-right">' +
            '<span class="bill-amount">' + formatPeso(b.amount) + '</span>' +
            '<input type="checkbox" class="bill-check" ' + checked + ' onclick="event.stopPropagation()" onchange="handleBillCheck(\'' + b.id + '\')">' +
        '</div></div>';
}

function buildPayableCard(b) {
    var paid = isBillPaid(b, currentMonth);
    var paidClass = paid ? 'paid' : '';
    var checked = paid ? 'checked' : '';
    var totalOwed = parseFloat(b.totalOwed) || 1;
    var totalPaid = parseFloat(b.totalPaid) || 0;
    var pct = Math.min(Math.round((totalPaid / totalOwed) * 100), 100);
    var isComplete = pct >= 100;

    return '<div class="bill-card ' + paidClass + '">' +
        '<div class="bill-left" onclick="openBillPanel(\'' + b.id + '\')">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
                '<span class="bill-name">' + b.name + '</span>' +
                '<span class="bill-badge payable">' + (isComplete ? 'Paid in full!' : 'Payable') + '</span>' +
            '</div>' +
            '<span class="bill-meta">Due: Day ' + (b.dueDay || '\u2014') + (b.notes ? ' \u00b7 ' + b.notes : '') + '</span>' +
            '<div class="payable-progress">' +
                '<div class="payable-bar"><div class="payable-fill" style="width:' + pct + '%"></div></div>' +
                '<div class="payable-text">' +
                    '<span>' + formatPesoShort(totalPaid) + ' paid</span>' +
                    '<span>' + formatPesoShort(totalOwed) + ' total (' + pct + '%)</span>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="bill-right">' +
            '<span class="bill-amount">' + formatPeso(b.amount) + '/mo</span>' +
            '<input type="checkbox" class="bill-check" ' + checked + ' onclick="event.stopPropagation()" onchange="handleBillCheck(\'' + b.id + '\')">' +
        '</div></div>';
}

function handleBillCheck(billId) {
    var bill = appData.bills.find(function(b) { return b.id === billId; });
    if (!bill) return;
    var wasPaid = isBillPaid(bill, currentMonth);

    toggleBillPaid(billId, currentMonth);

    if (!wasPaid) {
        // Just marked as paid — add expense transaction
        appData.transactions.push({
            id: generateId(),
            type: 'expense',
            amount: parseFloat(bill.amount) || 0,
            categoryId: bill.categoryId || appData.expenseCategories[0].id,
            date: getToday(),
            note: bill.name + ' (Bill)',
            needWant: 'need',
            billId: billId
        });
        updateStreak();
    } else {
        // Unmarked as paid — remove the auto-created transaction
        appData.transactions = appData.transactions.filter(function(tx) {
            return !(tx.billId === billId && getMonthFromDate(tx.date) === currentMonth);
        });
    }

    saveData();
    renderBills();
}

// ===== BILL PANEL =====
function openBillPanel(billId) {
    editingBillId = billId || null;
    var panel = document.getElementById('billPanel');
    var overlay = document.getElementById('billPanelOverlay');
    var catSelect = document.getElementById('billCategory');

    catSelect.innerHTML = appData.expenseCategories.map(function(c) {
        return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join('');

    if (billId) {
        var bill = appData.bills.find(function(b) { return b.id === billId; });
        if (!bill) return;
        document.getElementById('billPanelTitle').textContent = 'Edit Bill';
        document.getElementById('billName').value = bill.name;
        document.getElementById('billAmount').value = bill.amount;
        document.getElementById('billDueDay').value = bill.dueDay || '';
        catSelect.value = bill.categoryId || appData.expenseCategories[0].id;
        document.getElementById('billNotes').value = bill.notes || '';
        document.getElementById('deleteBillBtn').classList.remove('hidden');
        currentBillType = bill.billType || 'recurring';
        updateBillTypeToggles();
        if (bill.billType === 'payable') {
            document.getElementById('billTotalOwed').value = bill.totalOwed || '';
            document.getElementById('billTotalPaid').value = bill.totalPaid || '';
        }
    } else {
        document.getElementById('billPanelTitle').textContent = 'Add Bill';
        document.getElementById('billName').value = '';
        document.getElementById('billAmount').value = '';
        document.getElementById('billDueDay').value = '';
        catSelect.value = appData.expenseCategories[0].id;
        document.getElementById('billNotes').value = '';
        document.getElementById('billTotalOwed').value = '';
        document.getElementById('billTotalPaid').value = '';
        document.getElementById('deleteBillBtn').classList.add('hidden');
        currentBillType = 'recurring';
        updateBillTypeToggles();
    }

    panel.classList.add('open');
    overlay.classList.add('open');
}

function closeBillPanel() {
    document.getElementById('billPanel').classList.remove('open');
    document.getElementById('billPanelOverlay').classList.remove('open');
    editingBillId = null;
}

function updateBillTypeToggles() {
    document.querySelectorAll('.bill-type-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.btype === currentBillType);
    });
    var payableFields = document.getElementById('payableFields');
    if (currentBillType === 'payable') {
        payableFields.classList.remove('hidden');
    } else {
        payableFields.classList.add('hidden');
    }
}

function saveBill() {
    var name = document.getElementById('billName').value.trim();
    if (!name) { alert('Enter a bill name.'); return; }
    var amount = parseFloat(document.getElementById('billAmount').value);
    if (!amount || amount <= 0) { alert('Enter a valid amount.'); return; }
    var dueDay = parseInt(document.getElementById('billDueDay').value) || 0;
    if (dueDay < 1 || dueDay > 31) { alert('Enter a valid due day (1-31).'); return; }

    var categoryId = parseInt(document.getElementById('billCategory').value);
    var notes = document.getElementById('billNotes').value.trim();
    var totalOwed = parseFloat(document.getElementById('billTotalOwed').value) || 0;
    var totalPaid = parseFloat(document.getElementById('billTotalPaid').value) || 0;

    if (editingBillId) {
        var bill = appData.bills.find(function(b) { return b.id === editingBillId; });
        if (bill) {
            bill.name = name;
            bill.amount = amount;
            bill.dueDay = dueDay;
            bill.categoryId = categoryId;
            bill.billType = currentBillType;
            bill.notes = notes;
            if (currentBillType === 'payable') {
                bill.totalOwed = totalOwed;
                bill.totalPaid = totalPaid;
            }
        }
    } else {
        var newBill = {
            id: generateId(),
            name: name,
            amount: amount,
            dueDay: dueDay,
            categoryId: categoryId,
            billType: currentBillType,
            monthCreated: currentMonth,
            notes: notes,
            paidMonths: []
        };
        if (currentBillType === 'payable') {
            newBill.totalOwed = totalOwed;
            newBill.totalPaid = totalPaid;
        }
        appData.bills.push(newBill);
    }

    saveData();
    closeBillPanel();
    renderBills();
}

function deleteBill() {
    if (!editingBillId) return;
    var bill = appData.bills.find(function(b) { return b.id === editingBillId; });
    showConfirm('Delete "' + bill.name + '"?', function() {
        appData.bills = appData.bills.filter(function(b) { return b.id !== editingBillId; });
        saveData();
        closeBillPanel();
        renderBills();
    });
}

// ===== INSIGHTS TAB — MAIN RENDER =====
function renderInsights() {
    renderInsightsPieChart();
    renderMonthComparison();
    renderNeedsWants();
    renderCategoryBudgets();
    renderMonthlyTrend();
    renderGoalsList();
}

// ===== INSIGHTS — PIE CHART =====
function renderInsightsPieChart() {
    var container = document.getElementById('insightsPieChart');
    var txs = getMonthTransactions(currentMonth).filter(function(tx) { return tx.type === 'expense'; });

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No expenses this month.</div></div>';
        return;
    }

    var catTotals = {};
    txs.forEach(function(tx) {
        var name = getCategoryName(tx.categoryId, 'expense');
        if (!catTotals[name]) catTotals[name] = 0;
        catTotals[name] += parseFloat(tx.amount) || 0;
    });

    var sorted = Object.entries(catTotals).sort(function(a, b) { return b[1] - a[1]; });
    var total = 0;
    sorted.forEach(function(s) { total += s[1]; });

    container.innerHTML = '<div class="pie-wrapper">' + buildPieSvg(sorted, total) +
        '<div class="pie-legend">' + buildPieLegend(sorted, total) + '</div></div>';
}

// ===== INSIGHTS — MONTH COMPARISON =====
function renderMonthComparison() {
    var el = document.getElementById('monthComparison');
    var prevMonth = shiftMonth(currentMonth, -1);
    var currentExp = getMonthExpenses(currentMonth);
    var prevExp = getMonthExpenses(prevMonth);

    if (prevExp === 0 && currentExp === 0) { el.classList.add('hidden'); return; }

    var diff = currentExp - prevExp;
    var isMore = diff > 0;
    var absDiff = Math.abs(diff);

    el.classList.remove('hidden');
    el.innerHTML = '<div class="comparison-amount ' + (isMore ? 'more' : 'less') + '">' +
        (isMore ? '+' : '-') + formatPeso(absDiff) + '</div>' +
        '<div class="comparison-text">' + (isMore ? 'more' : 'less') + ' spending vs ' + shortMonth(prevMonth) + '</div>';
}

// ===== INSIGHTS — NEEDS VS WANTS =====
function renderNeedsWants() {
    var container = document.getElementById('needsWantsChart');
    var txs = getMonthTransactions(currentMonth).filter(function(tx) { return tx.type === 'expense'; });

    if (txs.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No expenses this month.</div></div>';
        return;
    }

    var needs = 0;
    var wants = 0;
    txs.forEach(function(tx) {
        if (tx.needWant === 'want') wants += parseFloat(tx.amount) || 0;
        else needs += parseFloat(tx.amount) || 0;
    });

    var total = needs + wants;
    if (total === 0) { container.innerHTML = ''; return; }

    var needPct = Math.round((needs / total) * 100);
    var wantPct = 100 - needPct;

    container.innerHTML = '<div class="nw-bar-container">' +
        '<div class="nw-bar-need" style="width:' + needPct + '%"></div>' +
        '<div class="nw-bar-want" style="width:' + wantPct + '%"></div></div>' +
        '<div class="nw-legend">' +
            '<div class="nw-legend-item"><div class="nw-dot" style="background:#22c55e"></div>Needs: ' + formatPeso(needs) + ' (' + needPct + '%)</div>' +
            '<div class="nw-legend-item"><div class="nw-dot" style="background:#f59e0b"></div>Wants: ' + formatPeso(wants) + ' (' + wantPct + '%)</div>' +
        '</div>';
}

// ===== INSIGHTS — CATEGORY BUDGETS =====
function renderCategoryBudgets() {
    var container = document.getElementById('categoryBudgetList');
    var cats = appData.expenseCategories.filter(function(c) { return c.limit && c.limit > 0; });

    if (cats.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No budget limits set. Add limits in Settings.</div></div>';
        return;
    }

    container.innerHTML = cats.map(function(cat) {
        var spent = getCategorySpending(currentMonth, cat.id);
        var pct = Math.min(Math.round((spent / cat.limit) * 100), 100);
        var fillClass = pct >= 100 ? 'fill-danger' : pct >= 80 ? 'fill-warning' : 'fill-safe';

        return '<div class="cat-budget-card">' +
            '<div class="cat-budget-header">' +
                '<span class="cat-budget-name">' + cat.name + '</span>' +
                '<span class="cat-budget-amounts">' + formatPeso(spent) + ' / ' + formatPeso(cat.limit) + '</span>' +
            '</div>' +
            '<div class="cat-budget-bar"><div class="cat-budget-fill ' + fillClass + '" style="width:' + pct + '%"></div></div></div>';
    }).join('');
}

// ===== INSIGHTS — MONTHLY TREND =====
function renderMonthlyTrend() {
    var container = document.getElementById('monthlyTrend');
    var months = [];
    for (var i = 5; i >= 0; i--) { months.push(shiftMonth(currentMonth, -i)); }

    var maxVal = 0;
    var data = months.map(function(m) {
        var inc = (parseFloat(appData.monthlyBudget) || 0) + getMonthIncome(m);
        var exp = getMonthExpenses(m) + getMonthBillsTotal(m);
        if (inc > maxVal) maxVal = inc;
        if (exp > maxVal) maxVal = exp;
        return { month: m, income: inc, expense: exp };
    });

    if (maxVal === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No data yet.</div></div>';
        return;
    }

    container.innerHTML = '<div class="trend-bars">' +
        data.map(function(d) {
            var label = shortMonth(d.month);
            var incH = maxVal > 0 ? Math.max((d.income / maxVal) * 100, d.income > 0 ? 4 : 0) : 0;
            var expH = maxVal > 0 ? Math.max((d.expense / maxVal) * 100, d.expense > 0 ? 4 : 0) : 0;
            return '<div class="trend-bar-col">' +
                '<div class="trend-bar income-bar" style="height:' + incH + '%"></div>' +
                '<div class="trend-bar expense-bar" style="height:' + expH + '%"></div>' +
                '<span class="trend-bar-label">' + label + '</span></div>';
        }).join('') + '</div>' +
        '<div style="display:flex;justify-content:center;gap:16px;margin-top:10px;font-size:0.75rem;">' +
            '<span style="color:#22c55e;font-weight:600;">\u25A0 Budget</span>' +
            '<span style="color:#ef4444;font-weight:600;">\u25A0 Expenses + Bills</span></div>';
}

// ===== INSIGHTS — GOALS LIST =====
function renderGoalsList() {
    var container = document.getElementById('goalsList');

    if (appData.goals.length === 0) {
        container.innerHTML = '<div class="empty-state"><div class="empty-state-text">No savings goals yet.</div></div>';
        return;
    }

    container.innerHTML = appData.goals.map(function(g) {
        var target = parseFloat(g.target) || 1;
        var saved = parseFloat(g.saved) || 0;
        var pct = Math.min(Math.round((saved / target) * 100), 100);
        var alloc = parseFloat(g.allocation) || 0;
        var deadlineText = g.deadline ? 'Deadline: ' + formatMonth(g.deadline) : '';

        return '<div class="goal-card" onclick="openGoalPanel(\'' + g.id + '\')">' +
            '<div class="goal-header">' +
                '<span class="goal-name">' + g.name + '</span>' +
                '<span class="goal-pct">' + pct + '%</span>' +
            '</div>' +
            '<div class="goal-bar"><div class="goal-fill" style="width:' + pct + '%"></div></div>' +
            '<div class="goal-details">' +
                '<span>' + formatPeso(saved) + ' saved</span>' +
                '<span>' + formatPeso(target) + ' target</span>' +
            '</div>' +
            (alloc > 0 ? '<div class="goal-alloc">' + formatPeso(alloc) + '/month allocated</div>' : '') +
            (deadlineText ? '<div class="goal-deadline">' + deadlineText + '</div>' : '') +
            '</div>';
    }).join('');
}

// ===== GOAL PANEL =====
function openGoalPanel(goalId) {
    editingGoalId = goalId || null;
    var panel = document.getElementById('goalPanel');
    var overlay = document.getElementById('goalPanelOverlay');

    if (goalId) {
        var goal = appData.goals.find(function(g) { return g.id === goalId; });
        if (!goal) return;
        document.getElementById('goalPanelTitle').textContent = 'Edit Goal';
        document.getElementById('goalName').value = goal.name;
        document.getElementById('goalTarget').value = goal.target;
        document.getElementById('goalAllocation').value = goal.allocation || '';
        document.getElementById('goalSaved').value = goal.saved || 0;
        document.getElementById('goalDeadline').value = goal.deadline || '';
        document.getElementById('deleteGoalBtn').classList.remove('hidden');
    } else {
        document.getElementById('goalPanelTitle').textContent = 'Add Goal';
        document.getElementById('goalName').value = '';
        document.getElementById('goalTarget').value = '';
        document.getElementById('goalAllocation').value = '';
        document.getElementById('goalSaved').value = '0';
        document.getElementById('goalDeadline').value = '';
        document.getElementById('deleteGoalBtn').classList.add('hidden');
    }

    panel.classList.add('open');
    overlay.classList.add('open');
}

function closeGoalPanel() {
    document.getElementById('goalPanel').classList.remove('open');
    document.getElementById('goalPanelOverlay').classList.remove('open');
    editingGoalId = null;
}

function saveGoal() {
    var name = document.getElementById('goalName').value.trim();
    if (!name) { alert('Enter a goal name.'); return; }
    var target = parseFloat(document.getElementById('goalTarget').value);
    if (!target || target <= 0) { alert('Enter a valid target amount.'); return; }

    var allocation = parseFloat(document.getElementById('goalAllocation').value) || 0;
    var saved = parseFloat(document.getElementById('goalSaved').value) || 0;
    var deadline = document.getElementById('goalDeadline').value || '';

    if (editingGoalId) {
        var goal = appData.goals.find(function(g) { return g.id === editingGoalId; });
        if (goal) {
            goal.name = name;
            goal.target = target;
            goal.allocation = allocation;
            goal.saved = saved;
            goal.deadline = deadline;
        }
    } else {
        appData.goals.push({
            id: generateId(),
            name: name,
            target: target,
            allocation: allocation,
            saved: saved,
            deadline: deadline
        });
    }

    saveData();
    closeGoalPanel();
    renderInsights();
}

function deleteGoal() {
    if (!editingGoalId) return;
    var goal = appData.goals.find(function(g) { return g.id === editingGoalId; });
    showConfirm('Delete "' + goal.name + '"? Saved amount will be lost.', function() {
        appData.goals = appData.goals.filter(function(g) { return g.id !== editingGoalId; });
        saveData();
        closeGoalPanel();
        renderInsights();
    });
}

/* ============================================
   BUDGET BUDDY — app.js
   Part 4 of 4: Settings, Export/Import, Init
   ============================================ */

// ===== SETTINGS MODAL =====
function openSettings() {
    document.getElementById('budgetInput').value = appData.monthlyBudget || '';
    document.getElementById('paydayInput').value = appData.payday || 10;
    renderSettingsCategories();
    renderSettingsIncomeCategories();
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    var budget = parseFloat(document.getElementById('budgetInput').value);
    if (budget >= 0) appData.monthlyBudget = budget || 0;

    var payday = parseInt(document.getElementById('paydayInput').value);
    if (payday >= 1 && payday <= 31) appData.payday = payday;

    saveData();
    document.getElementById('settingsModal').classList.add('hidden');
    refreshCurrentTab();
}

// ===== SETTINGS — EXPENSE CATEGORIES =====
function renderSettingsCategories() {
    var container = document.getElementById('categoryList');
    container.innerHTML = appData.expenseCategories.map(function(c) {
        return '<div class="settings-type-item">' +
            '<input type="text" value="' + c.name + '" onchange="renameCat(' + c.id + ', this.value)">' +
            '<input type="number" placeholder="Limit" value="' + (c.limit || '') + '" onchange="setCatLimit(' + c.id + ', this.value)">' +
            '<button class="settings-type-delete" onclick="deleteCat(' + c.id + ')">&#10005;</button>' +
        '</div>';
    }).join('');
}

function renameCat(catId, newName) {
    var cat = appData.expenseCategories.find(function(c) { return c.id === catId; });
    if (cat) cat.name = newName.trim();
    saveData();
}

function setCatLimit(catId, value) {
    var cat = appData.expenseCategories.find(function(c) { return c.id === catId; });
    if (cat) cat.limit = parseFloat(value) || 0;
    saveData();
}

function addCat() {
    var maxId = 0;
    appData.expenseCategories.forEach(function(c) { if (c.id > maxId) maxId = c.id; });
    appData.expenseCategories.push({ id: maxId + 1, name: 'New Category', limit: 0 });
    saveData();
    renderSettingsCategories();
}

function deleteCat(catId) {
    if (appData.expenseCategories.length <= 1) { alert('Kailangan ng kahit isang category.'); return; }
    showConfirm('Delete this category?', function() {
        appData.expenseCategories = appData.expenseCategories.filter(function(c) { return c.id !== catId; });
        saveData();
        renderSettingsCategories();
    });
}

// ===== SETTINGS — INCOME CATEGORIES =====
function renderSettingsIncomeCategories() {
    var container = document.getElementById('incomeCategoryList');
    container.innerHTML = appData.incomeCategories.map(function(c) {
        return '<div class="settings-type-item">' +
            '<input type="text" value="' + c.name + '" onchange="renameIncomeCat(' + c.id + ', this.value)">' +
            '<button class="settings-type-delete" onclick="deleteIncomeCat(' + c.id + ')">&#10005;</button>' +
        '</div>';
    }).join('');
}

function renameIncomeCat(catId, newName) {
    var cat = appData.incomeCategories.find(function(c) { return c.id === catId; });
    if (cat) cat.name = newName.trim();
    saveData();
}

function addIncomeCat() {
    var maxId = 100;
    appData.incomeCategories.forEach(function(c) { if (c.id > maxId) maxId = c.id; });
    appData.incomeCategories.push({ id: maxId + 1, name: 'New Income' });
    saveData();
    renderSettingsIncomeCategories();
}

function deleteIncomeCat(catId) {
    if (appData.incomeCategories.length <= 1) { alert('Kailangan ng kahit isang income category.'); return; }
    showConfirm('Delete this income category?', function() {
        appData.incomeCategories = appData.incomeCategories.filter(function(c) { return c.id !== catId; });
        saveData();
        renderSettingsIncomeCategories();
    });
}

// ===== EXPORT — JSON BACKUP =====
function exportJson() {
    var dataStr = JSON.stringify(appData, null, 2);
    var blob = new Blob([dataStr], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'budget-buddy-backup-' + getToday() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ===== IMPORT — JSON RESTORE =====
function importJson() {
    document.getElementById('importFileInput').click();
}

function handleImportFile(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            var imported = JSON.parse(e.target.result);
            if (!imported.transactions || !Array.isArray(imported.transactions)) {
                alert('Invalid file: missing transactions data.');
                return;
            }

            showConfirm('Restore data from backup? This will replace all current data.', function() {
                appData = Object.assign({}, appData, imported);
                saveData();
                updateMonthDisplay();
                refreshCurrentTab();
            });
        } catch (err) {
            alert('Error reading file. Make sure it is a valid JSON backup.');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ===== MASTER INIT =====
function initApp() {
    loadData();
    updateMonthDisplay();

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });

    // Month navigation
    document.getElementById('monthPrev').addEventListener('click', function() {
        currentMonth = shiftMonth(currentMonth, -1);
        updateMonthDisplay();
        refreshCurrentTab();
    });
    document.getElementById('monthNext').addEventListener('click', function() {
        currentMonth = shiftMonth(currentMonth, 1);
        updateMonthDisplay();
        refreshCurrentTab();
    });
    document.getElementById('monthBtn').addEventListener('click', monthPick);

    // Balance card — tap to hide/show
    document.getElementById('balanceCard').addEventListener('click', toggleBalance);

    // Floating add button
    document.getElementById('fabBtn').addEventListener('click', function() { openQuickAdd(null); });

    // Quick-add panel
    document.getElementById('quickAddClose').addEventListener('click', closeQuickAdd);
    document.getElementById('quickAddOverlay').addEventListener('click', closeQuickAdd);
    document.getElementById('saveTxBtn').addEventListener('click', saveTransaction);
    document.getElementById('deleteTxBtn').addEventListener('click', deleteTransaction);

    // Type toggles (Expense / Income / Save)
    document.querySelectorAll('.type-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            quickAddType = btn.dataset.type;
            updateTypeToggles();
            if (quickAddType !== 'save') populateCategoryDropdown(quickAddType);
            updateQuickAddVisibility();
        });
    });

    // Need / Want toggles
    document.querySelectorAll('.need-want-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            quickAddNeedWant = btn.dataset.nw;
            updateNeedWantToggles();
        });
    });

    // Transaction filter buttons
    document.querySelectorAll('[data-tfilter]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-tfilter]').forEach(function(b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentTxFilter = btn.dataset.tfilter;
            renderTransactions();
        });
    });

    // Bills panel
    document.getElementById('addBillBtn').addEventListener('click', function() { openBillPanel(null); });
    document.getElementById('billPanelClose').addEventListener('click', closeBillPanel);
    document.getElementById('billPanelOverlay').addEventListener('click', closeBillPanel);
    document.getElementById('saveBillBtn').addEventListener('click', saveBill);
    document.getElementById('deleteBillBtn').addEventListener('click', deleteBill);

    // Bill type toggles
    document.querySelectorAll('.bill-type-btn').forEach(function(btn) {
        btn.addEventListener('click', function() {
            currentBillType = btn.dataset.btype;
            updateBillTypeToggles();
        });
    });

    // Goal panel
    document.getElementById('addGoalBtn').addEventListener('click', function() { openGoalPanel(null); });
    document.getElementById('goalPanelClose').addEventListener('click', closeGoalPanel);
    document.getElementById('goalPanelOverlay').addEventListener('click', closeGoalPanel);
    document.getElementById('saveGoalBtn').addEventListener('click', saveGoal);
    document.getElementById('deleteGoalBtn').addEventListener('click', deleteGoal);

    // Settings
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('settingsCloseBtn').addEventListener('click', closeSettings);
    document.getElementById('addCategoryBtn').addEventListener('click', addCat);
    document.getElementById('addIncomeCatBtn').addEventListener('click', addIncomeCat);

    // Export / Import
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);
    document.getElementById('importJsonBtn').addEventListener('click', importJson);
    document.getElementById('importFileInput').addEventListener('change', handleImportFile);

    // Confirm dialog
    document.getElementById('confirmYesBtn').addEventListener('click', function() {
        if (confirmCallback) confirmCallback();
        closeConfirm();
    });
    document.getElementById('confirmNoBtn').addEventListener('click', closeConfirm);

    // Initial render
    renderDashboard();
}

// ===== START =====
document.addEventListener('DOMContentLoaded', initApp);