/* ==========================================================
   POKHARA PET HOSPITAL — script.js (v11)

   1. Mobile menu
   2. Navbar shadow on scroll
   3. Reveal on scroll
   4. Appointment form → WhatsApp + email copy
   5. Auto-updating footer year
   6. The living clinic pets
   7. Hero video handling
   8. MITRA — the AI pet care assistant
   ========================================================== */


/* ---------- VERSION CHECK ----------
   Open the browser console (F12) and look for this line. If it does not
   say v7, the browser is still running an old cached copy of this file —
   see SETUP-FREE-AI.md for the hard-refresh steps. */

const MITRA_VERSION = 'v11';
console.log('%c Mitra ' + MITRA_VERSION + ' loaded ', 'background:#104469;color:#f2a54c;padding:2px 6px;border-radius:3px');


/* ---------- CLINIC DETAILS (edit these in one place) ---------- */

const CLINIC = {
    name:      'Pokhara Pet Hospital',
    phone:     '9802859465',
    phoneAlt:  '061-590375',
    whatsapp:  '9779802859465',                        // country code, no +
    formspree: 'https://formspree.io/f/mwvgnpgn',      // set '' to disable email copies

    /* ---- AI MODE ----
       Auto-detected. On a real domain (your Vercel URL) Mitra calls the
       serverless function at /api/chat — deploy it and set the API key
       and it just works. Opened as a local file, Mitra stays in guided
       mode so you never see connection errors while editing offline.
       Never put an API key in this file — the browser exposes it. */
    aiEndpoint: (location.protocol === 'http:' || location.protocol === 'https:') &&
                !['localhost', '127.0.0.1'].includes(location.hostname)
                ? '/api/chat' : ''
};


/* ---------- 1. MOBILE MENU ---------- */

const navToggle = document.querySelector('.nav-toggle');
const navLinks  = document.querySelector('.nav-links');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        navToggle.classList.toggle('open');
        navToggle.setAttribute('aria-expanded', navLinks.classList.contains('open'));
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('open');
            navToggle.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });
}


/* ---------- 2. NAVBAR SHADOW ON SCROLL ---------- */

const header = document.querySelector('.site-header');

if (header) {
    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 10);
    }, { passive: true });
}


/* ---------- 3. REVEAL ON SCROLL ---------- */

const revealTargets = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12 });

    revealTargets.forEach(el => observer.observe(el));
} else {
    revealTargets.forEach(el => el.classList.add('visible'));
}


/* ---------- 4. APPOINTMENT FORM → WHATSAPP + EMAIL COPY ---------- */

const form = document.querySelector('.appointment-form');
const successMessage = document.querySelector('.form-success');

