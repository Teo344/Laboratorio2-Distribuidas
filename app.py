import time
import threading

from flask import Flask, render_template, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room


# Inicializar la app Flask.
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
CORS(app)  # Permitir solicitudes desde cualquier origen en desarrollo.

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Diccionario para asociar el id de sesion con usuario y sala activa.
usuarios = {}

# Metadatos temporales para confirmaciones de lectura.
# No se guarda el contenido del mensaje, solo datos minimos de enrutamiento.
mensajes_activos = {}
TTL_PERMITIDOS = {10, 60, 300}

# Tiempo maximo que un mensaje no leido permanece en memoria (5 minutos).
MAX_UNREAD_LIFETIME = 300


@app.route('/')
def index():
    """Sirve la interfaz web del chat."""
    return render_template('index.html')


@app.route('/vendor/socket.io.min.js')
def socketio_client():
    """Sirve el cliente JavaScript de Socket.IO usado por el navegador."""
    return send_from_directory(
        'node_modules/socket.io-client/dist',
        'socket.io.min.js',
    )


def normalizar_texto(valor):
    """Convierte un valor recibido desde el cliente en texto seguro para usar."""
    return str(valor or '').strip()


def usuarios_en_sala(room):
    """Devuelve los nombres de usuarios conectados a una sala especifica."""
    return [
        data['username']
        for data in usuarios.values()
        if data.get('room') == room
    ]


def emitir_lista_sala(room):
    """Actualiza la lista de conectados para todos los clientes de una sala."""
    emit('room_user_list', usuarios_en_sala(room), room=room)


def olvidar_mensaje(message_id):
    """Elimina metadatos temporales de un mensaje expirado."""
    mensajes_activos.pop(message_id, None)


@socketio.on('connect')
def handle_connect():
    """Se ejecuta cuando un cliente abre una conexion Socket.IO."""
    print(f'Cliente conectado: {request.sid}')


@socketio.on('join_private_room')
def handle_join_private_room(data):
    """Registra al cliente en una sala privada."""
    username = normalizar_texto(data.get('username'))
    room = normalizar_texto(data.get('room'))

    if not username or not room:
        emit('join_error', {
            'message': 'Debes ingresar un nombre de usuario y una sala privada.'
        })
        return

    sesion_anterior = usuarios.get(request.sid)
    if sesion_anterior:
        leave_room(sesion_anterior['room'])

    join_room(room)
    usuarios[request.sid] = {
        'username': username,
        'room': room,
    }

    emit('joined_private_room', {'username': username, 'room': room})
    emit('user_joined', {'username': username}, room=room, include_self=False)
    emitir_lista_sala(room)


@socketio.on('private_message')
def handle_private_message(data):
    """Recibe un mensaje privado y lo reenvia solo a la sala del emisor."""
    sesion = usuarios.get(request.sid)
    mensaje = normalizar_texto(data.get('message'))
    message_id = normalizar_texto(data.get('messageId'))

    try:
        ttl = int(data.get('ttl', 60))
    except (TypeError, ValueError):
        ttl = 60

    if not sesion or not mensaje or not message_id or ttl not in TTL_PERMITIDOS:
        return

    room = sesion['room']
    mensajes_activos[message_id] = {
        'sender_sid': request.sid,
        'room': room,
        'ttl': ttl,
        'read_by': set(),
        'created_at': time.time(),
    }

    # Auto-limpiar si nadie lo lee en 5 minutos
    threading.Timer(MAX_UNREAD_LIFETIME, olvidar_mensaje, args=[message_id]).start()

    emit('private_message', {
        'messageId': message_id,
        'username': sesion['username'],
        'message': mensaje,
        'timestamp': data.get('timestamp', ''),
        'ttl': ttl,
    }, room=room)


@socketio.on('message_read')
def handle_message_read(data):
    """Envia confirmacion de lectura solamente al emisor original."""
    sesion = usuarios.get(request.sid)
    message_id = normalizar_texto(data.get('messageId'))
    metadata = mensajes_activos.get(message_id)

    if not sesion or not metadata:
        return

    if metadata['room'] != sesion['room'] or metadata['sender_sid'] == request.sid:
        return

    if request.sid in metadata['read_by']:
        return

    metadata['read_by'].add(request.sid)
    read_at = time.time()
    expires_at = read_at + metadata['ttl']
    socketio.start_background_task(
        lambda: (socketio.sleep(metadata['ttl']), olvidar_mensaje(message_id))
    )

    emit('message_read', {
        'messageId': message_id,
        'reader': sesion['username'],
        'ttl': metadata['ttl'],
        'readAt': read_at,
        'expiresAt': expires_at,
    }, to=metadata['sender_sid'])


@socketio.on('leave_chat')
def handle_leave_chat():
    """Quita al cliente de su sala privada sin cerrar la pagina web."""
    sesion = usuarios.pop(request.sid, None)

    if not sesion:
        return

    room = sesion['room']
    leave_room(room)
    emit('user_left', {'username': sesion['username']}, room=room, include_self=False)
    emitir_lista_sala(room)


@socketio.on('disconnect')
def handle_disconnect():
    """Se ejecuta cuando un cliente cierra la conexion."""
    sesion = usuarios.pop(request.sid, None)
    print(f'Cliente desconectado: {request.sid} ({sesion})')

    if sesion:
        emit('user_left', {'username': sesion['username']}, room=sesion['room'])
        emitir_lista_sala(sesion['room'])


if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
