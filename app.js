// قائمة التنقل للشاشات الصغيرة (موبايل/تابلت)
window.toggleMobileNav = () => {
    const menu = document.getElementById('navMenu');
    const overlay = document.getElementById('navOverlay');
    const btn = document.getElementById('navToggleBtn');
    if (!menu) return;
    const isOpen = menu.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open', isOpen);
    if (btn) btn.setAttribute('aria-expanded', String(isOpen));
};

window.closeMobileNav = () => {
    const menu = document.getElementById('navMenu');
    const overlay = document.getElementById('navOverlay');
    const btn = document.getElementById('navToggleBtn');
    if (menu) menu.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
};

// التنقل لأقسام الصفحة الرئيسية (الرئيسية / عن المنصة / الجدول الزمني)
// هذه الأقسام تكون مخفية بعد تسجيل الدخول، فبنعرضها مؤقتاً وننزل ليها
// من غير ما نعمل أي تسجيل خروج أو نأثر على حالة المستخدم
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

const ADMIN_EMAIL = "anaryadiadmin@gmail.com"; 

// ملاحظة أمان مهمة: المفتاح ده موجود في كود الواجهة (client-side)، يعني أي حد
// يفتح "عرض المصدر" يقدر يشوفه ويفك تشفير أي رسالة. الـ AES هنا بيمنع بس القراءة
// العرضية من قاعدة بيانات Firestore مباشرة (زي لو حد فتح الـ Console بدون صلاحية)،
// لكنه مش تشفير حقيقي (end-to-end) ولا بديل عن Firestore Security Rules.
// الحماية الحقيقية للمحادثات لازم تكون عبر قواعد firestore.rules (شوف الملف المرفق)
// اللي تمنع أي مستخدم غير مشارك في الغرفة من قراءة/كتابة رسائلها من الأساس.
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

// يشتق مفتاح تشفير مختلف لكل غرفة محادثة بدل استخدام مفتاح ثابت واحد لكل المحادثات
function deriveRoomKey(roomId) {
    return CryptoJS.SHA256(ENCRYPTION_KEY + '::' + (roomId || 'default')).toString();
}

// ================== أدوات أمان: منع هجمات XSS وحقن الأكواد ==================
// أي نص جاي من المستخدم (اسم، عنوان، وصف...) لازم يعدي على الدالة دي قبل ما يتحط جوا innerHTML
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// تجهيز أي نص حر عشان يترّب بأمان كباراميتر جوا onclick/onsubmit (يمنع كسر الخاصية بعلامات تنصيص أو أقواس)
function safeJsArg(value) {
    return encodeURIComponent(value === null || value === undefined ? '' : String(value));
}

// يسمح فقط بروابط http/https الحقيقية، ويمنع روابط javascript: الخبيثة
function safeUrl(url) {
    if (!url) return '#';
    const trimmed = String(url).trim();
    if (/^https?:\/\//i.test(trimmed)) return escapeHtml(trimmed);
    return '#';
}

// بيحدد هل النص اللي كتبه الطالب "رابط" (يبدأ بـ http/https) ولا "نص عادي"،
// عشان تسليم الحل يوصل للمدرب بنفس الشكل اللي الطالب كتبه بيه (لينك قابل للفتح، أو نص عادي)
function isHttpLink(text) {
    if (!text) return false;
    return /^https?:\/\//i.test(String(text).trim());
}

// يمنع كتابة أي حروف/نصوص في حقول "الرقم المدني": أرقام فقط
window.filterDigitsOnly = function (el) {
    const cursor = el.selectionStart;
    const before = el.value.length;
    el.value = el.value.replace(/[^0-9]/g, '');
    const after = el.value.length;
    if (cursor !== null) el.setSelectionRange(cursor - (before - after), cursor - (before - after));
};

// يسمح في حقول "رقم الهاتف" بأرقام + علامة (+) في البداية + مسافات فقط، ومايقبلش حروف نصية
window.filterPhoneInput = function (el) {
    const hasPlus = el.value.trim().startsWith('+');
    let digits = el.value.replace(/[^0-9\s]/g, '');
    el.value = (hasPlus ? '+' : '') + digits.replace(/^\s+/, '');
};
// ==============================================================================

window.selectSetupRole = (role) => {
    selectedSetupRole = role;
    document.getElementById('setupRoleSpecialist').classList.toggle('active', role === 'specialist');
    document.getElementById('setupRoleTrainer').classList.toggle('active', role === 'trainer');
    document.getElementById('setupRoleInvestor').classList.toggle('active', role === 'investor');
    
    const schoolGroup = document.getElementById('setupSchoolGroup');
    if(schoolGroup) {
        schoolGroup.style.display = (role === 'specialist') ? 'block' : 'none';
    }
};

window.cancelSetup = async () => {
    document.getElementById('firstTimeSetupModal').style.display = 'none';
    try { await signOut(auth); window.location.reload(); } catch (err) { window.location.reload(); }
};

window.logout = async () => {
    try { await signOut(auth); window.location.reload(); } catch (err) { alert("حدث خطأ أثناء تسجيل الخروج"); }
};

window.openWelcomeSpeechModal = () => { document.getElementById('welcomeSpeechModal').style.display = 'flex'; };
window.closeWelcomeSpeechModal = () => { document.getElementById('welcomeSpeechModal').style.display = 'none'; };

window.openAboutUsModal = (event) => {
    if (event) event.preventDefault();
    document.getElementById('aboutUsModal').style.display = 'flex';
};
window.closeAboutUsModal = () => { document.getElementById('aboutUsModal').style.display = 'none'; };

// لوحة تحكم المشرف
window.openAdminDashboardModal = () => {
    if (!currentUserData || currentUserData.role !== 'admin') {
        alert("غير مصرح لك بالدخول لهذه اللوحة!");
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
    document.getElementById('adminTabMessages').classList.toggle('active', tab === 'messages');
    document.getElementById('adminProjectsSection').style.display = tab === 'projects' ? 'block' : 'none';
    document.getElementById('adminUsersSection').style.display = tab === 'users' ? 'block' : 'none';
    document.getElementById('adminMessagesSection').style.display = tab === 'messages' ? 'block' : 'none';
    if (tab === 'users') loadAdminSpecialistsAndTrainers();
    if (tab === 'messages') loadAdminContactMessages();
};

// يجلب كل الأخصائيين والمدربين المسجلين في المنصة ويتابعهم لحظياً
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
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap:10px;";
        item.innerHTML = `
            <div>
                <h5 style="color:var(--secondary-color); font-size:0.95rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${escapeHtml(u.name || 'بدون اسم')}
                    <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:${isTrainer ? '#e0f2fe' : '#fef3c7'}; color:${isTrainer ? '#0369a1' : '#b45309'};">
                        ${isTrainer ? 'مدرب / محاضر' : 'أخصائي'}
                    </span>
                </h5>
                <small style="color:var(--text-muted);">${escapeHtml(u.email || '-')}${u.school ? ' | المدرسة: ' + escapeHtml(u.school) : ''}</small>
            </div>
            <button onclick="adminDeleteUser('${u.id}', decodeURIComponent('${safeJsArg(u.name || 'بدون اسم')}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-trash"></i> حذف</button>
        `;
        container.appendChild(item);
    });
};

