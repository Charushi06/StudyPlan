console.log("Support page loaded");

const darkMode = localStorage.getItem('studyplan_dark_mode');

if (darkMode === 'false') {

  document.documentElement.style.setProperty('--color-background-primary', '#ffffff');
  document.documentElement.style.setProperty('--color-background-secondary', '#f7f7f5');
  document.documentElement.style.setProperty('--color-background-tertiary', '#efefec');

  document.documentElement.style.setProperty('--color-text-primary', '#1a1a18');
  document.documentElement.style.setProperty('--color-text-secondary', '#6b6b66');

}


const links = document.querySelectorAll('.footer-links a');

links.forEach(link => {
  link.addEventListener('click', () => {

    document.querySelectorAll('.card').forEach(card => {
      card.classList.remove('active-card');
    });

    const targetId = link.getAttribute('href').split('#')[1];
    const targetSection = document.getElementById(targetId);

    if (targetSection) {
      targetSection.classList.add('active-card');
    }
  });
});


window.addEventListener('load', () => {

  const currentHash = window.location.hash.substring(1);

  if (currentHash) {

    const targetSection = document.getElementById(currentHash);

    if (targetSection) {
      targetSection.classList.add('active-card');
    }
  }
});