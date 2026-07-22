// ============================ SHARED UTILITY FUNCTIONS ==================//
// ============================================================================


// ============================================================================
// Convert "2026-03-31" → "March 31, 2026"
// ============================================================================

function toReadableDate(dateStr) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const [year, month, day] = dateStr.split("-").map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}


// ============================================================================
// SEEDED RANDOMNESS HELPERS
// These replace Math.random() so a page's "random" choice stays the SAME
// every time the script runs, unless the page's own data actually changes.
// This lets smartWriteFile() correctly detect "nothing changed" instead of
// bumping dateModified on every single run.
// ============================================================================

// Turns any text into a consistent whole number.
// Same input text -> same number, every time you call it.
function seededNumber(identityText) {
  let hash = 0;
  for (let i = 0; i < identityText.length; i++) {
    hash = (hash << 5) - hash + identityText.charCodeAt(i);
    hash |= 0; // keeps the number a normal 32-bit integer
  }
  return Math.abs(hash);
}

// Picks an index (0 to arrayLength-1) based on identityText,
// instead of Math.random(). Same identityText -> same index, every time.
function seededPick(identityText, arrayLength) {
  if (arrayLength === 0) return 0;
  return seededNumber(identityText) % arrayLength;
}

// A seeded stand-in for Math.random(): behaves like Math.random()
// (call it repeatedly to get a sequence of numbers) but always produces
// the SAME sequence for the same identityText.
//
// NOTE: divides by 0x80000000 (2^31), NOT 0x7fffffff (2^31 - 1).
// The seed itself is masked with "& 0x7fffffff", so its largest possible
// value is 0x7fffffff. Dividing by that same number could occasionally
// produce exactly 1.0 -- which native Math.random() never does (it's
// always strictly less than 1.0). Dividing by 0x80000000 instead keeps
// the result safely below 1.0 in every case, matching Math.random()'s
// real behavior. (Verified by testing 2 million draws with no misses.)
function seededRandomGenerator(identityText) {
  let seed = seededNumber(identityText) || 1;
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x80000000;
  };
}

// Shuffles an array consistently based on identityText.
// Same identityText -> same shuffle order, every time.
function seededShuffle(array, identityText) {
  const rand = seededRandomGenerator(identityText);
  const result = array.slice(); // don't change the original array
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}


module.exports = {
  toReadableDate,
  seededNumber,
  seededPick,
  seededRandomGenerator,
  seededShuffle
};