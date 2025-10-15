// Externalized JavaScript from index.html for cleaner structure

// === VARIABLES ===
let users = JSON.parse(localStorage.getItem('users') || '{}');
function importCsvFile() {
  if (!currentUser) {
    showToast('Please login first');
    return;
  }
  const fileInput = document.getElementById('csvFile');
  const skipFirstRow = document.getElementById('skipFirstRow').checked;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const csvContent = csvImportState.content || e.target.result;
      const delimiter = csvImportState.content ? csvImportState.delimiter : detectCsvDelimiter(csvContent);
      let rows = (csvImportState.content ? csvImportState.rows : parseCsvText(csvContent, delimiter))
        .filter(r => r.some(cell => (cell || '').trim().length > 0));
      if (rows.length === 0) {
        showToast('No data found in CSV');
        return;
      }
      const headerKeywords = ['password', 'user', 'username', 'url', 'website', 'name', 'title'];
      const firstRowJoined = (rows[0].join(' ') || '').toLowerCase();
      const detectedHasHeader = headerKeywords.some(k => firstRowJoined.includes(k));
      const hasHeader = skipFirstRow || detectedHasHeader;
      // Build column index map, prefer manual mapping if provided
      let colMap = { url: -1, username: -1, password: -1, note: -1, name: -1, category: -1 };
      const mapIds = ['mapUrl','mapUsername','mapPassword','mapNote','mapName','mapCategory'];
      const mapKeys = ['url','username','password','note','name','category'];
      const mappingAvailable = mapIds.every(id => document.getElementById(id));
      if (mappingAvailable && document.getElementById('csvMapping').style.display !== 'none') {
        // Read selected indices (empty string means Auto; -1 means None)
        mapIds.forEach((id, idx) => {
          const val = document.getElementById(id).value;
          const num = val === '' ? NaN : parseInt(val, 10);
          colMap[mapKeys[idx]] = isNaN(num) ? -2 : num; // -2 = AUTO
        });
      }
      if (Object.values(colMap).every(v => v === -1 || v === -2)) {
        // No manual mapping; fall back to auto-detection if headers exist
        if (hasHeader) {
          const headers = rows[0].map(h => (h || '').toLowerCase().trim());
          function findIndex(names) {
            for (const n of names) { const idx = headers.indexOf(n); if (idx !== -1) return idx; }
            return -1;
          }
          colMap = {
            url: findIndex(['url','website','web address','address','site','domain']),
            username: findIndex(['username','user','login','email address','email']),
            password: findIndex(['password','passcode']),
            note: findIndex(['note','notes','comment','comments']),
            name: findIndex(['name','title','label','site','website']),
            category: findIndex(['category','group','folder'])
          };
        } else {
          // No headers; default positions url, username, password, note, name, category
          colMap = { url: 0, username: 1, password: 2, note: 3, name: 4, category: 5 };
        }
      } else if (Object.values(colMap).some(v => v === -2)) {
        // Some are Auto: resolve autos via header detection
        let auto = { url: -1, username: -1, password: -1, note: -1, name: -1, category: -1 };
        if (hasHeader) {
          const headers = rows[0].map(h => (h || '').toLowerCase().trim());
          function findIndex(names) { for (const n of names) { const idx = headers.indexOf(n); if (idx !== -1) return idx; } return -1; }
          auto = {
            url: findIndex(['url','website','web address','address','site','domain']),
            username: findIndex(['username','user','login','email address','email']),
            password: findIndex(['password','passcode']),
            note: findIndex(['note','notes','comment','comments']),
            name: findIndex(['name','title','label','site','website']),
            category: findIndex(['category','group','folder'])
          };
        }
        for (const k of Object.keys(colMap)) { if (colMap[k] === -2) colMap[k] = auto[k]; }
      }
      let startIndex = hasHeader ? 1 : 0;
      let importedCount = 0;
      let skippedCount = 0;
      let errorRows = [];
      for (let i = startIndex; i < rows.length; i++) {
        try {
          const r = rows[i];
          function val(idx) { return (idx !== -1 && idx < r.length) ? (r[idx] || '').trim() : ''; }
          const url = val(colMap.url);
          const username = val(colMap.username);
          const password = val(colMap.password);
          const note = val(colMap.note);
          const name = val(colMap.name) || url;
          const category = val(colMap.category) || 'Imported';
          // Robust: skip if all fields empty or password missing
          if ((!url && !name) || !password) { skippedCount++; errorRows.push(i+1); continue; }
          const entry = {
            site: name || url || 'Imported Entry',
            user: username,
            email: note,
            category: category,
            password: password,
            expiration: 90,
            createdAt: new Date().toISOString(),
            added: new Date().toISOString()
          };
          passwords.push(entry);
          importedCount++;
        } catch (lineError) {
          errorRows.push(i+1);
          skippedCount++;
        }
      }
      if (importedCount > 0) {
        saveVault();
        renderVault();
        updatePasswordHealthDashboard();
        closeModal('importCsvModal');
        logAudit(`Imported ${importedCount} passwords from CSV`);
        let msg = `Imported ${importedCount} item(s)`;
        if (skippedCount) msg += `, skipped ${skippedCount}`;
        if (errorRows.length) msg += `. Problem rows: ${errorRows.join(', ')}`;
        showToast(msg);
      } else {
        // Surface detected headers to help user diagnose
        if (hasHeader) {
          console.warn('CSV headers detected:', rows[0]);
        }
        let msg = 'No valid passwords found in CSV.';
        if (errorRows.length) msg += ` Problem rows: ${errorRows.join(', ')}`;
        showToast(msg);
      }
      // Clear file input
      fileInput.value = '';
    } catch (error) {
      showToast('Error parsing CSV file: ' + (error.message || 'Unknown error'));
    }
  };
  reader.onerror = function() {
    showToast('Error reading file');
  };
  reader.readAsText(fileInput.files[0]);
}

// === PASSWORD GENERATOR ===
function openGeneratePasswordModal() {
  document.getElementById('generatePasswordModal').classList.add('active');
}

function generatePassword() {
  const length = parseInt(document.getElementById('passwordLength').value);
  const useUppercase = document.getElementById('useUppercase').checked;
  const useLowercase = document.getElementById('useLowercase').checked;
  const useNumbers = document.getElementById('useNumbers').checked;
  const useSpecial = document.getElementById('useSpecial').checked;

  if (!useUppercase && !useLowercase && !useNumbers && !useSpecial) {
    showToast('Select at least one character type');
    return;
  }

  if (length < 8 || length > 50 || isNaN(length)) {
    showToast('Password length must be between 8 and 50');
    return;
  }

  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  let chars = '';
  if (useUppercase) chars += uppercase;
  if (useLowercase) chars += lowercase;
  if (useNumbers) chars += numbers;
  if (useSpecial) chars += special;

  let password = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    password += chars[randomIndex];
  }

  document.getElementById('passwordAdd').value = password;
  updateStrengthAdd();
  closeModal('generatePasswordModal');
  showToast('Password generated');
}

