// Externalized JavaScript from index.html for cleaner structure

// === VARIABLES ===
let users = JSON.parse(localStorage.getItem('users') || '{}');
let currentUser = null;
let passwords = [];
let editIndex = null;
let particlesEnabled = true;
let particleArray = [];
let deleteCallback = null;
let deleteAccountUsername = null;
const defaultProfilePic = 'Images/fe48a763-a358-45a5-81bd-77c0a70330ee.webp';
let categories = JSON.parse(localStorage.getItem('categories') || '[]');
let auditLog = JSON.parse(localStorage.getItem('auditLog') || '[]');
const mfaSecrets = JSON.parse(localStorage.getItem('mfaSecrets') || '{}');
const shareLinks = JSON.parse(localStorage.getItem('shareLinks') || '{}');

// === UTILITY FUNCTIONS ===
function showToast(msg, duration = 2000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  const modal = document.getElementById(modalId);
  modal.querySelectorAll('input').forEach(input => input.value = '');
  modal.querySelectorAll('.error-message').forEach(error => error.style.display = 'none');
}

function closeLoginModal() {
  closeModal('loginModal');
  document.querySelector('.sidebar').style.display = 'none';
  document.querySelector('.main').style.display = 'none';
  document.getElementById('openLoginBtn').style.display = 'block';
  // Hide Android bars when not logged in
  const tb = document.getElementById('topbar');
  const bn = document.getElementById('bottomNav');
  if (tb) tb.style.display = 'none';
  if (bn) bn.style.display = 'none';
}

function openLoginModal() {
  document.getElementById('loginModal').classList.add('active');
  document.getElementById('openLoginBtn').style.display = 'none';
  updateUserSelect();
}

// === ENCRYPTION ===
function encryptData(data, key) {
  return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
}

function decryptData(encrypted, key) {
  try {
    const bytes = CryptoJS.AES.decrypt(encrypted, key);
    return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  } catch (e) {
    return null;
  }
}

// === THEME PERSISTENCE ===
function toggleTheme() {
  document.body.classList.toggle('light');
  localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  logAudit('Theme toggled to ' + (document.body.classList.contains('light') ? 'light' : 'dark'));
}

window.onload = () => {
  const theme = localStorage.getItem('theme') || 'dark';
  if (theme === 'light') document.body.classList.add('light');
  updateUserSelect();
  updateCategorySelect();
  if (Object.keys(users).length === 0) {
    document.getElementById('createAccountModal').classList.add('active');
    document.getElementById('openLoginBtn').style.display = 'none';
  } else {
    document.getElementById('loginModal').classList.add('active');
    document.getElementById('openLoginBtn').style.display = 'none';
  }
};

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
function updatePasswordHealthDashboard() {
  const ctx = document.getElementById('passwordChart').getContext('2d');
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

  new Chart(ctx, {
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
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb',
            stepSize: 1
          },
          title: {
            display: true,
            text: 'Number of Passwords',
            color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb'
          }
        },
        x: {
          ticks: { color: document.body.classList.contains('light') ? '#1e1e2f' : '#f9fafb' }
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
  vault.innerHTML = '<input type="text" id="searchBar" placeholder="Search by site, username, or category" aria-label="Search">';
  document.getElementById('searchBar').addEventListener('input', filterVault);
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
    card.innerHTML = `
      <div class="vault-item"><b>Site:</b> <span>${p.site}</span></div>
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
  const loginSelect = document.getElementById('loginUsername');
  const deleteSelect = document.getElementById('accountDeleteSelect');
  loginSelect.innerHTML = '<option value="" disabled selected>Select Username</option>';
  deleteSelect.innerHTML = '<option value="" disabled selected>Select Account</option>';
  const lastUser = localStorage.getItem('lastUser');
  Object.keys(users).forEach(username => {
    const loginOption = document.createElement('option');
    loginOption.value = username;
    loginOption.textContent = username;
    if (username === lastUser) loginOption.selected = true;
    loginSelect.appendChild(loginOption);
    const deleteOption = document.createElement('option');
    deleteOption.value = username;
    deleteOption.textContent = username;
    deleteSelect.appendChild(deleteOption);
  });
  document.getElementById('mfaCode').style.display = users[lastUser]?.mfaEnabled ? 'block' : 'none';
}

function createAccountModal() {
  closeModal('loginModal');
  document.getElementById('createAccountModal').classList.add('active');
  document.getElementById('openLoginBtn').style.display = 'none';
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
  else if (tab === 'dashboard') updatePasswordHealthDashboard();
  // Sync Android UI if enabled
  if (document.body.classList.contains('android')) {
    syncNavState(tab);
  }
}

// === PARTICLES ===
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  particleArray = [];
  for (let i = 0; i < 150; i++) {
    particleArray.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 2 + 1,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (particlesEnabled) {
      particleArray.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x > canvas.width) p.x = 0; if (p.x < 0) p.x = canvas.width;
        if (p.y > canvas.height) p.y = 0; if (p.y < 0) p.y = canvas.height;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color; ctx.fill();
      });
    }
    requestAnimationFrame(animate);
  }
  animate();
}

function toggleParticles() {
  particlesEnabled = !particlesEnabled;
  if (!particlesEnabled) {
    const c = document.getElementById('particleCanvas');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
  }
  logAudit('Toggled particles ' + (particlesEnabled ? 'on' : 'off'));
}

window.addEventListener('resize', () => {
  const c = document.getElementById('particleCanvas');
  c.width = window.innerWidth;
  c.height = window.innerHeight;
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
