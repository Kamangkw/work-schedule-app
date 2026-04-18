/*
 * 工作排班系統 - 前端應用程式
 */

const API_BASE = '/api';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentUser = null;
let originalData = []; // 初始數據快照
let pendingChanges = []; // 待存的改動

document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    document.getElementById('login-form').addEventListener('submit', handleLogin);
});

// ===== 登入 =====
async function checkLoginStatus() {
    try {
        const res = await fetch(`${API_BASE}/current-user`);
        const data = await res.json();
        if (data) {
            currentUser = data;
            showApp(data.name);
            loadCalendar();
        }
    } catch (e) {
        console.error('Login check failed', e);
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const name = document.getElementById('login-name').value.trim();
    if (!name) return;

    const btn = e.target.querySelector('button');
    setLoading(btn, true);

    try {
        const res = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (res.ok) {
            currentUser = data;
            showApp(data.name);
            loadCalendar();
        } else {
            showToast(data.error || '登入失敗', 'error');
        }
    } catch (e) {
        showToast('網絡錯誤', 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function logout() {
    try {
        await fetch('/logout', { method: 'POST' });
        location.reload();
    } catch (e) {
        console.error(e);
    }
}

function showApp(name) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    document.getElementById('user-name-display').textContent = name;
}

// ===== 日曆 =====
async function loadCalendar() {
    pendingChanges = [];
    updateSaveButton();
    await loadMonth(currentYear, currentMonth);
}

async function loadMonth(year, month) {
    const res = await fetch(`${API_BASE}/calendar/${year}/${month}`);
    const data = await res.json();

    document.getElementById('calendar-title').textContent = `${year}年${month}月`;
    document.getElementById('stat-work').textContent = data.work_days;
    document.getElementById('stat-off').textContent = data.off_days;

    // 保存初始快照
    originalData = data.days.map(d => ({...d}));

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // 計算空白格
    let emptyCount = 0;
    for (let d of data.days) {
        if (d.day === null) {
            emptyCount++;
        } else {
            break;
        }
    }

    for (let i = 0; i < emptyCount; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        grid.appendChild(empty);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d of data.days) {
        if (d.day === null) continue;

        const el = document.createElement('div');
        el.className = `calendar-day ${d.status}`;
        el.dataset.date = d.date;
        el.dataset.status = d.status;

        if (d.date === today.toISOString().split('T')[0]) {
            el.classList.add('today');
        }

        el.innerHTML = `
            <span>${d.day}</span>
            ${d.label ? `<span class="day-label">${d.label}</span>` : ''}
        `;

        el.addEventListener('click', () => handleDayClick(d, el));
        grid.appendChild(el);
    }
}

// ===== 點擊處理 - Optimistic UI =====
function handleDayClick(d, el) {
    const status = d.status;

    if (status === 'empty') {
        // 空白 → 放假
        el.className = 'calendar-day off';
        el.dataset.status = 'off';
        el.innerHTML = `<span>${d.day}</span><span class="day-label">放假</span>`;
        pendingChanges.push({ date: d.date, action: 'add', leave_type: 'off', day: d.day });
        updateStatsLocal(1, -1);
    } else if (status === 'off') {
        // 放假 → 彈出選擇
        openLeaveModal(d, el);
    } else {
        // 請假 → 取消
        el.className = 'calendar-day empty';
        el.dataset.status = 'empty';
        el.innerHTML = `<span>${d.day}</span>`;
        pendingChanges.push({ date: d.date, action: 'remove', day: d.day });
        updateStatsLocal(-1, 1);
    }

    updateSaveButton();
}

function updateSaveButton() {
    const btn = document.getElementById('save-btn');
    if (pendingChanges.length > 0) {
        btn.style.display = 'inline-block';
        btn.textContent = `儲存改動 (${pendingChanges.length})`;
    } else {
        btn.style.display = 'none';
    }
}

// ===== 請假選擇 =====
let pendingLeaveEl = null;
let pendingLeaveDate = null;

function openLeaveModal(d, el) {
    pendingLeaveEl = el;
    pendingLeaveDate = d;
    document.getElementById('modal-date').textContent = `${d.day}日`;
    document.getElementById('leave-modal').style.display = 'flex';
}

function closeLeaveModal() {
    document.getElementById('leave-modal').style.display = 'none';
    pendingLeaveEl = null;
    pendingLeaveDate = null;
}

function selectLeave(leaveType) {
    const d = pendingLeaveDate;
    const el = pendingLeaveEl;
    const label = leaveType === 'leave_annual' ? '年假' : '補假';

    el.className = `calendar-day ${leaveType}`;
    el.dataset.status = leaveType;
    el.innerHTML = `<span>${d.day}</span><span class="day-label">${label}</span>`;

    // 從 pendingChanges 移除之前可能的 add/off，改為 add/leave_type
    pendingChanges = pendingChanges.filter(c => !(c.date === d.date && c.action === 'add' && c.leave_type === 'off'));
    pendingChanges.push({ date: d.date, action: 'add', leave_type: leaveType, day: d.day });

    updateSaveButton();
    closeLeaveModal();
}

// ===== 批次儲存 =====
async function saveChanges() {
    if (pendingChanges.length === 0) return;

    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        const res = await fetch(`${API_BASE}/days-off/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: pendingChanges })
        });

        if (res.ok) {
            showToast('已儲存', 'success');
            pendingChanges = [];
            updateSaveButton();
            // 重新載入以確保同步
            await loadMonth(currentYear, currentMonth);
        } else {
            const err = await res.json();
            showToast(err.error || '儲存失敗', 'error');
        }
    } catch (e) {
        showToast('網絡錯誤', 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = `儲存改動 (${pendingChanges.length})`;
    }
}

// ===== 月份切換 =====
function changeMonth(delta) {
    if (pendingChanges.length > 0) {
        if (!confirm('有未儲存的改動，確定要切換月份嗎？')) return;
    }
    currentMonth += delta;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    loadMonth(currentYear, currentMonth);
}

// ===== 本地統計更新 =====
function updateStatsLocal(offDelta, workDelta) {
    const statOff = document.getElementById('stat-off');
    const statWork = document.getElementById('stat-work');
    statOff.textContent = Math.max(0, parseInt(statOff.textContent) + offDelta);
    statWork.textContent = Math.max(0, parseInt(statWork.textContent) + workDelta);
}

// ===== 工具 =====
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function setLoading(btn, loading) {
    if (loading) {
        btn.disabled = true;
        btn.dataset.original = btn.textContent;
        btn.textContent = '載入中...';
    } else {
        btn.disabled = false;
        btn.textContent = btn.dataset.original || btn.textContent;
    }
}
