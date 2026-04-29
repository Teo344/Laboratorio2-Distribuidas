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
    return "<h1>Bienvenido al Chat con WebSockets</h1>"

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