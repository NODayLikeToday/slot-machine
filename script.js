/********************
 * UPDATED PEOPLE LIST (as requested)
 ********************/
const people = [
  { name: "Agata", enabled: true, img: "images/agata.jpg" },
  { name: "Alana", enabled: true, img: "images/alana.jpg" },
  { name: "Amy", enabled: true, img: "images/amy.jpg" },
  { name: "Angie", enabled: true, img: "images/angie.jpg" },
  { name: "Becky", enabled: true, img: "images/becky.jpg" },
  { name: "Bridget", enabled: true, img: "images/bridget.jpg" },
  { name: "Dorian", enabled: true, img: "images/dorian.jpg" },
  { name: "Ed", enabled: true, img: "images/ed.jpg" },
  { name: "Justin", enabled: true, img: "images/justin.jpg" },
  { name: "Kaitlin", enabled: true, img: "images/kaitlin.jpg" },
  { name: "Kyle", enabled: true, img: "images/kyle.jpg" },
  { name: "Maya", enabled: true, img: "images/maya.jpg" },
  { name: "Nick", enabled: true, img: "images/nick.jpg" },
  { name: "Tanya", enabled: true, img: "images/tanya.jpg" }
];

const ROW_H = parseInt(
  getComputedStyle(document.documentElement).getPropertyValue('--rowH'),
  10
);

let spinning = false;
let pendingWinner = null;

/********************
 * DOM
 ********************/
const reelTracks = [
  document.getElementById("reel1"),
  document.getElementById("reel2"),
  document.getElementById("reel3")
];

const slotMachineEl = document.getElementById("slotMachine");
const spinBtn = document.getElementById("spinBtn");

const modal = document.getElementById("winnerModal");
const winnerNameEl = document.getElementById("winnerName");
const nameList = document.getElementById("nameList");

const modalOkBtn = document.getElementById("modalOkBtn");
const spinAgainBtn = document.getElementById("spinAgainBtn");
const modalCloseBtn = document.getElementById("modalCloseBtn");

/********************
 * HELPERS
 ********************/
function getActivePeople() {
  return people.filter(p => p.enabled);
}

function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function randomPerson(active) {
  return active[Math.floor(Math.random() * active.length)];
}

function ensureNotWinner(active, winner) {
  if (active.length <= 1) return winner; // unavoidable
  let p = randomPerson(active);
  while (p.name === winner.name) p = randomPerson(active);
  return p;
}

/**
 * Build a reel with randomized symbols BUT force the winner to land
 * in the CENTER visible row when stopped.
 *
 * Visible rows are: top, center, bottom.
 * We place winner at targetIndex, and translate so it appears in the center row:
 * translateY = -((targetIndex - 1) * ROW_H)
 */
function buildRandomizedReel(track, active, winner, targetIndex, totalItems) {
  track.innerHTML = "";

  const symbols = new Array(totalItems).fill(null).map(() => randomPerson(active));

  // force winner in the center landing spot
  symbols[targetIndex] = winner;

  // make the two neighbors not equal to winner if possible (looks nicer)
  if (targetIndex - 1 >= 0) symbols[targetIndex - 1] = ensureNotWinner(active, winner);
  if (targetIndex + 1 < symbols.length) symbols[targetIndex + 1] = ensureNotWinner(active, winner);

  // render: IMAGE ONLY
  for (const p of symbols) {
    const item = document.createElement("div");
    item.className = "reel-item";

    const img = document.createElement("img");
    img.src = p.img;
    img.alt = p.name;

    // if image missing, show a neutral fallback circle
    img.onerror = () => {
      img.removeAttribute("src");
      img.style.background = "#0b1220";
    };

    item.appendChild(img);
    track.appendChild(item);
  }

  return symbols.length;
}

/* 
  Load random images for staff in the reels initially so that they aren't blank
*/
function initializeReels() {
  const active = getActivePeople();
  if (!active.length) return;

  const totalItems = Math.max(24, active.length * 4);

  reelTracks.forEach(track => {
    // Reset transform & transition
    track.style.transition = "none";
    track.style.transform = "translateY(0px)";
    void track.offsetHeight;

    // Pick a random center index
    const centerIndex = Math.floor(totalItems / 2);

    // Build reel with NO forced winner
    track.innerHTML = "";
    const symbols = new Array(totalItems)
      .fill(null)
      .map(() => active[Math.floor(Math.random() * active.length)]);

    symbols.forEach(p => {
      const item = document.createElement("div");
      item.className = "reel-item";

      const img = document.createElement("img");
      img.src = p.img;
      img.alt = p.name;
      img.onerror = () => {
        img.removeAttribute("src");
        img.style.background = "#0b1220";
      };

      item.appendChild(img);
      track.appendChild(item);
    });

    // Center the reel visually
    const translateY = -((centerIndex - 1) * ROW_H);
    track.style.transform = `translateY(${translateY}px)`;
  });
}

/********************
 * STAFF LIST UI
 ********************/
function buildNameList() {
  nameList.innerHTML = "";

  people.forEach(p => {
    const row = document.createElement("div");
    row.className = "name-item";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = p.enabled;
    cb.onchange = () => {
      p.enabled = cb.checked;
      updateSpinEnabled();
    };

    const label = document.createElement("label");
    label.textContent = p.name;

    row.append(cb, label);
    nameList.appendChild(row);
  });
}