// === PASSWORD STRENGTH ===
function strengthScore(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p)) s++;
  if (/[0-9]/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return s;
}

function strengthColor(s) {
  return ['#ef4444', '#f59e0b', '#facc15', '#10b981', '#3b82f6'][s];
}

function updateStrengthAdd() {
  let pwd = document.getElementById('passwordAdd').value;
  let s = strengthScore(pwd);
  let bar = document.getElementById('strengthBarAdd');
  bar.style.width = (s / 4 * 100) + '%';
  bar.style.background = strengthColor(s);
}

function updateStrengthEdit() {
  let pwd = document.getElementById('passwordEdit').value;
  let s = strengthScore(pwd);
  let bar = document.getElementById('strengthBarEdit');
  bar.style.width = (s / 4 * 100) + '%';
  bar.style.background = strengthColor(s);
}

// === PASSWORD HEALTH DASHBOARD ===
let passwordChart = null; // Store chart instance

function updatePasswordHealthDashboard() {
  const canvas = document.getElementById('passwordChart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  let strong = 0, medium = 0, weak = 0;
  const reused = new Set();
  const duplicates = new Set();

  passwords.forEach(p => {
    const score = strengthScore(p.password);
    if (score >= 3) strong++;
    else if (score === 2) medium++;
    else weak++;
    if (reused.has(p.password)) duplicates.add(p.password);
    else reused.add(p.password);
  });

  // Destroy existing chart before creating new one
  if (passwordChart) {
    passwordChart.destroy();
  }

  // Create new chart
  passwordChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Strong', 'Medium', 'Weak'],
      datasets: [{
        label: 'Password Strength',
        data: [strong, medium, weak],
        backgroundColor: ['#10b981', '#facc15', '#ef4444'],
        borderColor: ['#fff', '#fff', '#fff'],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: { 
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: 12,
          titleFont: { size: 14 },
          bodyFont: { size: 13 }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb',
            stepSize: 1,
            font: { size: 12 }
          },
          title: {
            display: true,
            text: 'Number of Passwords',
            color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb',
            font: { size: 13 }
          },
          grid: {
            color: document.body.classList.contains('light') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
          }
        },
        x: {
          ticks: { 
            color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb',
            font: { size: 12 }
          },
          grid: {
            color: document.body.classList.contains('light') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'
          }
        }
      }
    }
  });

  const weakCount = weak;
  const reusedCount = duplicates.size;
  const expiredCount = passwords.filter(p => isPasswordExpired(p)).length;
  showToast(`Password Health: ${weakCount} weak, ${reusedCount} reused, ${expiredCount} expired`, 3000);
}

