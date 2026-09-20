// Estimated income-tax set-aside for a pass-through LLC (partnership / sole prop treatment).
// Pure functions — safe to use on the client. Tables are for tax year 2026 and are estimates:
// they ignore other household income, credits, itemized deductions, PTE elections and local quirks.
export const TAX_YEAR = 2026;

const bracketTax = (taxable, brackets) => {
  let tax = 0, lower = 0;
  for (const [upper, rate] of brackets) {
    if (taxable <= lower) break;
    tax += (Math.min(taxable, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
};
const clamp0 = (n) => Math.max(0, n);

const FEDERAL = {
  single:  { standard: 16100, brackets: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]] },
  married: { standard: 32200, brackets: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]] },
};
const SE = { taxableShare: 0.9235, socialSecurity: 0.124, ssWageBase: 184500, medicare: 0.029, addlMedicare: 0.009, addlThreshold: { single: 200000, married: 250000 } };

export const STATES = {
  MD: {
    name: "Maryland", local: { label: "County tax rate (%)", defaultRate: 3.2 },
    standard: { single: 3350, married: 6700 },
    brackets: {
      single:  [[1000, .02], [2000, .03], [3000, .04], [100000, .0475], [125000, .05], [150000, .0525], [250000, .055], [500000, .0575], [1000000, .0625], [Infinity, .065]],
      married: [[1000, .02], [2000, .03], [3000, .04], [150000, .0475], [175000, .05], [225000, .0525], [300000, .055], [500000, .0575], [1200000, .0625], [Infinity, .065]],
    },
  },
  NY: {
    name: "New York State", standard: { single: 8000, married: 16050 },
    brackets: {
      single:  [[8500, .039], [11700, .044], [13900, .0515], [80650, .054], [215400, .0575], [1077550, .0685], [5000000, .0965], [25000000, .103], [Infinity, .109]],
      married: [[17150, .039], [23600, .044], [27900, .0515], [161550, .054], [323200, .0575], [2155350, .0685], [5000000, .0965], [25000000, .103], [Infinity, .109]],
    },
  },
  NYC: {
    name: "New York State + NYC", standard: { single: 8000, married: 16050 }, inherits: "NY",
    city: {
      single:  [[12000, .03078], [25000, .03762], [50000, .03819], [Infinity, .03876]],
      married: [[21600, .03078], [45000, .03762], [90000, .03819], [Infinity, .03876]],
    },
    // NYC Unincorporated Business Tax: 4% at the business level, with the small-business credit phasing out $85k→$135k.
    ubt: { rate: 0.04, exemption: 5000, creditFull: 85000, creditNone: 135000 },
  },
  DC: {
    name: "District of Columbia", standard: { single: 16100, married: 32200 },
    brackets: { single: [[10000, .04], [40000, .06], [60000, .065], [250000, .085], [500000, .0925], [1000000, .0975], [Infinity, .1075]] },
  },
  VA: {
    name: "Virginia", standard: { single: 8750, married: 17500 },
    brackets: { single: [[3000, .02], [5000, .03], [17000, .05], [Infinity, .0575]] },
  },
  NONE: { name: "No state income tax", standard: { single: 0, married: 0 }, brackets: { single: [] } },
};
const stateBrackets = (st, status) => st.brackets[status] || st.brackets.single;

