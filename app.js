window.toggleMobileNav = () => {
    const menu = document.getElementById('navMenu');
    const overlay = document.getElementById('navOverlay');
    const btn = document.getElementById('navToggleBtn');
    if (!menu) return;
    const isOpen = menu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', isOpen);
    if (btn) btn.setAttribute('aria-expanded', String(isOpen));
};

window.capitalizeNameInput = (event) => {
    const input = event.target;
    const cursorPos = input.selectionStart;
    const original = input.value;
    const fixed = original.replace(/(^|[\s-])([a-z])/g, (match, sep, letter) => sep + letter.toUpperCase());
    if (fixed !== original) {
        input.value = fixed;
        if (cursorPos !== null) input.setSelectionRange(cursorPos, cursorPos);
    }
};


// ═══════════════════════════════════════════════════════════════
//  التحقق من صحة المدخلات (Data Validation)
// ═══════════════════════════════════════════════════════════════
const VALIDATION = {
    NATIONAL_ID_LENGTH: 8,          // الرقم المدني: 8 أرقام (غيّر الرقم لو احتجت)
    PHONE_COUNTRY_CODE: '968',      // سلطنة عُمان
    PHONE_PREFIXES: '279'           // أول رقم في الهاتف العُماني: 7 / 9 جوال، 2 أرضي
};

const toLatinDigits = (s) => String(s ?? '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const cleanLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const vOk = (value) => ({ ok: true, value });
const vFail = (error) => ({ ok: false, error });

const V = {
    name(raw, { minWords = 3, label = 'الاسم' } = {}) {
        const v = cleanLine(raw);
        if (!v) return vFail(`${label} مطلوب.`);
        if (v.length < 3) return vFail(`${label} قصير جداً.`);
        if (v.length > 80) return vFail(`${label} يجب ألا يزيد عن 80 حرفاً.`);
        if (!/^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u.test(v)) return vFail(`${label} يجب أن يحتوي على حروف فقط (بدون أرقام أو رموز).`);
        if (v.split(' ').length < minWords) {
            return vFail(minWords === 3 ? `يرجى كتابة ${label} ثلاثياً (ثلاث كلمات على الأقل).` : `يرجى كتابة ${label} كاملاً.`);
        }
        return vOk(v);
    },
    nationalId(raw) {
        const v = toLatinDigits(raw).replace(/[\s-]/g, '');
        if (!v) return vFail('الرقم المدني مطلوب.');
        if (!/^\d+$/.test(v)) return vFail('الرقم المدني يجب أن يحتوي على أرقام فقط.');
        if (v.length !== VALIDATION.NATIONAL_ID_LENGTH) return vFail(`الرقم المدني يجب أن يتكون من ${VALIDATION.NATIONAL_ID_LENGTH} أرقام.`);
        return vOk(v);
    },
    phone(raw, { required = true } = {}) {
        let v = toLatinDigits(raw).replace(/[\s\-()]/g, '');
        if (!v) return required ? vFail('رقم الهاتف مطلوب.') : vOk('');
        const cc = VALIDATION.PHONE_COUNTRY_CODE;
        if (v.startsWith('+') && !v.startsWith('+' + cc)) return vFail('يُقبل رقم هاتف عُماني فقط (+968).');
        v = v.replace(new RegExp(`^(\\+|00)?${cc}`), '');
        if (!/^\d+$/.test(v)) return vFail('رقم الهاتف يجب أن يحتوي على أرقام فقط.');
        if (!new RegExp(`^[${VALIDATION.PHONE_PREFIXES}]\\d{7}$`).test(v)) return vFail('رقم الهاتف غير صحيح، يجب أن يكون 8 أرقام ويبدأ بـ 7 أو 9 (مثال: 9xxxxxxx).');
        return vOk(`+${cc} ${v}`);
    },
    email(raw) {
        const v = String(raw ?? '').trim().toLowerCase();
        if (!v) return vFail('البريد الإلكتروني مطلوب.');
        if (v.length > 200) return vFail('البريد الإلكتروني طويل جداً.');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return vFail('صيغة البريد الإلكتروني غير صحيحة.');
        return vOk(v);
    },
    text(raw, { label, min = 1, max = 200, multiline = false, required = true } = {}) {
        const v = multiline ? String(raw ?? '').replace(/\n{3,}/g, '\n\n').trim() : cleanLine(raw);
        if (!v) return required ? vFail(`${label} مطلوب.`) : vOk('');
        if (v.length < min) return vFail(`${label} قصير جداً (الحد الأدنى ${min} أحرف).`);
        if (v.length > max) return vFail(`${label} طويل جداً (الحد الأقصى ${max} حرفاً).`);
        return vOk(v);
    },
    url(raw, { label = 'الرابط', max = 500 } = {}) {
        const v = String(raw ?? '').trim();
        if (!v) return vFail(`${label} مطلوب.`);
        if (v.length > max) return vFail(`${label} طويل جداً.`);
        let u;
        try { u = new URL(v); } catch (_) { return vFail(`${label} غير صحيح.`); }
        if (u.protocol !== 'https:') return vFail(`${label} يجب أن يبدأ بـ https://`);
        if (!u.hostname.includes('.')) return vFail(`${label} غير صحيح.`);
        return vOk(u.href);
    },
    oneOf(raw, allowed, label) {
        return allowed.includes(raw) ? vOk(raw) : vFail(`يرجى اختيار ${label}.`);
    }
};

function clearFieldError(el) {
    if (!el) return;
    el.classList.remove('input-invalid');
    const next = el.nextElementSibling;
    if (next && next.classList.contains('field-error')) next.remove();
}

function showFieldError(el, msg) {
    if (!el) return;
    clearFieldError(el);
    el.classList.add('input-invalid');
    const small = document.createElement('small');
    small.className = 'field-error';
    small.setAttribute('role', 'alert');
    small.textContent = msg;
    el.insertAdjacentElement('afterend', small);
    el.addEventListener('input', () => clearFieldError(el), { once: true });
}

// checks: [{ id, key, fn }] — ترجع كائن القيم المنظّفة، أو null لو فيه أخطاء (وتعرضها تحت الخانات)
function runValidation(checks) {
    const values = {};
    let first = null;
    checks.forEach((c) => {
        const el = document.getElementById(c.id);
        const r = c.fn(el ? el.value : '');
        if (r.ok) { clearFieldError(el); values[c.key || c.id] = r.value; }
        else { showFieldError(el, r.error); if (!first) first = { el, msg: r.error }; }
    });
    if (first) {
        if (first.el) first.el.focus();
        showToast(first.msg);
        return null;
    }
    return values;
}

// قيود الإدخال الفورية: أرقام فقط، حدود الطول، لوحة المفاتيح المناسبة
function setupInputConstraints() {
    const byId = (id) => document.getElementById(id);
    const attrs = (ids, map) => ids.forEach((id) => { const el = byId(id); if (el) Object.entries(map).forEach(([k, v]) => el.setAttribute(k, v)); });

    attrs(['setupName', 'studentName', 'settingsName'], { maxlength: 80, autocomplete: 'name' });
    attrs(['setupSchool', 'studentSchool', 'settingsSchool'], { maxlength: 80 });
    attrs(['studentEmail'], { maxlength: 200, autocomplete: 'off', inputmode: 'email' });
    attrs(['projTitle'], { maxlength: 80 });
    attrs(['projDesc'], { maxlength: 1000 });
    attrs(['projNeed'], { maxlength: 200 });
    attrs(['trainerAssignmentTitle'], { maxlength: 100 });
    attrs(['trainerAssignmentDesc'], { maxlength: 3000 });
    attrs(['trainerMeetingUrl'], { maxlength: 500 });
    attrs(['chatInput'], { maxlength: 1000 });

    ['setupNationalId', 'studentNationalId', 'settingsNationalId'].forEach((id) => {
        const el = byId(id); if (!el) return;
        el.setAttribute('inputmode', 'numeric');
        el.setAttribute('maxlength', VALIDATION.NATIONAL_ID_LENGTH);
        el.setAttribute('autocomplete', 'off');
        el.addEventListener('input', () => { el.value = toLatinDigits(el.value).replace(/\D/g, ''); });
    });
    ['setupPhone', 'studentPhone', 'settingsPhone'].forEach((id) => {
        const el = byId(id); if (!el) return;
        el.setAttribute('inputmode', 'tel');
        el.setAttribute('maxlength', 18);
        el.setAttribute('autocomplete', 'tel');
        el.addEventListener('input', () => { el.value = toLatinDigits(el.value).replace(/[^\d+\s-]/g, ''); });
    });

    const contactForm = document.querySelector('form[onsubmit*="handleContactSubmit"]');
    if (contactForm) {
        const [n, m, t] = contactForm.querySelectorAll('input, textarea');
        if (n) n.setAttribute('maxlength', 80);
        if (m) m.setAttribute('maxlength', 200);
        if (t) t.setAttribute('maxlength', 1000);
    }
}
setupInputConstraints();

window.closeMobileNav = () => {
    const menu = document.getElementById('navMenu');
    const overlay = document.getElementById('navOverlay');
    const btn = document.getElementById('navToggleBtn');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
};

window.goToSection = (sectionId, event) => {
    if (event) event.preventDefault();

    if (auth.currentUser) {
        const heroSection = document.getElementById('heroSection');
        const timelineSection = document.getElementById('timelineSection');
        const aboutSection = document.getElementById('aboutSection');
        if (heroSection) heroSection.style.display = 'block';
        if (timelineSection) timelineSection.style.display = 'block';
        if (aboutSection) aboutSection.style.display = 'block';
    }

    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    closeMobileNav();
};

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, collection, addDoc, onSnapshot, query, where, orderBy, serverTimestamp, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB75tayILGMO5UesemSBKbV4pBtbjmnxS0",
    authDomain: "project-1-7aa5d.firebaseapp.com",
    projectId: "project-1-7aa5d",
    storageBucket: "project-1-7aa5d.firebasestorage.app",
    messagingSenderId: "56277752072",
    appId: "1:56277752072:web:9f851ec44c3e1b0acef4bd"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const ADMIN_EMAILS = ["anaryadiadmin@gmail.com", "anaryadi9@gmail.com"];

const ENCRYPTION_KEY = "AnaRiyadiSecureKey2026";

let selectedSetupRole = 'specialist';
let currentUserData = null;
let activeChatRoomId = null;
let unsubscribeChat = null;
let allProjectsCache = [];
let currentView = 'all';

function encryptMessage(text, roomId) {
    if (!text) return "";
    return CryptoJS.AES.encrypt(text, deriveRoomKey(roomId)).toString();
}

function decryptMessage(ciphertext, roomId) {
    if (!ciphertext) return "";
    try {
        const bytes = CryptoJS.AES.decrypt(ciphertext, deriveRoomKey(roomId));
        return bytes.toString(CryptoJS.enc.Utf8) || ciphertext;
    } catch (e) { return ciphertext; }
}

function deriveRoomKey(roomId) {
    return CryptoJS.SHA256(ENCRYPTION_KEY + '::' + (roomId || 'default')).toString();
}

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function safeJsArg(value) {
    return encodeURIComponent(value === null || value === undefined ? '' : String(value));
}

function safeUrl(url) {
    if (!url) return '#';
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
    return '#';
}

let toastCounter = 0;
window.showToast = (message, type) => {
    if (!message) return;
    if (!type) {
        type = /خطأ|تعذر|غير مصرح|فشل|يرجى/.test(message) ? 'error' : 'success';
    }
    const container = document.getElementById('toastContainer');
    if (!container) { console.warn('[toast]', message); return; }

    const toastId = `toast-${++toastCounter}`;
    const icon = type === 'error' ? 'fa-circle-exclamation' : (type === 'info' ? 'fa-circle-info' : 'fa-circle-check');

    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <span class="toast-message">${escapeHtml(message)}</span>
        <button type="button" class="toast-close" aria-label="إغلاق">&times;</button>
    `;

    const removeToast = () => {
        if (!toast.isConnected) return;
        toast.classList.remove('toast-in');
        toast.classList.add('toast-out');
        setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-in'));
    setTimeout(removeToast, 4500);
};

const THEME_STORAGE_KEY = 'anaRiyadiTheme';

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeToggleIcon');
    if (icon) {
        icon.classList.toggle('fa-moon', theme !== 'dark');
        icon.classList.toggle('fa-sun', theme === 'dark');
    }
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) themeColorMeta.setAttribute('content', theme === 'dark' ? '#0f172a' : '#047857');
}

function initTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(stored || (prefersDark ? 'dark' : 'light'));
}

window.toggleDarkMode = () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
};

initTheme();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW registration failed:', err));
    });
}

window.selectSetupRole = (role) => {
    selectedSetupRole = role;
    document.getElementById('setupRoleSpecialist').classList.toggle('active', role === 'specialist');
    document.getElementById('setupRoleTrainer').classList.toggle('active', role === 'trainer');
    document.getElementById('setupRoleInvestor').classList.toggle('active', role === 'investor');
    
    const schoolGroup = document.getElementById('setupSchoolGroup');
    if(schoolGroup) {
        schoolGroup.style.display = (role === 'specialist') ? 'block' : 'none';
    }

    // التسجيل كمستثمر غير متاح حالياً (رؤية تطويرية مستقبلية)
    const investorBlocked = (role === 'investor');
    const notice = document.getElementById('investorUnavailableNotice');
    if (notice) notice.style.display = investorBlocked ? 'block' : 'none';
    const submitBtn = document.getElementById('setupSubmitBtn');
    if (submitBtn) {
        submitBtn.disabled = investorBlocked;
        submitBtn.style.opacity = investorBlocked ? '0.5' : '1';
        submitBtn.style.cursor = investorBlocked ? 'not-allowed' : 'pointer';
    }
};

window.cancelSetup = async () => {
    document.getElementById('firstTimeSetupModal').style.display = 'none';
    try { await signOut(auth); window.location.reload(); } catch (err) { window.location.reload(); }
};

window.logout = async () => {
    try { await signOut(auth); window.location.reload(); } catch (err) { showToast("حدث خطأ أثناء تسجيل الخروج"); }
};

window.openWelcomeSpeechModal = () => { document.getElementById('welcomeSpeechModal').style.display = 'flex'; };
window.closeWelcomeSpeechModal = () => { document.getElementById('welcomeSpeechModal').style.display = 'none'; };

window.openAboutUsModal = (event) => {
    if (event) event.preventDefault();
    document.getElementById('aboutUsModal').style.display = 'flex';
};
window.closeAboutUsModal = () => { document.getElementById('aboutUsModal').style.display = 'none'; };

window.openAdminDashboardModal = () => {
    if (!currentUserData || currentUserData.role !== 'admin') {
        showToast("غير مصرح لك بالدخول لهذه اللوحة!");
        return;
    }
    document.getElementById('adminDashboardModal').style.display = 'flex';
    loadAdminStatsAndProjects();
    loadAdminContactMessages();
    switchAdminDashboardTab('projects');
};

window.closeAdminDashboardModal = () => {
    document.getElementById('adminDashboardModal').style.display = 'none';
};

window.switchAdminDashboardTab = (tab) => {
    document.getElementById('adminTabProjects').classList.toggle('active', tab === 'projects');
    document.getElementById('adminTabUsers').classList.toggle('active', tab === 'users');
    document.getElementById('adminTabStudents').classList.toggle('active', tab === 'students');
    document.getElementById('adminTabSurveys').classList.toggle('active', tab === 'surveys');
    document.getElementById('adminTabMessages').classList.toggle('active', tab === 'messages');
    document.getElementById('adminProjectsSection').style.display = tab === 'projects' ? 'block' : 'none';
    document.getElementById('adminUsersSection').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('adminStudentsSection').style.display = tab === 'students' ? 'block' : 'none';
    document.getElementById('adminSurveysSection').style.display = tab === 'surveys' ? 'block' : 'none';
    document.getElementById('adminMessagesSection').style.display = tab === 'messages' ? 'block' : 'none';
    if (tab === 'users') loadAdminSpecialistsAndTrainers();
    if (tab === 'students') loadAdminStudents();
    if (tab === 'surveys') loadAdminSurveys();
    if (tab === 'messages') loadAdminContactMessages();
};

let adminUsersCache = [];
let adminUsersListenerStarted = false;

function loadAdminSpecialistsAndTrainers() {
    const container = document.getElementById('adminUsersList');
    if (!container) return;
    if (adminUsersListenerStarted) { renderAdminUsersList(); return; }
    adminUsersListenerStarted = true;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري التحميل...</p>';

    const q = query(collection(db, "users"), where("role", "in", ["specialist", "trainer"]));
    onSnapshot(q, (snapshot) => {
        adminUsersCache = [];
        snapshot.forEach((docSnap) => { adminUsersCache.push({ id: docSnap.id, ...docSnap.data() }); });
        renderAdminUsersList();
    });
}

window.renderAdminUsersList = () => {
    const container = document.getElementById('adminUsersList');
    if (!container) return;

    const roleFilter = document.getElementById('adminUsersRoleFilter')?.value || 'all';
    const searchTerm = (document.getElementById('adminUsersSearchInput')?.value || '').toLowerCase().trim();

    const filtered = adminUsersCache.filter((u) => {
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        const matchesSearch = !searchTerm || (u.name || '').toLowerCase().includes(searchTerm) || (u.email || '').toLowerCase().includes(searchTerm);
        return matchesRole && matchesSearch;
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا يوجد نتائج مطابقة.</p>';
        return;
    }

    filtered.forEach((u) => {
        const isTrainer = u.role === 'trainer';
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap:10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div style="flex:1; min-width:200px;">
                <h5 style="color:#0f172a; font-size:0.95rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${escapeHtml(u.name || 'بدون اسم')}
                    <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:${isTrainer ? '#e0f2fe' : '#fef3c7'}; color:${isTrainer ? '#0369a1' : '#b45309'};">
                        ${isTrainer ? 'مدرب / محاضر' : 'أخصائي'}
                    </span>
                </h5>
                <small style="color:#64748b; word-break:break-word;">${escapeHtml(u.email || '-')}${u.school ? ' | المدرسة: ' + escapeHtml(u.school) : ''}</small>
            </div>
            <button onclick="adminDeleteUser('${u.id}', decodeURIComponent('${safeJsArg(u.name || 'بدون اسم')}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-trash"></i> حذف</button>
        `;
        container.appendChild(item);
    });
};

window.adminDeleteUser = async (userId, userName) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (!confirm(`هل أنت متأكد من حذف حساب "${userName}" نهائياً من المنصة؟ سيفقد صلاحياته فوراً.`)) return;
    try {
        await deleteDoc(doc(db, "users", userId));
        showToast("تم حذف الحساب بنجاح.");
    } catch (err) {
        showToast("خطأ أثناء الحذف: " + err.message);
    }
};

let adminStudentsCache = [];      // طلبة سجّلوا دخول (users)
let adminPendingStudentsCache = []; // طلبة مسجّلين مسبقاً ولم يسجلوا دخول بعد (preRegisteredStudents)
let adminStudentsListenerStarted = false;
let adminStudentsError = '';

function refreshAdminStudentsSchoolFilter() {
    const schoolFilter = document.getElementById('adminStudentsSchoolFilter');
    if (!schoolFilter) return;
    const currentVal = schoolFilter.value;
    const schools = [...new Set([...adminStudentsCache, ...adminPendingStudentsCache].map(s => s.school).filter(Boolean))].sort();
    schoolFilter.innerHTML = '<option value="all">كل المدارس</option>' +
        schools.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    schoolFilter.value = schools.includes(currentVal) ? currentVal : 'all';
}

