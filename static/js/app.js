/*
 * 工作排班系統 - 前端應用程式
 * 極速版本：預先渲染所有月份，CSS toggle 切換
 */

const API_BASE = '/api';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentUser = null;
let pendingChanges = []; // 待存的改動

// 全年數據緩存
const yearCache = {}; // { "2026-4": { data, rendered } }

// 是否已初始化全年
let yearInitialized = false;

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
            loadFullYear();
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
            loadFullYear();
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

// ===== 全年預載入 =====
async function loadFullYear() {
    // Step 1: 先顯示當前月（立即可用）
    await loadCurrentMonthFirst();

    // Step 2: Background 載入其他月份
    setTimeout(() => preloadYearInBackground(), 0);
}

async function loadCurrentMonthFirst() {
    const key = `${currentYear}-${currentMonth}`;

    // 如果已 cache，直接顯示，唔使 loading
    if (yearCache[key] && yearCache[key].data) {
        showMonth(currentYear, currentMonth);
        setTimeout(() => preloadYearInBackground(), 0);
        return;
    }

    // 未 cache，先顯示 loading
    document.getElementById('month-view').innerHTML = '<div class="loading">載入中...</div>';

    try {
        await fetchMonthData(currentYear, currentMonth);
        showMonth(currentYear, currentMonth);
        setTimeout(() => preloadYearInBackground(), 0);
    } catch (e) {
        showToast('載入失敗，請重新整理', 'error');
    }
}

async function preloadYearInBackground() {
    const promises = [];
    for (let m = 1; m <= 12; m++) {
        if (m === currentMonth) continue; // 已載入
        promises.push(fetchMonthData(currentYear, m).catch(() => {}));
    }
    await Promise.all(promises);
    console.log('全年數據預載完成');
}

async function fetchMonthData(year, month) {
    const key = `${year}-${month}`;
    if (yearCache[key] && yearCache[key].data) {
        return yearCache[key].data;
    }

    const res = await fetch(`${API_BASE}/calendar/${year}/${month}`);
    if (!res.ok) throw new Error(`Failed to fetch ${year}-${month}`);

    const data = await res.json();
    yearCache[key] = { data, rendered: false };
    return data;
}

// ===== 顯示指定月份 - 極速切換 =====
function showMonth(year, month) {
    const key = `${year}-${month}`;
    const cached = yearCache[key];

    if (!cached || !cached.data) {
        // 理論上唔會發生，但以防萬一
        loadFullYear();
        return;
    }

    // 更新 title 和 stats
    document.getElementById('calendar-title').textContent = `${year}年${month}月`;
    document.getElementById('stat-work').textContent = cached.data.work_days;
    document.getElementById('stat-off').textContent = cached.data.off_days;

    // 隱藏所有月份
    document.querySelectorAll('.month-calendar').forEach(el => {
        el.style.display = 'none';
    });

    // 顯示當前月份，如果未渲染就先渲染
    let monthEl = document.getElementById(`month-${year}-${month}`);
    if (!monthEl) {
        monthEl = renderMonthCalendar(year, month, cached.data);
        document.getElementById('month-view').appendChild(monthEl);
    }

    monthEl.style.display = 'grid';
    cached.rendered = true;

    // 清除pending
    pendingChanges = [];
    updateSaveButton();
}

// ===== 渲染單個月份日曆 =====
function renderMonthCalendar(year, month, data) {
    const container = document.createElement('div');
    container.id = `month-${year}-${month}`;
    container.className = 'month-calendar';
    container.style.display = 'none';

    const fragment = document.createDocumentFragment();

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
        fragment.appendChild(empty);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d of data.days) {
        if (d.day === null) continue;

        const el = document.createElement('div');
        el.className = `calendar-day ${d.status}`;
        el.dataset.date = d.date;
        el.dataset.status = d.status;
        el.dataset.year = year;
        el.dataset.month = month;
        el.dataset.day = d.day;

        if (d.date === today.toISOString().split('T')[0]) {
            el.classList.add('today');
        }

        el.innerHTML = `
            <span>${d.day}</span>
            ${d.label ? `<span class="day-label">${d.label}</span>` : ''}
        `;

        el.addEventListener('click', () => handleDayClick(el));
        fragment.appendChild(el);
    }

    container.appendChild(fragment);
    return container;
}