export function estimateTaxes({ netIncome = 0, owners = 1, filing = "single", state = "MD", localRate = null }) {
  const status = filing === "married" ? "married" : "single";
  const n = Math.max(1, Number(owners) || 1);
  const profit = clamp0(netIncome);
  const share = profit / n;
  const fed = FEDERAL[status];
  const st = STATES[state] || STATES.NONE;
  const base = st.inherits ? STATES[st.inherits] : st;

  // Self-employment tax on each owner's share
  const seBase = share * SE.taxableShare;
  const seTax = Math.min(seBase, SE.ssWageBase) * SE.socialSecurity + seBase * SE.medicare + clamp0(seBase - SE.addlThreshold[status]) * SE.addlMedicare;
  const halfSe = seTax / 2;

  // Federal: AGI = share − ½ SE tax; 20% QBI deduction (capped at 20% of taxable income); standard deduction
  const agi = clamp0(share - halfSe);
  const taxableBeforeQbi = clamp0(agi - fed.standard);
  const qbi = Math.min(0.20 * agi, 0.20 * taxableBeforeQbi);
  const fedTaxable = clamp0(taxableBeforeQbi - qbi);
  const fedTax = bracketTax(fedTaxable, fed.brackets);

  // State (no QBI deduction at state level)
  const stateTaxable = clamp0(agi - (base.standard[status] ?? base.standard.single));
  const stateTax = bracketTax(stateTaxable, stateBrackets(base, status));
  const localPct = localRate == null ? (st.local?.defaultRate ?? 0) : Number(localRate) || 0;
  const localTax = st.local ? stateTaxable * (localPct / 100) : 0;
  const cityTax = st.city ? bracketTax(stateTaxable, st.city[status] || st.city.single) : 0;

  // Business-level tax (NYC UBT) — computed once on the whole profit, not per owner
  let ubtTax = 0;
  if (st.ubt) {
    const ubtIncome = clamp0(profit - st.ubt.exemption - Math.min(0.20 * profit, 10000 * n));
    const gross = ubtIncome * st.ubt.rate;
    const credit = ubtIncome <= st.ubt.creditFull ? 1 : ubtIncome >= st.ubt.creditNone ? 0 : (st.ubt.creditNone - ubtIncome) / (st.ubt.creditNone - st.ubt.creditFull);
    ubtTax = gross * (1 - credit);
  }

  const perOwner = { share, seTax, fedTax, stateTax, localTax, cityTax, total: seTax + fedTax + stateTax + localTax + cityTax };
  const total = perOwner.total * n + ubtTax;
  const rows = [
    { key: "se", label: "Self-employment tax (Social Security + Medicare)", amount: seTax * n },
    { key: "fed", label: "Federal income tax", amount: fedTax * n },
    { key: "state", label: `${base.name} income tax`, amount: stateTax * n },
  ];
  if (st.local) rows.push({ key: "local", label: `${st.name.replace("Maryland", "Maryland county")} tax @ ${localPct}%`, amount: localTax * n });
  if (st.city) rows.push({ key: "city", label: "New York City resident tax", amount: cityTax * n });
  if (st.ubt) rows.push({ key: "ubt", label: "NYC Unincorporated Business Tax", amount: ubtTax });

  return {
    year: TAX_YEAR, profit, owners: n, filing: status, state, stateName: st.name,
    total, effectiveRate: profit > 0 ? total / profit : 0,
    perOwner, rows,
    assumptions: [
      `${n} owner${n === 1 ? "" : "s"} splitting profit equally, each filing ${status === "married" ? "married jointly" : "single"} with no other income`,
      `Federal ${TAX_YEAR} brackets, standard deduction and the 20% QBI deduction; half of self-employment tax deducted`,
      `${st.name} brackets and standard deduction${st.local ? `, county rate ${localPct}%` : ""}`,
      "Pass-through (partnership / sole-prop) treatment — no S-corp salary split, credits, or PTE election",
    ],
  };
}

// Federal estimated-tax due dates (state dates generally match)
export function nextQuarterlyDue(today = new Date()) {
  const y = today.getFullYear();
  const dates = [new Date(y, 3, 15), new Date(y, 5, 15), new Date(y, 8, 15), new Date(y + 1, 0, 15)];
  const next = dates.find(d => d >= today) || new Date(y + 1, 3, 15);
  const quarter = { 3: "Q1", 5: "Q2", 8: "Q3", 0: "Q4" }[next.getMonth()] || "Q1";
  return { date: next, label: `${quarter} estimated payment`, iso: next.toISOString().split("T")[0] };
}
