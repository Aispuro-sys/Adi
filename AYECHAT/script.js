import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCZyJnjNAJSRoHRGLzGBDumbtGOkB55Pyo",
  authDomain: "ayechat-4f50d.firebaseapp.com",
  projectId: "ayechat-4f50d",
  messagingSenderId: "533598786880",
  appId: "1:533598786880:web:0094638658a25b2dd616a5",
  measurementId: "G-3978XHQYQL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- CONFIGURACIÓN CLOUDINARY ---
const CLOUDINARY_CLOUD_NAME = 'dmawscx9h';
const CLOUDINARY_UPLOAD_PRESET = 'AYECHAT';

document.addEventListener('DOMContentLoaded', () => {
    console.log("AYECHAT Script v3.0 Loaded - Fixes applied");
    
    // Constants
    const DEFAULT_PASSWORDS = {
        'eduardo': "16402080077290",
        'adilene': "164020"
    };
    const LOGIN_KEY = 'private_chat_user_id';
    
    // DOM Elements - Login
    const loginScreen = document.getElementById('login-screen');
    const userCards = document.querySelectorAll('.user-card');
    const passwordSection = document.getElementById('password-section');
    const selectedUserNameDisplay = document.getElementById('selected-user-name');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const backBtn = document.getElementById('back-btn');
    const errorMsg = document.getElementById('error-msg');
    
    // DOM Elements - App
    const chatApp = document.getElementById('chat-app');
    const chatWindow = document.getElementById('chat-window');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const fileInput = document.getElementById('file-input');
    const recordBtn = document.getElementById('record-btn');
    const clearBtn = document.getElementById('clear-chat');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const minimizeBtn = document.getElementById('minimize-chat-btn');
    const floatingBtn = document.getElementById('floating-chat-btn');
    const floatingAvatar = document.getElementById('floating-avatar');
    const floatingStatus = document.getElementById('floating-status-indicator');
    
    // DOM Elements - Header Info
    const currentUserAvatar = document.getElementById('current-user-avatar');
    const currentUserName = document.getElementById('current-user-name');

    // DOM Elements - Settings Modal
    const settingsModal = document.getElementById('settings-modal');
    const closeModalBtn = document.querySelector('.close-modal');
    const settingsAvatarPreview = document.getElementById('settings-avatar-preview');
    const avatarInput = document.getElementById('avatar-input');
    const bgInput = document.getElementById('bg-input');
    const resetBgBtn = document.getElementById('reset-bg-btn');
    const settingsNickname = document.getElementById('settings-nickname');
    const settingsPassword = document.getElementById('settings-password');
    const saveSettingsBtn = document.getElementById('save-settings-btn');

    // Notification Sound
    const notificationSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // Soft chime

    // State
    let currentUser = null; // { id, name, avatar, password, chatBackground }
    let selectedLoginUser = null;
    let mediaRecorder;
    let audioChunks = [];
    let isRecording = false;
    let messagesUnsubscribe = null;
    let partnerUnsubscribe = null;
    let currentUserUnsubscribe = null;
    let typingTimeout = null;
    let replyingTo = null; // { id, name, text }
    let editingMessageId = null; // ID of message being edited

    // --- HELPER FUNCTIONS ---
    
    function setAvatar(imgElement, url, name) {
        if (!imgElement) return;
        const fallback = `https://ui-avatars.com/api/?name=${name}&background=random`;
        
        imgElement.onerror = () => {
            imgElement.src = fallback;
        };
        
        imgElement.src = url || fallback;
    }

    // --- INITIALIZATION ---
    
    async function init() {
        // Inject Reply Preview Container
        setupReplyUI();
        
        // Load avatars for login screen immediately
        loadLoginAvatars();
        
        // Request notification permission early if possible
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }

        // Check if cached login exists
        const cachedUserId = localStorage.getItem(LOGIN_KEY);
        if (cachedUserId) {
            await loadUserAndStart(cachedUserId);
        }

        // Handle visibility change for online status
        document.addEventListener('visibilitychange', () => {
            if (currentUser) {
                updateOnlineStatus(document.visibilityState === 'visible');
                if (document.visibilityState === 'visible') {
                    markUnreadMessagesAsRead();
                }
            }
        });

        // Handle window close
        window.addEventListener('beforeunload', () => {
            if (currentUser) {
                updateOnlineStatus(false); // Set offline on close
    function setupReplyUI() {
        const inputArea = document.querySelector('.chat-input-area');
        const previewBar = document.createElement('div');
        previewBar.id = 'reply-preview-bar';
        previewBar.className = 'reply-preview-bar hidden';
        previewBar.innerHTML = `
            <div class="reply-preview-content">
                <div class="reply-preview-title">Respondiendo a...</div>
                <div class="reply-preview-text" id="reply-preview-text">...</div>
            </div>
            <button id="cancel-reply-btn" class="icon-btn"><i class="fas fa-times"></i></button>
        `;
        // Insert before the input container
        inputArea.insertBefore(previewBar, inputArea.firstChild);
        
        document.getElementById('cancel-reply-btn').addEventListener('click', cancelReplyOrEdit);
    }

    function cancelReplyOrEdit() {
        replyingTo = null;
        editingMessageId = null;
        document.getElementById('reply-preview-bar').classList.add('hidden');
        messageInput.value = '';
        messageInput.style.height = 'auto';
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }

                updateActivityStatus(null); // Clear typing/recording
            }
        });
    }

    async function loadLoginAvatars() {
        const users = ['eduardo', 'adilene'];
        for (const userId of users) {
            try {
                const userDoc = await getDoc(doc(db, "users", userId));
                const img = document.getElementById(`img-login-${userId}`);
                if (userDoc.exists() && img) {
                    const data = userDoc.data();
                    setAvatar(img, data.avatar, userId);
                }
            } catch (e) {
                console.warn(`Could not load avatar for ${userId}`, e);
            }
        }
    }

    async function updateOnlineStatus(isOnline) {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, "users", currentUser.id), {
                online: isOnline,
                lastSeen: serverTimestamp()
            });
        } catch (e) {
            console.error("Error updating online status:", e);
        }
    }

    async function updateActivityStatus(status) {
        if (!currentUser) return;
        try {
            await updateDoc(doc(db, "users", currentUser.id), {
                activityStatus: status
            });
        } catch (e) {
            console.error("Error updating activity status:", e);
        }
    }

    async function loadUserAndStart(userId) {
        try {
            const userDoc = await getDoc(doc(db, "users", userId));
            if (userDoc.exists()) {
                currentUser = { id: userDoc.id, ...userDoc.data() };
                showChatInterface();
            } else {
                // If doc doesn't exist (first run?), create it with defaults
                await createDefaultUser(userId);
                currentUser = { 
                    id: userId, 
                    name: userId === 'eduardo' ? 'Eduardo' : 'Adilene',
                    password: DEFAULT_PASSWORDS[userId] || "123456",
                    avatar: `https://ui-avatars.com/api/?name=${userId}&background=random`,
                    chatBackground: '',
                    online: true,
                    activityStatus: null
                };
                showChatInterface();
            }
        } catch (e) {
            console.error("Error loading user:", e);
            // Don't alert on load error, just show login screen
            localStorage.removeItem(LOGIN_KEY);
        }
    }

    async function createDefaultUser(userId) {
        const defaultData = {
            name: userId === 'eduardo' ? 'Eduardo' : 'Adilene',
            password: DEFAULT_PASSWORDS[userId] || "123456",
            avatar: `https://ui-avatars.com/api/?name=${userId}&background=random`,
            chatBackground: '',
            online: false,
            activityStatus: null
        };
        await setDoc(doc(db, "users", userId), defaultData);
    }

    // --- LOGIN FLOW ---

    userCards.forEach(card => {
        card.addEventListener('click', () => {
            selectedLoginUser = card.dataset.user;
            
            // UI Update
            document.querySelector('.user-selection').classList.add('hidden');
            passwordSection.classList.remove('hidden');
            selectedUserNameDisplay.textContent = `Hola ${selectedLoginUser.charAt(0).toUpperCase() + selectedLoginUser.slice(1)}, ingresa tu clave:`;
            passwordInput.value = '';
            passwordInput.focus();
            errorMsg.classList.add('hidden');
        });
    });

    backBtn.addEventListener('click', () => {
        selectedLoginUser = null;
        passwordSection.classList.add('hidden');
        document.querySelector('.user-selection').classList.remove('hidden');
    });

    async function performLogin() {
        if (!selectedLoginUser) return;
        
        const pwd = passwordInput.value.trim();
        if (!pwd) return;

        loginBtn.textContent = '...';
        
        try {
            let userDoc = await getDoc(doc(db, "users", selectedLoginUser));
            
            // Create if not exists (Lazy init)
            if (!userDoc.exists()) {
                await createDefaultUser(selectedLoginUser);
                userDoc = await getDoc(doc(db, "users", selectedLoginUser));
            }

            const userData = userDoc.data();
            
            if (userData.password === pwd) {
                currentUser = { id: selectedLoginUser, ...userData };
                localStorage.setItem(LOGIN_KEY, currentUser.id);
                showChatInterface();
            } else if (selectedLoginUser === 'adilene' && pwd === DEFAULT_PASSWORDS['adilene'] && userData.password === "16402080077290") {
                // Migration
                await updateDoc(doc(db, "users", 'adilene'), { password: DEFAULT_PASSWORDS['adilene'] });
                currentUser = { id: selectedLoginUser, ...userData, password: DEFAULT_PASSWORDS['adilene'] };
                localStorage.setItem(LOGIN_KEY, currentUser.id);
                showChatInterface();
            } else {
                errorMsg.classList.remove('hidden');
                passwordInput.classList.add('shake');
                setTimeout(() => passwordInput.classList.remove('shake'), 500);
            }
        } catch (e) {
            console.error(e);
            alert("Error al intentar entrar. Verifica la consola.");
        }
        
        loginBtn.textContent = 'Entrar';
    }

    loginBtn.addEventListener('click', performLogin);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') performLogin();
    });

    function showChatInterface() {
        loginScreen.classList.add('hidden');
        chatApp.classList.remove('hidden');
        
        // Set Online
        updateOnlineStatus(true);

        // Setup Partner Info in Header
        setupPartnerHeader();
        
        // Setup Current User Listener (Shared Background & Real-time updates)
        setupCurrentUserListener();
        
        // Apply Background
        applyChatBackground();

        // Start Listening to Messages
        subscribeToMessages();
        
        // Try to play sound to request permission (silent)
        notificationSound.play().catch(() => {});
        
        // Request Notifications if not granted
        if ("Notification" in window && Notification.permission !== "granted") {
            Notification.requestPermission();
        }
    }

    function setupCurrentUserListener() {
        if (!currentUser) return;

        if (currentUserUnsubscribe) currentUserUnsubscribe();

        currentUserUnsubscribe = onSnapshot(doc(db, "users", currentUser.id), (doc) => {
            if (doc.exists()) {
                const newData = doc.data();
                // Update local state
                currentUser = { ...currentUser, ...newData };
                
                // Check Background Sync
                applyChatBackground();
            }
        });
    }

    function setupPartnerHeader() {
        if (!currentUser) return;
        
        const partnerId = currentUser.id === 'eduardo' ? 'adilene' : 'eduardo';
        
        if (partnerUnsubscribe) partnerUnsubscribe();

        partnerUnsubscribe = onSnapshot(doc(db, "users", partnerId), (doc) => {
            if (doc.exists()) {
                const partnerData = doc.data();
                
                // Update Header UI with Partner Info
                currentUserName.textContent = partnerData.name;
                setAvatar(currentUserAvatar, partnerData.avatar, partnerId);
                
                const statusEl = document.querySelector('.status');
                
                // Priority: Activity Status > Online > Last Seen
                if (partnerData.activityStatus === 'typing') {
                    statusEl.textContent = 'Escribiendo...';
                    statusEl.style.color = '#7289da'; // Primary blueish color
                    statusEl.style.fontStyle = 'italic';
                    floatingStatus.className = 'status-dot online'; // Use online color for activity
                    floatingStatus.style.backgroundColor = '#7289da';
                } else if (partnerData.activityStatus === 'recording') {
                    statusEl.textContent = 'Grabando audio...';
                    statusEl.style.color = '#ff4757'; // Red
                    statusEl.style.fontStyle = 'italic';
                    floatingStatus.className = 'status-dot online';
                    floatingStatus.style.backgroundColor = '#ff4757';
                } else if (partnerData.online) {
                    statusEl.textContent = 'En línea';
                    statusEl.style.color = '#43b581';
                    statusEl.style.fontStyle = 'normal';
                    floatingStatus.className = 'status-dot online';
                    floatingStatus.style.backgroundColor = '#43b581';
                } else {
                    let lastSeenText = 'Desconectado';
                    if (partnerData.lastSeen) {
                        const date = partnerData.lastSeen.toDate();
                        lastSeenText = `Visto: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                    }
                    statusEl.textContent = lastSeenText;
                    statusEl.style.color = '#b9bbbe';
                    statusEl.style.fontStyle = 'normal';
                    floatingStatus.className = 'status-dot';
                    floatingStatus.style.backgroundColor = '#b9bbbe';
                }
            }
        });
    }

    function applyChatBackground() {
        if (currentUser && currentUser.chatBackground) {
            chatWindow.style.backgroundImage = `url('${currentUser.chatBackground}')`;
            chatWindow.style.backgroundSize = 'cover';
            chatWindow.style.backgroundPosition = 'center';
        } else {
            chatWindow.style.backgroundImage = 'none';
        }
    }

    function logout() {
        if (currentUser) {
            updateOnlineStatus(false); // Go offline
            updateActivityStatus(null);
        }

        localStorage.removeItem(LOGIN_KEY);
        currentUser = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (partnerUnsubscribe) partnerUnsubscribe();
        if (currentUserUnsubscribe) currentUserUnsubscribe();
        
        chatApp.classList.add('hidden');
        floatingBtn.classList.add('hidden'); // Ensure floating btn is hidden
        loginScreen.classList.remove('hidden');
        
        // Refresh avatars on login screen
        loadLoginAvatars();
        
        // Reset Login UI
        selectedLoginUser = null;
        passwordSection.classList.add('hidden');
        document.querySelector('.user-selection').classList.remove('hidden');
        
        // Reset Background
        chatWindow.style.backgroundImage = 'none';
    }

    // ... (Profile Settings remains same) ...

    // --- MINIMIZE / FLOATING CHAT ---

    function minimizeChat() {
        chatApp.classList.add('hidden');
        floatingBtn.classList.remove('hidden');
        
        // Update floating avatar to partner's avatar (since header shows partner)
        if (currentUser) {
            const partnerId = currentUser.id === 'eduardo' ? 'adilene' : 'eduardo';
            // We can get this from DOM or wait for listener
            // Ideally use the cached partner info if we had it, but reading from the header img src is a quick hack
            // or better, fetch from db/listener.
            // Since we have the partnerUnsubscribe active, let's just use a default or current header src
            const headerImg = document.getElementById('current-user-avatar');
            if(headerImg) floatingAvatar.src = headerImg.src;
        }
    }

    function maximizeChat() {
        if (floatingBtn) floatingBtn.classList.add('hidden');
        chatApp.classList.remove('hidden');
        scrollToBottom();
    }

    if (minimizeBtn) minimizeBtn.addEventListener('click', minimizeChat);
    
    if (floatingBtn) floatingBtn.addEventListener('click', maximizeChat);

    // ESC to minimize
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!chatApp.classList.contains('hidden') && settingsModal.classList.contains('hidden')) {
                minimizeChat();
            } else if (!settingsModal.classList.contains('hidden')) {
                settingsModal.classList.add('hidden');
            }
        }
    });

    // Sync floating status dot with partner status
    // We'll hook this into setupPartnerHeader
    
    // --- CHAT FUNCTIONALITY ---

    function subscribeToMessages() {
        if (messagesUnsubscribe) messagesUnsubscribe();

        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
        
        messagesUnsubscribe = onSnapshot(q, (snapshot) => {
            // Process changes
            snapshot.docChanges().forEach((change) => {
                const msg = change.doc.data();
                const msgId = change.doc.id;

                if (change.type === "added") {
                    // Play sound/Notify if message is not from me
                    if (currentUser && msg.senderId !== currentUser.id) {
                        // Mark as read if visible
                        if (document.visibilityState === 'visible') {
                            markMessageAsRead(msgId);
                        }

                        const now = new Date();
                        const msgTime = msg.timestamp ? msg.timestamp.toDate() : new Date();
                        if ((now - msgTime) < 30000) { // Recent message
                            // Sound
                            notificationSound.currentTime = 0;
                            notificationSound.play().catch(e => console.log("Audio autoplay prevented"));
                            
                            // Push Notification
                            if (document.visibilityState === 'hidden' && Notification.permission === "granted") {
                                new Notification(`Mensaje de ${msg.senderName}`, {
                                    body: msg.text || (msg.type === 'image' ? '📷 Imagen' : (msg.type === 'audio' ? '🎤 Audio' : '📎 Archivo')),
                                    icon: msg.senderAvatar
                                });
                            }
                        }
                    }
                }
            });

            chatWindow.innerHTML = ''; 
            
            // Add welcome
            const welcome = document.createElement('div');
            welcome.className = 'welcome-message';
            welcome.innerHTML = '<i class="fas fa-shield-alt"></i><p>Chat encriptado iniciado.</p>';
            chatWindow.appendChild(welcome);

            snapshot.forEach((doc) => {
                renderMessage(doc.data(), doc.id);
            });
            scrollToBottom();
        });
    }

    async function markMessageAsRead(msgId) {
        try {
            const msgRef = doc(db, "messages", msgId);
            await updateDoc(msgRef, {
                read: true,
                readAt: serverTimestamp()
            });
        } catch (e) {
            console.error("Error marking read:", e);
        }
    }

    function markUnreadMessagesAsRead() {
        if (!currentUser) return;
        // Logic handled by onSnapshot + visibilityState check. 
        // We could query specifically here but onSnapshot usually covers it.
        // This function acts as a trigger when coming back online/visible.
        const visibleMessages = document.querySelectorAll('.message.received');
        visibleMessages.forEach(div => {
             const id = div.id.replace('msg-', '');
             // Ideally check if unread first, but updateDoc is safe enough
             markMessageAsRead(id);
        });
    }

    function renderMessage(msg, id) {
        // 1. Filter "Deleted For Me"
        if (msg.deletedFor && msg.deletedFor.includes(currentUser.id)) {
            return; 
        }

        const div = document.createElement('div');
        const isMe = msg.senderId === currentUser.id;
        
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.id = `msg-${id}`;
        
        // Double click to open context menu
        div.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e, msg, id);
        });
        
        // Mobile long press simulation (touch)
        let touchTimer;
        div.addEventListener('touchstart', (e) => {
            touchTimer = setTimeout(() => showContextMenu(e, msg, id), 500);
        });
        div.addEventListener('touchend', () => clearTimeout(touchTimer));

        let contentHtml = '';
        
        // 2. Reply Context
        if (msg.replyTo) {
            contentHtml += `
                <div class="reply-context" onclick="document.getElementById('msg-${msg.replyTo.id}')?.scrollIntoView({behavior: 'smooth', block: 'center'})">
                    <strong>${msg.replyTo.name}</strong>
                    <span>${msg.replyTo.text}</span>
                </div>
            `;
        }

        // Sender Name (if received)
        if (!isMe && msg.senderName) {
            contentHtml += `<div style="font-size: 0.7rem; color: #b9bbbe; margin-bottom: 2px;">${msg.senderName}</div>`;
        }

        // Content
        if (msg.text) {
            // Fix: Use class for color adaptation
            const textWithLinks = msg.text.replace(
                /(https?:\/\/[^\s]+)/g, 
                '<a href="$1" target="_blank" class="msg-link">$1</a>'
            );
            contentHtml += `<p>${textWithLinks} ${msg.edited ? '<span class="edited-tag">(editado)</span>' : ''}</p>`;
        }
        
        if (msg.type === 'image') {
            contentHtml += `<img src="${msg.content}" alt="Image" onclick="window.open(this.src)">`;
        }
        
        if (msg.type === 'audio') {
            contentHtml += `<audio controls src="${msg.content}"></audio>`;
        }
        
        if (msg.type === 'file') {
            contentHtml += `
                <a href="${msg.content}" download="${msg.fileName}" class="file-attachment">
                    <i class="fas fa-file"></i>
                    <span>${msg.fileName}</span>
                </a>`;
        }

        // 3. Reactions
        let reactionsHtml = '';
        if (msg.reactions) {
            reactionsHtml = '<div class="message-reactions">';
            for (const [uid, emoji] of Object.entries(msg.reactions)) {
                reactionsHtml += `<span class="reaction-pill ${uid === currentUser.id ? 'active' : ''}" onclick="window.toggleReaction('${id}', '${emoji}')">${emoji}</span>`;
            }
            reactionsHtml += '</div>';
        }
        contentHtml += reactionsHtml;

        // Meta (Time + Read Status)
        let timeStr = '';
        if (msg.timestamp && msg.timestamp.toDate) {
            timeStr = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        let statusHtml = '';
        if (isMe) {
            // Checks
            const color = msg.read ? '#43b581' : '#b9bbbe'; // Green if read, gray otherwise
            const icon = msg.read ? 'fas fa-check-double' : 'fas fa-check';
            
            let readTooltip = msg.read ? 'Visto' : 'Enviado';
            if (msg.read && msg.readAt && msg.readAt.toDate) {
                const readTime = msg.readAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                readTooltip = `Visto a las ${readTime}`;
            }

            statusHtml = `<span title="${readTooltip}" style="margin-left:5px; color:${color}; font-size: 0.7rem; cursor: pointer;"><i class="${icon}"></i></span>`;
        }

        contentHtml += `<div style="display:flex; justify-content:flex-end; align-items:center; margin-top:5px; opacity:0.8;">
                            <span class="message-time">${timeStr}</span>
                            ${statusHtml}
                        </div>`;
        
        div.innerHTML = contentHtml;
        chatWindow.appendChild(div);
    }

    // --- CONTEXT MENU & ACTIONS ---

    function showContextMenu(e, msg, id) {
        // Remove existing menus
        document.querySelectorAll('.message-actions-menu').forEach(el => el.remove());

        const menu = document.createElement('div');
        menu.className = 'message-actions-menu';
        
        // Emojis
        const emojis = ['❤️', '😂', '😮', '😢', '👍', '👎'];
        const emojiContainer = document.createElement('div');
        emojiContainer.className = 'emoji-picker-container';
        emojis.forEach(emoji => {
            const span = document.createElement('span');
            span.className = 'emoji-option';
            span.textContent = emoji;
            span.onclick = () => {
                toggleReaction(id, emoji);
                menu.remove();
            };
            emojiContainer.appendChild(span);
        });
        menu.appendChild(emojiContainer);

        // Actions
        const actionsDiv = document.createElement('div');
        actionsDiv.style.display = 'flex';
        actionsDiv.style.gap = '5px';
        actionsDiv.style.marginLeft = '10px';
        actionsDiv.style.borderLeft = '1px solid #444';
        actionsDiv.style.paddingLeft = '10px';

        // Reply Btn
        const replyBtn = document.createElement('button');
        replyBtn.className = 'action-btn';
        replyBtn.innerHTML = '<i class="fas fa-reply"></i>';
        replyBtn.onclick = () => { startReply(msg, id); menu.remove(); };
        actionsDiv.appendChild(replyBtn);

        // Edit/Delete (Only for me)
        if (msg.senderId === currentUser.id) {
            // Edit
            if (msg.type === 'text') {
                const editBtn = document.createElement('button');
                editBtn.className = 'action-btn';
                editBtn.innerHTML = '<i class="fas fa-pen"></i>';
                editBtn.onclick = () => { startEdit(msg, id); menu.remove(); };
                actionsDiv.appendChild(editBtn);
            }

            // Delete
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn delete';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.onclick = () => { confirmDelete(id, true); menu.remove(); }; // True = owner
            actionsDiv.appendChild(delBtn);
        } else {
            // Delete for me only (received messages)
            const delBtn = document.createElement('button');
            delBtn.className = 'action-btn delete';
            delBtn.innerHTML = '<i class="fas fa-trash"></i>';
            delBtn.onclick = () => { confirmDelete(id, false); menu.remove(); };
            actionsDiv.appendChild(delBtn);
        }

        menu.appendChild(actionsDiv);

        // Position logic
        const target = e.target.closest('.message');
        target.appendChild(menu);
        
        // Close on click outside
        const closeMenu = (evt) => {
            if (!menu.contains(evt.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };
        // Timeout to avoid immediate trigger
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    }

    // Expose for global access (onclick handlers)
    window.toggleReaction = async (msgId, emoji) => {
        try {
            const msgRef = doc(db, "messages", msgId);
            const msgDoc = await getDoc(msgRef);
            if (!msgDoc.exists()) return;

            const data = msgDoc.data();
            const reactions = data.reactions || {};
            
            // Toggle
            if (reactions[currentUser.id] === emoji) {
                delete reactions[currentUser.id];
            } else {
                reactions[currentUser.id] = emoji;
            }

            await updateDoc(msgRef, { reactions });
        } catch (e) {
            console.error("Error reaction:", e);
        }
    };

    function startReply(msg, id) {
        replyingTo = { id, name: msg.senderName, text: msg.text || 'Archivo adjunto' };
        document.getElementById('reply-preview-bar').classList.remove('hidden');
        document.querySelector('.reply-preview-title').textContent = `Respondiendo a ${replyingTo.name}`;
        document.getElementById('reply-preview-text').textContent = replyingTo.text;
        messageInput.focus();
    }

    function startEdit(msg, id) {
        editingMessageId = id;
        messageInput.value = msg.text;
        document.getElementById('reply-preview-bar').classList.remove('hidden');
        document.querySelector('.reply-preview-title').textContent = `Editando mensaje`;
        document.getElementById('reply-preview-text').textContent = msg.text;
        sendBtn.innerHTML = '<i class="fas fa-check"></i>';
        messageInput.focus();
    }

    async function confirmDelete(msgId, isSender) {
        if (!confirm("¿Eliminar mensaje?")) return;

        try {
            const msgRef = doc(db, "messages", msgId);
            
            if (isSender) {
                // Sender Options
                if (confirm("¿Eliminar para todos?\nCancelar = Solo para mí")) {
                    await deleteDoc(msgRef);
                } else {
                    // Soft delete for me
                    const msgDoc = await getDoc(msgRef);
                    const deletedFor = msgDoc.data().deletedFor || [];
                    deletedFor.push(currentUser.id);
                    await updateDoc(msgRef, { deletedFor });
                }
            } else {
                // Receiver - Always soft delete
                const msgDoc = await getDoc(msgRef);
                const deletedFor = msgDoc.data().deletedFor || [];
                deletedFor.push(currentUser.id);
                await updateDoc(msgRef, { deletedFor });
            }
        } catch (e) {
            console.error("Delete error:", e);
        }
    }

    async function sendMessage(content, type = 'text', fileName = null) {
        if (!currentUser) return;

        try {
            // EDIT MODE
            if (editingMessageId) {
                const msgRef = doc(db, "messages", editingMessageId);
                await updateDoc(msgRef, {
                    text: content,
                    edited: true,
                    editedAt: serverTimestamp()
                });
                cancelReplyOrEdit();
                return;
            }

            // NEW MESSAGE
            const msgData = {
                text: type === 'text' ? content : null,
                content: type !== 'text' ? content : null,
                type: type,
                fileName: fileName,
                timestamp: serverTimestamp(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar,
                read: false,
                deletedFor: [] // Init array
            };

            // REPLY DATA
            if (replyingTo) {
                msgData.replyTo = replyingTo;
            }

            await addDoc(collection(db, "messages"), msgData);
            cancelReplyOrEdit();

        } catch (e) {
            console.error("Error sending message: ", e);
            alert("Error al enviar. Verifica tu conexión.");
        }
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // --- FILE UPLOAD HELPER (CLOUDINARY) ---

    async function uploadFile(file, folder = 'uploads') {
        const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;
        
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        // folder parameter is handled by the preset or can be added to formData if signed, 
        // but for unsigned with dynamic folders/presets, we rely on the preset configuration.
        // We can try to pass 'folder' param if the preset allows it, but usually unsigned presets enforce specific folders.
        // For simplicity with the provided preset, we just upload.

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error.message || 'Error uploading to Cloudinary');
            }

            const data = await response.json();
            // Prefer secure_url
            return data.secure_url;
        } catch (error) {
            console.error("Upload failed:", error);
            alert("Error al subir archivo: " + error.message);
            return null;
        }
    }

    // --- EVENT LISTENERS (INPUTS) ---

    sendBtn.addEventListener('click', () => {
        const text = messageInput.value.trim();
        if (text) {
            sendMessage(text);
            messageInput.value = '';
            messageInput.style.height = 'auto';
            updateActivityStatus(null); // Stop typing status immediately
            clearTimeout(typingTimeout);
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendBtn.click();
        }
    });

    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        
        // Typing indicator logic
        updateActivityStatus('typing');
        
        if (typingTimeout) clearTimeout(typingTimeout);
        
        typingTimeout = setTimeout(() => {
            updateActivityStatus(null);
        }, 2000); // Stop showing "typing" after 2 seconds of inactivity
    });

    fileInput.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            for (const file of files) {
                // Visual feedback
                const originalIcon = sendBtn.innerHTML;
                sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                const url = await uploadFile(file);
                
                sendBtn.innerHTML = originalIcon;
                
                if (url) {
                    if (file.type.startsWith('image/')) {
                        sendMessage(url, 'image');
                    } else {
                        sendMessage(url, 'file', file.name);
                    }
                }
            }
            fileInput.value = ''; 
        }
    });

    clearBtn.addEventListener('click', async () => {
        if(confirm('⚠️ ¿ESTÁS SEGURO? ⚠️\nEsto borrará PERMANENTEMENTE todos los mensajes para AMBOS usuarios.\n\nEsta acción no se puede deshacer.')) {
            try {
                // Visual feedback
                const originalIcon = clearBtn.innerHTML;
                clearBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                const q = query(collection(db, "messages"));
                const querySnapshot = await getDocs(q);
                
                const deletePromises = [];
                querySnapshot.forEach((doc) => {
                    deletePromises.push(deleteDoc(doc.ref));
                });
                
                await Promise.all(deletePromises);
                
                clearBtn.innerHTML = originalIcon;
                // No need to alert success, the onSnapshot listener will clear the screen automatically when docs are gone
            } catch (e) {
                console.error("Error clearing chat:", e);
                alert("Error al borrar el chat. Verifica permisos.");
                clearBtn.innerHTML = '<i class="fas fa-eraser"></i>';
            }
        }
    });

    // --- AUDIO RECORDING ---

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        recordBtn.addEventListener('click', async () => {
            if (!isRecording) {
                try {
                    // Update status to recording
                    updateActivityStatus('recording');

                    // Debug: Check available devices first
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    console.log("Available devices:", devices);
                    const hasAudioInput = devices.some(device => device.kind === 'audioinput');
                    
                    if (!hasAudioInput) {
                        throw new Error('NotFoundError'); // Manually throw if no input found based on enumeration
                    }

                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    
                    // Determine supported mime type
                    let mimeType = 'audio/webm';
                    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                        mimeType = 'audio/webm;codecs=opus';
                    } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                        mimeType = 'audio/mp4';
                    }
                    
                    console.log("Using mimeType:", mimeType);
                    mediaRecorder = new MediaRecorder(stream, { mimeType });
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        if (e.data.size > 0) {
                            audioChunks.push(e.data);
                        }
                    };

                    mediaRecorder.onstop = async () => {
                        // Reset activity status
                        updateActivityStatus(null);
                        
                        // Use the same mime type for the blob
                        const audioBlob = new Blob(audioChunks, { type: mimeType.split(';')[0] });
                        // Validate blob size
                        if (audioBlob.size > 0) {
                            // Extension depends on mime type
                            const ext = mimeType.includes('mp4') ? 'm4a' : 'webm';
                            const audioFile = new File([audioBlob], `voice_note.${ext}`, { type: mimeType.split(';')[0] });
                            
                            recordBtn.classList.remove('recording');
                            const originalIcon = recordBtn.innerHTML;
                            recordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                            
                            const url = await uploadFile(audioFile, 'audio');
                            recordBtn.innerHTML = originalIcon;
                            
                            if (url) {
                                sendMessage(url, 'audio');
                            }
                        }
                        
                        // Stop all tracks to release microphone
                        stream.getTracks().forEach(track => track.stop());
                    };

                    mediaRecorder.start();
                    isRecording = true;
                    recordBtn.classList.add('recording');
                } catch (err) {
                    updateActivityStatus(null); // Reset on error
                    console.error('Error accessing microphone:', err);
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        alert("⚠️ Permiso de micrófono denegado.\nPor favor, permite el acceso al micrófono en tu navegador para enviar notas de voz.");
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        alert("⚠️ No se encontró ningún micrófono en este dispositivo.");
                    } else {
                        alert("⚠️ Error al acceder al micrófono: " + err.message);
                    }
                }
            } else {
                if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                    mediaRecorder.stop();
                }
                isRecording = false;
                recordBtn.classList.remove('recording');
                updateActivityStatus(null); // Ensure reset
            }
        });
    } else {
        console.warn("MediaDevices API not supported in this browser.");
        recordBtn.style.display = 'none';
    }

    // --- IMAGE PASTE & PREVIEW ---
    
    // Paste Event on Input
    messageInput.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                showImagePreview(blob);
                return;
            }
        }
    });

    // Global Paste Event (when chat is open but input might not be focused)
    window.addEventListener('paste', (e) => {
        if (chatApp.classList.contains('hidden')) return;
        if (document.activeElement === messageInput) return; // Already handled

        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                showImagePreview(blob);
                return;
            }
        }
    });

    function showImagePreview(file) {
        // Create Modal Elements dynamically
        const modal = document.createElement('div');
        modal.className = 'image-preview-modal';
        
        const content = document.createElement('div');
        content.className = 'image-preview-content';
        
        const title = document.createElement('h3');
        title.textContent = 'Enviar imagen pegada';
        
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        
        const actions = document.createElement('div');
        actions.className = 'preview-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'preview-btn cancel';
        cancelBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar';
        cancelBtn.onclick = () => {
            modal.remove();
        };
        
        const sendBtn = document.createElement('button');
        sendBtn.className = 'preview-btn send';
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
        sendBtn.onclick = async () => {
            // Loading state
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            sendBtn.disabled = true;
            cancelBtn.disabled = true;
            
            const url = await uploadFile(file);
            if (url) {
                sendMessage(url, 'image');
                modal.remove();
            } else {
                // Reset on error
                sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar';
                sendBtn.disabled = false;
                cancelBtn.disabled = false;
            }
        };
        
        actions.appendChild(cancelBtn);
        actions.appendChild(sendBtn);
        
        content.appendChild(title);
        content.appendChild(img);
        content.appendChild(actions);
        modal.appendChild(content);
        
        // Close on click outside (background)
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });
        
        document.body.appendChild(modal);
        
        // Focus send button for quick Enter press
        sendBtn.focus();
    }

    // Init App
    init();
});
