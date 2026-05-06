const STORAGE_KEYS = {
    username: 'chat.username',
    room: 'chat.room'
};

const TTL_OPTIONS = {
    10: '10s',
    60: '1min',
    300: '5min'
};

const CHECK_SENT_ICON = `
    <svg class="check-icon" viewBox="0 0 20 16" aria-label="Enviado" role="img">
        <path d="M3 8.2 7.1 12.2 17 2.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
`;

const CHECK_READ_ICON = `
    <svg class="check-icon read" viewBox="0 0 24 16" aria-label="Leido" role="img">
        <path d="M2.5 8.2 6.3 12 15.8 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
        <path d="M9 8.4 12.6 12 22 2.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path>
    </svg>
`;

const template = document.createElement('template');

template.innerHTML = `
    <style>
        :host {
            color: #202124;
            display: block;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            min-height: 100vh;
        }

        * {
            box-sizing: border-box;
        }

        .page {
            background: #f3f5f4;
            min-height: 100vh;
            padding: 20px;
        }

        .layout {
            display: grid;
            gap: 12px;
            grid-template-columns: minmax(0, 1fr) 270px;
            margin: 0 auto;
            max-width: 1100px;
        }

        .panel {
            background: #ffffff;
            border: 1px solid #dde3e0;
            border-radius: 8px;
            overflow: hidden;
        }

        .header {
            align-items: center;
            border-bottom: 1px solid #dde3e0;
            display: flex;
            gap: 12px;
            justify-content: space-between;
            padding: 14px 16px;
        }

        h1,
        h2 {
            font-size: 18px;
            font-weight: 700;
            line-height: 1.2;
            margin: 0;
        }

        h2 {
            font-size: 15px;
        }

        .room-label,
        .status,
        .message-state,
        .expires {
            color: #66736d;
            font-size: 12px;
        }

        .status {
            align-items: center;
            display: inline-flex;
            gap: 8px;
            white-space: nowrap;
        }

        .dot {
            background: #a5aea9;
            border-radius: 50%;
            height: 8px;
            width: 8px;
        }

        .dot.connected {
            background: #0f8f72;
        }

        .messages {
            display: flex;
            flex-direction: column;
            gap: 8px;
            height: 60vh;
            min-height: 360px;
            overflow-y: auto;
            padding: 16px;
        }

        .message {
            align-self: flex-start;
            background: #f1f3f2;
            border: 1px solid #e7ece9;
            border-radius: 7px;
            max-width: min(78%, 620px);
            padding: 9px 11px;
        }

        .message.own {
            align-self: flex-end;
            background: #e2f3ed;
            border-color: #c5e4d9;
        }

        .meta {
            align-items: center;
            color: #66736d;
            display: flex;
            flex-wrap: wrap;
            font-size: 12px;
            gap: 7px;
            margin-bottom: 4px;
        }

        .text {
            line-height: 1.45;
            overflow-wrap: anywhere;
        }

        .expires {
            display: grid;
            gap: 5px;
            margin-top: 8px;
            min-width: 180px;
        }

        .ttl-row {
            align-items: center;
            display: flex;
            gap: 6px;
        }

        .ttl-dot {
            background: #9aa6a0;
            border-radius: 50%;
            height: 6px;
            width: 6px;
        }

        .ttl-bar {
            background: rgba(32, 33, 36, 0.1);
            border-radius: 999px;
            height: 3px;
            overflow: hidden;
        }

        .ttl-progress {
            background: #0f8f72;
            border-radius: inherit;
            height: 100%;
            transition: width 0.25s linear;
            width: 100%;
        }

        .message-state {
            align-items: center;
            display: inline-flex;
            height: 15px;
            min-width: 18px;
        }

        .check-icon {
            color: #8a958f;
            display: block;
            height: 15px;
            width: 18px;
        }

        .check-icon.read {
            color: #0f8f72;
        }

        .notice {
            align-self: center;
            background: #ffffff;
            border: 1px solid #dde3e0;
            border-radius: 999px;
            color: #66736d;
            font-size: 13px;
            padding: 6px 12px;
            text-align: center;
        }

        form {
            border-top: 1px solid #dde3e0;
            display: flex;
            gap: 10px;
            padding: 12px;
        }

        .entry-form {
            border: 0;
            display: grid;
            gap: 9px;
            padding: 0;
        }

        .message-form {
            align-items: center;
        }

        input,
        select {
            background: #ffffff;
            border: 1px solid #cfd8d4;
            border-radius: 6px;
            color: #202124;
            font: inherit;
            min-width: 0;
            padding: 10px 11px;
        }

        input {
            flex: 1;
        }

        select {
            width: 105px;
        }

        input:focus,
        select:focus {
            border-color: #0f8f72;
            outline: 3px solid rgba(15, 143, 114, 0.14);
        }

        button {
            background: #202124;
            border: 0;
            border-radius: 6px;
            color: #ffffff;
            cursor: pointer;
            font: inherit;
            font-weight: 700;
            min-width: 88px;
            padding: 10px 13px;
        }

        button.secondary {
            background: #ffffff;
            border: 1px solid #cfd8d4;
            color: #3f4944;
        }

        button.secondary:disabled,
        button:disabled {
            background: #f2f4f7;
            border-color: #dde3e0;
            color: #98a39e;
            cursor: not-allowed;
        }

        .sidebar {
            padding: 16px;
        }

        .session-actions {
            display: grid;
            gap: 8px;
            margin: 12px 0 16px;
        }

        .users {
            border-top: 1px solid #dde3e0;
            display: grid;
            gap: 6px;
            margin: 0;
            padding: 12px 0 0;
        }

        .user {
            background: #f7f9f8;
            border: 1px solid #e7ece9;
            border-radius: 6px;
            color: #3f4944;
            font-size: 14px;
            list-style: none;
            overflow-wrap: anywhere;
            padding: 8px 9px;
        }

        @media (max-width: 780px) {
            .page {
                padding: 12px;
            }

            .layout {
                grid-template-columns: 1fr;
            }

            .messages {
                height: 54vh;
                min-height: 320px;
            }

            .message {
                max-width: 92%;
            }

            .message-form {
                align-items: stretch;
                display: grid;
                grid-template-columns: 1fr;
            }

            select,
            button {
                width: 100%;
            }
        }
    </style>

    <main class="page">
        <section class="layout">
            <article class="panel">
                <header class="header">
                    <div>
                        <h1>Chat privado</h1>
                        <div class="room-label" data-room-label>Sin sala activa</div>
                    </div>
                    <span class="status">
                        <span class="dot" data-status-dot></span>
                        <span data-status-text>Desconectado</span>
                    </span>
                </header>

                <section class="messages" data-messages></section>

                <form class="message-form" data-message-form>
                    <input data-message-input type="text" placeholder="Escribe un mensaje privado" autocomplete="off" disabled>
                    <select data-ttl-select disabled>
                        <option value="10">10s</option>
                        <option value="60" selected>1min</option>
                        <option value="300">5min</option>
                    </select>
                    <button type="submit" disabled>Enviar</button>
                </form>
            </article>

            <aside class="panel sidebar">
                <form class="entry-form" data-entry-form>
                    <h2>Ingreso privado</h2>
                    <input data-username-input type="text" placeholder="Nombre de usuario" autocomplete="name">
                    <input data-room-input type="text" placeholder="Codigo de sala" autocomplete="off">
                    <button type="submit">Entrar</button>
                </form>

                <div class="session-actions">
                    <button class="secondary" type="button" data-leave-button disabled>Salir</button>
                    <button class="secondary" type="button" data-clear-messages-button>Limpiar pantalla</button>
                </div>

                <h2>Conectados</h2>
                <ul class="users" data-users></ul>
            </aside>
        </section>
    </main>
`;

