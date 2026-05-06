const io = require('socket.io-client');
const readline = require('readline');
const { randomUUID } = require('crypto');

const SERVER_URL = 'http://localhost:5000';
const DEFAULT_TTL = 60;

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling']
});

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let username = '';
let room = '';

const ask = (question) => {
    return new Promise((resolve) => {
        rl.question(question, (answer) => resolve(answer.trim()));
    });
};

const askSession = async () => {
    username = await ask('Usuario: ');
    room = await ask('Sala privada: ');

    if (!username || !room) {
        console.log('Debes ingresar usuario y sala.');
        process.exit(1);
    }

    socket.emit('join_private_room', { username, room });
};

const sendMessage = (input) => {
    if (input === '/salir') {
        socket.emit('leave_chat');
        socket.disconnect();
        process.exit(0);
    }

    socket.emit('private_message', {
        messageId: randomUUID(),
        message: input,
        timestamp: new Date().toLocaleTimeString(),
        ttl: DEFAULT_TTL
    });
};

socket.on('connect', () => {
    console.log('Conectado al servidor.');
    askSession();
});

socket.on('joined_private_room', (data) => {
    console.log(`Entraste a la sala ${data.room} como ${data.username}.`);
    console.log('Escribe mensajes o /salir para terminar.');
    rl.prompt();
});

socket.on('join_error', (data) => {
    console.log(data.message || 'No se pudo entrar a la sala.');
});

socket.on('user_joined', (data) => {
    console.log(`${data.username} entro a la sala.`);
    rl.prompt();
});

socket.on('user_left', (data) => {
    console.log(`${data.username} salio de la sala.`);
    rl.prompt();
});

socket.on('room_user_list', (users) => {
    console.log(`Conectados: ${users.join(', ') || 'sin usuarios'}`);
    rl.prompt();
});

socket.on('private_message', (data) => {
    const isOwn = data.username === username;
    const author = isOwn ? 'Tu' : data.username;
    console.log(`${author} [${data.timestamp || ''}] (${data.ttl}s): ${data.message}`);

    if (!isOwn) {
        socket.emit('message_read', { messageId: data.messageId });
    }

    rl.prompt();
});

socket.on('message_read', (data) => {
    console.log(`Mensaje ${data.messageId} leido por ${data.reader}.`);
    rl.prompt();
});

socket.on('disconnect', () => {
    console.log('Desconectado del servidor.');
});

rl.on('line', (input) => {
    const message = input.trim();

    if (message) {
        sendMessage(message);
    }

    rl.prompt();
}).on('close', () => {
    socket.emit('leave_chat');
    socket.disconnect();
    process.exit(0);
});

rl.setPrompt('> ');
