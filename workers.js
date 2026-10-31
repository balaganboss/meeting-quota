const workers = [
  { name: "Ivan Petrov", detail: "has a sick daughter" },
  { name: "Anna Volkova", detail: "recently injured on the line" },
  { name: "Sergei Kozlov", detail: "keeps extra grain under his bunk" },
  { name: "Elena Moroz", detail: "lost her husband last winter" },
  { name: "Dmitri Orlov", detail: "reports every shortfall" },
  { name: "Natasha Belova", detail: "smuggles letters to her sister" }
];

const container = document.getElementById('workers');
workers.forEach(w => {
  const div = document.createElement('div');
  div.className = 'worker';
  div.innerHTML = `<strong>${w.name}</strong><br>${w.detail}`;
  container.appendChild(div);
});