function loadAdminStudents() {
    const container = document.getElementById('adminStudentsList');
    if (!container) return;
    if (adminStudentsListenerStarted) { renderAdminStudentsList(); return; }
    adminStudentsListenerStarted = true;
    adminStudentsError = '';
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري التحميل...</p>';

    const onErr = (label) => (err) => {
        console.error(`adminStudents (${label}) listener error:`, err);
        adminStudentsListenerStarted = false;
        adminStudentsError = err && err.code === 'permission-denied'
            ? 'لا توجد صلاحية لقراءة الطلبة. تأكد أنك داخل بحساب المشرف (Google) وأن ملف firestore.rules الأخير منشور في Firebase.'
            : 'تعذر تحميل الطلبة: ' + (err && err.message ? err.message : '');
        renderAdminStudentsList();
    };

    // الطلبة اللي سجّلوا دخول فعلاً
    onSnapshot(query(collection(db, "users"), where("role", "==", "student")), (snapshot) => {
        adminStudentsError = '';
        adminStudentsCache = [];
        snapshot.forEach((docSnap) => { adminStudentsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        refreshAdminStudentsSchoolFilter();
        renderAdminStudentsList();
    }, onErr('users'));

    // الطلبة اللي الأخصائي سجّلهم ولسه ما دخلوش
    onSnapshot(collection(db, "preRegisteredStudents"), (snapshot) => {
        adminPendingStudentsCache = [];
        snapshot.forEach((docSnap) => { adminPendingStudentsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        refreshAdminStudentsSchoolFilter();
        renderAdminStudentsList();
    }, onErr('preRegisteredStudents'));
}

window.adminDeletePreRegistered = async (emailId, name) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (!confirm(`حذف الطالب «${name}» (لم يسجل دخول بعد) من سجلات المدرسة؟`)) return;
    try {
        await deleteDoc(doc(db, "preRegisteredStudents", emailId));
        showToast("تم حذف الطالب.");
    } catch (err) { showToast("خطأ أثناء الحذف: " + err.message); }
};

window.renderAdminStudentsList = () => {
    const container = document.getElementById('adminStudentsList');
    if (!container) return;

    if (adminStudentsError) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger-color); padding:20px; line-height:1.9;">${escapeHtml(adminStudentsError)}</p>`;
        return;
    }

    const schoolFilter = document.getElementById('adminStudentsSchoolFilter')?.value || 'all';
    const searchTerm = (document.getElementById('adminStudentsSearchInput')?.value || '').toLowerCase().trim();

    const all = [
        ...adminStudentsCache.map((s) => ({ ...s, _status: 'active' })),
        ...adminPendingStudentsCache.map((s) => ({ ...s, _status: 'pending' }))
    ].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));

    const filtered = all.filter((s) => {
        const matchesSchool = schoolFilter === 'all' || s.school === schoolFilter;
        const matchesSearch = !searchTerm || (s.name || '').toLowerCase().includes(searchTerm) || (s.email || '').toLowerCase().includes(searchTerm);
        return matchesSchool && matchesSearch;
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا يوجد نتائج مطابقة.</p>';
        return;
    }

    const activeN = filtered.filter((s) => s._status === 'active').length;
    const summary = document.createElement('div');
    summary.style.cssText = "font-size:0.82rem; color:#64748b; padding:2px 4px;";
    summary.textContent = `الإجمالي: ${filtered.length} | سجّلوا دخول: ${activeN} | لم يسجلوا دخول بعد: ${filtered.length - activeN}`;
    container.appendChild(summary);

    filtered.forEach((s) => {
        const isActive = s._status === 'active';
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap:10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div style="flex:1; min-width:200px;">
                <h5 style="color:#0f172a; font-size:0.95rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${escapeHtml(s.name || 'بدون اسم')}
                    <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:${isActive ? '#dcfce7' : '#fef3c7'}; color:${isActive ? '#15803d' : '#b45309'}; white-space:nowrap;">${isActive ? 'مسجل ونشط' : 'لم يسجل دخول بعد'}</span>
                </h5>
                <small style="color:#64748b; word-break:break-word;">${escapeHtml(s.email || '-')} | المدرسة: ${escapeHtml(s.school || 'غير متوفر')} | الصف: ${escapeHtml(s.grade || 'غير محدد')}</small>
            </div>
            ${isActive
                ? `<button onclick="adminDeleteUser('${s.id}', decodeURIComponent('${safeJsArg(s.name || 'بدون اسم')}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-trash"></i> حذف</button>`
                : `<button onclick="adminDeletePreRegistered(decodeURIComponent('${safeJsArg(s.id)}'), decodeURIComponent('${safeJsArg(s.name || 'بدون اسم')}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-trash"></i> حذف</button>`}
        `;
        container.appendChild(item);
    });
};

function getRoleLabel(role, school) {
    switch (role) {
        case 'admin': return 'مشرف النظام';
        case 'student': return 'طالب ريادي';
        case 'specialist': return `أخصائي (${school || 'مدرستي'})`;
        case 'trainer': return 'مدرب / محاضر';
        default: return 'داعم / مستثمر';
    }
}

// ───────────── الاستبيانات (لوحة الأدمن) ─────────────
const SURVEY_SCALE_LABELS = ['غير موافق بشدة', 'غير موافق', 'محايد', 'موافق', 'موافق بشدة']; // 1..5
const ANALYTICS_LEVEL_COLORS_SAFE = ['#dc2626', '#f97316', '#eab308', '#65a30d', '#16a34a']; // ألوان الدرجات 1..5
const surveyScaleText = (v) => `${v} = ${SURVEY_SCALE_LABELS[v - 1]}`; // مثال: 5 = موافق بشدة
const SURVEY_TYPE_LABELS = { pre: 'قبلي (بداية المبادرة)', post: 'بعدي (نهاية المبادرة)' };
const SURVEY_STATUS_LABELS = { draft: 'مسودة', open: 'مفتوح', closed: 'مغلق' };
const SURVEY_STATUS_COLORS = { draft: '#64748b', open: '#047857', closed: '#b91c1c' };
const SURVEY_TEMPLATE_QUESTIONS = [
    'لدي المعرفة بمفهوم ريادة الأعمال',
    'لدي القدرة على التواصل مع الآخرين بسهولة',
    'لدي القدرة على إيجاد الحلول وحل المشكلات',
    'أستطيع اتخاذ القرار السليم',
    'لدي المعرفة بكيفية وضع خطة مالية لمشروع',
    'لدي المعرفة والقدرة على التسويق الرقمي',
    'لدي المعرفة بنموذج العمل التجاري',
    'أفضل العمل ضمن فريق أكثر من العمل الفردي',
    'ثقتي بنفسي عالية',
    'لدي القدرة على تحمل المسؤولية',
    'أقوم بطرح أفكار غير تقليدية باستمرار',
    'أميل إلى إنشاء العمل الخاص بي',
    'أهتم بتحسين وتطوير إمكانياتي قبل الآخرين',
    'أمتلك مهارة التخطيط ووضع الأهداف المستقبلية',
    'أقوم بوضع جدول زمني يومي لتنظيم وقتي',
    'لدي المعرفة بتقنيات الذكاء الاصطناعي وإنترنت الأشياء'
];

let adminSurveysCache = [];
let adminSurveysListenerStarted = false;
let adminSurveysLoadError = '';
let editingSurvey = null; // { id, questions: [] }
let surveyResultsState = null; // { survey, responses, compareSurvey, compareResponses }

function newSurveyQuestionId() {
    return 'q' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function loadAdminSurveys() {
    if (adminSurveysListenerStarted) { renderAdminSurveysList(); return; }
    adminSurveysListenerStarted = true;
    const q = query(collection(db, "surveys"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snap) => {
        adminSurveysLoadError = '';
        adminSurveysCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderAdminSurveysList();
    }, (err) => {
        console.warn("surveys listener error:", err);
        adminSurveysListenerStarted = false;
        adminSurveysCache = [];
        adminSurveysLoadError = err && err.code === 'permission-denied'
            ? 'لا توجد صلاحية لقراءة الاستبيانات. تأكد من نشر ملف firestore.rules الجديد في Firebase، ومن أن حسابك مشرف.'
            : 'تعذر تحميل الاستبيانات: ' + (err && err.message ? err.message : '');
        renderAdminSurveysList();
    });
}

window.renderAdminSurveysList = () => {
    const container = document.getElementById('adminSurveysList');
    if (!container) return;
    container.innerHTML = '';
    if (adminSurveysLoadError) {
        container.innerHTML = `<p style="text-align:center; color:var(--danger-color); padding:20px; line-height:1.9;">${escapeHtml(adminSurveysLoadError)}</p>`;
        return;
    }
    if (adminSurveysCache.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد استبيانات بعد. ابدأ بـ«استبيان جديد» أو استخدم قالب ريادة الأعمال.</p>';
        return;
    }
    adminSurveysCache.forEach((s) => {
        const status = s.status || 'draft';
        const isOpen = status === 'open';
        const item = document.createElement('div');
        item.style.cssText = "background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); display:flex; flex-direction:column; gap:10px;";
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                <div style="flex:1; min-width:200px;">
                    <h5 style="color:#0f172a; font-size:0.95rem;">${escapeHtml(s.title || 'بدون عنوان')}</h5>
                    <small style="color:#64748b;">${escapeHtml(SURVEY_TYPE_LABELS[s.type] || '')} | ${(s.questions || []).length} سؤال</small>
                </div>
                <span style="background:${SURVEY_STATUS_COLORS[status]}; color:#fff; padding:3px 12px; border-radius:20px; font-size:0.75rem; font-weight:800;">${SURVEY_STATUS_LABELS[status] || status}</span>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button onclick="openSurveyEditor('${s.id}')" style="background:#e0f2fe; color:#0284c7; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-pen-to-square"></i> تعديل الأسئلة</button>
                <button onclick="adminSetSurveyStatus('${s.id}', '${isOpen ? 'closed' : 'open'}')" style="background:${isOpen ? '#fef3c7' : '#dcfce7'}; color:${isOpen ? '#b45309' : '#047857'}; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid ${isOpen ? 'fa-lock' : 'fa-lock-open'}"></i> ${isOpen ? 'إغلاق' : 'فتح للطلبة'}</button>
                <button onclick="openSurveyResults('${s.id}')" style="background:#ede9fe; color:#6d28d9; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-chart-column"></i> النتائج</button>
                <button onclick="adminDeleteSurvey('${s.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        container.appendChild(item);
    });
};

window.adminSetSurveyStatus = async (id, status) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const s = adminSurveysCache.find((x) => x.id === id);
    if (status === 'open' && s && (!s.questions || s.questions.length === 0)) {
        showToast("أضف أسئلة للاستبيان أولاً قبل فتحه.");
        return;
    }
    try {
        await updateDoc(doc(db, "surveys", id), { status, updatedAt: serverTimestamp() });
        if (status === 'open') {
            try {
                await addDoc(collection(db, "notifications"), {
                    title: "استبيان جديد بانتظارك",
                    message: `تم فتح «${(s?.title || 'استبيان').slice(0, 120)}». شاركنا رأيك من الصفحة الرئيسية.`,
                    type: "survey",
                    createdAt: serverTimestamp()
                });
            } catch (nErr) { console.warn("survey notification failed:", nErr); }
        }
        showToast(status === 'open' ? "تم فتح الاستبيان وإشعار الطلبة." : "تم إغلاق الاستبيان.");
    } catch (err) { showToast("خطأ: " + err.message); }
};

window.adminDeleteSurvey = async (id) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const s = adminSurveysCache.find((x) => x.id === id);
    if (!confirm(`حذف الاستبيان «${s?.title || ''}» وكل إجابات الطلبة عليه؟ لا يمكن التراجع.`)) return;
    try {
        const snap = await getDocs(query(collection(db, "surveyResponses"), where("surveyId", "==", id)));
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
        await deleteDoc(doc(db, "surveys", id));
        showToast("تم حذف الاستبيان.");
    } catch (err) { showToast("خطأ أثناء الحذف: " + err.message); }
};

// ----- المحرر -----
function showSurveyEditor(survey) {
    editingSurvey = {
        id: survey.id || null,
        questions: (survey.questions || []).map((q) => ({ ...q, options: Array.isArray(q.options) ? [...q.options] : undefined }))
    };
    document.getElementById('surveyTitleInput').value = survey.title || '';
    document.getElementById('surveyDescInput').value = survey.description || '';
    document.getElementById('surveyTypeInput').value = survey.type || 'pre';
    document.getElementById('surveyEditorHeading').textContent = survey.id ? 'تعديل الاستبيان' : 'استبيان جديد';

    const copySel = document.getElementById('surveyCopyFrom');
    copySel.innerHTML = '<option value="">نسخ أسئلة من استبيان آخر...</option>' +
        adminSurveysCache.filter((s) => s.id !== survey.id).map((s) => `<option value="${s.id}">${escapeHtml(s.title || 'بدون عنوان')}</option>`).join('');

    renderSurveyEditorQuestions();
    document.getElementById('surveyEditorModal').style.display = 'flex';
}

window.openSurveyEditor = (id) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const s = id ? adminSurveysCache.find((x) => x.id === id) : null;
    if (id && !s) return;
    showSurveyEditor(s || { questions: [] });
};

window.openSurveyEditorFromTemplate = () => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    showSurveyEditor({
        title: 'استبيان مدى معرفة الطلبة بمجال ريادة الأعمال',
        description: 'يرجى اختيار الاستجابة التي تعبر عن رأيك بصدق. لا توجد إجابات صحيحة أو خاطئة.',
        type: 'pre',
        // معرّفات ثابتة عشان نقدر نقارن القبلي بالبعدي سؤالاً بسؤال
        questions: SURVEY_TEMPLATE_QUESTIONS.map((text, i) => ({ id: 't' + (i + 1), text, type: 'scale' }))
    });
};

window.closeSurveyEditor = () => {
    document.getElementById('surveyEditorModal').style.display = 'none';
    editingSurvey = null;
};

function renderSurveyEditorQuestions() {
    const box = document.getElementById('surveyQuestionsBox');
    if (!box || !editingSurvey) return;
    const qs = editingSurvey.questions;
    if (qs.length === 0) {
        box.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:14px;">لا توجد أسئلة بعد. اضغط «إضافة سؤال».</p>';
        return;
    }
    const iconBtn = 'background:#fff; border:1px solid var(--border-color); border-radius:6px; padding:5px 9px; cursor:pointer; color:#475569;';
    box.innerHTML = qs.map((q, i) => `
        <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:10px;">
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <strong style="color:var(--primary-color); min-width:22px;">${i + 1}</strong>
                <input type="text" value="${escapeHtml(q.text)}" placeholder="نص السؤال / العبارة" maxlength="300" oninput="surveyQSet(${i}, 'text', this.value)" style="flex:1; padding:10px; border:1px solid var(--border-color); border-radius:8px;">
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <select class="filter-select" style="width:auto;" onchange="surveyQType(${i}, this.value)">
                    <option value="scale" ${q.type === 'scale' ? 'selected' : ''}>مقياس موافقة (1 – 5)</option>
                    <option value="choice" ${q.type === 'choice' ? 'selected' : ''}>اختيار من متعدد</option>
                    <option value="text" ${q.type === 'text' ? 'selected' : ''}>إجابة نصية</option>
                </select>
                <button type="button" style="${iconBtn}" onclick="surveyQMove(${i}, -1)" title="للأعلى"><i class="fa-solid fa-chevron-up"></i></button>
                <button type="button" style="${iconBtn}" onclick="surveyQMove(${i}, 1)" title="للأسفل"><i class="fa-solid fa-chevron-down"></i></button>
                <button type="button" style="${iconBtn} color:#dc2626;" onclick="surveyQDelete(${i})" title="حذف"><i class="fa-solid fa-trash"></i></button>
            </div>
            ${q.type === 'choice' ? `
                <textarea rows="3" placeholder="الخيارات: كل خيار في سطر (من 2 إلى 10)" oninput="surveyQSet(${i}, 'options', this.value)" style="width:100%; margin-top:8px; padding:10px; border:1px solid var(--border-color); border-radius:8px; font-family:inherit;">${escapeHtml((q.options || []).join('\n'))}</textarea>
            ` : ''}
        </div>
    `).join('');
}

window.surveyQSet = (i, field, value) => {
    const q = editingSurvey?.questions[i];
    if (!q) return;
    if (field === 'options') q.options = value.split('\n').map((s) => s.trim()).filter(Boolean);
    else q[field] = value;
};

window.surveyQType = (i, value) => {
    const q = editingSurvey?.questions[i];
    if (!q) return;
    q.type = value;
    if (value === 'choice' && !q.options) q.options = [];
    renderSurveyEditorQuestions();
};

window.surveyQMove = (i, dir) => {
    const qs = editingSurvey?.questions;
    const j = i + dir;
    if (!qs || j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    renderSurveyEditorQuestions();
};

window.surveyQDelete = (i) => {
    if (!editingSurvey) return;
    editingSurvey.questions.splice(i, 1);
    renderSurveyEditorQuestions();
};

window.surveyAddQuestion = () => {
    if (!editingSurvey) return;
    if (editingSurvey.questions.length >= 60) { showToast("الحد الأقصى 60 سؤالاً."); return; }
    editingSurvey.questions.push({ id: newSurveyQuestionId(), text: '', type: 'scale' });
    renderSurveyEditorQuestions();
    const inputs = document.querySelectorAll('#surveyQuestionsBox input[type="text"]');
    inputs[inputs.length - 1]?.focus();
};

window.surveyCopyQuestions = (fromId) => {
    if (!fromId || !editingSurvey) return;
    const src = adminSurveysCache.find((s) => s.id === fromId);
    if (!src) return;
    if (editingSurvey.questions.length > 0 && !confirm("سيتم استبدال الأسئلة الحالية بأسئلة الاستبيان المختار. متابعة؟")) {
        document.getElementById('surveyCopyFrom').value = '';
        return;
    }
    // نحتفظ بنفس معرّفات الأسئلة عشان تتم المقارنة بين القبلي والبعدي
    editingSurvey.questions = (src.questions || []).map((q) => ({ ...q, options: Array.isArray(q.options) ? [...q.options] : undefined }));
    document.getElementById('surveyCopyFrom').value = '';
    renderSurveyEditorQuestions();
    showToast("تم نسخ الأسئلة.");
};

window.saveSurvey = async (e) => {
    e.preventDefault();
    if (!editingSurvey || !auth.currentUser || !currentUserData || currentUserData.role !== 'admin') return;

    const title = document.getElementById('surveyTitleInput').value.trim();
    const description = document.getElementById('surveyDescInput').value.trim();
    const type = document.getElementById('surveyTypeInput').value;
    if (title.length < 3 || title.length > 120) { showToast("عنوان الاستبيان من 3 إلى 120 حرفاً."); return; }
    if (description.length > 500) { showToast("الوصف لا يتجاوز 500 حرف."); return; }
    if (!['pre', 'post'].includes(type)) { showToast("اختر نوع الاستبيان."); return; }

    const qs = editingSurvey.questions;
    if (qs.length === 0) { showToast("أضف سؤالاً واحداً على الأقل."); return; }
    const cleaned = [];
    for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        const text = (q.text || '').trim();
        if (text.length < 3 || text.length > 300) { showToast(`السؤال رقم ${i + 1}: النص من 3 إلى 300 حرف.`); return; }
        if (!['scale', 'choice', 'text'].includes(q.type)) { showToast(`السؤال رقم ${i + 1}: نوع غير صالح.`); return; }
        const out = { id: q.id || newSurveyQuestionId(), text, type: q.type };
        if (q.type === 'choice') {
            const opts = (q.options || []).map((o) => o.trim()).filter(Boolean);
            if (opts.length < 2 || opts.length > 10 || opts.some((o) => o.length > 100)) {
                showToast(`السؤال رقم ${i + 1}: الخيارات من 2 إلى 10، وكل خيار حتى 100 حرف.`);
                return;
            }
            out.options = opts;
        }
        cleaned.push(out);
    }

    const existing = editingSurvey.id ? adminSurveysCache.find((s) => s.id === editingSurvey.id) : null;
    if (existing && existing.status !== 'draft' && !confirm("هذا الاستبيان مفتوح أو مغلق وقد توجد إجابات عليه. تعديل الأسئلة قد يخلّ بالنتائج السابقة. متابعة؟")) return;

    try {
        const data = { title, description, type, questions: cleaned, updatedAt: serverTimestamp() };
        if (editingSurvey.id) {
            await updateDoc(doc(db, "surveys", editingSurvey.id), data);
        } else {
            await addDoc(collection(db, "surveys"), { ...data, status: 'draft', createdAt: serverTimestamp(), createdBy: auth.currentUser.uid });
        }
        showToast("تم حفظ الاستبيان.");
        closeSurveyEditor();
    } catch (err) { showToast("خطأ أثناء الحفظ: " + err.message); }
};

// ----- النتائج -----
window.openSurveyResults = async (id) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const survey = adminSurveysCache.find((s) => s.id === id);
    if (!survey) return;
    surveyResultsState = { survey, responses: [], compareSurvey: null, compareResponses: [] };
    document.getElementById('surveyResultsTitle').textContent = survey.title || 'نتائج الاستبيان';
    document.getElementById('surveyResultsBody').innerHTML = '<p style="text-align:center; padding:20px; color:var(--text-muted);">جاري التحميل...</p>';
    document.getElementById('surveyResultsModal').style.display = 'flex';

    const cmpSel = document.getElementById('surveyCompareSelect');
    cmpSel.innerHTML = '<option value="">مقارنة مع استبيان آخر (اختياري)</option>' +
        adminSurveysCache.filter((s) => s.id !== id).map((s) => `<option value="${s.id}">${escapeHtml(s.title || 'بدون عنوان')} — ${escapeHtml(SURVEY_TYPE_LABELS[s.type] || '')}</option>`).join('');
    document.getElementById('surveySchoolFilter').innerHTML = '<option value="all">كل المدارس</option>';

    try {
        const snap = await getDocs(query(collection(db, "surveyResponses"), where("surveyId", "==", id)));
        surveyResultsState.responses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const schools = [...new Set(surveyResultsState.responses.map((r) => r.school).filter(Boolean))].sort();
        document.getElementById('surveySchoolFilter').innerHTML = '<option value="all">كل المدارس</option>' +
            schools.map((sc) => `<option value="${escapeHtml(sc)}">${escapeHtml(sc)}</option>`).join('');
        renderSurveyResults();
    } catch (err) {
        document.getElementById('surveyResultsBody').innerHTML = `<p style="text-align:center; padding:20px; color:var(--danger-color);">تعذر تحميل النتائج: ${escapeHtml(err.message)}</p>`;
    }
};

window.closeSurveyResults = () => {
    document.getElementById('surveyResultsModal').style.display = 'none';
    surveyResultsState = null;
};

window.surveyChooseCompare = async (otherId) => {
    if (!surveyResultsState) return;
    if (!otherId) {
        surveyResultsState.compareSurvey = null;
        surveyResultsState.compareResponses = [];
        renderSurveyResults();
        return;
    }
    try {
        const other = adminSurveysCache.find((s) => s.id === otherId);
        const snap = await getDocs(query(collection(db, "surveyResponses"), where("surveyId", "==", otherId)));
        surveyResultsState.compareSurvey = other;
        surveyResultsState.compareResponses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        renderSurveyResults();
    } catch (err) { showToast("تعذر تحميل الاستبيان المقارن: " + err.message); }
};

function surveyScaleStats(responses, qid) {
    const counts = [0, 0, 0, 0, 0];
    let sum = 0, n = 0;
    responses.forEach((r) => {
        const v = Number(r.answers?.[qid]);
        if (v >= 1 && v <= 5) { counts[v - 1]++; sum += v; n++; }
    });
    return { n, avg: n ? sum / n : null, counts };
}

function surveyFilteredResponses(list) {
    const school = document.getElementById('surveySchoolFilter')?.value || 'all';
    return school === 'all' ? list : list.filter((r) => r.school === school);
}

window.renderSurveyResults = () => {
    const body = document.getElementById('surveyResultsBody');
    if (!body || !surveyResultsState) return;
    const { survey, compareSurvey } = surveyResultsState;
    const responses = surveyFilteredResponses(surveyResultsState.responses);
    const compareResponses = compareSurvey ? surveyFilteredResponses(surveyResultsState.compareResponses) : [];

    // نحدد أيهما القبلي وأيهما البعدي (لو النوعان مختلفان)
    let beforeLabel = 'الاستبيان المقارن', afterLabel = 'الاستبيان الحالي';
    let beforeRes = compareResponses, afterRes = responses;
    if (compareSurvey && survey.type !== compareSurvey.type) {
        beforeLabel = 'قبلي'; afterLabel = 'بعدي';
        if (survey.type === 'pre') { beforeRes = responses; afterRes = compareResponses; }
    }

    const scaleQs = (survey.questions || []).filter((q) => q.type === 'scale');
    let html = `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:10px; margin-bottom:16px;">
        <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;"><small style="color:#64748b;">عدد المجيبين</small><div style="font-size:1.5rem; font-weight:900; color:var(--primary-color);">${responses.length}</div></div>`;
    if (scaleQs.length) {
        const all = [];
        responses.forEach((r) => scaleQs.forEach((q) => { const v = Number(r.answers?.[q.id]); if (v >= 1 && v <= 5) all.push(v); }));
        const overall = all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(2) : '—';
        html += `<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;"><small style="color:#64748b;">المتوسط العام (من 5)</small><div style="font-size:1.5rem; font-weight:900; color:var(--primary-color);">${overall}</div></div>`;
    }
    if (compareSurvey) {
        html += `<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;"><small style="color:#64748b;">مجيبو المقارن</small><div style="font-size:1.5rem; font-weight:900; color:#6d28d9;">${compareResponses.length}</div></div>`;
    }
    html += '</div>';

    if (responses.length === 0) html += '<p style="text-align:center; color:var(--text-muted); padding:10px;">لا توجد إجابات بعد.</p>';

    (survey.questions || []).forEach((q, i) => {
        html += `<div style="border:1px solid var(--border-color); border-radius:12px; padding:12px; margin-bottom:10px;">
            <div style="font-weight:800; color:#0f172a; margin-bottom:8px;">${i + 1}. ${escapeHtml(q.text)}</div>`;
        if (q.type === 'scale') {
            const st = surveyScaleStats(responses, q.id);
            const pct = st.avg ? (st.avg / 5) * 100 : 0;
            html += `<div style="display:flex; align-items:center; gap:10px;">
                <div style="flex:1; background:#e2e8f0; border-radius:20px; height:12px; overflow:hidden;"><div style="width:${pct}%; background:var(--primary-color); height:100%;"></div></div>
                <strong style="min-width:70px; text-align:left;">${st.avg ? st.avg.toFixed(2) : '—'} / 5</strong>
            </div>
            <small style="color:#64748b;">${SURVEY_SCALE_LABELS.map((l, k) => `${k + 1} ${l}: ${st.counts[k]}`).reverse().join(' • ')}</small>`;
            if (compareSurvey && (compareSurvey.questions || []).some((cq) => cq.id === q.id && cq.type === 'scale')) {
                const b = surveyScaleStats(beforeRes, q.id), a = surveyScaleStats(afterRes, q.id);
                if (b.avg !== null && a.avg !== null) {
                    const diff = a.avg - b.avg;
                    const color = diff > 0 ? '#047857' : diff < 0 ? '#b91c1c' : '#64748b';
                    html += `<div style="margin-top:8px; background:#f5f3ff; border-radius:8px; padding:8px 10px; font-size:0.85rem;">
                        ${beforeLabel}: <strong>${b.avg.toFixed(2)}</strong> ← ${afterLabel}: <strong>${a.avg.toFixed(2)}</strong>
                        <span style="color:${color}; font-weight:800; margin-right:8px;">(${diff > 0 ? '+' : ''}${diff.toFixed(2)})</span>
                    </div>`;
                }
            }
        } else if (q.type === 'choice') {
            const counts = {};
            (q.options || []).forEach((o) => { counts[o] = 0; });
            responses.forEach((r) => { const v = r.answers?.[q.id]; if (v in counts) counts[v]++; });
            const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
            html += (q.options || []).map((o) => `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <span style="min-width:110px; font-size:0.85rem;">${escapeHtml(o)}</span>
                <div style="flex:1; background:#e2e8f0; border-radius:20px; height:10px; overflow:hidden;"><div style="width:${(counts[o] / total) * 100}%; background:#0284c7; height:100%;"></div></div>
                <small>${counts[o]}</small></div>`).join('');
        } else {
            const answers = responses.map((r) => (r.answers?.[q.id] || '').toString().trim()).filter(Boolean);
            html += answers.length
                ? `<div style="display:flex; flex-direction:column; gap:6px; max-height:160px; overflow-y:auto;">${answers.slice(0, 50).map((a) => `<div style="background:#f8fafc; border-radius:8px; padding:8px 10px; font-size:0.85rem;">${escapeHtml(a)}</div>`).join('')}</div>`
                : '<small style="color:#64748b;">لا توجد إجابات.</small>';
        }
        html += '</div>';
    });
    body.innerHTML = html;
};

window.exportSurveyResultsCsv = () => {
    if (!surveyResultsState) return;
    const { survey } = surveyResultsState;
    const responses = surveyFilteredResponses(surveyResultsState.responses);
    if (responses.length === 0) { showToast("لا توجد إجابات للتصدير."); return; }
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['اسم الطالب', 'المدرسة', 'تاريخ التسليم', ...(survey.questions || []).map((q) => q.text)];
    const rows = responses.map((r) => {
        const date = r.submittedAt?.toDate ? r.submittedAt.toDate().toLocaleDateString('ar') : '';
        return [r.studentName || '', r.school || '', date, ...(survey.questions || []).map((q) => r.answers?.[q.id] ?? '')];
    });
    const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `survey-${survey.id}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

// ───────────── تحليلات الاستبيانات (رسوم بيانية) ─────────────
// الصفحة بتبني نفسها من أسئلة الاستبيانين، فأي مهارة جديدة تضيفها كسؤال مقياس بتظهر تلقائياً في كل الرسوم.
const ANALYTICS_LEVEL_COLORS = ['#dc2626', '#f97316', '#facc15', '#84cc16', '#16a34a']; // 1..5
const ANALYTICS_PRE_COLOR = '#64748b';
const ANALYTICS_POST_COLOR = '#047857';
let analyticsState = null; // { pre, post, preRes, postRes, sort, distKey }

function normAr(s) {
    return String(s || '')
        .replace(/[\u064B-\u0652\u0640]/g, '')
        .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
        .replace(/[^\u0621-\u064Aa-zA-Z0-9]/g, '');
}

function analyticsShort(text, n) {
    const s = String(text || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

window.openSurveyAnalytics = async () => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    const list = adminSurveysCache;
    if (!list.length) { showToast("أنشئ استبياناً أولاً."); return; }
    const lastPre = list.find((s) => s.type === 'pre') || list[0];
    const lastPost = list.find((s) => s.type === 'post' && s.id !== lastPre.id) || null;
    analyticsState = { pre: lastPre, post: lastPost, preRes: [], postRes: [], sort: 'order', distKey: null };

    const opts = list.map((s) => `<option value="${s.id}">${escapeHtml(s.title || 'بدون عنوان')} — ${escapeHtml(SURVEY_TYPE_LABELS[s.type] || '')}</option>`).join('');
    document.getElementById('analyticsPreSelect').innerHTML = opts;
    document.getElementById('analyticsPreSelect').value = lastPre.id;
    document.getElementById('analyticsPostSelect').innerHTML = '<option value="">بدون مقارنة (استبيان واحد)</option>' + opts;
    document.getElementById('analyticsPostSelect').value = lastPost ? lastPost.id : '';
    document.getElementById('analyticsSortSelect').value = 'order';
    document.getElementById('surveyAnalyticsModal').style.display = 'flex';
    await loadAnalyticsData();
};

window.closeSurveyAnalytics = () => {
    document.getElementById('surveyAnalyticsModal').style.display = 'none';
    analyticsState = null;
};

window.analyticsPickSurveys = async () => {
    if (!analyticsState) return;
    const preId = document.getElementById('analyticsPreSelect').value;
    const postId = document.getElementById('analyticsPostSelect').value;
    if (postId && postId === preId) {
        showToast("اختر استبيانين مختلفين للمقارنة.");
        document.getElementById('analyticsPostSelect').value = '';
        analyticsState.post = null;
    } else {
        analyticsState.post = adminSurveysCache.find((s) => s.id === postId) || null;
    }
    analyticsState.pre = adminSurveysCache.find((s) => s.id === preId) || analyticsState.pre;
    analyticsState.distKey = null;
    await loadAnalyticsData();
};

window.analyticsSetSort = (v) => { if (analyticsState) { analyticsState.sort = v; renderSurveyAnalytics(); } };
window.analyticsSetDist = (v) => { if (analyticsState) { analyticsState.distKey = v; renderSurveyAnalytics(); } };

async function loadAnalyticsData() {
    const st = analyticsState;
    if (!st) return;
    const body = document.getElementById('analyticsBody');
    body.innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-muted);">جاري تحميل البيانات...</p>';
    const fetchRes = async (s) => {
        if (!s) return [];
        const snap = await getDocs(query(collection(db, "surveyResponses"), where("surveyId", "==", s.id)));
        return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    };
    try {
        const [preRes, postRes] = await Promise.all([fetchRes(st.pre), fetchRes(st.post)]);
        if (analyticsState !== st) return;
        st.preRes = preRes;
        st.postRes = postRes;
        const schools = [...new Set([...preRes, ...postRes].map((r) => r.school).filter(Boolean))].sort();
        const sel = document.getElementById('analyticsSchoolSelect');
        const prev = sel.value;
        sel.innerHTML = '<option value="all">كل المدارس</option>' + schools.map((sc) => `<option value="${escapeHtml(sc)}">${escapeHtml(sc)}</option>`).join('');
        sel.value = schools.includes(prev) ? prev : 'all';
        renderSurveyAnalytics();
    } catch (err) {
        body.innerHTML = `<p style="text-align:center; padding:30px; color:var(--danger-color);">تعذر تحميل البيانات: ${escapeHtml(err.message)}</p>`;
    }
}

function analyticsBuildSkills(pre, post) {
    const skills = [];
    const byId = new Map();
    const byText = new Map();
    (pre?.questions || []).filter((q) => q.type === 'scale').forEach((q) => {
        const sk = { key: q.id, text: q.text, preId: q.id, postId: null };
        skills.push(sk); byId.set(q.id, sk); byText.set(normAr(q.text), sk);
    });
    (post?.questions || []).filter((q) => q.type === 'scale').forEach((q) => {
        const sk = byId.get(q.id) || byText.get(normAr(q.text));
        if (sk && !sk.postId) sk.postId = q.id;
        else skills.push({ key: 'p_' + q.id, text: q.text, preId: null, postId: q.id });
    });
    skills.forEach((sk, i) => { sk.idx = i + 1; });
    return skills;
}

function analyticsBar(label, val, color) {
    return `<div style="display:flex; align-items:center; gap:8px;">
        <span style="width:40px; font-size:0.75rem; color:#64748b;">${label}</span>
        <div style="flex:1; background:#e2e8f0; border-radius:20px; height:12px; overflow:hidden;"><div style="width:${(val / 5) * 100}%; background:${color}; height:100%;"></div></div>
        <strong style="width:38px; font-size:0.8rem; text-align:left;">${val.toFixed(2)}</strong>
    </div>`;
}

function analyticsRadar(skills, hasPost) {
    const n = skills.length;
    const W = 460, cx = 230, cy = 230, R = 150;
    const pt = (i, v) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const r = (v / 5) * R;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    let svg = `<svg viewBox="0 0 ${W} ${W}" style="width:100%; max-width:460px; display:block; margin:0 auto;">`;
    for (let lv = 1; lv <= 5; lv++) {
        svg += `<polygon points="${skills.map((_, i) => pt(i, lv).join(',')).join(' ')}" fill="none" stroke="#e2e8f0" stroke-width="1"/>`;
    }
    skills.forEach((sk, i) => {
        const [x, y] = pt(i, 5);
        const [lx, ly] = pt(i, 5.55);
        svg += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#e2e8f0" stroke-width="1"/>`;
        svg += `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="13" font-weight="800" fill="#334155">${sk.idx}</text>`;
    });
    const poly = (key, color) => {
        const pts = skills.map((sk, i) => pt(i, sk[key] || 0).join(',')).join(' ');
        return `<polygon points="${pts}" fill="${color}" fill-opacity="0.22" stroke="${color}" stroke-width="2.5"/>`;
    };
    svg += poly('preAvg', ANALYTICS_PRE_COLOR);
    if (hasPost) svg += poly('postAvg', ANALYTICS_POST_COLOR);
    svg += '</svg>';
    return svg;
}

