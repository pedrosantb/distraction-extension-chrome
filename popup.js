document.addEventListener("DOMContentLoaded", function () {
    // Automatically set dark mode based on system settings.
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(systemDark) {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    
    // Load settings (blockDuration and freeDuration) from chrome.storage.
    chrome.storage.local.get(
      { settings: { blockDuration: 1, freeDuration: 5 } },
      function (data) {
        const settings = data.settings;
        document.getElementById("blockDuration").value = settings.blockDuration;
        document.getElementById("freeDuration").value = settings.freeDuration;
        document.getElementById("blockDurationValue").textContent = settings.blockDuration;
        document.getElementById("freeDurationValue").textContent = settings.freeDuration;
      }
    );
  
    // Update slider values as they change.
    document.getElementById("blockDuration").addEventListener("input", function (e) {
      document.getElementById("blockDurationValue").textContent = e.target.value;
    });
    document.getElementById("freeDuration").addEventListener("input", function (e) {
      document.getElementById("freeDurationValue").textContent = e.target.value;
    });
  
    // Save settings.
    document.getElementById("saveSettings").addEventListener("click", function () {
      const settings = {
        blockDuration: parseInt(document.getElementById("blockDuration").value),
        freeDuration: parseInt(document.getElementById("freeDuration").value),
      };
      chrome.storage.local.set({ settings: settings }, function () {
        alert("Settings saved!");
      });
    });
  
    // Helper: Format timestamp as dd/MM HH:mm.
    function formatTimestamp(timestamp) {
      const d = new Date(timestamp);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${day}/${month} ${hours}:${minutes}`;
    }
  
    // Map apps to badge colors.
    const appColors = {
      youtube: "#ff0000",
      instagram: "#c13584",
      facebook: "#4267b2",
      linkedin: "#0077b5",
      pinterest: "#bd081c",
      vk: "#4c75a3",
      tiktok: "#69c9d0",
      unknown: "#757575"
    };
    
  
    // Load saved notes and display them vertically.
    chrome.storage.local.get({ notes: [] }, function (result) {
      const notesContainer = document.getElementById("notes");
      notesContainer.innerHTML = "";
      result.notes.forEach((note) => {
        const noteCard = document.createElement("div");
        noteCard.classList.add("note-card");
        // Create timestamp and text.
        const textDiv = document.createElement("div");
        textDiv.classList.add("text-div")
        textDiv.textContent = `${formatTimestamp(note.time)} - ${note.text}`;
        // Create app badge.
        const badge = document.createElement("span");
        badge.classList.add("app-badge");
        badge.textContent = note.app;
        badge.style.backgroundColor = appColors[note.app] || appColors.Unknown;
        // Append text and badge.
        noteCard.appendChild(textDiv);
        noteCard.appendChild(badge);
        notesContainer.appendChild(noteCard);
      });
    });
  });
  