// === PASSWORD EXPIRY ===
function isPasswordExpired(p) {
  if (!p.expiration || !p.createdAt) return false;
  const created = new Date(p.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return diffDays >= parseInt(p.expiration);
}

function checkPasswordExpirations() {
  passwords.forEach(p => {
    if (!p.createdAt) p.createdAt = new Date().toISOString();
    const daysLeft = getDaysLeft(p);
    if (daysLeft <= 7 && daysLeft > 0) {
      showToast(`Password for ${p.site} expires in ${daysLeft} days`);
    } else if (isPasswordExpired(p)) {
      showToast(`Password for ${p.site} has expired`);
    }
  });
}

function getDaysLeft(p) {
  if (!p.expiration || !p.createdAt) return Infinity;
  const created = new Date(p.createdAt);
  const now = new Date();
  const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
  return parseInt(p.expiration) - diffDays;
}

// Get favicon URL for a website
function getFaviconUrl(site) {
  // Remove "WiFi: " prefix if present
  if (site.startsWith('WiFi: ')) {
    return '📶'; // Return WiFi emoji for WiFi entries
  }
  
  try {
    // Extract domain from site name
    let domain = site.toLowerCase().trim();
    
    // Remove common protocols
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '');
    
    // Remove paths and query strings
    domain = domain.split('/')[0].split('?')[0];
    
    // If it's not a valid domain format, return default
    if (!domain || !domain.includes('.')) {
      return '🌐'; // Default globe emoji
    }
    
    // Use Google's favicon service (works for most sites)
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch (e) {
    return '🌐'; // Fallback to globe emoji
  }
}

// === VAULT ===
function saveVault() {
  if (currentUser) {
    users[currentUser].passwords = encryptData(passwords, users[currentUser].masterPassword);
    localStorage.setItem('users', JSON.stringify(users));
  }
}

function loadVault() {
  if (currentUser && users[currentUser].passwords) {
    const decrypted = decryptData(users[currentUser].passwords, users[currentUser].masterPassword);
    passwords = decrypted || [];
  } else {
    passwords = [];
  }
}

function renderVault(filteredPasswords = passwords) {
  const vault = document.getElementById('vault');
  
  // Preserve search bar if it exists, otherwise create it
  let searchContainer = document.getElementById('searchContainer');
  const searchValue = searchContainer ? document.getElementById('searchBar').value : '';
  
  if (!searchContainer) {
    const container = document.createElement('div');
    container.id = 'searchContainer';
    container.className = 'search-container';
    container.innerHTML = `
      <input type="text" id="searchBar" placeholder="Search by site, username, or category" aria-label="Search">
      <button id="clearSearch" class="clear-search-btn" onclick="clearSearch()" aria-label="Clear search" style="display:none;">✕</button>
    `;
    vault.insertBefore(container, vault.firstChild);
    
    const searchBar = document.getElementById('searchBar');
    searchBar.addEventListener('input', () => {
      filterVault();
      document.getElementById('clearSearch').style.display = searchBar.value ? 'flex' : 'none';
    });
  }
  
  // Remove all vault cards but keep the search bar
  const cards = vault.querySelectorAll('.vault-card');
  cards.forEach(card => card.remove());
  
  filteredPasswords.forEach((p, i) => {
    let card = document.createElement('div');
    card.className = `vault-card ${isPasswordExpired(p) ? 'expired' : getDaysLeft(p) <= 7 ? 'expiring-soon' : ''}`;
    card.draggable = true;
    card.ondragstart = e => { e.dataTransfer.setData('text/plain', i); };
    card.ondragover = e => { e.preventDefault(); };
    card.ondrop = e => {
      const from = parseInt(e.dataTransfer.getData('text/plain'));
      const to = i;
      if (from !== to) {
        let tmp = passwords[from];
        passwords.splice(from, 1);
        passwords.splice(to, 0, tmp);
        saveVault();
        renderVault();
        logAudit(`Reordered password for ${tmp.site}`);
      }
    };
    const faviconUrl = getFaviconUrl(p.site);
    const isEmoji = faviconUrl.length <= 2; // Check if it's an emoji (WiFi or globe)
    const faviconHtml = isEmoji 
      ? `<span class="site-icon">${faviconUrl}</span>` 
      : `<img class="site-icon" src="${faviconUrl}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';" /><span class="site-icon-fallback" style="display:none;">🌐</span>`;
    
    card.innerHTML = `
      <div class="vault-item"><b>Site:</b> ${faviconHtml}<span>${p.site}</span></div>
      <div class="vault-item"><b>Username:</b> <span>${p.user}</span></div>
      <div class="vault-item"><b>Email:</b> <span>${p.email || ''}</span></div>
      <div class="vault-item"><b>Password:</b>
        <div class="password-field">
          <input type="password" value="${p.password}" readonly>
          <button class="show-pass-btn" onclick="togglePassword(this)">👁️</button>
        </div>
      </div>
      <div class="vault-item"><b>Category:</b> <span>${p.category || ''}</span></div>
      <div class="vault-item"><b>Expire:</b> <span>${p.expiration || 90} days</span></div>
      <div class="vault-item actions">
        <span class="drag-handle">☰</span>
        <button onclick="copyPassword('${p.password}')" class="btn-copy" aria-label="Copy Password">📋</button>
        <button onclick="editPassword(${i})" class="btn-edit" aria-label="Edit Password">✏️</button>
        <button onclick="confirmDeletePassword(${i})" class="btn-delete" aria-label="Delete Password">🗑️</button>
        <button onclick="autofillPassword('${p.site}', '${p.user}', '${p.password}')" class="autofill-btn" aria-label="Autofill Password">↗️</button>
        <button onclick="sharePassword(${i})" class="share-btn" aria-label="Share Password">🔗</button>
      </div>
    `;
    vault.appendChild(card);
    setTimeout(() => { card.classList.add('show'); }, 50 * i);
  });
  checkPasswordExpirations();
}

// === SEARCH AND FILTER ===
function filterVault() {
  const query = document.getElementById('searchBar').value.toLowerCase();
  const filtered = passwords.filter(p =>
    p.site.toLowerCase().includes(query) ||
    p.user.toLowerCase().includes(query) ||
    (p.category && p.category.toLowerCase().includes(query))
  );
  renderVault(filtered);
}

function clearSearch() {
  const searchBar = document.getElementById('searchBar');
  searchBar.value = '';
  document.getElementById('clearSearch').style.display = 'none';
  renderVault(passwords);
  searchBar.focus();
}

// === PASSWORD ACTIONS ===
function togglePassword(btn) {
  let inp = btn.previousElementSibling;
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function copyPassword(pwd) {
  navigator.clipboard.writeText(pwd);
  showToast('Copied');
  logAudit('Copied password');
}

function editPassword(i) {
  editIndex = i;
  const p = passwords[i];
  document.getElementById('siteEdit').value = p.site;
  document.getElementById('usernameEdit').value = p.user;
  document.getElementById('emailEdit').value = p.email;
  document.getElementById('categoryEdit').value = p.category;
  document.getElementById('passwordEdit').value = p.password;
  document.getElementById('expirationEdit').value = p.expiration;
  document.getElementById('editModal').classList.add('active');
}

function savePasswordEdit() {
  if (editIndex === null) return;
  const site = document.getElementById('siteEdit').value.trim();
  const user = document.getElementById('usernameEdit').value.trim();
  const password = document.getElementById('passwordEdit').value;
  if (!site || !user || !password) {
    showToast('Site, Username, and Password required');
    return;
  }
  const expiration = document.getElementById('expirationEdit').value;
  if (expiration && (isNaN(expiration) || expiration < 1)) {
    showToast('Expiration days must be a positive number');
    return;
  }
  passwords[editIndex] = {
    site,
    user,
    email: document.getElementById('emailEdit').value,
    category: document.getElementById('categoryEdit').value,
    password,
    expiration,
    createdAt: passwords[editIndex].createdAt
  };
  saveVault();
  renderVault();
  logAudit(`Edited password for ${passwords[editIndex].site}`);
  closeModal('editModal');
  showToast('Password saved');
}

function savePasswordAdd() {
  const site = document.getElementById('siteAdd').value.trim();
  const user = document.getElementById('usernameAdd').value.trim();
  const email = document.getElementById('emailAdd').value.trim();
  const cat = document.getElementById('categoryAdd').value;
  const pw = document.getElementById('passwordAdd').value;
  const exp = document.getElementById('expirationAdd').value;
  if (!site || !user || !pw) {
    showToast('Site, Username, Password required');
    return;
  }
  if (exp && (isNaN(exp) || exp < 1)) {
    showToast('Expiration days must be a positive number');
    return;
  }
  passwords.push({ site, user, email, category: cat, password: pw, expiration: exp, createdAt: new Date().toISOString() });
  saveVault();
  renderVault();
  logAudit(`Added password for ${site}`);
  showToast('Saved');
  document.querySelectorAll('#add input').forEach(i => i.value = '');
  document.getElementById('categoryAdd').value = '';
  document.getElementById('expirationAdd').value = 90;
}

// === WIFI PASSWORD TAB ===
function switchAddTab(type) {
  const regularTab = document.getElementById('addRegular');
  const wifiTab = document.getElementById('addWifi');
  const buttons = document.querySelectorAll('.add-tab-btn');
  
  buttons.forEach(btn => btn.classList.remove('active'));
  
  if (type === 'regular') {
    regularTab.classList.add('active');
    wifiTab.classList.remove('active');
    buttons[0].classList.add('active');
  } else {
    regularTab.classList.remove('active');
    wifiTab.classList.add('active');
    buttons[1].classList.add('active');
  }
}

function updateStrengthWifi() {
  const pwd = document.getElementById('wifiPassword').value;
  const bar = document.getElementById('strengthBarWifi');
  const score = strengthScore(pwd);
  bar.style.width = (score * 25) + '%';
  bar.style.background = strengthColor(score);
}

function saveWifiPassword() {
  if (!currentUser) {
    showToast('Please login first');
    return;
  }
  
  const ssid = document.getElementById('wifiSsid').value.trim();
  const security = document.getElementById('wifiSecurity').value;
  const password = document.getElementById('wifiPassword').value;
  const notes = document.getElementById('wifiNotes').value.trim();
  
  if (!ssid || !password) {
    showToast('Please fill in WiFi name and password');
    return;
  }
  
  const wifiEntry = {
    site: `WiFi: ${ssid}`,
    user: security,
    email: notes,
    category: 'WiFi',
    password: password,
    expiration: null,
    createdAt: new Date().toISOString(),
    type: 'wifi'
  };
  
  passwords.push(wifiEntry);
  saveVault();
  renderVault();
  
  // Clear form
  document.getElementById('wifiSsid').value = '';
  document.getElementById('wifiPassword').value = '';
  document.getElementById('wifiNotes').value = '';
  document.getElementById('wifiSecurity').value = 'WPA2';
  document.getElementById('strengthBarWifi').style.width = '0%';
  
  showToast('WiFi password added!');
  logAudit(`Added WiFi: ${ssid}`);
  
  // Update dashboard if active
  if (document.getElementById('dashboard').classList.contains('active')) {
    updatePasswordHealthDashboard();
  }
}

// === DELETE CONFIRMATIONS ===
function confirmDeletePassword(i) {
  deleteCallback = () => {
    const site = passwords[i].site;
    passwords.splice(i, 1);
    saveVault();
    renderVault();
    logAudit(`Deleted password for ${site}`);
    showToast('Deleted');
    closeDeletePrompt();
  };
  showDeletePrompt(`Delete password for "${passwords[i].site}"?`);
}

function confirmDeleteAllPasswords() {
  if (passwords.length === 0) {
    showToast('No passwords to delete');
    return;
  }
  deleteCallback = () => {
    passwords = [];
    saveVault();
    renderVault();
    logAudit('Deleted all passwords');
    showToast('All deleted');
    closeDeletePrompt();
  };
  showDeletePrompt('Delete ALL passwords?');
}

function showDeletePrompt(text) {
  document.getElementById('deletePromptText').textContent = text;
  document.getElementById('deletePrompt').classList.add('active');
}

function closeDeletePrompt() {
  document.getElementById('deletePrompt').classList.remove('active');
  deleteCallback = null;
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (deleteCallback) deleteCallback();
});

// === ACCOUNT MANAGEMENT ===
function updateUserSelect() {
  const loginDropdown = document.getElementById('loginUsernameDropdown');
  const deleteSelect = document.getElementById('accountDeleteSelect');
  const hiddenInput = document.getElementById('loginUsername');
  
  loginDropdown.innerHTML = '';
  deleteSelect.innerHTML = '<option value="" disabled selected>Select Account</option>';
  
  const lastUser = localStorage.getItem('lastUser');
  
  Object.keys(users).forEach(username => {
    // Create custom dropdown option with avatar
    const option = document.createElement('div');
    option.className = 'custom-select-option';
    option.onclick = () => selectUser(username);
    
    const avatar = document.createElement('img');
    avatar.className = 'user-avatar';
    avatar.src = users[username].profilePicture || 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
    avatar.alt = username;
    avatar.onerror = () => { avatar.src = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp'; };
    
    const name = document.createElement('span');
    name.className = 'user-name';
    name.textContent = username;
    
    option.appendChild(avatar);
    option.appendChild(name);
    loginDropdown.appendChild(option);
    
    // Set default selection
    if (username === lastUser) {
      selectUser(username, false);
    }
    
    // Delete select (keep as regular select)
    const deleteOption = document.createElement('option');
    deleteOption.value = username;
    deleteOption.textContent = username;
    deleteSelect.appendChild(deleteOption);
  });
  
  document.getElementById('mfaCode').style.display = users[lastUser]?.mfaEnabled ? 'block' : 'none';
}

function toggleUserDropdown() {
  const dropdown = document.getElementById('loginUsernameDropdown');
  const select = document.getElementById('loginUsernameSelect');
  dropdown.classList.toggle('open');
  select.classList.toggle('open');
}

function selectUser(username, closeDropdown = true) {
  const hiddenInput = document.getElementById('loginUsername');
  const display = document.getElementById('selectedUserDisplay');
  
  hiddenInput.value = username;
  
  // Update display
  const avatar = document.createElement('img');
  avatar.className = 'user-avatar';
  avatar.src = users[username].profilePicture || 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
  avatar.alt = username;
  avatar.onerror = () => { avatar.src = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp'; };
  
  const name = document.createElement('span');
  name.textContent = username;
  
  display.innerHTML = '';
  display.appendChild(avatar);
  display.appendChild(name);
  
  // Update MFA field visibility
  document.getElementById('mfaCode').style.display = users[username]?.mfaEnabled ? 'block' : 'none';
  
  if (closeDropdown) {
    toggleUserDropdown();
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('loginUsernameDropdown');
  const select = document.getElementById('loginUsernameSelect');
  if (dropdown && select && !select.contains(e.target) && !dropdown.contains(e.target)) {
    dropdown.classList.remove('open');
    select.classList.remove('open');
  }
});

function createAccountModal() {
  console.log('createAccountModal called');
  const loginModal = document.getElementById('loginModal');
  const createModal = document.getElementById('createAccountModal');
  const openBtn = document.getElementById('openLoginBtn');
  
  console.log('Login modal before:', loginModal.classList.contains('active'));
  console.log('Create modal before:', createModal.classList.contains('active'));
  
  loginModal.classList.remove('active');
  createModal.classList.add('active');
  openBtn.style.display = 'none';
  
  console.log('Login modal after:', loginModal.classList.contains('active'));
  console.log('Create modal after:', createModal.classList.contains('active'));
}

function backToLogin() {
  console.log('backToLogin called');
  const createModal = document.getElementById('createAccountModal');
  const loginModal = document.getElementById('loginModal');
  const openBtn = document.getElementById('openLoginBtn');
  
  console.log('Create modal before:', createModal.classList.contains('active'));
  console.log('Login modal before:', loginModal.classList.contains('active'));
  
  // Clear create account form
  document.getElementById('createUsername').value = '';
  document.getElementById('createPassword').value = '';
  document.getElementById('confirmPassword').value = '';
  document.getElementById('profilePicture').value = '';
  
  // Hide error messages
  document.querySelectorAll('#createAccountModal .error-message').forEach(err => err.style.display = 'none');
  
  // Switch modals
  createModal.classList.remove('active');
  loginModal.classList.add('active');
  openBtn.style.display = 'none';
  updateUserSelect();
  
  console.log('Create modal after:', createModal.classList.contains('active'));
  console.log('Login modal after:', loginModal.classList.contains('active'));
}

function createAccount() {
  const username = document.getElementById('createUsername').value.trim();
  const pw = document.getElementById('createPassword').value;
  const cpw = document.getElementById('confirmPassword').value;
  const fileInput = document.getElementById('profilePicture');

  const usernameError = document.getElementById('usernameError');
  const passwordError = document.getElementById('passwordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');

  usernameError.style.display = username.length < 3 ? 'block' : 'none';
  passwordError.style.display = pw.length < 8 ? 'block' : 'none';
  confirmPasswordError.style.display = pw !== cpw ? 'block' : 'none';

  if (username.length < 3 || pw.length < 8 || pw !== cpw) {
    return;
  }
  if (users[username]) {
    showToast('Username already exists');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const profilePic = fileInput.files[0] ? e.target.result : defaultProfilePic;
    users[username] = { masterPassword: pw, passwords: encryptData([], pw), profilePicture: profilePic, mfaEnabled: false };
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('lastUser', username);
    currentUser = username;
    passwords = [];
    document.getElementById('profileImage').src = profilePic;
  const topbarImg = document.getElementById('topbarProfileImage');
  if (topbarImg) topbarImg.src = profilePic;
    document.getElementById('sidebarUsername').textContent = currentUser;
    closeModal('createAccountModal');
    document.querySelector('.sidebar').style.display = 'flex';
    document.querySelector('.main').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    updateUserSelect();
    updateCategorySelect();
    logAudit(`Created account ${username}`);
    showToast('Account created');
    renderVault();
    initParticles();
    if (isAndroid()) enableAndroidLayout('vault');
  };
  if (fileInput.files[0]) {
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    reader.onload({ target: { result: defaultProfilePic } });
  }
}

function toggleLoginPassword() {
  const inp = document.getElementById('loginPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function toggleCreatePassword() {
  const inp = document.getElementById('createPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

function toggleConfirmPassword() {
  const inp = document.getElementById('confirmPassword');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

async function checkLogin() {
  const username = document.getElementById('loginUsername').value;
  const pw = document.getElementById('loginPassword').value;
  const mfaCode = document.getElementById('mfaCode').value;
  const loginBtn = document.getElementById('loginBtn');
  loginBtn.disabled = true;
  loginBtn.classList.add('loading');
  if (!username || !pw) {
    showToast('Username and password required');
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    return;
  }
  await new Promise(resolve => setTimeout(resolve, 500));
  if (!users[username]) {
    showToast('Username not found');
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    return;
  }
  if (users[username].masterPassword === pw) {
    if (users[username].mfaEnabled) {
      if (!mfaCode) {
        showToast('Please enter MFA code');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        return;
      }
      const verified = otplib.authenticator.verify({
        secret: mfaSecrets[username],
        token: mfaCode
      });
      if (!verified) {
        showToast('Invalid MFA code');
        loginBtn.disabled = false;
        loginBtn.classList.remove('loading');
        return;
      }
    }
    localStorage.setItem('lastUser', username);
    currentUser = username;
    loadVault();
    document.getElementById('profileImage').src = users[currentUser].profilePicture || defaultProfilePic;
  const topbarImg = document.getElementById('topbarProfileImage');
  if (topbarImg) topbarImg.src = users[currentUser].profilePicture || defaultProfilePic;
    document.getElementById('sidebarUsername').textContent = currentUser;
    closeModal('loginModal');
    document.querySelector('.sidebar').style.display = 'flex';
    document.querySelector('.main').style.display = 'block';
    document.getElementById('currentUser').textContent = currentUser;
    document.getElementById('openLoginBtn').style.display = 'none';
    logAudit(`Logged in as ${username}`);
    showToast('Login successful');
    renderVault();
    initParticles();
    if (isAndroid()) enableAndroidLayout('vault');
  } else {
    showToast('Invalid password');
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
  }
}

function switchAccount(btn) {
  if (btn) btn.classList.remove('active');
  currentUser = null;
  passwords = [];
  document.querySelector('.sidebar').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('loginModal').classList.add('active');
  document.getElementById('openLoginBtn').style.display = 'none';
  const tb = document.getElementById('topbar');
  const bn = document.getElementById('bottomNav');
  if (tb) tb.style.display = 'none';
  if (bn) bn.style.display = 'none';
  updateUserSelect();
  logAudit('Switched account');
  showToast('Switched account');
}

function logout(btn) {
  if (btn) btn.classList.remove('active');
  currentUser = null;
  passwords = [];
  document.querySelector('.sidebar').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('loginModal').classList.add('active');
  document.getElementById('openLoginBtn').style.display = 'none';
  const tb = document.getElementById('topbar');
  const bn = document.getElementById('bottomNav');
  if (tb) tb.style.display = 'none';
  if (bn) bn.style.display = 'none';
  updateUserSelect();
  logAudit('Logged out');
  showToast('Logged out');
}

function confirmDeleteAccount() {
  const username = document.getElementById('accountDeleteSelect').value;
  if (!username) {
    showToast('Please select an account');
    return;
  }
  deleteAccountUsername = username;
  document.getElementById('deleteAccountName').textContent = `Delete account "${username}"?`;
  document.getElementById('deleteAccountModal').classList.add('active');
}

function confirmDeleteSelectedAccount() {
  const pw = document.getElementById('deleteAccountPassword').value;
  if (!pw) {
    showToast('Please enter the master password');
    return;
  }
  if (users[deleteAccountUsername].masterPassword === pw) {
    delete users[deleteAccountUsername];
    delete mfaSecrets[deleteAccountUsername];
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('mfaSecrets', JSON.stringify(mfaSecrets));
    if (deleteAccountUsername === currentUser) {
      currentUser = null;
      passwords = [];
      document.getElementById('profileImage').src = defaultProfilePic;
      document.getElementById('sidebarUsername').textContent = 'User';
      document.querySelector('.sidebar').style.display = 'none';
      document.querySelector('.main').style.display = 'none';
      document.getElementById('loginModal').classList.add('active');
      document.getElementById('openLoginBtn').style.display = 'none';
      localStorage.removeItem('lastUser');
    }
    updateUserSelect();
    logAudit(`Deleted account ${deleteAccountUsername}`);
    showToast('Account deleted');
    closeModal('deleteAccountModal');
  } else {
    showToast('Invalid password');
  }
}

function confirmDeleteAllAccountsModal() {
  if (Object.keys(users).length === 0) {
    showToast('No accounts to delete');
    return;
  }
  document.getElementById('deleteAllAccountsModal').classList.add('active');
}

function confirmDeleteAllAccounts() {
  const pw = document.getElementById('deleteAllAccountsPassword').value;
  if (!currentUser) {
    showToast('No user logged in');
    return;
  }
  if (!pw) {
    showToast('Please enter the master password');
    return;
  }
  if (users[currentUser].masterPassword === pw) {
    users = {};
    localStorage.setItem('users', JSON.stringify(users));
    localStorage.setItem('mfaSecrets', JSON.stringify({}));
    localStorage.removeItem('lastUser');
    currentUser = null;
    passwords = [];
    document.getElementById('profileImage').src = defaultProfilePic;
    document.getElementById('sidebarUsername').textContent = 'User';
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.main').style.display = 'none';
    closeModal('deleteAllAccountsModal');
    document.getElementById('createAccountModal').classList.add('active');
    document.getElementById('openLoginBtn').style.display = 'none';
    updateUserSelect();
    logAudit('Deleted all accounts');
    showToast('All accounts deleted');
  } else {
    showToast('Invalid password');
  }
}

function changeProfilePictureModal() {
  document.getElementById('profilePictureModal').classList.add('active');
}

function changeProfilePicture() {
  const fileInput = document.getElementById('newProfilePicture');
  const reader = new FileReader();
  reader.onload = function(e) {
    if (currentUser) {
      users[currentUser].profilePicture = e.target.result;
      localStorage.setItem('users', JSON.stringify(users));
      document.getElementById('profileImage').src = e.target.result;
  const topbarImg = document.getElementById('topbarProfileImage');
  if (topbarImg) topbarImg.src = e.target.result;
      closeModal('profilePictureModal');
      logAudit('Changed profile picture');
      showToast('Profile picture updated');
    }
  };
  if (fileInput.files[0]) {
    reader.readAsDataURL(fileInput.files[0]);
  } else {
    showToast('No file selected');
  }
}

function resetMasterPasswordModal() {
  document.getElementById('resetModal').classList.add('active');
}

function resetMasterPassword() {
  const pw = document.getElementById('newMasterPassword').value;
  const cpw = document.getElementById('confirmNewMasterPassword').value;
  const passwordError = document.getElementById('newPasswordError');
  const confirmPasswordError = document.getElementById('confirmNewPasswordError');

  passwordError.style.display = pw.length < 8 ? 'block' : 'none';
  confirmPasswordError.style.display = pw !== cpw ? 'block' : 'none';

  if (pw.length < 8 || pw !== cpw) {
    return;
  }
  if (currentUser) {
    const decryptedPasswords = decryptData(users[currentUser].passwords, users[currentUser].masterPassword);
    users[currentUser].masterPassword = pw;
    users[currentUser].passwords = encryptData(decryptedPasswords || [], pw);
    localStorage.setItem('users', JSON.stringify(users));
    closeModal('resetModal');
    logAudit('Reset master password');
    showToast('Master password reset');
  }
}

// === MFA ===
function setupMfa() {
  if (!currentUser) {
    showToast('No user logged in');
    return;
  }
  const secret = otplib.authenticator.generateSecret();
  mfaSecrets[currentUser] = secret;
  localStorage.setItem('mfaSecrets', JSON.stringify(mfaSecrets));
  const qrCode = document.getElementById('mfaQrCode');
  qrCode.innerHTML = '';
  const otpauth = otplib.authenticator.keyuri(currentUser, 'Anima', secret);
  new QRCode(qrCode, { text: otpauth, width: 200, height: 200 });
  document.getElementById('mfaSecret').value = secret;
  document.getElementById('mfaModal').classList.add('active');
}

function copyMfaSecret() {
  const secret = document.getElementById('mfaSecret').value;
  navigator.clipboard.writeText(secret);
  showToast('MFA secret copied');
}

function enableMfa() {
  if (currentUser) {
    users[currentUser].mfaEnabled = true;
    localStorage.setItem('users', JSON.stringify(users));
    closeModal('mfaModal');
    logAudit('Enabled MFA');
    showToast('MFA enabled');
    updateUserSelect();
  }
}

// === BACKUP AND RESTORE ===
function openBackupModal() { document.getElementById('backupModal').classList.add('active'); }
function openRestoreModal() { document.getElementById('restoreModal').classList.add('active'); }

function backupVault() {
  const pw = document.getElementById('backupPassword').value;
  if (!currentUser || !pw) { showToast('Master password required'); return; }
  if (pw !== users[currentUser].masterPassword) { showToast('Invalid master password'); return; }
  const encrypted = encryptData(passwords, pw);
  const blob = new Blob([encrypted], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `anima_backup_${currentUser}.json`;
  a.click();
  URL.revokeObjectURL(url);
  closeModal('backupModal');
  logAudit('Backed up vault');
  showToast('Backup created');
}

function restoreVault() {
  const fileInput = document.getElementById('restoreFile');
  const pw = document.getElementById('restorePassword').value;
  if (!currentUser || !pw) { showToast('Master password required'); return; }
  if (pw !== users[currentUser].masterPassword) { showToast('Invalid master password'); return; }
  if (!fileInput.files[0]) { showToast('No file selected'); return; }
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const decrypted = decryptData(e.target.result, pw);
      if (decrypted) {
        passwords = decrypted;
        saveVault();
        renderVault();
        closeModal('restoreModal');
        logAudit('Restored vault');
        showToast('Vault restored');
      } else {
        showToast('Invalid backup file or password');
      }
    } catch (e) {
      showToast('Invalid backup file');
    }
  };
  reader.readAsText(fileInput.files[0]);
}

// === CSV IMPORT (DASHLANE) ===
function openImportCsvModal() {
  document.getElementById('importCsvModal').classList.add('active');
  // Reset mapping UI
  const mapDiv = document.getElementById('csvMapping');
  if (mapDiv) mapDiv.style.display = 'none';
  ['mapName','mapUsername','mapPassword','mapUrl','mapNote','mapCategory'].forEach(id => {
    const el = document.getElementById(id); if (el) el.innerHTML = '';
  });
  csvImportState = { content: '', delimiter: ',', rows: [] };
}

function populateMappingSelect(id, headers, autoIndex, includeNone = false) {
  const sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  // Provide options; use header names if available, else Column N
  const optAuto = document.createElement('option');
  optAuto.value = ''; optAuto.textContent = 'Auto'; sel.appendChild(optAuto);
  if (includeNone) { const optNone = document.createElement('option'); optNone.value = '-1'; optNone.textContent = 'None'; sel.appendChild(optNone); }
  headers.forEach((h, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = h || `Column ${idx + 1}`;
    if (autoIndex === idx) opt.selected = true;
    sel.appendChild(opt);
  });
}

function handleCsvFileChange() {
  const fileInput = document.getElementById('csvFile');
  if (!fileInput.files[0]) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result || '';
    if (!content.trim()) { showToast('Empty CSV file'); return; }
    const delim = detectCsvDelimiter(content);
    let rows = parseCsvText(content, delim).filter(r => r.some(c => (c||'').trim().length > 0));
    if (rows.length === 0) { showToast('No data found in CSV'); return; }
    csvImportState = { content, delimiter: delim, rows };

    // Always show mapping UI after file selection
    let headers = [];
    const maxCols = Math.max(...rows.slice(0, Math.min(rows.length, 5)).map(r => r.length));
    // Use first row as header if skipFirstRow checked, else generic
    if (document.getElementById('skipFirstRow').checked) {
      headers = rows[0].map(h => (h || '').trim());
    } else {
      headers = Array.from({ length: maxCols }, (_, i) => `Column ${i + 1}`);
    }

    // Guess indices (try to match header names if present)
    function guessIndex(names) {
      const lower = headers.map(h => h.toLowerCase());
      for (const n of names) { const idx = lower.indexOf(n); if (idx !== -1) return idx; }
      return -1;
    }
    const autoMap = {
      name: guessIndex(['name','title','label','site','website']),
      url: guessIndex(['url','website','site','domain']),
      username: guessIndex(['username','user','login','email']),
      password: guessIndex(['password','passcode']),
      note: guessIndex(['note','notes','comment','comments']),
      category: guessIndex(['category','group','folder'])
    };

    document.getElementById('csvMapping').style.display = 'block';
    populateMappingSelect('mapName', headers, autoMap.name, false);
    populateMappingSelect('mapUsername', headers, autoMap.username, false);
    populateMappingSelect('mapPassword', headers, autoMap.password, false);
    populateMappingSelect('mapUrl', headers, autoMap.url, true);
    populateMappingSelect('mapNote', headers, autoMap.note, true);
    populateMappingSelect('mapCategory', headers, autoMap.category, true);
  };
  reader.onerror = function(){ showToast('Error reading file'); };
  reader.readAsText(fileInput.files[0]);
}

function importCsvFile() {
  if (!currentUser) {
    showToast('Please login first');
    return;
  }
  
  const fileInput = document.getElementById('csvFile');
  const skipFirstRow = document.getElementById('skipFirstRow').checked;
  
  if (!fileInput.files[0]) {
    showToast('No file selected');
    return;
  }
  
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
        const csvContent = csvImportState.content || e.target.result;

        if (!csvContent || csvContent.trim().length === 0) {
          showToast('Empty CSV file');
          return;
        }

        const delimiter = csvImportState.content ? csvImportState.delimiter : detectCsvDelimiter(csvContent);

        let rows = (csvImportState.content ? csvImportState.rows : parseCsvText(csvContent, delimiter))
          .filter(r => r.some(cell => (cell || '').trim().length > 0));

        if (rows.length === 0) {
          showToast('No data found in CSV');
          return;
        }

        // Header detection: use explicit checkbox OR detect via keywords
        const headerKeywords = ['password', 'user', 'username', 'url', 'website', 'name', 'title'];
        const firstRowJoined = (rows[0].join(' ') || '').toLowerCase();
        const detectedHasHeader = headerKeywords.some(k => firstRowJoined.includes(k));
        const hasHeader = skipFirstRow || detectedHasHeader;

        // Build column index map, prefer manual mapping if provided
        let colMap = { url: -1, username: -1, password: -1, note: -1, name: -1, category: -1 };
        const mapIds = ['mapUrl','mapUsername','mapPassword','mapNote','mapName','mapCategory'];
        const mapKeys = ['url','username','password','note','name','category'];
        const mappingAvailable = mapIds.every(id => document.getElementById(id));
        if (mappingAvailable && document.getElementById('csvMapping').style.display !== 'none') {
          // Read selected indices (empty string means Auto; -1 means None)
          mapIds.forEach((id, idx) => {
            const val = document.getElementById(id).value;
            const num = val === '' ? NaN : parseInt(val, 10);
            colMap[mapKeys[idx]] = isNaN(num) ? -2 : num; // -2 = AUTO
          });
        }
        if (Object.values(colMap).every(v => v === -1 || v === -2)) {
          // No manual mapping; fall back to auto-detection if headers exist
          if (hasHeader) {
            const headers = rows[0].map(h => (h || '').toLowerCase().trim());
            function findIndex(names) {
              for (const n of names) { const idx = headers.indexOf(n); if (idx !== -1) return idx; }
              return -1;
            }
            colMap = {
              url: findIndex(['url','website','web address','address','site','domain']),
              username: findIndex(['username','user','login','email address','email']),
              password: findIndex(['password','passcode']),
              note: findIndex(['note','notes','comment','comments']),
              name: findIndex(['name','title','label','site','website']),
              category: findIndex(['category','group','folder'])
            };
          } else {
            // No headers; default positions url, username, password, note, name, category
            colMap = { url: 0, username: 1, password: 2, note: 3, name: 4, category: 5 };
          }
        } else if (Object.values(colMap).some(v => v === -2)) {
          // Some are Auto: resolve autos via header detection
          let auto = { url: -1, username: -1, password: -1, note: -1, name: -1, category: -1 };
          if (hasHeader) {
            const headers = rows[0].map(h => (h || '').toLowerCase().trim());
            function findIndex(names) { for (const n of names) { const idx = headers.indexOf(n); if (idx !== -1) return idx; } return -1; }
            auto = {
              url: findIndex(['url','website','web address','address','site','domain']),
              username: findIndex(['username','user','login','email address','email']),
              password: findIndex(['password','passcode']),
              note: findIndex(['note','notes','comment','comments']),
              name: findIndex(['name','title','label','site','website']),
              category: findIndex(['category','group','folder'])
            };
          }
          for (const k of Object.keys(colMap)) { if (colMap[k] === -2) colMap[k] = auto[k]; }
        }

        let startIndex = hasHeader ? 1 : 0;
        let importedCount = 0;
        let skippedCount = 0;

        for (let i = startIndex; i < rows.length; i++) {
          try {
            const r = rows[i];
            function val(idx) { return (idx !== -1 && idx < r.length) ? (r[idx] || '').trim() : ''; }

            const url = val(colMap.url);
            const username = val(colMap.username);
            const password = val(colMap.password);
            const note = val(colMap.note);
            const name = val(colMap.name) || url;
            const category = val(colMap.category) || 'Imported';

            if ((!url && !name) || !password) { skippedCount++; continue; }

            const entry = {
              site: name || url || 'Imported Entry',
              user: username,
              email: note,
              category: category,
              password: password,
              expiration: 90,
              createdAt: new Date().toISOString(),
              added: new Date().toISOString()
            };
            passwords.push(entry);
            importedCount++;
          } catch (lineError) {
            console.error('Error parsing CSV row', i + 1, lineError);
            skippedCount++;
          }
        }

        if (importedCount > 0) {
          saveVault();
          renderVault();
          updatePasswordHealthDashboard();
          closeModal('importCsvModal');
          logAudit(`Imported ${importedCount} passwords from CSV`);
          showToast(`Imported ${importedCount} item(s)${skippedCount ? `, skipped ${skippedCount}` : ''}`);
        } else {
          // Surface detected headers to help user diagnose
          if (hasHeader) {
            console.warn('CSV headers detected:', rows[0]);
          }
          showToast('No valid passwords found in CSV');
        }

        // Clear file input
        fileInput.value = '';

      } catch (error) {
        console.error('CSV import error:', error);
        showToast('Error parsing CSV file: ' + (error.message || 'Unknown error'));
      }
    };

    reader.onerror = function() {
      showToast('Error reading file');
    };

    reader.readAsText(fileInput.files[0]);
}

// === AUTO-FILL ===
function autofillPassword(site, username, password) {
  showToast(`Auto-filling for ${site}: Username: ${username}, Password: ${password}`);
  logAudit(`Auto-filled password for ${site}`);
}

// === SECURE SHARING ===
function sharePassword(i) {
  const p = passwords[i];
  const expirationDays = parseInt(document.getElementById('shareExpiration')?.value || 1);
  const shareId = Math.random().toString(36).substring(2, 10);
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + expirationDays);
  shareLinks[shareId] = { ...p, expiresAt: expirationDate.toISOString() };
  localStorage.setItem('shareLinks', JSON.stringify(shareLinks));
  const shareUrl = `${window.location.origin}/share#${shareId}`;
  const qrCode = document.getElementById('shareQrCode');
  qrCode.innerHTML = '';
  new QRCode(qrCode, { text: shareUrl, width: 200, height: 200 });
  document.getElementById('shareLink').value = shareUrl;
  document.getElementById('shareModal').classList.add('active');
  logAudit(`Shared password for ${p.site}`);
}

function copyShareLink() {
  const link = document.getElementById('shareLink').value;
  navigator.clipboard.writeText(link);
  showToast('Share link copied');
}

window.addEventListener('hashchange', () => {
  const shareId = window.location.hash.substring(1);
  if (shareLinks[shareId]) {
    const { site, user, password, expiresAt } = shareLinks[shareId];
    if (new Date() > new Date(expiresAt)) {
      showToast('Share link expired');
      delete shareLinks[shareId];
      localStorage.setItem('shareLinks', JSON.stringify(shareLinks));
      return;
    }
    showToast(`Shared Password: Site: ${site}, Username: ${user}, Password: ${password}`);
  }
});

// === CATEGORY MANAGEMENT ===
function updateCategorySelect() {
  const addSelect = document.getElementById('categoryAdd');
  const deleteSelect = document.getElementById('categorySelect');
  addSelect.innerHTML = '<option value="" disabled selected>Select Category</option>';
  deleteSelect.innerHTML = '<option value="" disabled selected>Select Category to Delete</option>';
  categories.forEach(cat => {
    const option1 = document.createElement('option'); option1.value = cat; option1.textContent = cat; addSelect.appendChild(option1);
    const option2 = document.createElement('option'); option2.value = cat; option2.textContent = cat; deleteSelect.appendChild(option2);
  });
}

function addCategory() {
  const newCat = document.getElementById('newCategory').value.trim();
  if (!newCat) { showToast('Category name required'); return; }
  if (categories.includes(newCat)) { showToast('Category already exists'); return; }
  categories.push(newCat);
  localStorage.setItem('categories', JSON.stringify(categories));
  updateCategorySelect();
  logAudit(`Added category ${newCat}`);
  showToast('Category added');
  document.getElementById('newCategory').value = '';
}

function deleteCategory() {
  const cat = document.getElementById('categorySelect').value;
  if (!cat) { showToast('Select a category to delete'); return; }
  if (passwords.some(p => p.category === cat)) { showToast('Cannot delete category in use'); return; }
  categories = categories.filter(c => c !== cat);
  localStorage.setItem('categories', JSON.stringify(categories));
  updateCategorySelect();
  logAudit(`Deleted category ${cat}`);
  showToast('Category deleted');
}

// === AUDIT LOG ===
function logAudit(action) {
  auditLog.push({ action, timestamp: new Date().toISOString() });
  localStorage.setItem('auditLog', JSON.stringify(auditLog));
  renderAuditLog();
}

function renderAuditLog() {
  const logList = document.getElementById('auditLogList');
  logList.innerHTML = '';
  auditLog.forEach(log => {
    const li = document.createElement('li');
    li.textContent = `[${new Date(log.timestamp).toLocaleString()}] ${log.action}`;
    logList.appendChild(li);
  });
}

// === TABS ===
function switchTab(tab, btn) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById(tab).classList.add('active');
  document.querySelectorAll('.sidebar button').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'accounts') updateUserSelect();
  else if (tab === 'settings') { renderAuditLog(); updateCategorySelect(); }
  else if (tab === 'vault') renderVault();
  else if (tab === 'dashboard') {
    // Small delay on mobile to ensure DOM is ready for chart
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      setTimeout(() => updatePasswordHealthDashboard(), 100);
    } else {
      updatePasswordHealthDashboard();
    }
  }
  // Sync Android UI if enabled
  if (document.body.classList.contains('android')) {
    syncNavState(tab);
  }
}