window.renderSurveyAnalytics = () => {
    const st = analyticsState;
    const body = document.getElementById('analyticsBody');
    if (!st || !body) return;

    const school = document.getElementById('analyticsSchoolSelect')?.value || 'all';
    const filt = (list) => (school === 'all' ? list : list.filter((r) => r.school === school));
    const preRes = filt(st.preRes), postRes = filt(st.postRes);
    const hasPost = !!st.post;

    const skills = analyticsBuildSkills(st.pre, st.post);
    if (skills.length === 0) {
        body.innerHTML = '<p style="text-align:center; padding:30px; color:var(--text-muted);">الاستبيان المختار ليس فيه أسئلة مقياس (1–5) لتحليلها.</p>';
        return;
    }
    skills.forEach((sk) => {
        const a = sk.preId ? surveyScaleStats(preRes, sk.preId) : null;
        const b = sk.postId ? surveyScaleStats(postRes, sk.postId) : null;
        sk.preAvg = a && a.avg !== null ? a.avg : null;
        sk.postAvg = b && b.avg !== null ? b.avg : null;
        sk.preStats = a; sk.postStats = b;
        sk.diff = sk.preAvg !== null && sk.postAvg !== null ? sk.postAvg - sk.preAvg : null;
    });
    const common = skills.filter((s) => s.diff !== null);
    const mean = (arr) => (arr.length ? arr.reduce((x, y) => x + y, 0) / arr.length : null);

    // ---------- مؤشرات عامة ----------
    const overallPre = mean((hasPost ? common : skills).map((s) => s.preAvg).filter((v) => v !== null));
    const overallPost = hasPost ? mean((common.length ? common : skills).map((s) => s.postAvg).filter((v) => v !== null)) : null;
    let changePct = null;
    if (hasPost && common.length && overallPre) changePct = ((mean(common.map((s) => s.postAvg)) - mean(common.map((s) => s.preAvg))) / mean(common.map((s) => s.preAvg))) * 100;

    // الطلبة اللي أجابوا الاستبيانين (مقارنة فردية أدق)
    let pairedN = 0, pairedGain = null;
    if (hasPost && common.length) {
        const postByStudent = new Map(postRes.map((r) => [r.studentId, r]));
        const gains = [];
        preRes.forEach((pr) => {
            const po = postByStudent.get(pr.studentId);
            if (!po) return;
            const ds = [];
            common.forEach((sk) => {
                const a = Number(pr.answers?.[sk.preId]), b = Number(po.answers?.[sk.postId]);
                if (a >= 1 && a <= 5 && b >= 1 && b <= 5) ds.push(b - a);
            });
            if (ds.length) { pairedN++; gains.push(mean(ds)); }
        });
        pairedGain = mean(gains);
    }

    const kpi = (label, value, color, sub) => `<div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:12px; text-align:center;">
        <small style="color:#64748b;">${label}</small>
        <div style="font-size:1.5rem; font-weight:900; color:${color};">${value}</div>${sub ? `<small style="color:#94a3b8;">${sub}</small>` : ''}</div>`;
    let html = `<div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:10px; margin-bottom:18px;">
        ${kpi('مجيبو القبلي', preRes.length, ANALYTICS_PRE_COLOR)}
        ${hasPost ? kpi('مجيبو البعدي', postRes.length, ANALYTICS_POST_COLOR) : ''}
        ${kpi(hasPost ? 'المتوسط العام (قبلي)' : 'المتوسط العام', overallPre !== null ? overallPre.toFixed(2) : '—', ANALYTICS_PRE_COLOR, 'من 5')}
        ${hasPost ? kpi('المتوسط العام (بعدي)', overallPost !== null ? overallPost.toFixed(2) : '—', ANALYTICS_POST_COLOR, 'من 5') : ''}
        ${hasPost ? kpi('نسبة التغيّر', changePct !== null ? (changePct > 0 ? '+' : '') + changePct.toFixed(1) + '%' : '—', changePct !== null && changePct < 0 ? '#b91c1c' : '#047857', 'على المهارات المشتركة') : ''}
        ${hasPost ? kpi('طلبة أجابوا الاثنين', pairedN, '#6d28d9', pairedGain !== null ? `متوسط تحسنهم ${pairedGain > 0 ? '+' : ''}${pairedGain.toFixed(2)}` : '') : ''}
    </div>`;

    if (preRes.length === 0 && postRes.length === 0) {
        html += '<p style="text-align:center; color:var(--text-muted); padding:10px;">لا توجد إجابات بعد لعرض الرسوم.</p>';
        body.innerHTML = html;
        return;
    }

    const card = (title, inner) => `<div style="border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:16px;"><h4 style="color:var(--secondary-color); margin-bottom:12px;">${title}</h4>${inner}</div>`;
    const tag = (sk) => {
        if (!hasPost) return '';
        if (sk.preId && !sk.postId) return ' <span style="background:#fef3c7; color:#b45309; border-radius:10px; padding:1px 8px; font-size:0.7rem;">قبلي فقط</span>';
        if (!sk.preId && sk.postId) return ' <span style="background:#dbeafe; color:#1d4ed8; border-radius:10px; padding:1px 8px; font-size:0.7rem;">مهارة جديدة</span>';
        return '';
    };

    // ---------- ١) قبلي مقابل بعدي لكل مهارة ----------
    const sorted = [...skills];
    if (st.sort === 'gain') sorted.sort((a, b) => (b.diff ?? -99) - (a.diff ?? -99));
    if (st.sort === 'post') sorted.sort((a, b) => ((b.postAvg ?? b.preAvg ?? -1)) - ((a.postAvg ?? a.preAvg ?? -1)));
    html += card(hasPost ? 'المهارات: قبل وبعد' : 'متوسط كل مهارة', sorted.map((sk) => `
        <div style="margin-bottom:12px;">
            <div style="font-size:0.85rem; font-weight:700; margin-bottom:4px;"><span style="color:var(--primary-color);">${sk.idx}.</span> ${escapeHtml(sk.text)}${tag(sk)}</div>
            <div style="display:flex; flex-direction:column; gap:3px;">
                ${sk.preAvg !== null ? analyticsBar('قبلي', sk.preAvg, ANALYTICS_PRE_COLOR) : ''}
                ${hasPost && sk.postAvg !== null ? analyticsBar('بعدي', sk.postAvg, ANALYTICS_POST_COLOR) : ''}
            </div>
        </div>`).join(''));

    // ---------- ٢) التحسن لكل مهارة ----------
    if (hasPost && common.length) {
        const byGain = [...common].sort((a, b) => b.diff - a.diff);
        const maxAbs = Math.max(0.5, ...byGain.map((s) => Math.abs(s.diff)));
        html += card('التحسن في كل مهارة (بعدي − قبلي)', byGain.map((sk) => {
            const w = (Math.abs(sk.diff) / maxAbs) * 50;
            const pos = sk.diff >= 0;
            return `<div style="display:grid; grid-template-columns:minmax(110px,1.3fr) 2fr 56px; gap:8px; align-items:center; margin-bottom:6px; font-size:0.8rem;">
                <span>${sk.idx}. ${escapeHtml(analyticsShort(sk.text, 38))}</span>
                <div style="position:relative; height:14px; background:#f1f5f9; border-radius:6px;">
                    <div style="position:absolute; left:50%; top:0; bottom:0; width:1px; background:#94a3b8;"></div>
                    <div style="position:absolute; ${pos ? 'left:50%' : 'right:50%'}; width:${w}%; top:0; bottom:0; background:${pos ? '#16a34a' : '#dc2626'}; border-radius:${pos ? '0 6px 6px 0' : '6px 0 0 6px'};"></div>
                </div>
                <strong style="color:${pos ? '#047857' : '#b91c1c'};">${pos ? '+' : ''}${sk.diff.toFixed(2)}</strong>
            </div>`;
        }).join(''));
    }

    // ---------- ٣) رادار المهارات ----------
    const radarSkills = hasPost ? common : skills.filter((s) => s.preAvg !== null);
    if (radarSkills.length >= 3) {
        html += card('خريطة المهارات (رادار)', `
            ${analyticsRadar(radarSkills, hasPost)}
            <div style="display:flex; gap:16px; justify-content:center; margin-top:8px; font-size:0.8rem;">
                <span><span style="display:inline-block; width:12px; height:12px; background:${ANALYTICS_PRE_COLOR}; border-radius:3px;"></span> قبلي</span>
                ${hasPost ? `<span><span style="display:inline-block; width:12px; height:12px; background:${ANALYTICS_POST_COLOR}; border-radius:3px;"></span> بعدي</span>` : ''}
            </div>
            <small style="display:block; text-align:center; color:#64748b; margin-top:6px;">الأرقام تطابق ترقيم المهارات في الرسم الأول.</small>`);
    }

    // ---------- ٤) توزيع الإجابات لمهارة ----------
    const distSkills = skills.filter((s) => (s.preStats && s.preStats.n) || (s.postStats && s.postStats.n));
    if (distSkills.length) {
        const dk = distSkills.find((s) => s.key === st.distKey) || distSkills[0];
        const stack = (label, stats, color) => {
            if (!stats || !stats.n) return '';
            return `<div style="margin-bottom:10px;">
                <div style="font-size:0.8rem; font-weight:700; margin-bottom:3px; color:${color};">${label} (${stats.n})</div>
                <div style="display:flex; height:26px; border-radius:8px; overflow:hidden;">
                    ${stats.counts.map((c, k) => {
                        const pct = (c / stats.n) * 100;
                        return pct ? `<div title="${k + 1} = ${SURVEY_SCALE_LABELS[k]}: ${c}" style="width:${pct}%; background:${ANALYTICS_LEVEL_COLORS[k]}; color:#fff; font-size:0.7rem; display:flex; align-items:center; justify-content:center;">${pct >= 9 ? Math.round(pct) + '%' : ''}</div>` : '';
                    }).join('')}
                </div></div>`;
        };
        html += card('توزيع الإجابات لمهارة', `
            <select class="filter-select" style="margin-bottom:12px;" onchange="analyticsSetDist(this.value)">
                ${distSkills.map((s) => `<option value="${escapeHtml(s.key)}" ${s.key === dk.key ? 'selected' : ''}>${s.idx}. ${escapeHtml(analyticsShort(s.text, 70))}</option>`).join('')}
            </select>
            ${stack('قبلي', dk.preStats, ANALYTICS_PRE_COLOR)}
            ${hasPost ? stack('بعدي', dk.postStats, ANALYTICS_POST_COLOR) : ''}
            <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:0.75rem; margin-top:6px;">
                ${SURVEY_SCALE_LABELS.map((l, k) => `<span><span style="display:inline-block; width:11px; height:11px; background:${ANALYTICS_LEVEL_COLORS[k]}; border-radius:3px;"></span> ${k + 1} = ${l}</span>`).join('')}
            </div>`);
    }

    // ---------- ٥) مقارنة المدارس ----------
    const schoolAvg = (res, survey) => {
        const ids = (survey?.questions || []).filter((q) => q.type === 'scale').map((q) => q.id);
        const vals = [];
        res.forEach((r) => ids.forEach((id) => { const v = Number(r.answers?.[id]); if (v >= 1 && v <= 5) vals.push(v); }));
        return mean(vals);
    };
    const schoolNames = [...new Set([...st.preRes, ...st.postRes].map((r) => r.school).filter(Boolean))].sort();
    if (schoolNames.length > 1) {
        html += card('مقارنة المدارس (المتوسط العام)', schoolNames.map((sc) => {
            const a = schoolAvg(st.preRes.filter((r) => r.school === sc), st.pre);
            const b = hasPost ? schoolAvg(st.postRes.filter((r) => r.school === sc), st.post) : null;
            return `<div style="margin-bottom:12px;">
                <div style="font-size:0.85rem; font-weight:700; margin-bottom:4px;">${escapeHtml(sc)}</div>
                <div style="display:flex; flex-direction:column; gap:3px;">
                    ${a !== null ? analyticsBar('قبلي', a, ANALYTICS_PRE_COLOR) : '<small style="color:#94a3b8;">لا توجد إجابات قبلية</small>'}
                    ${hasPost ? (b !== null ? analyticsBar('بعدي', b, ANALYTICS_POST_COLOR) : '<small style="color:#94a3b8;">لا توجد إجابات بعدية</small>') : ''}
                </div></div>`;
        }).join(''));
    }

    // ---------- ٦) ملاحظات تلقائية ----------
    const names = (arr, f) => arr.map((s) => `«${escapeHtml(analyticsShort(s.text, 45))}»${f ? ' ' + f(s) : ''}`).join('، ');
    const notes = [];
    if (hasPost && common.length) {
        const best = [...common].sort((a, b) => b.diff - a.diff).filter((s) => s.diff > 0).slice(0, 3);
        const declined = common.filter((s) => s.diff < 0);
        const weakest = [...skills].filter((s) => s.postAvg !== null).sort((a, b) => a.postAvg - b.postAvg).slice(0, 3);
        if (best.length) notes.push(`<b>أكثر المهارات تحسناً:</b> ${names(best, (s) => `(+${s.diff.toFixed(2)})`)}.`);
        if (declined.length) notes.push(`<b>مهارات تراجعت:</b> ${names(declined, (s) => `(${s.diff.toFixed(2)})`)} — تستحق مراجعة الأنشطة المرتبطة بها.`);
        if (weakest.length) notes.push(`<b>الأقل مستوى بعد المبادرة:</b> ${names(weakest, (s) => `(${s.postAvg.toFixed(2)})`)} — مرشحة لتركيز أكبر في الدورة القادمة.`);
        const fresh = skills.filter((s) => !s.preId && s.postId);
        if (fresh.length) notes.push(`<b>مهارات جديدة أُضيفت للبعدي:</b> ${names(fresh)} (لا توجد لها قراءة قبلية للمقارنة).`);
    } else {
        const asc = [...skills].filter((s) => s.preAvg !== null).sort((a, b) => a.preAvg - b.preAvg);
        if (asc.length) {
            notes.push(`<b>أضعف المهارات حالياً:</b> ${names(asc.slice(0, 3), (s) => `(${s.preAvg.toFixed(2)})`)}.`);
            notes.push(`<b>أقوى المهارات حالياً:</b> ${names([...asc].reverse().slice(0, 3), (s) => `(${s.preAvg.toFixed(2)})`)}.`);
        }
    }
    if (notes.length) html += card('ملاحظات تلقائية', `<ul style="padding-right:18px; line-height:2; font-size:0.9rem;">${notes.map((n) => `<li>${n}</li>`).join('')}</ul>`);

    body.innerHTML = html;
};

