// ─── Helpers ──────────────────────────────────────────────
function toBinary(n, bits) {
    const mask = (1 << bits) - 1;
    return (n & mask).toString(2).padStart(bits, '0');
}

function asr(A, Q, Q1, n) {
    const combined = (A << (n + 1)) | (Q << 1) | Q1;
    const signBit = (A >> (n - 1)) & 1;
    let shifted = combined >> 1;
    if (signBit === 1) {
        const topMask = ~((1 << (2 * n)) - 1);
        shifted |= topMask;
    }
    const newA = (shifted >> (n + 1)) & ((1 << n) - 1);
    const newQ = (shifted >> 1) & ((1 << n) - 1);
    const newQ1 = shifted & 1;
    return [newA, newQ, newQ1];
}

function highlightQ(qBin, isShift) {
    if (!isShift) return qBin;
    const lsb = qBin[qBin.length - 1];
    const rest = qBin.slice(0, -1);
    return rest + `<span class="highlight-lsb">${lsb}</span>`;
}

function highlightQminus1(val, isShift) {
    if (!isShift) return String(val);
    return `<span class="highlight-qminus1">${val}</span>`;
}

function formatQ0Qminus1(q0, qminus1) {
    return `<span class="q0qminus1-display"><span class="q0">${q0}</span><span class="qminus1">${qminus1}</span></span>`;
}

// ─── Booth's algorithm ────────────────────────────────────
function boothAlgorithmWithSteps(multiplier, multiplicand, n) {
    const maxVal = (1 << (n - 1)) - 1;
    const minVal = -(1 << (n - 1));
    if (multiplier < minVal || multiplier > maxVal ||
        multiplicand < minVal || multiplicand > maxVal) {
        throw new Error(`Values must be in range [${minVal}, ${maxVal}] for ${n}-bit two's complement.`);
    }

    const mask = (1 << n) - 1;
    const M = multiplicand & mask;
    const Q = multiplier & mask;
    const M1 = ((~M) + 1) & mask;

    let A = 0;
    let Qreg = Q;
    let Qminus1 = 0;
    let count = n;
    const rows = [];

    // ── Init row ──
    rows.push({
        type: 'init',
        aDisplay: toBinary(A, n),
        qBin: toBinary(Qreg, n),
        qMinus1: Qminus1,
        q0: Qreg & 1,
        mBin: toBinary(M, n),
        m1Bin: toBinary(M1, n),
        count: count,
        remark: 'Initialization',
        badgeClass: 'badge-init'
    });

    // ── Iterations ──
    while (count > 0) {
        const Q0 = Qreg & 1;
        let opType = 'noop';
        let remark = '';
        let badgeClass = 'badge-noop';
        let aBefore = A;
        let aOperand = 0;
        let aResult = A;
        let carry = false;
        let opSymbol = '';

        if (Q0 === 0 && Qminus1 === 1) {
            const sum = A + M;
            aOperand = M;
            aResult = sum & mask;
            carry = (sum & ~mask) !== 0;
            opType = 'add';
            remark = 'A ← A + M  (Q₀Q₋₁ = 01)';
            badgeClass = 'badge-add';
            opSymbol = '+';
            A = aResult;
        } else if (Q0 === 1 && Qminus1 === 0) {
            const sum = A + M1;
            aOperand = M1;
            aResult = sum & mask;
            carry = (sum & ~mask) !== 0;
            opType = 'sub';
            remark = 'A ← A − M  (Q₀Q₋₁ = 10)';
            badgeClass = 'badge-sub';
            opSymbol = '−';
            A = aResult;
        } else {
            opType = 'noop';
            remark = 'No operation (Q₀Q₋₁ = 00 or 11)';
            badgeClass = 'badge-noop';
            opSymbol = '—';
            aResult = A;
            carry = false;
        }

        // ── Build multi‑line A display for full detail mode ──
        let aDisplayLines = [];
        if (opType === 'add' || opType === 'sub') {
            const aBeforeStr = toBinary(aBefore, n);
            const aOperandStr = toBinary(aOperand, n);
            const aResultStr = toBinary(aResult, n);
            const fullSum = aBefore + aOperand;
            const fullSumStr = fullSum.toString(2).padStart(n + 1, '0');
            aDisplayLines.push(`  ${aBeforeStr}`);
            aDisplayLines.push(`+ ${aOperandStr}`);
            aDisplayLines.push(`───────`);
            if (carry) {
                aDisplayLines.push(`= ${fullSumStr}`);
                aDisplayLines.push(`  <span class="discard">discard 1</span>`);
                aDisplayLines.push(`  <span class="result">${aResultStr}</span>`);
            } else {
                aDisplayLines.push(`= <span class="result">${fullSumStr}</span>`);
            }
        } else {
            aDisplayLines.push(`  ${toBinary(aBefore, n)}`);
            aDisplayLines.push(`  (unchanged)`);
        }

        // ── Store the result value (truncated) for simplified view ──
        const resultValue = toBinary(aResult, n);

        // ── Operation row ──
        rows.push({
            type: 'operation',
            aDisplayLines: aDisplayLines,
            resultValue: resultValue,
            qBin: toBinary(Qreg, n),
            qMinus1: Qminus1,
            q0: Q0,
            mBin: '-',
            m1Bin: '-',
            count: '-',
            remark: remark,
            badgeClass: badgeClass
        });

        // ── Arithmetic Shift Right ──
        const [newA, newQ, newQminus1] = asr(A, Qreg, Qminus1, n);
        A = newA;
        Qreg = newQ;
        Qminus1 = newQminus1;
        count--;

        // ── Shift row ──
        rows.push({
            type: 'shift',
            aDisplay: toBinary(A, n),
            qBin: toBinary(Qreg, n),
            qMinus1: Qminus1,
            q0: Qreg & 1,
            mBin: '-',
            m1Bin: '-',
            count: count,
            remark: 'Arithmetic Shift Right (A Q Q₋₁)',
            badgeClass: 'badge-asr'
        });
    }

    return rows;
}

