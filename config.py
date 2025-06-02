# config.py
# Configurações centralizadas do Modbus TCP Manager

import os
from dataclasses import dataclass


@dataclass
class ModbusConfig:
    """Configurações do protocolo Modbus"""
    DEFAULT_IP: str = '192.168.2.55'
    DEFAULT_PORT: int = 502
    DEFAULT_UNIT_ID: int = 1
    DEFAULT_TIMEOUT: int = 10
    MAX_RETRIES: int = 3
    MAX_REGISTERS_READ: int = 125
    MAX_REGISTER_VALUE: int = 65535


@dataclass
class FlaskConfig:
    """Configurações do servidor Flask"""
    HOST: str = '0.0.0.0'
    PORT: int = 5000
    DEBUG: bool = True
    SECRET_KEY: str = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')


@dataclass
class LoggingConfig:
    """Configurações de logging"""
    LEVEL: str = 'INFO'
    FORMAT: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    DATE_FORMAT: str = '%Y-%m-%d %H:%M:%S'


# Instâncias das configurações
modbus_config = ModbusConfig()
flask_config = FlaskConfig()
logging_config = LoggingConfig()