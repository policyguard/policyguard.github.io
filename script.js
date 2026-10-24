'use strict';

document.querySelectorAll('[data-copy]').forEach(button => {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = 'Copied';
      document.getElementById('copy-status').textContent = 'BibTeX copied to clipboard.';
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      selection.removeAllRanges();
      selection.addRange(range);
      button.textContent = 'Text selected';
      document.getElementById('copy-status').textContent = 'Citation selected. Press Control+C or Command+C to copy.';
    }
    window.setTimeout(() => { button.textContent = 'Copy BibTeX'; }, 2500);
  });
});

const modal = document.querySelector('#figure-dialog');
if (modal && typeof modal.showModal === 'function') {
  document.querySelectorAll('[data-zoom]').forEach(link => {
    link.addEventListener('click', event => {
      event.preventDefault();
      const image = link.querySelector('img');
      modal.querySelector('img').src = image.src;
      modal.querySelector('img').alt = image.alt;
      modal.showModal();
    });
  });
  modal.querySelector('button').addEventListener('click', () => modal.close());
  modal.addEventListener('click', event => { if (event.target === modal) modal.close(); });
}

const guideStates = [
  {title:'Identify the user', dialogue:'The user requests a flight change. Their identity has not been established.', result:'Ask for the user ID before looking up the reservation.', gate:'MUTATION GATE · CLOSED', node:0},
  {title:'Check the request against policy', dialogue:'The user has been identified and the reservation loaded. Eligibility still needs to be checked.', result:'Check fare eligibility and the requested flight before offering the change.', gate:'MUTATION GATE · CLOSED', node:2},
  {title:'Obtain explicit confirmation', dialogue:'The change is eligible and its details have been presented. The user has not yet confirmed.', result:'Ask the user to confirm the complete change summary before proceeding.', gate:'MUTATION GATE · CLOSED', node:3},
  {title:'Authorize the requested change', dialogue:'Identity, reservation details, eligibility, and explicit confirmation are grounded in the conversation.', result:'Recommend the change with the verified arguments, then check the tool result.', gate:'MUTATION GATE · OPEN', node:4}
];
const guardStates = [
  {title:'A required step is missing', dialogue:'The agent found a flight and proposed booking it. The conversation contains no insurance offer or explicit confirmation.', result:'Offer insurance and ask the user to confirm the complete booking summary before calling the booking tool.', gate:'BLOCK + REMEDIATION'},
  {title:'The prerequisites are satisfied', dialogue:'The conversation establishes the required details, records the insurance decision, and includes explicit confirmation.', result:'The proposed booking may proceed once the verifier finds every applicable policy requirement satisfied.', gate:'PASS'}
];
document.querySelectorAll('[data-demo]').forEach(demo => {
  const states = demo.dataset.demo === 'guide' ? guideStates : guardStates;
  demo.querySelectorAll('[data-state]').forEach(button => {
    button.addEventListener('click', () => {
      const state = states[Number(button.dataset.state)];
      demo.querySelectorAll('[data-state]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      for (const key of ['title', 'dialogue', 'result', 'gate']) demo.querySelector(`[data-output="${key}"]`).textContent = state[key];
      demo.querySelectorAll('[data-node]').forEach(node => {
        const current = Number(node.dataset.node) === state.node;
        node.classList.toggle('active', current);
        if (current) node.setAttribute('aria-current', 'step'); else node.removeAttribute('aria-current');
      });
    });
  });
});

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-15% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach(section => observer.observe(section));
}