if (form) {
    form.addEventListener('submit', (event) => {
        event.preventDefault();

        const value = (id) => {
            const el = document.getElementById(id);
            return el ? el.value.trim() : '';
        };

        const text =
            'New appointment request — ' + CLINIC.name + '\n' +
            'Name: '    + value('name')  + '\n' +
            'Phone: '   + value('phone') + '\n' +
            'Email: '   + value('email') + '\n' +
            'Pet: '     + value('pet')   + '\n' +
            'Details: ' + value('message');

        const endpoint = form.getAttribute('action');
        if (endpoint) {
            fetch(endpoint, {
                method: 'POST',
                body: new FormData(form),
                headers: { 'Accept': 'application/json' }
            }).catch(() => { /* the WhatsApp handoff below still works */ });
        }

        openWhatsApp(text);

        // Personalised thank-you card: first name and pet, if given
        if (successMessage) {
            const nameEl = successMessage.querySelector('.form-success-name');
            const textEl = successMessage.querySelector('.form-success-text');
            const first  = value('name').split(/\s+/)[0];
            const pet    = value('pet');
            const phone  = value('phone');

            if (nameEl) nameEl.textContent = first ? ', ' + first : '';
            if (textEl) {
                textEl.textContent =
                    (pet ? 'Your request for ' + pet + ' is with the clinic'
                         : 'Your request is with the clinic') +
                    (phone ? ' — we\'ll confirm on ' + phone + ' shortly.'
                           : ' — we\'ll confirm shortly.');
            }

            successMessage.hidden = false;
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        form.reset();
    });
}

function openWhatsApp(text) {
    const url = 'https://wa.me/' + CLINIC.whatsapp + '?text=' + encodeURIComponent(text);
    window.open(url, '_blank', 'noopener');
}


/* ---------- 5. FOOTER YEAR ---------- */

const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();


/* ---------- 6. THE LIVING CLINIC PETS ----------
   Pupils follow the cursor, the pets blink at random, daydream when
   left alone, and react happily when you pet them. atan2-free maths:
   we normalise the vector to the cursor, then each frame the pupils
   glide 10% closer to their target — that easing is what sells it. */

function bringPetToLife(selector, settings) {

    const pet = document.querySelector(selector);
    if (!pet) return;

    const pupils  = pet.querySelectorAll('.pet-pupil');
    const eyes    = pet.querySelectorAll('.pet-eye');
    const eyesBox = pet.querySelector('.pet-eyes');
    const head    = pet.querySelector('.pet-head');
    if (!eyesBox || !pupils.length) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let tx = 0, ty = 0, cx = 0, cy = 0;
    let tHead = 0, cHead = 0;
    let lastMove = Date.now();

    function lookAt(x, y) {
        const r  = eyesBox.getBoundingClientRect();
        const ex = r.left + r.width  / 2;
        const ey = r.top  + r.height / 2;
        const dx = x - ex;
        const dy = y - ey;
        const dist  = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, dist / 240);
        tx = (dx / dist) * settings.rangeX * reach;
        ty = (dy / dist) * settings.rangeY * reach;
        if (settings.headFollow) {
            tHead = Math.max(-4, Math.min(4, dx * 0.012));
        }
        lastMove = Date.now();
    }

    document.addEventListener('mousemove', (e) => lookAt(e.clientX, e.clientY), { passive: true });
    document.addEventListener('touchmove', (e) => {
        const t = e.touches[0];
        if (t) lookAt(t.clientX, t.clientY);
    }, { passive: true });

    // Daydreaming: after 3.5s of stillness, glance somewhere on its own
    setInterval(() => {
        if (Date.now() - lastMove > 3500) {
            const angle = Math.random() * Math.PI * 2;
            const r     = Math.random();
            tx = Math.cos(angle) * settings.rangeX * r;
            ty = Math.sin(angle) * settings.rangeY * r;
            if (settings.headFollow) tHead = Math.random() * 6 - 3;
        }
    }, 2200 + Math.random() * 900);

    (function animate() {
        cx += (tx - cx) * 0.10;
        cy += (ty - cy) * 0.10;
        cHead += (tHead - cHead) * 0.06;
        pupils.forEach(p => {
            p.setAttribute('transform', 'translate(' + cx.toFixed(2) + ' ' + cy.toFixed(2) + ')');
        });
        if (settings.headFollow && head && !reduceMotion) {
            head.style.transform = 'rotate(' + cHead.toFixed(2) + 'deg)';
        }
        requestAnimationFrame(animate);
    })();

    function blink() {
        eyes.forEach(el => el.classList.add('blink'));
        setTimeout(() => eyes.forEach(el => el.classList.remove('blink')), 150);
    }

    (function blinkLoop() {
        blink();
        if (Math.random() < 0.15) setTimeout(blink, 260);
        setTimeout(blinkLoop, 2300 + Math.random() * 3400);
    })();

    pet.addEventListener('click', () => {
        pet.classList.add('happy');
        setTimeout(() => pet.classList.remove('happy'), 1400);
    });
}

