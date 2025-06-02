# backend/modbus_manager.py
# Gerenciador de conexões e operações Modbus

from pymodbus.client import ModbusTcpClient
import logging
import time
from typing import Dict, List, Optional, Union
from config import modbus_config

logger = logging.getLogger(__name__)


class ModbusManager:
    """Classe para gerenciar conexões e operações Modbus de forma robusta"""
    
    def __init__(self, ip: str, port: int = None, unit_id: int = None, timeout: int = None):
        """
        Inicializa o gerenciador Modbus
        
        Args:
            ip: Endereço IP do dispositivo Modbus
            port: Porta TCP (padrão: 502)
            unit_id: ID da unidade Modbus (padrão: 1)
            timeout: Timeout de conexão em segundos (padrão: 10)
        """
        self.ip = ip
        self.port = port or modbus_config.DEFAULT_PORT
        self.unit_id = unit_id or modbus_config.DEFAULT_UNIT_ID
        self.timeout = timeout or modbus_config.DEFAULT_TIMEOUT
        self.client: Optional[ModbusTcpClient] = None
        self.is_connected = False
    
    def connect(self) -> bool:
        """
        Estabelece conexão com o dispositivo Modbus
        
        Returns:
            bool: True se conectado com sucesso, False caso contrário
        """
        try:
            # Fechar conexão anterior se existir
            if self.client and self.client.connected:
                self.client.close()
                logger.info("Conexão anterior fechada")
            
            # Criar novo cliente
            self.client = ModbusTcpClient(
                host=self.ip, 
                port=self.port, 
                timeout=self.timeout
            )
            
            # Tentar conectar
            if self.client.connect():
                self.is_connected = True
                logger.info(f"✅ Conectado ao dispositivo Modbus em {self.ip}:{self.port}")
                return True
            else:
                self.is_connected = False
                logger.error(f"❌ Falha na conexão com {self.ip}:{self.port}")
                return False
                
        except Exception as e:
            self.is_connected = False
            logger.error(f"❌ Exceção na conexão: {e}")
            return False
    
    def disconnect(self) -> None:
        """Fecha a conexão com o dispositivo Modbus"""
        if self.client:
            self.client.close()
            self.is_connected = False
            logger.info("🔌 Desconectado do dispositivo Modbus")
    
    def _ensure_connection(self) -> bool:
        """
        Verifica e garante que a conexão está ativa
        
        Returns:
            bool: True se a conexão está ativa, False caso contrário
        """
        if not self.client or not self.client.connected:
            logger.warning("🔄 Conexão perdida, tentando reconectar...")
            return self.connect()
        return True
    
    def read_holding_registers(self, start_address: int, count: int, retries: int = 0) -> Dict[str, Union[bool, List[int], str, None]]:
        """
        Lê registradores holding do dispositivo Modbus
        
        Args:
            start_address: Endereço inicial dos registradores
            count: Quantidade de registradores a ler
            retries: Número de tentativas de retry (uso interno)
        
        Returns:
            dict: {"success": bool, "data": List[int] | None, "error": str | None}
        """
        try:
            # Validações
            if count <= 0 or count > modbus_config.MAX_REGISTERS_READ:
                return {
                    "success": False,
                    "data": None,
                    "error": f"Quantidade inválida. Deve ser entre 1 e {modbus_config.MAX_REGISTERS_READ}"
                }
            
            if start_address < 0:
                return {
                    "success": False,
                    "data": None,
                    "error": "Endereço inicial deve ser positivo"
                }
            
            # Verificar conexão
            if not self._ensure_connection():
                return {
                    "success": False,
                    "data": None,
                    "error": "Não foi possível estabelecer conexão com o dispositivo"
                }
            
            logger.info(f"📖 Lendo registradores {start_address} a {start_address + count - 1}")
            
            # Executar leitura
            response = self.client.read_holding_registers(
                address=start_address,
                count=count,
                slave=self.unit_id
            )
            
            # Verificar se houve erro na resposta
            if response.isError():
                error_msg = f"Erro Modbus: {response}"
                logger.error(f"❌ {error_msg}")
                
                # Tentar reconectar em caso de erro de conexão
                if retries < modbus_config.MAX_RETRIES and "connection" in str(response).lower():
                    logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} de reconexão")
                    time.sleep(1)
                    if self.connect():
                        return self.read_holding_registers(start_address, count, retries + 1)
                
                return {
                    "success": False,
                    "data": None,
                    "error": error_msg
                }
            
            # Sucesso na leitura
            registers = response.registers
            logger.info(f"✅ Leitura bem-sucedida: {len(registers)} registradores")
            logger.debug(f"📊 Valores lidos: {registers}")
            
            return {
                "success": True,
                "data": registers,
                "error": None
            }
            
        except Exception as e:
            error_msg = f"Exceção na leitura: {str(e)}"
            logger.error(f"❌ {error_msg}")
            
            # Tentar reconectar em caso de exceção
            if retries < modbus_config.MAX_RETRIES:
                logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} após exceção")
                time.sleep(1)
                if self.connect():
                    return self.read_holding_registers(start_address, count, retries + 1)
            
            return {
                "success": False,
                "data": None,
                "error": error_msg
            }
    
    def write_single_register(self, address: int, value: int, retries: int = 0) -> Dict[str, Union[bool, str, None]]:
        """
        Escreve um valor em um registrador holding
        
        Args:
            address: Endereço do registrador
            value: Valor a ser escrito (0-65535)
            retries: Número de tentativas de retry (uso interno)
        
        Returns:
            dict: {"success": bool, "error": str | None}
        """
        try:
            # Validações
            if address < 0:
                return {
                    "success": False,
                    "error": "Endereço deve ser positivo"
                }
            
            if not isinstance(value, int) or value < 0 or value > modbus_config.MAX_REGISTER_VALUE:
                return {
                    "success": False,
                    "error": f"Valor deve ser um inteiro entre 0 e {modbus_config.MAX_REGISTER_VALUE}"
                }
            
            # Verificar conexão
            if not self._ensure_connection():
                return {
                    "success": False,
                    "error": "Não foi possível estabelecer conexão com o dispositivo"
                }
            
            logger.info(f"📝 Escrevendo valor {value} no registrador {address}")
            
            # Executar escrita
            response = self.client.write_register(
                address=address,
                value=value,
                slave=self.unit_id
            )
            
            if response.isError():
                error_msg = f"Erro Modbus na escrita: {response}"
                logger.error(f"❌ {error_msg}")
                
                # Tentar reconectar em caso de erro
                if retries < modbus_config.MAX_RETRIES and "connection" in str(response).lower():
                    logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} de reconexão")
                    time.sleep(1)
                    if self.connect():
                        return self.write_single_register(address, value, retries + 1)
                
                return {
                    "success": False,
                    "error": error_msg
                }
            
            logger.info(f"✅ Escrita bem-sucedida no registrador {address}")
            return {
                "success": True,
                "error": None
            }
            
        except Exception as e:
            error_msg = f"Exceção na escrita: {str(e)}"
            logger.error(f"❌ {error_msg}")
            
            # Tentar reconectar em caso de exceção
            if retries < modbus_config.MAX_RETRIES:
                logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} após exceção")
                time.sleep(1)
                if self.connect():
                    return self.write_single_register(address, value, retries + 1)
            
            return {
                "success": False,
                "error": error_msg
            }
    
    def get_connection_info(self) -> Dict[str, Union[str, int, bool]]:
        """
        Retorna informações sobre a conexão atual
        
        Returns:
            dict: Informações da conexão
        """
        return {
            "ip": self.ip,
            "port": self.port,
            "unit_id": self.unit_id,
            "timeout": self.timeout,
            "is_connected": self.is_connected
        }
        
    def write_coil(self, address: int, value: int, retries: int = 0) -> Dict[str, Union[bool, str, None]]:
        """
        Escreve um valor em uma bobina (coil)
        
        Args:
            address: Endereço da bobina
            value: Valor a ser escrito (0 ou 1)
            retries: Número de tentativas de retry (uso interno)
        
        Returns:
            dict: {"success": bool, "error": str | None}
        """
        try:
            # Validações
            if address < 0:
                return {
                    "success": False,
                    "error": "Endereço deve ser positivo"
                }
            
            if value not in [0, 1]:
                return {
                    "success": False,
                    "error": "Valor deve ser 0 ou 1"
                }
            
            # Verificar conexão
            if not self._ensure_connection():
                return {
                    "success": False,
                    "error": "Não foi possível estabelecer conexão com o dispositivo"
                }
            
            logger.info(f"📝 Escrevendo valor {value} na bobina {address}")
            
            # Executar escrita
            response = self.client.write_coil(
                address=address,
                value=bool(value),
                slave=self.unit_id
            )
            
            if response.isError():
                error_msg = f"Erro Modbus na escrita da bobina: {response}"
                logger.error(f"❌ {error_msg}")
                
                # Tentar reconectar em caso de erro
                if retries < modbus_config.MAX_RETRIES and "connection" in str(response).lower():
                    logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} de reconexão")
                    time.sleep(1)
                    if self.connect():
                        return self.write_coil(address, value, retries + 1)
                
                return {
                    "success": False,
                    "error": error_msg
                }
            
            logger.info(f"✅ Escrita bem-sucedida na bobina {address}")
            return {
                "success": True,
                "error": None
            }
            
        except Exception as e:
            error_msg = f"Exceção na escrita da bobina: {str(e)}"
            logger.error(f"❌ {error_msg}")
            
            # Tentar reconectar em caso de exceção
            if retries < modbus_config.MAX_RETRIES:
                logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} após exceção")
                time.sleep(1)
                if self.connect():
                    return self.write_coil(address, value, retries + 1)
            
            return {
                "success": False,
                "error": error_msg
            }
            
    def read_coils(self, start_address: int, count: int, retries: int = 0) -> Dict[str, Union[bool, List[bool], str, None]]:
        """
        Lê bobinas (coils) do dispositivo Modbus
        
        Args:
            start_address: Endereço inicial das bobinas
            count: Quantidade de bobinas a ler
            retries: Número de tentativas de retry (uso interno)
        
        Returns:
            dict: {"success": bool, "data": List[bool] | None, "error": str | None}
        """
        try:
            # Validações
            if count <= 0 or count > modbus_config.MAX_REGISTERS_READ:
                return {
                    "success": False,
                    "data": None,
                    "error": f"Quantidade inválida. Deve ser entre 1 e {modbus_config.MAX_REGISTERS_READ}"
                }
            
            if start_address < 0:
                return {
                    "success": False,
                    "data": None,
                    "error": "Endereço inicial deve ser positivo"
                }
            
            # Verificar conexão
            if not self._ensure_connection():
                return {
                    "success": False,
                    "data": None,
                    "error": "Não foi possível estabelecer conexão com o dispositivo"
                }
            
            logger.info(f"📖 Lendo bobinas {start_address} a {start_address + count - 1}")
            
            # Executar leitura
            response = self.client.read_coils(
                address=start_address,
                count=count,
                slave=self.unit_id
            )
            
            # Verificar se houve erro na resposta
            if response.isError():
                error_msg = f"Erro Modbus: {response}"
                logger.error(f"❌ {error_msg}")
                
                # Tentar reconectar em caso de erro de conexão
                if retries < modbus_config.MAX_RETRIES and "connection" in str(response).lower():
                    logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} de reconexão")
                    time.sleep(1)
                    if self.connect():
                        return self.read_coils(start_address, count, retries + 1)
                
                return {
                    "success": False,
                    "data": None,
                    "error": error_msg
                }
            
            # Sucesso na leitura
            coils = response.bits[:count]  # Garantir que retornamos apenas a quantidade solicitada
            logger.info(f"✅ Leitura bem-sucedida: {len(coils)} bobinas")
            logger.debug(f"📊 Valores lidos: {coils}")
            
            return {
                "success": True,
                "data": coils,
                "error": None
            }
            
        except Exception as e:
            error_msg = f"Exceção na leitura de bobinas: {str(e)}"
            logger.error(f"❌ {error_msg}")
            
            # Tentar reconectar em caso de exceção
            if retries < modbus_config.MAX_RETRIES:
                logger.warning(f"🔄 Tentativa {retries + 1}/{modbus_config.MAX_RETRIES} após exceção")
                time.sleep(1)
                if self.connect():
                    return self.read_coils(start_address, count, retries + 1)
            
            return {
                "success": False,
                "data": None,
                "error": error_msg
            }