// ───────────── الاستبيانات (جهة الطالب) ─────────────
let studentOpenSurveys = [];
let studentSurveyDoneIds = new Set();
let studentSurveyUnsubs = [];
let studentSurveysError = '';
let fillingSurvey = null;

function listenToStudentSurveys() {
    if (!auth.currentUser || studentSurveyUnsubs.length) return;
    const uid = auth.currentUser.uid;
    const onErr = (err) => {
        console.warn("student surveys listener error:", err);
        studentSurveysError = err && err.code === 'permission-denied'
            ? 'تعذّر تحميل الاستبيانات (صلاحيات). أبلغ المشرف لنشر قواعد Firestore الجديدة.'
            : 'تعذّر تحميل الاستبيانات حالياً. حدّث الصفحة وحاول مرة أخرى.';
        renderStudentSurveysCard();
    };
    studentSurveyUnsubs.push(onSnapshot(query(collection(db, "surveys"), where("status", "==", "open")), (snap) => {
        studentSurveysError = '';
        studentOpenSurveys = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.type === b.type ? 0 : a.type === 'pre' ? -1 : 1));
        renderStudentSurveysCard();
    }, onErr));
    studentSurveyUnsubs.push(onSnapshot(query(collection(db, "surveyResponses"), where("studentId", "==", uid)), (snap) => {
        studentSurveyDoneIds = new Set(snap.docs.map((d) => d.data().surveyId));
        renderStudentSurveysCard();
    }, onErr));
}

function stopStudentSurveys() {
    studentSurveyUnsubs.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
    studentSurveyUnsubs = [];
    studentOpenSurveys = [];
    studentSurveyDoneIds = new Set();
    const card = document.getElementById('studentSurveysCard');
    if (card) card.style.display = 'none';
}

function renderStudentSurveysCard() {
    const card = document.getElementById('studentSurveysCard');
    const list = document.getElementById('studentSurveysList');
    if (!card || !list) return;
    if (!currentUserData || currentUserData.role !== 'student') {
        card.style.display = 'none';
        return;
    }
    const badgeEl = document.getElementById('studentSurveysBadge');

    if (studentSurveysError) {
        card.style.display = 'block';
        card.style.borderColor = 'var(--border-color)';
        if (badgeEl) { badgeEl.textContent = 'تعذّر التحميل'; badgeEl.style.background = '#dc2626'; }
        list.innerHTML = `<p style="text-align:center; color:var(--danger-color); padding:10px; line-height:1.9;">${escapeHtml(studentSurveysError)}</p>`;
        return;
    }

    // الاستبيان اللي الطالب سلّمه بيختفي من عنده (إجابته محفوظة عند الإدارة)
    const pendingSurveys = studentOpenSurveys.filter((s) => !studentSurveyDoneIds.has(s.id));
    if (pendingSurveys.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    card.style.borderColor = '#f59e0b';
    if (badgeEl) {
        badgeEl.textContent = `${pendingSurveys.length} بانتظارك`;
        badgeEl.style.background = '#f59e0b';
    }
    list.innerHTML = pendingSurveys.map((s) => `
        <div style="background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:14px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
            <div style="flex:1; min-width:200px;">
                <h4 style="color:#0f172a; font-size:1rem;">${escapeHtml(s.title || 'استبيان')}</h4>
                <small style="color:#64748b;">${escapeHtml(SURVEY_TYPE_LABELS[s.type] || '')} | ${(s.questions || []).length} سؤال | يستغرق دقائق قليلة</small>
            </div>
            <button type="button" class="auth-btn" style="padding:9px 18px; background-color:#f59e0b;" onclick="openSurveyFill('${s.id}')"><i class="fa-solid fa-pen"></i> ابدأ الاستبيان</button>
        </div>`).join('');
}

window.openSurveyFill = (id) => {
    if (!currentUserData || currentUserData.role !== 'student') return;
    const s = studentOpenSurveys.find((x) => x.id === id);
    if (!s) { showToast("هذا الاستبيان لم يعد متاحاً."); return; }
    if (studentSurveyDoneIds.has(id)) { showToast("سبق وأرسلت إجابتك على هذا الاستبيان."); return; }
    fillingSurvey = s;
    document.getElementById('surveyFillTitle').textContent = s.title || 'استبيان';
    const desc = document.getElementById('surveyFillDesc');
    desc.textContent = s.description || '';
    desc.style.display = s.description ? 'block' : 'none';

    const optStyle = 'display:flex; align-items:center; gap:6px; padding:8px 12px; border:1px solid var(--border-color); border-radius:10px; cursor:pointer; font-size:0.85rem; background:#fff;';
    document.getElementById('surveyFillQuestions').innerHTML = (s.questions || []).map((q, i) => {
        let input = '';
        if (q.type === 'scale') {
            input = `<div style="display:flex; flex-wrap:wrap; gap:6px;">${SURVEY_SCALE_LABELS.map((l, k) => `<label style="${optStyle}"><input type="radio" name="sq_${i}" value="${5 - k}"> <span style="background:${ANALYTICS_LEVEL_COLORS_SAFE[4 - k]}; color:#fff; border-radius:50%; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; font-size:0.75rem; font-weight:800;">${5 - k}</span> ${escapeHtml(SURVEY_SCALE_LABELS[4 - k])}</label>`).join('')}</div>`;
        } else if (q.type === 'choice') {
            input = `<div style="display:flex; flex-direction:column; gap:6px;">${(q.options || []).map((o) => `<label style="${optStyle}"><input type="radio" name="sq_${i}" value="${escapeHtml(o)}"> ${escapeHtml(o)}</label>`).join('')}</div>`;
        } else {
            input = `<textarea name="sq_${i}" rows="3" maxlength="500" placeholder="اكتب إجابتك (اختياري)" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:10px; font-family:inherit;"></textarea>`;
        }
        return `<div id="sqbox_${i}" style="border:1px solid var(--border-color); border-radius:14px; padding:14px; margin-bottom:12px;">
            <div style="font-weight:800; color:#0f172a; margin-bottom:10px;">${i + 1}. ${escapeHtml(q.text)}</div>${input}</div>`;
    }).join('');

    // تمييز الاختيار المحدد
    document.getElementById('surveyFillQuestions').onchange = (ev) => {
        const t = ev.target;
        if (!t || t.type !== 'radio') return;
        document.querySelectorAll(`#surveyFillQuestions input[name="${t.name}"]`).forEach((r) => {
            const lab = r.closest('label');
            if (!lab) return;
            lab.style.borderColor = r.checked ? 'var(--primary-color)' : 'var(--border-color)';
            lab.style.background = r.checked ? 'var(--primary-light)' : '#fff';
            lab.style.fontWeight = r.checked ? '800' : '400';
        });
    };
    document.getElementById('surveyFillModal').style.display = 'flex';
};

window.closeSurveyFill = () => {
    document.getElementById('surveyFillModal').style.display = 'none';
    fillingSurvey = null;
};

window.submitSurveyFill = async (e) => {
    e.preventDefault();
    const s = fillingSurvey;
    if (!s || !auth.currentUser || !currentUserData || currentUserData.role !== 'student') return;

    const answers = {};
    const qs = s.questions || [];
    for (let i = 0; i < qs.length; i++) {
        const q = qs[i];
        if (q.type === 'text') {
            const v = (document.querySelector(`#surveyFillQuestions textarea[name="sq_${i}"]`)?.value || '').trim().slice(0, 500);
            if (v) answers[q.id] = v;
        } else {
            const checked = document.querySelector(`#surveyFillQuestions input[name="sq_${i}"]:checked`);
            if (!checked) {
                showToast(`من فضلك أجب عن السؤال رقم ${i + 1}.`);
                document.getElementById(`sqbox_${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            answers[q.id] = q.type === 'scale' ? Number(checked.value) : checked.value;
        }
    }

    const btn = document.getElementById('surveyFillSubmitBtn');
    if (btn) btn.disabled = true;
    try {
        const uid = auth.currentUser.uid;
        await setDoc(doc(db, "surveyResponses", `${s.id}_${uid}`), {
            surveyId: s.id,
            studentId: uid,
            studentName: currentUserData.name || '',
            school: currentUserData.school || currentUserData.schoolName || '',
            specialistId: currentUserData.addedBy || '',
            answers,
            submittedAt: serverTimestamp()
        });
        showToast("شكراً لك! تم إرسال إجابتك بنجاح.");
        closeSurveyFill();
    } catch (err) {
        const denied = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
        showToast(denied ? "تعذّر الإرسال: الاستبيان أُغلق أو سبق وأرسلت إجابتك." : "خطأ أثناء الإرسال: " + err.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

let adminMessagesCache = [];
let adminMessagesListenerStarted = false;

function loadAdminContactMessages() {
    const container = document.getElementById('adminMessagesList');
    if (!container) return;
    if (adminMessagesListenerStarted) { renderAdminMessagesList(); return; }
    adminMessagesListenerStarted = true;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري التحميل...</p>';

    const q = query(collection(db, "contactMessages"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        adminMessagesCache = [];
        snapshot.forEach((docSnap) => { adminMessagesCache.push({ id: docSnap.id, ...docSnap.data() }); });
        renderAdminMessagesList();

        const unreadCount = adminMessagesCache.filter(m => !m.read).length;
        const badge = document.getElementById('unreadMessagesBadge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
            badge.innerText = unreadCount;
        }
    });
}

window.renderAdminMessagesList = () => {
    const container = document.getElementById('adminMessagesList');
    if (!container) return;

    container.innerHTML = '';
    if (adminMessagesCache.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد رسائل تواصل حالياً.</p>';
        return;
    }

    adminMessagesCache.forEach((msg) => {
        const date = msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('ar-EG') : '';
        const item = document.createElement('div');
        item.style.cssText = `background:#f8fafc; padding:14px; border-radius:10px; border:1px solid var(--border-color); ${!msg.read ? 'border-right:4px solid var(--primary-color);' : ''}`;
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                <div>
                    <h5 style="color:#0f172a; font-size:0.95rem;">${escapeHtml(msg.name || 'بدون اسم')}
                        ${!msg.read ? '<span style="font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:10px; background:var(--primary-light); color:var(--primary-color); margin-right:6px;">جديدة</span>' : ''}
                    </h5>
                    <small style="color:#64748b; direction:ltr; display:inline-block;">${escapeHtml(msg.email || '-')}</small>
                </div>
                <small style="color:#64748b; font-size:0.75rem; white-space:nowrap;">${date}</small>
            </div>
            <p style="color:#1e293b; font-size:0.9rem; line-height:1.6; margin-bottom:12px; background:#fff; padding:10px; border-radius:8px; border:1px solid var(--border-color);">${escapeHtml(msg.message || '')}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${msg.senderId ? `<button onclick="adminReplyToMessage('${msg.id}', '${msg.senderId}', decodeURIComponent('${safeJsArg(msg.name || 'الطالب')}'), '${msg.senderRole || ''}')" style="background:var(--accent-green); color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-reply"></i> الرد </button>` : ''}
                ${!msg.read ? `<button onclick="adminMarkMessageRead('${msg.id}')" style="background:var(--primary-light); color:var(--primary-color); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-check"></i> تحديد كمقروءة</button>` : ''}
                <button onclick="adminDeleteMessage('${msg.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        container.appendChild(item);
    });
};

window.adminReplyToMessage = async (messageId, studentId, studentName, studentRole) => {
    if (!currentUserData || currentUserData.role !== 'admin' || !auth.currentUser) return;
    const adminId = auth.currentUser.uid;
    const adminName = currentUserData.name || 'إدارة المنصة';
    const adminRoleLabel = getRoleLabel('admin');
    const studentRoleLabel = getRoleLabel(studentRole || 'student');
    activeChatRoomId = adminId < studentId ? `${adminId}_${studentId}_contact` : `${studentId}_${adminId}_contact`;

    try {
        await setDoc(doc(db, "chatRooms", activeChatRoomId), {
            participants: [adminId, studentId],
            participantNames: { [adminId]: adminName, [studentId]: studentName },
            participantRoles: { [adminId]: adminRoleLabel, [studentId]: studentRoleLabel },
            projectTitle: "استفسار عبر نموذج تواصل معنا",
            isAdminChat: true,
            updatedAt: serverTimestamp()
        }, { merge: true });

        await updateDoc(doc(db, "contactMessages", messageId), { read: true });
    } catch (err) {
        showToast("تعذر فتح المحادثة: " + err.message);
        return;
    }

    closeAdminDashboardModal();
    document.getElementById('chatOwnerName').innerText = studentName;
    document.getElementById('chatProjectTitle').innerText = studentRoleLabel;
    document.getElementById('chatBox').style.display = 'flex';
    listenToMessages();
};

window.adminMarkMessageRead = async (messageId) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    try {
        await updateDoc(doc(db, "contactMessages", messageId), { read: true });
    } catch (err) {
        showToast("خطأ أثناء التحديث: " + err.message);
    }
};

window.adminDeleteMessage = async (messageId) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة نهائياً؟")) return;
    try {
        await deleteDoc(doc(db, "contactMessages", messageId));
    } catch (err) {
        showToast("خطأ أثناء الحذف: " + err.message);
    }
};

async function loadAdminStatsAndProjects() {
    const projectsContainer = document.getElementById('adminAllProjectsList');
    const totalProjectsEl = document.getElementById('adminTotalProjects');
    
    projectsContainer.innerHTML = '<p style="text-align:center;">جاري تحميل البيانات...</p>';
    totalProjectsEl.innerText = allProjectsCache.length;
    
    projectsContainer.innerHTML = '';
    if (allProjectsCache.length === 0) {
        projectsContainer.innerHTML = '<p style="text-align:center; color:var(--text-muted);">لا توجد مشاريع مسجلة حالياً.</p>';
        return;
    }

    allProjectsCache.forEach(project => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px; border-radius:10px; border:1px solid var(--border-color); margin-bottom: 8px; gap:10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div style="flex:1; min-width:200px;">
                <h5 style="color:#0f172a; font-size:0.9rem;">${escapeHtml(project.title)}</h5>
                <small style="color:#64748b; font-size:0.75rem; word-break:break-word;">المالك: ${escapeHtml(project.ownerName)} | المرحلة: ${escapeHtml(project.stage)}</small>
            </div>
            <div style="display:flex; gap: 5px; flex-shrink:0;">
                <button onclick="adminDeleteProject('${project.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        projectsContainer.appendChild(item);
    });
}

window.adminDeleteProject = async (projectId) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (confirm("هل أنت متأكد من حذف هذا المشروع كمسؤول للنظام؟")) {
        try {
            await deleteDoc(doc(db, "projects", projectId));
            await deleteDoc(doc(db, "publicProjectSummaries", projectId)).catch(() => {});
            showToast("تم حذف المشروع بنجاح.");
            loadAdminStatsAndProjects();
        } catch (err) {
            showToast("خطأ أثناء الحذف: " + err.message);
        }
    }
};

window.openTrainerAssignmentModal = () => {
    const typeBox = document.getElementById('assignmentTypeBox');
    if (typeBox) typeBox.style.display = (currentUserData && currentUserData.role === 'specialist') ? 'block' : 'none';
    const indRadio = document.querySelector('input[name="assignmentType"][value="individual"]');
    if (indRadio) indRadio.checked = true;
    onAssignmentTypeChange();
    renderAssignmentGroupSelect();
    document.getElementById('trainerAssignmentModal').style.display = 'flex';
    loadTrainerPublishedAssignments();
};

window.closeTrainerAssignmentModal = () => {
    document.getElementById('trainerAssignmentModal').style.display = 'none';
};

window.handleTrainerCreateAssignment = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || !['trainer', 'specialist'].includes(currentUserData.role)) return;
    const creatorRole = currentUserData.role;
    const creatorLabel = creatorRole === 'specialist' ? 'الأخصائي' : 'المدرب';

    const av = runValidation([
        { id: 'trainerAssignmentTitle', key: 'title', fn: (x) => V.text(x, { label: 'عنوان الواجب', min: 3, max: 100 }) },
        { id: 'trainerAssignmentDesc', key: 'description', fn: (x) => V.text(x, { label: 'وصف الواجب', min: 10, max: 3000, multiline: true }) }
    ]);
    if (!av) return;
    const title = av.title;
    const description = av.description;

    const assignmentData = {
        title: title,
        description: description,
        trainerId: auth.currentUser.uid,
        trainerName: currentUserData.name || auth.currentUser.displayName,
        creatorRole: creatorRole,
        createdAt: serverTimestamp()
    };

    let notifyMessage = `أضاف ${creatorLabel} واجب جديد: "${title}"`;
    let notifyAudienceIds = null;
    if (creatorRole === 'specialist') {
        const type = document.querySelector('input[name="assignmentType"]:checked')?.value || 'individual';
        if (type === 'group') {
            const groupId = document.getElementById('assignmentGroupSelect')?.value || '';
            const group = studentGroupsCache.find((g) => g.id === groupId);
            if (!group) { showToast("اختر المجموعة التي سيُسند لها الواجب."); return; }
            assignmentData.assignmentType = 'group';
            assignmentData.groupId = group.id;
            assignmentData.groupName = group.name;
            notifyMessage = `أضاف ${creatorLabel} واجباً جماعياً لمجموعة "${group.name}": "${title}"`;
            notifyAudienceIds = group.memberIds || [];
        } else {
            assignmentData.assignmentType = 'individual';
            assignmentData.audience = 'my-students';
        }
    }

    try {
        await addDoc(collection(db, "trainerAssignments"), assignmentData);
        await addDoc(collection(db, "notifications"), {
            title: "تكليف دراسي جديد",
            message: notifyMessage,
            type: "assignment",
            ...(notifyAudienceIds ? { audienceIds: notifyAudienceIds } : {}),
            createdAt: serverTimestamp()
        });

        showToast("تم نشر الواجب وإرسال إشعار فوري لجميع الطلبة بنجاح!");
        document.getElementById('trainerAssignmentTitle').value = '';
        document.getElementById('trainerAssignmentDesc').value = '';
        const indRadio = document.querySelector('input[name="assignmentType"][value="individual"]');
        if (indRadio) indRadio.checked = true;
        onAssignmentTypeChange();
        loadTrainerPublishedAssignments();
    } catch (err) {
        showToast("حدث خطأ أثناء نشر الواجب: " + err.message);
    }
};

function loadTrainerPublishedAssignments() {
    if (!auth.currentUser) return;
    const container = document.getElementById('trainerAssignmentsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">جاري التحميل...</p>';

    const q = query(collection(db, "trainerAssignments"), where("trainerId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:10px;">لم تقم بنشر أي واجبات بعد.</p>';
            return;
        }
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const item = document.createElement('div');
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 14px; border-radius:8px; border:1px solid var(--border-color); gap:10px; flex-wrap:wrap;";
            item.innerHTML = `
                <div style="flex:1; min-width:180px;">
                    <h5 style="color:#0f172a; font-size:0.9rem;">${escapeHtml(data.title)}${data.assignmentType === 'group' ? ` <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:#cffafe; color:#0e7490;">جماعي: ${escapeHtml(data.groupName || '')}</span>` : ''}</h5>
                    <small style="color:#64748b; word-break:break-word;">${escapeHtml(data.description.substring(0, 40))}...</small>
                </div>
                <button onclick="deleteTrainerAssignment('${id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem; flex-shrink:0;"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(item);
        });
    });
}

window.deleteTrainerAssignment = async (id) => {
    if (!currentUserData || !['trainer', 'specialist'].includes(currentUserData.role) || !auth.currentUser) return;
    if (confirm("هل تريد حذف هذا الواجب المنشور نهائياً؟")) {
        try {
            const snap = await getDoc(doc(db, "trainerAssignments", id));
            if (!snap.exists() || snap.data().trainerId !== auth.currentUser.uid) {
                showToast("لا تملك صلاحية حذف هذا الواجب لأنه ليس من إنشائك.");
                return;
            }
            await deleteDoc(doc(db, "trainerAssignments", id));
        } catch (err) {
            showToast("خطأ أثناء الحذف: " + err.message);
        }
    }
};