window.adminDeleteUser = async (userId, userName) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (!confirm(`هل أنت متأكد من حذف حساب "${userName}" نهائياً من المنصة؟ سيفقد صلاحياته فوراً.`)) return;
    try {
        await deleteDoc(doc(db, "users", userId));
        alert("تم حذف الحساب بنجاح.");
    } catch (err) {
        alert("خطأ أثناء الحذف: " + err.message);
    }
};

// دالة موحّدة لعرض اسم الدور المسجل بيه المستخدم في المنصة (نفس التسميات المستخدمة في البادچ بجانب اسمه)
function getRoleLabel(role, school) {
    switch (role) {
        case 'admin': return 'مشرف النظام';
        case 'student': return 'طالب ريادي';
        case 'specialist': return `أخصائي (${school || 'مدرستي'})`;
        case 'trainer': return 'مدرب / محاضر';
        default: return 'داعم / مستثمر';
    }
}

// رسائل نموذج التواصل معنا
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
                    <h5 style="color:var(--secondary-color); font-size:0.95rem;">${escapeHtml(msg.name || 'بدون اسم')}
                        ${!msg.read ? '<span style="font-size:0.65rem; font-weight:800; padding:2px 8px; border-radius:10px; background:var(--primary-light); color:var(--primary-color); margin-right:6px;">جديدة</span>' : ''}
                    </h5>
                    <small style="color:var(--text-muted); direction:ltr; display:inline-block;">${escapeHtml(msg.email || '-')}</small>
                </div>
                <small style="color:var(--text-muted); font-size:0.75rem; white-space:nowrap;">${date}</small>
            </div>
            <p style="color:var(--text-dark); font-size:0.9rem; line-height:1.6; margin-bottom:12px; background:#fff; padding:10px; border-radius:8px; border:1px solid var(--border-color);">${escapeHtml(msg.message || '')}</p>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${msg.senderId ? `<button onclick="adminReplyToMessage('${msg.id}', '${msg.senderId}', decodeURIComponent('${safeJsArg(msg.name || 'الطالب')}'), '${msg.senderRole || ''}')" style="background:var(--accent-green); color:#fff; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-reply"></i> الرد على الطالب</button>` : ''}
                ${!msg.read ? `<button onclick="adminMarkMessageRead('${msg.id}')" style="background:var(--primary-light); color:var(--primary-color); border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-check"></i> تحديد كمقروءة</button>` : ''}
                <button onclick="adminDeleteMessage('${msg.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف</button>
            </div>
        `;
        container.appendChild(item);
    });
};

// رد المشرف مباشرة على رسالة تواصل جاءت من طالب مسجل بالمنصة
// بيفتح نفس نظام المحادثات (chatRooms) المستخدم أصلاً بين الطلاب، عشان الرد يظهر عند الطالب في "المحادثات"
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
        alert("تعذر فتح المحادثة: " + err.message);
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
        alert("خطأ أثناء التحديث: " + err.message);
    }
};

window.adminDeleteMessage = async (messageId) => {
    if (!currentUserData || currentUserData.role !== 'admin') return;
    if (!confirm("هل أنت متأكد من حذف هذه الرسالة نهائياً؟")) return;
    try {
        await deleteDoc(doc(db, "contactMessages", messageId));
    } catch (err) {
        alert("خطأ أثناء الحذف: " + err.message);
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
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px; border-radius:10px; border:1px solid var(--border-color); margin-bottom: 8px;";
        item.innerHTML = `
            <div style="flex: 1;">
                <h5 style="color:var(--secondary-color); font-size:0.9rem;">${escapeHtml(project.title)}</h5>
                <small style="color:var(--text-muted); font-size:0.75rem;">المالك: ${escapeHtml(project.ownerName)} | المرحلة: ${escapeHtml(project.stage)}</small>
            </div>
            <div style="display:flex; gap: 5px;">
                <button onclick="adminDeleteProject('${project.id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف</button>
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
            alert("تم حذف المشروع بنجاح.");
            loadAdminStatsAndProjects();
        } catch (err) {
            alert("خطأ أثناء الحذف: " + err.message);
        }
    }
};

