import { Toast } from './utils/toast.js';

let userEmail = null;
let currentProfile = {};

// Default preset covers
const PRESET_COVERS = [
  '/public/cover1.png',
  '/public/cover2.png',
  '/public/cover3.png',
];

const ACCENT_COLORS = [
  '#efede5', // Default light text
  '#4f46e5', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#ef4444', // Red
];

// Elements
const profileBtn = document.getElementById('nav-profile-btn');
const profileSection = document.getElementById('profile-section');
const mainSections = [
  document.querySelector('.dashboard-greeting'),
  document.querySelector('.cal-section'),
  document.getElementById('tasks-section'),
  document.getElementById('focus-section'),
  document.getElementById('statistics-section'),
  document.querySelector('.topbar')
];
const rightPanel = document.querySelector('.panel');

const bannerImg = document.getElementById('profile-banner');
const avatarImg = document.getElementById('profile-avatar');
const defaultAvatarIcon = document.getElementById('default-avatar-icon');
const nameInput = document.getElementById('profile-name-input');
const bioInput = document.getElementById('profile-bio-input');
const academicInput = document.getElementById('profile-academic-input');
const socialInput = document.getElementById('profile-social-input');

const changeBannerBtn = document.getElementById('change-banner-btn');
const removeBannerBtn = document.getElementById('remove-banner-btn');
const bannerUploadInput = document.getElementById('banner-upload-input');

const changeAvatarBtn = document.getElementById('change-avatar-btn');
const avatarUploadInput = document.getElementById('avatar-upload-input');
const saveProfileInfoBtn = document.getElementById('save-profile-info-btn');

const themeBtns = document.querySelectorAll('.theme-btn');
const accentColorContainer = document.getElementById('accent-color-options');
const fontSelect = document.getElementById('font-select');

// Layout toggles
const layoutToggles = {
  calendar: document.getElementById('layout-cal-toggle'),
  tasks: document.getElementById('layout-tasks-toggle'),
  focus: document.getElementById('layout-focus-toggle'),
  statistics: document.getElementById('layout-stats-toggle'),
};

const presetGallery = document.getElementById('preset-gallery');

// Initialize Profile Module
export function initProfile() {
  const storedUser = localStorage.getItem('studyplan_user');
  if (storedUser) {
    userEmail = JSON.parse(storedUser).email;
    loadProfile();
  }

  setupEventListeners();
  populateAccentColors();
  populatePresets();
}

async function loadProfile() {
  try {
    const res = await fetch(`/api/profile?email=${encodeURIComponent(userEmail)}`);
    if (!res.ok) throw new Error('Failed to load profile');
    currentProfile = await res.json();
    applyProfileData();
  } catch (error) {
    console.error(error);
  }
}

function applyProfileData() {
  // Details
  nameInput.value = currentProfile.display_name || '';
  bioInput.value = currentProfile.bio || '';
  academicInput.value = currentProfile.academic_details || '';
  socialInput.value = currentProfile.social_links || '';

  // Images
  if (currentProfile.banner_url) {
    bannerImg.src = currentProfile.banner_url;
    bannerImg.style.display = 'block';
    
    let posY = currentProfile.banner_position_y || 50;
    // Strip % if it accidentally got saved
    if (typeof posY === 'string' && posY.endsWith('%')) {
      posY = posY.replace('%', '');
    }
    bannerImg.style.objectPosition = `50% ${posY}%`;
    removeBannerBtn.style.display = 'inline-block';
  } else {
    bannerImg.style.display = 'none';
    removeBannerBtn.style.display = 'none';
  }

  if (currentProfile.avatar_url) {
    avatarImg.src = currentProfile.avatar_url;
    avatarImg.style.display = 'block';
    defaultAvatarIcon.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    defaultAvatarIcon.style.display = 'block';
  }

  // Theme
  document.documentElement.setAttribute('data-theme', currentProfile.theme_mode || 'dark');
  themeBtns.forEach(btn => {
    btn.style.opacity = btn.dataset.theme === (currentProfile.theme_mode || 'dark') ? '1' : '0.5';
  });

  // Accent Color
  if (currentProfile.accent_color) {
    document.documentElement.style.setProperty('--accent-color', currentProfile.accent_color);
  } else {
    document.documentElement.style.removeProperty('--accent-color');
  }
  updateAccentColorSelection();

  // Font
  const font = currentProfile.font_family || 'Inter';
  fontSelect.value = font;
  let cssFont = 'Inter, system-ui, sans-serif';
  if (font === 'Roboto') cssFont = 'Roboto, system-ui, sans-serif';
  if (font === 'Playfair Display') cssFont = '"Playfair Display", serif';
  if (font === 'JetBrains Mono') cssFont = '"JetBrains Mono", monospace';
  document.documentElement.style.setProperty('--font-sans', cssFont);

  // Layout
  if (currentProfile.dashboard_layout) {
    try {
      const layout = JSON.parse(currentProfile.dashboard_layout);
      layoutToggles.calendar.checked = !!layout.calendar;
      layoutToggles.tasks.checked = !!layout.tasks;
      layoutToggles.focus.checked = !!layout.focus;
      layoutToggles.statistics.checked = !!layout.statistics;
      applyLayoutVisibility(layout);
    } catch(e) {}
  }
}

function applyLayoutVisibility(layout) {
  const calSec = document.querySelector('.cal-section');
  const taskSec = document.getElementById('tasks-section');
  const focusSec = document.getElementById('focus-section');
  const statSec = document.getElementById('statistics-section');
  
  if(calSec) calSec.style.display = layout.calendar ? '' : 'none';
  if(taskSec && !taskSec.closest('.profile-section')) taskSec.style.display = layout.tasks ? '' : 'none';
  if(focusSec && !focusSec.closest('.profile-section')) focusSec.style.display = layout.focus ? '' : 'none';
  if(statSec) statSec.style.display = layout.statistics ? '' : 'none';
}