let trainerAssignmentsCache = [];
let mySubmissionsMap = {};
let hiddenAssignmentIds = [];
let myGroupsCache = [];
let groupSubmissionsMap = {};
let myGroupsUnsub = null;
let groupSubsUnsubs = [];

function listenToMyGroups() {
    if (!auth.currentUser || myGroupsUnsub) return;
    const q = query(collection(db, "studentGroups"), where("memberIds", "array-contains", auth.currentUser.uid));
    myGroupsUnsub = onSnapshot(q, (snapshot) => {
        myGroupsCache = [];
        snapshot.forEach((d) => myGroupsCache.push({ id: d.id, ...d.data() }));
        listenToMyGroupSubmissions();
        renderStudentAssignments();
    }, (err) => console.error("myGroups listener error:", err));
}

function listenToMyGroupSubmissions() {
    groupSubsUnsubs.forEach((u) => u());
    groupSubsUnsubs = [];
    if (!auth.currentUser || myGroupsCache.length === 0) { groupSubmissionsMap = {}; renderStudentAssignments(); return; }

    // قواعد Firestore بتسمح بقراءة التسليم الجماعي بس لو الاستعلام نفسه مقيّد بعضوية الطالب،
    // عشان كده بنستعلم بـ memberIds array-contains uid (بدل where groupId in [...] اللي كان بيترفض).
    const q = query(collection(db, "studentSubmissions"), where("memberIds", "array-contains", auth.currentUser.uid));
    groupSubsUnsubs.push(onSnapshot(q, (snapshot) => {
        groupSubmissionsMap = {};
        snapshot.docs.forEach((d) => {
            const s = { id: d.id, ...d.data() };
            if (s.groupId) groupSubmissionsMap[s.assignmentId] = s;
        });
        renderStudentAssignments();
    }, (err) => console.error("groupSubmissions listener error:", err)));
}

function loadStudentActiveAssignments() {
    if (!auth.currentUser) return;
    listenToMyGroups();
    hiddenAssignmentIds = (currentUserData && Array.isArray(currentUserData.hiddenAssignmentIds)) ? currentUserData.hiddenAssignmentIds : [];

    const q = query(collection(db, "trainerAssignments"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        trainerAssignmentsCache = [];
        snapshot.forEach((docSnap) => { trainerAssignmentsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        renderStudentAssignments();
    });

    const subQ = query(collection(db, "studentSubmissions"), where("studentId", "==", auth.currentUser.uid));
    onSnapshot(subQ, (snapshot) => {
        mySubmissionsMap = {};
        snapshot.forEach((docSnap) => { mySubmissionsMap[docSnap.data().assignmentId] = { id: docSnap.id, ...docSnap.data() }; });
        renderStudentAssignments();
    });
}

function renderStudentAssignments() {
    const container = document.getElementById('studentActiveAssignmentsList');
    if (!container) return;

    const myGroupIds = myGroupsCache.map((g) => g.id);
    const visibleAssignments = trainerAssignmentsCache.filter((a) => {
        if (hiddenAssignmentIds.includes(a.id)) return false;
        // لا تظهر للطالب إلا الواجبات المنشورة بعد تاريخ أول تسجيل دخول له
        const joinedMs = currentUserData?.createdAt?.toMillis?.();
        const assignedMs = a.createdAt?.toMillis?.();
        if (joinedMs && assignedMs && assignedMs < joinedMs) return false;
        if (a.assignmentType === 'group') return myGroupIds.includes(a.groupId);              // واجب جماعي: لأعضاء المجموعة فقط
        if (a.audience === 'my-students') return !!currentUserData && currentUserData.addedBy === a.trainerId; // فردي من أخصائي: لطلبته فقط
        return true;
    });

    container.innerHTML = '';
    if (visibleAssignments.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:15px;">لا توجد واجبات أو تكاليف مطلوبة من المدرب حالياً.</p>';
        return;
    }

    visibleAssignments.forEach((assignment) => {
        const assignmentId = assignment.id;
        const submission = mySubmissionsMap[assignmentId] || groupSubmissionsMap[assignmentId];
        const isGroupAssignment = assignment.assignmentType === 'group';
        const myGroup = isGroupAssignment ? myGroupsCache.find((g) => g.id === assignment.groupId) : null;
        const submissionLabel = (submission && submission.groupId)
            ? `تم تسليم الحل ضمن مجموعتك «${escapeHtml(submission.groupName || '')}» ${submission.submittedBy === auth.currentUser.uid ? 'بواسطتك' : 'بواسطة ' + escapeHtml(submission.studentName || '')}`
            : 'تم تسليم الحل';
        const groupInfoHtml = isGroupAssignment ? `
            <small style="color:#0e7490; font-size:0.8rem; font-weight:800; display:block; margin-bottom:10px;"><i class="fa-solid fa-people-group"></i> واجب جماعي — مجموعة «${escapeHtml(assignment.groupName || '')}»${myGroup ? ' | الأعضاء: ' + Object.values(myGroup.memberNames || {}).map(escapeHtml).join('، ') : ''}</small>
        ` : '';

        const assignmentCard = document.createElement('div');
        assignmentCard.style.cssText = "background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:18px;";

        const bodyHtml = submission ? `
                <div style="background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #bbf7d0; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="color:#15803d; font-weight:700; font-size:0.85rem;"><i class="fa-solid fa-circle-check"></i> ${submissionLabel}${submission.graded ? ` — الدرجة: ${submission.grade}/100` : ' — بانتظار التقييم'}</span>
                    <button onclick="dismissAssignmentFromList('${assignmentId}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف من القائمة</button>
                </div>
            ` : `
                <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color); overflow:hidden;">
                    <form onsubmit="handleStudentSubmitSolution(event, '${assignmentId}')" style="display:flex; flex-direction:column; gap:10px;">
                        <input type="hidden" id="solutionAssignmentTitle_${assignmentId}" value="${escapeHtml(assignment.title || '')}">
                        <textarea id="solutionInput_${assignmentId}" class="solution-input" required rows="3" placeholder="اكتب إجابتك هنا مباشرةً، أو ضع رابط Google Drive إذا كان الحل ملف..." style="width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:6px; font-size:0.85rem; box-sizing:border-box; color:#0f172a; background:#fff; resize:vertical; font-family:inherit;"></textarea>
                        ${isGroupAssignment ? '<small style="color:#0e7490; font-weight:700;">تسليمك سيُحتسب لكل أعضاء المجموعة، وسيظهر لهم أن الواجب تم تسليمه.</small>' : ''}
                        <button type="submit" class="auth-btn" style="align-self:flex-end; padding:9px 16px; font-size:0.85rem; background-color:#7c3aed; white-space:nowrap;">${isGroupAssignment ? 'تسليم الحل للمجموعة' : 'تسليم الحل'}</button>
                    </form>
                </div>
            `;

        assignmentCard.innerHTML = `
            <h4 style="color:#0f172a; font-size:1.05rem; margin-bottom:6px;"><i class="fa-solid fa-book-open" style="color:var(--primary-color);"></i> ${escapeHtml(assignment.title)}</h4>
            <small style="color:#0f172a; font-size:0.8rem; font-weight:900;  display:block; margin-bottom:10px;"><i class="fa-solid fa-chalkboard-user"></i> بواسطة ${assignment.creatorRole === 'specialist' ? 'الأخصائي' : 'المدرب'}: ${escapeHtml(assignment.trainerName || 'غير محدد')}</small>
            ${groupInfoHtml}
            <p style="color:#0f172a; font-size:0.9rem; margin-bottom:14px; font-weight:900;  line-height:1.6;">${escapeHtml(assignment.description)}</p>
            ${bodyHtml}
        `;
        container.appendChild(assignmentCard);
    });
}

window.dismissAssignmentFromList = async (assignmentId) => {
    if (!auth.currentUser) return;
    if (!hiddenAssignmentIds.includes(assignmentId)) hiddenAssignmentIds.push(assignmentId);
    renderStudentAssignments();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { hiddenAssignmentIds: arrayUnion(assignmentId) });
    } catch (err) {
        console.error("dismissAssignmentFromList error:", err);
    }
};

window.handleStudentSubmitSolution = async (e, assignmentId) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'student') return;
    const answerInput = document.getElementById(`solutionInput_${assignmentId}`);
    const titleInput = document.getElementById(`solutionAssignmentTitle_${assignmentId}`);
    const sol = runValidation([
        { id: `solutionInput_${assignmentId}`, key: 'answer', fn: (x) => V.text(x, { label: 'الحل', min: 3, max: 2000, multiline: true }) }
    ]);
    if (!sol) return;
    const answer = sol.answer;

    const relatedAssignment = trainerAssignmentsCache.find(a => a.id === assignmentId);

    let group = null;
    if (relatedAssignment && relatedAssignment.assignmentType === 'group') {
        group = myGroupsCache.find((g) => g.id === relatedAssignment.groupId);
        if (!group) { showToast("هذا الواجب مخصص لمجموعة لست عضواً فيها."); return; }
        if (groupSubmissionsMap[assignmentId]) { showToast("تم تسليم هذا الواجب بالفعل من أحد أعضاء مجموعتك."); return; }
    }

    const solutionData = {
        assignmentId: assignmentId,
        assignmentTitle: titleInput ? titleInput.value : '',
        trainerId: relatedAssignment ? (relatedAssignment.trainerId || null) : null,
        fileLink: answer,
        studentId: auth.currentUser.uid,
        studentName: currentUserData.name || auth.currentUser.displayName,
        studentEmail: currentUserData.email || auth.currentUser.email || '',
        studentGradeLevel: currentUserData.grade || '',
        school: currentUserData.school || "غير متوفر",
        grade: null,
        feedback: "",
        graded: false,
        createdAt: serverTimestamp()
    };

    if (group) {
        Object.assign(solutionData, {
            groupId: group.id,
            groupName: group.name,
            memberIds: group.memberIds || [],
            memberNames: group.memberNames || {},
            submittedBy: auth.currentUser.uid
        });
    }

    try {
        if (group) {
            // معرّف ثابت (واجب + مجموعة) يمنع تسليمين لنفس المجموعة
            await setDoc(doc(db, "studentSubmissions", `${assignmentId}_${group.id}`), solutionData);
            showToast("تم تسليم الحل لكل أعضاء المجموعة بنجاح!");
            // إشعار لباقي أعضاء المجموعة (لا يمنع نجاح التسليم لو فشل)
            try {
                const others = (group.memberIds || []).filter((id) => id !== auth.currentUser.uid);
                if (others.length > 0) {
                    await addDoc(collection(db, "notifications"), {
                        title: "تم تسليم واجب مجموعتك",
                        message: `سلّم ${solutionData.studentName || 'أحد أعضاء المجموعة'} واجب "${solutionData.assignmentTitle}" نيابةً عن مجموعة "${group.name}" — لا تحتاج لتسليمه مرة أخرى.`,
                        type: "assignment",
                        audienceIds: others,
                        createdAt: serverTimestamp()
                    });
                }
            } catch (notifyErr) { console.error("group submit notify error:", notifyErr); }
        } else {
            await addDoc(collection(db, "studentSubmissions"), solutionData);
            showToast(`تم إرسال حل الواجب بنجاح إلى ${relatedAssignment && relatedAssignment.creatorRole === 'specialist' ? 'الأخصائي' : 'المدرب'}!`);
        }
        answerInput.value = '';
    } catch (err) {
        showToast("حدث خطأ أثناء تسليم الحل: " + err.message);
    }
};

let allSubmissionsCache = [];
let assignmentsTitleMap = {};

window.openTrainerSubmissionsModal = () => {
    document.getElementById('trainerSubmissionsModal').style.display = 'flex';
    renderTrainerSubmissions();
};

window.closeTrainerSubmissionsModal = () => {
    document.getElementById('trainerSubmissionsModal').style.display = 'none';
};

function listenToAssignmentTitlesMap() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "trainerAssignments"), where("trainerId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        assignmentsTitleMap = {};
        const filterSelect = document.getElementById('submissionsAssignmentFilter');
        const currentVal = filterSelect ? filterSelect.value : 'all';
        if (filterSelect) filterSelect.innerHTML = '<option value="all">كل الواجبات</option>';

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            assignmentsTitleMap[docSnap.id] = data.title;
            if (filterSelect) {
                const opt = document.createElement('option');
                opt.value = docSnap.id;
                opt.textContent = data.title;
                filterSelect.appendChild(opt);
            }
        });
        if (filterSelect) filterSelect.value = currentVal;
        renderTrainerSubmissions();
    });
}

function listenToTrainerSubmissions() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "studentSubmissions"), where("trainerId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allSubmissionsCache = [];
        snapshot.forEach((docSnap) => { allSubmissionsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        updatePendingSubmissionsBadge();
        renderTrainerSubmissions();
        renderTrainerLeaderboard();
        renderTrainerStudentsList();
    });
}

window.openTrainerLeaderboardModal = () => {
    document.getElementById('trainerLeaderboardModal').style.display = 'flex';
    const titleEl = document.getElementById('trainerLeaderboardTitle');
    if (titleEl) {
        titleEl.innerHTML = (currentUserData && currentUserData.role === 'specialist')
            ? '<i class="fa-solid fa-trophy"></i> ترتيب طلبة مدرستي'
            : '<i class="fa-solid fa-trophy"></i> ترتيب الطلبة حسب التقييمات';
    }
    renderTrainerLeaderboard();
};
window.closeTrainerLeaderboardModal = () => {
    document.getElementById('trainerLeaderboardModal').style.display = 'none';
};

let specialistSchoolStudentsMap = {};

function listenToSpecialistSchoolStudents() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "users"), where("addedBy", "==", auth.currentUser.uid));
    onSnapshot(q, (snapshot) => {
        specialistSchoolStudentsMap = {};
        snapshot.forEach((docSnap) => {
            const u = docSnap.data();
            if (u.role === 'student') specialistSchoolStudentsMap[docSnap.id] = { name: u.name || '', school: u.school || '' };
        });
        renderTrainerLeaderboard();
        renderGroupMembersChecklist();
    });
}

function renderTrainerLeaderboard() {
    const container = document.getElementById('trainerLeaderboardList');
    if (!container) return;

    const isSpecialist = !!(currentUserData && currentUserData.role === 'specialist');
    // Specialist: only students of his own school (registered by him). Trainer: everyone who submitted.
    const gradedSubs = [];
    allSubmissionsCache.forEach((s) => {
        if (!(s.graded && typeof s.grade === 'number')) return;
        const ids = (Array.isArray(s.memberIds) && s.memberIds.length) ? s.memberIds : [s.studentId];
        ids.forEach((id) => {
            if (isSpecialist && !specialistSchoolStudentsMap[id]) return;
            gradedSubs.push({
                ...s,
                studentId: id,
                studentName: (s.memberNames && s.memberNames[id]) || (specialistSchoolStudentsMap[id] && specialistSchoolStudentsMap[id].name) || s.studentName
            });
        });
    });
    const byStudent = {};
    gradedSubs.forEach((s) => {
        if (!byStudent[s.studentId]) {
            byStudent[s.studentId] = { studentId: s.studentId, studentName: s.studentName, school: s.school, total: 0, count: 0 };
        }
        byStudent[s.studentId].total += s.grade;
        byStudent[s.studentId].count += 1;
    });

    const ranking = Object.values(byStudent)
        .map(st => ({ ...st, avg: st.total / st.count }))
        .sort((a, b) => b.avg - a.avg);

    // Specialist: also list his registered students who have no graded work yet, after the ranked ones.
    const notGradedYet = isSpecialist
        ? Object.entries(specialistSchoolStudentsMap)
            .filter(([id]) => !byStudent[id])
            .map(([id, u]) => ({ studentId: id, studentName: u.name, school: u.school }))
        : [];

    container.innerHTML = '';
    if (ranking.length === 0 && notGradedYet.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد تقييمات كافية لعرض الترتيب حتى الآن.</p>';
        return;
    }

    const medalColors = { 1: '#f59e0b', 2: '#94a3b8', 3: '#b45309' };
    ranking.forEach((st, idx) => {
        const rank = idx + 1;
        const isTop3 = !!medalColors[rank];
        const item = document.createElement('div');
        item.style.cssText = "display:flex; align-items:center; gap:14px; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color);";
        item.innerHTML = `
            <div style="width:34px; height:34px; border-radius:50%; background:${isTop3 ? medalColors[rank] : 'var(--primary-light)'}; color:${isTop3 ? '#fff' : 'var(--primary-color)'}; display:flex; align-items:center; justify-content:center; font-weight:900; flex-shrink:0;">${rank}</div>
            <div style="flex:1;">
                <h5 style="color:#0f172a; font-size:0.95rem;">${escapeHtml(st.studentName)}</h5>
                <small style="color:#64748b;">${escapeHtml(st.school || 'غير متوفر')} | عدد الواجبات المُقيّمة: ${st.count}</small>
            </div>
            <div style="font-weight:900; font-size:1.2rem; color:var(--primary-color);">${st.avg.toFixed(1)}</div>
        `;
        container.appendChild(item);
    });

    notGradedYet.forEach((st) => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; align-items:center; gap:14px; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); opacity:0.75;";
        item.innerHTML = `
            <div style="width:34px; height:34px; border-radius:50%; background:var(--primary-light); color:var(--text-muted); display:flex; align-items:center; justify-content:center; font-weight:900; flex-shrink:0;">-</div>
            <div style="flex:1;">
                <h5 style="color:#0f172a; font-size:0.95rem;">${escapeHtml(st.studentName)}</h5>
                <small style="color:#64748b;">${escapeHtml(st.school || 'غير متوفر')} | لا توجد واجبات مُقيّمة بعد</small>
            </div>
        `;
        container.appendChild(item);
    });
}

function updatePendingSubmissionsBadge() {
    const pendingCount = allSubmissionsCache.filter(s => !s.graded).length;
    ['pendingSubmissionsBadge', 'specialistPendingSubmissionsBadge'].forEach((badgeId) => {
        const badge = document.getElementById(badgeId);
        if (!badge) return;
        if (pendingCount > 0) { badge.innerText = pendingCount; badge.style.display = 'inline-flex'; }
        else { badge.style.display = 'none'; }
    });
}

window.renderTrainerSubmissions = () => {
    const container = document.getElementById('trainerSubmissionsList');
    if (!container) return;

    const assignmentFilter = document.getElementById('submissionsAssignmentFilter')?.value || 'all';
    const statusFilter = document.getElementById('submissionsStatusFilter')?.value || 'all';

    const filtered = allSubmissionsCache.filter(s => {
        const matchesAssignment = assignmentFilter === 'all' || s.assignmentId === assignmentFilter;
        const matchesStatus = statusFilter === 'all' || (statusFilter === 'graded' ? !!s.graded : !s.graded);
        return matchesAssignment && matchesStatus;
    });

    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد تسليمات مطابقة حالياً.</p>';
        return;
    }

    filtered.forEach((sub) => {
        const title = sub.assignmentTitle || assignmentsTitleMap[sub.assignmentId] || 'واجب';
        const isGraded = !!sub.graded;
        const groupLine = sub.groupId
            ? `<small style="color:#0e7490; font-weight:800; display:block; margin-top:4px;"><i class="fa-solid fa-people-group"></i> تسليم جماعي — مجموعة «${escapeHtml(sub.groupName || '')}» | الأعضاء: ${Object.values(sub.memberNames || {}).map(escapeHtml).join('، ')}</small>`
            : '';
        const item = document.createElement('div');
        item.style.cssText = "background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:18px;";
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <div>
                    <h5 style="color:#0f172a; font-size:0.95rem;">${escapeHtml(sub.studentName)}</h5>
                    <small style="color:#64748b;">${escapeHtml(sub.school || 'غير متوفر')} | الواجب: ${escapeHtml(title)}</small>
                    ${groupLine}
                </div>
                <span style="background:${isGraded ? '#dcfce7' : '#fef3c7'}; color:${isGraded ? '#15803d' : '#b45309'}; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:800; white-space:nowrap;">
                    ${isGraded ? `تم التقييم: ${escapeHtml(sub.grade)}/100` : 'بانتظار التقييم'}
                </span>
            </div>
            ${/^https?:\/\//i.test(String(sub.fileLink || '').trim())
                ? `<a href="${safeUrl(sub.fileLink)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; color:var(--primary-color); font-weight:700; font-size:0.85rem; margin-bottom:14px;">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح رابط الحل
                   </a>`
                : `<div style="background:#fff; border:1px solid var(--border-color); border-radius:8px; padding:12px; margin-bottom:14px; color:#1e293b; font-size:0.85rem; line-height:1.6; white-space:pre-wrap;">${escapeHtml(sub.fileLink || '')}</div>`
            }
            <form onsubmit="handleGradeSubmission(event, '${sub.id}')" style="display:flex; flex-direction:column; gap:10px; background:#fff; padding:14px; border-radius:8px; border:1px solid var(--border-color);">
                <div style="display:flex; gap:10px; align-items:center;">
                    <label style="font-size:0.85rem; font-weight:700; white-space:nowrap; color:#0f172a;">الدرجة (من 100)</label>
                    <input type="number" min="0" max="100" required id="gradeInput_${sub.id}" value="${sub.grade ?? ''}" style="width:90px; padding:8px; border:1px solid var(--border-color); border-radius:6px; color:#0f172a; background:#fff;">
                </div>
                <textarea id="feedbackInput_${sub.id}" class="solution-input" rows="2" placeholder="ملاحظاتك وتعليقاتك على الحل..." style="color:#0f172a; background:#fff;">${escapeHtml(sub.feedback || '')}</textarea>
                <button type="submit" class="auth-btn" style="padding:9px; font-size:0.85rem; justify-content:center; background-color:${isGraded ? '#0d9488' : '#b45309'};">
                    <i class="fa-solid fa-check"></i> ${isGraded ? 'تحديث التقييم' : 'حفظ التقييم وإرساله للطالب'}
                </button>
            </form>
        `;
        container.appendChild(item);
    });
};

window.handleGradeSubmission = async (e, submissionId) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || !['trainer', 'specialist'].includes(currentUserData.role)) return;

    const gradeInput = document.getElementById(`gradeInput_${submissionId}`);
    const feedbackInput = document.getElementById(`feedbackInput_${submissionId}`);
    const gradeVal = Number(gradeInput.value);
    const feedbackVal = feedbackInput.value.trim();

    if (isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100) {
        showToast("يرجى إدخال درجة صحيحة بين 0 و 100.");
        return;
    }

    const submission = allSubmissionsCache.find(s => s.id === submissionId);
    if (!submission) return;
    if (submission.trainerId && submission.trainerId !== auth.currentUser.uid) {
        showToast("لا تملك صلاحية تقييم هذا التسليم لأنه ليس على أحد واجباتك.");
        return;
    }

    try {
        await updateDoc(doc(db, "studentSubmissions", submissionId), {
            grade: gradeVal,
            feedback: feedbackVal,
            graded: true,
            gradedBy: currentUserData.name || auth.currentUser.displayName,
            gradedAt: serverTimestamp()
        });

        const trainerId = auth.currentUser.uid;
        const title = submission.assignmentTitle || assignmentsTitleMap[submission.assignmentId] || 'واجب';
        const msgText = `تم تقييم حلك على واجب "${title}" — الدرجة: ${gradeVal}/100${feedbackVal ? ' — ملاحظات: ' + feedbackVal : ''}`;

        // تسليم جماعي: يصل التقييم لكل أعضاء المجموعة، وفردي: للطالب فقط
        const recipients = (Array.isArray(submission.memberIds) && submission.memberIds.length)
            ? submission.memberIds.map((id) => ({ id, name: (submission.memberNames && submission.memberNames[id]) || '' }))
            : [{ id: submission.studentId, name: submission.studentName }];

        for (const r of recipients) {
            const studentId = r.id;
            const roomId = trainerId < studentId ? `${trainerId}_${studentId}_grade` : `${studentId}_${trainerId}_grade`;

            await setDoc(doc(db, "chatRooms", roomId), {
                participants: [trainerId, studentId],
                participantNames: {
                    [trainerId]: currentUserData.name || auth.currentUser.displayName,
                    [studentId]: r.name
                },
                projectTitle: `تقييم واجب: ${title}`,
                updatedAt: serverTimestamp()
            }, { merge: true });

            await addDoc(collection(db, "chatRooms", roomId, "messages"), {
                text: encryptMessage(msgText, roomId),
                senderId: trainerId,
                timestamp: serverTimestamp()
            });

            await setDoc(doc(db, "chatRooms", roomId), {
                lastMessage: encryptMessage(msgText, roomId),
                updatedAt: serverTimestamp(),
                [`unreadCount.${studentId}`]: increment(1)
            }, { merge: true });
        }

        showToast("تم حفظ التقييم وإرسال إشعار فوري للطالب بنجاح!");
    } catch (err) {
        showToast("حدث خطأ أثناء حفظ التقييم: " + err.message);
    }
};

window.openTrainerStudentsModal = () => {
    document.getElementById('trainerStudentsModal').style.display = 'flex';
    loadAllPlatformStudents();
};
window.closeTrainerStudentsModal = () => {
    document.getElementById('trainerStudentsModal').style.display = 'none';
};

function loadAllPlatformStudents() {
    // Students are derived live from allSubmissionsCache, which listenToTrainerSubmissions()
    // already scopes to this trainer's own assignments only (where trainerId == current trainer).
    renderTrainerStudentsList();
}

window.renderTrainerStudentsList = () => {
    const container = document.getElementById('trainerStudentsListContainer');
    if (!container) return;

    const uniqueStudents = {};
    allSubmissionsCache.forEach((s) => {
        if (s.studentId && !uniqueStudents[s.studentId]) {
            uniqueStudents[s.studentId] = {
                id: s.studentId,
                name: s.studentName,
                email: s.studentEmail || '',
                school: s.school,
                grade: s.studentGradeLevel || ''
            };
        }
    });
    const trainerStudents = Object.values(uniqueStudents);

    const searchTerm = (document.getElementById('trainerStudentsSearchInput')?.value || '').toLowerCase();
    const filtered = trainerStudents.filter(student => {
        return (student.name || '').toLowerCase().includes(searchTerm)
            || (student.email || '').toLowerCase().includes(searchTerm)
            || (student.school || '').toLowerCase().includes(searchTerm);
    });

    container.innerHTML = '';

    if (trainerStudents.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا يوجد طلبة قاموا بتسليم واجبات لديك حتى الآن.</p>';
        return;
    }
    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد نتائج مطابقة لبحثك.</p>';
        return;
    }
    filtered.forEach((student) => {
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--bg-gradient); padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap:10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div style="flex:1; min-width:200px;">
                <h5 style="color:var(--secondary-color); font-size:0.95rem;">${escapeHtml(student.name)}</h5>
                <small style="color:var(--text-muted);">${escapeHtml(student.email)} | المدرسة: ${escapeHtml(student.school || 'غير متوفر')} | الصف: ${escapeHtml(student.grade || 'غير محدد')}</small>
            </div>
            <span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:bold; flex-shrink:0;">طالب لديك</span>
        `;
        container.appendChild(item);
    });
};