// نظام الواجبات والتكاليف وإنشاء الإشعارات للطلاب
window.openTrainerAssignmentModal = () => {
    document.getElementById('trainerAssignmentModal').style.display = 'flex';
    loadTrainerPublishedAssignments();
};

window.closeTrainerAssignmentModal = () => {
    document.getElementById('trainerAssignmentModal').style.display = 'none';
};

window.handleTrainerCreateAssignment = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'trainer') return;

    const title = document.getElementById('trainerAssignmentTitle').value.trim();
    const description = document.getElementById('trainerAssignmentDesc').value.trim();

    const assignmentData = {
        title: title,
        description: description,
        trainerId: auth.currentUser.uid,
        trainerName: currentUserData.name || auth.currentUser.displayName,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "trainerAssignments"), assignmentData);
        await addDoc(collection(db, "notifications"), {
            title: "تكليف دراسي جديد",
            message: `أضاف المدرب واجب جديد: "${title}"`,
            type: "assignment",
            createdAt: serverTimestamp()
        });

        alert("تم نشر الواجب وإرسال إشعار فوري لجميع الطلاب بنجاح!");
        document.getElementById('trainerAssignmentTitle').value = '';
        document.getElementById('trainerAssignmentDesc').value = '';
        loadTrainerPublishedAssignments();
    } catch (err) {
        alert("حدث خطأ أثناء نشر الواجب: " + err.message);
    }
};

function loadTrainerPublishedAssignments() {
    if (!auth.currentUser) return;
    const container = document.getElementById('trainerAssignmentsList');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem;">جاري التحميل...</p>';

    const q = query(collection(db, "trainerAssignments"), orderBy("createdAt", "desc"));
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
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#fff; padding:10px 14px; border-radius:8px; border:1px solid var(--border-color);";
            item.innerHTML = `
                <div>
                    <h5 style="color:var(--secondary-color); font-size:0.9rem;">${escapeHtml(data.title)}</h5>
                    <small style="color:var(--text-muted);">${escapeHtml(data.description.substring(0, 40))}...</small>
                </div>
                <button onclick="deleteTrainerAssignment('${id}')" style="background:#fee2e2; color:#dc2626; border:none; padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.75rem;"><i class="fa-solid fa-trash"></i></button>
            `;
            container.appendChild(item);
        });
    });
}

window.deleteTrainerAssignment = async (id) => {
    if (!currentUserData || currentUserData.role !== 'trainer') return;
    if (confirm("هل تريد حذف هذا الواجب المنشور نهائياً؟")) {
        try {
            await deleteDoc(doc(db, "trainerAssignments", id));
        } catch (err) {
            alert("خطأ أثناء الحذف: " + err.message);
        }
    }
};

// قائمة الواجبات النشطة عند الطالب + تتبّع تسليماته الخاصة وإخفاء اللي اختار حذفها من عنده
let trainerAssignmentsCache = [];
let mySubmissionsMap = {};
let hiddenAssignmentIds = [];

function loadStudentActiveAssignments() {
    if (!auth.currentUser) return;
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

    const visibleAssignments = trainerAssignmentsCache.filter(a => !hiddenAssignmentIds.includes(a.id));

    container.innerHTML = '';
    if (visibleAssignments.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); font-size:0.9rem; padding:15px;">لا توجد واجبات أو تكاليف مطلوبة من المدرب حالياً.</p>';
        return;
    }

    visibleAssignments.forEach((assignment) => {
        const assignmentId = assignment.id;
        const submission = mySubmissionsMap[assignmentId];

        const assignmentCard = document.createElement('div');
        assignmentCard.style.cssText = "background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:18px;";

        const bodyHtml = submission ? `
                <div style="background:#f0fdf4; padding:12px; border-radius:8px; border:1px solid #bbf7d0; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                    <span style="color:#15803d; font-weight:700; font-size:0.85rem;"><i class="fa-solid fa-circle-check"></i> تم تسليم الحل${submission.graded ? ` — الدرجة: ${submission.grade}/100` : ' — بانتظار التقييم'}</span>
                    <button onclick="dismissAssignmentFromList('${assignmentId}')" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> حذف من القائمة</button>
                </div>
            ` : `
                <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid var(--border-color); overflow:hidden;">
                    <form onsubmit="handleStudentSubmitSolution(event, '${assignmentId}')" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                        <input type="hidden" id="solutionAssignmentTitle_${assignmentId}" value="${escapeHtml(assignment.title || '')}">
                        <input type="text" id="solutionInput_${assignmentId}" required dir="auto" placeholder="ضع رابط إجابتك (Google Drive مثلاً) أو اكتب نص إجابتك مباشرة هنا..." style="flex:1 1 200px; min-width:0; width:100%; padding:9px 12px; border:1px solid var(--border-color); border-radius:6px; font-size:0.85rem; box-sizing:border-box;">
                        <button type="submit" class="auth-btn" style="flex-shrink:0; padding:9px 16px; font-size:0.85rem; background-color:#7c3aed; white-space:nowrap;">تسليم الحل</button>
                    </form>
                </div>
            `;

        assignmentCard.innerHTML = `
            <h4 style="color:var(--secondary-color); font-size:1.05rem; margin-bottom:6px;"><i class="fa-solid fa-book-open" style="color:var(--primary-color);"></i> ${escapeHtml(assignment.title)}</h4>
            <small style="color:var(--text-muted); font-size:0.8rem; display:block; margin-bottom:10px;"><i class="fa-solid fa-chalkboard-user"></i> بواسطة المدرب: ${escapeHtml(assignment.trainerName || 'غير محدد')}</small>
            <p style="color:var(--text-muted); font-size:0.9rem; margin-bottom:14px; line-height:1.6;">${escapeHtml(assignment.description)}</p>
            ${bodyHtml}
        `;
        container.appendChild(assignmentCard);
    });
}