// ─── DOM ──────────────────────────────────────────────────
const multiplicandInput = document.getElementById('multiplicand');
const multiplierInput = document.getElementById('multiplier');
const bitWidthInput = document.getElementById('bitWidth');
const calcBtn = document.getElementById('calcBtn');
const messageEl = document.getElementById('message');
const resultSummary = document.getElementById('resultSummary');
const displayM = document.getElementById('displayM');
const displayQ = document.getElementById('displayQ');
const displayM1 = document.getElementById('displayM1');
const iterCount = document.getElementById('iterCount');
const tableControls = document.getElementById('tableControls');
const tableWrap = document.getElementById('tableWrap');
const tableBody = document.getElementById('tableBody');
const finalExpansion = document.getElementById('finalExpansion');
const resultControls = document.getElementById('resultControls');
const showStepsToggle = document.getElementById('showStepsToggle');
const wrapToggle = document.getElementById('wrapToggle');
const themeToggle = document.getElementById('themeToggle');
const container = document.getElementById('container');

// ─── Theme toggle ───
themeToggle.addEventListener('change', function() {
    if (this.checked) {
        container.setAttribute('data-theme', 'dark');
    } else {
        container.setAttribute('data-theme', 'light');
    }
});
// default dark
container.setAttribute('data-theme', 'dark');
themeToggle.checked = true;

// ─── Wrap toggle ───
wrapToggle.addEventListener('change', function() {
    if (this.checked) {
        finalExpansion.classList.add('wrap-mode');
    } else {
        finalExpansion.classList.remove('wrap-mode');
    }
});

function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = 'message ' + type;
}
function hideMessage() {
    messageEl.className = 'message';
    messageEl.textContent = '';
}

