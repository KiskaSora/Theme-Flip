/*
 * Theme Flip v0.6
 * Кнопка в меню волшебной палочки + панель в настройках расширений.
 *
 *  • тёмная ⇄ светлая с сохранением оттенка (в обе стороны)
 *  • плавный переход
 *  • ползунки: оттенок, насыщенность, яркость фона
 *  • свой цвет акцента
 *  • тинт: окрасить всю тему в выбранный цвет
 *  • панель с превью «до / после» в цветах твоей темы
 *  • пресеты: сохранить рецепт перекраски, экспорт / импорт файлом
 *  • авто-режим: по системной теме или по времени суток
 *
 * Работает через CSS-переменные --SmartTheme*, цвета из Custom CSS темы
 * (элемент <style id="custom-style">) и <style>/inline-цвета в сообщениях.
 * Файл темы не меняется. Выключение = всё как было.
 */
(() => {
    const LS_ENABLED = 'themeFlip_light';
    const LS_SETTINGS = 'themeFlip_settings';
    const LS_PRESETS = 'themeFlip_presets';
    const MAX_PRESETS = 30;

    // ====== тексты интерфейса: русский / English (язык берётся из настроек Таверны) ======
    const I18N = {
        ru: {
            menuBtn: 'Светлая / тёмная тема', off: 'выкл', before: 'ДО', after: 'ПОСЛЕ',
            sQuote: '«текст в кавычках»', sItalic: 'курсив', sRest: ' и обычный текст',
            light: 'Светлая', dark: 'Тёмная', tint: 'Тинт', noTint: 'Без тинта', customColor: 'Свой цвет',
            sat: 'Насыщенность', bg: 'Яркость фона', auto: 'Авто-режим', manual: 'Вручную',
            system: 'Система', time: 'По времени', lightFromTo: 'Светлая с / до',
            presets: 'Пресеты', name: 'Название', save: 'Сохранить', export: 'Экспорт', import: 'Импорт',
            invert: 'Менять тёмная ⇄ светлая', reset: 'Сбросить', presetN: 'Пресет ',
            maxPresets: n => `Максимум ${n} пресетов — удали лишние`,
            chipLight: 'светлая', chipDark: 'тёмная', chipTint: 'тинт', chipNone: 'нет',
            myTheme: 'Моя тема', badFile: 'Не получилось прочитать файл',
            noPresets: 'В файле нет подходящих пресетов',
            imported: n => `Импортировано пресетов: ${n}`,
        },
        en: {
            menuBtn: 'Light / dark theme', off: 'off', before: 'BEFORE', after: 'AFTER',
            sQuote: '"quoted text"', sItalic: 'italic', sRest: ' and plain text',
            light: 'Light', dark: 'Dark', tint: 'Tint', noTint: 'No tint', customColor: 'Custom color',
            sat: 'Saturation', bg: 'Background brightness', auto: 'Auto mode', manual: 'Manual',
            system: 'System', time: 'By time', lightFromTo: 'Light from / to',
            presets: 'Presets', name: 'Name', save: 'Save', export: 'Export', import: 'Import',
            invert: 'Switch dark ⇄ light', reset: 'Reset', presetN: 'Preset ',
            maxPresets: n => `Limit of ${n} presets reached — delete some`,
            chipLight: 'light', chipDark: 'dark', chipTint: 'tint', chipNone: 'none',
            myTheme: 'My theme', badFile: 'Could not read the file',
            noPresets: 'No valid presets in the file',
            imported: n => `Imported presets: ${n}`,
        },
    };
    function lang() {
        const l = String(localStorage.getItem('language') || navigator.language || 'en').toLowerCase();
        return l.startsWith('ru') ? 'ru' : 'en';
    }
    function t(key, ...args) {
        const v = (I18N[lang()] || I18N.en)[key] ?? I18N.en[key] ?? key;
        return typeof v === 'function' ? v(...args) : v;
    }
    const STYLE_ID = 'theme-flip-style';
    const CHAT_STYLE_ID = 'theme-flip-chat-style';

    const DEFAULTS = {
        invert: true,     // менять светлая ⇄ тёмная (иначе только перекраска)
        sat: 100,         // насыщенность, %
        bgShift: 0,       // сдвиг яркости фона
        tintOn: false,    // тинт всей темы
        tint: '#8ec2f2',  // цвет тинта
        tintAmt: 80,      // сила тинта, %
        auto: 'off',      // off | system | time
        from: '07:00',    // «светлая» с ...
        to: '20:00',      // ... до
    };

    // ====== НАСТРОЙКИ "ПРИЯТНОСТИ" — крути под себя ======
    const TUNE = {
        // фоны (панели, пузыри сообщений)
        bgLightMin: 88,      // самая тёмная светлота фона (в светлой теме)
        bgLightRange: 8,     // + до этого (итого 88..96)
        bgSatMul: 0.8,       // насыщенность фона (меньше = пастельнее)
        bgSatMax: 70,
        darkBgBoost: 3,      // насколько фон тёмной темы светлее чистого «зеркала»
        // основной текст
        textLightMin: 10,
        textLightMul: 0.5,
        textSatMax: 40,
        // курсив / em
        emLightMin: 28,
        emLightMul: 0.3,
        // акценты (цитаты, подчёркивание, розовые заголовки и т.п.)
        accentShift: 28,
        accentLightMin: 32,
        accentLightMax: 48,
        accentSatMax: 85,
        // рамки
        borderLightMin: 70,
        borderLightMax: 82,
        borderSatMul: 0.6,
        // тень (в светлой теме слабее)
        shadowAlphaMul: 0.35,
        // фон страницы за прозрачными панелями (светлее/темнее панелей)
        pageDeltaLight: -4,
        pageDeltaDark: -3,
    };

    const VARS = {
        bg: [
            '--SmartThemeBlurTintColor',
            '--SmartThemeChatTintColor',
            '--SmartThemeUserMesBlurTintColor',
            '--SmartThemeBotMesBlurTintColor',
        ],
        text: ['--SmartThemeBodyColor'],
        em: ['--SmartThemeEmColor'],
        accent: ['--SmartThemeQuoteColor', '--SmartThemeUnderlineColor'],
        border: ['--SmartThemeBorderColor'],
        shadow: ['--SmartThemeShadowColor'],
    };

    // ====== состояние ======
    let settings = loadSettings();
    let enabled = localStorage.getItem(LS_ENABLED) === '1';
    let active = false;                 // наш слой сейчас наложен
    let lastPlan = null;
    let lastBaseLight = false;
    let previewData = null;
    let lastWant = undefined;
    let ctx = { src: 'dark', target: 'light', S: null };
    let fullTimer = null, chatTimer = null, liveTimer = null, autoTimer = null;
    let lastChatCss = null;
    let mq = null;

    function loadSettings() {
        try {
            return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_SETTINGS) || '{}') };
        } catch { return { ...DEFAULTS }; }
    }
    function saveSettings() {
        try { localStorage.setItem(LS_SETTINGS, JSON.stringify(settings)); } catch { /* ignore */ }
    }
    function saveEnabled() {
        try { localStorage.setItem(LS_ENABLED, enabled ? '1' : '0'); } catch { /* ignore */ }
    }

    // ====== цвет: парсинг и конверсии ======
    const NAMED = { white: [255, 255, 255], black: [0, 0, 0] };

    function hslToRgb(h, s, l) {
        h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return { r: 255 * f(0), g: 255 * f(8), b: 255 * f(4) };
    }

    function parseColor(str) {
        if (!str) return null;
        str = str.trim();
        const low = str.toLowerCase();
        if (NAMED[low]) return { r: NAMED[low][0], g: NAMED[low][1], b: NAMED[low][2], a: 1 };
        if (str[0] === '#') {
            let h = str.slice(1);
            if (!/^[0-9a-fA-F]+$/.test(h)) return null;
            if (h.length === 3 || h.length === 4) h = h.split('').map(c => c + c).join('');
            if (h.length !== 6 && h.length !== 8) return null;
            return {
                r: parseInt(h.slice(0, 2), 16),
                g: parseInt(h.slice(2, 4), 16),
                b: parseInt(h.slice(4, 6), 16),
                a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
            };
        }
        const alphaOf = (raw) => {
            if (raw === undefined) return 1;
            const v = parseFloat(raw);
            if (isNaN(v)) return 1;
            return String(raw).trim().endsWith('%') ? v / 100 : v;
        };
        let m = str.match(/^rgba?\(([^)]+)\)$/i);
        if (m) {
            const raw = m[1].split(/[\s,\/]+/).filter(Boolean);
            const p = raw.slice(0, 3).map(parseFloat);
            if (p.length < 3 || p.some(isNaN)) return null;
            return { r: p[0], g: p[1], b: p[2], a: alphaOf(raw[3]) };
        }
        m = str.match(/^hsla?\(([^)]+)\)$/i);
        if (m) {
            const raw = m[1].split(/[\s,\/]+/).filter(Boolean);
            const p = raw.slice(0, 3).map(parseFloat);
            if (p.length < 3 || p.some(isNaN)) return null;
            return { ...hslToRgb(p[0], p[1], p[2]), a: alphaOf(raw[3]) };
        }
        return null;
    }

    function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0;
        const l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                default: h = (r - g) / d + 4;
            }
            h *= 60;
        }
        return { h, s: s * 100, l: l * 100 };
    }

    const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
    const fmtObj = o =>
        `hsla(${o.h.toFixed(1)}, ${o.s.toFixed(1)}%, ${o.l.toFixed(1)}%, ${(+o.a).toFixed(3)})`;

    // ====== преобразование цвета по роли ======
    // ctx.src — какая тема сейчас (dark/light), ctx.target — какой хотим видеть.
    // Для light→dark используется «зеркало»: считаем как для dark→light и отражаем яркость.
    function convertHsl(role, c) {
        const S = ctx.S, T = TUNE;
        const base = rgbToHsl(c.r, c.g, c.b);
        let { h, s, l } = base;
        let a = c.a;

        if (ctx.target !== ctx.src && role !== 'other') {
            const lx = ctx.src === 'dark' ? base.l : 100 - base.l;
            const inv = 100 - lx;
            let nl = lx, ns = s;
            switch (role) {
                case 'bg':
                    ns = Math.min(s * T.bgSatMul, T.bgSatMax);
                    nl = T.bgLightMin + (inv / 100) * T.bgLightRange; break;
                case 'text':
                    ns = Math.min(s, T.textSatMax);
                    nl = T.textLightMin + inv * T.textLightMul; break;
                case 'em':
                    ns = Math.min(s, T.textSatMax);
                    nl = T.emLightMin + inv * T.emLightMul; break;
                case 'accent':
                    ns = Math.min(lx > 75 ? s * 0.6 : s, T.accentSatMax);
                    nl = clamp(lx - T.accentShift, T.accentLightMin, T.accentLightMax); break;
                case 'border':
                    ns = s * T.borderSatMul;
                    nl = clamp(inv, T.borderLightMin, T.borderLightMax); break;
            }
            if (role === 'shadow') {
                a *= ctx.target === 'light' ? T.shadowAlphaMul : 1;
            } else {
                if (ctx.target === 'dark') {
                    nl = 100 - nl;
                    if (role === 'bg') nl += T.darkBgBoost;
                }
                l = nl; s = ns;
            }
        }

        if (role === 'bg') l = clamp(l + S.bgShift, 1, 99);

        if (role !== 'shadow') {
            if (s > 2) h = (h + S.hue + 360) % 360;
            if (S.tk > 0) {
                // тинт: уводим оттенок к выбранному цвету (по кратчайшей дуге),
                // а нейтральным цветам добавляем насыщенность
                const tintCap = { bg: 55, text: 20, em: 45, accent: T.accentSatMax, border: 35 }[role] ?? 75;
                const sMax = { bg: T.bgSatMax, text: 40, em: 40, accent: T.accentSatMax, border: 60 }[role] ?? 100;
                const st = Math.min(S.ts, tintCap);
                if (s <= 2) h = S.th;
                else h += Math.min(1, S.tk / 0.35) * (((S.th - h + 540) % 360) - 180); // от ~35% оттенок полностью цвета тинта
                h = (h + 360) % 360;
                s = s * (1 - S.tk) + Math.max(Math.min(s, sMax), st) * S.tk;
            }
            if (S.hasAccent && (role === 'accent' || role === 'em' || role === 'border')) {
                h = S.ah;
                s = role === 'accent' ? Math.min(S.as, T.accentSatMax)
                    : role === 'em' ? Math.min(S.as, T.textSatMax)
                        : S.as * T.borderSatMul;
            }
            s = clamp(s * S.sat / 100, 0, 100);
        }
        return { h, s, l, a };
    }

    const convert = (role, c) => fmtObj(convertHsl(role, c));

    // ====== цвета внутри Custom CSS / чата ======
    const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black)\b/gi;
    const URL_RE = /(url\((?:[^()"']|"[^"]*"|'[^']*')*\))/gi;
    const TEXT_PROPS = /^(color|caret-color|accent-color|fill|stroke|-webkit-text-fill-color|-webkit-text-stroke-color|text-decoration-color|column-rule-color)$/;
    // шорткаты пропускаем: их значения уже есть в «длинных» свойствах,
    // а перезапись шортката сбросила бы соседние поля (картинку фона и т.п.)
    const SHORTHAND = /^(background|border|border-(top|right|bottom|left)|outline|text-decoration|column-rule)$/;

    // какую роль играет цвет — зависит от свойства и от его яркости
    // (яркость нормализуется так, будто исходная тема тёмная)
    function roleFor(prop, hsl) {
        const l = ctx.src === 'dark' ? hsl.l : 100 - hsl.l;
        const s = hsl.s;
        let role = null;
        if (prop.startsWith('--')) {          // собственные переменные темы
            if (l < 35) role = 'bg';
            else if (l >= 60) role = s <= 35 ? 'text' : 'accent';
        } else if (/shadow/.test(prop)) {
            role = 'shadow';
        } else if (TEXT_PROPS.test(prop)) {
            if (l >= 60) role = s <= 35 ? 'text' : 'accent';
        } else if (/border|outline/.test(prop)) {
            if (l < 45) role = 'border';
        } else if (/background/.test(prop)) {
            if (l < 40) role = 'bg';
        }
        if (!role && hasRecolor(ctx.S)) return 'other'; // остальные цвета: только тинт / насыщенность
        return role;
    }

    // возвращает новое значение или null, если менять нечего
    function convertValue(prop, value) {
        if (!value || SHORTHAND.test(prop)) return null;
        let changed = false;
        const parts = value.split(URL_RE);   // url(...) не трогаем
        const out = parts.map((seg, i) => {
            if (i % 2) return seg;
            return seg.replace(COLOR_RE, m => {
                const c = parseColor(m);
                if (!c) return m;
                const role = roleFor(prop, rgbToHsl(c.r, c.g, c.b));
                if (!role) return m;
                changed = true;
                return convert(role, c);
            });
        });
        return changed ? out.join('') : null;
    }

    // CSSOM -> новый CSS только с перекрашенными объявлениями
    function ruleToCss(rule) {
        if (typeof CSSStyleRule !== 'undefined' && rule instanceof CSSStyleRule) {
            let decl = '';
            const st = rule.style;
            for (let i = 0; i < st.length; i++) {
                const prop = st[i];
                const out = convertValue(prop, st.getPropertyValue(prop));
                if (out) decl += `${prop}:${out} !important;`;
            }
            return decl ? `${rule.selectorText}{${decl}}` : '';
        }
        if (typeof CSSMediaRule !== 'undefined' && rule instanceof CSSMediaRule) {
            const inner = Array.from(rule.cssRules).map(ruleToCss).join('');
            return inner ? `@media ${rule.media.mediaText}{${inner}}` : '';
        }
        if (typeof CSSSupportsRule !== 'undefined' && rule instanceof CSSSupportsRule) {
            const inner = Array.from(rule.cssRules).map(ruleToCss).join('');
            return inner ? `@supports ${rule.conditionText}{${inner}}` : '';
        }
        if (typeof CSSKeyframesRule !== 'undefined' && rule instanceof CSSKeyframesRule) {
            let any = false, frames = '';
            for (const kf of Array.from(rule.cssRules)) {
                let d = '';
                for (let i = 0; i < kf.style.length; i++) {
                    const prop = kf.style[i];
                    const val = kf.style.getPropertyValue(prop);
                    const out = convertValue(prop, val);
                    if (out) any = true;
                    d += `${prop}:${out || val};`;
                }
                frames += `${kf.keyText}{${d}}`;
            }
            return any ? `@keyframes ${rule.name}{${frames}}` : '';
        }
        return '';
    }

    function sheetToCss(sheet) {
        let rules;
        try { rules = Array.from(sheet.cssRules); } catch { return ''; }
        return rules.map(ruleToCss).join('\n');
    }

    // ====== слой стилей ======
    function setStyle(id, css) {
        let el = document.getElementById(id);
        if (!css) { el?.remove(); return; }
        if (!el) {
            el = document.createElement('style');
            el.id = id;
        }
        el.textContent = css;
        document.head.appendChild(el); // всегда последним, чтобы перебивать остальные
    }

    function restoreInline() {
        document.querySelectorAll('[data-tf-orig]').forEach(el => {
            el.setAttribute('style', el.dataset.tfOrig);
            delete el.dataset.tfOrig;
        });
    }

    function removeAll() {
        document.getElementById(STYLE_ID)?.remove();
        document.getElementById(CHAT_STYLE_ID)?.remove();
        lastChatCss = null;
        restoreInline();
        active = false;
    }

    // <style> и inline-стили внутри сообщений
    function applyChat() {
        if (!active) return;
        const chat = document.getElementById('chat');
        if (!chat) return;

        let css = '';
        chat.querySelectorAll('style').forEach(st => {
            if (st.sheet) css += sheetToCss(st.sheet) + '\n';
        });
        if (css !== lastChatCss) {
            lastChatCss = css;
            setStyle(CHAT_STYLE_ID, css.trim());
        }

        chat.querySelectorAll('[style]').forEach(el => {
            const orig = el.dataset.tfOrig ?? el.getAttribute('style');
            if (el.dataset.tfOrig === undefined) el.dataset.tfOrig = orig;
            el.setAttribute('style', orig);
            const st = el.style;
            const patches = [];
            for (let i = 0; i < st.length; i++) {
                const prop = st[i];
                const out = convertValue(prop, st.getPropertyValue(prop));
                if (out) patches.push([prop, out]);
            }
            patches.forEach(([p, v]) => el.style.setProperty(p, v, 'important'));
            if (!patches.length) delete el.dataset.tfOrig;
        });
    }

    // ====== фон страницы ======
    // Полупрозрачные панели лежат поверх фона страницы. Если страница осталась
    // чёрной (или белой), панели выглядят серыми — перекрашиваем и её.
    function realImage(el) {
        const bi = getComputedStyle(el).backgroundImage;
        return !!bi && bi !== 'none' && !bi.includes('__transparent');
    }

    function pageBgCss(tint) {
        const layers = ['#bg1', '#bg_custom'].map(s => document.querySelector(s)).filter(Boolean);
        if (layers.some(realImage)) return ''; // настоящая картинка фона — не трогаем
        const t = convertHsl('bg', { ...tint, a: 1 });
        t.l = clamp(t.l + (ctx.target === 'light' ? TUNE.pageDeltaLight : TUNE.pageDeltaDark), 2, 98);
        const color = fmtObj(t);

        let css = '';
        const targets = [['html', document.documentElement], ['body', document.body]];
        for (const [sel, el] of targets) {
            if (!el) continue;
            const col = parseColor(getComputedStyle(el).backgroundColor);
            if (!col || col.a < 0.5) continue;
            const l = rgbToHsl(col.r, col.g, col.b).l;
            const lx = ctx.src === 'dark' ? l : 100 - l;
            if (lx > 30) continue;
            css += `${sel}{background-color:${color} !important;}\n`;
        }
        return css;
    }

    // ====== план: что и куда превращаем ======
    function isDaytime() {
        const toMin = s => { const [h, m] = String(s).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
        const now = new Date();
        const n = now.getHours() * 60 + now.getMinutes();
        const a = toMin(settings.from), b = toMin(settings.to);
        return a <= b ? (n >= a && n < b) : (n >= a || n < b);
    }

    function autoWant() {
        if (settings.auto === 'system' && window.matchMedia) {
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        if (settings.auto === 'time') return isDaytime() ? 'light' : 'dark';
        return null;
    }

    function hasRecolor(d) {
        return d.hue !== 0 || d.sat !== 100 || d.bgShift !== 0 || d.hasAccent || d.tk > 0;
    }

    function plan(baseLight) {
        const src = baseLight ? 'light' : 'dark';
        const want = autoWant();
        let target = src;
        if (settings.invert) {
            if (want) target = want;
            else if (enabled) target = src === 'dark' ? 'light' : 'dark';
        }
        if (target === src && !hasRecolor(derive())) return null;
        return { src, target };
    }

    function derive() {
        const hex = { r: 217, g: 79, b: 138, a: 1 };
        const ahsl = rgbToHsl(hex.r, hex.g, hex.b);
        const tx = parseColor(settings.tint) || { r: 142, g: 194, b: 242, a: 1 };
        const thsl = rgbToHsl(tx.r, tx.g, tx.b);
        return {
            hue: 0,
            sat: +settings.sat || 0,
            bgShift: +settings.bgShift || 0,
            hasAccent: false,
            ah: ahsl.h,
            as: ahsl.s,
            tk: settings.tintOn ? clamp((+settings.tintAmt || 0) / 100, 0, 1) : 0,
            th: thsl.h,
            ts: thsl.s,
        };
    }

    // ====== предпросмотр «до / после» ======
    function buildPreview(cs) {
        const items = {
            bg: ['--SmartThemeBlurTintColor', 'bg'],
            user: ['--SmartThemeUserMesBlurTintColor', 'bg'],
            bot: ['--SmartThemeBotMesBlurTintColor', 'bg'],
            text: ['--SmartThemeBodyColor', 'text'],
            quote: ['--SmartThemeQuoteColor', 'accent'],
            em: ['--SmartThemeEmColor', 'em'],
        };
        const bgc = parseColor(cs.getPropertyValue('--SmartThemeBlurTintColor'));
        const before = {}, after = {};
        for (const [k, [name, role]] of Object.entries(items)) {
            const c = parseColor(cs.getPropertyValue(name)) || bgc || { r: 128, g: 128, b: 128, a: 1 };
            before[k] = `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
            const o = convertHsl(role, c);
            o.a = 1;
            after[k] = fmtObj(o);
        }
        return { before, after };
    }

    function renderPreview() {
        if (!previewData) return;
        for (const [id, key] of [['tf_pv_before', 'before'], ['tf_pv_after', 'after']]) {
            const el = document.getElementById(id);
            if (!el) continue;
            for (const [k, v] of Object.entries(previewData[key])) el.style.setProperty('--pv-' + k, v);
        }
    }

    // ====== применение ======
    function doApply() {
        // сначала убираем свой слой, чтобы прочитать оригинальные значения темы
        document.getElementById(STYLE_ID)?.remove();
        const cs = getComputedStyle(document.documentElement);

        const tint = parseColor(cs.getPropertyValue('--SmartThemeBlurTintColor'));
        if (!tint) { removeAll(); updateUi(); return; }
        const baseLight = rgbToHsl(tint.r, tint.g, tint.b).l > 55;

        lastBaseLight = baseLight;
        const p = plan(baseLight);
        lastPlan = p;
        lastWant = autoWant();

        // для превью считаем «что будет», даже если сейчас всё выключено
        const src = baseLight ? 'light' : 'dark';
        const pp = p || { src, target: src === 'dark' ? 'light' : 'dark' };
        ctx = { src: pp.src, target: pp.target, S: derive() };
        const S = ctx.S;
        previewData = buildPreview(cs);
        if (!p) { removeAll(); updateUi(); return; }

        // 1) переменные --SmartTheme*
        let css = ':root{';
        for (const [role, names] of Object.entries(VARS)) {
            for (const name of names) {
                const c = parseColor(cs.getPropertyValue(name));
                if (!c) continue;
                css += `${name}:${convert(role, c)} !important;`;
            }
        }
        css += '}\n';

        // 2) цвета из Custom CSS темы
        const custom = document.getElementById('custom-style');
        if (custom && custom.sheet) css += sheetToCss(custom.sheet);

        // 3) фон страницы
        if (p.src !== p.target) css += pageBgCss(tint);

        setStyle(STYLE_ID, css);
        active = true;

        // 4) сообщения чата
        lastChatCss = null;
        applyChat();
        updateUi();
    }

    // плавный переход: View Transitions API, а если его нет — transition на всё
    function transition(fn) {
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce) { fn(); return; }
        if (typeof document.startViewTransition === 'function') {
            try { document.startViewTransition(fn); return; } catch { /* fallthrough */ }
        }
        const root = document.documentElement;
        root.classList.add('tf-anim');
        fn();
        setTimeout(() => root.classList.remove('tf-anim'), 700);
    }

    function refresh({ animate = false } = {}) {
        if (animate) transition(doApply); else doApply();
    }

    function refreshLive() {      // для ползунков: без анимации, с задержкой
        clearTimeout(liveTimer);
        liveTimer = setTimeout(() => refresh({ animate: false }), 100);
    }

    // ====== кнопка и панель ======
    function updateUi() {
        const icon = document.querySelector('#theme_flip_button .fa-solid');
        const base = lastBaseLight ? 'light' : 'dark';
        const cur = lastPlan ? lastPlan.target : base;
        if (icon) {
            const light = cur === 'light' && cur !== base;
            icon.classList.toggle('fa-sun', light);
            icon.classList.toggle('fa-moon', !light);
        }
        $('tf_mode_light')?.classList.toggle('tf-on', cur === 'light');
        $('tf_mode_dark')?.classList.toggle('tf-on', cur === 'dark');
        renderPreview();
    }

    function setPolarity(want) {
        const base = lastBaseLight ? 'light' : 'dark';
        if (settings.auto !== 'off') { settings.auto = 'off'; setupAuto(); }
        settings.invert = true;
        saveSettings();
        enabled = want !== base;
        saveEnabled();
        syncPanel();
        refresh({ animate: true });
    }

    function onButton() {
        if (settings.auto !== 'off') {
            // ручное переключение отключает авто-режим
            const flipped = !!lastPlan && lastPlan.src !== lastPlan.target;
            settings.auto = 'off';
            saveSettings();
            setupAuto();
            enabled = !flipped;
            syncPanel();
        } else {
            enabled = !enabled;
        }
        saveEnabled();
        refresh({ animate: true });
    }

    function addButton() {
        const menu = document.getElementById('extensionsMenu');
        if (!menu) return false;
        if (document.getElementById('theme_flip_button')) return true;
        const btn = document.createElement('div');
        btn.id = 'theme_flip_button';
        btn.className = 'list-group-item flex-container flexGap5';
        btn.innerHTML =
            '<div class="fa-solid fa-moon extensionsMenuExtensionButton"></div><span>' + t('menuBtn') + '</span>';
        btn.addEventListener('click', onButton);
        menu.appendChild(btn);
        updateUi();
        return true;
    }

    const $ = id => document.getElementById(id);
    const SWATCHES = ['#f2a0bd', '#b7a2f2', '#8ec2f2', '#8fe0c4', '#f2e08f', '#f2b48f'];

    function syncPanel() {
        if (!$('theme_flip_settings')) return;
        $('tf_invert').checked = !!settings.invert;
        $('tf_sat').value = settings.sat;
        $('tf_sat_v').textContent = settings.sat + '%';
        $('tf_bg').value = settings.bgShift;
        $('tf_bg_v').textContent = (settings.bgShift > 0 ? '+' : '') + settings.bgShift;
        $('tf_tint_amt').value = settings.tintAmt;
        $('tf_tint_amt').style.setProperty('--tf-tint', settings.tint);
        $('tf_tint_v').textContent = settings.tintOn ? settings.tintAmt + '%' : t('off');
        const known = SWATCHES.includes(settings.tint);
        document.querySelectorAll('#tf_sws .tf-sw[data-tint]').forEach(b => {
            const t = b.dataset.tint;
            b.classList.toggle('tf-on', t === '' ? !settings.tintOn : (settings.tintOn && t === settings.tint));
        });
        $('tf_tint_c').value = /^#[0-9a-fA-F]{6}$/.test(settings.tint) ? settings.tint : '#8ec2f2';
        $('tf_tint_c').parentElement.classList.toggle('tf-on', settings.tintOn && !known);
        document.querySelectorAll('#tf_auto_pills .tf-pill').forEach(b =>
            b.classList.toggle('tf-on', b.dataset.auto === settings.auto));
        $('tf_from').value = settings.from;
        $('tf_to').value = settings.to;
        $('tf_time_row').style.display = settings.auto === 'time' ? '' : 'none';
    }

    function buildPanel() {
        const host = $('extensions_settings2') || $('extensions_settings');
        if (!host) return false;
        if ($('theme_flip_settings')) return true;

        const sws = SWATCHES.map(c => `<button class="tf-sw" data-tint="${c}" style="background:${c}" title="${c}"></button>`).join('');
        const sample = id => `
      <div class="tf-pv" id="${id}">
        <span class="tf-pvl">${id.endsWith('before') ? t('before') : t('after')}</span>
        <div class="tf-b tf-bu">${t('sQuote')}</div>
        <div class="tf-b tf-bb"><em>${t('sItalic')}</em>${t('sRest')}</div>
      </div>`;

        const wrap = document.createElement('div');
        wrap.id = 'theme_flip_settings';
        wrap.className = 'extension_container';
        wrap.innerHTML = `
<div class="inline-drawer">
  <div class="inline-drawer-toggle inline-drawer-header">
    <b>Theme Flip</b>
    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
  </div>
  <div class="inline-drawer-content tf-root">
    <div class="tf-seg">
      <button id="tf_mode_light" class="tf-segbtn"><i class="fa-solid fa-sun"></i> ${t('light')}</button>
      <button id="tf_mode_dark" class="tf-segbtn"><i class="fa-solid fa-moon"></i> ${t('dark')}</button>
    </div>
    <div class="tf-preview">${sample('tf_pv_before')}${sample('tf_pv_after')}</div>

    <div class="tf-group">
      <div class="tf-h"><span>${t('tint')}</span><span id="tf_tint_v"></span></div>
      <div class="tf-sws" id="tf_sws">
        <button class="tf-sw tf-off" data-tint="" title="${t('noTint')}"><i class="fa-solid fa-ban"></i></button>
        ${sws}
        <label class="tf-sw tf-custom" title="${t('customColor')}"><input type="color" id="tf_tint_c"></label>
      </div>
      <input type="range" id="tf_tint_amt" class="tf-range tf-r-tint" min="0" max="100" step="1">
    </div>

    <div class="tf-group"><div class="tf-h"><span>${t('sat')}</span><span id="tf_sat_v"></span></div>
      <input type="range" id="tf_sat" class="tf-range tf-r-sat" min="30" max="160" step="1"></div>
    <div class="tf-group"><div class="tf-h"><span>${t('bg')}</span><span id="tf_bg_v"></span></div>
      <input type="range" id="tf_bg" class="tf-range tf-r-bg" min="-10" max="6" step="1"></div>

    <div class="tf-group">
      <div class="tf-h"><span>${t('auto')}</span></div>
      <div class="tf-pills" id="tf_auto_pills">
        <button class="tf-pill" data-auto="off">${t('manual')}</button>
        <button class="tf-pill" data-auto="system">${t('system')}</button>
        <button class="tf-pill" data-auto="time">${t('time')}</button>
      </div>
      <div class="tf-line" id="tf_time_row"><span>${t('lightFromTo')}</span><input type="time" id="tf_from" class="text_pole"><input type="time" id="tf_to" class="text_pole"></div>
    </div>

    <div class="tf-group">
      <div class="tf-h"><span>${t('presets')}</span><span id="tf_pr_count"></span></div>
      <div class="tf-line"><input type="text" id="tf_pr_name" class="text_pole" maxlength="30" placeholder="${t('name')}"><div id="tf_pr_save" class="menu_button">${t('save')}</div></div>
      <div class="tf-chips" id="tf_pr_list"></div>
      <div class="tf-line"><div id="tf_pr_export" class="menu_button">${t('export')}</div><div id="tf_pr_import" class="menu_button">${t('import')}</div><input type="file" id="tf_pr_file" accept=".json,application/json" hidden></div>
    </div>

    <div class="tf-group tf-line">
      <label class="checkbox_label"><input type="checkbox" id="tf_invert"><span>${t('invert')}</span></label>
      <div id="tf_reset" class="menu_button">${t('reset')}</div>
    </div>
  </div>
</div>`;
        host.appendChild(wrap);

        const changed = (animate) => { saveSettings(); syncPanel(); animate ? refresh({ animate: true }) : refreshLive(); };

        $('tf_mode_light').addEventListener('click', () => setPolarity('light'));
        $('tf_mode_dark').addEventListener('click', () => setPolarity('dark'));
        $('tf_invert').addEventListener('change', e => { settings.invert = e.target.checked; changed(true); });

        $('tf_sws').addEventListener('click', e => {
            const b = e.target.closest('.tf-sw[data-tint]');
            if (!b) return;
            if (b.dataset.tint === '') settings.tintOn = false;
            else { settings.tint = b.dataset.tint; settings.tintOn = true; }
            changed(false);
        });
        $('tf_tint_c').addEventListener('input', e => {
            settings.tint = e.target.value; settings.tintOn = true; changed(false);
        });
        $('tf_tint_amt').addEventListener('input', e => {
            settings.tintAmt = +e.target.value; settings.tintOn = settings.tintAmt > 0 || settings.tintOn; changed(false);
        });
        $('tf_sat').addEventListener('input', e => { settings.sat = +e.target.value; changed(false); });
        $('tf_bg').addEventListener('input', e => { settings.bgShift = +e.target.value; changed(false); });
        $('tf_auto_pills').addEventListener('click', e => {
            const b = e.target.closest('.tf-pill');
            if (!b) return;
            settings.auto = b.dataset.auto;
            saveSettings(); setupAuto(); syncPanel(); refresh({ animate: true });
        });
        $('tf_from').addEventListener('change', e => { settings.from = e.target.value || DEFAULTS.from; changed(true); });
        $('tf_to').addEventListener('change', e => { settings.to = e.target.value || DEFAULTS.to; changed(true); });
        $('tf_reset').addEventListener('click', () => {
            settings = { ...DEFAULTS };
            enabled = false; saveEnabled();
            saveSettings(); setupAuto(); syncPanel(); refresh({ animate: true });
        });

        $('tf_pr_save').addEventListener('click', savePresetFromUi);
        $('tf_pr_name').addEventListener('keydown', e => { if (e.key === 'Enter') savePresetFromUi(); });
        $('tf_pr_export').addEventListener('click', exportPresets);
        $('tf_pr_import').addEventListener('click', () => $('tf_pr_file').click());
        $('tf_pr_file').addEventListener('change', async e => {
            const f = e.target.files && e.target.files[0];
            if (f) importText(await f.text());
            e.target.value = '';
        });
        $('tf_pr_list').addEventListener('click', e => {
            const del = e.target.closest('[data-del]');
            const chip = e.target.closest('.tf-chip');
            if (!chip) return;
            const list = loadPresets();
            const i = +(del ? del.dataset.del : chip.dataset.i);
            if (!list[i]) return;
            if (del) { list.splice(i, 1); storePresets(list); renderPresets(); }
            else applyPreset(list[i]);
        });

        syncPanel();
        renderPresets();
        renderPreview();
        return true;
    }

    // ====== пресеты: маленький «рецепт» перекраски (≈60 байт), а не копия темы ======
    function sanitizePreset(p) {
        if (!p || typeof p !== 'object') return null;
        const n = String(p.n ?? '').trim().slice(0, 30);
        if (!n) return null;
        return {
            n,
            m: p.m === 'l' || p.m === 'd' ? p.m : '',
            t: /^#[0-9a-fA-F]{6}$/.test(p.t) ? p.t.toLowerCase() : '',
            a: clamp(Math.round(+p.a || 0), 0, 100),
            s: clamp(Math.round(+p.s || 100), 30, 160),
            b: clamp(Math.round(+p.b || 0), -10, 6),
        };
    }

    function loadPresets() {
        try {
            const a = JSON.parse(localStorage.getItem(LS_PRESETS) || '[]');
            return (Array.isArray(a) ? a : []).map(sanitizePreset).filter(Boolean).slice(0, MAX_PRESETS);
        } catch { return []; }
    }

    function storePresets(list) {
        try { localStorage.setItem(LS_PRESETS, JSON.stringify(list.slice(0, MAX_PRESETS))); } catch { /* ignore */ }
    }

    function currentPreset(name) {
        const base = lastBaseLight ? 'light' : 'dark';
        const cur = lastPlan ? lastPlan.target : base;
        return sanitizePreset({
            n: name,
            m: cur === 'light' ? 'l' : 'd',
            t: settings.tintOn ? settings.tint : '',
            a: settings.tintAmt,
            s: settings.sat,
            b: settings.bgShift,
        });
    }

    // добавить / заменить по имени; возвращает false, если лимит
    function mergePreset(list, p) {
        const i = list.findIndex(x => x.n === p.n);
        if (i >= 0) { list[i] = p; return true; }
        if (list.length >= MAX_PRESETS) return false;
        list.push(p);
        return true;
    }

    function notify(kind, msg) {
        if (window.toastr && window.toastr[kind]) window.toastr[kind](msg, 'Theme Flip');
    }

    function savePresetFromUi() {
        const list = loadPresets();
        let name = ($('tf_pr_name').value || '').trim();
        if (!name) name = t('presetN') + (list.length + 1);
        if (!mergePreset(list, currentPreset(name))) {
            notify('warning', t('maxPresets', MAX_PRESETS));
            return;
        }
        storePresets(list);
        $('tf_pr_name').value = '';
        renderPresets();
    }

    function applyPreset(p) {
        const base = lastBaseLight ? 'light' : 'dark';
        settings.tintOn = !!p.t;
        if (p.t) settings.tint = p.t;
        settings.tintAmt = p.a;
        settings.sat = p.s;
        settings.bgShift = p.b;
        settings.invert = true;
        if (p.m) { enabled = (p.m === 'l' ? 'light' : 'dark') !== base; saveEnabled(); }
        if (settings.auto !== 'off') { settings.auto = 'off'; setupAuto(); }
        saveSettings();
        syncPanel();
        refresh({ animate: true });
    }

    function renderPresets() {
        const box = $('tf_pr_list');
        if (!box) return;
        const list = loadPresets();
        box.textContent = '';
        list.forEach((p, i) => {
            const chip = document.createElement('div');
            chip.className = 'tf-chip';
            chip.dataset.i = i;
            chip.title = `${p.m === 'l' ? t('chipLight') : p.m === 'd' ? t('chipDark') : ''} · ${t('chipTint')} ${p.t ? p.a + '%' : t('chipNone')}`;
            const dot = document.createElement('i');
            dot.className = 'tf-dot';
            if (p.t) dot.style.background = p.t;
            const name = document.createElement('span');
            name.textContent = p.n;
            const x = document.createElement('b');
            x.className = 'tf-x';
            x.dataset.del = i;
            x.textContent = '✕';
            chip.append(dot, name, x);
            box.appendChild(chip);
        });
        const cnt = $('tf_pr_count');
        if (cnt) cnt.textContent = `${list.length}/${MAX_PRESETS}`;
    }

    function exportPresets() {
        let list = loadPresets();
        if (!list.length) list = [currentPreset(t('myTheme'))];
        const blob = new Blob([JSON.stringify({ themeFlip: 1, presets: list })], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'theme-flip-presets.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function importText(text) {
        let data;
        try { data = JSON.parse(text); } catch { notify('error', t('badFile')); return 0; }
        const incoming = Array.isArray(data) ? data : Array.isArray(data?.presets) ? data.presets : [data];
        const list = loadPresets();
        let added = 0;
        for (const raw of incoming) {
            const p = sanitizePreset(raw);
            if (p && mergePreset(list, p)) added++;
        }
        if (!added) { notify('warning', t('noPresets')); return 0; }
        storePresets(list);
        renderPresets();
        notify('success', t('imported', added));
        return added;
    }

    // ====== авто-режим ======
    function onSystemChange() { if (settings.auto === 'system') refresh({ animate: true }); }

    function setupAuto() {
        clearInterval(autoTimer);
        autoTimer = null;
        if (mq) { mq.removeEventListener?.('change', onSystemChange); mq = null; }
        if (settings.auto === 'time') {
            autoTimer = setInterval(() => {
                if (autoWant() !== lastWant) refresh({ animate: true });
            }, 30000);
        } else if (settings.auto === 'system' && window.matchMedia) {
            mq = window.matchMedia('(prefers-color-scheme: light)');
            mq.addEventListener?.('change', onSystemChange);
        }
    }

    // ====== слежение: смена темы, правка Custom CSS, новые сообщения ======
    function scheduleFull() {
        clearTimeout(fullTimer);
        fullTimer = setTimeout(doApply, 200);
    }

    function scheduleChat() {
        if (!active) return;
        clearTimeout(chatTimer);
        chatTimer = setTimeout(applyChat, 500);
    }

    function watch() {
        // ST меняет переменные на :root при смене темы
        new MutationObserver(scheduleFull)
            .observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

        // Custom CSS перезаписали (ST пишет его в <style id="custom-style">)
        let tries = 0;
        const hook = setInterval(() => {
            const custom = document.getElementById('custom-style');
            if (custom) {
                clearInterval(hook);
                new MutationObserver(scheduleFull)
                    .observe(custom, { childList: true, characterData: true, subtree: true });
            } else if (++tries > 40) clearInterval(hook);
        }, 500);

        // новые сообщения / смена чата
        const chat = document.getElementById('chat');
        if (chat) {
            new MutationObserver(scheduleChat).observe(chat, { childList: true, subtree: true });
        }
    }

    // ====== старт ======
    let tries = 0;
    const wait = setInterval(() => {
        const a = addButton();
        const b = buildPanel();
        if ((a && b) || ++tries > 60) {
            clearInterval(wait);
            watch();
            setupAuto();
            setTimeout(() => refresh(), 1500);
        }
    }, 500);

    // для отладки из консоли браузера
    window.themeFlip = { refresh, TUNE, get settings() { return settings; }, importText, loadPresets };
})();