// === PARTICLES ===
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  // Fix for high-DPI screens (prevents stretching on mobile)
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  // Use window dimensions if canvas hasn't been sized yet
  const logicalWidth = rect.width || window.innerWidth;
  const logicalHeight = rect.height || window.innerHeight;
  
  canvas.width = logicalWidth * dpr;
  canvas.height = logicalHeight * dpr;
  ctx.scale(dpr, dpr);
  
  // Detect if mobile for slower particle speed
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const speedMultiplier = isMobile ? 0.3 : 0.7; // Much slower on mobile
  
  particleArray = [];
  for (let i = 0; i < 150; i++) {
    const opacity = Math.random() * 0.5 + 0.3;
    particleArray.push({
      x: Math.random() * logicalWidth,
      y: Math.random() * logicalHeight,
      r: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * speedMultiplier,
      vy: (Math.random() - 0.5) * speedMultiplier,
      opacity: opacity
    });
  }
  function animate() {
    ctx.clearRect(0, 0, logicalWidth, logicalHeight);
    if (particlesEnabled) {
      // Detect current theme
      const isLightTheme = document.body.classList.contains('light');
      
      particleArray.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x > logicalWidth) p.x = 0; if (p.x < 0) p.x = logicalWidth;
        if (p.y > logicalHeight) p.y = 0; if (p.y < 0) p.y = logicalHeight;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        
        // Use black particles for light theme, white for dark theme
        ctx.fillStyle = isLightTheme 
          ? `rgba(0, 0, 0, ${p.opacity})` 
          : `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
      });
    }
    requestAnimationFrame(animate);
  }
  animate();
}

window.addEventListener('DOMContentLoaded', () => {
  initParticles();
});

function toggleParticles() {
  particlesEnabled = !particlesEnabled;
  if (!particlesEnabled) {
    const c = document.getElementById('particleCanvas');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }
  logAudit('Toggled particles ' + (particlesEnabled ? 'on' : 'off'));
}

window.addEventListener('resize', () => {
  // Reinitialize particles with new dimensions
  initParticles();
});

// === ANDROID LAYOUT ===
function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

function getTabTitle(tab) {
  switch (tab) {
    case 'vault': return 'Vault';
    case 'add': return 'Add Password';
    case 'dashboard': return 'Dashboard';
    case 'settings': return 'Settings';
    case 'accounts': return 'Accounts';
    default: return 'Anima';
  }
}

function syncNavState(activeTab) {
  const topbar = document.getElementById('topbar');
  const titleEl = document.getElementById('topbarTitle');
  const bottomNav = document.getElementById('bottomNav');
  if (titleEl) titleEl.textContent = getTabTitle(activeTab);
  if (bottomNav) {
    bottomNav.querySelectorAll('button').forEach(b => {
      const tab = b.getAttribute('data-tab');
      if (tab === activeTab) b.classList.add('active');
      else b.classList.remove('active');
    });
  }
}

function enableAndroidLayout(initialTab = 'vault') {
  document.body.classList.add('android');
  const tb = document.getElementById('topbar');
  const bn = document.getElementById('bottomNav');
  if (tb) tb.style.display = 'flex';
  if (bn) bn.style.display = 'flex';
  syncNavState(initialTab);
}

function handleBottomNav(btn, tab) {
  switchTab(tab, null);
  syncNavState(tab);
}
