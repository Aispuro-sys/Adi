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
    // Constants
    const DEFAULT_PASSWORD = "16402080077290"; 
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
    let typingTimeout = null;

    // --- INITIALIZATION ---
    
    async function init() {
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
                updateActivityStatus(null); // Clear typing/recording
            }
        });
    }

    // ... (loadLoginAvatars remains same)

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
                    password: DEFAULT_PASSWORD,
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
            password: DEFAULT_PASSWORD,
            avatar: `https://ui-avatars.com/api/?name=${userId}&background=random`,
            chatBackground: '',
            online: false,
            activityStatus: null
        };
        await setDoc(doc(db, "users", userId), defaultData);
    }

    // ... (Login flow remains same) ...

    function showChatInterface() {
        loginScreen.classList.add('hidden');
        chatApp.classList.remove('hidden');
        
        // Set Online
        updateOnlineStatus(true);

        // Setup Partner Info in Header
        setupPartnerHeader();
        
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

    function setupPartnerHeader() {
        if (!currentUser) return;
        
        const partnerId = currentUser.id === 'eduardo' ? 'adilene' : 'eduardo';
        
        if (partnerUnsubscribe) partnerUnsubscribe();

        partnerUnsubscribe = onSnapshot(doc(db, "users", partnerId), (doc) => {
            if (doc.exists()) {
                const partnerData = doc.data();
                
                // Update Header UI with Partner Info
                currentUserName.textContent = partnerData.name;
                currentUserAvatar.src = partnerData.avatar || `https://ui-avatars.com/api/?name=${partnerId}`;
                
                const statusEl = document.querySelector('.status');
                
                // Priority: Activity Status > Online > Last Seen
                if (partnerData.activityStatus === 'typing') {
                    statusEl.textContent = 'Escribiendo...';
                    statusEl.style.color = '#7289da'; // Primary blueish color
                    statusEl.style.fontStyle = 'italic';
                } else if (partnerData.activityStatus === 'recording') {
                    statusEl.textContent = 'Grabando audio...';
                    statusEl.style.color = '#ff4757'; // Red
                    statusEl.style.fontStyle = 'italic';
                } else if (partnerData.online) {
                    statusEl.textContent = 'En línea';
                    statusEl.style.color = '#43b581';
                    statusEl.style.fontStyle = 'normal';
                } else {
                    let lastSeenText = 'Desconectado';
                    if (partnerData.lastSeen) {
                        const date = partnerData.lastSeen.toDate();
                        lastSeenText = `Visto: ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
                    }
                    statusEl.textContent = lastSeenText;
                    statusEl.style.color = '#b9bbbe';
                    statusEl.style.fontStyle = 'normal';
                }
            }
        });
    }

    // ... (applyChatBackground remains same) ...

    function logout() {
        if (currentUser) {
            updateOnlineStatus(false); // Go offline
            updateActivityStatus(null);
        }

        localStorage.removeItem(LOGIN_KEY);
        currentUser = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
        if (partnerUnsubscribe) partnerUnsubscribe();
        
        chatApp.classList.add('hidden');
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

    async function markUnreadMessagesAsRead() {
        if (!currentUser) return;
        // Query for unread messages sent by OTHER people
        // Ideally we would index this, but for small chats we can just iterate the snapshot or query simple
        // For simplicity in this structure, we might need to query or just rely on the snapshot.
        // Let's do a simple query for unread messages not from me.
        // NOTE: This might require a composite index. To avoid index issues, we will iterate visible DOM or just query simply.
        // Actually, let's just use the current snapshot if we had access, but simpler:
        // Query messages where senderId != me AND read != true
        // But senderId != me requires index usually if combined.
        
        // Let's just rely on the real-time listener: 
        // When we open the app, the listener fires "added" for all. 
        // We can check there. But for "coming back to tab", we need to re-scan.
        
        const q = query(collection(db, "messages"));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.senderId !== currentUser.id && !data.read) {
                markMessageAsRead(docSnap.id);
            }
        });
    }

    function renderMessage(msg, id) {
        const div = document.createElement('div');
        const isMe = msg.senderId === currentUser.id;
        
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        div.id = `msg-${id}`;
        
        let contentHtml = '';
        
        // Sender Name (if received)
        if (!isMe && msg.senderName) {
            contentHtml += `<div style="font-size: 0.7rem; color: #b9bbbe; margin-bottom: 2px;">${msg.senderName}</div>`;
        }

        // Content
        if (msg.text) {
            const textWithLinks = msg.text.replace(
                /(https?:\/\/[^\s]+)/g, 
                '<a href="$1" target="_blank" style="color: #7289da; text-decoration: underline;">$1</a>'
            );
            contentHtml += `<p>${textWithLinks}</p>`;
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

    async function sendMessage(content, type = 'text', fileName = null) {
        if (!currentUser) return;

        try {
            await addDoc(collection(db, "messages"), {
                text: type === 'text' ? content : null,
                content: type !== 'text' ? content : null,
                type: type,
                fileName: fileName,
                timestamp: serverTimestamp(),
                senderId: currentUser.id,
                senderName: currentUser.name,
                senderAvatar: currentUser.avatar,
                read: false // Default unread
            });
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

    // Init App
    init();
});
