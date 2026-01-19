import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, doc, getDoc, setDoc, updateDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCZyJnjNAJSRoHRGLzGBDumbtGOkB55Pyo",
  authDomain: "ayechat-4f50d.firebaseapp.com",
  projectId: "ayechat-4f50d",
  storageBucket: "ayechat-4f50d.firebasestorage.app",
  messagingSenderId: "533598786880",
  appId: "1:533598786880:web:0094638658a25b2dd616a5",
  measurementId: "G-3978XHQYQL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

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

    // --- INITIALIZATION ---
    
    async function init() {
        // Check if cached login exists
        const cachedUserId = localStorage.getItem(LOGIN_KEY);
        if (cachedUserId) {
            await loadUserAndStart(cachedUserId);
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
                    chatBackground: ''
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
            chatBackground: ''
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
        
        const pwd = passwordInput.value;
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
        
        // Update Header
        updateHeaderUI();
        
        // Apply Background
        applyChatBackground();

        // Start Listening to Messages
        subscribeToMessages();
        
        // Try to play sound to request permission (silent)
        notificationSound.play().catch(() => {});
    }

    function updateHeaderUI() {
        if(currentUser) {
            currentUserName.textContent = currentUser.name;
            currentUserAvatar.src = currentUser.avatar;
        }
    }
    
    function applyChatBackground() {
        if (currentUser && currentUser.chatBackground) {
            chatWindow.style.backgroundImage = `url('${currentUser.chatBackground}')`;
            chatWindow.style.backgroundSize = 'cover';
            chatWindow.style.backgroundPosition = 'center';
            chatWindow.style.backgroundAttachment = 'fixed'; // Parallax effect
        } else {
            chatWindow.style.backgroundImage = 'none';
        }
    }

    function logout() {
        localStorage.removeItem(LOGIN_KEY);
        currentUser = null;
        if (messagesUnsubscribe) messagesUnsubscribe();
        
        chatApp.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        
        // Reset Login UI
        selectedLoginUser = null;
        passwordSection.classList.add('hidden');
        document.querySelector('.user-selection').classList.remove('hidden');
        
        // Reset Background
        chatWindow.style.backgroundImage = 'none';
    }

    logoutBtn.addEventListener('click', logout);

    // --- PROFILE SETTINGS ---

    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        // Load current values
        settingsNickname.value = currentUser.name;
        settingsAvatarPreview.src = currentUser.avatar;
        settingsPassword.value = '';
        bgInput.value = ''; // Reset file input
    });

    closeModalBtn.addEventListener('click', () => {
        settingsModal.classList.add('hidden');
    });

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            settingsModal.classList.add('hidden');
        }
    });

    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => settingsAvatarPreview.src = e.target.result;
            reader.readAsDataURL(file);
        }
    });
    
    resetBgBtn.addEventListener('click', async () => {
        if (confirm('¿Quieres quitar el fondo personalizado?')) {
            try {
                await updateDoc(doc(db, "users", currentUser.id), {
                    chatBackground: ''
                });
                currentUser.chatBackground = '';
                applyChatBackground();
                alert('Fondo restaurado.');
            } catch (e) {
                console.error("Error resetting background:", e);
            }
        }
    });

    saveSettingsBtn.addEventListener('click', async () => {
        saveSettingsBtn.textContent = 'Guardando...';
        
        try {
            const updates = {};
            
            // 1. Check Name
            if (settingsNickname.value.trim() !== currentUser.name) {
                updates.name = settingsNickname.value.trim();
            }
            
            // 2. Check Password
            if (settingsPassword.value.trim()) {
                updates.password = settingsPassword.value.trim();
            }
            
            // 3. Check Avatar (Upload if changed)
            if (avatarInput.files.length > 0) {
                const url = await uploadFile(avatarInput.files[0], 'avatars');
                if (url) updates.avatar = url;
            }
            
            // 4. Check Background (Upload if changed)
            if (bgInput.files.length > 0) {
                const url = await uploadFile(bgInput.files[0], 'backgrounds');
                if (url) updates.chatBackground = url;
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, "users", currentUser.id), updates);
                
                // Update local state
                currentUser = { ...currentUser, ...updates };
                updateHeaderUI();
                if (updates.chatBackground !== undefined) {
                    applyChatBackground();
                }
                
                alert('Perfil actualizado correctamente');
                settingsModal.classList.add('hidden');
            } else {
                settingsModal.classList.add('hidden');
            }
        } catch (e) {
            console.error("Error updating profile:", e);
            alert("Error al guardar cambios");
        }
        
        saveSettingsBtn.textContent = 'Guardar Cambios';
    });

    // --- CHAT FUNCTIONALITY ---

    function subscribeToMessages() {
        if (messagesUnsubscribe) messagesUnsubscribe();

        const q = query(collection(db, "messages"), orderBy("timestamp", "asc"));
        
        messagesUnsubscribe = onSnapshot(q, (snapshot) => {
            // Check if there are new messages to play sound
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    const msg = change.doc.data();
                    // Play sound if message is not from me and it's new (less than 10 seconds old to avoid playing on load)
                    if (currentUser && msg.senderId !== currentUser.id) {
                        const now = new Date();
                        const msgTime = msg.timestamp ? msg.timestamp.toDate() : new Date();
                        // Only play if message is recent (within last 30 seconds)
                        if ((now - msgTime) < 30000) {
                            notificationSound.currentTime = 0;
                            notificationSound.play().catch(e => console.log("Audio autoplay prevented"));
                        }
                    }
                }
            });

            chatWindow.innerHTML = ''; // Re-render all (could be optimized)
            
            // Add welcome
            const welcome = document.createElement('div');
            welcome.className = 'welcome-message';
            welcome.innerHTML = '<i class="fas fa-shield-alt"></i><p>Chat encriptado iniciado.</p>';
            chatWindow.appendChild(welcome);

            snapshot.forEach((doc) => {
                renderMessage(doc.data());
            });
            scrollToBottom();
        });
    }

    function renderMessage(msg) {
        const div = document.createElement('div');
        const isMe = msg.senderId === currentUser.id;
        
        div.className = `message ${isMe ? 'sent' : 'received'}`;
        
        let contentHtml = '';
        
        // Sender Name (if received)
        if (!isMe && msg.senderName) {
            // Optional: You could fetch the latest name from 'users' collection instead of message data
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

        // Time
        let timeStr = '';
        if (msg.timestamp && msg.timestamp.toDate) {
            timeStr = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        contentHtml += `<span class="message-time">${timeStr}</span>`;
        
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
                senderAvatar: currentUser.avatar
            });
        } catch (e) {
            console.error("Error sending message: ", e);
            alert("Error al enviar. Verifica tu conexión.");
        }
    }

    function scrollToBottom() {
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // --- FILE UPLOAD HELPER ---

    async function uploadFile(file, folder = 'uploads') {
        const storageRef = ref(storage, `${folder}/${Date.now()}_${file.name}`);
        try {
            const snapshot = await uploadBytes(storageRef, file);
            return await getDownloadURL(snapshot.ref);
        } catch (error) {
            console.error("Upload failed", error);
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
                    // Debug: Check available devices first
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    console.log("Available devices:", devices);
                    const hasAudioInput = devices.some(device => device.kind === 'audioinput');
                    
                    if (!hasAudioInput) {
                        throw new Error('NotFoundError'); // Manually throw if no input found based on enumeration
                    }

                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = (e) => {
                        audioChunks.push(e.data);
                    };

                    mediaRecorder.onstop = async () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        // Validate blob size
                        if (audioBlob.size > 0) {
                            const audioFile = new File([audioBlob], "voice_note.webm", { type: "audio/webm" });
                            
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
            }
        });
    } else {
        console.warn("MediaDevices API not supported in this browser.");
        recordBtn.style.display = 'none';
    }

    // Init App
    init();
});