(() => {
  'use strict';
  const root = document.querySelector('[data-explorer="policyguard"]');
  if (!root) return;

  // PolicyGuard v1, Table 2. Every row is [overall, refusal-required, mutation-required] Pass⁴.
  const data = {
    gpt: { name: 'GPT-5.4', values: [[0.460, 0.750, 0.192], [0.520, 0.875, 0.192], [0.480, 0.917, 0.077], [0.580, 1.000, 0.192]] },
    sonnet: { name: 'Claude Sonnet 4.6', values: [[0.720, 0.958, 0.500], [0.580, 1.000, 0.192], [0.740, 0.958, 0.538], [0.780, 1.000, 0.577]] },
    gemini: { name: 'Gemini 2.5 Pro', values: [[0.480, 0.750, 0.231], [0.440, 0.792, 0.115], [0.500, 0.750, 0.269], [0.600, 1.000, 0.231]] }
  };
  const methods = ['Baseline', 'ToolGuard', 'PG-Raw', 'PG-Checklist'];
  const slices = {
    overall: { index: 0, label: 'All 50 tasks', note: 'Pass⁴ requires success on all four trials for a task. Overall performance combines 24 refusal-required and 26 mutation-required tasks.' },
    refusal: { index: 1, label: 'Refusal required · 24 tasks', note: 'These tasks require refusal. PG-Checklist reliably refuses all 24 tasks on all four trials in each agent family. This task-level score is different from per-call violation recall.' },
    mutation: { index: 2, label: 'Mutation required · 26 tasks', note: 'These requests require a legitimate state-changing action. Refusing everything would score zero here. The paper does not find a pooled-significant mutation-only improvement over Baseline (p = 0.564).' }
  };
  let state = { agent: 'gpt', slice: 'overall' };
  const chart = root.querySelector('[data-guard-chart]');
  const svgNS = 'http://www.w3.org/2000/svg';
  function svgElement(name, attributes, content) {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attributes || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (content !== undefined) node.textContent = content;
    return node;
  }
  function renderChart(values, label) {
    const width = Math.max(240, Math.min(640, Math.round(chart.getBoundingClientRect().width || 640)));
    const barWidth = width - 24;
    const textSize = width < 420 ? 16 : 21;
    const svg = svgElement('svg', { viewBox: `0 0 ${width} 380`, role: 'img', 'aria-labelledby': 'guard-chart-title guard-chart-description', width: '100%' });
    svg.append(svgElement('title', { id: 'guard-chart-title' }, `${label}: Pass⁴ by system`));
    svg.append(svgElement('desc', { id: 'guard-chart-description' }, methods.map((method, i) => `${method}: ${values[i].toFixed(3)}`).join('; ') + '. Higher is better. Scale: zero to one.'));
    values.forEach((value, i) => {
      const y = 24 + i * 76;
      svg.append(svgElement('text', { x: 12, y, fill: 'var(--ink)', 'font-size': textSize, 'font-weight': i === 3 ? 700 : 500 }, methods[i]));
      svg.append(svgElement('text', { x: width - 12, y, fill: 'var(--ink)', 'font-size': textSize, 'text-anchor': 'end', 'font-weight': 600 }, value.toFixed(3)));
      svg.append(svgElement('rect', { x: 12, y: y + 12, width: barWidth, height: 23, rx: 4, fill: 'var(--soft)' }));
      svg.append(svgElement('rect', { x: 12, y: y + 12, width: barWidth * value, height: 23, rx: 4, fill: i === 3 ? 'var(--accent)' : '#9ba7b8' }));
    });
    [0, 0.5, 1].forEach(value => {
      const x = 12 + barWidth * value;
      svg.append(svgElement('line', { x1: x, x2: x, y1: 326, y2: 334, stroke: 'var(--muted)' }));
      svg.append(svgElement('text', { x, y: 358, fill: 'var(--muted)', 'font-size': width < 420 ? 14 : 19, 'text-anchor': value === 0 ? 'start' : value === 1 ? 'end' : 'middle' }, value.toFixed(1)));
    });
    chart.replaceChildren(svg);
  }
  function render() {
    const agent = data[state.agent];
    const slice = slices[state.slice];
    const values = agent.values.map(row => row[slice.index]);
    const delta = (values[3] - values[0]) * 100;
    root.querySelectorAll('[data-guard-agent]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.guardAgent === state.agent)));
    root.querySelectorAll('[data-guard-slice]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.guardSlice === state.slice)));
    const summary = root.querySelector('[data-guard-summary]');
    const headline = document.createElement('strong');
    headline.textContent = delta === 0 ? 'PG-Checklist matches Baseline on this task slice.' : `PG-Checklist: ${delta > 0 ? '+' : ''}${delta.toFixed(1)} percentage points ${delta > 0 ? 'over' : 'relative to'} Baseline.`;
    const detail = document.createElement('p');
    detail.textContent = `${agent.name} · ${slice.label} · Pass⁴: ${values[0].toFixed(3)} → ${values[3].toFixed(3)}.`;
    summary.replaceChildren(headline, detail);
    root.querySelector('[data-guard-note]').textContent = slice.note;
    renderChart(values, `${agent.name} · ${slice.label}`);
  }
  root.querySelectorAll('[data-guard-agent]').forEach(button => button.addEventListener('click', () => { state.agent = button.dataset.guardAgent; render(); }));
  root.querySelectorAll('[data-guard-slice]').forEach(button => button.addEventListener('click', () => { state.slice = button.dataset.guardSlice; render(); }));
  root.querySelector('[data-guard-reset]').addEventListener('click', () => { state = { agent: 'gpt', slice: 'overall' }; render(); });
  chart.hidden = false;
  render();
  root.querySelectorAll('button').forEach(button => { button.disabled = false; });
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      const agent = data[state.agent];
      const slice = slices[state.slice];
      renderChart(agent.values.map(row => row[slice.index]), `${agent.name} · ${slice.label}`);
    }).observe(chart);
  }
})();
