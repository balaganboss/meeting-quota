let day = 1;
let quota = 0;
let ration = 100000;
let dayLength = 45; // seconds per day
let timeLeft = dayLength;
const log = document.getElementById('log');

function addLog(msg) {
  const p = document.createElement('div');
  p.textContent = `Day ${day}: ${msg}`;
  log.prepend(p);
}

function updateDisplay() {
  document.getElementById('quota-value').textContent = quota;
  document.getElementById('ration-value').textContent = ration;
  document.querySelector('header').textContent = `QUOTA TERMINAL — DAY ${day}  |  ${timeLeft}s`;
}

function dailyTick() {
  day++;
  timeLeft = dayLength;
  ration = Math.max(0, ration - Math.floor(Math.random() * 6000 + 1500));
  quota += Math.floor(Math.random() * 4000 + 1000);
  addLog('Rations dropped. Workers produced under pressure.');
  updateDisplay();
  if (quota >= 100000) {
    document.getElementById('final-line').style.display = 'block';
  }
}

document.getElementById('bribe-btn').onclick = () => {
  ration -= 5000;
  quota += 8000;
  addLog('Bribed contact. +8000 quota, -5000 ration. Timestamp logged.');
  updateDisplay();
};

document.getElementById('inspect-btn').onclick = () => {
  addLog('STATE INSPECTION — 30 seconds to hide evidence...');
  setTimeout(() => addLog('Inspection passed. Privileges retained.'), 3000);
};

setInterval(() => {
  timeLeft--;
  updateDisplay();
  if (timeLeft <= 0) {
    dailyTick();
  }
}, 1000);

updateDisplay();
