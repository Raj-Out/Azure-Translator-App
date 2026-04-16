const elements = {
  body: document.body,
  themeToggle: document.getElementById("themeToggle"),
  themeLabel: document.getElementById("themeLabel"),
  subscriptionKey: document.getElementById("subscriptionKey"),
  region: document.getElementById("region"),
  endpoint: document.getElementById("endpoint"),
  saveSettings: document.getElementById("saveSettings"),
  fromLanguage: document.getElementById("fromLanguage"),
  toLanguage: document.getElementById("toLanguage"),
  swapLanguages: document.getElementById("swapLanguages"),
  sourceText: document.getElementById("sourceText"),
  translatedText: document.getElementById("translatedText"),
  charCount: document.getElementById("charCount"),
  copyTranslation: document.getElementById("copyTranslation"),
  statusMessage: document.getElementById("statusMessage"),
  authHelp: document.getElementById("authHelp"),
  translateButton: document.getElementById("translateButton")
};

const STORAGE_KEYS = {
  theme: "azureTranslator.theme",
  key: "azureTranslator.key",
  region: "azureTranslator.region",
  endpoint: "azureTranslator.endpoint"
};

function setStatus(message, type = "normal") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.dataset.type = type;
  elements.authHelp.hidden = type !== "auth";
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  elements.body.classList.toggle("dark", isDark);
  elements.themeLabel.textContent = isDark ? "Light mode" : "Dark mode";
  localStorage.setItem(STORAGE_KEYS.theme, theme);
}

function loadSavedPreferences() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.theme) || "light";
  applyTheme(savedTheme);

  elements.subscriptionKey.value = localStorage.getItem(STORAGE_KEYS.key) || "";
  elements.region.value = localStorage.getItem(STORAGE_KEYS.region) || "";
  elements.endpoint.value =
    localStorage.getItem(STORAGE_KEYS.endpoint) ||
    "https://api.cognitive.microsofttranslator.com";
}

function saveSettings() {
  localStorage.setItem(STORAGE_KEYS.key, elements.subscriptionKey.value.trim());
  localStorage.setItem(STORAGE_KEYS.region, elements.region.value.trim());
  localStorage.setItem(STORAGE_KEYS.endpoint, elements.endpoint.value.trim());
  setStatus("Settings saved in this browser.");
}

function updateCharacterCount() {
  elements.charCount.textContent = `${elements.sourceText.value.length} / 5000`;
}

function buildTranslateUrl() {
  const endpoint = elements.endpoint.value.trim().replace(/\/$/, "");
  const params = new URLSearchParams({
    "api-version": "3.0",
    to: elements.toLanguage.value
  });

  if (elements.fromLanguage.value) {
    params.set("from", elements.fromLanguage.value);
  }

  return `${endpoint}/translate?${params.toString()}`;
}

async function translateText() {
  const key = elements.subscriptionKey.value.trim();
  const region = elements.region.value.trim();
  const text = elements.sourceText.value.trim();

  if (!key) {
    setStatus("Add your Azure key first.", "error");
    return;
  }

  if (!text) {
    setStatus("Type something to translate.", "error");
    return;
  }

  elements.translateButton.disabled = true;
  elements.translateButton.textContent = "Translating...";
  setStatus("Sending text to Azure Translator...");

  try {
    const headers = {
      "Ocp-Apim-Subscription-Key": key,
      "Content-Type": "application/json"
    };

    if (region && region.toLowerCase() !== "global") {
      headers["Ocp-Apim-Subscription-Region"] = region;
    }

    const response = await fetch(buildTranslateUrl(), {
      method: "POST",
      headers,
      body: JSON.stringify([{ text }])
    });

    if (!response.ok) {
      const details = await getAzureErrorMessage(response);
      throw new Error(details);
    }

    const data = await response.json();
    const translated = data?.[0]?.translations?.[0]?.text || "";
    elements.translatedText.value = translated;
    setStatus("Translation complete.");
  } catch (error) {
    elements.translatedText.value = "";
    const isAuthError = error.message.includes("401001") || error.message.includes("401000");
    setStatus(`Translation failed: ${error.message}`, isAuthError ? "auth" : "error");
  } finally {
    elements.translateButton.disabled = false;
    elements.translateButton.textContent = "Translate";
  }
}

async function getAzureErrorMessage(response) {
  const fallback = `Request failed with status ${response.status}`;
  const raw = await response.text();

  try {
    const payload = JSON.parse(raw);
    const code = payload?.error?.code;
    const message = payload?.error?.message;

    if (code && message) {
      return `${code}: ${message}`;
    }

    return message || fallback;
  } catch {
    return raw || fallback;
  }
}

function swapLanguages() {
  if (!elements.fromLanguage.value) {
    setStatus("Choose a source language before swapping.");
    return;
  }

  const from = elements.fromLanguage.value;
  elements.fromLanguage.value = elements.toLanguage.value;
  elements.toLanguage.value = from;

  const source = elements.sourceText.value;
  elements.sourceText.value = elements.translatedText.value;
  elements.translatedText.value = source;
  updateCharacterCount();
}

async function copyTranslation() {
  if (!elements.translatedText.value) {
    setStatus("There is no translation to copy yet.");
    return;
  }

  try {
    await navigator.clipboard.writeText(elements.translatedText.value);
    setStatus("Translation copied.");
  } catch {
    elements.translatedText.select();
    document.execCommand("copy");
    setStatus("Translation copied.");
  }
}

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = elements.body.classList.contains("dark") ? "light" : "dark";
  applyTheme(nextTheme);
});

elements.saveSettings.addEventListener("click", saveSettings);
elements.translateButton.addEventListener("click", translateText);
elements.swapLanguages.addEventListener("click", swapLanguages);
elements.copyTranslation.addEventListener("click", copyTranslation);
elements.sourceText.addEventListener("input", updateCharacterCount);

elements.sourceText.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    translateText();
  }
});

loadSavedPreferences();
updateCharacterCount();
