// ==========================================================================
// AI-Powered ATS Resume Checker - Core Frontend Logic
// ==========================================================================

// API endpoint — calls our Vercel serverless proxy (no API key in the browser)
const GEMINI_PROXY_URL = '/api/gemini';

// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const fileInput = document.getElementById('resumeFile');
const fileDropArea = document.getElementById('fileDropArea');
const selectedFileInfo = document.getElementById('selectedFileInfo');
const fileNameDisplay = document.getElementById('fileNameText');
const fileSizeDisplay = document.getElementById('fileSizeText');
const removeFileBtn = document.getElementById('removeFileBtn');
const jobDescriptionInput = document.getElementById('jobDescription');
const charCountDisplay = document.getElementById('charCount');
const clearTextBtn = document.getElementById('clearTextBtn');
const atsForm = document.getElementById('atsForm');
const submitBtn = document.getElementById('submitBtn');
const submitBtnText = document.getElementById('submitBtnText');
const submitBtnSpinner = document.getElementById('submitBtnSpinner');
const errorBanner = document.getElementById('errorBanner');
const resultContainer = document.getElementById('result');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNavOverlay = document.getElementById('mobileNavOverlay');

// --- Theme Toggle Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    themeToggleBtn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
}

if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

initTheme();

// --- Mobile Navigation Drawer ---
if (mobileMenuBtn && mobileNavOverlay) {
    mobileMenuBtn.addEventListener('click', () => {
        mobileNavOverlay.classList.toggle('active');
    });

    mobileNavOverlay.addEventListener('click', (e) => {
        if (e.target === mobileNavOverlay) {
            mobileNavOverlay.classList.remove('active');
        }
    });
}

// --- Drag & Drop File Upload Handlers ---
if (fileDropArea && fileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropArea.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        fileDropArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileDropArea.classList.remove('dragover');
        });
    });

    fileDropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            if (files[0].type === 'application/pdf' || files[0].name.endsWith('.pdf')) {
                fileInput.files = files;
                updateFileSelectionUI(files[0]);
            } else {
                showError('Please upload a valid PDF file.');
            }
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            updateFileSelectionUI(fileInput.files[0]);
        } else {
            resetFileSelectionUI();
        }
    });
}

function updateFileSelectionUI(file) {
    fileDropArea.classList.add('has-file');
    if (selectedFileInfo) {
        selectedFileInfo.style.display = 'flex';
        fileNameDisplay.textContent = file.name;
        const sizeFormatted = file.size > 1024 * 1024 
            ? (file.size / (1024 * 1024)).toFixed(2) + ' MB' 
            : Math.round(file.size / 1024) + ' KB';
        fileSizeDisplay.textContent = sizeFormatted;
    }
}

function resetFileSelectionUI() {
    fileInput.value = '';
    fileDropArea.classList.remove('has-file');
    if (selectedFileInfo) {
        selectedFileInfo.style.display = 'none';
    }
}

if (removeFileBtn) {
    removeFileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        resetFileSelectionUI();
    });
}

// --- Character Counter for Job Description ---
if (jobDescriptionInput && charCountDisplay) {
    jobDescriptionInput.addEventListener('input', () => {
        const count = jobDescriptionInput.value.length;
        charCountDisplay.textContent = `${count} characters`;
    });
}

if (clearTextBtn && jobDescriptionInput) {
    clearTextBtn.addEventListener('click', () => {
        jobDescriptionInput.value = '';
        if (charCountDisplay) charCountDisplay.textContent = '0 characters';
    });
}

// --- FAQ Accordions ---
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        item.classList.toggle('active');
    });
});

// --- Error Banner Display ---
function showError(message) {
    if (!errorBanner) return;
    errorBanner.textContent = '⚠️ ' + message;
    errorBanner.style.display = 'block';
    errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function hideError() {
    if (errorBanner) errorBanner.style.display = 'none';
}

// --- PDF Text Extraction ---
async function extractTextFromPDF(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let text = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n';
        }

        if (!text.trim()) {
            throw new Error('Could not extract text from the PDF. It may be an image-based/scanned PDF. Please try a text-based PDF.');
        }

        return text;
    } catch (error) {
        if (error.message.includes('Invalid PDF')) {
            throw new Error('The uploaded file is not a valid PDF. Please upload a proper PDF file.');
        }
        throw error;
    }
}

