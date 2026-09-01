const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/test_3cIeVeeVz4yOaV345cgEg00h";

let quizDataPool = [];
let quizActiveIndex = 0;
let userAnswersTrack = [];

function redirectToStripe() {
    window.location.href = STRIPE_PAYMENT_LINK;
}

// Global trigger for manual button clicks
async function triggerClerkSignIn() {
    if (window.Clerk) {
        if (!window.Clerk.loaded) {
            await window.Clerk.load();
        }
        window.Clerk.openSignIn();
    } else {
        alert("Authentication engine is still loading. Please wait a second and try again.");
    }
}

window.addEventListener('load', async () => {
    // Wait for the Clerk script to attach to window
    let attempts = 0;
    while (!window.Clerk && attempts < 30) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (!window.Clerk) {
        console.error("Clerk SDK failed to load from CDN.");
        return;
    }

    // Initialize Clerk if not already loaded
    if (!window.Clerk.loaded) {
        await window.Clerk.load();
    }

    if (window.Clerk.user) {
        const isPaidMember = window.Clerk.user.publicMetadata?.isPaid === true;

        if (isPaidMember) {
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('paywall-container').style.display = 'none';
            document.getElementById('app-container').style.display = 'block';

            window.Clerk.mountUserButton(document.getElementById('user-button'));
            bootUpQuizEngine();
        } else {
            // Signed in but unpaid -> display paywall screen
            document.getElementById('auth-container').style.display = 'none';
            document.getElementById('paywall-container').style.display = 'block';
            document.getElementById('app-container').style.display = 'none';
            
            window.Clerk.mountUserButton(document.getElementById('paywall-user-button'));
        }
    } else {
        // Not signed in -> display auth screen and let button handle modal trigger
        document.getElementById('auth-container').style.display = 'block';
        document.getElementById('paywall-container').style.display = 'none';
        document.getElementById('app-container').style.display = 'none';
    }
});

// --- QUIZ ENGINE FUNCTIONS ---
async function bootUpQuizEngine() {
    try {
        const response = await fetch('questions.json');
        quizDataPool = await response.json();
        userAnswersTrack = new Array(quizDataPool.length).fill(null);
        renderActiveQuizItem();
    } catch (error) {
        console.error("Initialization failure parsing dataset:", error);
    }
}

function renderActiveQuizItem() {
    const totalItems = quizDataPool.length;
    if (quizActiveIndex >= totalItems) {
        renderTerminalSummaryReport();
        return;
    }

    const distancePercent = (quizActiveIndex / totalItems) * 100;
    document.getElementById('runway-fill').style.width = `${distancePercent}%`;
    document.getElementById('taxi-element').style.left = `${Math.min(distancePercent, 94)}%`;

    const activeItem = quizDataPool[quizActiveIndex];
    document.getElementById('part-header-label').innerText = activeItem.part || "Part: Regulations";
    document.getElementById('index-meta-text').innerText = `Question ${quizActiveIndex + 1} of ${totalItems}`;
    document.getElementById('question-render-box').innerText = activeItem.question;

    hydrateSingleChoiceRow('A', activeItem.options.A);
    hydrateSingleChoiceRow('B', activeItem.options.B);
    hydrateSingleChoiceRow('C', activeItem.options.C);
    hydrateSingleChoiceRow('D', activeItem.options.D);

    const previousSavedAnswer = userAnswersTrack[quizActiveIndex];
    const explanationPanel = document.getElementById('feedback-explanation-box');

    if (previousSavedAnswer !== null) {
        freezeOptionInteractions();
        applyAnswerVisualAccents(previousSavedAnswer, activeItem.correctAnswer);
    } else {
        explanationPanel.style.display = 'none';
    }

    document.getElementById('prev-btn-node').disabled = (quizActiveIndex === 0);
    const nextBtn = document.getElementById('forward-btn-node');
    nextBtn.innerText = previousSavedAnswer === null ? "Skip →" : "Next →";
}