class ChatApp extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.appendChild(template.content.cloneNode(true));

        this.socket = null;
        this.username = this.loadStoredValue(STORAGE_KEYS.username);
        this.room = this.loadStoredValue(STORAGE_KEYS.room);
        this.messageTimers = new Map();

        this.messages = this.shadowRoot.querySelector('[data-messages]');
        this.users = this.shadowRoot.querySelector('[data-users]');
        this.statusDot = this.shadowRoot.querySelector('[data-status-dot]');
        this.statusText = this.shadowRoot.querySelector('[data-status-text]');
        this.roomLabel = this.shadowRoot.querySelector('[data-room-label]');
        this.entryForm = this.shadowRoot.querySelector('[data-entry-form]');
        this.usernameInput = this.shadowRoot.querySelector('[data-username-input]');
        this.roomInput = this.shadowRoot.querySelector('[data-room-input]');
        this.entryButton = this.entryForm.querySelector('button');
        this.leaveButton = this.shadowRoot.querySelector('[data-leave-button]');
        this.clearMessagesButton = this.shadowRoot.querySelector('[data-clear-messages-button]');
        this.messageForm = this.shadowRoot.querySelector('[data-message-form]');
        this.messageInput = this.shadowRoot.querySelector('[data-message-input]');
        this.messageButton = this.messageForm.querySelector('button');
        this.ttlSelect = this.shadowRoot.querySelector('[data-ttl-select]');

        this.usernameInput.value = this.username;
        this.roomInput.value = this.room;
        this.updateRoomLabel();
    }

    connectedCallback() {
        this.entryForm.addEventListener('submit', this.handleEntrySubmit);
        this.messageForm.addEventListener('submit', this.handleMessageSubmit);
        this.leaveButton.addEventListener('click', this.handleLeaveClick);
        this.clearMessagesButton.addEventListener('click', this.handleClearMessagesClick);
        this.connectSocket();
    }

    disconnectedCallback() {
        this.entryForm.removeEventListener('submit', this.handleEntrySubmit);
        this.messageForm.removeEventListener('submit', this.handleMessageSubmit);
        this.leaveButton.removeEventListener('click', this.handleLeaveClick);
        this.clearMessagesButton.removeEventListener('click', this.handleClearMessagesClick);
        this.clearAllTimers();

        if (this.socket) {
            this.socket.disconnect();
        }
    }

    handleEntrySubmit = (event) => {
        event.preventDefault();

        const username = this.usernameInput.value.trim();
        const room = this.roomInput.value.trim();
        if (!username || !room || !this.socket?.connected) {
            this.addNotice('Ingresa usuario y sala para continuar');
            return;
        }

        this.username = username;
        this.room = room;
        this.saveStoredValue(STORAGE_KEYS.username, username);
        this.saveStoredValue(STORAGE_KEYS.room, room);
        this.joinPrivateRoom();
    };

    handleMessageSubmit = (event) => {
        event.preventDefault();

        const message = this.messageInput.value.trim();
        if (!message || !this.username || !this.room || !this.socket?.connected) {
            return;
        }

        this.socket.emit('private_message', {
            messageId: crypto.randomUUID(),
            message,
            timestamp: new Date().toLocaleTimeString(),
            ttl: Number(this.ttlSelect.value)
        });
        this.messageInput.value = '';
        this.messageInput.focus();
    };

    handleLeaveClick = () => {
        if (!this.username || !this.room || !this.socket?.connected) {
            return;
        }

        this.socket.emit('leave_chat');
        this.username = '';
        this.room = '';
        this.removeStoredValue(STORAGE_KEYS.username);
        this.removeStoredValue(STORAGE_KEYS.room);
        this.setChatActive(false);
        this.updateRoomLabel();
        this.users.replaceChildren();
        this.addNotice('Saliste de la sala privada');
        this.usernameInput.focus();
    };

    handleClearMessagesClick = () => {
        this.clearAllTimers();
        this.messages.replaceChildren();
        this.addNotice('Pantalla limpiada');
    };

    connectSocket() {
        this.socket = io({
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            this.setConnectionStatus(true);
            this.entryButton.disabled = false;

            if (this.username && this.room) {
                this.joinPrivateRoom(true);
            }
        });

        this.socket.on('disconnect', () => {
            this.setConnectionStatus(false);
            this.setChatActive(false, { keepIdentity: true });
        });

        this.socket.on('connect_error', () => {
            this.setConnectionStatus(false);
            this.setChatActive(false, { keepIdentity: true });
        });

        this.socket.on('join_error', (data) => {
            this.addNotice(data.message || 'No se pudo entrar a la sala');
        });

        this.socket.on('joined_private_room', (data) => {
            this.username = data.username;
            this.room = data.room;
            this.setChatActive(true);
            this.updateRoomLabel();
            this.addNotice(`Entraste a la sala ${data.room}`);
            this.messageInput.focus();
        });

        this.socket.on('user_joined', (data) => {
            this.addNotice(`${data.username} entro a la sala`);
        });

        this.socket.on('user_left', (data) => {
            this.addNotice(`${data.username} salio de la sala`);
        });

        this.socket.on('room_user_list', (users) => {
            this.renderUsers(users);
        });

        this.socket.on('private_message', (data) => {
            const isOwn = data.username === this.username;
            this.addMessage(data, isOwn);

            if (!isOwn) {
                requestAnimationFrame(() => {
                    this.socket.emit('message_read', { messageId: data.messageId });
                    this.markMessageAsRead(data.messageId);
                    this.startExpirationTimer(data.messageId, Number(data.ttl));
                });
            }
        });

        this.socket.on('message_read', (data) => {
            this.markMessageAsRead(data.messageId, data.reader);
            this.startExpirationTimer(data.messageId, Number(data.ttl));
        });
    }

    joinPrivateRoom(isRestore = false) {
        this.socket.emit('join_private_room', {
            username: this.username,
            room: this.room
        });

        if (isRestore) {
            this.addNotice(`Sesion restaurada en ${this.room}`);
        }
    }

    setConnectionStatus(isConnected) {
        this.statusDot.classList.toggle('connected', isConnected);
        this.statusText.textContent = isConnected ? 'Conectado' : 'Desconectado';
    }

    setChatActive(isActive, options = {}) {
        if (!isActive && !options.keepIdentity) {
            this.usernameInput.value = '';
            this.roomInput.value = '';
        }

        this.usernameInput.disabled = isActive;
        this.roomInput.disabled = isActive;
        this.entryButton.disabled = isActive || !this.socket?.connected;
        this.leaveButton.disabled = !isActive;
        this.messageInput.disabled = !isActive;
        this.messageButton.disabled = !isActive;
        this.ttlSelect.disabled = !isActive;
    }

    updateRoomLabel() {
        this.roomLabel.textContent = this.room ? `Sala: ${this.room}` : 'Sin sala activa';
    }

    addMessage(data, isOwn) {
        const article = document.createElement('article');
        article.className = `message${isOwn ? ' own' : ''}`;
        article.dataset.messageId = data.messageId;

        const meta = document.createElement('div');
        meta.className = 'meta';

        const author = document.createElement('strong');
        author.textContent = isOwn ? 'Tu' : data.username;

        const time = document.createElement('span');
        time.textContent = data.timestamp || '';

        const state = document.createElement('span');
        state.className = 'message-state';
        state.dataset.messageState = '';
        state.innerHTML = isOwn ? CHECK_SENT_ICON : '';
        state.hidden = !isOwn;

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = data.message;

        const expires = document.createElement('div');
        expires.className = 'expires';
        expires.dataset.expires = '';
        expires.innerHTML = `
            <div class="ttl-row">
                <span class="ttl-dot"></span>
                <span data-expires-text></span>
            </div>
            <div class="ttl-bar">
                <span class="ttl-progress" data-expires-progress></span>
            </div>
        `;
        this.setExpirationWaitingState(expires, data.ttl, isOwn);

        meta.append(author, time, state);
        article.append(meta, text, expires);
        this.messages.appendChild(article);
        this.scrollToLatestMessage();
    }

    markMessageAsRead(messageId, reader) {
        const message = this.messages.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
        const state = message?.querySelector('[data-message-state]');

        if (state) {
            state.hidden = false;
            state.innerHTML = CHECK_READ_ICON;
            state.title = reader ? `Leido por ${reader}` : 'Leido';
        }
    }

    startExpirationTimer(messageElement, ttl) {
        const messageId = typeof messageElement === 'string'
            ? messageElement
            : messageElement.dataset.messageId;
        const target = typeof messageElement === 'string'
            ? this.messages.querySelector(`[data-message-id="${CSS.escape(messageElement)}"]`)
            : messageElement;

        if (!target || this.messageTimers.has(messageId) || !ttl) {
            return;
        }

        const expiresText = target.querySelector('[data-expires-text]');
        const expiresProgress = target.querySelector('[data-expires-progress]');
        if (!expiresText || !expiresProgress) {
            return;
        }

        let remaining = ttl;

        const renderRemaining = () => {
            expiresText.textContent = `Se elimina en ${this.formatRemaining(remaining)}`;
            expiresProgress.style.width = `${Math.max((remaining / ttl) * 100, 0)}%`;
        };

        renderRemaining();
        const timer = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                window.clearInterval(timer);
                this.messageTimers.delete(messageId);
                target.remove();
                return;
            }

            renderRemaining();
        }, 1000);

        this.messageTimers.set(messageId, timer);
    }

    formatRemaining(seconds) {
        if (seconds >= 60) {
            const minutes = Math.floor(seconds / 60);
            const rest = seconds % 60;
            return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
        }

        return `${seconds}s`;
    }

    setExpirationWaitingState(expires, ttl, isOwn) {
        const expiresText = expires.querySelector('[data-expires-text]');
        const expiresProgress = expires.querySelector('[data-expires-progress]');
        const ttlLabel = TTL_OPTIONS[ttl] || `${ttl}s`;

        expiresText.textContent = isOwn
            ? `Duracion ${ttlLabel}, inicia al ser leido`
            : `Duracion ${ttlLabel}, pendiente de lectura`;
        expiresProgress.style.width = '100%';
    }

    addNotice(message) {
        const notice = document.createElement('div');
        notice.className = 'notice';
        notice.textContent = message;
        this.messages.appendChild(notice);
        this.scrollToLatestMessage();
    }

    renderUsers(users) {
        this.users.replaceChildren();

        users.forEach((user) => {
            const item = document.createElement('li');
            item.className = 'user';
            item.textContent = user;
            this.users.appendChild(item);
        });
    }

    scrollToLatestMessage() {
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    clearAllTimers() {
        this.messageTimers.forEach((timer) => window.clearInterval(timer));
        this.messageTimers.clear();
    }

    loadStoredValue(key) {
        try {
            return localStorage.getItem(key) || '';
        } catch {
            return '';
        }
    }

    saveStoredValue(key, value) {
        try {
            localStorage.setItem(key, value);
        } catch {
            // localStorage puede estar bloqueado en modo privado o por politicas del navegador.
        }
    }

    removeStoredValue(key) {
        try {
            localStorage.removeItem(key);
        } catch {
            // localStorage puede estar bloqueado en modo privado o por politicas del navegador.
        }
    }
}

customElements.define('chat-app', ChatApp);