async function saveProfile(updates) {
  try {
    const res = await fetch(`/api/profile?email=${encodeURIComponent(userEmail)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to save profile');
    currentProfile = { ...currentProfile, ...updates };
    applyProfileData();
    Toast.show('Profile updated successfully', 'success');
    return true;
  } catch (error) {
    console.error(error);
    Toast.show('Failed to update profile', 'error');
    return false;
  }
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data.url;
  } catch (err) {
    Toast.show('Upload failed', 'error');
    return null;
  }
}

function setupEventListeners() {
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      // Hide main sections
      mainSections.forEach(s => { if(s) s.classList.add('hidden'); if(s && s.style) s.style.display = 'none'; });
      // Show profile
      if (profileSection) {
        profileSection.classList.remove('hidden');
        profileSection.style.display = 'block';
      }
      // Hide right panel to give full width
      if (rightPanel) rightPanel.style.display = 'none';
    });
  }

  // Restore main sections when clicking other nav items
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (profileSection) {
        profileSection.classList.add('hidden');
        profileSection.style.display = 'none';
      }
      if (rightPanel) rightPanel.style.display = '';
      // We rely on the layout config to restore correct display
      if (currentProfile && currentProfile.dashboard_layout) {
        applyLayoutVisibility(JSON.parse(currentProfile.dashboard_layout));
      } else {
        mainSections.forEach(s => { if(s) { s.classList.remove('hidden'); s.style.display = ''; } });
      }
      const topbar = document.querySelector('.topbar');
      if (topbar) { topbar.classList.remove('hidden'); topbar.style.display = ''; }
      const greeting = document.querySelector('.dashboard-greeting');
      if (greeting) { greeting.classList.remove('hidden'); greeting.style.display = ''; }
    });
  });

  // Save info
  if (saveProfileInfoBtn) {
    saveProfileInfoBtn.addEventListener('click', () => {
      saveProfile({
        display_name: nameInput.value,
        bio: bioInput.value,
        academic_details: academicInput.value,
        social_links: socialInput.value
      });
    });
  }

  // Theme
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      saveProfile({ theme_mode: btn.dataset.theme });
    });
  });

  // Font
  if (fontSelect) {
    fontSelect.addEventListener('change', () => {
      saveProfile({ font_family: fontSelect.value });
    });
  }

  // Avatar Upload
  if (changeAvatarBtn && avatarUploadInput) {
    changeAvatarBtn.addEventListener('click', () => avatarUploadInput.click());
    avatarUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = await uploadFile(file);
        if (url) saveProfile({ avatar_url: url });
      }
    });
  }

  // Banner Upload
  if (changeBannerBtn && bannerUploadInput) {
    changeBannerBtn.addEventListener('click', () => bannerUploadInput.click());
    bannerUploadInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        const url = await uploadFile(file);
        if (url) saveProfile({ banner_url: url });
      }
    });
  }

  if (removeBannerBtn) {
    removeBannerBtn.addEventListener('click', () => {
      saveProfile({ banner_url: null, banner_position_y: '50%' });
    });
  }


  // Layout toggles
  Object.keys(layoutToggles).forEach(key => {
    const el = layoutToggles[key];
    if (el) {
      el.addEventListener('change', () => {
        const newLayout = {
          calendar: layoutToggles.calendar.checked,
          tasks: layoutToggles.tasks.checked,
          focus: layoutToggles.focus.checked,
          statistics: layoutToggles.statistics.checked,
        };
        saveProfile({ dashboard_layout: JSON.stringify(newLayout) });
      });
    }
  });

  // Drag and drop banner
  const bannerContainer = document.querySelector('.profile-banner-container');
  if (bannerContainer) {
    bannerContainer.addEventListener('dragover', (e) => { e.preventDefault(); bannerContainer.style.opacity = 0.8; });
    bannerContainer.addEventListener('dragleave', (e) => { e.preventDefault(); bannerContainer.style.opacity = 1; });
    bannerContainer.addEventListener('drop', async (e) => {
      e.preventDefault();
      bannerContainer.style.opacity = 1;
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const url = await uploadFile(e.dataTransfer.files[0]);
        if (url) saveProfile({ banner_url: url });
      }
    });
  }
}

function populateAccentColors() {
  if (!accentColorContainer) return;
  ACCENT_COLORS.forEach(color => {
    const div = document.createElement('div');
    div.className = 'color-option';
    div.style.background = color;
    if (currentProfile.accent_color === color) div.classList.add('active');
    
    div.addEventListener('click', () => {
      saveProfile({ accent_color: color });
    });
    
    accentColorContainer.appendChild(div);
  });
}

function updateAccentColorSelection() {
  if (!accentColorContainer) return;
  const options = accentColorContainer.querySelectorAll('.color-option');
  options.forEach(opt => {
    if (opt.style.background === (currentProfile.accent_color || ACCENT_COLORS[0])) {
      opt.classList.add('active');
    } else {
      opt.classList.remove('active');
    }
  });
}

function populatePresets() {
  if (!presetGallery) return;
  PRESET_COVERS.forEach(url => {
    const div = document.createElement('div');
    div.className = 'preset-cover';
    div.style.backgroundImage = `url(${url})`;
    
    div.addEventListener('click', () => {
      saveProfile({ banner_url: url });
    });
    
    presetGallery.appendChild(div);
  });
}

initProfile();
