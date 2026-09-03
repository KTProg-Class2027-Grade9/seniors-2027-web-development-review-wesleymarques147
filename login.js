// login.js - handle register/login using localStorage (demo only)

async function hashPassword(password) {
  const enc = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', enc);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function saveUser(email, pwdHash) {
  const user = { email: email, pwdHash: pwdHash };
  localStorage.setItem('travel_user', JSON.stringify(user));
}

function getUser() {
  try {
    return JSON.parse(localStorage.getItem('travel_user') || 'null');
  } catch (e) {
    return null;
  }
}

function setLoggedIn(email) {
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('currentUser', email);
}

function setLoggedOut() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('currentUser');
}

window.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('auth-email');
  const passEl = document.getElementById('auth-pass');
  const msg = document.getElementById('auth-msg');
  const registerBtn = document.getElementById('register-btn');
  const loginBtn = document.getElementById('login-btn');

  registerBtn.addEventListener('click', async () => {
    msg.textContent = '';
    const email = (emailEl.value || '').trim();
    const pwd = passEl.value || '';
    if (!email || !pwd) {
      msg.textContent = 'Enter email and password to register.';
      return;
    }
    const existing = getUser();
    if (existing && existing.email === email) {
      msg.textContent = 'An account with this email already exists. Please log in.';
      return;
    }
    const hash = await hashPassword(pwd);
    saveUser(email, hash);
    setLoggedIn(email);
    msg.style.color = 'green';
    msg.textContent = 'Registered and logged in. Redirecting...';
    setTimeout(() => { location.replace('index.html'); }, 900);
  });

  loginBtn.addEventListener('click', async () => {
    msg.textContent = '';
    const email = (emailEl.value || '').trim();
    const pwd = passEl.value || '';
    if (!email || !pwd) {
      msg.textContent = 'Enter email and password to log in.';
      return;
    }
    const user = getUser();
    if (!user) {
      msg.textContent = 'No registered user found. Please register first.';
      return;
    }
    if (user.email !== email) {
      msg.textContent = 'Email does not match registered account.';
      return;
    }
    const hash = await hashPassword(pwd);
    if (hash !== user.pwdHash) {
      msg.textContent = 'Incorrect password.';
      return;
    }
    setLoggedIn(email);
    msg.style.color = 'green';
    msg.textContent = 'Logged in. Redirecting...';
    setTimeout(() => { location.replace('index.html'); }, 700);
  });
});
