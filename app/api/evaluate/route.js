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

  return origin && allowed.includes(origin);
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
  const allowOrigin = origin
    ? (isAllowedOrigin(origin) ? origin : "")
    : "*";

  return new Response(null, {
    status: 204,
    headers: corsHeaders(allowOrigin)
  });
}

export async function POST(req) {
  try {
    const origin = req.headers.get("origin");

    // Allow same-origin/local browser requests where Origin may be missing
    const allowOrigin = origin
      ? (isAllowedOrigin(origin) ? origin : "")
      : "*";

    if (origin && !allowOrigin) {
      return new Response(
        JSON.stringify({ error: "Forbidden origin" }),
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

    return new Response(
      JSON.stringify({
        score,
        status: score >= 80 ? "green" : score >= 55 ? "yellow" : "red",
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