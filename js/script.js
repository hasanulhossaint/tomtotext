document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const uploaderView = document.getElementById('uploader');
    const processingView = document.getElementById('processing');
    const resultView = document.getElementById('result');

    const dropZone = document.getElementById('dropZone');
    const imageInput = document.getElementById('imageInput');
    const languageSelect = document.getElementById('languageSelect');
    
    const imagePreview = document.getElementById('imagePreview');
    const statusText = document.getElementById('statusText');
    const progressBar = document.getElementById('progressBar');

    const outputText = document.getElementById('outputText');
    const copyButton = document.getElementById('copyButton');
    const charCount = document.getElementById('charCount');
    const wordCount = document.getElementById('wordCount');
    const startOverButton = document.getElementById('startOverButton');
    
    const themeToggle = document.getElementById('themeToggle');
    const translationBox = document.getElementById('translationBox');
    const translationOutput = document.getElementById('translationOutput');

    // --- UI State Management ---
    function switchView(viewToShow) {
        [uploaderView, processingView, resultView].forEach(view => {
            view.classList.add('hidden');
        });
        viewToShow.classList.remove('hidden');
    }

    function showUploader() {
        switchView(uploaderView);
        imageInput.value = ''; // Reset file input for re-uploads
        translationBox.classList.add('hidden'); // Hide translation box on reset
    }

    // --- Dark Mode Logic ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
            themeToggle.checked = true;
        } else {
            document.body.classList.remove('dark-mode');
            themeToggle.checked = false;
        }
    }

    themeToggle.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // Check for saved theme on initial load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);


    // --- File Input and Drag & Drop ---
    dropZone.addEventListener('click', () => imageInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    ['dragleave', 'dragend'].forEach(type => {
        dropZone.addEventListener(type, () => {
            dropZone.classList.remove('drag-over');
        });
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length) {
            handleFile(files[0]);
        }
    });

    imageInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    // --- Paste from Clipboard ---
    window.addEventListener('paste', (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                const imageFile = item.getAsFile();
                handleFile(imageFile);
                break;
            }
        }
    });

    // --- Core OCR & Translation Logic ---
    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert("Please select a valid image file.");
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;
        };
        reader.readAsDataURL(file);

        recognizeText(file);
    }

    async function recognizeText(file) {
        switchView(processingView);
        statusText.textContent = 'Initializing Tesseract...';
        progressBar.style.width = '0%';

        const selectedLang = languageSelect.value;

        const worker = await Tesseract.createWorker(selectedLang, 1, {
            // Tells Tesseract where to download language files from.
            langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.round(m.progress * 100);
                    progressBar.style.width = `${progress}%`;
                    statusText.textContent = `Recognizing... ${progress}%`;
                } else if (m.status === 'downloading') {
                    statusText.textContent = `Downloading language data...`;
                }
                 else {
                    // Capitalize the first letter of the status
                    statusText.textContent = m.status.charAt(0).toUpperCase() + m.status.slice(1);
                }
            },
        });
        
        try {
            const { data: { text } } = await worker.recognize(file);
            outputText.value = text;
            updateStats(text);
            
            if (selectedLang === 'ben' && text.trim().length > 0) {
                await translateText(text); // Await the translation
            }
            
            switchView(resultView);
        } catch (error) {
            console.error(error);
            statusText.textContent = 'Error during recognition.';
            alert('An error occurred. Please try again.');
            showUploader();
        } finally {
            await worker.terminate();
        }
    }

    async function translateText(textToTranslate) {
        translationBox.classList.remove('hidden');
        translationOutput.textContent = 'Translating...';

        try {
            // IMPORTANT: This fetch request must go to YOUR backend server, not directly to Google.
            const response = await fetch('http://localhost:3000/translate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    text: textToTranslate,
                    targetLang: 'en'
                }),
            });

            if (!response.ok) {
                throw new Error(`Server error: ${response.statusText}`);
            }

            const data = await response.json();
            translationOutput.textContent = data.translatedText;
        } catch (error) {
            console.error("Translation Error:", error);
            translationOutput.textContent = "Translation service is unavailable. Make sure your local server is running.";
        }
    }

    // --- Result View Logic ---
    function updateStats(text) {
        const charLength = text.length;
        const wordLength = text.trim() ? text.trim().split(/\s+/).length : 0;
        
        charCount.textContent = `Characters: ${charLength}`;
        wordCount.textContent = `Words: ${wordLength}`;
    }

    copyButton.addEventListener('click', () => {
        navigator.clipboard.writeText(outputText.value).then(() => {
            const originalIcon = copyButton.innerHTML;
            copyButton.innerHTML = `✓`;
            copyButton.title = "Copied!";
            setTimeout(() => {
                copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
                copyButton.title = "Copy to Clipboard";
            }, 2000);
        });
    });

    startOverButton.addEventListener('click', showUploader);

    // --- Initial State ---
    showUploader();
});
