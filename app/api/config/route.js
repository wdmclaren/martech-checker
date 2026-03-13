export const runtime = "nodejs";

const AIRTABLE_API = "https://api.airtable.com/v0";

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
    "Cache-Control": "s-maxage=900, stale-while-revalidate=3600"
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

export async function GET(req) {
  const origin = req.headers.get("origin");
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

  const vendorsTable = process.env.AIRTABLE_TABLE_VENDORS || "Vendors";
  const rulesTable = process.env.AIRTABLE_TABLE_RULES || "Rules";

  const vendors = await airtableList(vendorsTable, "Active=TRUE()");
  const rules = await airtableList(rulesTable, "Active=TRUE()");

  const vendorsByCategory = {};

  for (const record of vendors.records) {
    const f = record.fields || {};
    const category = f.Category || "Uncategorized";

    if (!vendorsByCategory[category]) {
      vendorsByCategory[category] = [];
    }

    vendorsByCategory[category].push({
      name: f.Name,
      tier: f.Tier || null
    });
  }

  const rulesOut = rules.records.map((record) => {
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

  return new Response(
    JSON.stringify({
      vendorsByCategory,
      rules: rulesOut
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders(allowOrigin),
        "Content-Type": "application/json"
      }
    }
  );
}