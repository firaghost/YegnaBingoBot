// Telegram Web App SDK integration
let tg = null;

if (typeof window !== 'undefined') {
  tg = window.Telegram?.WebApp;
  
  if (tg) {
    // Initialize the Web App
    tg.ready();
    tg.expand();
    
    // Enable closing confirmation
    tg.enableClosingConfirmation();
    
    // Set header color
    tg.setHeaderColor('#1E40AF');
    tg.setBackgroundColor('#1E40AF');
  }
}

export const telegram = tg;

export function getTelegramUser() {
  if (!tg) return null;
  return tg.initDataUnsafe?.user || null;
}

export function getUserId() {
  const user = getTelegramUser();
  return user?.id || null;
}

export function showAlert(message) {
  if (tg) {
    tg.showAlert(message);
  } else {
    alert(message);
  }
}

export function showConfirm(message, callback) {
  if (tg) {
    tg.showConfirm(message, callback);
  } else {
    const result = confirm(message);
    callback(result);
  }
}

export function close() {
  if (tg) {
    tg.close();
  }
}

export function setMainButton(text, onClick) {
  if (!tg) return;
  
  tg.MainButton.setText(text);
  tg.MainButton.show();
  tg.MainButton.onClick(onClick);
}

export function hideMainButton() {
  if (tg) {
    tg.MainButton.hide();
  }
}

export function showMainButton() {
  if (tg) {
    tg.MainButton.show();
  }
}

export function setBackButton(onClick) {
  if (!tg) return;
  
  tg.BackButton.show();
  tg.BackButton.onClick(onClick);
}

export function hideBackButton() {
  if (tg) {
    tg.BackButton.hide();
  }
}

export function hapticFeedback(type = 'medium') {
  if (tg?.HapticFeedback) {
    tg.HapticFeedback.impactOccurred(type);
  }
}
