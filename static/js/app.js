/*
 * 工作排班系統 - 前端應用程式
 * 極致優化版：極速響應 + 優秀觸控體驗
 */

const API_BASE = '/api';
const STORAGE_KEY = 'work-schedule-cache';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth() + 1;
let currentUser = null;
let pendingChanges = [];
let isLoading = false;
const yearCache = {};

// ===== LocalStorage 持久化緩存（每用戶分開） =====
function getStorageKey() {
    return STORAGE_KEY + '-' + (currentUser?.id || 'guest');
}

function saveCacheToStorage() {
    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(yearCache));
    } catch (e) {}
}

function loadCacheFromStorage() {
    try {
        const key = getStorageKey();
        const cached = localStorage.getItem(key);
        if (cached) {
            Object.assign(yearCache, JSON.parse(cached));
            return true;
        }
    } catch (e) {}
    return false;
}

// ===== 初始化 =====
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
        // 如果失敗，仍然顯示app但提示需要登入
        showApp('訪客');
        loadCalendar();
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

// ===== 主載入流程 =====
async function loadCalendar() {
    // Step 1: 嘗試從 localStorage 恢復緩存（瞬間）
    if (loadCacheFromStorage()) {
        const key = `${currentYear}-${currentMonth}`;
        if (yearCache[key]) {
            renderMonth(key);
            updateHeaderStats(yearCache[key].data);
            preloadBackground();
            return;
        }
    }

    // Step 2: 顯示 Skeleton UI，並行載入
    showSkeleton();

    try {
        await Promise.all([
            fetchMonthData(currentYear, currentMonth),
            ...getBackgroundMonths().map(([y, m]) => fetchMonthData(y, m))
        ]);

        saveCacheToStorage();
        renderMonth(`${currentYear}-${currentMonth}`);
        updateHeaderStats(yearCache[`${currentYear}-${currentMonth}`].data);
        preloadBackground();
    } catch (e) {
        console.error('Load failed:', e);
        document.getElementById('month-view').innerHTML = `
            <div class="loading" style="padding:60px;text-align:center;color:#888;">
                <div style="font-size:48px;margin-bottom:16px;">😵</div>
                <div>載入失敗</div>
                <div style="font-size:12px;margin-top:8px;">請檢查網絡或重新整理</div>
            </div>
        `;
    }
}

function getBackgroundMonths() {
    const months = [];
    for (let m = 1; m <= 12; m++) {
        if (m !== currentMonth) months.push([currentYear, m]);
    }
    // 預判：如果是12月，順便預載下年1月
    if (currentMonth === 12) {
        months.push([currentYear + 1, 1]);
    }
    return months;
}

// ===== Skeleton UI =====
function showSkeleton() {
    const days = [];
    for (let i = 0; i < 42; i++) {
        days.push('<div class="skeleton-day"></div>');
    }

    document.getElementById('month-view').innerHTML = `
        <div class="month-calendar skeleton">
            <div class="skeleton-weekdays">
                <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div class="skeleton-grid">${days.join('')}</div>
        </div>
    `;
}

// ===== 顯示月份 =====
function renderMonth(key) {
    const [year, month] = key.split('-').map(Number);
    const cached = yearCache[key];
    if (!cached || !cached.data) return;

    const data = cached.data;

    // 構建月份 HTML
    let html = `
        <div class="month-calendar" id="month-${key}">
            <div class="calendar-weekdays">
                <div>日</div><div>一</div><div>二</div><div>三</div><div>四</div><div>五</div><div>六</div>
            </div>
            <div class="calendar-grid">
    `;

    // 計算空白格
    let emptyCount = 0;
    for (let d of data.days) {
        if (d.day === null) { emptyCount++; }
        else { break; }
    }

    for (let i = 0; i < emptyCount; i++) {
        html += '<div class="calendar-day padding-cell"></div>';
    }

    // 使用伺服器返回的今日日期（避免時區問題）
    const todayStr = data.today;

    for (let d of data.days) {
        if (d.day === null) continue;
        const isToday = d.date === todayStr;
        const classes = [
            'calendar-day',
            d.status,
            isToday ? 'today' : ''
        ].filter(Boolean).join(' ');

        html += `
            <div class="${classes}"
                 data-date="${d.date}"
                 data-status="${d.status}"
                 data-year="${year}"
                 data-month="${month}"
                 data-day="${d.day}">
                <span>${d.day}</span>
                ${d.label ? `<span class="day-label">${d.label}</span>` : ''}
            </div>
        `;
    }

    html += '</div></div>';
    document.getElementById('month-view').innerHTML = html;
}