function hydrateSingleChoiceRow(letterKey, targetText) {
    const rowNode = document.getElementById(`btn-choice-${letterKey}`);
    document.getElementById(`text-choice-${letterKey}`).innerText = targetText;
    rowNode.className = "choice-row-btn";
    rowNode.disabled = false;
}

function freezeOptionInteractions() {
    const interactionButtons = document.querySelectorAll('.choice-row-btn');
    interactionButtons.forEach(btn => btn.disabled = true);
}

function processSelection(userSelectionKey) {
    userAnswersTrack[quizActiveIndex] = userSelectionKey;
    freezeOptionInteractions();
    
    const currentItem = quizDataPool[quizActiveIndex];
    applyAnswerVisualAccents(userSelectionKey, currentItem.correctAnswer);
    recalculateScoreMetrics();

    const nextBtn = document.getElementById('forward-btn-node');
    nextBtn.innerText = "Next →";
}

function applyAnswerVisualAccents(selectedKey, correctKey) {
    const currentItem = quizDataPool[quizActiveIndex];
    const userTargetButton = document.getElementById(`btn-choice-${selectedKey}`);
    const explanationPanel = document.getElementById('feedback-explanation-box');
    const explanationTitle = document.getElementById('explanation-status-title');
    const explanationBody = document.getElementById('explanation-text-body');

    if (selectedKey === correctKey) {
        userTargetButton.classList.add('success-accent');
        explanationPanel.className = "explanation-box success-border";
        explanationTitle.innerHTML = "<span style='color: var(--success-green);'>🎉 Correct!</span>";
    } else {
        userTargetButton.classList.add('danger-accent');
        document.getElementById(`btn-choice-${correctKey}`).classList.add('success-accent');
        explanationPanel.className = "explanation-box danger-border";
        explanationTitle.innerHTML = `<span style='color: var(--danger-red);'>❌ Incorrect (Correct: ${correctKey})</span>`;
    }
    
    explanationBody.innerText = (currentItem.explanations && currentItem.explanations[selectedKey]) ? currentItem.explanations[selectedKey] : "";
    explanationPanel.style.display = 'block';
}

function recalculateScoreMetrics() {
    let correct = 0, incorrect = 0, skipped = 0;
    userAnswersTrack.forEach((ans, idx) => {
        if (ans === null) {
            if (idx < quizActiveIndex) skipped++;
        } else if (ans === quizDataPool[idx].correctAnswer) {
            correct++;
        } else {
            incorrect++;
        }
    });

    document.getElementById('correct-ans-label').innerText = correct;
    document.getElementById('incorrect-ans-label').innerText = incorrect;
    document.getElementById('skipped-ans-label').innerText = skipped;
}

function advanceStepFlow() {
    quizActiveIndex++;
    recalculateScoreMetrics();
    renderActiveQuizItem();
}

function regressStepFlow() {
    if (quizActiveIndex > 0) {
        quizActiveIndex--;
        recalculateScoreMetrics();
        renderActiveQuizItem();
    }
}

function renderTerminalSummaryReport() {
    let finalCorrect = userAnswersTrack.filter((ans, idx) => ans !== null && ans === quizDataPool[idx].correctAnswer).length;
    let completeAccuracyPercentage = Math.round((finalCorrect / quizDataPool.length) * 100);

    document.getElementById('terminal-sheet').innerHTML = `
        <div style='text-align: center; padding: 12px 0;'>
            <div class="part-title-tag">Exam Terminal Processed</div>
            <p style='font-size: 44px; margin: 16px 0; font-weight: 800; color: var(--taxi-yellow);'>${completeAccuracyPercentage}%</p>
            <button class='nav-action-btn primary-btn' style='margin-top: 28px; width: 100%;' onclick='location.reload()'>Restart Simulator Terminal</button>
        </div>
    `;
}