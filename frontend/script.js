// Modbus TCP Manager - JavaScript

class ModbusManager {
    constructor() {
        this.isConnected = false;
        this.currentIP = '';
        this.apiBaseUrl = window.location.origin;
        this.autoReadEnabled = false;
        this.autoReadInterval = null;
        this.autoReadIntervalMs = 5000; // 5 seconds default
        this.coilStates = {}; // Para armazenar estados dos coils
        this.activeSection = 'dashboard'; // Seção ativa por padrão
        this.autoReadCoilsInterval = null; // Para leitura automática de coils
        this.init();
    }

    init() {
        // Initialize auto read interval input
        document.getElementById('autoReadInterval').value = this.autoReadIntervalMs / 1000;
        
        this.bindEvents();
        this.updateUI();
        this.checkConnectionStatus();
        this.initCoils();
        this.setupNavigation();
    }

    // Função auxiliar para adicionar eventos com segurança
    safeAddEventListener(id, event, callback) {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener(event, callback);
        } else {
            console.warn(`Elemento com ID '${id}' não encontrado no DOM`);
        }
    }

    bindEvents() {
        // Connection buttons
        this.safeAddEventListener('connectBtn', 'click', () => this.connect());
        this.safeAddEventListener('disconnectBtn', 'click', () => this.disconnect());
        
        // Operation buttons
        this.safeAddEventListener('readBtn', 'click', () => this.readRegisters());
        this.safeAddEventListener('writeBtn', 'click', () => this.writeRegister());
        
        // Clear logs and results
        this.safeAddEventListener('clearLogsBtn', 'click', () => this.clearLogs());
        
        // Enter key handlers
        this.safeAddEventListener('deviceIp', 'keypress', (e) => {
            if (e.key === 'Enter') this.connect();
        });
        
        this.safeAddEventListener('writeValue', 'keypress', (e) => {
            if (e.key === 'Enter' && this.isConnected) this.writeRegister();
        });
        
        this.safeAddEventListener('readCount', 'keypress', (e) => {
            if (e.key === 'Enter' && this.isConnected) this.readRegisters();
        });
        
        // Auto read controls
        this.safeAddEventListener('autoReadToggle', 'change', (e) => {
            this.toggleAutoRead(e.target.checked);
        });
        
        this.safeAddEventListener('autoReadInterval', 'change', (e) => {
            this.updateAutoReadInterval(parseInt(e.target.value));
        });
        
        // Quick action buttons
        this.safeAddEventListener('quickReadBtn', 'click', () => this.readRegisters());
        this.safeAddEventListener('autoReadToggleBtn', 'click', () => {
            const newState = !this.autoReadEnabled;
            const autoReadToggle = document.getElementById('autoReadToggle');
            if (autoReadToggle) {
                autoReadToggle.checked = newState;
            }
            this.toggleAutoRead(newState);
        });
        this.safeAddEventListener('emergencyStopBtn', 'click', () => this.emergencyStop());

        // Settings button
        this.safeAddEventListener('settingsBtn', 'click', () => this.openSettingsModal());

        // Modal close button
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Sidebar toggle
        this.safeAddEventListener('sidebarToggle', 'click', () => this.toggleSidebar());
        this.safeAddEventListener('menuToggle', 'click', () => this.toggleSidebar());

        // Refresh button
        this.safeAddEventListener('refreshBtn', 'click', () => this.refreshData());
        
        // Coils buttons
        this.safeAddEventListener('refreshCoilsBtn', 'click', () => this.readCoils());
        this.safeAddEventListener('loadCoilsBtn', 'click', () => this.loadCustomCoils());
    }

    setupNavigation() {
        // Implementação direta de navegação
        const navItems = document.querySelectorAll('nav a[data-section]');
        console.log('Itens de navegação encontrados:', navItems.length);
        
        // Remover eventos antigos (caso existam)
        navItems.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
        });
        
        // Adicionar novos eventos
        document.querySelectorAll('nav a[data-section]').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const section = item.getAttribute('data-section');
                console.log('Item de navegação clicado:', section);
                
                // Atualizar navegação
                document.querySelectorAll('nav a[data-section]').forEach(navItem => {
                    navItem.classList.remove('bg-white/10');
                    navItem.classList.add('hover:bg-white/10');
                    navItem.classList.remove('text-white');
                    navItem.classList.add('text-white/80');
                    navItem.classList.add('hover:text-white');
                });
                
                // Ativar o item clicado
                item.classList.add('bg-white/10');
                item.classList.remove('hover:bg-white/10');
                item.classList.add('text-white');
                item.classList.remove('text-white/80');
                item.classList.remove('hover:text-white');
                
                // Atualizar seções de conteúdo
                document.querySelectorAll('section[id$="-section"]').forEach(content => {
                    content.classList.add('hidden');
                });
                
                const targetSection = document.getElementById(`${section}-section`);
                if (targetSection) {
                    console.log('Ativando seção:', section);
                    targetSection.classList.remove('hidden');
                    this.activeSection = section;
                    
                    // Atualizar título da página
                    const titles = {
                        'dashboard': 'Dashboard IoT',
                        'devices': 'Dispositivos',
                        'registers': 'Registradores',
                        'coils': 'Coils',
                        'monitoring': 'Monitoramento'
                    };
                    document.getElementById('pageTitle').textContent = titles[section] || 'IoT Dashboard';
                } else {
                    console.error('Seção não encontrada:', section);
                }
            });
        });
        
        // Garantir que a seção inicial seja exibida corretamente
        const initialNavItem = document.querySelector(`nav a[data-section="${this.activeSection}"]`);
        if (initialNavItem) {
            initialNavItem.click();
        }
    }

    // A função changeSection foi removida pois a navegação agora é tratada diretamente em setupNavigation

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        // Verificar se o sidebar está visível ou não
        if (sidebar.classList.contains('hidden')) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }
    }

    async checkConnectionStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/status`);
            const data = await response.json();
            
            if (data.status === 'connected') {
                this.isConnected = true;
                this.currentIP = data.ip;
                document.getElementById('deviceIp').value = data.ip;
            } else {
                this.isConnected = false;
                this.currentIP = '';
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Erro ao verificar status:', error);
            this.isConnected = false;
            this.updateUI();
        }
    }

    async connect() {
        const ip = document.getElementById('deviceIp').value.trim();
        const port = parseInt(document.getElementById('devicePort').value);
        const unitId = parseInt(document.getElementById('deviceUnitId').value);
        const timeout = parseInt(document.getElementById('deviceTimeout').value);
        
        if (!ip) {
            this.showToast('Por favor, insira o IP do dispositivo', 'error');
            return;
        }

        if (!this.isValidIP(ip)) {
            this.showToast('Formato de IP inválido', 'error');
            return;
        }

        this.showLoading(true);
        this.updateConnectionStatus('connecting', 'Conectando...');

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ ip, port, unit_id: unitId, timeout })
            });
            
            const data = await response.json();
            
            if (data.status === 'connected') {
                this.isConnected = true;
                this.currentIP = ip;
                this.showToast(`Conectado com sucesso a ${ip}`, 'success');
                this.updateConnectionStatus('connected', 'Conectado');
                this.updateLastReadTime();
                
                // Iniciar leitura automática das coils
                this.startAutoReadCoils();
            } else {
                this.isConnected = false;
                this.showToast(`Falha na conexão: ${data.error || 'Erro desconhecido'}`, 'error');
                this.updateConnectionStatus('disconnected', 'Desconectado');
            }
        } catch (error) {
            console.error('Erro na conexão:', error);
            this.isConnected = false;
            this.showToast('Erro ao conectar ao dispositivo', 'error');
            this.updateConnectionStatus('disconnected', 'Desconectado');
        } finally {
            this.showLoading(false);
            this.updateUI();
        }
    }

    async disconnect() {
        if (!this.isConnected) return;
        
        this.showLoading(true);
        
        try {
            // Stop auto read if enabled
            this.stopAutoRead();
            
            // Stop auto read coils
            this.stopAutoReadCoils();
            
            const response = await fetch(`${this.apiBaseUrl}/api/disconnect`, {
                method: 'POST'
            });
            
            const data = await response.json();
            
            if (data.status === 'disconnected') {
                this.isConnected = false;
                this.currentIP = '';
                this.showToast('Desconectado com sucesso', 'success');
            } else {
                this.showToast(`Falha ao desconectar: ${data.error || 'Erro desconhecido'}`, 'error');
            }
        } catch (error) {
            console.error('Erro ao desconectar:', error);
            this.showToast('Erro ao desconectar', 'error');
        } finally {
            this.updateConnectionStatus('disconnected', 'Desconectado');
            this.showLoading(false);
            this.updateUI();
        }
    }

    async readRegisters(isAutoRead = false) {
        if (!this.isConnected) {
            this.showToast('Conecte-se primeiro ao dispositivo', 'warning');
            return;
        }
        
        const startAddress = parseInt(document.getElementById('readStartAddress').value);
        const count = parseInt(document.getElementById('readCount').value);
        
        if (isNaN(startAddress) || isNaN(count)) {
            this.showToast('Endereço inicial e quantidade devem ser números', 'error');
            return;
        }
        
        // Mostrar loading apenas se não for leitura automática
        if (!isAutoRead) {
            this.showLoading(true);
        }
        
        try {
            // Verificar status da conexão antes de fazer a requisição
            const statusResponse = await fetch(`${this.apiBaseUrl}/api/status`);
            const statusData = await statusResponse.json();
            
            if (statusData.status !== 'connected') {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', 'Desconectado');
                this.updateUI();
                this.showToast('Dispositivo não está conectado', 'error');
                this.showLoading(false);
                return;
            }
            
            const response = await fetch(`${this.apiBaseUrl}/api/read_registers`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ start_address: startAddress, count })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Erro na requisição');
            }
            
            const data = await response.json();
            
            if (data.success) {
                // Usar requestAnimationFrame para sincronizar com o ciclo de renderização
                window.requestAnimationFrame(() => {
                    this.displayResult('read', startAddress, data.registers);
                    this.updateLiveData(data.registers, startAddress);
                    this.updateLastReadTime();
                    this.updateRegistersCount(data.registers.length);
                });
            } else {
                this.showToast(`Falha na leitura: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Erro na leitura:', error);
            this.showToast(`Erro ao ler registradores: ${error.message}`, 'error');
        } finally {
            // Esconder loading apenas se não for leitura automática
            if (!isAutoRead) {
                this.showLoading(false);
            }
        }
    }

    async writeRegister() {
        if (!this.isConnected) {
            this.showToast('Conecte-se primeiro ao dispositivo', 'warning');
            return;
        }
        
        const address = parseInt(document.getElementById('writeAddress').value);
        const value = parseInt(document.getElementById('writeValue').value);
        
        if (isNaN(address) || isNaN(value)) {
            this.showToast('Endereço e valor devem ser números', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/write_register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address, value })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.displayResult('write', address, [value]);
                this.showToast(`Valor ${value} escrito no endereço ${address}`, 'success');
            } else {
                this.showToast(`Falha na escrita: ${data.error}`, 'error');
            }
        } catch (error) {
            console.error('Erro na escrita:', error);
            this.showToast('Erro ao escrever no registrador', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async toggleCoil(coilAddress) {
        if (!this.isConnected) {
            this.showToast('Conecte-se primeiro ao dispositivo', 'warning');
            return;
        }
        
        const currentState = this.coilStates[coilAddress] || false;
        const newState = !currentState;
        
        this.showLoading(true);
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/write_coil`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ address: coilAddress, value: newState ? 1 : 0 })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                this.coilStates[coilAddress] = newState;
                this.updateCoilUI(coilAddress, newState);
                this.showToast(`Coil ${coilAddress} ${newState ? 'ativado' : 'desativado'}`, 'success');
                this.updateActiveCoilsCount();
            } else {
                this.showToast(`Falha ao alterar coil: ${data.message}`, 'error');
            }
        } catch (error) {
            console.error('Erro ao alterar coil:', error);
            this.showToast('Erro ao alterar estado do coil', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async readCoils(isAutoRead = false) {
        if (!this.isConnected) {
            this.showToast('Conecte-se primeiro ao dispositivo', 'warning');
            return;
        }
        
        // Mostrar loading apenas se não for leitura automática
        if (!isAutoRead) {
            this.showLoading(true);
        }
        
        try {
            // Obter todos os endereços de coils disponíveis
            const coilAddresses = Object.keys(this.coilStates).map(Number);
            
            if (coilAddresses.length === 0) {
                // Se não houver coils adicionados, usar o padrão (0-7)
                const response = await fetch(`${this.apiBaseUrl}/api/read_coils`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ start_address: 0, count: 8 })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Atualizar estados dos coils
                    data.coils.forEach((state, index) => {
                        // Converter explicitamente para booleano comparando com 1
                        const isActive = state === 1;
                        this.coilStates[index] = isActive;
                        this.updateCoilUI(index, isActive);
                    });
                } else {
                    this.showToast(`Falha na leitura dos coils: ${data.message}`, 'error');
                }
            } else {
                // Agrupar coils em intervalos contíguos para minimizar requisições
                const sortedAddresses = [...coilAddresses].sort((a, b) => a - b);
                const minAddress = sortedAddresses[0];
                const maxAddress = sortedAddresses[sortedAddresses.length - 1];
                
                // Ler todos os coils em um único intervalo
                const response = await fetch(`${this.apiBaseUrl}/api/read_coils`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        start_address: minAddress, 
                        count: maxAddress - minAddress + 1 
                    })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Atualizar estados dos coils
                    data.coils.forEach((state, index) => {
                        const coilAddress = minAddress + index;
                        // Converter explicitamente para booleano comparando com 1
                        const isActive = state === 1;
                        this.coilStates[coilAddress] = isActive;
                        this.updateCoilUI(coilAddress, isActive);
                    });
                } else {
                    this.showToast(`Falha na leitura dos coils: ${data.message}`, 'error');
                }
            }
            
            this.updateActiveCoilsCount();
        } catch (error) {
            console.error('Erro na leitura dos coils:', error);
            this.showToast('Erro ao ler estados dos coils', 'error');
        } finally {
            // Esconder loading apenas se não for leitura automática
            if (!isAutoRead) {
                this.showLoading(false);
            }
        }
    }

    async loadCustomCoils() {
        if (!this.isConnected) {
            this.showToast('Conecte-se primeiro ao dispositivo', 'warning');
            return;
        }
        
        const startAddress = parseInt(document.getElementById('coilStartAddress').value);
        const count = parseInt(document.getElementById('coilCount').value);
        
        if (isNaN(startAddress) || isNaN(count)) {
            this.showToast('Endereço inicial e quantidade devem ser números', 'error');
            return;
        }
        
        if (count < 1) {
            this.showToast('Quantidade deve ser pelo menos 1', 'error');
            return;
        }
        
        this.showLoading(true);
        
        try {
            // Limpar estados anteriores dos coils e o grid
            this.coilStates = {};
            const coilsGridLarge = document.getElementById('coilsGridLarge');
            if (coilsGridLarge) {
                coilsGridLarge.innerHTML = '';
            }
            
            // Calcular quantos cards precisamos criar
            const numCards = Math.ceil(count / 16);
            
            // Para cada card (grupo de até 16 coils)
            for (let cardIndex = 0; cardIndex < numCards; cardIndex++) {
                const cardStartAddress = startAddress + (cardIndex * 16);
                const cardCoilCount = Math.min(16, count - (cardIndex * 16));
                
                if (cardCoilCount <= 0) break;
                
                // Criar um card para este grupo de coils
                const cardElement = document.createElement('div');
                cardElement.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 sm:p-6 mb-6 w-full';
                
                // Adicionar cabeçalho do card
                const cardHeader = document.createElement('div');
                cardHeader.className = 'flex justify-between items-center mb-4';
                cardHeader.innerHTML = `
                    <h3 class="text-lg font-semibold text-blue-600 dark:text-blue-400">Endereço ${cardStartAddress} - ${cardStartAddress + cardCoilCount - 1}</h3>
                `;
                cardElement.appendChild(cardHeader);
                
                // Criar grid para os coils deste card
                const cardGrid = document.createElement('div');
                cardGrid.className = 'grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4';
                cardGrid.setAttribute('data-card-start', cardStartAddress);
                cardElement.appendChild(cardGrid);
                
                // Adicionar o card ao container principal
                coilsGridLarge.appendChild(cardElement);
                
                // Buscar os estados dos coils para este card
                const response = await fetch(`${this.apiBaseUrl}/api/read_coils`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ start_address: cardStartAddress, count: cardCoilCount })
                });
                
                const data = await response.json();
                
                if (data.status === 'success') {
                    // Criar os elementos de coil para este card
                    for (let i = 0; i < cardCoilCount; i++) {
                        const coilAddress = cardStartAddress + i;
                        const isActive = data.coils[i] === 1;
                        this.coilStates[coilAddress] = isActive;
                        
                        // Criar elemento do coil
                        const coilItem = document.createElement('div');
                        coilItem.className = 'flex items-center p-3 sm:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-all cursor-pointer border border-gray-200 dark:border-gray-700';
                        coilItem.setAttribute('data-coil', coilAddress);
                        
                        const coilIcon = document.createElement('div');
                        coilIcon.className = 'w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-2 sm:mr-3';
                        
                        const icon = document.createElement('i');
                        icon.className = 'fas fa-power-off text-lg sm:text-xl text-gray-500 dark:text-gray-400';
                        coilIcon.appendChild(icon);
                        
                        const coilInfo = document.createElement('div');
                        coilInfo.className = 'flex-1 min-w-0';
                        
                        const coilAddressEl = document.createElement('div');
                        coilAddressEl.className = 'text-sm sm:text-base font-medium text-gray-700 dark:text-gray-300 truncate';
                        coilAddressEl.textContent = `Coil ${coilAddress}`;
                        
                        const coilStatus = document.createElement('div');
                        coilStatus.className = 'text-xs sm:text-sm text-gray-500 dark:text-gray-400';
                        coilStatus.textContent = 'Desativado';
                        
                        coilInfo.appendChild(coilAddressEl);
                        coilInfo.appendChild(coilStatus);
                        
                        coilItem.appendChild(coilIcon);
                        coilItem.appendChild(coilInfo);
                        
                        coilItem.addEventListener('click', () => this.toggleCoil(coilAddress));
                        
                        cardGrid.appendChild(coilItem);
                        
                        // Atualizar UI do coil com base no estado
                        this.updateCoilUI(coilAddress, isActive);
                    }
                } else {
                    this.showToast(`Falha na leitura dos coils: ${data.message}`, 'error');
                }
            }
            
            this.updateActiveCoilsCount();
            this.showToast(`Coils carregados a partir do endereço ${startAddress}`, 'success');
            this.updateLastReadTime();
        } catch (error) {
            console.error('Erro na leitura dos coils:', error);
            this.showToast('Erro ao ler estados dos coils', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    initCoils(startAddress = 0, count = 8) {
        // Inicializar grid de coils no dashboard
        const coilsGrid = document.getElementById('coilsGrid');
        if (coilsGrid) {
            coilsGrid.innerHTML = '';
            
            // Verificar se existem coils armazenados
            const coilAddresses = Object.keys(this.coilStates).map(Number);
            
            if (coilAddresses.length === 0) {
                // Se não houver coils armazenados, usar os padrões
                for (let i = startAddress; i < startAddress + count; i++) {
                    this.createDashboardCoilItem(coilsGrid, i);
                }
            } else {
                // Ordenar os endereços para exibição
                const sortedAddresses = [...coilAddresses].sort((a, b) => a - b);
                
                // Criar um item para cada coil armazenado
                sortedAddresses.forEach(address => {
                    this.createDashboardCoilItem(coilsGrid, address);
                });
            }
        }
        
        // Inicializar grid de coils na seção de coils
        const coilsGridLarge = document.getElementById('coilsGridLarge');
        if (coilsGridLarge) {
            coilsGridLarge.innerHTML = '';
            
            // Verificar se existem coils armazenados
            const coilAddresses = Object.keys(this.coilStates).map(Number);
            
            if (coilAddresses.length === 0) {
                // Se não houver coils armazenados, usar os padrões
                for (let i = startAddress; i < startAddress + count; i++) {
                    this.createCoilItemForCoilsPage(coilsGridLarge, i);
                }
            } else {
                // Ordenar os endereços para exibição
                const sortedAddresses = [...coilAddresses].sort((a, b) => a - b);
                
                // Criar um item para cada coil armazenado
                sortedAddresses.forEach(address => {
                    this.createCoilItemForCoilsPage(coilsGridLarge, address);
                });
            }
        }
        
        // Atualizar UI dos coils com base nos estados armazenados
        Object.entries(this.coilStates).forEach(([address, state]) => {
            this.updateCoilUI(parseInt(address), state);
        });
    }
    
    // Função auxiliar para criar um item de coil no dashboard
    createDashboardCoilItem(container, address) {
        const coilItem = document.createElement('div');
        coilItem.className = 'flex flex-col items-center p-2 cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg';
        coilItem.setAttribute('data-coil', address);
        
        const coilToggle = document.createElement('div');
        coilToggle.className = 'w-8 h-4 rounded-full bg-gray-300 dark:bg-gray-600 relative transition-colors duration-200 mb-1';
        
        const coilLabel = document.createElement('div');
        coilLabel.className = 'text-xs text-gray-600 dark:text-gray-400';
        coilLabel.textContent = `Coil ${address}`;
        
        coilItem.appendChild(coilToggle);
        coilItem.appendChild(coilLabel);
        
        coilItem.addEventListener('click', () => this.toggleCoil(address));
        
        container.appendChild(coilItem);
        return coilItem;
    }
    
    // Função auxiliar para criar um item de coil na página de coils
    createCoilItemForCoilsPage(container, address) {
        const coilItem = document.createElement('div');
        coilItem.className = 'flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer';
        coilItem.setAttribute('data-coil', address);
        
        const coilIcon = document.createElement('div');
        coilIcon.className = 'w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center mr-3';
        
        const icon = document.createElement('i');
        icon.className = 'fas fa-power-off text-gray-500 dark:text-gray-400';
        coilIcon.appendChild(icon);
        
        const coilInfo = document.createElement('div');
        coilInfo.className = 'flex-1';
        
        const coilAddress = document.createElement('div');
        coilAddress.className = 'text-sm font-medium text-gray-700 dark:text-gray-300';
        coilAddress.textContent = `Endereço ${address}`;
        
        const coilStatus = document.createElement('div');
        coilStatus.className = 'text-xs text-gray-500 dark:text-gray-400';
        coilStatus.textContent = 'Desativado';
        
        coilInfo.appendChild(coilAddress);
        coilInfo.appendChild(coilStatus);
        
        coilItem.appendChild(coilIcon);
        coilItem.appendChild(coilInfo);
        
        coilItem.addEventListener('click', () => this.toggleCoil(address));
        
        container.appendChild(coilItem);
        return coilItem;
    }

    updateCoilUI(address, state) {
        // Atualizar UI dos coils no dashboard
        const coilItems = document.querySelectorAll(`[data-coil="${address}"]`);
        coilItems.forEach(item => {
            const toggle = item.querySelector('div:first-child');
            if (state) {
                toggle.classList.remove('bg-gray-300', 'dark:bg-gray-600');
                toggle.classList.add('bg-green-500', 'dark:bg-green-600');
            } else {
                toggle.classList.remove('bg-green-500', 'dark:bg-green-600');
                toggle.classList.add('bg-gray-300', 'dark:bg-gray-600');
            }
        });
        
        // Atualizar UI dos coils na seção de coils
        const coilItemsLarge = document.querySelectorAll(`.flex.items-center[data-coil="${address}"]`);
        coilItemsLarge.forEach(item => {
            const iconElement = item.querySelector('.fas.fa-power-off');
            // Verificar se o elemento existe antes de acessar parentNode
            if (iconElement) {
                const icon = iconElement.parentNode;
                const status = item.querySelector('div > div:last-child');
                const coilAddressEl = item.querySelector('div > div:first-child');
                
                if (state) {
                    // Atualizar o item inteiro
                    item.classList.add('border-green-500', 'dark:border-green-400');
                    item.classList.remove('border-gray-200', 'dark:border-gray-700');
                    
                    // Atualizar o ícone
                    icon.classList.remove('bg-gray-200', 'dark:bg-gray-700');
                    icon.classList.add('bg-green-100', 'dark:bg-green-800');
                    
                    // Atualizar o ícone de energia
                    iconElement.classList.remove('text-gray-500', 'dark:text-gray-400');
                    iconElement.classList.add('text-green-600', 'dark:text-green-400');
                    
                    // Atualizar o texto do endereço
                    coilAddressEl.classList.add('text-green-700', 'dark:text-green-300');
                    coilAddressEl.classList.remove('text-gray-700', 'dark:text-gray-300');
                    
                    // Atualizar o status
                    status.textContent = 'Ativado';
                    status.classList.remove('text-gray-500', 'dark:text-gray-400');
                    status.classList.add('text-green-600', 'dark:text-green-400', 'font-medium');
                } else {
                    // Atualizar o item inteiro
                    item.classList.remove('border-green-500', 'dark:border-green-400');
                    item.classList.add('border-gray-200', 'dark:border-gray-700');
                    
                    // Atualizar o ícone
                    icon.classList.add('bg-gray-200', 'dark:bg-gray-700');
                    icon.classList.remove('bg-green-100', 'dark:bg-green-800');
                    
                    // Atualizar o ícone de energia
                    iconElement.classList.add('text-gray-500', 'dark:text-gray-400');
                    iconElement.classList.remove('text-green-600', 'dark:text-green-400');
                    
                    // Atualizar o texto do endereço
                    coilAddressEl.classList.remove('text-green-700', 'dark:text-green-300');
                    coilAddressEl.classList.add('text-gray-700', 'dark:text-gray-300');
                    
                    // Atualizar o status
                    status.textContent = 'Desativado';
                    status.classList.add('text-gray-500', 'dark:text-gray-400');
                    status.classList.remove('text-green-600', 'dark:text-green-400', 'font-medium');
                }
            }
        });
    }

    updateActiveCoilsCount() {
        const activeCount = Object.values(this.coilStates).filter(state => state).length;
        const totalCount = Object.keys(this.coilStates).length || 8;
        document.getElementById('activeCoils').textContent = `${activeCount} de ${totalCount}`;
    }

    displayResult(type, address, values) {
        const resultsContainer = document.getElementById('resultsContainer');
        const noResults = document.querySelector('.no-results');
        
        if (noResults) {
            noResults.remove();
        }
        
        const resultItem = document.createElement('div');
        resultItem.className = 'bg-white dark:bg-gray-800 rounded-lg shadow-md mb-3 overflow-hidden';
        
        const resultHeader = document.createElement('div');
        resultHeader.className = 'flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600';
        
        const resultType = document.createElement('div');
        const typeClass = type === 'read' ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400';
        resultType.className = `font-medium ${typeClass} flex items-center`;
        resultType.innerHTML = type === 'read' ? 
            '<i class="fas fa-download mr-2"></i> Leitura' : 
            '<i class="fas fa-upload mr-2"></i> Escrita';
        
        const resultTime = document.createElement('div');
        resultTime.className = 'text-xs text-gray-500 dark:text-gray-400';
        resultTime.textContent = new Date().toLocaleTimeString();
        
        resultHeader.appendChild(resultType);
        resultHeader.appendChild(resultTime);
        
        const resultData = document.createElement('div');
        resultData.className = 'p-3 font-mono text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300';
        
        if (type === 'read') {
            let dataText = `Endereço inicial: ${address}\n`;
            dataText += 'Valores:\n';
            
            values.forEach((value, index) => {
                dataText += `[${address + index}]: ${value}\n`;
            });
            
            resultData.textContent = dataText;
        } else {
            resultData.textContent = `Endereço: ${address}\nValor: ${values[0]}`;
        }
        
        resultItem.appendChild(resultHeader);
        resultItem.appendChild(resultData);
        
        resultsContainer.insertBefore(resultItem, resultsContainer.firstChild);
    }

    updateLiveData(registers, startAddress) {
        const liveDataContainer = document.getElementById('liveDataContainer');
        
        // Verifica se já existe uma tabela de dados
        let dataTable = liveDataContainer.querySelector('table');
        
        // Se não existir tabela, cria uma nova
        if (!dataTable) {
            dataTable = document.createElement('table');
            dataTable.className = 'w-full text-sm text-left text-gray-700 dark:text-gray-300';
            
            const thead = document.createElement('thead');
            thead.className = 'text-xs uppercase bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300';
            
            const headerRow = document.createElement('tr');
            
            const thAddress = document.createElement('th');
            thAddress.className = 'px-4 py-2';
            thAddress.textContent = 'Endereço';
            
            const thValue = document.createElement('th');
            thValue.className = 'px-4 py-2';
            thValue.textContent = 'Valor';
            
            const thHex = document.createElement('th');
            thHex.className = 'px-4 py-2';
            thHex.textContent = 'Hex';
            
            headerRow.appendChild(thAddress);
            headerRow.appendChild(thValue);
            headerRow.appendChild(thHex);
            thead.appendChild(headerRow);
            dataTable.appendChild(thead);
            
            // Cria o tbody
            const tbody = document.createElement('tbody');
            tbody.className = 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700';
            dataTable.appendChild(tbody);
            
            // Limpa o container e adiciona a nova tabela
            liveDataContainer.innerHTML = '';
            liveDataContainer.appendChild(dataTable);
        }
        
        // Obtém ou cria o tbody
        let tbody = dataTable.querySelector('tbody');
        if (!tbody) {
            tbody = document.createElement('tbody');
            tbody.className = 'bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700';
            dataTable.appendChild(tbody);
        }
        
        // Preparar um fragmento de documento para acumular mudanças
        const fragment = document.createDocumentFragment();
        const existingRows = Array.from(tbody.children);
        const newRows = [];
        
        // Atualiza as linhas existentes e adiciona novas se necessário
        for (let i = 0; i < registers.length; i++) {
            const value = registers[i];
            const address = startAddress + i;
            const hexValue = '0x' + value.toString(16).toUpperCase().padStart(4, '0');
            
            let row;
            
            if (i < existingRows.length) {
                // Atualiza linha existente sem recriá-la
                row = existingRows[i];
                
                // Atualiza apenas se os valores mudaram
                if (row.dataset.address != address) {
                    row.children[0].textContent = address;
                    row.dataset.address = address;
                }
                
                if (row.dataset.value != value) {
                    row.children[1].textContent = value;
                    row.dataset.value = value;
                    
                    // Adiciona classe para destacar mudança
                    row.children[1].classList.add('bg-yellow-100', 'dark:bg-yellow-900', 'transition-colors');
                    
                    // Remove a classe após a animação
                    setTimeout(() => {
                        row.children[1].classList.remove('bg-yellow-100', 'dark:bg-yellow-900', 'transition-colors');
                    }, 500);
                }
                
                if (row.dataset.hex != hexValue) {
                    row.children[2].textContent = hexValue;
                    row.dataset.hex = hexValue;
                }
            } else {
                // Cria nova linha se necessário
                row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 dark:hover:bg-gray-700';
                row.dataset.address = address;
                row.dataset.value = value;
                row.dataset.hex = hexValue;
                
                const tdAddress = document.createElement('td');
                tdAddress.className = 'px-4 py-2 border-b border-gray-200 dark:border-gray-700';
                tdAddress.textContent = address;
                
                const tdValue = document.createElement('td');
                tdValue.className = 'px-4 py-2 border-b border-gray-200 dark:border-gray-700';
                tdValue.textContent = value;
                
                const tdHex = document.createElement('td');
                tdHex.className = 'px-4 py-2 border-b border-gray-200 dark:border-gray-700 font-mono';
                tdHex.textContent = hexValue;
                
                row.appendChild(tdAddress);
                row.appendChild(tdValue);
                row.appendChild(tdHex);
                
                newRows.push(row);
            }
        }
        
        // Adiciona novas linhas ao fragmento
        newRows.forEach(row => fragment.appendChild(row));
        
        // Adiciona o fragmento ao tbody apenas uma vez
        if (newRows.length > 0) {
            tbody.appendChild(fragment);
        }
        
        // Remove linhas extras se necessário
        while (tbody.children.length > registers.length) {
            tbody.removeChild(tbody.lastChild);
        }
    }

    updateUI() {
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const readBtn = document.getElementById('readBtn');
        const writeBtn = document.getElementById('writeBtn');
        const autoReadToggle = document.getElementById('autoReadToggle');
        const quickReadBtn = document.getElementById('quickReadBtn');
        const autoReadToggleBtn = document.getElementById('autoReadToggleBtn');
        const emergencyStopBtn = document.getElementById('emergencyStopBtn');
        const loadCoilsBtn = document.getElementById('loadCoilsBtn');
        
        if (this.isConnected) {
            connectBtn.disabled = true;
            disconnectBtn.disabled = false;
            readBtn.disabled = false;
            writeBtn.disabled = false;
            autoReadToggle.disabled = false;
            quickReadBtn.disabled = false;
            autoReadToggleBtn.disabled = false;
            emergencyStopBtn.disabled = false;
            loadCoilsBtn.disabled = false;
        } else {
            connectBtn.disabled = false;
            disconnectBtn.disabled = true;
            readBtn.disabled = true;
            writeBtn.disabled = true;
            autoReadToggle.disabled = true;
            autoReadToggle.checked = false;
            quickReadBtn.disabled = true;
            autoReadToggleBtn.disabled = true;
            emergencyStopBtn.disabled = true;
            loadCoilsBtn.disabled = true;
        }
        
        this.updateAutoReadStatus();
    }

    updateConnectionStatus(status, text) {
        const connectionStatus = document.getElementById('connectionStatus');
        const connectionStatusText = document.getElementById('connectionStatusText');
        
        // Remover todas as classes de cor anteriores
        connectionStatus.querySelectorAll('i').forEach(icon => {
            icon.classList.remove('text-red-500', 'text-yellow-500', 'text-green-500');
        });
        
        // Adicionar classes Tailwind com base no status
        let iconClass = '';
        if (status === 'connected') {
            iconClass = 'text-green-500';
        } else if (status === 'connecting') {
            iconClass = 'text-yellow-500';
        } else {
            iconClass = 'text-red-500';
        }
        
        connectionStatus.innerHTML = `
            <i class="fas fa-circle ${iconClass}"></i>
            <span>${text}</span>
        `;
        
        if (connectionStatusText) {
            connectionStatusText.textContent = text;
        }
    }

    updateLastReadTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString();
        document.getElementById('lastReadTime').textContent = timeString;
    }

    updateRegistersCount(count) {
        document.getElementById('registersCount').textContent = `${count} lidos`;
    }

    toggleAutoRead(enabled) {
        if (enabled && this.isConnected) {
            this.startAutoRead();
        } else {
            this.stopAutoRead();
        }
    }

    startAutoRead() {
        if (this.autoReadInterval) {
            clearInterval(this.autoReadInterval);
        }
        
        this.autoReadEnabled = true;
        this.autoReadInterval = setInterval(() => this.performAutoRead(), this.autoReadIntervalMs);
        this.updateAutoReadStatus();
        this.showToast('Leitura automática iniciada', 'success');
    }

    stopAutoRead() {
        if (this.autoReadInterval) {
            clearInterval(this.autoReadInterval);
            this.autoReadInterval = null;
        }
        
        this.autoReadEnabled = false;
        this.updateAutoReadStatus();
    }

    performAutoRead() {
        if (this.isConnected) {
            const startAddress = parseInt(document.getElementById('readStartAddress').value);
            const count = parseInt(document.getElementById('readCount').value);
            
            if (!isNaN(startAddress) && !isNaN(count)) {
                // Usar requestAnimationFrame para sincronizar com o ciclo de renderização
                window.requestAnimationFrame(() => {
                    // Passar true para indicar que é uma leitura automática
                    this.readRegisters(true);
                });
            }
        } else {
            this.stopAutoRead();
            document.getElementById('autoReadToggle').checked = false;
        }
    }

    updateAutoReadInterval(seconds) {
        if (seconds < 1) seconds = 1;
        this.autoReadIntervalMs = seconds * 1000;
        
        if (this.autoReadEnabled) {
            this.stopAutoRead();
            this.startAutoRead();
        }
    }

    updateAutoReadStatus() {
        const autoReadStatus = document.getElementById('autoReadStatus');
        
        if (autoReadStatus) {
            autoReadStatus.className = 'flex items-center space-x-2 text-sm';
            
            if (this.autoReadEnabled) {
                autoReadStatus.innerHTML = `
                    <i class="fas fa-sync-alt fa-spin text-green-500"></i>
                    <span>Ativo (${this.autoReadIntervalMs / 1000}s)</span>
                `;
            } else {
                autoReadStatus.innerHTML = `
                    <i class="fas fa-sync-alt text-red-500"></i>
                    <span>Inativo</span>
                `;
            }
        }
    }

    clearResults() {
        const resultsContainer = document.getElementById('resultsContainer');
        resultsContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <i class="fas fa-info-circle text-2xl mb-2"></i>
                <p>Nenhum resultado para exibir</p>
            </div>
        `;
    }

    clearLogs() {
        // Limpar resultados
        this.clearResults();
        
        // Limpar logs
        const logsContent = document.getElementById('logsContent');
        if (logsContent) {
            logsContent.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-gray-400">
                    <i class="fas fa-info-circle text-2xl mb-2"></i>
                    <p>Nenhum log disponível</p>
                </div>
            `;
        }
    }

    showToast(message, type = 'info') {
        const toastContainer = document.querySelector('.fixed.top-4.right-4') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = 'flex items-center p-4 mb-3 rounded-lg shadow-lg transition-opacity duration-300';
        
        // Definir cores com base no tipo
        if (type === 'success') {
            toast.classList.add('bg-green-500', 'text-white');
        } else if (type === 'error') {
            toast.classList.add('bg-red-500', 'text-white');
        } else if (type === 'warning') {
            toast.classList.add('bg-yellow-500', 'text-white');
        } else {
            toast.classList.add('bg-blue-500', 'text-white');
        }
        
        let icon = 'info-circle';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'exclamation-circle';
        if (type === 'warning') icon = 'exclamation-triangle';
        
        toast.innerHTML = `
            <i class="fas fa-${icon} mr-2"></i>
            <span>${message}</span>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('opacity-0');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'fixed top-4 right-4 z-50 flex flex-col items-end';
        document.body.appendChild(container);
        return container;
    }

    showLoading(show) {
        const loadingOverlay = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50.z-50.flex.items-center.justify-center') || this.createLoadingOverlay();
        if (show) {
            loadingOverlay.classList.remove('hidden');
        } else {
            loadingOverlay.classList.add('hidden');
        }
    }
    
    createLoadingOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
        
        const spinner = document.createElement('div');
        spinner.className = 'bg-white p-5 rounded-lg shadow-lg flex items-center';
        spinner.innerHTML = `
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mr-3"></div>
            <span class="text-gray-700">Carregando...</span>
        `;
        
        overlay.appendChild(spinner);
        document.body.appendChild(overlay);
        return overlay;
    }

    isValidIP(ip) {
        const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return regex.test(ip);
    }

    openSettingsModal() {
        const modal = document.getElementById('settingsModal');
        modal.classList.remove('hidden');
    }

    closeModal() {
        const modals = document.querySelectorAll('#settingsModal');
        modals.forEach(modal => modal.classList.add('hidden'));
    }

    emergencyStop() {
        if (!this.isConnected) {
            this.showToast('Não há conexão ativa para realizar parada de emergência', 'error');
            return;
        }

        // Desativar todos os coils
        fetch('/api/emergency_stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ip: this.ip,
                port: this.port
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showToast('Parada de emergência executada com sucesso', 'success');
                
                // Parar auto-read se estiver ativo
                if (this.autoReadEnabled) {
                    this.toggleAutoRead(false);
                }
                
                // Atualizar interface
                const emergencyBtn = document.getElementById('emergencyStopBtn');
                emergencyBtn.classList.add('bg-red-700');
                emergencyBtn.classList.add('animate-pulse');
                
                setTimeout(() => {
                    emergencyBtn.classList.remove('bg-red-700');
                    emergencyBtn.classList.remove('animate-pulse');
                }, 2000);
            } else {
                this.showToast(`Erro na parada de emergência: ${data.error}`, 'error');
            }
        })
        .catch(error => {
            this.showToast(`Erro na parada de emergência: ${error.message}`, 'error');
        });
    }

    refreshData() {
        if (this.isConnected) {
            this.checkConnectionStatus();
            // Atualizar o dashboard com todas as coils disponíveis
            this.initCoils();
            // Ler os estados atuais de todas as coils
            this.readCoils();
            this.readRegisters();
        } else {
            this.checkConnectionStatus();
        }
    }

    // Adicionar função para leitura automática das coils
    startAutoReadCoils() {
        if (this.autoReadCoilsInterval) {
            clearInterval(this.autoReadCoilsInterval);
        }
        
        // Ler coils a cada 2 segundos
        this.autoReadCoilsInterval = setInterval(() => {
            if (this.isConnected) {
                // Passar true para indicar que é uma leitura automática
                this.readCoils(true);
                
                // Atualizar o dashboard para mostrar todas as coils disponíveis
                if (Object.keys(this.coilStates).length > 8) {
                    this.initCoils();
                }
            }
        }, 2000);
        
        console.log('Leitura automática de coils iniciada');
    }
    
    stopAutoReadCoils() {
        if (this.autoReadCoilsInterval) {
            clearInterval(this.autoReadCoilsInterval);
            this.autoReadCoilsInterval = null;
            console.log('Leitura automática de coils interrompida');
        }
    }
}

// Initialize the ModbusManager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.modbusManager = new ModbusManager();
});