function updateHeaderStats(data) {
    document.getElementById('calendar-title').textContent = `${data.year}年${data.month}月`;
    animateNumber('stat-work', data.work_days);
    animateNumber('stat-off', data.off_days);
}

function animateNumber(id, target) {
    const el = document.getElementById(id);
    const current = parseInt(el.textContent) || 0;
    const diff = target - current;
    if (diff === 0) return;

    const duration = 300;
    const steps = Math.abs(diff);
    const stepTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
        step++;
        el.textContent = current + (diff > 0 ? step : -step);
        if (step >= steps) {
            clearInterval(timer);
            el.textContent = target;
        }
    }, stepTime);
}

// ===== 數據獲取 =====
async function fetchMonthData(year, month) {
    const key = `${year}-${month}`;
    if (yearCache[key] && yearCache[key].data) {
        return yearCache[key].data;
    }

    const res = await fetch(`${API_BASE}/calendar/${year}/${month}`);
    if (!res.ok) throw new Error(`Failed to fetch ${key}`);

    const data = await res.json();
    yearCache[key] = { data, rendered: false };
    return data;
}

function preloadBackground() {
    setTimeout(() => {
        getBackgroundMonths().forEach(([y, m]) => {
            fetchMonthData(y, m).then(data => {
                // 悄悄 render 並緩存，不打擾主流程
            }).catch(() => {});
        });
    }, 100);
}

// ===== 觸控處理 - 即時反饋 =====
document.addEventListener('DOMContentLoaded', () => {
    // 使用事件委託處理所有點擊
    const monthView = document.getElementById('month-view');
    if (monthView) {
        monthView.addEventListener('click', handleDayClick);
    }

    // 導航按鈕
    const prevBtn = document.querySelector('.btn-nav.prev');
    const nextBtn = document.querySelector('.btn-nav.next');
});

function handleDayClick(e) {
    const dayEl = e.target.closest('.calendar-day');
    if (!dayEl || dayEl.classList.contains('padding-cell')) return;

    // 即時視覺反饋 - 用 CSS 先給予狀態變化
    dayEl.classList.add('pressed');

    const status = dayEl.dataset.status;
    const date = dayEl.dataset.date;
    const year = parseInt(dayEl.dataset.year);
    const month = parseInt(dayEl.dataset.month);
    const day = parseInt(dayEl.dataset.day);

    if (status === 'empty') {
        applyDayState(dayEl, 'off', '放假');
        pendingChanges.push({ date, action: 'add', leave_type: 'off', day, year, month });
        animateStats(1, -1);
    } else if (status === 'off') {
        openLeaveModal({ date, day, year, month }, dayEl);
        dayEl.classList.remove('pressed');
    } else {
        applyDayState(dayEl, 'empty', null);
        pendingChanges.push({ date, action: 'remove', day, year, month });
        animateStats(-1, 1);
    }

    updateSaveButton();
}

function applyDayState(el, status, label) {
    el.className = `calendar-day ${status}`;
    el.dataset.status = status;
    const labelEl = el.querySelector('.day-label');
    if (label) {
        if (labelEl) labelEl.textContent = label;
        else el.insertAdjacentHTML('beforeend', `<span class="day-label">${label}</span>`);
    } else {
        labelEl?.remove();
    }
}

