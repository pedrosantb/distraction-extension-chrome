(() => {
  let blockDuration = 1 * 60 * 1000; // default 1 minute
  let freeDuration = 5 * 60 * 1000;    // free usage duration
  let timerInterval, remainingTime;
  let overlay;

  // Flags to prevent duplicate creations.
  let overlayLoaded = false;
  let counterCreated = false;
  
  // Read settings (blockDuration, freeDuration) and then check free usage.
  chrome.storage.local.get({ settings: { blockDuration: 1, freeDuration: 5 } }, (data) => {
    const settings = data.settings;
    blockDuration = settings.blockDuration * 60 * 1000;
    freeDuration = settings.freeDuration * 60 * 1000;
    // checkFreeUsageAndMaybeBlock();
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
    // Remove any existing overlay if it exists.
    const existing = document.getElementById("screen-blocker");
    if (existing) {
      existing.remove();
      overlayLoaded = false;
    }

    const hostname = window.location.hostname;
    chrome.storage.local.get({ freeUsageData: {} }, (result) => {
      const freeUsageData = result.freeUsageData || {};
      const freeUntil = freeUsageData[hostname];
      if (freeUntil && freeUntil > Date.now()) {
        // Free usage active – create the floating counter only if it doesn't already exist.
        if (!counterCreated) {
          createFloatingCounter(freeUntil - Date.now());
          counterCreated = true;
        }
        console.log("Free time left: " + formatTime(freeUntil - Date.now()));
        return;
      } else {
        loadOverlay();
      }
    });
  }

  // Load the overlay from external HTML and CSS.
  function loadOverlay() {
    if (overlayLoaded) return; // Prevent duplicate loads.
    // Check if overlay element already exists.
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
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = data;
        overlay = tempDiv.firstElementChild;
        document.body.appendChild(overlay);

        // Automatically apply dark theme based on system preference.
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (systemDark) {
          overlay.classList.add("dark");
        }
          overlayLoaded = true;
          initOverlay();
      });
  }

  let overlayInitialized = false;

  function initOverlay() {

    if (overlayInitialized) {
      console.log("initOverlay already called. Exiting.");
      return;
    }
    
    console.log("initOverlay called at", new Date().toLocaleTimeString());

    overlayInitialized = true;
  
    const timerDisplay = overlay.querySelector("#timer-display");
    const noteContainer = overlay.querySelector("#note-container");
    const noteText = overlay.querySelector("#note-text");
    const noteSubmit = overlay.querySelector("#note-submit");
  
    remainingTime = blockDuration;
    timerDisplay.textContent = formatTime(remainingTime);
  
    let freePeriodStarted = false;
  
    timerInterval = setInterval(() => {
      remainingTime -= 1000;
      timerDisplay.textContent = formatTime(remainingTime);
      if (remainingTime <= 0) {
        clearInterval(timerInterval);
        const currentNote = noteText.value.trim();
        console.log("Note value at expiry:", currentNote);
  
        if (!currentNote && !freePeriodStarted) {
          freePeriodStarted = true;
          console.log("No note entered; starting free period.");
          startFreePeriod();
        } else {
          if (noteSubmit.textContent !== "Send and continue") {
            noteSubmit.textContent = "Send and continue";
          }
        }
      }
    }, 1000);
  
    noteSubmit.addEventListener("click", () => {
      const currentNote = noteText.value.trim();
      if (currentNote) {
        saveNote(currentNote);
        noteText.value = ""
        noteContainer.remove();
        if (noteSubmit.textContent === "Send and continue" && !freePeriodStarted) {
          freePeriodStarted = true;
          noteSubmit.textContent = "Submit Note";
          startFreePeriod();
        } else {
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

  // Save note locally and send note data to background for fetch.
  async function saveNote(noteText) {
    const newNote = {
      time: Date.now(),
      text: noteText,
      app: detectApp().toLowerCase(),
    };

    await chrome.storage.local.get({ notes: [] }, async (result) => {
      const notes = result.notes;
      notes.push(newNote);
      await chrome.storage.local.set({ notes: notes }, async () => {
        chrome.runtime.sendMessage({ action: "saveNote", newNote: newNote }, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Runtime error:", chrome.runtime.lastError.message);
          } else if (response && response.result === "success") {
            console.log("Note sent successfully:", response.data);
          }
        });
        console.log(newNote);
      });
    });
  }

  // Set free usage period, remove the overlay, and create the floating counter.
  function startFreePeriod() {
    const hostname = window.location.hostname;
    chrome.storage.local.get({ freeUsageData: {} }, (result) => {
      const freeUsageData = result.freeUsageData || {};
      freeUsageData[hostname] = Date.now() + freeDuration;
      console.log("Free duration: " + formatTime(freeDuration));
      chrome.storage.local.set({ freeUsageData: freeUsageData }, () => {
        if (overlay) {
          overlay.remove();
          overlayLoaded = false;
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
    
    // Mark that the counter is being created.
    counterCreated = true;
    
    // Inject the floating counter CSS if not already loaded.
    if (!document.querySelector('link[href*="floating-timer.css"]')) {
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
            counterCreated = false;
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
    encouragementDiv.innerHTML = `<div class="success-message"><span class="material-icons" style="color: green;">check_circle</span> <span>Great job! Keep up the focus!</span></div>`;
    const card = overlay.querySelector(".card");
    const existingEncouragement = card.querySelector(".encouragement");
    if (existingEncouragement) {
      existingEncouragement.remove();
    }
    card.appendChild(encouragementDiv);
  }
})();
