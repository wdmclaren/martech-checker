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

const SCENARIO_OPTIONS = [
  { value: "add-vendor", label: "Add a vendor to my stack" },
  { value: "compare-vendors", label: "Compare vendors" },
  { value: "evaluate-stack", label: "Evaluate my current stack" },
  { value: "use-case-support", label: "Check if my stack supports a use case" }
];

const EMPTY_FORM = {
  goals: [],
  addCategory: "",
  addVendor: "",
  compareCategory: "",
  compareVendors: [],
  evaluateCategories: [],
  useCaseCategory: "",
  useCaseVendor: "",
  ordering: "",
  pos: "",
  loyalty: "",
  crm: "",
  cdp: "",
  sms: []
};

export default function CheckerPage() {
  const [vendors, setVendors] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [configError, setConfigError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [scenario, setScenario] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);

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

  function resetFormForScenario(nextScenario) {
    setScenario(nextScenario);
    setResult(null);
    setSubmitError("");
    setForm(EMPTY_FORM);
    window.scrollTo({ top: 0, behavior: "smooth" });
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

  function toggleMultiVendor(field, vendorName) {
    setForm((prev) => {
      const exists = prev[field].includes(vendorName);
      return {
        ...prev,
        [field]: exists
          ? prev[field].filter((v) => v !== vendorName)
          : [...prev[field], vendorName]
      };
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

  function toggleEvaluateCategory(category) {
    setForm((prev) => {
      const exists = prev.evaluateCategories.includes(category);
      const next = exists
        ? prev.evaluateCategories.filter((c) => c !== category)
        : [...prev.evaluateCategories, category];

      const updated = {
        ...prev,
        evaluateCategories: next
      };

      if (exists) {
        if (category === "Ordering") updated.ordering = "";
        if (category === "POS") updated.pos = "";
        if (category === "Loyalty") updated.loyalty = "";
        if (category === "CRM") updated.crm = "";
        if (category === "CDP") updated.cdp = "";
        if (category === "SMS") updated.sms = [];
      }

      return updated;
    });
  }

  async function runCheck() {
    try {
      setLoading(true);
      setSubmitError("");
      setResult(null);

      const payload = {
        scenario,
        candidateCategory:
          scenario === "add-vendor"
            ? form.addCategory
            : scenario === "compare-vendors"
              ? form.compareCategory
              : scenario === "use-case-support"
                ? form.useCaseCategory
                : "",
        candidateVendor:
          scenario === "add-vendor"
            ? form.addVendor
            : scenario === "compare-vendors"
              ? form.compareVendors.join(", ")
              : scenario === "use-case-support"
                ? form.useCaseVendor
                : "",
        ordering: form.ordering,
        pos: form.pos,
        loyalty: form.loyalty,
        crm: form.crm,
        cdp: form.cdp,
        sms: form.sms,
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

  function statusLabel(status) {
    if (status === "green") return "Strong compatibility";
    if (status === "yellow") return "Works with considerations";
    return "High complexity / risk";
  }

  function sectionCard(title, children) {
    return (
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 24,
          marginBottom: 24
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        {children}
      </div>
    );
  }

  function renderSingleSelect(label, field, options, placeholder = `Select ${label}`) {
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
          <option value="">{placeholder}</option>
          {options?.map((v) => (
            <option key={v.name} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderCategorySelect(label, field) {
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
          <option value="">Select category</option>
          {CATEGORY_ORDER.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>
    );
  }

  function renderGoalsSection(stepNumber) {
    return sectionCard(`${stepNumber}. What goals or use cases are you trying to solve for?`, (
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
    ));
  }

  function renderSmsContext() {
    const options = vendors.SMS || [];

    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 6, fontWeight: 600 }}>Current SMS Vendor(s)</div>
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

  function renderCurrentStackContext(title, categories) {
    if (!categories.length) return null;

    return sectionCard(title, (
      <>
        <div style={{ marginBottom: 18, color: "#555" }}>
          Choose from your current vendor partners below.
        </div>

        {categories.includes("Ordering") &&
          renderSingleSelect("Current Ordering Vendor", "ordering", vendors.Ordering, "Select ordering vendor")}

        {categories.includes("POS") &&
          renderSingleSelect("Current POS Vendor", "pos", vendors.POS, "Select POS vendor")}

        {categories.includes("Loyalty") &&
          renderSingleSelect("Current Loyalty Vendor", "loyalty", vendors.Loyalty, "Select loyalty vendor")}

        {categories.includes("CRM") &&
          renderSingleSelect("Current CRM Vendor", "crm", vendors.CRM, "Select CRM vendor")}

        {categories.includes("CDP") &&
          renderSingleSelect("Current CDP Vendor", "cdp", vendors.CDP, "Select CDP vendor")}

        {categories.includes("SMS") && renderSmsContext()}
      </>
    ));
  }

  function renderAddVendorFlow() {
    const step2Complete = !!form.addCategory;
    const step3Complete = !!form.addVendor;
    const step4Categories = form.addCategory ? [form.addCategory] : [];

    return (
      <>
        {sectionCard("2. What category are you considering adding to your stack?", (
          renderCategorySelect("Category", "addCategory")
        ))}

        {step2Complete &&
          sectionCard("3. Which vendor are you considering?", (
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                Vendor
              </label>
              <select
                value={form.addVendor}
                onChange={(e) => updateField("addVendor", e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid #ccc"
                }}
              >
                <option value="">Select vendor</option>
                {(vendors[form.addCategory] || []).map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {step3Complete &&
          renderCurrentStackContext(
            "4. What current stack context matters for this decision?",
            step4Categories
          )}

        {step3Complete && renderGoalsSection(5)}
      </>
    );
  }

  function renderCompareVendorsFlow() {
    const step2Complete = !!form.compareCategory;
    const step3Complete = form.compareVendors.length > 0;
    const contextCategories = form.compareCategory ? [form.compareCategory] : [];

    return (
      <>
        {sectionCard("2. What category are you looking to compare vendors in?", (
          <>
            {renderCategorySelect("Category", "compareCategory")}

            {step2Complete && (
              <div style={{ marginTop: 8 }}>
                <div style={{ marginBottom: 8, fontWeight: 600 }}>Vendors</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {(vendors[form.compareCategory] || []).map((v) => (
                    <label
                      key={v.name}
                      style={{
                        border: "1px solid #ccc",
                        borderRadius: 8,
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.compareVendors.includes(v.name)}
                        onChange={() => toggleMultiVendor("compareVendors", v.name)}
                      />
                      {v.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </>
        ))}

        {step3Complete &&
          renderCurrentStackContext(
            "4. What current stack context matters for this comparison?",
            contextCategories
          )}

        {step3Complete && renderGoalsSection(5)}
      </>
    );
  }

  function renderEvaluateStackFlow() {
    const step2Complete = form.evaluateCategories.length > 0;

    return (
      <>
        {sectionCard("2. What categories are you wanting to evaluate?", (
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
                  checked={form.evaluateCategories.includes(category)}
                  onChange={() => toggleEvaluateCategory(category)}
                />
                {category}
              </label>
            ))}
          </div>
        ))}

        {step2Complete &&
          renderCurrentStackContext(
            "3. Tell us your current vendors in these categories",
            form.evaluateCategories
          )}

        {step2Complete && renderGoalsSection(4)}
      </>
    );
  }

  function renderUseCaseSupportFlow() {
    const step2Complete = form.goals.length > 0;
    const step3Complete = !!form.useCaseCategory;
    const step4Complete = !!form.useCaseVendor;
    const contextCategories = form.useCaseCategory ? [form.useCaseCategory] : [];

    return (
      <>
        {sectionCard("2. What use case are you looking to solve?", (
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
        ))}

        {step2Complete &&
          sectionCard("3. Choose the category", (
            renderCategorySelect("Category", "useCaseCategory")
          ))}

        {step3Complete &&
          sectionCard("4. Choose the vendor", (
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>
                Vendor
              </label>
              <select
                value={form.useCaseVendor}
                onChange={(e) => updateField("useCaseVendor", e.target.value)}
                style={{
                  width: "100%",
                  maxWidth: 420,
                  padding: "10px",
                  borderRadius: 8,
                  border: "1px solid #ccc"
                }}
              >
                <option value="">Select vendor</option>
                {(vendors[form.useCaseCategory] || []).map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {step4Complete &&
          renderCurrentStackContext(
            "5. What current stack context matters for this use case?",
            contextCategories
          )}
      </>
    );
  }

  function renderScenarioFlow() {
    if (scenario === "add-vendor") return renderAddVendorFlow();
    if (scenario === "compare-vendors") return renderCompareVendorsFlow();
    if (scenario === "evaluate-stack") return renderEvaluateStackFlow();
    return renderUseCaseSupportFlow();
  }

  function canRunCheck() {
    if (scenario === "add-vendor") {
      return !!form.addCategory && !!form.addVendor;
    }

    if (scenario === "compare-vendors") {
      return !!form.compareCategory && form.compareVendors.length > 0;
    }

    if (scenario === "evaluate-stack") {
      return form.evaluateCategories.length > 0;
    }

    if (scenario === "use-case-support") {
      return form.goals.length > 0 && !!form.useCaseCategory && !!form.useCaseVendor;
    }

    return false;
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
      <div style={{ fontSize: 14, color: "#777", marginBottom: 20 }}>
        Built by 3Owl to help restaurant teams evaluate MarTech architecture decisions.
      </div>
      <p style={{ marginTop: 0, marginBottom: 28, color: "#555" }}>
        Evaluate whether your restaurant technology stack will work together before committing to vendor decisions.
      </p>

      <div style={{ marginBottom: 28, maxWidth: 750, color: "#444" }}>
        This tool helps restaurant marketing and technology teams evaluate whether their MarTech stack will support specific vendor decisions, integrations, and marketing use cases before committing to implementation.
      </div>

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

      {sectionCard("1. What would you like to evaluate?", (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SCENARIO_OPTIONS.map((option) => (
            <label
              key={option.value}
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
                type="radio"
                name="scenario"
                value={option.value}
                checked={scenario === option.value}
                onChange={() => resetFormForScenario(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ))}

      {scenario && renderScenarioFlow()}

      {scenario && (
        <button
          onClick={runCheck}
          disabled={loading || !canRunCheck()}
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
          {loading ? "Running Check..." : "Evaluate Compatibility"}
        </button>
      )}

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
            <h2 style={{ marginTop: 0 }}>Compatibility Outlook</h2>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
              {result.score}
            </div>
            <div style={{ fontSize: 18, marginBottom: 8 }}>
              <strong>{statusLabel(result.status)}</strong>
            </div>
            <div style={{ color: "#666" }}>
              Based on the selected scenario, stack context, and goals.
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 24
            }}
          >
            <h2 style={{ marginTop: 0 }}>Findings</h2>
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
                    Severity: {risk.severity} | Category: {risk.category} | Score Impact: {risk.scoreImpact}
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