window.openAddStudentModal = () => { 
    if(currentUserData && currentUserData.school) {
        document.getElementById('studentSchool').value = currentUserData.school;
        document.getElementById('studentSchool').disabled = true;
    }
    document.querySelectorAll('#studentTraitsGrid .trait-chip').forEach(chip => {
        chip.classList.remove('active');
        chip.querySelector('input').checked = false;
    });
    document.getElementById('addStudentModal').style.display = 'flex'; 
};
window.closeAddStudentModal = () => { document.getElementById('addStudentModal').style.display = 'none'; };

window.openTrainerModal = () => { document.getElementById('trainerModal').style.display = 'flex'; };
window.closeTrainerModal = () => { document.getElementById('trainerModal').style.display = 'none'; };

window.openScheduleModal = () => { 
    document.getElementById('scheduleModal').style.display = 'flex'; 
    fetchLiveMeetingLink();
};
window.closeScheduleModal = () => { document.getElementById('scheduleModal').style.display = 'none'; };

window.openSpecialistStudentsModal = () => {
    document.getElementById('specialistStudentsModal').style.display = 'flex';
    loadSpecialistStudents();
};
window.closeSpecialistStudentsModal = () => {
    document.getElementById('specialistStudentsModal').style.display = 'none';
};

window.openStudentProfileCard = (id, status) => {
    const list = status === 'active' ? specialistActiveStudents : specialistPendingStudents;
    const s = list.find((x) => x.id === id);
    if (!s) return;
    const isActive = status === 'active';

    const statusEl = document.getElementById('spcStatus');
    statusEl.textContent = isActive ? 'مسجل ونشط' : 'بانتظار أول تسجيل دخول';
    statusEl.style.background = isActive ? '#dcfce7' : '#fef3c7';
    statusEl.style.color = isActive ? '#15803d' : '#b45309';

    const avatar = document.getElementById('spcAvatar');
    avatar.innerHTML = '';
    if (s.photo) {
        const img = document.createElement('img');
        img.src = s.photo; img.alt = '';
        img.referrerPolicy = 'no-referrer';
        img.style.cssText = 'width:100%; height:100%; object-fit:cover;';
        avatar.appendChild(img);
    } else {
        avatar.textContent = (s.name || '?').trim().charAt(0);
    }

    document.getElementById('spcName').textContent = s.name || 'بدون اسم';
    document.getElementById('spcEmail').textContent = s.email || s.id || '';

    const companies = studentGroupsCache
        .filter((g) => (g.memberIds || []).includes(id))
        .map((g) => g.company || g.name);
    const joined = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleDateString('ar-EG') : '-';

    const rows = [
        ['fa-school', 'المدرسة', s.school || s.schoolName],
        ['fa-graduation-cap', 'الصف', s.grade],
        ['fa-id-card', 'الرقم المدني', s.nationalId],
        ['fa-phone', 'رقم الهاتف', s.contactInfo],
        ['fa-building', 'الشركة الطلابية', isActive ? (companies.length ? companies.join('، ') : 'غير منضم لشركة') : null],
        ['fa-calendar-check', isActive ? 'تاريخ أول دخول' : 'حالة الحساب', isActive ? joined : 'لم يسجّل دخوله بعد']
    ];
    const traits = Array.isArray(s.traits) ? s.traits.filter(Boolean) : [];
    const traitsHtml = traits.length ? `
        <div style="background:var(--surface-muted); border:1px solid var(--border-color); border-radius:10px; padding:10px 12px;">
            <span style="color:var(--text-muted); font-size:0.82rem; display:block; margin-bottom:8px;"><i class="fa-solid fa-lightbulb" style="margin-left:6px;"></i>السمات الريادية</span>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${traits.map((t) => `<span style="font-size:0.78rem; font-weight:700; padding:4px 10px; border-radius:20px; background:#d1fae5; color:#047857;">${escapeHtml(t)}</span>`).join('')}
            </div>
        </div>` : '';

    document.getElementById('spcRows').innerHTML = rows.filter((r) => r[2] !== null).map(([icon, label, val]) => `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; background:var(--surface-muted); border:1px solid var(--border-color); border-radius:10px; padding:9px 12px;">
            <span style="color:var(--text-muted); font-size:0.82rem; white-space:nowrap;"><i class="fa-solid ${icon}" style="margin-left:6px;"></i>${label}</span>
            <strong style="font-size:0.88rem; color:var(--secondary-color); word-break:break-word; text-align:left;">${escapeHtml(String(val || '-'))}</strong>
        </div>`).join('') + traitsHtml;

    const editBtn = document.getElementById('spcEditBtn');
    if (editBtn) {
        const canEdit = !!currentUserData && currentUserData.role === 'specialist';
        editBtn.style.display = canEdit ? 'flex' : 'none';
        editBtn.onclick = () => openEditStudentModal(id, status);
    }

    document.getElementById('studentProfileModal').style.display = 'flex';
};

window.closeStudentProfileCard = () => {
    document.getElementById('studentProfileModal').style.display = 'none';
};

let editingStudentRef = null; // { id, status }

window.openEditStudentModal = (id, status) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    const list = status === 'active' ? specialistActiveStudents : specialistPendingStudents;
    const s = list.find((x) => x.id === id);
    if (!s) return;
    editingStudentRef = { id, status };

    const gradeSel = document.getElementById('editStudentGrade');
    if (!gradeSel.options.length) {
        gradeSel.innerHTML = document.getElementById('studentGrade').innerHTML;
    }
    document.getElementById('editStudentEmail').value = s.email || s.id || '';
    document.getElementById('editStudentName').value = s.name || '';
    document.getElementById('editStudentNationalId').value = s.nationalId || '';
    document.getElementById('editStudentPhone').value = s.contactInfo || '';
    gradeSel.value = s.grade || gradeSel.options[0]?.value || '';

    const schoolInput = document.getElementById('editStudentSchool');
    schoolInput.value = s.school || s.schoolName || currentUserData.school || '';
    schoolInput.disabled = !!currentUserData.school; // لو للأخصائي مدرسة مسجلة، الطالب يتبعها

    const chosen = new Set(Array.isArray(s.traits) ? s.traits : []);
    const grid = document.getElementById('editStudentTraitsGrid');
    grid.innerHTML = '';
    document.querySelectorAll('#studentTraitsGrid input[name="studentTraits"]').forEach((src) => {
        const label = document.createElement('label');
        label.className = 'trait-chip' + (chosen.has(src.value) ? ' active' : '');
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.name = 'editStudentTraits'; cb.value = src.value; cb.checked = chosen.has(src.value);
        cb.addEventListener('change', () => label.classList.toggle('active', cb.checked));
        const span = document.createElement('span');
        span.textContent = src.value;
        label.append(cb, span);
        grid.appendChild(label);
    });

    closeStudentProfileCard();
    document.getElementById('editStudentModal').style.display = 'flex';
};

window.closeEditStudentModal = () => {
    document.getElementById('editStudentModal').style.display = 'none';
    editingStudentRef = null;
};

window.handleEditStudent = async (e) => {
    e.preventDefault();
    if (!editingStudentRef || !auth.currentUser || !currentUserData || currentUserData.role !== 'specialist') return;
    const { id, status } = editingStudentRef;
    const grades = [...document.querySelectorAll('#editStudentGrade option')].map((o) => o.value);
    const schoolLocked = document.getElementById('editStudentSchool').disabled;

    const checks = [
        { id: 'editStudentName', key: 'name', fn: (x) => V.name(x, { label: 'الاسم الثلاثي للطالب' }) },
        { id: 'editStudentNationalId', key: 'nationalId', fn: V.nationalId },
        { id: 'editStudentGrade', key: 'grade', fn: (x) => V.oneOf(x, grades, 'الصف الدراسي') },
        { id: 'editStudentPhone', key: 'phone', fn: (x) => V.phone(x) }
    ];
    if (!schoolLocked) {
        checks.push({ id: 'editStudentSchool', key: 'school', fn: (x) => V.text(x, { label: 'اسم المدرسة', min: 3, max: 80 }) });
    }
    const v = runValidation(checks);
    if (!v) return;

    const updates = {
        name: v.name,
        nationalId: v.nationalId,
        grade: v.grade,
        contactInfo: v.phone,
        traits: Array.from(document.querySelectorAll('#editStudentTraitsGrid input[name="editStudentTraits"]:checked')).map((cb) => cb.value)
    };
    if (!schoolLocked) updates.school = v.school;

    try {
        if (status === 'active') {
            await updateDoc(doc(db, "users", id), updates);
            // الاسم مخزّن كمان داخل المجموعات، فنحدّثه عشان يفضل متطابق
            try {
                const gSnap = await getDocs(query(collection(db, "studentGroups"), where("ownerId", "==", auth.currentUser.uid)));
                await Promise.all(gSnap.docs
                    .filter((g) => (g.data().memberIds || []).includes(id))
                    .map((g) => updateDoc(g.ref, { memberNames: { ...(g.data().memberNames || {}), [id]: v.name } })));
            } catch (gErr) { console.warn("group names sync failed:", gErr); }
        } else {
            await updateDoc(doc(db, "preRegisteredStudents", id), updates);
        }
        showToast("تم تحديث بيانات الطالب بنجاح.");
        closeEditStudentModal();
    } catch (err) { showToast("خطأ أثناء التحديث: " + err.message); }
};

let specialistPendingStudents = [];
let specialistActiveStudents = [];

function renderSpecialistStudentsList() {
    const container = document.getElementById('specialistStudentsListContainer');
    if (!container) return;

    const all = [
        ...specialistActiveStudents.map(s => ({ ...s, _status: 'active' })),
        ...specialistPendingStudents.map(s => ({ ...s, _status: 'pending' }))
    ];

    container.innerHTML = '';
    if (all.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لم تقم بتسجيل أي طلبة حتى الآن.</p>';
        return;
    }

    const searchTerm = (document.getElementById('specialistStudentsSearchInput')?.value || '').toLowerCase();
    const filtered = all.filter(student => {
        return (student.name || '').toLowerCase().includes(searchTerm)
            || (student.email || '').toLowerCase().includes(searchTerm)
            || String(student.grade || '').toLowerCase().includes(searchTerm);
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد نتائج مطابقة لبحثك.</p>';
        return;
    }

    filtered.forEach((student) => {
        const isActive = student._status === 'active';
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:var(--bg-gradient); padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap: 10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div style="flex:1; min-width:200px; cursor:pointer;" onclick="openStudentProfileCard('${escapeHtml(student.id)}', '${student._status}')" title="عرض بطاقة الطالب">
                <h5 style="color:var(--secondary-color); font-size:0.95rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${escapeHtml(student.name)}
                    <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:${isActive ? '#dcfce7' : '#fef3c7'}; color:${isActive ? '#15803d' : '#b45309'}; white-space:nowrap;">
                        ${isActive ? 'مسجل ونشط' : 'بانتظار أول تسجيل دخول'}
                    </span>
                </h5>
                <small style="color:var(--text-muted); word-break:break-word;">${escapeHtml(student.email)} | الصف: ${escapeHtml(student.grade || 'غير محدد')} | هاتف: ${escapeHtml(student.contactInfo || '-')}</small>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
            <button onclick="openEditStudentModal('${escapeHtml(student.id)}', '${student._status}')" style="background:#e0f2fe; color:#0284c7; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-pen-to-square"></i> تعديل</button>
            ${!isActive
                ? `<button onclick="deletePreRegisteredStudent(decodeURIComponent('${safeJsArg(student.id)}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-trash"></i> حذف</button>`
                : `<button onclick="deleteActiveStudent('${student.id}', decodeURIComponent('${safeJsArg(student.name)}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap; flex-shrink:0;"><i class="fa-solid fa-trash"></i> حذف</button>`}
            </div>
        `;
        container.appendChild(item);
    });
}

function loadSpecialistStudents() {
    if (!auth.currentUser) return;
    const container = document.getElementById('specialistStudentsListContainer');
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري التحميل...</p>';

    const qPending = query(collection(db, "preRegisteredStudents"), where("addedBy", "==", auth.currentUser.uid));
    onSnapshot(qPending, (snapshot) => {
        specialistPendingStudents = [];
        snapshot.forEach((docSnap) => { specialistPendingStudents.push({ id: docSnap.id, ...docSnap.data() }); });
        renderSpecialistStudentsList();
    });

    const qActive = query(collection(db, "users"), where("addedBy", "==", auth.currentUser.uid));
    onSnapshot(qActive, (snapshot) => {
        specialistActiveStudents = [];
        snapshot.forEach((docSnap) => { specialistActiveStudents.push({ id: docSnap.id, ...docSnap.data() }); });
        renderSpecialistStudentsList();
    });
}

let studentGroupsCache = [];
let studentGroupsUnsubscribe = null;

function listenToSpecialistGroups() {
    if (!auth.currentUser || studentGroupsUnsubscribe) return;
    const q = query(collection(db, "studentGroups"), where("ownerId", "==", auth.currentUser.uid));
    studentGroupsUnsubscribe = onSnapshot(q, (snapshot) => {
        studentGroupsCache = [];
        snapshot.forEach((d) => studentGroupsCache.push({ id: d.id, ...d.data() }));
        studentGroupsCache.sort((x, y) => (y.createdAt?.toMillis?.() || 0) - (x.createdAt?.toMillis?.() || 0));
        renderStudentGroupsList();
        renderAssignmentGroupSelect();
    }, (err) => {
        console.error("studentGroups listener error:", err);
        const container = document.getElementById('studentGroupsListContainer');
        if (container) container.innerHTML = '<p style="text-align:center; color:var(--danger-color);">تعذر تحميل المجموعات: ' + escapeHtml(err.message) + '</p>';
    });
}

window.openStudentGroupsModal = () => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    document.getElementById('studentGroupsModal').style.display = 'flex';
    listenToSpecialistGroups();
    renderGroupMembersChecklist();
    renderStudentGroupsList();
};
window.closeStudentGroupsModal = () => {
    document.getElementById('studentGroupsModal').style.display = 'none';
};

function updateGroupMembersCount() {
    const el = document.getElementById('groupMembersCount');
    const container = document.getElementById('groupMembersChecklist');
    if (el && container) el.textContent = '(' + container.querySelectorAll('input:checked').length + ')';
}

function renderGroupMembersChecklist() {
    const container = document.getElementById('groupMembersChecklist');
    if (!container) return;
    const checked = new Set([...container.querySelectorAll('input:checked')].map((i) => i.value));
    const entries = Object.entries(specialistSchoolStudentsMap)
        .sort((x, y) => (x[1].name || '').localeCompare(y[1].name || '', 'ar'));

    container.innerHTML = '';
    if (entries.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:12px; font-size:0.85rem;">لا يوجد طلبة سجّلوا دخولهم من طلبتك حتى الآن. أضف الطلبة أولاً من «طلبة مدرستي» وسيظهرون هنا بعد أول تسجيل دخول لهم.</p>';
        updateGroupMembersCount();
        return;
    }
    entries.forEach(([id, u]) => {
        const label = document.createElement('label');
        label.style.cssText = "display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; cursor:pointer; background:var(--bg-gradient); border:1px solid var(--border-color); font-size:0.9rem;";
        label.innerHTML = `<input type="checkbox" value="${escapeHtml(id)}" ${checked.has(id) ? 'checked' : ''} onchange="updateGroupMembersCount()" style="width:auto; margin:0;"><span>${escapeHtml(u.name || 'بدون اسم')}</span>`;
        container.appendChild(label);
    });
    updateGroupMembersCount();
}

window.updateGroupMembersCount = updateGroupMembersCount;

window.toggleAllGroupMembers = () => {
    const boxes = document.querySelectorAll('#groupMembersChecklist input[type="checkbox"]');
    if (boxes.length === 0) return;
    const allChecked = [...boxes].every((b) => b.checked);
    boxes.forEach((b) => { b.checked = !allChecked; });
    updateGroupMembersCount();
};

let editingGroupId = null;
let editingGroupSelection = new Set();

window.startEditGroupMembers = (groupId) => {
    const g = studentGroupsCache.find((x) => x.id === groupId);
    if (!g) return;
    editingGroupId = groupId;
    editingGroupSelection = new Set(g.memberIds || []);
    renderStudentGroupsList();
};

window.cancelEditGroupMembers = () => {
    editingGroupId = null;
    editingGroupSelection = new Set();
    renderStudentGroupsList();
};

window.toggleEditGroupMember = (id, checked) => {
    if (checked) editingGroupSelection.add(id); else editingGroupSelection.delete(id);
    const el = document.getElementById('editGroupCount');
    if (el) el.textContent = '(' + editingGroupSelection.size + ')';
};

window.saveEditGroupMembers = async (groupId) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    const memberIds = [...editingGroupSelection].filter((id) => specialistSchoolStudentsMap[id]);
    if (memberIds.length === 0) { showToast("يجب أن تحتوي المجموعة على طالب واحد على الأقل."); return; }
    const memberNames = {};
    memberIds.forEach((id) => { memberNames[id] = specialistSchoolStudentsMap[id].name || ''; });
    try {
        await updateDoc(doc(db, "studentGroups", groupId), { memberIds, memberNames });
        editingGroupId = null;
        editingGroupSelection = new Set();
        renderStudentGroupsList();
        showToast("تم تحديث أعضاء المجموعة.");
    } catch (err) { showToast("خطأ أثناء التحديث: " + err.message); }
};

function renderStudentGroupsList() {
    const container = document.getElementById('studentGroupsListContainer');
    if (!container) return;
    container.innerHTML = '';
    if (studentGroupsCache.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لم تنشئ أي مجموعات حتى الآن.</p>';
        return;
    }
    studentGroupsCache.forEach((g) => {
        const names = Object.values(g.memberNames || {}).filter(Boolean);
        const isEditing = editingGroupId === g.id;
        let editorHtml = '';
        if (isEditing) {
            const entries = Object.entries(specialistSchoolStudentsMap)
                .sort((x, y) => (x[1].name || '').localeCompare(y[1].name || '', 'ar'));
            editorHtml = `
                <div style="margin-top:10px; border-top:1px dashed var(--border-color); padding-top:10px;">
                    <small style="font-weight:800; display:block; margin-bottom:6px;">أعضاء المجموعة <span id="editGroupCount" style="color:var(--text-muted);">(${editingGroupSelection.size})</span></small>
                    <div style="max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:4px; padding:6px; border:1px solid var(--border-color); border-radius:8px; background:var(--surface-muted);">
                        ${entries.map(([id, u]) => `<label style="display:flex; align-items:center; gap:10px; padding:6px 8px; font-size:0.88rem; cursor:pointer;"><input type="checkbox" ${editingGroupSelection.has(id) ? 'checked' : ''} onchange="toggleEditGroupMember('${escapeHtml(id)}', this.checked)" style="width:auto; margin:0;"><span>${escapeHtml(u.name || 'بدون اسم')}</span></label>`).join('') || '<p style="text-align:center; color:var(--text-muted); font-size:0.85rem;">لا يوجد طلبة.</p>'}
                    </div>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button onclick="saveEditGroupMembers('${g.id}')" style="background:#0891b2; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer; font-size:0.8rem; font-weight:700;"><i class="fa-solid fa-floppy-disk"></i> حفظ</button>
                        <button onclick="cancelEditGroupMembers()" style="background:var(--surface-muted); color:var(--secondary-color); border:1px solid var(--border-color); padding:6px 14px; border-radius:6px; cursor:pointer; font-size:0.8rem;">إلغاء</button>
                    </div>
                </div>`;
        }
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:flex-start; background:var(--bg-gradient); padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap:10px;";
        item.innerHTML = `
            <div style="flex:1; min-width:0;">
                <h5 style="color:var(--secondary-color); font-size:0.98rem; margin-bottom:4px;"><i class="fa-solid fa-building"></i> ${escapeHtml(g.company || g.name)}</h5>
                <p style="font-size:0.85rem; line-height:1.7; word-break:break-word; margin-bottom:6px;">${escapeHtml(g.description)}</p>
                <small style="color:var(--text-muted); display:block; word-break:break-word;"><i class="fa-solid fa-users"></i> الأعضاء (${names.length}): ${names.length ? names.map(escapeHtml).join('، ') : 'لا يوجد'}</small>
                ${editorHtml}
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; flex-shrink:0;">
                <button onclick="startEditGroupMembers('${g.id}')" style="background:#e0f2fe; color:#0369a1; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-user-pen"></i> تعديل الأعضاء</button>
                <button onclick="deleteStudentGroup('${g.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.saveStudentGroup = async (e) => {
    e.preventDefault();
    if (!currentUserData || currentUserData.role !== 'specialist' || !auth.currentUser) return;

    const gv = runValidation([
        { id: 'groupCompany', key: 'company', fn: (x) => V.text(x, { label: 'اسم الشركة الطلابية', min: 2, max: 80 }) },
        { id: 'groupDescription', key: 'description', fn: (x) => V.text(x, { label: 'وصف الشركة', min: 10, max: 500, multiline: true }) }
    ]);
    if (!gv) return;
    const company = gv.company;
    const name = company; // اسم المجموعة = اسم الشركة الطلابية
    const description = gv.description;

    const memberIds = [...document.querySelectorAll('#groupMembersChecklist input:checked')]
        .map((i) => i.value)
        .filter((id) => specialistSchoolStudentsMap[id]);
    if (memberIds.length === 0) { showToast("اختر طالباً واحداً على الأقل للمجموعة."); return; }
    const memberNames = {};
    memberIds.forEach((id) => { memberNames[id] = specialistSchoolStudentsMap[id].name || ''; });

    try {
        await addDoc(collection(db, "studentGroups"), {
            name, company, description,
            memberIds, memberNames,
            ownerId: auth.currentUser.uid,
            ownerName: currentUserData.name || "",
            school: currentUserData.school || "",
            createdAt: serverTimestamp()
        });
        document.getElementById('studentGroupForm').reset();
        renderGroupMembersChecklist();
        showToast("تم إنشاء المجموعة بنجاح.");
    } catch (err) { showToast("خطأ: " + err.message); }
};

window.deleteStudentGroup = async (groupId) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    if (!confirm("هل أنت متأكد من حذف هذه المجموعة؟")) return;
    try {
        await deleteDoc(doc(db, "studentGroups", groupId));
        showToast("تم حذف المجموعة.");
    } catch (err) { showToast("خطأ أثناء الحذف: " + err.message); }
};

// ---------- نوع الواجب (فردي / جماعي) داخل نافذة إسناد الواجب ----------
function renderAssignmentGroupSelect() {
    const select = document.getElementById('assignmentGroupSelect');
    if (!select) return;
    const prev = select.value;
    select.innerHTML = '';
    if (studentGroupsCache.length === 0) {
        select.innerHTML = '<option value="">لا توجد مجموعات — أنشئ مجموعة أولاً</option>';
        return;
    }
    studentGroupsCache.forEach((g) => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.company || g.name;
        select.appendChild(opt);
    });
    if (prev && studentGroupsCache.some((g) => g.id === prev)) select.value = prev;
}

window.onAssignmentTypeChange = () => {
    const type = document.querySelector('input[name="assignmentType"]:checked')?.value || 'individual';
    const wrap = document.getElementById('assignmentGroupSelectWrap');
    if (wrap) wrap.style.display = type === 'group' ? 'block' : 'none';
};

window.deletePreRegisteredStudent = async (emailId) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    if (confirm("هل أنت متأكد من حذف هذا الطالب من سجلات مدرستك؟")) {
        try {
            await deleteDoc(doc(db, "preRegisteredStudents", emailId));
            showToast("تم حذف الطالب بنجاح.");
        } catch (err) {
            showToast("خطأ أثناء الحذف: " + err.message);
        }
    }
};