// الطالب بيقدر يشيل أي واجب مسلّم من قائمته الشخصية بس (عشان مايعملش سكرول طويل مع تراكم الواجبات)
// ده إخفاء من عند الطالب فقط ومايأثرش على الواجب الأصلي ولا على تسليمه اللي المدرب لسه شايفه
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
    const linkInput = document.getElementById(`solutionInput_${assignmentId}`);
    const titleInput = document.getElementById(`solutionAssignmentTitle_${assignmentId}`);
    const link = linkInput.value.trim();

    const solutionData = {
        assignmentId: assignmentId,
        assignmentTitle: titleInput ? titleInput.value : '',
        fileLink: link,
        studentId: auth.currentUser.uid,
        studentName: currentUserData.name || auth.currentUser.displayName,
        school: currentUserData.school || "غير متوفر",
        grade: null,
        feedback: "",
        graded: false,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "studentSubmissions"), solutionData);
        alert("تم إرسال حل الواجب بنجاح إلى المدرب!");
        linkInput.value = '';
    } catch (err) {
        alert("حدث خطأ أثناء تسليم الحل: " + err.message);
    }
};

// نظام مراجعة وتقييم تسليمات الطلاب من قبل المدرب
let allSubmissionsCache = [];
let assignmentsTitleMap = {};

window.openTrainerSubmissionsModal = () => {
    document.getElementById('trainerSubmissionsModal').style.display = 'flex';
    renderTrainerSubmissions();
};

window.closeTrainerSubmissionsModal = () => {
    document.getElementById('trainerSubmissionsModal').style.display = 'none';
};

