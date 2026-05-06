from flask import Flask, render_template, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit


# Inicializar la app Flask.
app = Flask(__name__)
app.config['SECRET_KEY'] = 'tu_clave_secreta_aqui'
CORS(app)  # Permitir solicitudes desde cualquier origen en desarrollo.

# Inicializar SocketIO con soporte para conexiones en tiempo real.
# El modo threading funciona bien en desarrollo y evita depender de eventlet,
# que no es compatible con el Python 3.14 usado por este entorno.
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# Diccionario para asociar el id de sesion con el nombre de usuario.
usuarios = {}


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


@socketio.on('connect')
def handle_connect():
    """Se ejecuta cuando un cliente abre una conexion Socket.IO."""
    print(f'Cliente conectado: {request.sid}')


@socketio.on('set_username')
def handle_set_username(data):
    """Guarda el nombre elegido por el cliente y avisa a los demas."""
    username = str(data.get('username', '')).strip() or 'Anonimo'
    usuarios[request.sid] = username

    emit('user_joined', {'username': username}, broadcast=True, include_self=False)
    emit('user_list', list(usuarios.values()), broadcast=True)


@socketio.on('chat_message')
def handle_chat_message(data):
    """Recibe un mensaje de un cliente y lo reenvia a todos."""
    username = usuarios.get(request.sid)
    mensaje = str(data.get('message', '')).strip()

    if not username or not mensaje:
        return

    emit('chat_message', {
        'username': username,
        'message': mensaje,
        'timestamp': data.get('timestamp', '')
    }, broadcast=True)


@socketio.on('leave_chat')
def handle_leave_chat():
    """Quita al cliente del chat sin cerrar la pagina web."""
    username = usuarios.pop(request.sid, None)

    if not username:
        return

    emit('user_left', {'username': username}, broadcast=True, include_self=False)
    emit('user_list', list(usuarios.values()), broadcast=True)


@socketio.on('disconnect')
def handle_disconnect():
    """Se ejecuta cuando un cliente cierra la conexion."""
    username = usuarios.pop(request.sid, None)
    print(f'Cliente desconectado: {request.sid} ({username})')

    if username:
        emit('user_left', {'username': username}, broadcast=True)
        emit('user_list', list(usuarios.values()), broadcast=True)


if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=5000,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