window.deleteActiveStudent = async (studentId, studentName) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    if (!confirm(`هل أنت متأكد من حذف الطالب "${studentName}" نهائياً من المنصة؟ سيتم حذف حسابه وجميع مشاريعه المسجلة، ولن يستطيع الدخول للمنصة مرة أخرى إلا بتسجيل جديد من الأخصائي.`)) return;
    try {
        const projectsQuery = query(collection(db, "projects"), where("ownerId", "==", studentId));
        const projectsSnap = await getDocs(projectsQuery);
        await Promise.all(projectsSnap.docs.map((d) => deleteDoc(d.ref)));

        await deleteDoc(doc(db, "users", studentId));
        showToast("تم حذف الطالب وجميع بياناته بنجاح.");
    } catch (err) {
        showToast("خطأ أثناء الحذف: " + err.message);
    }
};

window.openSettingsModal = () => {
    const user = auth.currentUser;
    if (!user || !currentUserData) return;
    document.getElementById('settingsName').value = currentUserData.name || user.displayName || '';
    document.getElementById('settingsNationalId').value = currentUserData.nationalId || '';
    document.getElementById('settingsPhone').value = currentUserData.contactInfo || '';
    
    const schoolGroup = document.getElementById('settingsSchoolGroup');
    if (currentUserData.role === 'specialist') {
        schoolGroup.style.display = 'block';
        document.getElementById('settingsSchool').value = currentUserData.school || '';
    } else {
        schoolGroup.style.display = 'none';
    }

    document.getElementById('settingsUserEmail').innerText = user.email;
    document.getElementById('settingsUserAvatar').src = user.photoURL || '';
    document.getElementById('settingsModal').style.display = 'flex';
};

window.closeSettingsModal = () => { document.getElementById('settingsModal').style.display = 'none'; };

window.handleSettingsSubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    const stChecks = [
        { id: 'settingsName', key: 'name', fn: (x) => V.name(x, { label: 'الاسم' }) },
        { id: 'settingsNationalId', key: 'nationalId', fn: V.nationalId },
        { id: 'settingsPhone', key: 'phone', fn: (x) => V.phone(x, { required: false }) }
    ];
    if (currentUserData.role === 'specialist') {
        stChecks.push({ id: 'settingsSchool', key: 'school', fn: (x) => V.text(x, { label: 'اسم المدرسة', min: 3, max: 80 }) });
    }
    const st = runValidation(stChecks);
    if (!st) return;

    let updateData = {
        name: st.name,
        nationalId: st.nationalId,
        contactInfo: st.phone
    };
    if (currentUserData.role === 'specialist') {
        updateData.school = st.school;
    }
    try {
        await updateDoc(doc(db, "users", user.uid), updateData);
        showToast("تم تحديث إعدادات الحساب بنجاح!");
        closeSettingsModal();
        window.location.reload();
    } catch (err) { showToast("خطأ: " + err.message); }
};

window.handleTrainerLinkSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'trainer') return;
    const lv = runValidation([
        { id: 'trainerMeetingUrl', key: 'url', fn: (x) => V.url(x, { label: 'رابط الاجتماع' }) }
    ]);
    if (!lv) return;
    const url = lv.url;
    try {
        await setDoc(doc(db, "settings", "globalConfig"), { 
            liveMeetingUrl: url, 
            meetingCreatedAt: serverTimestamp() 
        }, { merge: true });

        await addDoc(collection(db, "notifications"), {
            title: "محاضرة مباشرة الآن",
            message: `تم فتح رابط محاضرة جديدة، يرجى الدخول من "الجدول الزمني" قبل انتهاء الوقت (صالح لمدة ساعتين).`,
            type: "lecture",
            createdAt: serverTimestamp()
        });

        showToast("تم تحديث رابط المحاضرة بنجاح وإرسال إشعار فوري لجميع الطلبة! (سيكون صالحاً لمدة ساعتين فقط)");
        closeTrainerModal();
    } catch (err) { showToast("خطأ أثناء حفظ الرابط: " + err.message); }
};

async function fetchLiveMeetingLink() {
    const linkElement = document.getElementById('liveSessionLink');
    try {
        const docSnap = await getDoc(doc(db, "settings", "globalConfig"));
        if (docSnap.exists() && docSnap.data().liveMeetingUrl && docSnap.data().meetingCreatedAt) {
            const data = docSnap.data();
            const createdAt = data.meetingCreatedAt.toDate();
            const now = new Date();
            const diffHours = (now - createdAt) / (1000 * 60 * 60);

            if (diffHours <= 2) {
                linkElement.href = data.liveMeetingUrl;
                linkElement.innerText = "انضم إلى قاعة التدريب المباشر (Online)";
                linkElement.style.pointerEvents = "auto";
                linkElement.style.color = "var(--primary-color)";
            } else {
                linkElement.href = "#";
                linkElement.innerText = "انتهى وقت اجتماع اليوم (مرت أكثر من ساعتين على بدء الجلسة)";
                linkElement.style.pointerEvents = "none";
                linkElement.style.color = "var(--danger-color)";
            }
        } else {
            linkElement.innerText = "لم يتم تحديث رابط المحاضرة من المدرب بعد";
            linkElement.style.pointerEvents = "none";
        }
    } catch (e) { linkElement.innerText = "تعذر جلب الرابط حالياً"; }
}

window.handleJoinLecture = (e) => {
    const link = e.currentTarget;
    if (!link.href || link.href.endsWith('#') || link.style.pointerEvents === 'none') {
        e.preventDefault();
        return;
    }
    if (auth.currentUser) {
        updateDoc(doc(db, "users", auth.currentUser.uid), {
            lastLectureJoinAt: serverTimestamp(),
            lecturesJoinedCount: increment(1)
        }).catch(() => {});
    }
};

window.openAddProjectModal = (projData = null) => {
    const form = document.getElementById('projectForm');
    form.reset();
    if (projData) {
        document.getElementById('editProjectId').value = projData.id;
        document.getElementById('projTitle').value = projData.title;
        document.getElementById('projStage').value = projData.stage;
        document.getElementById('projDesc').value = projData.description;
        document.getElementById('projNeed').value = projData.need;
        document.getElementById('modalProjectTitle').innerText = "تعديل المشروع";
        document.getElementById('saveProjectBtn').innerText = "حفظ التعديلات";
    } else {
        document.getElementById('editProjectId').value = "";
        document.getElementById('modalProjectTitle').innerText = "إدراج مشروع ورفع الملفات";
        document.getElementById('saveProjectBtn').innerText = "حفظ ونشر المشروع";
    }
    document.getElementById('projectModal').style.display = 'flex';
};

window.closeAddProjectModal = () => document.getElementById('projectModal').style.display = 'none';
window.openMyChatsModal = () => { document.getElementById('myChatsModal').style.display = 'flex'; loadUserChatsList(); markNotificationsSeen(); };
window.closeMyChatsModal = () => document.getElementById('myChatsModal').style.display = 'none';

window.handleStudentRegistration = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'specialist') return;
    const grades = [...document.querySelectorAll('#studentGrade option')].map((o) => o.value);
    const sChecks = [
        { id: 'studentEmail', key: 'email', fn: (x) => {
            const r = V.email(x);
            if (r.ok && r.value === (auth.currentUser.email || '').toLowerCase()) return vFail('لا يمكنك تسجيل بريدك الشخصي كطالب.');
            return r;
        } },
        { id: 'studentName', key: 'name', fn: (x) => V.name(x, { label: 'الاسم الثلاثي للطالب' }) },
        { id: 'studentNationalId', key: 'nationalId', fn: V.nationalId },
        { id: 'studentGrade', key: 'grade', fn: (x) => V.oneOf(x, grades, 'الصف الدراسي') },
        { id: 'studentPhone', key: 'phone', fn: (x) => V.phone(x) }
    ];
    if (!currentUserData.school) {
        sChecks.splice(3, 0, { id: 'studentSchool', key: 'school', fn: (x) => V.text(x, { label: 'اسم المدرسة', min: 3, max: 80 }) });
    }
    const sv = runValidation(sChecks);
    if (!sv) return;

    const studentEmail = sv.email;
    const studentData = {
        email: studentEmail,
        name: sv.name,
        nationalId: sv.nationalId,
        school: currentUserData.school || sv.school,
        grade: sv.grade,
        contactInfo: sv.phone,
        traits: Array.from(document.querySelectorAll('#studentTraitsGrid input[name="studentTraits"]:checked')).map(cb => cb.value),
        addedBy: auth.currentUser.uid,
        schoolName: currentUserData.school || "",
        createdAt: serverTimestamp()
    };
    try {
        await setDoc(doc(db, "preRegisteredStudents", studentEmail), studentData);
        showToast("تم تسجيل الطالب تحت مظلة مدرستك بنجاح!");
        document.getElementById('addStudentForm').reset();
        document.querySelectorAll('#studentTraitsGrid .trait-chip').forEach(chip => chip.classList.remove('active'));
        closeAddStudentModal();
    } catch (err) { showToast("خطأ: " + err.message); }
};

window.signInWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const userEmail = user.email.toLowerCase();
        
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            const preRegDoc = await getDoc(doc(db, "preRegisteredStudents", userEmail));
            if (preRegDoc.exists()) {
                const sData = preRegDoc.data();
                await setDoc(userRef, {
                    name: sData.name, email: user.email, photo: user.photoURL,
                    role: 'student', nationalId: sData.nationalId, school: sData.school, 
                    grade: sData.grade, contactInfo: sData.contactInfo, addedBy: sData.addedBy,
                    schoolName: sData.schoolName || "",
                    ...(Array.isArray(sData.traits) && sData.traits.length ? { traits: sData.traits } : {}),
                    createdAt: serverTimestamp()
                });
                await deleteDoc(doc(db, "preRegisteredStudents", userEmail));
                window.location.reload();
            } else {
                document.getElementById('setupName').value = user.displayName || '';
                document.getElementById('firstTimeSetupModal').style.display = 'flex';
            }
        } else { window.location.reload(); }
    } catch (error) { showToast("خطأ: " + error.message); }
};

window.saveFirstTimeSetup = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    if (selectedSetupRole === 'investor' && !ADMIN_EMAILS.includes(user.email)) {
        showToast("التسجيل كمستثمر غير متاح حالياً، وسيتوفر ضمن الرؤية التطويرية للمنصة.");
        return;
    }
    
    const checks = [
        { id: 'setupName', key: 'name', fn: (x) => V.name(x, { label: 'الاسم' }) },
        { id: 'setupNationalId', key: 'nationalId', fn: V.nationalId },
        { id: 'setupPhone', key: 'phone', fn: (x) => V.phone(x) }
    ];
    if (selectedSetupRole === 'specialist') {
        checks.push({ id: 'setupSchool', key: 'school', fn: (x) => V.text(x, { label: 'اسم المدرسة', min: 3, max: 80 }) });
    }
    const v = runValidation(checks);
    if (!v) return;

    let setupData = {
        name: v.name,
        nationalId: v.nationalId,
        email: user.email, 
        photo: user.photoURL,
        role: ADMIN_EMAILS.includes(user.email) ? 'admin' : selectedSetupRole,
        contactInfo: v.phone,
        createdAt: serverTimestamp()
    };

    if (selectedSetupRole === 'specialist') {
        setupData.school = v.school;
    }

    try {
        await setDoc(doc(db, "users", user.uid), setupData);
        document.getElementById('firstTimeSetupModal').style.display = 'none';
        window.location.reload();
    } catch (err) { showToast("خطأ: " + err.message); }
};

onAuthStateChanged(auth, async (user) => {
    const authContainer = document.getElementById('authContainer');
    const addProjectBtn = document.getElementById('addProjectBtn');
    const addStudentBtn = document.getElementById('addStudentBtn');
    const scheduleBtn = document.getElementById('scheduleBtn');
    const trainerLinkBtn = document.getElementById('trainerLinkBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const myChatsBtn = document.getElementById('myChatsBtn');
    const myProjectsBtn = document.getElementById('myProjectsBtn');
    const tabMyProjects = document.getElementById('tabMyProjects');
    const mySchoolStudentsBtn = document.getElementById('mySchoolStudentsBtn');
    const protectedContentSection = document.getElementById('protectedContentSection');
    const adminDashboardBtn = document.getElementById('adminDashboardBtn');
    const studentAssignmentsCard = document.getElementById('studentAssignmentsCard');
    const trainerDashboardCards = document.getElementById('trainerDashboardCards');
    const specialistDashboardCards = document.getElementById('specialistDashboardCards');
    
    const heroSection = document.getElementById('heroSection');
    const timelineSection = document.getElementById('timelineSection');
    const aboutSection = document.getElementById('aboutSection');
    const siteLogo = document.getElementById('siteLogo');

    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return;
        currentUserData = userDoc.data();
        if (ADMIN_EMAILS.includes(user.email)) currentUserData.role = 'admin';

        currentUserData.lastNotificationsSeenAtMillis = (currentUserData.lastNotificationsSeenAt && currentUserData.lastNotificationsSeenAt.toMillis)
            ? currentUserData.lastNotificationsSeenAt.toMillis() : 0;

        updateDoc(doc(db, "users", user.uid), { lastLoginAt: serverTimestamp() }).catch(() => {});

        if(heroSection) heroSection.style.display = 'none';
        if(timelineSection) timelineSection.style.display = 'none';
        if(aboutSection) aboutSection.style.display = 'none';
        if(siteLogo) siteLogo.style.display = 'none';
        if(protectedContentSection) protectedContentSection.style.display = 'block';
        document.body.classList.add('has-mobile-tabbar');

        let roleText = 'داعم / مستثمر', badgeClass = 'badge-investor';
        
        if (currentUserData.role === 'admin') {
            roleText = 'مشرف النظام'; badgeClass = 'badge-admin';
            if(adminDashboardBtn) adminDashboardBtn.style.display = 'flex';
        } else if (currentUserData.role === 'student') {
            roleText = 'طالب ريادي'; badgeClass = 'badge-founder';
            addProjectBtn.style.display = 'flex'; 
            scheduleBtn.style.display = 'flex';
            myProjectsBtn.style.display = 'flex'; 
            tabMyProjects.style.display = 'inline-block';
            if(studentAssignmentsCard) {
                studentAssignmentsCard.style.display = 'block';
                loadStudentActiveAssignments();
            }
            listenToBroadcastNotifications();
            listenToStudentSurveys();
        } else if (currentUserData.role === 'specialist') {
            roleText = `أخصائي (${currentUserData.school || 'مدرستي'})`; badgeClass = 'badge-consultant';
            addStudentBtn.style.display = 'flex';
            mySchoolStudentsBtn.style.display = 'flex';
            const tabSchoolProjects = document.getElementById('tabSchoolProjects');
            if (tabSchoolProjects) tabSchoolProjects.style.display = 'inline-block';
            if(specialistDashboardCards) specialistDashboardCards.style.display = 'grid';
            listenToAssignmentTitlesMap();
            listenToTrainerSubmissions();
            listenToSpecialistSchoolStudents();
            listenToSpecialistGroups();
        } else if (currentUserData.role === 'trainer') {
            roleText = 'مدرب / محاضر'; badgeClass = 'badge-consultant';
            trainerLinkBtn.style.display = 'flex';
            scheduleBtn.style.display = 'flex';
            if(trainerDashboardCards) trainerDashboardCards.style.display = 'grid';
            listenToAssignmentTitlesMap();
            listenToTrainerSubmissions();
        }

        myChatsBtn.style.display = 'flex';
        if(settingsBtn) settingsBtn.style.display = 'flex';
        listenToConversationsBadge();

        authContainer.innerHTML = `
            <div class="user-profile">
                <img src="${escapeHtml(user.photoURL)}" class="user-avatar-img" alt="avatar">
                <div class="user-name-role">
                    <strong class="user-name-text">${escapeHtml(currentUserData.name || user.displayName)}</strong>
                    <span class="user-role-badge ${badgeClass}">${roleText}</span>
                </div>
                <button onclick="logout()" title="تسجيل الخروج" class="user-profile-logout-btn" style="background:none; border:none; color:var(--danger-color); cursor:pointer; margin-right:8px; font-size:1rem;"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        `;
        listenToUnreadMessages();
        listenToProjects();
    } else {
        if(heroSection) heroSection.style.display = 'block';
        if(timelineSection) timelineSection.style.display = 'block';
        if(aboutSection) aboutSection.style.display = 'block';
        if(siteLogo) siteLogo.style.display = 'flex';
        if(protectedContentSection) protectedContentSection.style.display = 'none';
        if(adminDashboardBtn) adminDashboardBtn.style.display = 'none';
        document.body.classList.remove('has-mobile-tabbar');
        if(studentAssignmentsCard) studentAssignmentsCard.style.display = 'none';
        stopStudentSurveys();
        if(trainerDashboardCards) trainerDashboardCards.style.display = 'none';
        if(specialistDashboardCards) specialistDashboardCards.style.display = 'none';
        const tabSchoolProjectsEl = document.getElementById('tabSchoolProjects');
        if (tabSchoolProjectsEl) tabSchoolProjectsEl.style.display = 'none';
    }
});

let publicProjectsLoaded = false;
let publicProjectsCache = [];

window.openPublicProjectsPage = () => {
    const heroSection = document.getElementById('heroSection');
    const timelineSection = document.getElementById('timelineSection');
    const aboutSection = document.getElementById('aboutSection');
    const contactSection = document.getElementById('contactSection');
    if (heroSection) heroSection.style.display = 'none';
    if (timelineSection) timelineSection.style.display = 'none';
    if (aboutSection) aboutSection.style.display = 'none';
    if (contactSection) contactSection.style.display = 'none';
    document.getElementById('publicProjectsSection').style.display = 'block';
    closeMobileNav();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadPublicProjects();
};