// ===== 點擊處理 =====
function handleDayClick(el) {
    const status = el.dataset.status;
    const date = el.dataset.date;
    const year = parseInt(el.dataset.year);
    const month = parseInt(el.dataset.month);
    const day = parseInt(el.dataset.day);

    if (status === 'empty') {
        // 空白 → 放假
        el.className = 'calendar-day off';
        el.dataset.status = 'off';
        el.querySelector('.day-label')?.remove();
        el.insertAdjacentHTML('beforeend', '<span class="day-label">放假</span>');
        pendingChanges.push({ date, action: 'add', leave_type: 'off', day, year, month });
        updateStatsLocal(1, -1);
    } else if (status === 'off') {
        // 放假 → 彈出選擇
        openLeaveModal({ date, day, year, month }, el);
    } else {
        // 請假 → 取消
        el.className = 'calendar-day empty';
        el.dataset.status = 'empty';
        el.querySelector('.day-label')?.remove();
        const reason = status === 'leave_annual' ? '年假' : '補假';
        pendingChanges.push({ date, action: 'remove', day, year, month });
        updateStatsLocal(-1, 1);
    }

    updateSaveButton();
}

function updateSaveButton() {
    const btn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    if (pendingChanges.length > 0) {
        btn.style.display = 'block';
        btn.textContent = `儲存改動 (${pendingChanges.length})`;
        cancelBtn.style.display = 'block';
    } else {
        btn.style.display = 'none';
        cancelBtn.style.display = 'none';
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
    el.querySelector('.day-label')?.remove();
    el.insertAdjacentHTML('beforeend', `<span class="day-label">${label}</span>`);

    // 更新 pendingChanges
    pendingChanges = pendingChanges.filter(c => !(c.date === d.date && c.action === 'add'));
    pendingChanges.push({ date: d.date, action: 'add', leave_type: leaveType, day: d.day, year: d.year, month: d.month });

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

            // 清除受影響月份的 cache，強制重新 fetch
            const affectedMonths = new Set();
            pendingChanges.length > 0; // 這行無意義，保留用於結構
            for (const c of (arguments[0] || [])) {
                affectedMonths.add(`${c.year}-${c.month}`);
            }
            // 重新 fetch 受影響的月份
            await Promise.all([...affectedMonths].map(async (key) => {
                delete yearCache[key];
                const [y, m] = key.split('-').map(Number);
                const data = await fetchMonthData(y, m);
                // 更新已渲染的月份
                const monthEl = document.getElementById(`month-${y}-${m}`);
                if (monthEl) {
                    monthEl.remove(); // 移除舊的，下次顯示會重新渲染
                }
            }));

            // 重新顯示當前月份
            showMonth(currentYear, currentMonth);
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

function cancelChanges() {
    if (pendingChanges.length === 0) return;
    if (!confirm('確定要取消所有改動嗎？')) return;
    pendingChanges = [];
    updateSaveButton();
    // 重新渲染當前月份
    const key = `${currentYear}-${currentMonth}`;
    const monthEl = document.getElementById(`month-${currentYear}-${currentMonth}`);
    if (monthEl) {
        monthEl.remove();
        delete yearCache[key];
        fetchMonthData(currentYear, currentMonth).then(data => {
            const newEl = renderMonthCalendar(currentYear, currentMonth, data);
            document.getElementById('month-view').appendChild(newEl);
            newEl.style.display = 'grid';
        });
    }
}

// ===== 月份切換 - 極速 =====
function changeMonth(delta) {
    if (pendingChanges.length > 0) {
        if (!confirm('有未儲存的改動，確定要切換月份嗎？')) return;
    }

    currentMonth += delta;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
        // 新年度需要 fetch
        for (let m = 1; m <= 12; m++) {
            fetchMonthData(currentYear, m).catch(() => {});
        }
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
        for (let m = 1; m <= 12; m++) {
            fetchMonthData(currentYear, m).catch(() => {});
        }
    }

    showMonth(currentYear, currentMonth);
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
