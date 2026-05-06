const STORAGE_KEYS = {
    username: 'chat.username',
    history: 'chat.history'
};
const MAX_STORED_MESSAGES = 100;

const template = document.createElement('template');

template.innerHTML = `
    <style>
        :host {
            color: #172026;
            display: block;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            min-height: 100vh;
        }

        * {
            box-sizing: border-box;
        }

        .page {
            background: #f6f7f8;
            min-height: 100vh;
            padding: 20px;
        }

        .layout {
            display: grid;
            gap: 12px;
            grid-template-columns: minmax(0, 1fr) 250px;
            margin: 0 auto;
            max-width: 1080px;
        }

        .panel {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
        }

        .header {
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
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

        .status {
            align-items: center;
            display: inline-flex;
            font-size: 13px;
            gap: 8px;
            color: #667085;
            white-space: nowrap;
        }

        .dot {
            background: #a3aab4;
            border-radius: 50%;
            height: 8px;
            width: 8px;
        }

        .dot.connected {
            background: #16a34a;
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
            background: #f2f4f7;
            border: 1px solid #eef0f3;
            border-radius: 7px;
            max-width: min(78%, 620px);
            padding: 9px 11px;
        }

        .message.own {
            align-self: flex-end;
            background: #dff4e8;
            border-color: #bfe7cf;
        }

        .meta {
            color: #667085;
            display: flex;
            font-size: 12px;
            gap: 8px;
            justify-content: space-between;
            margin-bottom: 4px;
        }

        .text {
            line-height: 1.45;
            overflow-wrap: anywhere;
        }

        .notice {
            align-self: center;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 999px;
            color: #667085;
            font-size: 13px;
            padding: 6px 12px;
        }

        form {
            border-top: 1px solid #e5e7eb;
            display: flex;
            gap: 10px;
            padding: 12px;
        }

        input {
            background: #ffffff;
            border: 1px solid #d8dde3;
            border-radius: 6px;
            color: #172026;
            flex: 1;
            font: inherit;
            min-width: 0;
            padding: 10px 11px;
        }

        input:focus {
            border-color: #256f5c;
            outline: 3px solid rgba(37, 111, 92, 0.13);
        }

        button {
            background: #172026;
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
            border: 1px solid #d8dde3;
            color: #344054;
        }

        button.secondary:disabled {
            background: #f2f4f7;
            border-color: #e5e7eb;
            color: #98a2b3;
        }

        button:disabled {
            background: #a3aab4;
            cursor: not-allowed;
        }

        .sidebar {
            padding: 16px;
        }

        .username-form {
            border: 0;
            display: grid;
            gap: 9px;
            padding: 0;
        }

        .session-actions {
            display: grid;
            gap: 8px;
            margin: 12px 0 16px;
        }

        .users {
            border-top: 1px solid #e5e7eb;
            display: grid;
            gap: 6px;
            margin: 0;
            padding: 12px 0 0;
        }

        .user {
            background: #f8faf9;
            border: 1px solid #eef0f3;
            border-radius: 6px;
            color: #344054;
            font-size: 14px;
            list-style: none;
            overflow-wrap: anywhere;
            padding: 8px 9px;
        }

        @media (max-width: 760px) {
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
        }
    </style>

    <main class="page">
        <section class="layout">
            <article class="panel">
                <header class="header">
                    <h1>Chat con WebSockets</h1>
                    <span class="status">
                        <span class="dot" data-status-dot></span>
                        <span data-status-text>Desconectado</span>
                    </span>
                </header>

                <section class="messages" data-messages></section>

                <form data-message-form>
                    <input data-message-input type="text" placeholder="Escribe un mensaje" autocomplete="off" disabled>
                    <button type="submit" disabled>Enviar</button>
                </form>
            </article>

            <aside class="panel sidebar">
                <form class="username-form" data-username-form>
                    <h2>Tu usuario</h2>
                    <input data-username-input type="text" placeholder="Nombre de usuario" autocomplete="name">
                    <button type="submit">Entrar</button>
                </form>
                <div class="session-actions">
                    <button class="secondary" type="button" data-leave-button disabled>Salir</button>
                    <button class="secondary" type="button" data-clear-history-button>Limpiar historial</button>
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
        this.username = this.loadStoredUsername();
        this.hasRenderedStoredHistory = false;
        this.messages = this.shadowRoot.querySelector('[data-messages]');
        this.users = this.shadowRoot.querySelector('[data-users]');
        this.statusDot = this.shadowRoot.querySelector('[data-status-dot]');
        this.statusText = this.shadowRoot.querySelector('[data-status-text]');
        this.usernameForm = this.shadowRoot.querySelector('[data-username-form]');
        this.usernameInput = this.shadowRoot.querySelector('[data-username-input]');
        this.usernameButton = this.usernameForm.querySelector('button');
        this.leaveButton = this.shadowRoot.querySelector('[data-leave-button]');
        this.clearHistoryButton = this.shadowRoot.querySelector('[data-clear-history-button]');
        this.messageForm = this.shadowRoot.querySelector('[data-message-form]');
        this.messageInput = this.shadowRoot.querySelector('[data-message-input]');
        this.messageButton = this.messageForm.querySelector('button');

        this.usernameInput.value = this.username;
    }

    connectedCallback() {
        this.usernameForm.addEventListener('submit', this.handleUsernameSubmit);
        this.messageForm.addEventListener('submit', this.handleMessageSubmit);
        this.leaveButton.addEventListener('click', this.handleLeaveClick);
        this.clearHistoryButton.addEventListener('click', this.handleClearHistoryClick);
        this.renderStoredHistory();
        this.connectSocket();
    }

    disconnectedCallback() {
        this.usernameForm.removeEventListener('submit', this.handleUsernameSubmit);
        this.messageForm.removeEventListener('submit', this.handleMessageSubmit);
        this.leaveButton.removeEventListener('click', this.handleLeaveClick);
        this.clearHistoryButton.removeEventListener('click', this.handleClearHistoryClick);

        if (this.socket) {
            this.socket.disconnect();
        }
    }

    handleUsernameSubmit = (event) => {
        event.preventDefault();

        const username = this.usernameInput.value.trim();
        if (!username || !this.socket?.connected) {
            return;
        }

        this.username = username;
        this.saveStoredUsername(username);
        this.socket.emit('set_username', { username });
        this.setChatActive(true);
        this.messageInput.focus();
        this.addNotice(`Bienvenido, ${username}`);
    };

    handleMessageSubmit = (event) => {
        event.preventDefault();

        const message = this.messageInput.value.trim();
        if (!message || !this.username || !this.socket?.connected) {
            return;
        }

        this.socket.emit('chat_message', {
            message,
            timestamp: new Date().toLocaleTimeString()
        });
        this.messageInput.value = '';
        this.messageInput.focus();
    };

    handleLeaveClick = () => {
        if (!this.username || !this.socket?.connected) {
            return;
        }

        const username = this.username;
        this.socket.emit('leave_chat');
        this.username = '';
        this.removeStoredUsername();
        this.setChatActive(false);
        this.users.replaceChildren();
        this.addNotice(`${username} salio del chat`);
        this.usernameInput.focus();
    };

    handleClearHistoryClick = () => {
        this.saveStoredHistory([]);
        this.messages.replaceChildren();
        this.addNotice('Historial local limpiado');
    };

    connectSocket() {
        this.socket = io({
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            this.setConnectionStatus(true);

            if (this.username) {
                this.socket.emit('set_username', { username: this.username });
                this.setChatActive(true);
                this.addNotice(`Sesion restaurada como ${this.username}`);
            }
        });

        this.socket.on('disconnect', () => {
            this.setConnectionStatus(false);
            this.setChatActive(false, { keepUsername: true });
        });

        this.socket.on('connect_error', () => {
            this.setConnectionStatus(false);
        });

        this.socket.on('user_joined', (data) => {
            this.addNotice(`${data.username} se unio al chat`);
        });

        this.socket.on('user_left', (data) => {
            this.addNotice(`${data.username} salio del chat`);
        });

        this.socket.on('user_list', (users) => {
            this.renderUsers(users);
        });

        this.socket.on('chat_message', (data) => {
            this.addMessage(data, data.username === this.username);
        });
    }

    setConnectionStatus(isConnected) {
        this.statusDot.classList.toggle('connected', isConnected);
        this.statusText.textContent = isConnected ? 'Conectado' : 'Desconectado';
    }

    setChatActive(isActive, options = {}) {
        if (!isActive && !options.keepUsername) {
            this.usernameInput.value = '';
        }

        this.usernameInput.disabled = isActive;
        this.usernameButton.disabled = isActive || !this.socket?.connected;
        this.leaveButton.disabled = !isActive;
        this.messageInput.disabled = !isActive;
        this.messageButton.disabled = !isActive;
    }

    addMessage(data, isOwn, options = {}) {
        const article = document.createElement('article');
        article.className = `message${isOwn ? ' own' : ''}`;

        const meta = document.createElement('div');
        meta.className = 'meta';

        const author = document.createElement('strong');
        author.textContent = isOwn ? 'Tu' : data.username;

        const time = document.createElement('span');
        time.textContent = data.timestamp || '';

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = data.message;

        meta.append(author, time);
        article.append(meta, text);
        this.messages.appendChild(article);
        this.scrollToLatestMessage();

        if (options.persist !== false) {
            this.rememberMessage(data);
        }
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

    renderStoredHistory() {
        if (this.hasRenderedStoredHistory) {
            return;
        }

        this.hasRenderedStoredHistory = true;
        const history = this.loadStoredHistory();

        history.forEach((message) => {
            this.addMessage(message, message.username === this.username, { persist: false });
        });
    }

    rememberMessage(data) {
        const history = this.loadStoredHistory();
        history.push({
            username: data.username || 'Desconocido',
            message: data.message || '',
            timestamp: data.timestamp || ''
        });
        this.saveStoredHistory(history.slice(-MAX_STORED_MESSAGES));
    }

    loadStoredUsername() {
        try {
            return localStorage.getItem(STORAGE_KEYS.username) || '';
        } catch {
            return '';
        }
    }

    saveStoredUsername(username) {
        try {
            localStorage.setItem(STORAGE_KEYS.username, username);
        } catch {
            // localStorage puede estar bloqueado en modo privado o por politicas del navegador.
        }
    }

    removeStoredUsername() {
        try {
            localStorage.removeItem(STORAGE_KEYS.username);
        } catch {
            // localStorage puede estar bloqueado en modo privado o por politicas del navegador.
        }
    }

    loadStoredHistory() {
        try {
            const rawHistory = localStorage.getItem(STORAGE_KEYS.history);
            const history = rawHistory ? JSON.parse(rawHistory) : [];

            if (!Array.isArray(history)) {
                return [];
            }

            return history
                .filter((item) => item && typeof item.message === 'string')
                .slice(-MAX_STORED_MESSAGES);
        } catch {
            return [];
        }
    }

    saveStoredHistory(history) {
        try {
            localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
        } catch {
            // Si se supera la cuota del navegador, el chat debe seguir funcionando.
        }
    }
}

customElements.define('chat-app', ChatApp);
