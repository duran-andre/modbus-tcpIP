# app.py
# Ponto de entrada principal do Modbus TCP Manager

from flask import Flask, send_from_directory
from flask_cors import CORS
import logging
import os
from config import flask_config, logging_config
from backend.routes import api_bp

# Configuração de logging
logging.basicConfig(
    level=getattr(logging, logging_config.LEVEL),
    format=logging_config.FORMAT,
    datefmt=logging_config.DATE_FORMAT
)
logger = logging.getLogger(__name__)


def create_app() -> Flask:
    """Cria e configura a aplicação Flask"""
    app = Flask(__name__)
    app.config['SECRET_KEY'] = flask_config.SECRET_KEY
    
    # Habilitar CORS
    CORS(app)
    
    # Registrar blueprints
    app.register_blueprint(api_bp)
    
    # Rotas para servir arquivos estáticos do frontend
    @app.route('/')
    def index():
        return send_from_directory('frontend', 'index.html')
    
    @app.route('/<path:filename>')
    def serve_static(filename):
        return send_from_directory('frontend', filename)
    
    return app


if __name__ == '__main__':
    app = create_app()
    
    print("🚀 Iniciando servidor Modbus TCP Manager...")
    print(f"🌐 Acesse: http://{flask_config.HOST}:{flask_config.PORT}")
    
    app.run(
        host=flask_config.HOST,
        port=flask_config.PORT,
        debug=flask_config.DEBUG
    )