bringPetToLife('.clinic-cat', { rangeX: 3.6, rangeY: 2.2, headFollow: true  });
bringPetToLife('.clinic-dog', { rangeX: 3.0, rangeY: 3.0, headFollow: false });


/* ---------- 7. HERO VIDEO ----------
   No video file? Hide the element so the paw-print placeholder shows.
   Reduced-motion visitors don't get a moving background at all. */

const heroVideo = document.querySelector('.hero-video');

if (heroVideo) {
    const source = heroVideo.querySelector('source');
    const hide = () => { heroVideo.style.display = 'none'; };

    if (source) source.addEventListener('error', hide);
    heroVideo.addEventListener('error', hide);

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        heroVideo.pause();
        hide();
    }
}


/* ==========================================================
   8. MITRA — AI PET CARE ASSISTANT

   Two ways to run:
   • Guided mode (default): a scripted slot-filling conversation.
     Works offline, costs nothing, needs no setup.
   • AI mode: set CLINIC.aiEndpoint to your serverless function and
     Mitra becomes a real Claude conversation that still returns a
     structured booking when it has everything it needs.

   Either way, an emergency short-circuits everything and puts the
   phone number on screen immediately. Mitra never diagnoses.
   ========================================================== */

const mitraFab    = document.getElementById('mitraFab');
const mitraPanel  = document.getElementById('mitraPanel');
const mitraClose  = document.getElementById('mitraClose');
const mitraLog    = document.getElementById('mitraLog');
const mitraChips  = document.getElementById('mitraChips');
const mitraForm   = document.getElementById('mitraForm');
const mitraInput  = document.getElementById('mitraInput');
const mitraSend   = document.getElementById('mitraSend');

