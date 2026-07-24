/**
 * Operation Centre Dashboard - Main Application
 * Handles WebSocket connection, event updates, and UI interactions
 */

class DashboardApp {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;

    this.currentTab = 'overview';
    this.events = [];
    this.maxEvents = 1000;
    this.agents = new Map();
    this.tasks = new Map();

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.connectWebSocket();
    this.loadInitialData();
    this.startRefreshTimer();
  }

  /**
   * Setup UI event listeners
   */
  setupEventListeners() {
    // Tab navigation
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });

    // Event filter
    const eventFilter = document.getElementById('eventFilter');
    if (eventFilter) {
      eventFilter.addEventListener('input', (e) => this.filterEvents(e.target.value));
    }

    // Clear events button
    const clearBtn = document.getElementById('clearEvents');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearEvents());
    }

    // Modal close
    const modal = document.getElementById('authModal');
    if (modal) {
      document.querySelector('.close').addEventListener('click', () => {
        modal.style.display = 'none';
      });
    }
  }

  /**
   * Connect to WebSocket server
   */
  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws/events`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus(true);
        this.reconnectAttempts = 0;

        // Request initial state snapshot
        this.ws.send(JSON.stringify({
          type: 'get_state_snapshot'
        }));

        // Subscribe to all events
        this.ws.send(JSON.stringify({
          type: 'subscribe',
          filters: {}
        }));
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus(false);
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus(false);
      };
    } catch (error) {
      console.error('Error connecting WebSocket:', error);
      this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      setTimeout(() => this.connectWebSocket(), this.reconnectDelay);
    }
  }

  /**
   * Handle WebSocket messages
   */
  handleWebSocketMessage(message) {
    switch (message.type) {
      case 'connected':
        console.log('Connected to Operation Centre:', message.client_id);
        break;

      case 'event':
        this.handleEvent(message.data);
        break;

      case 'recent_events':
        this.addRecentEvents(message.data);
        break;

      case 'state_snapshot':
        this.handleStateSnapshot(message.data);
        break;

      case 'pong':
        // Keep-alive response
        break;

      case 'error':
        console.error('Server error:', message.error);
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }

  /**
   * Handle incoming event
   */
  handleEvent(event) {
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) {
      this.events.pop();
    }

    // Update UI based on event type
    if (event.type.startsWith('agent.')) {
      this.updateAgentState(event);
    } else if (event.type.startsWith('task.')) {
      this.updateTaskState(event);
    } else if (event.type.startsWith('authorization.')) {
      this.updateAuthorizationPanel();
    }

    // Update event display if on events tab
    if (this.currentTab === 'overview') {
      this.updateRecentEventsList();
    } else if (this.currentTab === 'events') {
      this.updateEventLog();
    }
  }

  /**
   * Handle state snapshot
   */
  handleStateSnapshot(snapshot) {
    if (snapshot.agents) {
      snapshot.agents.forEach(agent => {
        this.agents.set(agent.agent_code, agent);
      });
    }

    if (snapshot.tasks) {
      snapshot.tasks.forEach(task => {
        this.tasks.set(task.task_id, task);
      });
    }

    this.updateDashboard();
  }

  /**
   * Update agent state from event
   */
  updateAgentState(event) {
    if (event.agent_code) {
      const agent = this.agents.get(event.agent_code) || {};
      agent.agent_code = event.agent_code;
      agent.status = event.status;
      agent.current_task = event.details?.task_id;
      agent.current_action = event.details?.action;
      agent.last_event = event.type;
      agent.last_event_time = event.timestamp;
      this.agents.set(event.agent_code, agent);
    }
  }

  /**
   * Update task state from event
   */
  updateTaskState(event) {
    if (event.task_id) {
      const task = this.tasks.get(event.task_id) || {};
      task.task_id = event.task_id;
      task.status = event.status;
      task.last_event = event.type;
      task.last_event_time = event.timestamp;
      this.tasks.set(event.task_id, task);
    }
  }

  /**
   * Add recent events to the list
   */
  addRecentEvents(events) {
    Array.isArray(events) && events.forEach(event => {
      if (!this.events.find(e => e.id === event.id)) {
        this.events.push(event);
      }
    });
  }

  /**
   * Load initial dashboard data
   */
  async loadInitialData() {
    try {
      const response = await fetch('/api/dashboard');
      const data = await response.json();

      document.getElementById('connectedClients').textContent = data.connected_clients;
      document.getElementById('activeObjectives').textContent = data.objectives.length;
      document.getElementById('queuedTasks').textContent = data.tasks.length;

      this.renderAgents(data.agents);
      this.updateAuthorizationPanel(data.authorizations);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  /**
   * Render agents grid
   */
  renderAgents(agents) {
    const grid = document.getElementById('agentsGrid');
    if (!grid) return;

    grid.innerHTML = agents.map(agent => `
      <div class="agent-card ${agent.status}">
        <div class="code">${agent.code}</div>
        <div class="name">${agent.name}</div>
        <div class="status">${agent.status}</div>
      </div>
    `).join('');

    // Also update the table
    const tbody = document.getElementById('agentsTableBody');
    if (tbody) {
      tbody.innerHTML = agents.map(agent => `
        <tr>
          <td>${agent.code}</td>
          <td>${agent.name}</td>
          <td>${agent.role || 'N/A'}</td>
          <td><span class="badge badge-${agent.status === 'idle' ? 'info' : agent.status === 'working' ? 'success' : 'danger'}">${agent.status}</span></td>
          <td>${agent.current_task ? agent.current_task.substring(0, 8) : '-'}</td>
          <td>${agent.last_event || '-'}</td>
          <td>${agent.enabled ? '✓' : '✗'}</td>
        </tr>
      `).join('');
    }
  }

  /**
   * Update authorization panel
   */
  updateAuthorizationPanel(authorizations = []) {
    const container = document.getElementById('authorizationsContainer');
    if (!container) return;

    if (authorizations.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary);">No pending authorizations</p>';
      return;
    }

    container.innerHTML = authorizations.map(auth => `
      <div class="auth-request ${auth.risk_level}-risk">
        <div class="auth-action">${auth.action}</div>
        <div class="auth-reason"><strong>Reason:</strong> ${auth.reason}</div>
        <div><strong>Risk Level:</strong> <span class="badge badge-${auth.risk_level === 'high' ? 'danger' : auth.risk_level === 'medium' ? 'warning' : 'success'}">${auth.risk_level}</span></div>
        <div class="auth-buttons">
          <button class="btn-primary" onclick="app.approveAuthorization('${auth.id}')">Approve</button>
          <button class="btn-danger" onclick="app.denyAuthorization('${auth.id}')">Deny</button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Update recent events list
   */
  updateRecentEventsList() {
    const list = document.getElementById('recentEventsList');
    if (!list) return;

    const recentEvents = this.events.slice(0, 10);
    list.innerHTML = recentEvents.map(event => `
      <div class="event-item">
        <div class="event-timestamp">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-type">${event.type}</div>
        <div class="event-details">${event.agent || ''} ${event.action || ''}</div>
      </div>
    `).join('');
  }

  /**
   * Update event log (full event feed)
   */
  updateEventLog() {
    const log = document.getElementById('eventLog');
    if (!log) return;

    log.innerHTML = this.events.map(event => `
      <div class="event-item">
        <div class="event-timestamp">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-type">${event.type}</div>
        <div class="event-details">
          ${event.agent ? `<strong>Agent:</strong> ${event.agent} ` : ''}
          ${event.action ? `<strong>Action:</strong> ${event.action}` : ''}
        </div>
      </div>
    `).join('');
  }

  /**
   * Filter events
   */
  filterEvents(filter) {
    if (!filter) {
      this.updateEventLog();
      return;
    }

    const log = document.getElementById('eventLog');
    if (!log) return;

    const filtered = this.events.filter(event =>
      event.type.toLowerCase().includes(filter.toLowerCase()) ||
      (event.agent && event.agent.toLowerCase().includes(filter.toLowerCase())) ||
      (event.action && event.action.toLowerCase().includes(filter.toLowerCase()))
    );

    log.innerHTML = filtered.map(event => `
      <div class="event-item">
        <div class="event-timestamp">${new Date(event.timestamp).toLocaleTimeString()}</div>
        <div class="event-type">${event.type}</div>
        <div class="event-details">
          ${event.agent ? `<strong>Agent:</strong> ${event.agent} ` : ''}
          ${event.action ? `<strong>Action:</strong> ${event.action}` : ''}
        </div>
      </div>
    `).join('');
  }

  /**
   * Clear events
   */
  clearEvents() {
    this.events = [];
    this.updateEventLog();
  }

  /**
   * Update connection status indicator
   */
  updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (!status) return;

    const indicator = status.querySelector('.status-indicator');
    const text = status.querySelector('.status-text');

    if (connected) {
      indicator.classList.remove('disconnected', 'warning');
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected');
      indicator.classList.add('disconnected');
      text.textContent = 'Disconnected';
    }
  }

  /**
   * Switch tab
   */
  switchTab(tabName) {
    this.currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === tabName) {
        btn.classList.add('active');
      }
    });

    // Update tab content
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });
    document.getElementById(tabName)?.classList.add('active');

    // Refresh content if needed
    if (tabName === 'overview') {
      this.updateRecentEventsList();
    } else if (tabName === 'events') {
      this.updateEventLog();
    }
  }

  /**
   * Approve authorization
   */
  async approveAuthorization(requestId) {
    try {
      const response = await fetch(`/api/dashboard/authorizations/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approver_id: 'system' })
      });

      if (response.ok) {
        console.log(`Authorization ${requestId} approved`);
        this.updateAuthorizationPanel();
      }
    } catch (error) {
      console.error('Error approving authorization:', error);
    }
  }

  /**
   * Deny authorization
   */
  async denyAuthorization(requestId) {
    const reason = prompt('Reason for denial:');
    if (!reason) return;

    try {
      const response = await fetch(`/api/dashboard/authorizations/${requestId}/deny`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          denier_id: 'system',
          reason: reason
        })
      });

      if (response.ok) {
        console.log(`Authorization ${requestId} denied`);
        this.updateAuthorizationPanel();
      }
    } catch (error) {
      console.error('Error denying authorization:', error);
    }
  }

  /**
   * Update dashboard
   */
  updateDashboard() {
    this.loadInitialData();
  }

  /**
   * Start periodic refresh timer
   */
  startRefreshTimer() {
    setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Send keep-alive ping
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }

      // Refresh dashboard data
      this.loadInitialData();
    }, 5000); // Every 5 seconds
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new DashboardApp();
});