window.closePublicProjectsPage = () => {
    document.getElementById('publicProjectsSection').style.display = 'none';
    const heroSection = document.getElementById('heroSection');
    const timelineSection = document.getElementById('timelineSection');
    const aboutSection = document.getElementById('aboutSection');
    const contactSection = document.getElementById('contactSection');
    if (heroSection) heroSection.style.display = 'block';
    if (timelineSection) timelineSection.style.display = 'block';
    if (aboutSection) aboutSection.style.display = 'block';
    if (contactSection) contactSection.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

async function loadPublicProjects() {
    const grid = document.getElementById('publicIdeasGrid');
    if (!grid) return;
    if (publicProjectsLoaded) { renderPublicProjects(); return; }
    try {
        const snap = await getDocs(query(collection(db, "publicProjectSummaries")));
        publicProjectsCache = [];
        snap.forEach((docSnap) => { publicProjectsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        publicProjectsLoaded = true;
        renderPublicProjects();
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--card-bg); border-radius:16px; border:1px solid var(--border-color);"><p style="color:var(--danger-color); font-size:0.95rem;">تعذر تحميل المشاريع حالياً، حاول لاحقاً.</p></div>`;
    }
}

window.filterPublicProjects = () => renderPublicProjects();

function renderPublicProjects() {
    const grid = document.getElementById('publicIdeasGrid');
    if (!grid) return;

    const searchTerm = (document.getElementById('publicSearchInput')?.value || '').toLowerCase();
    const selectedStage = document.getElementById('publicStageFilter')?.value || 'all';

    const filtered = publicProjectsCache.filter(p => {
        const matchesSearch = (p.title || '').toLowerCase().includes(searchTerm) || (p.description || '').toLowerCase().includes(searchTerm);
        const matchesStage = selectedStage === 'all' || p.stage === selectedStage;
        return matchesSearch && matchesStage;
    });

    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:var(--card-bg); border-radius:16px; border:1px solid var(--border-color);"><p style="color:var(--text-muted); font-size:1rem;">${publicProjectsCache.length === 0 ? 'لا توجد مشاريع منشورة حالياً.' : 'لا توجد نتائج مطابقة لبحثك.'}</p></div>`;
        return;
    }

    filtered.forEach((data) => {
        const card = document.createElement('div');
        card.className = 'public-idea-card';
        card.innerHTML = `
            <span class="badge-stage" style="width:fit-content;">${escapeHtml(data.stage || '')}</span>
            <h3>${escapeHtml(data.title || '')}</h3>
            <p>${escapeHtml(data.description || '')}</p>
            ${(data.schoolName || data.specialistName || data.companyName) ? `
            <div style="border-top:1px solid var(--border-color); padding-top:10px; margin-top:4px; display:flex; flex-direction:column; gap:5px; font-size:0.85rem; color:var(--text-muted);">
                ${data.schoolName ? `<span><i class="fa-solid fa-school" style="width:18px; color:var(--primary-color);"></i> المدرسة: <strong style="color:var(--text-dark);">${escapeHtml(data.schoolName)}</strong></span>` : ''}
                ${data.specialistName ? `<span><i class="fa-solid fa-user-tie" style="width:18px; color:var(--primary-color);"></i> الأخصائي: <strong style="color:var(--text-dark);">${escapeHtml(data.specialistName)}</strong></span>` : ''}
                ${data.companyName ? `<span><i class="fa-solid fa-building" style="width:18px; color:var(--primary-color);"></i> الشركة: <strong style="color:var(--text-dark);">${escapeHtml(data.companyName)}</strong></span>` : ''}
            </div>` : ''}
        `;
        grid.appendChild(card);
    });
}

function listenToProjects() {
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allProjectsCache = [];
        snapshot.forEach((docSnap) => { allProjectsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        renderProjects();
    });
}

window.switchMainView = (view) => {
    currentView = view;
    document.getElementById('tabAllProjects').classList.toggle('active', view === 'all');
    document.getElementById('tabMyProjects').classList.toggle('active', view === 'mine');
    const tabSchoolProjects = document.getElementById('tabSchoolProjects');
    if (tabSchoolProjects) tabSchoolProjects.classList.toggle('active', view === 'school');
    renderProjects();
};

window.filterProjects = () => renderProjects();

function renderProjects() {
    const ideasGrid = document.getElementById('ideasGrid');
    ideasGrid.innerHTML = '';
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const selectedStage = document.getElementById('stageFilter').value;

    let filtered = allProjectsCache.filter(p => {
        const matchesSearch = p.title.toLowerCase().includes(searchTerm) || p.description.toLowerCase().includes(searchTerm);
        const matchesStage = selectedStage === 'all' || p.stage === selectedStage;
        const matchesUser = currentView === 'all'
            || (currentView === 'mine' && auth.currentUser && p.ownerId === auth.currentUser.uid)
            || (currentView === 'school' && auth.currentUser && p.specialistId === auth.currentUser.uid);
        return matchesSearch && matchesStage && matchesUser;
    });

    document.getElementById('projectCount').innerText = `المشاريع: ${filtered.length}`;

    if (filtered.length === 0) {
        ideasGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:white; border-radius:16px; border:1px solid var(--border-color);"><p style="color:#64748b; font-size:1rem;">لا توجد مشاريع مسجلة حالياً.</p></div>`;
        return;
    }

    filtered.forEach(data => {
        const isOwner = auth.currentUser && auth.currentUser.uid === data.ownerId;
        const isAdmin = currentUserData && currentUserData.role === 'admin';
        const isSpecialistForStudent = currentUserData && currentUserData.role === 'specialist' && data.specialistId === auth.currentUser.uid;

        const card = document.createElement('div');
        card.className = 'idea-card';
        card.innerHTML = `
            <div>
                <div class="idea-header"><span class="badge-stage">${escapeHtml(data.stage)}</span></div>
                <h3 class="idea-title">${escapeHtml(data.title)}</h3>
                <p style="color:var(--text-muted); font-size:0.92rem; margin-bottom:15px;">${escapeHtml(data.description)}</p>
            </div>
            <div>
                <div class="idea-need"><strong>الاحتياج:</strong> ${escapeHtml(data.need)}</div>
                <div class="idea-footer">
                    <div class="owner-info">
                        <div class="owner-avatar">${escapeHtml(data.ownerName ? data.ownerName.charAt(0) : 'ط')}</div>
                        <div>
                            <h5 style="font-size:0.88rem; color:var(--secondary-color);">${escapeHtml(data.ownerName)}</h5>
                            <small style="color:var(--text-muted);">طالب ريادي</small>
                        </div>
                    </div>
                    <div class="card-actions">
                         ${(isOwner || isAdmin || isSpecialistForStudent) ? `<button class="delete-btn" onclick="deleteProject('${data.id}')" title="حذف المشروع"><i class="fa-solid fa-trash"></i></button>` : ''}
                        <button class="interested-btn" onclick="handleInterestClick('${data.id}', '${data.ownerId}', decodeURIComponent('${safeJsArg(data.ownerName)}'), decodeURIComponent('${safeJsArg(data.title)}'))">دعم المشروع</button>
                    </div>
                </div>
            </div>
        `;
        ideasGrid.appendChild(card);
    });
}

window.handleProjectSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'student') return;
    const editId = document.getElementById('editProjectId').value;
    let specialistId = currentUserData.addedBy || auth.currentUser.uid;

    const stages = [...document.querySelectorAll('#projStage option')].map((o) => o.value);
    const pv = runValidation([
        { id: 'projTitle', key: 'title', fn: (x) => V.text(x, { label: 'عنوان المشروع', min: 3, max: 80 }) },
        { id: 'projStage', key: 'stage', fn: (x) => V.oneOf(x, stages, 'مرحلة المشروع') },
        { id: 'projDesc', key: 'description', fn: (x) => V.text(x, { label: 'وصف المشروع', min: 20, max: 1000, multiline: true }) },
        { id: 'projNeed', key: 'need', fn: (x) => V.text(x, { label: 'الاحتياج من سوق العمل', min: 3, max: 200 }) }
    ]);
    if (!pv) return;

    const projectData = {
        title: pv.title,
        stage: pv.stage,
        description: pv.description,
        need: pv.need,
        ownerId: auth.currentUser.uid,
        ownerName: currentUserData.name || auth.currentUser.displayName,
        specialistId: specialistId,
        updatedAt: serverTimestamp()
    };

    // بيانات إضافية تظهر في قسم "روادنا": المدرسة، الأخصائي، الشركة
    let specialistName = '';
    if (currentUserData.addedBy) {
        try {
            const spSnap = await getDoc(doc(db, "users", currentUserData.addedBy));
            if (spSnap.exists()) specialistName = spSnap.data().name || '';
        } catch (err) { console.error("specialist lookup error:", err); }
    }
    let groups = myGroupsCache;
    if (!groups || groups.length === 0) {
        try {
            const gSnap = await getDocs(query(collection(db, "studentGroups"), where("memberIds", "array-contains", auth.currentUser.uid)));
            groups = gSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (err) { groups = []; console.error("groups lookup error:", err); }
    }
    const companyName = [...new Set(groups.map((g) => (g.company || '').trim()).filter(Boolean))].join('، ');

    const publicSummary = {
        title: projectData.title,
        description: projectData.description,
        stage: projectData.stage,
        ownerId: auth.currentUser.uid,
        specialistId: specialistId,
        schoolName: currentUserData.school || currentUserData.schoolName || '',
        specialistName: specialistName,
        companyName: companyName
    };

    try {
        if (editId) {
            await updateDoc(doc(db, "projects", editId), projectData);
            await setDoc(doc(db, "publicProjectSummaries", editId), publicSummary, { merge: true });
        } else {
            projectData.createdAt = serverTimestamp();
            const newDocRef = await addDoc(collection(db, "projects"), projectData);
            await setDoc(doc(db, "publicProjectSummaries", newDocRef.id), publicSummary);
        }
        document.getElementById('projectForm').reset();
        closeAddProjectModal();
    } catch (err) { showToast("خطأ: " + err.message); }
};

window.deleteProject = async (id) => {
    if (confirm("تأكيد الحذف من المنصة؟")) {
        await deleteDoc(doc(db, "projects", id));
        await deleteDoc(doc(db, "publicProjectSummaries", id)).catch(() => {});
    }
};

window.handleContactSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const inputs = form.querySelectorAll('input, textarea');
    const cName = V.name(inputs[0].value, { minWords: 1, label: 'الاسم' });
    const cEmail = V.email(inputs[1].value);
    const cMsg = V.text(inputs[2].value, { label: 'الرسالة', min: 10, max: 1000, multiline: true });
    [[inputs[0], cName], [inputs[1], cEmail], [inputs[2], cMsg]].forEach(([el, r]) => { if (r.ok) clearFieldError(el); else showFieldError(el, r.error); });
    const cBad = [cName, cEmail, cMsg].find((r) => !r.ok);
    if (cBad) { showToast(cBad.error); return; }
    const name = cName.value;
    const email = cEmail.value;
    const message = cMsg.value;
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'جارٍ الإرسال...';

    try {
        await addDoc(collection(db, "contactMessages"), {
            name,
            email,
            message,
            read: false,
            senderId: auth.currentUser ? auth.currentUser.uid : null,
            senderRole: (auth.currentUser && currentUserData) ? currentUserData.role : null,
            createdAt: serverTimestamp()
        });
        showToast("تم إرسال رسالتك إلى إدارة المنصة بنجاح! سيتم الرد قريباً.");
        form.reset();
    } catch (err) {
        showToast("حدث خطأ أثناء إرسال الرسالة، حاول مرة أخرى: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
};

window.handleInterestClick = async (projectId, ownerId, ownerName, projectTitle) => {
    if (!auth.currentUser) { showToast("يرجى تسجيل الدخول أولاً!"); signInWithGoogle(); return; }
    if (auth.currentUser.uid === ownerId) return;

    const currentUserId = auth.currentUser.uid;
    const currentName = currentUserData ? currentUserData.name : auth.currentUser.displayName;
    activeChatRoomId = currentUserId < ownerId ? `${currentUserId}_${ownerId}_${projectId}` : `${ownerId}_${currentUserId}_${projectId}`;

    await setDoc(doc(db, "chatRooms", activeChatRoomId), {
        participants: [currentUserId, ownerId],
        participantNames: { [currentUserId]: currentName, [ownerId]: ownerName },
        projectTitle: projectTitle,
        updatedAt: serverTimestamp()
    }, { merge: true });

    document.getElementById('chatOwnerName').innerText = ownerName;
    document.getElementById('chatProjectTitle').innerText = projectTitle;
    document.getElementById('chatBox').style.display = 'flex';
    listenToMessages();
};

let broadcastNotificationsCache = [];
let chatUnreadTotal = 0;
let notificationsUnreadTotal = 0;

function renderUnreadBadge() {
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        const total = chatUnreadTotal + notificationsUnreadTotal;
        if (total > 0) { badge.innerText = total > 99 ? '99+' : total; badge.style.display = 'flex'; }
        else { badge.style.display = 'none'; }
    }

    const convBadge = document.getElementById('conversationsUnreadBadge');
    if (convBadge) {
        if (chatUnreadTotal > 0) { convBadge.innerText = chatUnreadTotal > 99 ? '99+' : chatUnreadTotal; convBadge.style.display = 'flex'; }
        else { convBadge.style.display = 'none'; }
    }
}

function listenToBroadcastNotifications() {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        broadcastNotificationsCache = [];
        snapshot.forEach((docSnap) => {
            const n = docSnap.data();
            // إشعار موجّه لأعضاء مجموعة معيّنة: لا يظهر إلا لهم
            if (Array.isArray(n.audienceIds) && !(auth.currentUser && n.audienceIds.includes(auth.currentUser.uid))) return;
            broadcastNotificationsCache.push({ id: docSnap.id, ...n });
        });

        const seenAt = (currentUserData && currentUserData.lastNotificationsSeenAtMillis) || 0;
        notificationsUnreadTotal = broadcastNotificationsCache.filter(n => {
            const t = (n.createdAt && n.createdAt.toMillis) ? n.createdAt.toMillis() : Date.now();
            return t > seenAt;
        }).length;

        renderUnreadBadge();
        if (document.getElementById('myChatsModal').style.display === 'flex') loadUserChatsList();
    });
}

async function markNotificationsSeen() {
    if (!auth.currentUser || !currentUserData) return;
    currentUserData.lastNotificationsSeenAtMillis = Date.now();
    notificationsUnreadTotal = 0;
    renderUnreadBadge();
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { lastNotificationsSeenAt: serverTimestamp() });
    } catch (err) { }
}

let conversationsCache = [];

function listenToConversationsBadge() {
    if (!auth.currentUser) return;
    const btn = document.getElementById('myConversationsBtn');
    if (btn) btn.style.display = 'flex';
}

window.openConversationsModal = () => {
    document.getElementById('conversationsModal').style.display = 'flex';
    loadConversationsList();
};

window.closeConversationsModal = () => {
    document.getElementById('conversationsModal').style.display = 'none';
};

function loadConversationsList() {
    if (!auth.currentUser) return;
    const container = document.getElementById('conversationsListContainer');
    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", auth.currentUser.uid));

    onSnapshot(q, (snapshot) => {
        conversationsCache = [];
        snapshot.forEach((docSnap) => { conversationsCache.push({ id: docSnap.id, ...docSnap.data() }); });

        container.innerHTML = '';
        if (conversationsCache.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا توجد محادثات حتى الآن.</p>';
            return;
        }

        conversationsCache
            .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
            .forEach((data) => {
                const roomId = data.id;
                const otherUserId = data.participants.find(id => id !== auth.currentUser.uid);
                const isAdminChat = !!data.isAdminChat;
                const otherUserName = data.participantNames?.[otherUserId] || "مستخدم";
                const otherUserRole = data.participantRoles?.[otherUserId] || (isAdminChat ? 'مشرف النظام' : '');
                const subtitle = otherUserRole || (data.projectTitle || "مشروع");
                const unread = (data.unreadCount && data.unreadCount[auth.currentUser.uid]) || 0;

                const item = document.createElement('div');
                item.className = 'chat-list-item';
                if (isAdminChat) item.style.cssText = 'border-right:4px solid var(--danger-color); background:#fef2f2; color:#0f172a;';
                item.onclick = () => { closeConversationsModal(); openChatDirectly(roomId, otherUserName, subtitle); };
                item.innerHTML = `
                    <div class="chat-list-info">
                        <h5>${isAdminChat ? '<i class="fa-solid fa-shield-halved" style="color:var(--danger-color);"></i> ' : ''}${escapeHtml(otherUserName)}
                            ${unread > 0 ? `<span style="font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:10px; background:var(--danger-color); color:#fff; margin-right:6px;">${unread} جديدة</span>` : ''}
                        </h5>
                        <p>${escapeHtml(subtitle)}</p>
                    </div>`;
                container.appendChild(item);
            });
    });
}

function listenToUnreadMessages() {
    if (!auth.currentUser) return;
    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", auth.currentUser.uid));
    onSnapshot(q, (snapshot) => {
        chatUnreadTotal = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.unreadCount && data.unreadCount[auth.currentUser.uid]) chatUnreadTotal += data.unreadCount[auth.currentUser.uid];
        });
        renderUnreadBadge();
    });
}

function loadUserChatsList() {
    if (!auth.currentUser) return;
    const chatsListContainer = document.getElementById('chatsListContainer');
    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", auth.currentUser.uid));

    onSnapshot(q, (snapshot) => {
        chatsListContainer.innerHTML = '';

        if (currentUserData && currentUserData.role === 'student' && broadcastNotificationsCache.length > 0) {
            broadcastNotificationsCache.forEach((n) => {
                const isLecture = n.type === 'lecture';
                const item = document.createElement('div');
                item.className = 'chat-list-item';
                item.onclick = () => {
                    closeMyChatsModal();
                    if (isLecture) { openScheduleModal(); }
                    else if (n.type === 'survey') { document.getElementById('studentSurveysCard')?.scrollIntoView({ behavior: 'smooth' }); }
                    else { document.getElementById('studentAssignmentsCard')?.scrollIntoView({ behavior: 'smooth' }); }
                };
                item.innerHTML = `<div class="chat-list-info"><h5><i class="fa-solid ${isLecture ? 'fa-video' : 'fa-bullhorn'}" style="color:${isLecture ? '#0369a1' : 'var(--primary-color)'};"></i> ${escapeHtml(n.title)}</h5><p>${escapeHtml(n.message)}</p></div>`;
                chatsListContainer.appendChild(item);
            });
        }

        if (snapshot.empty && chatsListContainer.innerHTML === '') {
            chatsListContainer.innerHTML = '<p style="text-align:center;">لا توجد محادثات أو إشعارات</p>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const roomId = docSnap.id;
            const otherUserId = data.participants.find(id => id !== auth.currentUser.uid);
            const isAdminChat = !!data.isAdminChat;
            const otherUserName = data.participantNames[otherUserId] || "مستخدم";
            const otherUserRole = data.participantRoles?.[otherUserId] || (isAdminChat ? 'مشرف النظام' : '');
            const subtitle = otherUserRole || (data.projectTitle || "مشروع");
            const item = document.createElement('div');
            item.className = 'chat-list-item';
            if (isAdminChat) item.style.cssText = 'border-right:4px solid var(--danger-color); background:#fef2f2; color:#0f172a;';
            item.onclick = () => { closeMyChatsModal(); openChatDirectly(roomId, otherUserName, subtitle); };
            item.innerHTML = `<div class="chat-list-info"><h5>${isAdminChat ? '<i class="fa-solid fa-shield-halved" style="color:var(--danger-color);"></i> ' : ''}${escapeHtml(otherUserName)}</h5><p>${escapeHtml(subtitle)}</p></div>`;
            chatsListContainer.appendChild(item);
        });
    });
}

function openChatDirectly(roomId, otherUserName, projTitle) {
    activeChatRoomId = roomId;
    document.getElementById('chatOwnerName').innerText = otherUserName;
    document.getElementById('chatProjectTitle').innerText = projTitle;
    document.getElementById('chatBox').style.display = 'flex';
    updateDoc(doc(db, "chatRooms", activeChatRoomId), { [`unreadCount.${auth.currentUser.uid}`]: 0 }).catch(()=>{});
    listenToMessages();
}

window.closeChat = () => { document.getElementById('chatBox').style.display = 'none'; if(unsubscribeChat) unsubscribeChat(); };

function listenToMessages() {
    if (!activeChatRoomId) return;
    if (unsubscribeChat) unsubscribeChat();
    const messagesRef = collection(db, "chatRooms", activeChatRoomId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    unsubscribeChat = onSnapshot(q, (snapshot) => {
        const chatBody = document.getElementById('chatBody');
        chatBody.innerHTML = '<div class="message system">تنبيه فوري: المحادثة مشفرة</div>';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const isMe = data.senderId === auth.currentUser.uid;
            const msgDiv = document.createElement('div');
            msgDiv.className = isMe ? 'message sent' : 'message received';
            msgDiv.textContent = decryptMessage(data.text, activeChatRoomId);
            chatBody.appendChild(msgDiv);
        });
        chatBody.scrollTop = chatBody.scrollHeight;
    }, (err) => {
        const chatBody = document.getElementById('chatBody');
        if (chatBody) chatBody.innerHTML = `<div class="message system" style="color:var(--danger-color);">تعذر تحميل الرسائل: ${escapeHtml(err.message)}</div>`;
        console.error("listenToMessages error:", err);
    });
}

window.sendMessage = async () => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if(!text || !auth.currentUser || !activeChatRoomId) return;
    if (text.length > 1000) { showToast("الرسالة طويلة جداً (الحد الأقصى 1000 حرف)."); return; }

    try {
        const roomSnap = await getDoc(doc(db, "chatRooms", activeChatRoomId));
        if (!roomSnap.exists()) { showToast("خطأ: غرفة المحادثة غير موجودة."); return; }
        const otherUserId = roomSnap.data().participants.find(id => id !== auth.currentUser.uid);

        await addDoc(collection(db, "chatRooms", activeChatRoomId, "messages"), {
            text: encryptMessage(text, activeChatRoomId), senderId: auth.currentUser.uid, timestamp: serverTimestamp()
        });

        await setDoc(doc(db, "chatRooms", activeChatRoomId), {
            lastMessage: encryptMessage(text, activeChatRoomId), updatedAt: serverTimestamp(),
            [`unreadCount.${otherUserId}`]: increment(1)
        }, { merge: true });

        input.value = '';
    } catch (err) {
        showToast("تعذر إرسال الرسالة: " + err.message);
        console.error("sendMessage error:", err);
    }
};