if (mitraPanel && mitraLog && mitraForm && mitraInput) {

    /* ----- Words that mean "stop chatting and call right now" ----- */
    const EMERGENCY_WORDS = [
        'emergency','bleeding','blood','seizure','fitting','convulsion',
        'not breathing','cant breathe','can not breathe','choking','collapsed',
        'unconscious','poison','poisoned','ate rat','rat poison','chocolate',
        'hit by','accident','run over','broken leg','broken bone','fracture',
        'paralysed','paralyzed','swollen stomach','bloated','wont wake',
        'will not wake','dying','critical','snake bite','severe pain'
    ];

    /* ----- What a complete booking needs ----- */
    const SLOTS = [
        {
            key: 'reason',
            ask: 'What does your pet need help with?',
            chips: ['Vaccination', 'Not eating well', 'Routine check-up', 'Skin problem']
        },
        {
            key: 'petType',
            ask: 'Is it a dog, a cat, or another animal?',
            chips: ['Dog', 'Cat', 'Bird', 'Other']
        },
        {
            key: 'petName',
            ask: "And what's your pet's name?",
            chips: []
        },
        {
            key: 'when',
            ask: 'When would suit you? We are open around the clock.',
            chips: ['Today', 'Tomorrow morning', 'This weekend', 'As soon as possible']
        },
        {
            key: 'name',
            ask: 'Almost done. What name should the appointment be under?',
            chips: []
        },
        {
            key: 'phone',
            ask: 'Last thing — a phone number so the clinic can confirm.',
            chips: []
        }
    ];

    const LABELS = {
        reason:  'Reason',
        petType: 'Animal',
        petName: 'Pet',
        when:    'Preferred time',
        name:    'Your name',
        phone:   'Phone'
    };

    const booking = {};
    const history = [];          // for AI mode
    let started    = false;
    let busy       = false;
    let aiWorking  = !!CLINIC.aiEndpoint;
    let pending    = null;       // a message that arrived while Mitra was mid-sentence

    /* ---------------- panel open / close ---------------- */

    function openMitra(prefill) {
        mitraPanel.hidden = false;
        if (mitraFab) {
            mitraFab.classList.add('hidden');
            mitraFab.setAttribute('aria-expanded', 'true');
        }

        if (!started) {
            started = true;
            greet();
        }

        if (prefill) {
            // Mitra may still be greeting — queue it rather than losing it
            if (busy) pending = prefill;
            else setTimeout(() => send(prefill), 300);
        } else {
            setTimeout(() => mitraInput.focus(), 120);
        }
    }

    function closeMitra() {
        mitraPanel.hidden = true;
        if (mitraFab) {
            mitraFab.classList.remove('hidden');
            mitraFab.setAttribute('aria-expanded', 'false');
            mitraFab.focus();
        }
    }

    if (mitraFab)   mitraFab.addEventListener('click', () => openMitra());
    if (mitraClose) mitraClose.addEventListener('click', closeMitra);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !mitraPanel.hidden) closeMitra();
    });

    document.querySelectorAll('[data-open-mitra]').forEach(btn => {
        btn.addEventListener('click', () => openMitra());
    });

    /* The hero ask bar hands its text straight to Mitra */
    const heroAsk = document.getElementById('heroAsk');
    const heroAskInput = document.getElementById('heroAskInput');

    if (heroAsk && heroAskInput) {
        heroAsk.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = heroAskInput.value.trim();
            heroAskInput.value = '';
            openMitra(q || 'I would like to book an appointment.');
        });
    }

    /* ---------------- rendering ---------------- */

    function scrollLog() {
        mitraLog.scrollTop = mitraLog.scrollHeight;
    }

    function addMessage(text, who) {
        const el = document.createElement('div');
        el.className = 'mitra-msg ' + who;
        el.textContent = text;
        mitraLog.appendChild(el);
        scrollLog();
        return el;
    }

    function addEmergencyCard() {
        const el = document.createElement('div');
        el.className = 'mitra-msg alert';
        el.innerHTML =
            'That needs a veterinarian now, not a booking form. ' +
            'Please call the clinic straight away — someone is on duty at every hour. ' +
            'Keep your pet warm, still, and away from food and water until we speak.' +
            '<br><a href="tel:' + CLINIC.phone + '">Call ' + CLINIC.phone + '</a>';
        mitraLog.appendChild(el);
        scrollLog();
    }

    function showChips(list) {
        mitraChips.innerHTML = '';
        (list || []).forEach(label => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'mitra-chip';
            chip.textContent = label;
            chip.addEventListener('click', () => send(label));
            mitraChips.appendChild(chip);
        });
    }

    function typingOn() {
        const el = document.createElement('div');
        el.className = 'mitra-typing';
        el.id = 'mitraTyping';
        el.innerHTML = '<span></span><span></span><span></span>';
        mitraLog.appendChild(el);
        scrollLog();
    }

    function typingOff() {
        const el = document.getElementById('mitraTyping');
        if (el) el.remove();
    }

    function setBusy(state) {
        busy = state;
        mitraInput.disabled = state;
        if (mitraSend) mitraSend.disabled = state;
    }

    function flushPending() {
        if (!pending || busy) return;
        const queued = pending;
        pending = null;
        setTimeout(() => send(queued), 260);
    }

    /* Bot speaks with a short, human-feeling pause */
    function say(text, chips, delay) {
        setBusy(true);
        showChips([]);
        typingOn();
        setTimeout(() => {
            typingOff();
            addMessage(text, 'bot');
            showChips(chips);
            setBusy(false);
            flushPending();
            if (!mitraPanel.hidden) mitraInput.focus();
        }, delay || Math.min(1100, 380 + text.length * 12));
    }

    function greet() {
        say(
            'Namaste! I am Mitra, the pet care assistant at ' + CLINIC.name + '.\n\n' +
            'I can book an appointment for you or answer general questions about ' +
            'our services. What brings you in today?',
            ['Book an appointment', 'What are your hours?', 'Where are you located?', 'It is an emergency']
        );
    }

    /* ---------------- the booking summary card ---------------- */

    function showBookingCard(data) {
        const card = document.createElement('div');
        card.className = 'mitra-card';

        const rows = Object.keys(LABELS)
            .filter(k => data[k])
            .map(k => '<dt>' + LABELS[k] + '</dt><dd>' + escapeHtml(data[k]) + '</dd>')
            .join('');

        card.innerHTML =
            '<h4>Appointment request</h4>' +
            '<dl>' + rows + '</dl>' +
            '<div class="mitra-card-actions">' +
                '<button type="button" class="mitra-confirm">Confirm booking</button>' +
                '<button type="button" class="mitra-edit">Change something</button>' +
            '</div>';

        mitraLog.appendChild(card);
        scrollLog();

        card.querySelector('.mitra-confirm').addEventListener('click', () => {
            card.querySelector('.mitra-card-actions').remove();
            submitBooking(data);
        });

        card.querySelector('.mitra-edit').addEventListener('click', () => {
            card.querySelector('.mitra-card-actions').remove();
            say('No problem — tell me what to change and I will update it.', []);
        });
    }

    function submitBooking(data) {
        const summary =
            'New appointment request — ' + CLINIC.name + '\n' +
            'Name: '   + (data.name    || '-') + '\n' +
            'Phone: '  + (data.phone   || '-') + '\n' +
            'Pet: '    + (data.petName || '-') + ' (' + (data.petType || 'pet') + ')\n' +
            'Reason: ' + (data.reason  || '-') + '\n' +
            'Preferred time: ' + (data.when || '-') + '\n' +
            '(Sent through Mitra on the website)';

        if (CLINIC.formspree) {
            fetch(CLINIC.formspree, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    name:    data.name,
                    phone:   data.phone,
                    pet:     data.petName,
                    message: summary,
                    source:  'Mitra assistant'
                })
            }).catch(() => { /* WhatsApp handoff below is the real delivery */ });
        }

        say(
            'Sent. The clinic has your request by email and will confirm on ' +
            (data.phone || 'your number') + ' shortly.\n\n' +
            'For the fastest reply, send it on WhatsApp too — the front desk ' +
            'sees that instantly, day or night.',
            []
        );

        // A real button, not an automatic popup. Popup blockers kill delayed
        // window.open calls; a direct tap is a user gesture and always works.
        setTimeout(() => addWhatsAppButton(summary), 1100);
    }

    function addWhatsAppButton(summary) {
        const card = document.createElement('div');
        card.className = 'mitra-card';
        card.innerHTML =
            '<h4>One more step</h4>' +
            '<div class="mitra-card-actions">' +
                '<button type="button" class="mitra-confirm">Send on WhatsApp</button>' +
                '<button type="button" class="mitra-edit">No thanks</button>' +
            '</div>';

        mitraLog.appendChild(card);
        scrollLog();

        card.querySelector('.mitra-confirm').addEventListener('click', () => {
            openWhatsApp(summary);
            card.remove();
            say('Done. Press Send inside WhatsApp and the clinic has it.',
                ['Book another visit', 'Get directions']);
        });

        card.querySelector('.mitra-edit').addEventListener('click', () => {
            card.remove();
            say('No problem — the clinic already has your request by email.',
                ['Book another visit', 'Get directions']);
        });
    }

    /* ---------------- guided (no-API) conversation ----------------
       The rule that matters: never file a question away as an answer.
       A question gets answered, then the pending question is repeated.
       Anything else is checked against the field it is meant to fill. */

    /* Things Mitra can answer at any point in the conversation */
    const FAQ = [
        {
            test: /hour|open|timing|kahile|24|closed|holiday|festival/,
            answer: 'We are open 24 hours a day, 7 days a week, including festivals. ' +
                    'Emergencies are seen the moment you arrive.'
        },
        {
            test: /where|location|address|direction|kaha|parking|reach|far/,
            answer: 'We are at Pokhara-14, Khasibazar, right by Pokhara International Airport. ' +
                    'The map and directions are in the Contact section of this page.'
        },
        {
            test: /price|cost|fee|charge|kati|rupee|rs\b|money|expensive/,
            answer: 'The vet confirms the cost at the consultation, before anything goes ahead. ' +
                    'For a specific quote, call ' + CLINIC.phone + '.'
        },
        {
            test: /doctor|vet\b|veterinarian|who will|which doctor|surgeon/,
            answer: 'Dr. Sonia Gurung (M.V.Sc) and Dr. Manoj Poudel (B.V.Sc & A.H.) see patients here. ' +
                    'The clinic assigns whoever is on duty when you arrive.'
        },
        {
            test: /what.*(service|do you do|offer)|service|surgery|treatment|x-?ray|lab/,
            answer: 'We do consultation, treatment, surgery, vaccination and wellness checks, ' +
                    'plus 24/7 emergency care.'
        },
        {
            test: /medicine|dose|dosage|tablet|drug|prescri|what.*give|treat.*at home|home remedy/,
            answer: 'I am not able to suggest medicines or doses — only the veterinarian can, ' +
                    'after seeing your pet. I can get you booked in, or you can call ' +
                    CLINIC.phone + ' to speak to someone now.'
        },
        {
            test: /pet'?s? name|name of (my |the )?pet|animal'?s? name/,
            answer: "Your pet's name is just what you call them at home — Bruno, Kali, Momo, anything."
        },
        {
            test: /(what|who).{0,12}(is )?your name|are you (a )?(bot|robot|human|real|ai)/,
            answer: 'I am Mitra, an assistant on the clinic website. A real veterinarian sees you ' +
                    'at the appointment.'
        },
        {
            test: /whats?app|call you|phone number|contact/,
            answer: 'You can call or WhatsApp ' + CLINIC.phone + ', or ' + CLINIC.phoneAlt +
                    ' for the landline.'
        }
    ];

    /* Questions do not get stored as answers */
    function looksLikeQuestion(text) {
        const t = text.trim().toLowerCase();
        if (t.includes('?')) return true;
        if (/\b(i want to know|i wanna know|tell me|explain|what do you mean|meaning of)\b/.test(t)) return true;
        const words = t.split(/\s+/).length;
        return words >= 3 &&
               /^(what|which|when|where|why|who|whose|how|can|could|do|does|did|is|are|should|would)\b/.test(t);
    }

    function isSkip(text) {
        return /^(skip|later|dunno|don'?t know|do not know|not sure|no idea|n\/?a)$/i.test(text.trim());
    }

    /* Each field checks that what arrived actually belongs in it */
    const CHECKS = {
        reason(v) {
            if (v.length < 2) return { hint: 'Could you say a little more about what your pet needs?' };
            return { value: v };
        },

        petType(v) {
            const t = v.toLowerCase();
            const map = [
                [/dog|puppy|kukur|kutta/, 'Dog'],
                [/cat|kitten|biralo/,     'Cat'],
                [/bird|parrot|chara|hen|chicken/, 'Bird'],
                [/rabbit|kharayo/,        'Rabbit'],
                [/cow|buffalo|goat|bakhra|sheep|livestock/, 'Livestock']
            ];
            for (const [re, label] of map) if (re.test(t)) return { value: label };
            if (v.split(/\s+/).length <= 3) return { value: v };
            return { hint: 'Just the kind of animal — dog, cat, bird, or something else.' };
        },

        petName(v) {
            if (v.length > 25 || v.split(/\s+/).length > 3) {
                return { hint: "Just the name your pet answers to — Bruno, for example." };
            }
            if (!/[a-z\u0900-\u097F]/i.test(v)) {
                return { hint: "That doesn't look like a name. What do you call your pet?" };
            }
            return { value: v };
        },

        when(v) {
            if (v.length > 60) return { hint: 'A rough time is fine — today, tomorrow morning, this weekend.' };
            return { value: v };
        },

        name(v) {
            if (v.split(/\s+/).length > 4 || v.length > 40) {
                return { hint: 'Just the name the appointment should go under — Sita Sharma, for example.' };
            }
            if (/\d/.test(v)) return { hint: 'A name without numbers, please.' };
            if (!/[a-z\u0900-\u097F]/i.test(v)) {
                return { hint: 'Sorry, I need a name for the booking.' };
            }
            return { value: v };
        },

        phone(v) {
            const digits = v.replace(/\D/g, '');
            if (digits.length < 7 || digits.length > 15) {
                return { hint: "That doesn't look like a phone number. A mobile like 98XXXXXXXX works." };
            }
            return { value: v };
        }
    };

    let retries = 0;   // failed attempts on the field currently being asked

    function nextEmptySlot() {
        return SLOTS.find(slot => !booking[slot.key]);
    }

    function answerFaq(text) {
        const t = text.toLowerCase();
        for (const item of FAQ) if (item.test.test(t)) return item.answer;
        return null;
    }

    function guidedReply(text) {
        const value = text.trim();
        const lower = value.toLowerCase();
        const slot  = nextEmptySlot();

        if (/book another|another visit|start over|start again/.test(lower)) {
            Object.keys(booking).forEach(k => delete booking[k]);
            retries = 0;
            return askNext('Happy to — starting a fresh booking.');
        }

        if (/^(get )?directions?$/.test(lower)) {
            return say('Pokhara-14, Khasibazar, near the International Airport. ' +
                       'The Google Maps link is in the Contact section of this page.', []);
        }

        /* A question is answered, never stored. The pending field is then
           repeated so the booking does not quietly lose its place. */
        if (looksLikeQuestion(value) || !slot) {
            const answer = answerFaq(value);

            if (answer) {
                return say(answer + (slot ? '\n\n' + slot.ask : ''), slot ? slot.chips : []);
            }

            if (!slot) {
                return say('I am not sure about that one — the clinic can tell you properly on ' +
                           CLINIC.phone + '.', []);
            }

            return say('I do not have an answer for that, sorry — ' + CLINIC.phone +
                       ' will get you someone who does.\n\n' + slot.ask, slot.chips);
        }

        /* An opening line is not an answer either */
        if (slot.key === 'reason' &&
            /^(book|appointment|i want|i need|hello|hi|namaste|hey|yes|ok)\b/.test(lower) &&
            value.length < 30) {
            return askNext();
        }

        if (isSkip(value) && slot.key !== 'phone') {
            booking[slot.key] = 'Not specified';
            retries = 0;
            return askNext('No problem.');
        }

        /* Check the answer belongs in the field being asked */
        const check = CHECKS[slot.key] ? CHECKS[slot.key](value) : { value: value };

        if (check.hint) {
            retries++;

            // Two tries is enough — do not trap anyone in a loop
            if (retries >= 2 && slot.key !== 'phone') {
                booking[slot.key] = value;
                retries = 0;
                return askNext();
            }

            if (retries >= 2 && slot.key === 'phone') {
                retries = 0;
                return say('Let us not go round in circles — call ' + CLINIC.phone +
                           ' and the front desk will book you in directly. ' +
                           'Or type your number once more and I will try again.', []);
            }

            return say(check.hint, slot.chips);
        }

        booking[slot.key] = check.value;
        retries = 0;
        askNext();
    }

    function askNext(prefix) {
        const slot = nextEmptySlot();
        retries = 0;

        if (!slot) {
            setBusy(true);
            showChips([]);
            typingOn();
            setTimeout(() => {
                typingOff();
                addMessage('Here is what I have. Check it over and confirm.', 'bot');
                showBookingCard(booking);
                setBusy(false);
                flushPending();
            }, 700);
            return;
        }

        say((prefix ? prefix + ' ' : '') + slot.ask, slot.chips);
    }

    /* ---------------- AI mode ---------------- */

    async function aiReply(text) {
        setBusy(true);
        showChips([]);
        typingOn();

        try {
            const res = await fetch(CLINIC.aiEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: history })
            });

            if (!res.ok) throw new Error('Assistant returned ' + res.status);

            const data = await res.json();
            typingOff();

            const reply = (data && data.reply) ? String(data.reply) : '';
            if (!reply) throw new Error('Empty reply');

            addMessage(reply, 'bot');
            history.push({ role: 'assistant', content: reply });

            if (data.booking && data.booking.complete) {
                Object.keys(LABELS).forEach(k => {
                    if (data.booking[k]) booking[k] = data.booking[k];
                });
                showBookingCard(booking);
            } else {
                showChips(Array.isArray(data.chips) ? data.chips.slice(0, 4) : []);
            }

            setBusy(false);
            flushPending();

        } catch (err) {
            // The clinic should never lose a booking because a server blinked
            typingOff();
            setBusy(false);
            aiWorking = false;
            addMessage(
                'My connection dropped for a second — I will take the details ' +
                'the simple way instead.',
                'bot'
            );
            askNext();
        }
    }

    /* ---------------- message pipeline ---------------- */

    function send(text) {
        const clean = (text || '').trim();
        if (!clean || busy) return;

        addMessage(clean, 'user');
        history.push({ role: 'user', content: clean });
        showChips([]);
        mitraInput.value = '';

        // Emergencies jump the queue, in both modes
        const lower = clean.toLowerCase();
        if (EMERGENCY_WORDS.some(word => lower.includes(word))) {
            setBusy(true);
            typingOn();
            setTimeout(() => {
                typingOff();
                addEmergencyCard();
                setBusy(false);
                flushPending();
            }, 500);
            return;
        }

        if (aiWorking) {
            aiReply(clean);
        } else {
            guidedReply(clean);
        }
    }

    mitraForm.addEventListener('submit', (e) => {
        e.preventDefault();
        send(mitraInput.value);
    });

    /* ---------------- helper ---------------- */

    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[ch]));
    }
}


