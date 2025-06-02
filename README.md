# IoT Modbus Dashboard

Uma aplicação web para gerenciar conexões Modbus TCP, permitindo leitura e escrita de registradores e coils em dispositivos compatíveis com o protocolo Modbus TCP.

## Visão Geral

Este projeto implementa uma interface web moderna para interagir com dispositivos Modbus TCP, como CLPs (Controladores Lógicos Programáveis). A aplicação permite:

- Conectar a dispositivos Modbus TCP através de endereço IP
- Visualizar e controlar coils (entradas/saídas digitais)
- Ler múltiplos registradores de retenção (holding registers)
- Escrever valores em registradores específicos
- Monitorar dados em tempo real com atualização automática
- Visualizar histórico de operações realizadas
- Interface responsiva adaptável a diferentes dispositivos

## Estrutura do Projeto

```
modbus-004/
├── backend/
│   ├── __init__.py
│   ├── modbus_manager.py  # Gerenciamento de conexões Modbus
│   └── routes.py          # Rotas da API Flask
├── frontend/
│   ├── index.html         # Interface de usuário
│   ├── script.js          # Lógica de frontend
│   └── style.css          # Estilos CSS
├── app.py                 # Aplicação principal Flask
├── config.py              # Configurações centralizadas
└── requirements.txt       # Dependências Python
```

## Tecnologias Utilizadas

### Backend
- Python 3.x
- Flask (Framework web)
- Flask-CORS (Suporte a CORS)
- pymodbus (Cliente Modbus TCP)

### Frontend
- HTML5
- CSS3 com Tailwind CSS
- JavaScript (ES6+)
- Font Awesome (Ícones)

## Instalação

1. Clone o repositório:
   ```
   git clone [URL_DO_REPOSITÓRIO]
   cd modbus-004
   ```

2. Instale as dependências:
   ```
   pip install -r requirements.txt
   ```

3. Execute a aplicação:
   ```
   python app.py
   ```

4. Acesse a interface web em: `http://localhost:5000`

## Uso

### Dashboard

O dashboard principal oferece uma visão geral do sistema com:
- Status de conexão
- Controle rápido de coils
- Ações rápidas para leitura e escrita
- Monitoramento em tempo real

### Conectar a um dispositivo Modbus TCP
1. Insira o endereço IP do dispositivo Modbus TCP
2. Clique em "Conectar"
3. O status da conexão será exibido na parte superior da interface

### Controle de Coils
1. Navegue até a seção "Coils" no menu lateral
2. Configure o endereço inicial e a quantidade de coils
3. Clique em "Carregar Coils"
4. Clique em qualquer coil para alternar seu estado (ligado/desligado)

### Ler registradores
1. Insira o endereço inicial do registrador
2. Insira a quantidade de registradores a serem lidos (1-125)
3. Clique em "Ler"
4. Os valores lidos serão exibidos na seção de resultados

### Escrever em um registrador
1. Insira o endereço do registrador
2. Insira o valor a ser escrito (0-65535)
3. Clique em "Escrever"
4. O resultado da operação será exibido na seção de resultados

### Monitoramento Automático
1. Ative a opção "Leitura Automática"
2. Configure o intervalo de atualização desejado
3. Os dados serão atualizados automaticamente no intervalo especificado

## Configuração

As configurações do projeto estão centralizadas no arquivo `config.py`. Você pode ajustar:

- Configurações do Modbus (timeout, porta, etc.)
- Configurações do servidor Flask (porta, modo de depuração, etc.)
- Configurações de logging

## API REST

A aplicação expõe os seguintes endpoints:

- `GET /api/status` - Verifica o status da conexão Modbus
- `POST /api/connect` - Conecta a um dispositivo Modbus TCP
- `POST /api/disconnect` - Desconecta do dispositivo atual
- `POST /api/read_registers` - Lê registradores de retenção
- `POST /api/write_register` - Escreve em um registrador específico
- `POST /api/read_coils` - Lê estados de coils
- `POST /api/write_coil` - Escreve em um coil específico

## Contribuição

Contribuições são bem-vindas! Por favor, sinta-se à vontade para enviar pull requests ou abrir issues para melhorias e correções de bugs.

## Licença

Este projeto está licenciado sob a licença MIT - veja o arquivo LICENSE para detalhes.

## Tratamento de Erros

A aplicação implementa tratamento de erros para:

- Falhas de conexão Modbus
- Timeouts de comunicação
- Entradas inválidas
- Erros de protocolo Modbus

## Licença

[Especifique a licença aqui]