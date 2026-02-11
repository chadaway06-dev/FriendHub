import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
    getDatabase, ref, set, push, onValue, update 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import {
    getStorage, ref as sRef, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAP6R90jCwrTrqS8K8DuVXJwHGow4fgBQs",
  authDomain: "friendhub-e5c4b.firebaseapp.com",
  databaseURL: "https://friendhub-e5c4b-default-rtdb.firebaseio.com",
  projectId: "friendhub-e5c4b",
  storageBucket: "friendhub-e5c4b.appspot.com",
  messagingSenderId: "663939570117",
  appId: "1:663939570117:web:aa9b880963c65881d0d3ac",
  measurementId: "G-VF17396TNK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getDatabase();
const storage = getStorage();

const isLoginPage = window.location.pathname.includes("login.html");
const isChatPage = window.location.pathname.includes("chat.html");

if (isLoginPage) {
    const email = document.getElementById("email");
    const password = document.getElementById("password");
    const loginBtn = document.getElementById("loginBtn");
    const signupBtn = document.getElementById("signupBtn");
    const errorText = document.getElementById("loginError");

    onAuthStateChanged(auth, user => {
        if (user) window.location.href = "chat.html";
    });

    loginBtn.onclick = () => {
        signInWithEmailAndPassword(auth, email.value, password.value)
            .catch(err => errorText.textContent = err.message);
    };

    signupBtn.onclick = () => {
        createUserWithEmailAndPassword(auth, email.value, password.value)
            .then(userCred => {
                set(ref(db, "users/" + userCred.user.uid), {
                    email: email.value,
                    profilePic: "",
                    online: true
                });
            })
            .catch(err => errorText.textContent = err.message);
    };
}

if (isChatPage) {
    const logoutBtn = document.getElementById("logoutBtn");
    const friendsList = document.getElementById("friendsList");
    const messagesDiv = document.getElementById("messages");
    const messageInput = document.getElementById("messageInput");
    const sendBtn = document.getElementById("sendBtn");
    const typingIndicator = document.getElementById("typingIndicator");

    const chatUserName = document.getElementById("chatUserName");
    const chatUserPic = document.getElementById("chatUserPic");
    const myProfilePic = document.getElementById("myProfilePic");

    let currentUser = null;
    let currentChatId = null;
    let typingTimeout = null;

    onAuthStateChanged(auth, user => {
        if (!user) {
            window.location.href = "login.html";
            return;
        }

        currentUser = user;
        loadMyProfile();
        loadFriends();
    });

    function loadMyProfile() {
        onValue(ref(db, "users/" + currentUser.uid), snap => {
            const data = snap.val();
            if (data && data.profilePic) {
                myProfilePic.src = data.profilePic;
            }
        });
    }

    function loadFriends() {
        onValue(ref(db, "users"), snap => {
            friendsList.innerHTML = "";

            snap.forEach(child => {
                const uid = child.key;
                const data = child.val();

                if (uid === currentUser.uid) return;

                const item = document.createElement("div");
                item.classList.add("friend-item");
                item.dataset.uid = uid;

                const img = document.createElement("img");
                img.src = data.profilePic || "https://via.placeholder.com/50";
                img.classList.add("friend-pic");

                const dot = document.createElement("div");
                dot.classList.add("online-dot");
                if (!data.online) dot.style.opacity = "0.2";

                item.appendChild(img);
                item.appendChild(dot);

                item.onclick = () => openChat(uid, data);

                friendsList.appendChild(item);
            });
        });
    }

    function openChat(friendUid, friendData) {
        currentChatId = [currentUser.uid, friendUid].sort().join("_");

        chatUserName.textContent = friendData.email;
        chatUserPic.src = friendData.profilePic || "https://via.placeholder.com/50";

        document.querySelectorAll(".friend-item").forEach(i => i.classList.remove("friend-selected"));
        document.querySelector(`[data-uid="${friendUid}"]`).classList.add("friend-selected");

        messagesDiv.innerHTML = "";
        loadMessages();
    }

    function loadMessages() {
        onValue(ref(db, "messages/" + currentChatId), snap => {
            messagesDiv.innerHTML = "";

            snap.forEach(child => {
                const msg = child.val();
                addMessage(msg);
            });

            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
    }

    function addMessage(msg) {
        const bubble = document.createElement("div");
        bubble.classList.add("message");

        if (msg.sender === currentUser.uid) {
            bubble.classList.add("me");
        } else {
            bubble.classList.add("them");
        }

        bubble.textContent = msg.text;
        messagesDiv.appendChild(bubble);
    }

    sendBtn.onclick = sendMessage;
    messageInput.onkeydown = () => sendTyping();

    function sendMessage() {
        if (!messageInput.value.trim() || !currentChatId) return;

        push(ref(db, "messages/" + currentChatId), {
            sender: currentUser.uid,
            text: messageInput.value,
            timestamp: Date.now()
        });

        messageInput.value = "";
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function sendTyping() {
        if (!currentChatId) return;

        set(ref(db, `typing/${currentChatId}/${currentUser.uid}`), true);

        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            set(ref(db, `typing/${currentChatId}/${currentUser.uid}`), false);
        }, 1200);
    }

    onValue(ref(db, "typing"), snap => {
        if (!currentChatId) return;

        const typingData = snap.val();
        if (!typingData || !typingData[currentChatId]) {
            typingIndicator.classList.add("hidden");
            return;
        }

        const othersTyping = Object.keys(typingData[currentChatId]).filter(uid => uid !== currentUser.uid);
        typingIndicator.classList.toggle("hidden", othersTyping.length === 0);
    });

    logoutBtn.onclick = () => {
        update(ref(db, "users/" + currentUser.uid), { online: false });
        signOut(auth);
    };
}