/* ---------- 9. LIGHTBOX ----------
   Click any logo, doctor photo, or gallery photo to see it large.
   Esc, the X, or tapping the dark backdrop closes it. Delegated
   listener, so photos added to the gallery later work automatically. */

const lightbox        = document.getElementById('lightbox');
const lightboxImg     = document.getElementById('lightboxImg');
const lightboxCaption = document.getElementById('lightboxCaption');
const lightboxClose   = document.getElementById('lightboxClose');

if (lightbox && lightboxImg && lightboxClose) {

    const ENLARGEABLE = '.logo img, .hero-brand img, .footer-logo, .doctor-photo, .gallery-img';
    let lightboxTrigger = null;

    function openLightbox(img) {
        lightboxTrigger = img;
        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || '';
        lightboxCaption.textContent =
            img.alt || (img.closest('a.logo') ? 'Pokhara Pet Hospital' : '');
        lightbox.hidden = false;
        document.body.style.overflow = 'hidden';
        lightboxClose.focus();
    }

    function closeLightbox() {
        lightbox.hidden = true;
        lightboxImg.src = '';
        document.body.style.overflow = '';
        if (lightboxTrigger) {
            (lightboxTrigger.closest('a,button') || lightboxTrigger).focus?.();
        }
    }

    document.addEventListener('click', (e) => {
        const img = e.target.closest(ENLARGEABLE);
        if (!img) return;
        const link = img.closest('a');
        if (link) e.preventDefault();   // the header logo is a link — don't navigate
        openLightbox(img);
    });

    lightboxClose.addEventListener('click', closeLightbox);

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) closeLightbox();
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightbox.hidden) closeLightbox();
    });
}