function compute() {
    hideMessage();
    resultSummary.style.display = 'none';
    tableControls.style.display = 'none';
    tableWrap.style.display = 'none';
    finalExpansion.style.display = 'none';
    resultControls.style.display = 'none';

    const multiplicand = parseInt(multiplicandInput.value);
    const multiplier = parseInt(multiplierInput.value);
    const n = parseInt(bitWidthInput.value);

    if (isNaN(multiplicand) || isNaN(multiplier) || isNaN(n)) {
        showMessage('Please enter valid numbers.', 'error');
        return;
    }
    if (n < 2 || n > 16) {
        showMessage('Bit width must be between 2 and 16.', 'error');
        return;
    }
    const maxVal = (1 << (n - 1)) - 1;
    const minVal = -(1 << (n - 1));
    if (multiplicand < minVal || multiplicand > maxVal) {
        showMessage(`Multiplicand must be in [${minVal}, ${maxVal}] for ${n}-bit two's complement.`, 'error');
        return;
    }
    if (multiplier < minVal || multiplier > maxVal) {
        showMessage(`Multiplier must be in [${minVal}, ${maxVal}] for ${n}-bit two's complement.`, 'error');
        return;
    }

    try {
        const allRows = boothAlgorithmWithSteps(multiplier, multiplicand, n);

        const M_val = multiplicand & ((1 << n) - 1);
        const M1_val = ((~M_val) + 1) & ((1 << n) - 1);
        displayM.textContent = toBinary(M_val, n) + ' (' + multiplicand + ')';
        displayQ.textContent = toBinary(multiplier & ((1 << n) - 1), n) + ' (' + multiplier + ')';
        displayM1.textContent = toBinary(M1_val, n) + ' (' + (-multiplicand) + ')';
        const shiftRows = allRows.filter(r => r.type === 'shift');
        iterCount.textContent = shiftRows.length;
        resultSummary.style.display = 'flex';

        // ─── Determine display mode ───
        const showFullArithmetic = showStepsToggle.checked;

        // ─── Render table ───
        tableBody.innerHTML = '';
        allRows.forEach((row) => {
            const tr = document.createElement('tr');

            // ─── A column ───
            const tdA = document.createElement('td');
            if (row.type === 'operation') {
                if (showFullArithmetic) {
                    const stack = document.createElement('div');
                    stack.className = 'a-stack';
                    row.aDisplayLines.forEach(line => {
                        const span = document.createElement('span');
                        span.className = 'line';
                        if (line.includes('<span')) {
                            span.innerHTML = line;
                        } else {
                            span.textContent = line;
                            if (line.includes('+') || line.includes('−')) span.classList.add('op-symbol');
                            else if (line.includes('────')) span.classList.add('dash');
                        }
                        stack.appendChild(span);
                    });
                    tdA.appendChild(stack);
                } else {
                    const resultSpan = document.createElement('span');
                    resultSpan.style.color = 'var(--result-green)';
                    resultSpan.style.fontWeight = '700';
                    resultSpan.textContent = row.resultValue;
                    tdA.appendChild(resultSpan);
                }
            } else {
                tdA.textContent = row.aDisplay;
            }
            tr.appendChild(tdA);

            // ─── Q ───
            const tdQ = document.createElement('td');
            const isShift = (row.type === 'shift');
            tdQ.innerHTML = highlightQ(row.qBin, isShift);
            tr.appendChild(tdQ);

            // ─── Q₋₁ ───
            const tdQminus1 = document.createElement('td');
            tdQminus1.innerHTML = highlightQminus1(row.qMinus1, isShift);
            tr.appendChild(tdQminus1);

            // ─── M ───
            const tdM = document.createElement('td');
            tdM.textContent = row.mBin;
            tr.appendChild(tdM);

            // ─── M'+1 ───
            const tdM1 = document.createElement('td');
            tdM1.textContent = row.m1Bin;
            tr.appendChild(tdM1);

            // ─── Q₀Q₋₁ ───
            const tdQ0Qminus1 = document.createElement('td');
            tdQ0Qminus1.innerHTML = formatQ0Qminus1(row.q0, row.qMinus1);
            tr.appendChild(tdQ0Qminus1);

            // ─── count ───
            const tdCount = document.createElement('td');
            tdCount.textContent = row.count;
            tr.appendChild(tdCount);

            // ─── Remarks ───
            const tdRemark = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = 'badge ' + row.badgeClass;
            badge.textContent = row.remark;
            tdRemark.appendChild(badge);
            tr.appendChild(tdRemark);

            tableBody.appendChild(tr);
        });

        tableWrap.style.display = 'block';
        tableControls.style.display = 'flex';

        // ─── Final expansion (always shown, scrollable on mobile) ───
        const lastShift = [...allRows].reverse().find(r => r.type === 'shift');
        const lastRow = lastShift || allRows[allRows.length - 1];
        const A_bin = lastRow.aDisplay || '0';
        const Q_bin = lastRow.qBin;
        const combined = A_bin + Q_bin;
        const len = combined.length;

        let powerTerms = [];
        let numericTerms = [];
        let total = 0;
        for (let i = 0; i < len; i++) {
            const pos = len - 1 - i;
            const weight = (i === 0) ? -Math.pow(2, pos) : Math.pow(2, pos);
            const bit = combined[i];
            if (bit === '1') {
                const powerStr = (i === 0) ? `-2<sup>${pos}</sup>` : `+2<sup>${pos}</sup>`;
                const powerClass = (i === 0) ? 'highlight-orange' : 'highlight';
                const numValue = (i === 0) ? -Math.pow(2, pos) : Math.pow(2, pos);
                const numStr = (i === 0) ? `${numValue}` : `+${numValue}`;
                const numClass = (i === 0) ? 'highlight-orange' : 'highlight';
                powerTerms.push(`<span class="${powerClass}">${powerStr}</span>`);
                numericTerms.push(`<span class="${numClass}">${numStr}</span>`);
                total += (i === 0 ? -Math.pow(2, pos) : Math.pow(2, pos));
            } else {
                const powerStr = (i === 0) ? `0·2<sup>${pos}</sup>` : `+0·2<sup>${pos}</sup>`;
                const numStr = (i === 0) ? '0' : '+0';
                powerTerms.push(`<span class="zero-term">${powerStr}</span>`);
                numericTerms.push(`<span class="zero-term">${numStr}</span>`);
            }
        }

        let powerLine = powerTerms.join(' ');
        if (len > 0 && combined[0] === '0') {
            powerLine = powerLine.replace(/^\+0·2<sup>\d+<\/sup> /, '');
        }
        let numericLine = numericTerms.join(' ');
        if (len > 0 && combined[0] === '0') {
            numericLine = numericLine.replace(/^\+0 /, '');
        }

        finalExpansion.innerHTML = `
            <div style="font-weight:600; margin-bottom:4px; font-size:18px; font-family:'Caveat',cursive; white-space:nowrap;">
                Result in AQ = <span class="highlight">${A_bin} ${Q_bin}</span>
            </div>
            <div class="line-wrapper">
                <span class="eq-sign">=</span> <span class="line-content">${powerLine}</span>
            </div>
            <div class="line-wrapper">
                <span class="eq-sign">=</span> <span class="line-content">${numericLine}</span>
            </div>
            <div class="line-wrapper result-line">
                <span class="eq-sign">=</span> <span class="highlight-green">${total}</span>
            </div>
        `;
        finalExpansion.style.display = 'block';
        resultControls.style.display = 'flex';

        // ─── Apply wrap mode state ───
        if (wrapToggle.checked) {
            finalExpansion.classList.add('wrap-mode');
        } else {
            finalExpansion.classList.remove('wrap-mode');
        }

        // ─── Scroll ───
        setTimeout(() => {
            tableWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

    } catch (err) {
        showMessage(err.message, 'error');
    }
}

// ─── Toggle: re‑compute when toggled ───
showStepsToggle.addEventListener('change', compute);

calcBtn.addEventListener('click', compute);
[multiplicandInput, multiplierInput, bitWidthInput].forEach(inp => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') compute(); });
});
window.addEventListener('DOMContentLoaded', compute);