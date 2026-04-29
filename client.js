const io = require('socket.io-client');
const readline = require('readline');

// Configuración del servidor (cambia la URL si es necesario)
const SERVER_URL = 'http://localhost:5000';

// Conectar al servidor Socket.IO
const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']  // asegura compatibilidad
});

// Interfaz para leer líneas desde la terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let username = '';

// Función para preguntar el nombre de usuario (usando Promise + arrow functions)
const askUsername = () => {
    return new Promise((resolve) => {
        rl.question('👤 Ingresa tu nombre de usuario: ', (answer) => {
            resolve(answer.trim());
        });
    });
};

// Función para enviar mensajes al chat
const sendMessage = (message) => {
    if (message === '/salir') {
        console.log('🔌 Desconectando...');
        socket.disconnect();
        process.exit(0);
    }
    socket.emit('chat_message', {
        message: message,
        timestamp: new Date().toLocaleTimeString()
    });
};

// Función para mostrar mensajes del chat
const displayMessage = (data, isOwn = false) => {
    const prefix = isOwn ? '📤 Tú' : `📨 ${data.username}`;
    console.log(`${prefix} [${data.timestamp || ''}]: ${data.message}`);
};

// Eventos del socket (todos con arrow functions)

socket.on('connect', () => {
    console.log('✅ Conectado al servidor de chat.');
    askUsername().then((name) => {
        username = name;
        socket.emit('set_username', { username });
        console.log(`🎉 Bienvenido al chat, ${username}! Escribe /salir para terminar.\n`);
        rl.prompt();
    });
});

socket.on('user_joined', (data) => {
    console.log(`🟢 ${data.username} se ha unido al chat.`);
});

socket.on('user_left', (data) => {
    console.log(`🔴 ${data.username} abandonó el chat.`);
});

socket.on('user_list', (users) => {
    console.log(`👥 Usuarios conectados: ${users.join(', ') || 'solo tú'}`);
});

socket.on('chat_message', (data) => {
    const isOwn = (data.username === username);
    displayMessage(data, isOwn);
    rl.prompt(); // vuelve a mostrar el prompt después de un mensaje entrante
});

socket.on('disconnect', () => {
    console.log('⚠️ Desconectado del servidor.');
    process.exit(0);
});

// Manejo de entrada del usuario (con arrow function)
rl.on('line', (input) => {
    if (input.trim()) {
        sendMessage(input.trim());
    }
    rl.prompt();
}).on('close', () => {
    socket.disconnect();
    process.exit(0);
});

// Configurar el prompt
rl.setPrompt('> ');