// يعمل مرة واحدة عند دخول المدرب: يجهز خريطة عناوين الواجبات (لقائمة الفلترة وللتسليمات القديمة)
function listenToAssignmentTitlesMap() {
    const q = query(collection(db, "trainerAssignments"), orderBy("createdAt", "desc"));
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

// يعمل مرة واحدة عند دخول المدرب: يتابع كل تسليمات الطلاب لحظياً
function listenToTrainerSubmissions() {
    const q = query(collection(db, "studentSubmissions"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        allSubmissionsCache = [];
        snapshot.forEach((docSnap) => { allSubmissionsCache.push({ id: docSnap.id, ...docSnap.data() }); });
        updatePendingSubmissionsBadge();
        renderTrainerSubmissions();
        renderTrainerLeaderboard();
    });
}

window.openTrainerLeaderboardModal = () => {
    document.getElementById('trainerLeaderboardModal').style.display = 'flex';
    renderTrainerLeaderboard();
};
window.closeTrainerLeaderboardModal = () => {
    document.getElementById('trainerLeaderboardModal').style.display = 'none';
};

function renderTrainerLeaderboard() {
    const container = document.getElementById('trainerLeaderboardList');
    if (!container) return;

    const gradedSubs = allSubmissionsCache.filter(s => s.graded && typeof s.grade === 'number');
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

    container.innerHTML = '';
    if (ranking.length === 0) {
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
                <h5 style="color:var(--secondary-color); font-size:0.95rem;">${escapeHtml(st.studentName)}</h5>
                <small style="color:var(--text-muted);">${escapeHtml(st.school || 'غير متوفر')} | عدد الواجبات المُقيّمة: ${st.count}</small>
            </div>
            <div style="font-weight:900; font-size:1.2rem; color:var(--primary-color);">${st.avg.toFixed(1)}</div>
        `;
        container.appendChild(item);
    });
}

function updatePendingSubmissionsBadge() {
    const badge = document.getElementById('pendingSubmissionsBadge');
    if (!badge) return;
    const pendingCount = allSubmissionsCache.filter(s => !s.graded).length;
    if (pendingCount > 0) { badge.innerText = pendingCount; badge.style.display = 'inline-flex'; }
    else { badge.style.display = 'none'; }
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
        const item = document.createElement('div');
        item.style.cssText = "background:#f8fafc; border:1px solid var(--border-color); border-radius:12px; padding:18px;";
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px; flex-wrap:wrap; gap:8px;">
                <div>
                    <h5 style="color:var(--secondary-color); font-size:0.95rem;">${escapeHtml(sub.studentName)}</h5>
                    <small style="color:var(--text-muted);">${escapeHtml(sub.school || 'غير متوفر')} | الواجب: ${escapeHtml(title)}</small>
                </div>
                <span style="background:${isGraded ? '#dcfce7' : '#fef3c7'}; color:${isGraded ? '#15803d' : '#b45309'}; padding:4px 12px; border-radius:8px; font-size:0.75rem; font-weight:800; white-space:nowrap;">
                    ${isGraded ? `تم التقييم: ${escapeHtml(sub.grade)}/100` : 'بانتظار التقييم'}
                </span>
            </div>
            ${isHttpLink(sub.fileLink) ? `
            <a href="${safeUrl(sub.fileLink)}" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; color:var(--primary-color); font-weight:700; font-size:0.85rem; margin-bottom:14px;">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> فتح ملف الحل
            </a>` : `
            <div dir="auto" style="background:#f8fafc; border:1px solid var(--border-color); border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:0.85rem; color:var(--secondary-color); line-height:1.7; white-space:pre-wrap;">
                <i class="fa-solid fa-align-right" style="color:var(--text-muted); margin-left:6px;"></i>${escapeHtml(sub.fileLink)}
            </div>`}
            <form onsubmit="handleGradeSubmission(event, '${sub.id}')" style="display:flex; flex-direction:column; gap:10px; background:#fff; padding:14px; border-radius:8px; border:1px solid var(--border-color);">
                <div style="display:flex; gap:10px; align-items:center;">
                    <label style="font-size:0.85rem; font-weight:700; white-space:nowrap;">الدرجة (من 100)</label>
                    <input type="number" min="0" max="100" required id="gradeInput_${sub.id}" value="${sub.grade ?? ''}" style="width:90px; padding:8px; border:1px solid var(--border-color); border-radius:6px;">
                </div>
                <textarea id="feedbackInput_${sub.id}" rows="2" placeholder="ملاحظات وتعليقات المدرب على الحل...">${escapeHtml(sub.feedback || '')}</textarea>
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
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'trainer') return;

    const gradeInput = document.getElementById(`gradeInput_${submissionId}`);
    const feedbackInput = document.getElementById(`feedbackInput_${submissionId}`);
    const gradeVal = Number(gradeInput.value);
    const feedbackVal = feedbackInput.value.trim();

    if (isNaN(gradeVal) || gradeVal < 0 || gradeVal > 100) {
        alert("يرجى إدخال درجة صحيحة بين 0 و 100.");
        return;
    }

    const submission = allSubmissionsCache.find(s => s.id === submissionId);
    if (!submission) return;

    try {
        await updateDoc(doc(db, "studentSubmissions", submissionId), {
            grade: gradeVal,
            feedback: feedbackVal,
            graded: true,
            gradedBy: currentUserData.name || auth.currentUser.displayName,
            gradedAt: serverTimestamp()
        });

        // إرسال إشعار فوري للطالب عبر نظام المحادثات المشفّر الموجود بالفعل
        const trainerId = auth.currentUser.uid;
        const studentId = submission.studentId;
        const roomId = trainerId < studentId ? `${trainerId}_${studentId}_grade` : `${studentId}_${trainerId}_grade`;
        const title = submission.assignmentTitle || assignmentsTitleMap[submission.assignmentId] || 'واجب';

        await setDoc(doc(db, "chatRooms", roomId), {
            participants: [trainerId, studentId],
            participantNames: {
                [trainerId]: currentUserData.name || auth.currentUser.displayName,
                [studentId]: submission.studentName
            },
            projectTitle: `تقييم واجب: ${title}`,
            updatedAt: serverTimestamp()
        }, { merge: true });

        const msgText = `تم تقييم حلك على واجب "${title}" — الدرجة: ${gradeVal}/100${feedbackVal ? ' — ملاحظات: ' + feedbackVal : ''}`;

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

        alert("تم حفظ التقييم وإرسال إشعار فوري للطالب بنجاح!");
    } catch (err) {
        alert("حدث خطأ أثناء حفظ التقييم: " + err.message);
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
    const container = document.getElementById('trainerStudentsListContainer');
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري تحميل الطلاب...</p>';

    const q = query(collection(db, "users"), where("role", "==", "student"));
    onSnapshot(q, (snapshot) => {
        container.innerHTML = '';

        // نعرض فقط الحسابات النشطة فعلياً: سجلت دخول مرة على الأقل أو فتحت رابط محاضرة
        // (يستثني أي بيانات تجريبية تم إدخالها مباشرة دون مرور حقيقي عبر تسجيل الدخول)
        const activeStudents = [];
        snapshot.forEach((docSnap) => {
            const student = docSnap.data();
            if (student.lastLoginAt || student.lastLectureJoinAt) {
                activeStudents.push({ id: docSnap.id, ...student });
            }
        });

        if (activeStudents.length === 0) {
            container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لا يوجد طلاب نشطين على المنصة حتى الآن.</p>';
            return;
        }
        activeStudents.forEach((student) => {
            const item = document.createElement('div');
            item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color);";
            item.innerHTML = `
                <div>
                    <h5 style="color:var(--secondary-color); font-size:0.95rem;">${escapeHtml(student.name)}</h5>
                    <small style="color:var(--text-muted);">${escapeHtml(student.email)} | المدرسة: ${escapeHtml(student.school || 'غير متوفر')} | الصف: ${escapeHtml(student.grade || 'غير محدد')}</small>
                </div>
                <span style="background:#dcfce7; color:#15803d; padding:4px 10px; border-radius:6px; font-size:0.75rem; font-weight:bold;">نشط</span>
            `;
            container.appendChild(item);
        });
    });
}

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
        container.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">لم تقم بتسجيل أي طلاب حتى الآن.</p>';
        return;
    }

    all.forEach((student) => {
        const isActive = student._status === 'active';
        const item = document.createElement('div');
        item.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#f8fafc; padding:12px 15px; border-radius:10px; border:1px solid var(--border-color); gap: 10px; flex-wrap:wrap;";
        item.innerHTML = `
            <div>
                <h5 style="color:var(--secondary-color); font-size:0.95rem; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${escapeHtml(student.name)}
                    <span style="font-size:0.68rem; font-weight:800; padding:2px 8px; border-radius:10px; background:${isActive ? '#dcfce7' : '#fef3c7'}; color:${isActive ? '#15803d' : '#b45309'}; white-space:nowrap;">
                        ${isActive ? 'مسجل ونشط' : 'بانتظار أول تسجيل دخول'}
                    </span>
                </h5>
                <small style="color:var(--text-muted);">${escapeHtml(student.email)} | الصف: ${escapeHtml(student.grade || 'غير محدد')} | هاتف: ${escapeHtml(student.contactInfo || '-')}</small>
            </div>
            ${!isActive
                ? `<button onclick="deletePreRegisteredStudent(decodeURIComponent('${safeJsArg(student.id)}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-trash"></i> حذف</button>`
                : `<button onclick="deleteActiveStudent('${student.id}', decodeURIComponent('${safeJsArg(student.name)}'))" style="background:#fee2e2; color:#dc2626; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-size:0.8rem; white-space:nowrap;"><i class="fa-solid fa-trash"></i> حذف</button>`}
        `;
        container.appendChild(item);
    });
}

function loadSpecialistStudents() {
    if (!auth.currentUser) return;
    const container = document.getElementById('specialistStudentsListContainer');
    container.innerHTML = '<p style="text-align:center; color:var(--text-muted);">جاري التحميل...</p>';

    // الطلاب اللي لسه ما سجلوش دخول لأول مرة (سجلات مبدئية من الأخصائي)
    const qPending = query(collection(db, "preRegisteredStudents"), where("addedBy", "==", auth.currentUser.uid));
    onSnapshot(qPending, (snapshot) => {
        specialistPendingStudents = [];
        snapshot.forEach((docSnap) => { specialistPendingStudents.push({ id: docSnap.id, ...docSnap.data() }); });
        renderSpecialistStudentsList();
    });

    // الطلاب اللي سجلوا دخول فعلاً وبقوا حسابات نشطة على المنصة
    const qActive = query(collection(db, "users"), where("addedBy", "==", auth.currentUser.uid));
    onSnapshot(qActive, (snapshot) => {
        specialistActiveStudents = [];
        snapshot.forEach((docSnap) => { specialistActiveStudents.push({ id: docSnap.id, ...docSnap.data() }); });
        renderSpecialistStudentsList();
    });
}

window.deletePreRegisteredStudent = async (emailId) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    if (confirm("هل أنت متأكد من حذف هذا الطالب من سجلات مدرستك؟")) {
        try {
            await deleteDoc(doc(db, "preRegisteredStudents", emailId));
            alert("تم حذف الطالب بنجاح.");
        } catch (err) {
            alert("خطأ أثناء الحذف: " + err.message);
        }
    }
};

// حذف طالب نشط (سجّل دخول بالفعل) من قِبل الأخصائي المسؤول عنه، مع حذف مشاريعه المرتبطة
window.deleteActiveStudent = async (studentId, studentName) => {
    if (!currentUserData || currentUserData.role !== 'specialist') return;
    if (!confirm(`هل أنت متأكد من حذف الطالب "${studentName}" نهائياً من المنصة؟ سيتم حذف حسابه وجميع مشاريعه المسجلة، ولن يستطيع الدخول للمنصة مرة أخرى إلا بتسجيل جديد من الأخصائي.`)) return;
    try {
        const projectsQuery = query(collection(db, "projects"), where("ownerId", "==", studentId));
        const projectsSnap = await getDocs(projectsQuery);
        await Promise.all(projectsSnap.docs.map((d) => deleteDoc(d.ref)));

        await deleteDoc(doc(db, "users", studentId));
        alert("تم حذف الطالب وجميع بياناته بنجاح.");
    } catch (err) {
        alert("خطأ أثناء الحذف: " + err.message);
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
    const nationalId = document.getElementById('settingsNationalId').value.trim();
    const phone = document.getElementById('settingsPhone').value.trim();
    if (!/^[0-9]+$/.test(nationalId)) { alert("الرقم المدني يجب أن يتكون من أرقام فقط."); return; }
    if (phone && !/^\+?[0-9\s]+$/.test(phone)) { alert("رقم الهاتف يجب أن يتكون من أرقام فقط."); return; }
    let updateData = {
        name: document.getElementById('settingsName').value.trim(),
        nationalId: nationalId,
        contactInfo: phone
    };
    if (currentUserData.role === 'specialist') {
        updateData.school = document.getElementById('settingsSchool').value.trim();
    }
    try {
        await updateDoc(doc(db, "users", user.uid), updateData);
        alert("تم تحديث إعدادات الحساب بنجاح!");
        closeSettingsModal();
        window.location.reload();
    } catch (err) { alert("خطأ: " + err.message); }
};

window.handleTrainerLinkSubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser || !currentUserData || currentUserData.role !== 'trainer') return;
    const url = document.getElementById('trainerMeetingUrl').value.trim();
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

        alert("تم تحديث رابط المحاضرة بنجاح وإرسال إشعار فوري لجميع الطلاب! (سيكون صالحاً لمدة ساعتين فقط)");
        closeTrainerModal();
    } catch (err) { alert("خطأ أثناء حفظ الرابط: " + err.message); }
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

// يسجل دخول حقيقي للطالب عند فتحه رابط المحاضرة فعلياً (يستخدم لتمييز الطلاب النشطين)
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
    const studentEmail = document.getElementById('studentEmail').value.trim().toLowerCase();
    const studentNationalId = document.getElementById('studentNationalId').value.trim();
    const studentPhone = document.getElementById('studentPhone').value.trim();
    if (!/^[0-9]+$/.test(studentNationalId)) { alert("الرقم المدني للطالب يجب أن يتكون من أرقام فقط."); return; }
    if (!/^\+?[0-9\s]+$/.test(studentPhone)) { alert("رقم هاتف الطالب يجب أن يتكون من أرقام فقط."); return; }
    const studentData = {
        email: studentEmail,
        name: document.getElementById('studentName').value.trim(),
        nationalId: studentNationalId,
        school: currentUserData.school || document.getElementById('studentSchool').value.trim(),
        grade: document.getElementById('studentGrade').value,
        contactInfo: studentPhone,
        traits: Array.from(document.querySelectorAll('#studentTraitsGrid input[name="studentTraits"]:checked')).map(cb => cb.value),
        addedBy: auth.currentUser.uid,
        schoolName: currentUserData.school || "",
        createdAt: serverTimestamp()
    };
    try {
        await setDoc(doc(db, "preRegisteredStudents", studentEmail), studentData);
        alert("تم تسجيل الطالب تحت مظلة مدرستك بنجاح!");
        document.getElementById('addStudentForm').reset();
        document.querySelectorAll('#studentTraitsGrid .trait-chip').forEach(chip => chip.classList.remove('active'));
        closeAddStudentModal();
    } catch (err) { alert("خطأ: " + err.message); }
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
                    createdAt: serverTimestamp()
                });
                await deleteDoc(doc(db, "preRegisteredStudents", userEmail));
                window.location.reload();
            } else {
                document.getElementById('setupName').value = user.displayName || '';
                document.getElementById('firstTimeSetupModal').style.display = 'flex';
            }
        } else { window.location.reload(); }
    } catch (error) { alert("خطأ: " + error.message); }
};

window.saveFirstTimeSetup = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    const setupNationalId = document.getElementById('setupNationalId').value.trim();
    const setupPhone = document.getElementById('setupPhone').value.trim();
    if (!/^[0-9]+$/.test(setupNationalId)) { alert("الرقم المدني يجب أن يتكون من أرقام فقط."); return; }
    if (!/^\+?[0-9\s]+$/.test(setupPhone)) { alert("رقم الهاتف يجب أن يتكون من أرقام فقط."); return; }

    let setupData = {
        name: document.getElementById('setupName').value.trim(),
        nationalId: setupNationalId,
        email: user.email, 
        photo: user.photoURL,
        role: user.email === ADMIN_EMAIL ? 'admin' : selectedSetupRole,
        contactInfo: setupPhone,
        createdAt: serverTimestamp()
    };

    if (selectedSetupRole === 'specialist') {
        setupData.school = document.getElementById('setupSchool').value.trim();
    }

    try {
        await setDoc(doc(db, "users", user.uid), setupData);
        document.getElementById('firstTimeSetupModal').style.display = 'none';
        window.location.reload();
    } catch (err) { alert("خطأ: " + err.message); }
};

// مراقبة حالة التسجيل وتخصيص الواجهات
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
    
    const heroSection = document.getElementById('heroSection');
    const timelineSection = document.getElementById('timelineSection');
    const aboutSection = document.getElementById('aboutSection');
    const siteLogo = document.getElementById('siteLogo');

    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) return;
        currentUserData = userDoc.data();
        if (user.email === ADMIN_EMAIL) currentUserData.role = 'admin';

        currentUserData.lastNotificationsSeenAtMillis = (currentUserData.lastNotificationsSeenAt && currentUserData.lastNotificationsSeenAt.toMillis)
            ? currentUserData.lastNotificationsSeenAt.toMillis() : 0;

        // تسجيل آخر نشاط دخول فعلي (يساعد على تمييز الحسابات النشطة الحقيقية عن حسابات التجريب)
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
        } else if (currentUserData.role === 'specialist') {
            roleText = `أخصائي (${currentUserData.school || 'مدرستي'})`; badgeClass = 'badge-consultant';
            addStudentBtn.style.display = 'flex';
            mySchoolStudentsBtn.style.display = 'flex';
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
                <button onclick="logout()" title="تسجيل الخروج" style="background:none; border:none; color:var(--danger-color); cursor:pointer; margin-right:8px; font-size:1rem;"><i class="fa-solid fa-right-from-bracket"></i></button>
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
        if(trainerDashboardCards) trainerDashboardCards.style.display = 'none';
    }
});

// صفحة "روادنا" العامة: تعرض عناوين وأفكار مشاريع الطلبة فقط لأي زائر بدون تسجيل دخول
let publicProjectsLoaded = false;

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
    if (publicProjectsLoaded || !grid) return;
    try {
        const snap = await getDocs(query(collection(db, "publicProjectSummaries")));
        grid.innerHTML = '';
        if (snap.empty) {
            grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:white; border-radius:16px; border:1px solid var(--border-color);"><p style="color:var(--text-muted); font-size:1rem;">لا توجد مشاريع منشورة حالياً.</p></div>`;
            return;
        }
        snap.forEach((docSnap) => {
            const data = docSnap.data();
            const card = document.createElement('div');
            card.className = 'public-idea-card';
            card.innerHTML = `
                <span class="badge-stage" style="width:fit-content;">${escapeHtml(data.stage || '')}</span>
                <h3>${escapeHtml(data.title || '')}</h3>
                <p>${escapeHtml(data.description || '')}</p>
            `;
            grid.appendChild(card);
        });
        publicProjectsLoaded = true;
    } catch (err) {
        grid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:white; border-radius:16px; border:1px solid var(--border-color);"><p style="color:var(--danger-color); font-size:0.95rem;">تعذر تحميل المشاريع حالياً، حاول لاحقاً.</p></div>`;
    }
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
        const matchesUser = currentView === 'all' || (auth.currentUser && p.ownerId === auth.currentUser.uid);
        return matchesSearch && matchesStage && matchesUser;
    });

    document.getElementById('projectCount').innerText = `المشاريع: ${filtered.length}`;

    if (filtered.length === 0) {
        ideasGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; background:white; border-radius:16px; border:1px solid var(--border-color);"><p style="color:var(--text-muted); font-size:1rem;">لا توجد مشاريع مسجلة حالياً.</p></div>`;
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

    const projectData = {
        title: document.getElementById('projTitle').value,
        stage: document.getElementById('projStage').value,
        description: document.getElementById('projDesc').value,
        need: document.getElementById('projNeed').value,
        ownerId: auth.currentUser.uid,
        ownerName: currentUserData.name || auth.currentUser.displayName,
        specialistId: specialistId,
        updatedAt: serverTimestamp()
    };

    // نسخة عامة مبسّطة (عنوان + وصف + مرحلة فقط) لصفحة "روادنا" اللي بتتعرض للزوار بدون تسجيل دخول
    // بنفصلها عن مستند المشروع الأصلي عشان بيانات المالك والاحتياج ومعرّف الأخصائي متتعرضش أبدًا لغير المسجلين
    const publicSummary = {
        title: projectData.title,
        description: projectData.description,
        stage: projectData.stage,
        ownerId: auth.currentUser.uid,
        specialistId: specialistId
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
    } catch (err) { alert("خطأ: " + err.message); }
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
    const name = inputs[0].value.trim();
    const email = inputs[1].value.trim();
    const message = inputs[2].value.trim();
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
        alert("تم إرسال رسالتك إلى إدارة المنصة بنجاح! سيتم الرد قريباً.");
        form.reset();
    } catch (err) {
        alert("حدث خطأ أثناء إرسال الرسالة، حاول مرة أخرى: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
    }
};

