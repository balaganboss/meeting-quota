let day = 1;
let quota = 0;
let ration = 100000;
const log = document.getElementById('log');

function addLog(msg) {
  const p = document.createElement('div');
  p.textContent = `Day ${day}: ${msg}`;
  log.prepend(p);
}

function updateDisplay() {
  document.getElementById('quota-value').textContent = quota;
  document.getElementById('ration-value').textContent = ration;
  document.querySelector('header').textContent = `QUOTA TERMINAL — DAY ${day}`;
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

function dailyTick() {
  day++;
  ration = Math.max(0, ration - Math.floor(Math.random() * 8000 + 2000));
  quota += Math.floor(Math.random() * 6000 + 2000);
  addLog('Rations dropped. Workers produced under pressure.');
  updateDisplay();
  if (quota >= 100000) {
    document.getElementById('final-line').style.display = 'block';
  }
}

setInterval(dailyTick, 8000);
updateDisplay();
