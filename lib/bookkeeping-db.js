import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

function toISODate(d) {
  if (!d) return null;
  const s = String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
  return null;
}

// ── GET ALL BOOKKEEPING DATA ──
export async function getBookkeepingData(year, month) {
  let dateFilter = "";
  let startDate = null;
  let endDate = null;

  if (year && month) {
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  } else if (year) {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  const [accounts, categories, transactions, payroll, contractors, contractorPayments] = await Promise.all([
    sql`SELECT * FROM bk_accounts ORDER BY name`,
    sql`SELECT * FROM bk_categories ORDER BY sort_order, name`,
    startDate && endDate
      ? sql`SELECT * FROM bk_transactions WHERE date >= ${startDate} AND date <= ${endDate} ORDER BY date DESC, created_at DESC`
      : sql`SELECT * FROM bk_transactions ORDER BY date DESC, created_at DESC`,
    startDate && endDate
      ? sql`SELECT * FROM bk_payroll_records WHERE pay_date >= ${startDate} AND pay_date <= ${endDate} ORDER BY pay_date DESC`
      : sql`SELECT * FROM bk_payroll_records ORDER BY pay_date DESC`,
    sql`SELECT * FROM bk_contractors ORDER BY name`,
    startDate && endDate
      ? sql`SELECT * FROM bk_contractor_payments WHERE pay_date >= ${startDate} AND pay_date <= ${endDate} ORDER BY pay_date DESC`
      : sql`SELECT * FROM bk_contractor_payments ORDER BY pay_date DESC`,
  ]);

  // Compute 1099 totals per contractor for the given year (or all time)
  const totalsQuery = year
    ? await sql`SELECT contractor_id, SUM(amount) as total FROM bk_contractor_payments WHERE year = ${year} GROUP BY contractor_id`
    : await sql`SELECT contractor_id, year, SUM(amount) as total FROM bk_contractor_payments GROUP BY contractor_id, year`;

  const contractorTotals = {};
  for (const row of totalsQuery) {
    const cid = row.contractor_id;
    const total = parseFloat(row.total);
    if (!contractorTotals[cid]) contractorTotals[cid] = {};
    const y = year || row.year;
    contractorTotals[cid][y] = { total, flagged: total >= 600 };
  }

  return {
    accounts: accounts.map(a => ({ id: a.id, name: a.name, accountType: a.account_type })),
    categories: categories.map(c => ({ id: c.id, name: c.name, type: c.type, parent: c.parent, sortOrder: c.sort_order })),
    transactions: transactions.map(t => ({
      id: t.id, date: toISODate(t.date) || "", description: t.description, name: t.name,
      amount: parseFloat(t.amount), categoryId: t.category_id, accountId: t.account_id,
      type: t.type, vendor: t.vendor, reference: t.reference, notes: t.notes,
      reconciled: t.reconciled, reviewed: t.reviewed, source: t.source,
      importBatchId: t.import_batch_id,
    })),
    payroll: payroll.map(p => ({
      id: p.id, employeeName: p.employee_name, payDate: toISODate(p.pay_date) || "",
      payPeriodStart: toISODate(p.pay_period_start) || "", payPeriodEnd: toISODate(p.pay_period_end) || "",
      grossPay: parseFloat(p.gross_pay), netPay: parseFloat(p.net_pay),
      federalWithholding: parseFloat(p.federal_withholding), stateWithholding: parseFloat(p.state_withholding),
      ficaSs: parseFloat(p.fica_ss), ficaMedicare: parseFloat(p.fica_medicare),
      ficaEmployerSs: parseFloat(p.fica_employer_ss), ficaEmployerMedicare: parseFloat(p.fica_employer_medicare),
      otherDeductions: parseFloat(p.other_deductions), notes: p.notes, transactionId: p.transaction_id,
    })),
    contractors: contractors.map(c => ({
      id: c.id, name: c.name, businessName: c.business_name, einLast4: c.ein_last4,
      email: c.email, address: c.address,
    })),
    contractorPayments: contractorPayments.map(cp => ({
      id: cp.id, contractorId: cp.contractor_id, transactionId: cp.transaction_id,
      amount: parseFloat(cp.amount), payDate: toISODate(cp.pay_date) || "",
      description: cp.description, year: cp.year,
    })),
    contractorTotals,
  };
}

// ── P&L DATA ──
export async function getPnLData(startDate, endDate) {
  const rows = await sql`
    SELECT bc.id as category_id, bc.type, bc.name as category_name, bc.parent, bc.sort_order,
           COALESCE(SUM(ABS(bt.amount)), 0) as total
    FROM bk_categories bc
    LEFT JOIN bk_transactions bt ON bt.category_id = bc.id
      AND bt.date >= ${startDate} AND bt.date <= ${endDate}
    GROUP BY bc.id, bc.type, bc.name, bc.parent, bc.sort_order
    ORDER BY bc.sort_order, bc.name
  `;
  return rows.map(r => ({
    categoryId: r.category_id, type: r.type, categoryName: r.category_name,
    parent: r.parent, sortOrder: r.sort_order, total: parseFloat(r.total),
  }));
}

// ── TRANSACTIONS ──
export async function upsertTransaction(t) {
  await sql`
    INSERT INTO bk_transactions (id, date, description, name, amount, category_id, account_id, type, vendor, reference, notes, reconciled, reviewed, source, import_batch_id)
    VALUES (${t.id}, ${toISODate(t.date)}, ${t.description || ""}, ${t.name || ""}, ${t.amount}, ${t.categoryId || null}, ${t.accountId || null}, ${t.type || "expense"}, ${t.vendor || ""}, ${t.reference || ""}, ${t.notes || ""}, ${t.reconciled || false}, ${t.reviewed || false}, ${t.source || "manual"}, ${t.importBatchId || null})
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date, description = EXCLUDED.description, name = EXCLUDED.name,
      amount = EXCLUDED.amount, category_id = EXCLUDED.category_id, account_id = EXCLUDED.account_id,
      type = EXCLUDED.type, vendor = EXCLUDED.vendor, reference = EXCLUDED.reference,
      notes = EXCLUDED.notes, reconciled = EXCLUDED.reconciled, reviewed = EXCLUDED.reviewed
  `;
}

export async function bulkImportTransactions(transactions) {
  for (const t of transactions) {
    await upsertTransaction(t);
  }
}

export async function deleteTransaction(id) {
  await sql`DELETE FROM bk_transactions WHERE id = ${id}`;
}

export async function deleteBatch(batchId) {
  await sql`DELETE FROM bk_transactions WHERE import_batch_id = ${batchId}`;
}

export async function reconcileTransactions(ids, reconciled = true) {
  for (const id of ids) {
    await sql`UPDATE bk_transactions SET reconciled = ${reconciled} WHERE id = ${id}`;
  }
}

export async function reviewTransactions(ids, reviewed = true) {
  for (const id of ids) {
    await sql`UPDATE bk_transactions SET reviewed = ${reviewed} WHERE id = ${id}`;
  }
}

// ── PAYROLL ──
export async function upsertPayroll(p) {
  // Create or update the linked transaction
  const txnId = p.transactionId || p.id + "_txn";
  await sql`
    INSERT INTO bk_transactions (id, date, description, name, amount, category_id, type, source)
    VALUES (${txnId}, ${toISODate(p.payDate)}, ${`Payroll - ${p.employeeName}`}, ${`Payroll: ${p.employeeName}`}, ${-(Math.abs(parseFloat(p.grossPay) || 0))}, 'bkc_wages', 'expense', 'payroll')
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date, description = EXCLUDED.description, name = EXCLUDED.name,
      amount = EXCLUDED.amount
  `;
  await sql`
    INSERT INTO bk_payroll_records (id, employee_name, pay_date, pay_period_start, pay_period_end, gross_pay, net_pay, federal_withholding, state_withholding, fica_ss, fica_medicare, fica_employer_ss, fica_employer_medicare, other_deductions, notes, transaction_id)
    VALUES (${p.id}, ${p.employeeName}, ${toISODate(p.payDate)}, ${toISODate(p.payPeriodStart)}, ${toISODate(p.payPeriodEnd)}, ${p.grossPay || 0}, ${p.netPay || 0}, ${p.federalWithholding || 0}, ${p.stateWithholding || 0}, ${p.ficaSs || 0}, ${p.ficaMedicare || 0}, ${p.ficaEmployerSs || 0}, ${p.ficaEmployerMedicare || 0}, ${p.otherDeductions || 0}, ${p.notes || ""}, ${txnId})
    ON CONFLICT (id) DO UPDATE SET
      employee_name = EXCLUDED.employee_name, pay_date = EXCLUDED.pay_date,
      pay_period_start = EXCLUDED.pay_period_start, pay_period_end = EXCLUDED.pay_period_end,
      gross_pay = EXCLUDED.gross_pay, net_pay = EXCLUDED.net_pay,
      federal_withholding = EXCLUDED.federal_withholding, state_withholding = EXCLUDED.state_withholding,
      fica_ss = EXCLUDED.fica_ss, fica_medicare = EXCLUDED.fica_medicare,
      fica_employer_ss = EXCLUDED.fica_employer_ss, fica_employer_medicare = EXCLUDED.fica_employer_medicare,
      other_deductions = EXCLUDED.other_deductions, notes = EXCLUDED.notes
  `;
}

export async function deletePayroll(id) {
  const rows = await sql`SELECT transaction_id FROM bk_payroll_records WHERE id = ${id}`;
  await sql`DELETE FROM bk_payroll_records WHERE id = ${id}`;
  if (rows[0]?.transaction_id) {
    await sql`DELETE FROM bk_transactions WHERE id = ${rows[0].transaction_id}`;
  }
}

// ── CONTRACTORS ──
export async function upsertContractor(c) {
  await sql`
    INSERT INTO bk_contractors (id, name, business_name, ein_last4, email, address)
    VALUES (${c.id}, ${c.name}, ${c.businessName || ""}, ${c.einLast4 || ""}, ${c.email || ""}, ${c.address || ""})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, business_name = EXCLUDED.business_name,
      ein_last4 = EXCLUDED.ein_last4, email = EXCLUDED.email, address = EXCLUDED.address
  `;
}

export async function deleteContractor(id) {
  await sql`DELETE FROM bk_contractors WHERE id = ${id}`;
}

export async function upsertContractorPayment(cp) {
  const txnId = cp.transactionId || cp.id + "_txn";
  const contractorRows = await sql`SELECT name FROM bk_contractors WHERE id = ${cp.contractorId}`;
  const contractorName = contractorRows[0]?.name || "Contractor";
  await sql`
    INSERT INTO bk_transactions (id, date, description, name, amount, category_id, type, source)
    VALUES (${txnId}, ${toISODate(cp.payDate)}, ${cp.description || `Payment to ${contractorName}`}, ${`1099: ${contractorName}`}, ${-(Math.abs(parseFloat(cp.amount) || 0))}, 'bkc_contractor', 'expense', 'manual')
    ON CONFLICT (id) DO UPDATE SET
      date = EXCLUDED.date, description = EXCLUDED.description, name = EXCLUDED.name,
      amount = EXCLUDED.amount
  `;
  const payYear = new Date(toISODate(cp.payDate)).getFullYear();
  await sql`
    INSERT INTO bk_contractor_payments (id, contractor_id, transaction_id, amount, pay_date, description, year)
    VALUES (${cp.id}, ${cp.contractorId}, ${txnId}, ${Math.abs(parseFloat(cp.amount) || 0)}, ${toISODate(cp.payDate)}, ${cp.description || ""}, ${payYear})
    ON CONFLICT (id) DO UPDATE SET
      contractor_id = EXCLUDED.contractor_id, amount = EXCLUDED.amount,
      pay_date = EXCLUDED.pay_date, description = EXCLUDED.description, year = EXCLUDED.year
  `;
}

export async function deleteContractorPayment(id) {
  const rows = await sql`SELECT transaction_id FROM bk_contractor_payments WHERE id = ${id}`;
  await sql`DELETE FROM bk_contractor_payments WHERE id = ${id}`;
  if (rows[0]?.transaction_id) {
    await sql`DELETE FROM bk_transactions WHERE id = ${rows[0].transaction_id}`;
  }
}

// ── ACCOUNTS ──
export async function upsertAccount(a) {
  await sql`
    INSERT INTO bk_accounts (id, name, account_type)
    VALUES (${a.id}, ${a.name}, ${a.accountType || "checking"})
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, account_type = EXCLUDED.account_type
  `;
}

export async function deleteAccount(id) {
  await sql`DELETE FROM bk_accounts WHERE id = ${id}`;
}

// ── CATEGORIES ──
export async function upsertBkCategory(c) {
  await sql`
    INSERT INTO bk_categories (id, name, type, parent, sort_order)
    VALUES (${c.id}, ${c.name}, ${c.type || "expense"}, ${c.parent || null}, ${c.sortOrder || 0})
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, type = EXCLUDED.type, parent = EXCLUDED.parent, sort_order = EXCLUDED.sort_order
  `;
}

export async function deleteBkCategory(id) {
  await sql`DELETE FROM bk_categories WHERE id = ${id}`;
}
