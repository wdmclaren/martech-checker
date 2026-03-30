export const runtime = "nodejs";

const AIRTABLE_API = "https://api.airtable.com/v0";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function isAllowedOrigin(origin) {
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return allowed.includes(origin);
}

async function airtableList(tableName, filterByFormula) {
  const url = new URL(
    `${AIRTABLE_API}/${process.env.AIRTABLE_BASE_ID}/${encodeURIComponent(tableName)}`
  );

  url.searchParams.set("pageSize", "100");

  if (filterByFormula) {
    url.searchParams.set("filterByFormula", filterByFormula);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}`
    }
  });

  if (!res.ok) {
    throw new Error(`Airtable error: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

function safeJsonParse(value) {
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function normalizeInput(body) {
  return {
    scenario: body.scenario || "",
    useCaseMode: body.useCaseMode || "",
    candidateCategory: body.candidateCategory || "",
    candidateVendor: body.candidateVendor || "",
    ordering: body.ordering || "",
    pos: body.pos || "",
    loyalty: body.loyalty || "",
    crm: body.crm || "",
    cdp: body.cdp || "",
    sms: Array.isArray(body.sms) ? body.sms : (body.sms ? [body.sms] : []),
    goals: Array.isArray(body.goals) ? body.goals : (body.goals ? [body.goals] : [])
  };
}

function evalConditions(node, input) {
  if (node.all) return node.all.every((n) => evalConditions(n, input));
  if (node.any) return node.any.some((n) => evalConditions(n, input));

  const field = node.field;
  const value = input[field];

  if (node.equals !== undefined) return value === node.equals;
  if (node.notEquals !== undefined) return value !== node.notEquals;

  if (node.in) {
    return Array.isArray(node.in) && node.in.includes(value);
  }

  if (node.includes !== undefined) {
    if (Array.isArray(value)) return value.includes(node.includes);
    return false;
  }

  if (node.excludes !== undefined) {
    if (Array.isArray(value)) return !value.includes(node.excludes);
    return true;
  }

  if (node.isEmpty) {
    if (Array.isArray(value)) return value.length === 0;
    return !value;
  }

  if (node.notEmpty) {
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  }

  return false;
}

export async function OPTIONS(req) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");

  const sameOrigin =
    origin && host && origin === `https://${host}`;

  const allowOrigin = sameOrigin
    ? origin
    : origin
      ? (isAllowedOrigin(origin) ? origin : "")
      : "*";

  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowOrigin)
  });
}

function buildSummary(input, score, topRisks) {
  const goalsText = input.goals.length
    ? input.goals.join(", ")
    : "the selected use case";

  const candidateText =
    input.candidateVendor && input.candidateCategory
      ? ` The scenario focuses on ${input.candidateVendor} in ${input.candidateCategory}.`
      : "";

  if (score >= 80) {
    return `This scenario appears to be a strong fit for ${goalsText}.${candidateText} The main focus should be validating implementation details, ownership, and any reporting dependencies.`;
  }

  if (score >= 55) {
    return `This scenario looks workable for ${goalsText}, but there are important considerations that should be clarified before moving forward.${candidateText}`;
  }

  return `This scenario shows meaningful compatibility or implementation risk for ${goalsText}.${candidateText} You should validate architecture, ownership, and vendor limitations before making a decision.`;
}

function buildRecommendedNextSteps(topRisks, input) {
  const steps = [];

  if (input.scenario === "add-vendor") {
    steps.push("Validate how the new vendor will fit into your existing stack before implementation.");
  }

  if (input.scenario === "compare-vendors") {
    steps.push("Compare vendor capabilities against your highest-priority use cases, not just feature lists.");
  }

  if (input.scenario === "evaluate-stack") {
    steps.push("Document which systems own core responsibilities across your current stack.");
  }

  if (input.scenario === "use-case-support") {
    steps.push("Confirm whether this use case is handled natively, through integration, or with custom work.");
  }

  if (topRisks.some((r) => r.category === "Identity")) {
    steps.push("Clarify the source of truth for guest identity, segmentation, and consent.");
  }

  if (topRisks.some((r) => r.category === "Data")) {
    steps.push("Define the data and measurement approach needed to support this use case.");
  }

  if (topRisks.some((r) => r.category === "Integration")) {
    steps.push("Confirm whether the required vendor connections are native, middleware-based, or custom.");
  }

  if (topRisks.some((r) => r.category === "Offers")) {
    steps.push("Map where offer creation, validation, redemption, and reporting will occur.");
  }

  if (steps.length === 0) {
    steps.push("Validate the use case with each vendor before committing to implementation.");
  }

  return [...new Set(steps)].slice(0, 5);
}

