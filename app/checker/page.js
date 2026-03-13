"use client";

import { useEffect, useState } from "react";

const CATEGORY_ORDER = ["Ordering", "POS", "Loyalty", "SMS", "CRM", "CDP"];

const GOAL_OPTIONS = [
  "personalization",
  "attribution",
  "real-time loyalty",
  "offer targeting",
  "sms marketing",
  "loyalty growth"
];

export default function TestPage() {
  const [vendors, setVendors] = useState({});
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [form, setForm] = useState({
    ordering: "",
    pos: "",
    loyalty: "",
    crm: "",
    cdp: "",
    sms: [],
    goals: []
  });

  useEffect(() => {
    async function loadConfig() {
      try {
        setConfigError("");
        const res = await fetch("/api/config");
        const text = await res.text();

        if (!res.ok) {
          throw new Error(`Config request failed: ${res.status} ${text}`);
        }

        const data = JSON.parse(text);
        setVendors(data.vendorsByCategory || {});
      } catch (err) {
        console.error("Failed to load config:", err);
        setConfigError(err.message || "Failed to load config");
      }
    }

    loadConfig();
  }, []);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  }

  function toggleCategory(category) {
    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      const next = exists
        ? prev.filter((c) => c !== category)
        : [...prev, category];

      // Clear values when category is removed
      if (exists) {
        const fieldMap = {
          Ordering: "ordering",
          POS: "pos",
          Loyalty: "loyalty",
          SMS: "sms",
          CRM: "crm",
          CDP: "cdp"
        };

        const field = fieldMap[category];
        if (field) {
          setForm((current) => ({
            ...current,
            [field]: field === "sms" ? [] : ""
          }));
        }
      }

      return next;
    });
  }

  function toggleSms(vendorName) {
    setForm((prev) => {
      const exists = prev.sms.includes(vendorName);
      return {
        ...prev,
        sms: exists
          ? prev.sms.filter((s) => s !== vendorName)
          : [...prev.sms, vendorName]
      };
    });
  }

  function toggleGoal(goal) {
    setForm((prev) => {
      const exists = prev.goals.includes(goal);
      return {
        ...prev,
        goals: exists
          ? prev.goals.filter((g) => g !== goal)
          : [...prev.goals, goal]
      };
    });
  }

  async function runCheck() {
    try {
      setLoading(true);
      setSubmitError("");
      setResult(null);

      const payload = {
        ordering: selectedCategories.includes("Ordering") ? form.ordering : "",
        pos: selectedCategories.includes("POS") ? form.pos : "",
        loyalty: selectedCategories.includes("Loyalty") ? form.loyalty : "",
        crm: selectedCategories.includes("CRM") ? form.crm : "",
        cdp: selectedCategories.includes("CDP") ? form.cdp : "",
        sms: selectedCategories.includes("SMS") ? form.sms : [],
        goals: form.goals
      };

      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(`Evaluate request failed: ${res.status} ${text}`);
      }

      const data = JSON.parse(text);
      setResult(data);
    } catch (err) {
      console.error("Failed to evaluate:", err);
      setSubmitError(err.message || "Failed to evaluate");
    } finally {
      setLoading(false);
    }
  }

  function renderSingleSelect(label, field, options) {
    return (
      <div style={{ marginBottom: 18 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
          {label}
        </label>
        <select
          value={form[field]}
          onChange={(e) => updateField(field, e.target.value)}
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px",
            borderRadius: 8,
            border: "1px solid #ccc"
          }}
        >
          <option value="">Select {label}</option>
          {options?.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderSmsCheckboxes() {
    const options = vendors.SMS || [];

    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>SMS</div>
        {options.length === 0 ? (
          <div>No SMS vendors available.</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {options.map((v) => (
              <label
                key={v.name}
                style={{
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  padding: "8px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8
                }}
              >
                <input
                  type="checkbox"
                  checked={form.sms.includes(v.name)}
                  onChange={() => toggleSms(v.name)}
                />
                {v.name}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }

  function statusLabel(status) {
    if (status === "green") return "Strong fit";
    if (status === "yellow") return "Proceed with caution";
    return "High complexity / risk";
  }

  return (
    <div
      style={{
        padding: 40,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1100,
        margin: "0 auto"
      }}
    >
      <h1 style={{ marginBottom: 8 }}>MarTech Compatibility Checker</h1>
      <p style={{ marginTop: 0, marginBottom: 28, color: "#555" }}>
        Select only the categories relevant to the decision you are making.
      </p>

      {configError && (
        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #f0b8b8",
            padding: 12,
            borderRadius: 8,
            marginBottom: 20
          }}
        >
          <strong>Config error:</strong> {configError}
        </div>
      )}

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}
      >
        <h2 style={{ marginTop: 0 }}>1. Choose relevant categories</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {CATEGORY_ORDER.map((category) => (
            <label
              key={category}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={selectedCategories.includes(category)}
                onChange={() => toggleCategory(category)}
              />
              {category}
            </label>
          ))}
        </div>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}
      >
        <h2 style={{ marginTop: 0 }}>2. Select vendors</h2>
        {selectedCategories.length === 0 ? (
          <p style={{ color: "#666" }}>
            Choose one or more categories above to start.
          </p>
        ) : (
          <>
            {selectedCategories.includes("Ordering") &&
              renderSingleSelect("Ordering", "ordering", vendors.Ordering)}

            {selectedCategories.includes("POS") &&
              renderSingleSelect("POS", "pos", vendors.POS)}

            {selectedCategories.includes("Loyalty") &&
              renderSingleSelect("Loyalty", "loyalty", vendors.Loyalty)}

            {selectedCategories.includes("CRM") &&
              renderSingleSelect("CRM", "crm", vendors.CRM)}

            {selectedCategories.includes("CDP") &&
              renderSingleSelect("CDP", "cdp", vendors.CDP)}

            {selectedCategories.includes("SMS") && renderSmsCheckboxes()}
          </>
        )}
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}
      >
        <h2 style={{ marginTop: 0 }}>3. Goals and use cases</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {GOAL_OPTIONS.map((goal) => (
            <label
              key={goal}
              style={{
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={form.goals.includes(goal)}
                onChange={() => toggleGoal(goal)}
              />
              {goal}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={runCheck}
        disabled={loading || selectedCategories.length === 0}
        style={{
          padding: "12px 18px",
          borderRadius: 10,
          border: "none",
          background: loading ? "#999" : "#111",
          color: "#fff",
          cursor: loading ? "not-allowed" : "pointer",
          fontWeight: 600
        }}
      >
        {loading ? "Running Check..." : "Run Check"}
      </button>

      {submitError && (
        <div
          style={{
            background: "#fff3f3",
            border: "1px solid #f0b8b8",
            padding: 12,
            borderRadius: 8,
            marginTop: 20
          }}
        >
          <strong>Evaluate error:</strong> {submitError}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 36 }}>
          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 24,
              marginBottom: 24
            }}
          >
            <h2 style={{ marginTop: 0 }}>Results</h2>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
              {result.score}
            </div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              <strong>{statusLabel(result.status)}</strong>
            </div>
            <div style={{ color: "#666" }}>
              Based on the selected categories and goals.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 24
            }}
          >
            <h2 style={{ marginTop: 0 }}>Top Findings</h2>
            {!result.topRisks || result.topRisks.length === 0 ? (
              <p style={{ color: "#666" }}>
                No major findings were triggered for this scenario.
              </p>
            ) : (
              result.topRisks.map((risk, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #e6e6e6",
                    borderRadius: 10,
                    padding: 16,
                    marginBottom: 14
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <strong>{risk.riskTitle || risk.name}</strong>
                  </div>
                  <div style={{ marginBottom: 8, color: "#444" }}>
                    {risk.riskDetail}
                  </div>
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    Severity: {risk.severity} | Category: {risk.category} | Score
                    Impact: {risk.scoreImpact}
                  </div>

                  {risk.questions?.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Questions to ask:
                      </div>
                      <ul style={{ marginTop: 0 }}>
                        {risk.questions.map((q, idx) => (
                          <li key={idx}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {risk.recommendations?.length > 0 && (
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 6 }}>
                        Recommendations:
                      </div>
                      <ul style={{ marginTop: 0 }}>
                        {risk.recommendations.map((rec, idx) => (
                          <li key={idx}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}