// --- Keyword Extraction Engine ---
function extractKeywords(text) {
    const lowerText = text.toLowerCase();

    // Common tech phrases
    const techPhrases = [
        'machine learning', 'deep learning', 'data science', 'data analysis',
        'project management', 'software development', 'web development',
        'cloud computing', 'artificial intelligence', 'natural language processing',
        'computer vision', 'data engineering', 'full stack', 'front end', 'back end',
        'user experience', 'user interface', 'version control', 'continuous integration',
        'continuous deployment', 'agile methodology', 'scrum master',
        'product management', 'business intelligence', 'data visualization',
        'quality assurance', 'test automation', 'devops engineer',
        'system design', 'distributed systems', 'microservices architecture',
        'rest api', 'api development', 'mobile development', 'cross platform',
        'object oriented', 'design patterns', 'problem solving',
        'team leadership', 'stakeholder management', 'risk management'
    ];

    // Single words
    const words = lowerText.match(/\b[a-z]{3,}\b/g) || [];

    // Acronyms
    const acronyms = text.match(/\b[A-Z][A-Z\/\+\#\.]+\b/g) || [];
    const acronymsLower = acronyms.map(a => a.toLowerCase());

    // Special terms (Node.js, C++, C#, CI/CD)
    const specialTerms = lowerText.match(/\b[a-z]+[.#+\/][a-z+#]*\b/g) || [];

    const stopWords = new Set([
        'the', 'and', 'for', 'with', 'this', 'that', 'from', 'have', 'will',
        'are', 'was', 'were', 'been', 'has', 'had', 'can', 'could', 'would',
        'should', 'may', 'might', 'must', 'our', 'your', 'their', 'into',
        'through', 'during', 'before', 'after', 'above', 'below', 'between',
        'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
        'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
        'most', 'other', 'some', 'such', 'than', 'too', 'very', 'just', 'about',
        'also', 'not', 'only', 'own', 'same', 'them', 'which', 'who', 'whom',
        'what', 'these', 'those', 'does', 'did', 'doing', 'being', 'having',
        'its', 'let', 'but', 'nor', 'yet', 'she', 'her', 'his', 'him',
        'they', 'you', 'any', 'able', 'etc', 'including', 'well', 'within',
        'using', 'used', 'use', 'work', 'working', 'worked', 'works'
    ]);

    const filtered = words.filter(w => !stopWords.has(w));
    const foundPhrases = techPhrases.filter(phrase => lowerText.includes(phrase));

    return [...filtered, ...acronymsLower, ...specialTerms, ...foundPhrases];
}

function analyzeResume(resumeText, jobDescription) {
    const resumeKeywordsArray = extractKeywords(resumeText);
    const resumeKeywords = new Set(resumeKeywordsArray);
    const jdKeywords = extractKeywords(jobDescription);
    const jdKeywordSet = new Set(jdKeywords);

    const keywordCount = {};
    jdKeywords.forEach(k => {
        keywordCount[k] = (keywordCount[k] || 0) + 1;
    });

    const missing = Object.entries(keywordCount)
        .filter(([k]) => !resumeKeywords.has(k))
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => ({ keyword: k, count: v }));

    const matched = [...resumeKeywords].filter(k => jdKeywordSet.has(k));
    const score = jdKeywordSet.size > 0 ? (matched.length / jdKeywordSet.size) * 100 : 0;

    return {
        score: Math.min(score, 100),
        totalKeywords: jdKeywordSet.size,
        matchedKeywords: matched,
        missingKeywords: missing
    };
}

// --- Gemini AI via Secure Server Proxy ---
async function callGeminiAI(resumeText, jobDescription, score, missingKeywords) {
    const prompt = `You are an expert ATS Optimization Coach & Resume Strategist. Analyze this candidate's resume against the job description.

RESUME TEXT:
${resumeText.substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription}

CURRENT ATS MATCH SCORE: ${score.toFixed(1)}%
TOP MISSING KEYWORDS: ${missingKeywords.slice(0, 15).map(k => k.keyword).join(', ')}

Provide a comprehensive, professional analysis report containing:
1. Executive Overall Match Assessment (2-3 clear sentences)
2. Bullet Point Rewrite Generator (Provide 3-4 specific rewritten bullet points tailored to this job using strong action verbs & quantifiable metrics)
3. Cover Letter Match Strategy (3 actionable tips for introducing these key skills in a cover letter)
4. Keyword Integration Guide (How to place missing technical keywords naturally into Work Experience, Skills, or Project sections)
5. Critical Resume Section Fixes (Formatting, headings, or structural improvements)

Format your response cleanly using bold headings and bullet points.`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const response = await fetch(GEMINI_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({ prompt })
        });

        clearTimeout(timeoutId);
        const data = await response.json();

        if (response.ok && data.text) {
            return data.text;
        }

        return `❌ ${data.error || 'Unknown error from AI proxy.'}`;
    } catch (error) {
        if (error.name === 'AbortError') {
            return '⚠️ AI analysis timed out. Please try again.';
        }
        return `⚠️ Could not reach AI service: ${error.message}`;
    }
}

// --- Format AI Markdown Output ---
function formatAIResponse(text) {
    if (!text) return '';
    let formatted = text
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h3>$1</h3>')
        .replace(/^# (.*$)/gim, '<h3>$1</h3>')
        .replace(/^\* (.*$)/gim, '<li>$1</li>')
        .replace(/^- (.*$)/gim, '<li>$1</li>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    if (formatted.includes('<li>')) {
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    }
    return formatted;
}

// --- Animate Progress SVG Ring ---
function animateScoreGauge(targetScore) {
    const circle = document.getElementById('scoreProgressCircle');
    const scoreNum = document.getElementById('scoreNumber');
    if (!circle || !scoreNum) return;

    const circumference = 439.8; // 2 * PI * r (r=70)
    const offset = circumference - (targetScore / 100) * circumference;
    
    // Animate number count up
    let currentScore = 0;
    const duration = 1200;
    const startTime = performance.now();

    function updateScore(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        currentScore = Math.floor(progress * targetScore);
        scoreNum.textContent = currentScore;
        
        if (progress < 1) {
            requestAnimationFrame(updateScore);
        } else {
            scoreNum.textContent = targetScore.toFixed(0);
        }
    }

    circle.style.strokeDashoffset = offset;
    requestAnimationFrame(updateScore);
}

// --- Form Submission Handler ---
if (atsForm) {
    atsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideError();

        const fileInputEl = document.getElementById('resumeFile');
        const jobDescription = jobDescriptionInput.value.trim();


        if (!fileInputEl.files[0]) {
            showError('Please upload a PDF resume file.');
            return;
        }

        if (!jobDescription) {
            showError('Please paste the job description.');
            return;
        }

        // Set Loading State
        submitBtn.disabled = true;
        submitBtnSpinner.style.display = 'block';
        submitBtnText.textContent = 'Extracting resume text...';

        try {
            // 1. Extract text from PDF
            const resumeText = await extractTextFromPDF(fileInputEl.files[0]);

            // 2. Analyze keywords & ATS Score
            submitBtnText.textContent = 'Analyzing keywords...';
            const analysis = analyzeResume(resumeText, jobDescription);

            // 3. Render Scores
            const matchScore = Math.min(analysis.score, 100);
            
            // Set match level badge
            const badgeEl = document.getElementById('scoreMatchBadge');
            badgeEl.className = 'score-match-badge';
            if (matchScore >= 70) {
                badgeEl.textContent = '✅ Excellent Match';
                badgeEl.classList.add('excellent');
            } else if (matchScore >= 50) {
                badgeEl.textContent = '⚡ Good Match';
                badgeEl.classList.add('good');
            } else {
                badgeEl.textContent = '⚠️ Needs Improvement';
                badgeEl.classList.add('low');
            }

            // Stats update
            document.getElementById('totalKeywordsVal').textContent = analysis.totalKeywords;
            document.getElementById('matchedKeywordsVal').textContent = analysis.matchedKeywords.length;
            document.getElementById('missingKeywordsVal').textContent = analysis.missingKeywords.length;

            // Render matched keywords badges
            const matchedContainer = document.getElementById('matchedKeywordsBadges');
            if (matchedContainer) {
                if (analysis.matchedKeywords.length > 0) {
                    matchedContainer.innerHTML = analysis.matchedKeywords.slice(0, 20).map(k => 
                        `<span class="tag-matched">✓ ${k}</span>`
                    ).join('');
                } else {
                    matchedContainer.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">No matching keywords found</span>';
                }
            }

            // Render missing keywords badges
            const missingContainer = document.getElementById('suggestedKeywordsBadges');
            if (missingContainer) {
                const topMissing = analysis.missingKeywords.slice(0, 25);
                if (topMissing.length > 0) {
                    missingContainer.innerHTML = topMissing.map(m => 
                        `<span class="badge-missing-item">+ ${m.keyword} ${m.count > 1 ? '<span class="freq">(' + m.count + 'x)</span>' : ''}</span>`
                    ).join('');
                } else {
                    missingContainer.innerHTML = '<span style="color:var(--green-success); font-weight:600; font-size:13px;">🎉 Great job! Resume matches all target keywords.</span>';
                }
            }

            // 4. Get Gemini AI Suggestions
            submitBtnText.textContent = 'Getting AI Analysis...';
            const aiSuggestionsEl = document.getElementById('aiSuggestionsContent');
            const aiRaw = await callGeminiAI(resumeText, jobDescription, matchScore, analysis.missingKeywords);
            aiSuggestionsEl.innerHTML = formatAIResponse(aiRaw);

            // Reveal Results Dashboard & Animate Gauge
            resultContainer.style.display = 'block';
            animateScoreGauge(matchScore);
            resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        } catch (error) {
            showError(error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtnSpinner.style.display = 'none';
            submitBtnText.textContent = '✦ Analyze with AI';
        }
    });
}

// --- Export PDF Report Handler ---
const exportReportBtn = document.getElementById('exportReportBtn');
if (exportReportBtn) {
    exportReportBtn.addEventListener('click', () => {
        window.print();
    });
}

