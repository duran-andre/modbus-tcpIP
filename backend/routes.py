# backend/routes.py
# Rotas da API Flask para o Modbus TCP Manager

from flask import Blueprint, request, jsonify
import logging
from typing import Dict, Any, Optional
from backend.modbus_manager import ModbusManager
from config import modbus_config

logger = logging.getLogger(__name__)

# Blueprint para as rotas da API
api_bp = Blueprint('api', __name__, url_prefix='/api')

# Instância global do gerenciador Modbus
modbus_manager: Optional[ModbusManager] = None


@api_bp.route('/connect', methods=['POST'])
def connect() -> Dict[str, Any]:
    """Conecta ao dispositivo Modbus"""
    global modbus_manager
    
    try:
        data = request.get_json()
        ip = data.get('ip')
        
        if not ip:
            return jsonify({
                "status": "disconnected", 
                "error": "IP do dispositivo não fornecido"
            }), 400
        
        # Criar novo gerenciador Modbus
        modbus_manager = ModbusManager(
            ip=ip,
            port=modbus_config.DEFAULT_PORT,
            unit_id=modbus_config.DEFAULT_UNIT_ID,
            timeout=modbus_config.DEFAULT_TIMEOUT
        )
        
        if modbus_manager.connect():
            return jsonify({
                "status": "connected",
                "clp_ip": ip,
                "unit_id": modbus_manager.unit_id,
                "timeout": modbus_manager.timeout
            })
        else:
            return jsonify({
                "status": "disconnected",
                "error": "Falha na conexão com o dispositivo"
            }), 500
            
    except Exception as e:
        logger.error(f"Erro na API connect: {e}")
        return jsonify({
            "status": "disconnected",
            "error": f"Erro interno: {str(e)}"
        }), 500


@api_bp.route('/disconnect', methods=['POST'])
def disconnect() -> Dict[str, str]:
    """Desconecta do dispositivo Modbus"""
    global modbus_manager
    
    if modbus_manager:
        modbus_manager.disconnect()
        modbus_manager = None
    
    return jsonify({"status": "disconnected"})


@api_bp.route('/read_registers', methods=['POST'])
def read_registers() -> Dict[str, Any]:
    """Lê registradores do dispositivo Modbus"""
    global modbus_manager
    
    try:
        if not modbus_manager:
            return jsonify({
                "success": False,
                "error": "Dispositivo não conectado"
            }), 400
        
        data = request.get_json()
        start_address = data.get('start_address', 0)
        count = data.get('count', 10)
        
        # Executar leitura
        result = modbus_manager.read_holding_registers(start_address, count)
        
        if result["success"]:
            return jsonify({
                "success": True,
                "registers": result["data"],
                "start_address": start_address,
                "count": len(result["data"]),
                "unit_id": modbus_manager.unit_id
            })
        else:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 500
            
    except Exception as e:
        logger.error(f"Erro na API read_registers: {e}")
        return jsonify({
            "success": False,
            "error": f"Erro interno: {str(e)}"
        }), 500


@api_bp.route('/write_register', methods=['POST'])
def write_register() -> Dict[str, Any]:
    """Escreve um valor em um registrador do dispositivo Modbus"""
    global modbus_manager
    
    try:
        if not modbus_manager:
            return jsonify({
                "success": False,
                "error": "Dispositivo não conectado"
            }), 400
        
        data = request.get_json()
        address = data.get('address')
        value = data.get('value')
        
        # Validação básica
        if address is None or value is None:
            return jsonify({
                "success": False,
                "error": "Endereço e valor são obrigatórios"
            }), 400
        
        # Executar escrita
        result = modbus_manager.write_single_register(address, value)
        
        if result["success"]:
            return jsonify({
                "success": True,
                "address": address,
                "value": value,
                "unit_id": modbus_manager.unit_id
            })
        else:
            return jsonify({
                "success": False,
                "error": result["error"]
            }), 500
            
    except Exception as e:
        logger.error(f"Erro na API write_register: {e}")
        return jsonify({
            "success": False,
            "error": f"Erro interno: {str(e)}"
        }), 500


@api_bp.route('/status', methods=['GET'])
def get_status():
    """Retorna o status da conexão Modbus"""
    global modbus_manager
    
    if modbus_manager and modbus_manager.is_connected:
        connection_info = modbus_manager.get_connection_info()
        return jsonify({
            "status": "connected",
            "ip": connection_info["ip"],
            "port": connection_info["port"],
            "unit_id": connection_info["unit_id"],
            "timeout": connection_info["timeout"]
        })
    else:
        return jsonify({"status": "disconnected"})

@api_bp.route('/write_coil', methods=['POST'])
def write_coil():
    """Escreve um valor em uma bobina (coil)"""
    if not modbus_manager or not modbus_manager.is_connected:
        return jsonify({
            "status": "error",
            "message": "Não conectado ao dispositivo Modbus"
        }), 400
    
    data = request.get_json()
    
    if not data or 'address' not in data or 'value' not in data:
        return jsonify({
            "status": "error",
            "message": "Parâmetros inválidos. Necessário: address, value"
        }), 400
    
    try:
        address = int(data['address'])
        value = int(data['value'])
        
        result = modbus_manager.write_coil(address, value)
        
        if result['success']:
            return jsonify({
                "status": "success",
                "message": f"Valor {value} escrito na bobina {address}"
            })
        else:
            return jsonify({
                "status": "error",
                "message": result['error']
            }), 400
            
    except ValueError as e:
        return jsonify({
            "status": "error",
            "message": f"Erro de conversão: {str(e)}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Erro ao escrever na bobina: {str(e)}"
        }), 500

@api_bp.route('/read_coils', methods=['POST'])
def read_coils():
    """Lê bobinas (coils) do dispositivo Modbus"""
    if not modbus_manager or not modbus_manager.is_connected:
        return jsonify({
            "status": "error",
            "message": "Não conectado ao dispositivo Modbus"
        }), 400
    
    data = request.get_json()
    
    if not data or 'start_address' not in data or 'count' not in data:
        return jsonify({
            "status": "error",
            "message": "Parâmetros inválidos. Necessário: start_address, count"
        }), 400
    
    try:
        start_address = int(data['start_address'])
        count = int(data['count'])
        
        result = modbus_manager.read_coils(start_address, count)
        
        if result['success']:
            return jsonify({
                "status": "success",
                "coils": [int(coil) for coil in result['data']],
                "message": f"Leitura de {count} bobinas a partir do endereço {start_address}"
            })
        else:
            return jsonify({
                "status": "error",
                "message": result['error']
            }), 400
            
    except ValueError as e:
        return jsonify({
            "status": "error",
            "message": f"Erro de conversão: {str(e)}"
        }), 400
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Erro ao ler bobinas: {str(e)}"
        }), 500