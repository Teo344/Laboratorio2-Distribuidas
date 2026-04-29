# Chat usando web sockets

## Crear el entorno virtual de python
```
# 1. Crear el entorno virtual
python -m venv venv

# 2. Activar el entorno
# En CMD:
venv\Scripts\activate.bat
# En PowerShell:
venv\Scripts\Activate.ps1

# 3. Instalar dependencias (asegúrate de tener requirements.txt)
pip install -r requirements.txt

# Alternativa: instalar directamente
pip install Flask Flask-SocketIO eventlet Flask-Cors
```

**Verificar el funcionamiento**
```
# Deberías ver (venv) al inicio de la línea de comandos
pip list   # Muestra los paquetes instalados

# Para salir del entorno virtual cuando termines
deactivate
```

## Crear el archivo app.py

```
from flask import Flask, render_template
from flask_socketio import SocketIO, emit, send
from flask_cors import CORS

# Inicializar la app Flask
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
CORS(app)  # Permitir solicitudes desde cualquier origen (útil para desarrollo)

# Inicializar SocketIO con el servidor asíncrono (eventlet por defecto)
socketio = SocketIO(app, cors_allowed_origins="*")

# Diccionario para asociar session_id con nombre de usuario (opcional)
usuarios = {}

@app.route('/')
def index():
    """Sirve la interfaz del chat"""
    return render_template('index.html')

# Evento cuando un cliente se conecta
@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')
    # No asignamos nombre aún; se pedirá en el cliente

# Evento para registrar un nombre de usuario
@socketio.on('set_username')
def handle_set_username(data):
    username = data.get('username', 'Anónimo')
    usuarios[request.sid] = username
    # Notificar a todos los usuarios que alguien se ha unido
    emit('user_joined', {'username': username}, broadcast=True, include_self=False)
    # Enviar lista de usuarios conectados (opcional)
    emit('user_list', list(usuarios.values()), broadcast=True)

# Evento para recibir y retransmitir mensajes de chat
@socketio.on('chat_message')
def handle_chat_message(data):
    username = usuarios.get(request.sid, 'Desconocido')
    mensaje = data.get('message', '')
    # Enviar a todos los clientes conectados
    emit('chat_message', {
        'username': username,
        'message': mensaje,
        'timestamp': data.get('timestamp', '')
    }, broadcast=True)

# Evento cuando un cliente se desconecta
@socketio.on('disconnect')
def handle_disconnect():
    username = usuarios.pop(request.sid, 'Alguien')
    print(f'Cliente desconectado: {request.sid} ({username})')
    emit('user_left', {'username': username}, broadcast=True)
    emit('user_list', list(usuarios.values()), broadcast=True)

# Necesario para importar request
from flask import request

if __name__ == '__main__':
    # Ejecutar el servidor con soporte WebSocket
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
```

### Levantar el servidor

```
# Ejecutar servidor
python app.py
```

# Creación del cliente.js
```
npm init -y
npm install socket.io-client
node client.js
```

## Codigo
```
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
```