function buildVendorQuestions(topRisks) {
  const questions = [];

  topRisks.forEach((risk) => {
    (risk.questions || []).forEach((q) => {
      if (!questions.includes(q)) {
        questions.push(q);
      }
    });
  });

  return questions.slice(0, 6);
}

export async function POST(req) {
  try {
    const origin = req.headers.get("origin");
const host = req.headers.get("host");

const sameOrigin =
  origin && host && origin === `https://${host}`;

const allowOrigin = sameOrigin
  ? origin
  : origin
    ? (isAllowedOrigin(origin) ? origin : "")
    : "*";

if (origin && !allowOrigin) {
  return new Response(
    JSON.stringify({
      error: "Forbidden origin",
      requestOrigin: origin,
      host,
      allowedOrigins: process.env.ALLOWED_ORIGINS
    }),
    {
      status: 403,
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
}

    const body = await req.json();
    const input = normalizeInput(body);

    const rulesTable = process.env.AIRTABLE_TABLE_RULES || "Rules";
    const rulesRes = await airtableList(rulesTable, "Active=TRUE()");

console.log("RAW AIRTABLE RULE FIELDS:");
console.log(JSON.stringify(rulesRes.records.slice(0, 3).map(r => r.fields), null, 2));

    const rules = rulesRes.records.map((record) => {
      const f = record.fields || {};

      return {
        name: f.Name,
        severity: f.Severity,
        scoreImpact: Number(f.ScoreImpact || 0),
        category: f.Category,
        conditions: safeJsonParse(f.ConditionsJSON),
        riskTitle: f.RiskTitle,
        riskDetail: f.RiskDetail,
        questions: safeJsonParse(f.QuestionsJSON) || [],
        recommendations: safeJsonParse(f.RecommendationsJSON) || []
      };
    });

    console.log(
  rules.map((r) => ({
    name: r.name,
    riskTitle: r.riskTitle
  }))
);

    let score = 100;
    const hits = [];

    for (const rule of rules) {
      if (!rule.conditions) continue;

      const matched = evalConditions(rule.conditions, input);

      if (matched) {
        score += rule.scoreImpact;

        hits.push({
          name: rule.name,
          severity: rule.severity,
          category: rule.category,
          scoreImpact: rule.scoreImpact,
          riskTitle: rule.riskTitle,
          riskDetail: rule.riskDetail,
          questions: rule.questions,
          recommendations: rule.recommendations
        });
      }
    }

    score = Math.max(0, Math.min(100, score));

    const severityRank = {
      critical: 3,
      warning: 2,
      info: 1
    };

    hits.sort((a, b) => {
      const sevDiff = (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      return a.scoreImpact - b.scoreImpact;
    });

    const topRisks = hits.slice(0, 5);
    const summary = buildSummary(input, score, topRisks);
    const recommendedNextSteps = buildRecommendedNextSteps(topRisks, input);
    const vendorQuestions = buildVendorQuestions(topRisks);

    return new Response(
  JSON.stringify({
    score,
    status: score >= 80 ? "green" : score >= 55 ? "yellow" : "red",
    summary,
    recommendedNextSteps,
    vendorQuestions,
    topRisks,
    allFindings: hits
  }),
  {
    status: 200,
    headers: {
      ...corsHeaders(allowOrigin),
      "Content-Type": "application/json"
    }
  }
);
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error.message
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }
}