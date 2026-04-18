/*
 * 工作排班系統 - 前端應用程式
 */

const API_BASE = '/api';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentUser = null;

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
    await loadSummary();
    await loadMonth(currentYear, currentMonth);
}

async function loadMonth(year, month) {
    const res = await fetch(`${API_BASE}/calendar/${year}/${month}`);
    const data = await res.json();

    document.getElementById('calendar-title').textContent = `${year}年${month}月`;

    const grid = document.getElementById('calendar-grid');
    grid.innerHTML = '';

    // 找出第一個有效日前的空白格
    const firstDayData = data.days[0];
    // calendar.firstweekday = 6 (週日開始), 所以第一個是空白的話 day 是 0
    // 計算空白格數量
    let emptyCount = 0;
    for (let d of data.days) {
        if (d.day === null) {
            emptyCount++;
        } else {
            break;
        }
    }

    // 週日開始，所以空白要喺前面
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

        if (d.date === today.toISOString().split('T')[0]) {
            el.classList.add('today');
        }

        el.innerHTML = `
            <span>${d.day}</span>
            ${d.label ? `<span class="day-label">${d.label}</span>` : ''}
        `;

        el.addEventListener('click', () => toggleDay(d));
        grid.appendChild(el);
    }
}

async function toggleDay(d) {
    const isUserOff = d.status === 'user_off';

    if (isUserOff) {
        // 刪除
        if (!confirm(`取消 ${d.day}日 的放假標記？`)) return;
        try {
            const res = await fetch(`${API_BASE}/days-off/${d.date}`, { method: 'DELETE' });
            if (res.ok) {
                showToast('已取消', 'success');
                loadCalendar();
            }
        } catch (e) {
            showToast('刪除失敗', 'error');
        }
    } else {
        // 新增
        try {
            const res = await fetch(`${API_BASE}/days-off`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ date: d.date })
            });
            if (res.ok) {
                showToast(`${d.day}日已標記為放假`, 'success');
                loadCalendar();
            } else {
                const err = await res.json();
                showToast(err.error || '設置失敗', 'error');
            }
        } catch (e) {
            showToast('網絡錯誤', 'error');
        }
    }
}

function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
    }
    loadSummary();
    loadMonth(currentYear, currentMonth);
}

// ===== 統計 =====
async function loadSummary() {
    const res = await fetch(`${API_BASE}/summary/${currentYear}/${currentMonth}`);
    const data = await res.json();

    document.getElementById('stat-work').textContent = data.work_days;
    document.getElementById('stat-off').textContent = data.user_off_days;
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