window.handleInterestClick = async (projectId, ownerId, ownerName, projectTitle) => {
    if (!auth.currentUser) { alert("يرجى تسجيل الدخول أولاً!"); signInWithGoogle(); return; }
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

// نظام الإشعارات الموحّد (رسائل شات + إشعارات عامة كالمحاضرات والواجبات)
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

    // عداد أيقونة "المحادثات" المستقلة: رسائل الشات الفعلية بس (بدون الإشعارات العامة)
    const convBadge = document.getElementById('conversationsUnreadBadge');
    if (convBadge) {
        if (chatUnreadTotal > 0) { convBadge.innerText = chatUnreadTotal > 99 ? '99+' : chatUnreadTotal; convBadge.style.display = 'flex'; }
        else { convBadge.style.display = 'none'; }
    }
}

// يبدأ فقط لدى الطالب: يتابع الإشعارات العامة (محاضرات/واجبات) لحظياً
function listenToBroadcastNotifications() {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
        broadcastNotificationsCache = [];
        snapshot.forEach((docSnap) => { broadcastNotificationsCache.push({ id: docSnap.id, ...docSnap.data() }); });

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
    } catch (err) { /* تجاهل بصمت */ }
}

// أيقونة "المحادثات" المستقلة — بتشتغل بنفس الطريقة عند الأدمن وعند الطالب:
// بتفتح قائمة بكل المحادثات الفعلية (شخص بشخص) اللي الحساب طرف فيها، بعيدًا تمامًا
// عن جرس الإشعارات العامة (المحاضرات/الواجبات).
let conversationsCache = [];

function listenToConversationsBadge() {
    if (!auth.currentUser) return;
    const btn = document.getElementById('myConversationsBtn');
    if (btn) btn.style.display = 'flex';
    // العداد بيتحدّث تلقائيًا من نفس المستمع الموجود أصلاً في listenToUnreadMessages (chatUnreadTotal)
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
                if (isAdminChat) item.style.cssText = 'border-right:4px solid var(--danger-color); background:#fef2f2;';
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
            if (isAdminChat) item.style.cssText = 'border-right:4px solid var(--danger-color); background:#fef2f2;';
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

    try {
        const roomSnap = await getDoc(doc(db, "chatRooms", activeChatRoomId));
        if (!roomSnap.exists()) { alert("خطأ: غرفة المحادثة غير موجودة."); return; }
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
        alert("تعذر إرسال الرسالة: " + err.message);
        console.error("sendMessage error:", err);
    }
};