function updateSpinEnabled() {
  const activeCount = getActivePeople().length;
  spinBtn.disabled = activeCount < 1 || spinning;
}

/********************
 * MODAL + REMOVAL
 ********************/
function openModal(winner) {
  winnerNameEl.textContent = winner.name;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
}

/**
 * Requirement: "dismissing the modal would remove that person's name from the list."
 * So ANY dismissal path applies removal (Close, Spin Again, X, outside click, Esc).
 */
function dismissModal({ spinAgain = false } = {}) {
  if (pendingWinner) {
    pendingWinner.enabled = false;
    pendingWinner = null;
    buildNameList();
  }
  closeModal();
  updateSpinEnabled();

  if (spinAgain) spinSlotMachine();
}

/********************
 * SPIN LOGIC
 ********************/
function spinSlotMachine() {
  if (spinning) return;

  const active = getActivePeople();
  if (active.length < 1) return;

  spinning = true;
  updateSpinEnabled();

  // Remove highlight while spinning
  slotMachineEl.classList.remove("highlight");

  // Pick winner ONCE
  const winner = active[Math.floor(Math.random() * active.length)];
  pendingWinner = winner;

  // Build enough items to create a convincing "spin"
  const N = active.length;
  const totalItems = Math.max(48, N * 7); // longer track reduces visible repetition

  // We'll compute when the LAST reel finishes (delay + duration)
  let latestFinishMs = 0;

  reelTracks.forEach((track, i) => {
    // --- 1) Hard reset transform + transition so each spin starts from a known position ---
    track.style.transition = "none";
    track.style.transform = "translateY(0px)";

    // Force reflow so the reset is committed before we rebuild & animate
    // (prevents the browser from batching style changes)
    void track.offsetHeight;

    // --- 2) Choose a deep target index so it scrolls a lot, with per-reel variation ---
    const base = Math.floor(totalItems * 0.65);
    const jitter = Math.floor(Math.random() * (N * 2)); // small variation
    const targetIndex = Math.min(totalItems - 2, base + jitter);

    // --- 3) Build randomized reel content but force the WINNER at targetIndex ---
    // buildRandomizedReel(track, active, winner, targetIndex, totalItems)
    // must render ONLY images (as in your current version)
    buildRandomizedReel(track, active, winner, targetIndex, totalItems);

    // --- 4) Restore transition for the actual animation ---
    const delayMs = i * 220;              // stagger reel stops
    const durationSec = 1.35 + i * 0.18;  // each reel slightly longer

    track.style.transition = `transform ${durationSec}s cubic-bezier(0.22, 1, 0.36, 1)`;

    // Translate so that targetIndex lands in CENTER row (index 1 of visible rows)
    // Center row start = 1 * ROW_H
    // So we want targetIndex positioned at row 1 => translate to -(targetIndex - 1) rows
    const translateY = -((targetIndex - 1) * ROW_H);

    // Kick off the animation after delay
    setTimeout(() => {
      track.style.transform = `translateY(${translateY}px)`;
    }, delayMs);

    // Track latest finish time
    const finishMs = delayMs + durationSec * 1000;
    if (finishMs > latestFinishMs) latestFinishMs = finishMs;
  });

  // --- 5) When all reels have finished, highlight center row + confetti + modal ---
  setTimeout(() => {
    // Blink the center row outline across all reels
    slotMachineEl.classList.add("highlight");

    // Confetti burst(s)
    /*
    confetti({ particleCount: 160, spread: 90, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 80, spread: 120, startVelocity: 35, origin: { y: 0.5 } });
    }, 140);
    */

    // Gold coin burst
    const coinColors = ["#FFD700", "#FFC300", "#FFB000"];

    confetti({
      particleCount: 120,
      spread: 70,
      startVelocity: 45,
      gravity: 1.2,
      scalar: 1.2,
      shapes: ["circle"],
      colors: coinColors,
      origin: { y: 0.6 }
    });

    setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 100,
        startVelocity: 30,
        gravity: 1.1,
        scalar: 1.1,
        shapes: ["circle"],
        colors: coinColors,
        origin: { y: 0.55 }
      });
    }, 160);

    // Modal shows winner NAME (even though reels show only images)
    openModal(winner);

    spinning = false;
    updateSpinEnabled();
  }, latestFinishMs + 80); // tiny buffer so we don't fire early
}

/********************
 * EVENTS
 ********************/
spinBtn.addEventListener("click", spinSlotMachine);

// Modal buttons
modalOkBtn.addEventListener("click", () => dismissModal({ spinAgain: false }));
spinAgainBtn.addEventListener("click", () => dismissModal({ spinAgain: true }));

// X button dismisses (and removes winner)
modalCloseBtn.addEventListener("click", () => dismissModal({ spinAgain: false }));

// Click outside dialog dismisses (and removes winner)
modal.addEventListener("click", (e) => {
  if (e.target === modal) dismissModal({ spinAgain: false });
});

// ESC dismisses (and removes winner)
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("show")) {
    dismissModal({ spinAgain: false });
  }
});

/********************
 * INIT
 ********************/
buildNameList();
updateSpinEnabled();
initializeReels();