function animateStats(offDelta, workDelta) {
    const statOff = document.getElementById('stat-off');
    const statWork = document.getElementById('stat-work');
    const offVal = Math.max(0, parseInt(statOff.textContent) + offDelta);
    const workVal = Math.max(0, parseInt(statWork.textContent) + workDelta);

    animateNumber('stat-off', offVal);
    animateNumber('stat-work', workVal);
}

// ===== 月份切換 =====
function changeMonth(delta) {
    if (pendingChanges.length > 0) {
        if (!confirm('有未儲存的改動，確定要切換月份嗎？')) return;
    }

    currentMonth += delta;
    let needFullLoad = false;

    if (currentMonth > 12) {
        currentMonth = 1;
        currentYear++;
        needFullLoad = true;
    } else if (currentMonth < 1) {
        currentMonth = 12;
        currentYear--;
        needFullLoad = true;
    }

    if (needFullLoad) {
        loadCalendar();
    } else {
        const key = `${currentYear}-${currentMonth}`;
        if (yearCache[key]) {
            renderMonth(key);
            updateHeaderStats(yearCache[key].data);
        } else {
            showSkeleton();
            fetchMonthData(currentYear, currentMonth).then(data => {
                renderMonth(key);
                updateHeaderStats(data);
            });
        }
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
    pendingLeaveEl?.classList.remove('pressed');
    pendingLeaveEl = null;
    pendingLeaveDate = null;
}

function selectLeave(leaveType) {
    const d = pendingLeaveDate;
    const el = pendingLeaveEl;
    const label = leaveType === 'leave_annual' ? '年假' : '補假';

    applyDayState(el, leaveType, label);
    el.classList.remove('pressed');

    pendingChanges = pendingChanges.filter(c => !(c.date === d.date && c.action === 'add'));
    pendingChanges.push({ date: d.date, action: 'add', leave_type: leaveType, day: d.day, year: d.year, month: d.month });

    updateSaveButton();
    closeLeaveModal();
}

function cancelDayOff() {
    const d = pendingLeaveDate;
    const el = pendingLeaveEl;

    applyDayState(el, 'empty', null);
    el.classList.remove('pressed');

    pendingChanges = pendingChanges.filter(c => !(c.date === d.date && c.action === 'add'));
    pendingChanges.push({ date: d.date, action: 'remove', day: d.day, year: d.year, month: d.month });

    animateStats(-1, 1);
    updateSaveButton();
    closeLeaveModal();
}

// ===== 儲存按鈕 =====
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

async function saveChanges() {
    if (pendingChanges.length === 0) return;

    const btn = document.getElementById('save-btn');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    const changesToSave = [...pendingChanges];

    try {
        const res = await fetch(`${API_BASE}/days-off/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ changes: changesToSave })
        });

        if (res.ok) {
            showToast('已儲存', 'success');

            // 更新本地緩存
            for (const c of changesToSave) {
                const key = `${c.year}-${c.month}`;
                if (yearCache[key] && yearCache[key].data) {
                    const dayData = yearCache[key].data.days.find(d => d.date === c.date);
                    if (dayData) {
                        if (c.action === 'add') {
                            dayData.status = c.leave_type;
                            if (c.leave_type === 'leave_annual') {
                                dayData.label = '年假';
                            } else if (c.leave_type === 'leave_compensatory') {
                                dayData.label = '補假';
                            } else {
                                dayData.label = '放假';
                            }
                        } else {
                            dayData.status = 'empty';
                            dayData.label = '';
                        }
                    }
                }
            }

            saveCacheToStorage();
            pendingChanges = [];
            updateSaveButton();

            // 重新渲染當前月
            const key = `${currentYear}-${currentMonth}`;
            renderMonth(key);
            updateHeaderStats(yearCache[key].data);
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

    // 重新渲染以恢復原始狀態
    const key = `${currentYear}-${currentMonth}`;
    renderMonth(key);
    updateHeaderStats(yearCache[key].data);
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
