(() => {
  // POST URL constant for sending notes (optional).
  // (Not used in the content script anymore.)

  let blockDuration = 1 * 60 * 1000; // default 1 minute
  let freeDuration = 5 * 60 * 1000;    // free usage duration
  let timerInterval, remainingTime;
  let overlay;

  // Read settings (blockDuration, freeDuration) and then check free usage.
  chrome.storage.local.get({ settings: { blockDuration: 1, freeDuration: 5 } }, (data) => {
    const settings = data.settings;
    blockDuration = settings.blockDuration * 60 * 1000;
    freeDuration = settings.freeDuration * 60 * 1000;
    checkFreeUsageAndMaybeBlock();
  });

  // Listen for messages (e.g. from background).
  chrome.runtime.onMessage.addListener((obj, sender, response) => {
    if (obj.action === "startTimer") {
      checkFreeUsageAndMaybeBlock();
    }
    if (obj.action === "saveNote" && obj.noteText) {
      saveNote(obj.noteText);
    }
  });

  // Check if free usage period is active.
function checkFreeUsageAndMaybeBlock() {
  // Remove any existing overlay.
  let existing = document.getElementById("screen-blocker");
  if (existing) {
    existing.remove();
  }
  
  const hostname = window.location.hostname;
  chrome.storage.local.get({ freeUsageData: {} }, (result) => {
    const freeUsageData = result.freeUsageData || {};
    const freeUntil = freeUsageData[hostname];
    if (freeUntil && freeUntil > Date.now()) {
      // Free usage active – create the floating counter only if it doesn't already exist.
      if (!document.getElementById("free-time-timer")) {
        createFloatingCounter(freeUntil - Date.now());
      }
      console.log(formatTime(freeUntil - Date.now()));
      return;
    } else {
      loadOverlay();
    }
  });
}

  // Load the overlay from external HTML and CSS.
  function loadOverlay() {
    // Make sure there is no previous overlay.
    if (document.getElementById("screen-blocker")) return;

    // Inject local Material Icons stylesheet.
    if (!document.querySelector('link[href*="assets/material-icons.css"]')) {
      const iconLink = document.createElement("link");
      iconLink.href = chrome.runtime.getURL("assets/material-icons.css");
      iconLink.rel = "stylesheet";
      document.head.appendChild(iconLink);
    }

    // Inject overlay.css.
    const link = document.createElement("link");
    link.href = chrome.runtime.getURL("overlay.css");
    link.type = "text/css";
    link.rel = "stylesheet";
    document.head.appendChild(link);

    // Fetch overlay.html.
    fetch(chrome.runtime.getURL("overlay.html"))
      .then(response => response.text())
      .then(data => {
        // Remove any existing overlay first.
        const existingOverlay = document.getElementById("screen-blocker");
        if (existingOverlay) {
          existingOverlay.remove();
        }
        
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data;
        overlay = tempDiv.firstElementChild;
        document.body.appendChild(overlay);

        // Automatically apply dark theme based on system preference.
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemDark) {
          overlay.classList.add("dark");
        }

        initOverlay();
      });
  }

  // Initialize the overlay: set up the timer and note submission.
  function initOverlay() {
    const timerDisplay = overlay.querySelector("#timer-display");
    const noteContainer = overlay.querySelector("#note-container");
    const noteText = overlay.querySelector("#note-text");
    const noteSubmit = overlay.querySelector("#note-submit");

    remainingTime = blockDuration;
    timerDisplay.textContent = formatTime(remainingTime);

    timerInterval = setInterval(() => {
      remainingTime -= 1000;
      timerDisplay.textContent = formatTime(remainingTime);
      if (remainingTime <= 0) {
        clearInterval(timerInterval);

        if (noteText.value.trim() === "") {
          startFreePeriod();
        } else {
          console.log(noteSubmit.textContent);
          console.log(noteText.value.trim());
          noteSubmit.textContent = "Send and continue"
        }
      }
    }, 1000);

    noteSubmit.addEventListener("click", () => {
      if (noteText.value.trim()) {
        saveNote(noteText.value.trim());
        noteContainer.remove();
        if(noteSubmit.textContent === "Send and continue"){
          noteSubmit.textContent = "Submit Note";
          startFreePeriod();
        } else{
          showEncouragement();
        }
      }
    });
  }

  // Format milliseconds as mm:ss.
  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  // Detect current app based on the hostname.
  function detectApp() {
    const hostname = window.location.hostname.toLowerCase();
    if (hostname.includes("youtube")) return "YouTube";
    if (hostname.includes("instagram")) return "Instagram";
    if (hostname.includes("facebook")) return "Facebook";
    if (hostname.includes("linkedin")) return "LinkedIn";
    if (hostname.includes("pinterest")) return "Pinterest";
    if (hostname.includes("vk")) return "VK";
    if (hostname.includes("tiktok")) return "TikTok";
    return "Unknown";
  }

  // Save note locally and send the note data to the background script to perform the fetch.
  async function saveNote(noteText) {
    const newNote = {
      time: Date.now(), // Using numeric timestamp
      text: noteText,
      app: detectApp().toLowerCase(),
    };
  
    await chrome.storage.local.get({ notes: [] }, async (result) => {
      const notes = result.notes;
      notes.push(newNote);
      await chrome.storage.local.set({ notes: notes }, async () => {
        // Instead of performing fetch from the content script,
        // send a message to the background script to perform the fetch.
        chrome.runtime.sendMessage({ action: "saveNote", newNote: newNote }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError.message);
          } else if (response && response.result === "success") {
            console.log("Note sent successfully:", response.data);
          }
        });
      });
    });
  }
  
  // Set free usage period, remove the overlay, and create the floating counter.
  function startFreePeriod() {
    const hostname = window.location.hostname;
    chrome.storage.local.get({ freeUsageData: {} }, (result) => {
      // Ensure freeUsageData is an object.
      const freeUsageData = result.freeUsageData || {};
      freeUsageData[hostname] = Date.now() + freeDuration;
      console.log(formatTime(freeDuration));
      chrome.storage.local.set({ freeUsageData: freeUsageData }, () => {
        if (overlay) {
          overlay.remove();
        }
        // After the overlay is removed, create the floating counter.
        createFloatingCounter(freeDuration);
      });
    });
  }

  // Create a floating counter using external HTML and CSS.
  function createFloatingCounter(initialTime) {
    // Remove any existing counter.
    let existingCounter = document.getElementById("free-time-counter");
    if (existingCounter) {
      existingCounter.remove();
    }
    
    // Inject the floating counter CSS if not already loaded.
    if (!document.querySelector('link[href*="assets/floating-timer.css"]')) {
      const counterLink = document.createElement("link");
      counterLink.href = chrome.runtime.getURL("floating-timer.css");
      counterLink.rel = "stylesheet";
      document.head.appendChild(counterLink);
    }
    
    // Load the external floating counter HTML.
    fetch(chrome.runtime.getURL("floating-timer.html"))
      .then(response => response.text())
      .then(html => {
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        const counterElement = tempDiv.firstElementChild;
        document.body.appendChild(counterElement);
        
        const freeTimeEnd = Date.now() + initialTime;
        const counterInterval = setInterval(() => {
          const remaining = freeTimeEnd - Date.now();
          if (remaining <= 0) {
            clearInterval(counterInterval);
            counterElement.remove();
          } else {
            const freeTimeText = counterElement.querySelector("#free-time-text");
            freeTimeText.textContent = `Free time left: ${formatTime(remaining)}`;
          }
        }, 1000);
      });
  }

  // Display an encouraging message with a green check icon.
  function showEncouragement() {
    const encouragementDiv = document.createElement("div");
    encouragementDiv.classList.add("encouragement");
    // Use the Material Icon "check_circle" in green.
    encouragementDiv.innerHTML = `<div class="success-message"><span class="material-icons" style="color: green;">check_circle</span> <span>Great job! Keep up the focus!</span></div>`;
    const card = overlay.querySelector(".card");
    const existingEncouragement = card.querySelector(".encouragement");
    if (existingEncouragement) {
      existingEncouragement.remove();
    }
    card.appendChild(encouragementDiv);
  }
  
})();
