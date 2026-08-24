"use client"

/**
 * SharedBudgetsScreen — Full-screen management UI for shared budgets.
 *
 * Users can create a shared budget, invite a friend as co-member,
 * set the monthly limit and contribution split, and edit/archive.
 *
 * Requirement 19.5 — Collaborative budgeting
 */

import { useState, useEffect, useCallback } from "react"
import { SectionHeader, ListRow, Card } from "@/components/ui"
import { Icon } from "@/components/ui/Icon"
import { contentColumn, spacingScale } from "@/styles/layout"
import { typography, spacing, fontWeights } from '@/styles/typography'
import { textColors, colorRamp } from "@/styles/colors"
import { radius } from "@/styles/surfaces"
import {
  getSharedBudgets,
  createSharedBudget,
  updateSharedBudget,
  archiveSharedBudget,
  inviteMember,
  SHARED_BUDGET_ERRORS,
  type SharedBudget,
} from "@/lib/social/sharedBudgets"
import { listFriends, type Friendship } from "@/lib/social/friends"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/contexts/ToastContext"

// ============================================================================
// Props
// ============================================================================

export interface SharedBudgetsScreenProps {
  onBack: () => void
}

// ============================================================================
// Sub-views
// ============================================================================

type ViewState =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; budget: SharedBudget }
  | { mode: "invite"; budget: SharedBudget }

// ============================================================================
// Component
// ============================================================================

export function SharedBudgetsScreen({ onBack }: SharedBudgetsScreenProps) {
  const { showToast } = useToast()

  const [budgets, setBudgets] = useState<SharedBudget[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewState>({ mode: "list" })

  // ── Create form state ──────────────────────────────────────────
  const [formName, setFormName] = useState("")
  const [formCategory, setFormCategory] = useState("")
  const [formLimit, setFormLimit] = useState("")
  const [formContribution, setFormContribution] = useState("")
  const [saving, setSaving] = useState(false)

  // ── Invite form state ──────────────────────────────────────────
  const [friends, setFriends] = useState<Friendship[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [inviteContribution, setInviteContribution] = useState("")
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)

  // ── Fetch shared budgets ───────────────────────────────────────
  const fetchBudgets = useCallback(async () => {
    setLoading(true)
    const data = await getSharedBudgets()
    setBudgets(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchBudgets()
  }, [fetchBudgets])

  // ── Create budget handler ──────────────────────────────────────
  const handleCreate = async () => {
    const limit = parseFloat(formLimit)
    const contribution = parseFloat(formContribution)
    if (!formName.trim() || !formCategory.trim() || isNaN(limit) || limit <= 0) {
      showToast("Just need a name, category, and limit to get started.")
      return
    }
    if (isNaN(contribution) || contribution <= 0) {
      showToast("Pop in your monthly contribution amount and you're good to go.")
      return
    }

    setSaving(true)
    const result = await createSharedBudget({
      name: formName.trim(),
      category: formCategory.trim(),
      monthlyLimit: limit,
      contributionAmount: contribution,
    })
    setSaving(false)

    if (result) {
      showToast(`"${result.name}" created — invite a friend to join!`)
      setFormName("")
      setFormCategory("")
      setFormLimit("")
      setFormContribution("")
      setView({ mode: "invite", budget: result })
      await fetchBudgets()
    } else {
      showToast(SHARED_BUDGET_ERRORS.createFailed)
    }
  }

  // ── Edit budget handler ────────────────────────────────────────
  const handleUpdate = async (budget: SharedBudget) => {
    const limit = parseFloat(formLimit)
    const updates: { name?: string; category?: string; monthlyLimit?: number } = {}
    if (formName.trim() && formName.trim() !== budget.name) updates.name = formName.trim()
    if (formCategory.trim() && formCategory.trim() !== budget.category) updates.category = formCategory.trim()
    if (!isNaN(limit) && limit > 0 && limit !== budget.monthlyLimit) updates.monthlyLimit = limit

    if (Object.keys(updates).length === 0) {
      showToast("No changes to save.")
      return
    }

    setSaving(true)
    const result = await updateSharedBudget(budget.id, updates)
    setSaving(false)

    if (result) {
      showToast("Shared budget updated.")
      setView({ mode: "list" })
      await fetchBudgets()
    } else {
      showToast(SHARED_BUDGET_ERRORS.unknown)
    }
  }

  // ── Archive budget handler ─────────────────────────────────────
  const handleArchive = async (budget: SharedBudget) => {
    const ok = await archiveSharedBudget(budget.id)
    if (ok) {
      showToast(`"${budget.name}" archived.`)
      setView({ mode: "list" })
      await fetchBudgets()
    } else {
      showToast(SHARED_BUDGET_ERRORS.unknown)
    }
  }

  // ── Invite member handler ──────────────────────────────────────
  const handleInvite = async (budget: SharedBudget) => {
    if (!selectedFriendId) {
      showToast("Pick a friend to share this with.")
      return
    }
    const contribution = parseFloat(inviteContribution)
    if (isNaN(contribution) || contribution <= 0) {
      showToast("Add how much they'll chip in each month.")
      return
    }

    setInviting(true)
    const result = await inviteMember({
      budgetId: budget.id,
      friendUserId: selectedFriendId,
      contributionAmount: contribution,
    })
    setInviting(false)

    if (result) {
      showToast("Friend invited — they'll see the budget now.")
      setView({ mode: "list" })
      await fetchBudgets()
    } else {
      showToast(SHARED_BUDGET_ERRORS.notFriends)
    }
  }

  // ── Load friends list when entering invite view ────────────────
  useEffect(() => {
    if (view.mode === "invite") {
      listFriends().then((f) => setFriends(f))
      supabase.auth.getSession().then(({ data }) => {
        setCurrentUserId(data?.session?.user?.id ?? null)
      })
    }
  }, [view.mode])

  // ── Pre-fill form for edit ─────────────────────────────────────
  useEffect(() => {
    if (view.mode === "edit") {
      setFormName(view.budget.name)
      setFormCategory(view.budget.category)
      setFormLimit(String(view.budget.monthlyLimit))
    }
    if (view.mode === "create") {
      setFormName("")
      setFormCategory("")
      setFormLimit("")
      setFormContribution("")
    }
  }, [view])

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div style={{ ...contentColumn, paddingTop: spacingScale["16"] }}>
      {/* Back button */}
      <button
        type="button"
        onClick={() => (view.mode === "list" ? onBack() : setView({ mode: "list" }))}
        style={{
          background: "none",
          border: "none",
          color: textColors.sub,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: spacingScale["16"],
          padding: 0,
          fontSize: typography.body.fontSize,
          fontFamily: "inherit",
        }}
        aria-label="Go back"
      >
        <Icon name="action:forward" size={16} style={{ transform: "rotate(180deg)" }} />
        {view.mode === "list" ? "Back" : "All shared budgets"}
      </button>

      <SectionHeader>Shared Budgets</SectionHeader>
      <p style={{ ...typography["body-sm"], color: textColors.sub, marginBottom: spacingScale["24"] }}>
        {view.mode === "list" && "Budget together with a friend — both contribute, both spend."}
        {view.mode === "create" && "Set up a new shared budget with a friend."}
        {view.mode === "edit" && `Editing "${view.budget.name}"`}
        {view.mode === "invite" && `Invite a friend to "${view.budget.name}"`}
      </p>

      {/* ── LIST VIEW ──────────────────────────────────────────────── */}
      {view.mode === "list" && (
        <>
          {loading ? (
            <p style={{ ...typography["body-sm"], color: textColors.muted }}>Loading…</p>
          ) : budgets.length === 0 ? (
            <Card style={{ padding: `${spacingScale["20"]} ${spacingScale["16"]}`, textAlign: "center" }}>
              <p style={{ ...typography.body, color: textColors.text, marginBottom: spacingScale["8"] }}>
                No shared budgets yet
              </p>
              <p style={{ ...typography["body-sm"], color: textColors.sub }}>
                Create one and invite a friend to start budgeting together.
              </p>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }} role="list" aria-label="Shared budgets">
              {budgets.map((b) => {
                const remaining = Math.max(0, b.monthlyLimit - b.currentSpent)
                const pct = b.monthlyLimit > 0 ? Math.round((b.currentSpent / b.monthlyLimit) * 100) : 0
                return (
                  <ListRow
                    key={b.id}
                    variant="dense"
                    onPress={() => {
                      setView({ mode: "edit", budget: b })
                    }}
                    aria-label={`${b.name} shared budget`}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: spacingScale["40"],
                        height: spacingScale["40"],
                        flexShrink: 0,
                        borderRadius: radius.control,
                        background: colorRamp.accent[50],
                        color: textColors.text,
                      }}
                    >
                      🤝
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...typography.body, color: textColors.text, margin: 0 }}>{b.name}</p>
                      <p style={{ ...typography["body-sm"], color: textColors.sub, margin: 0 }}>
                        ${remaining.toFixed(0)} left · {pct}% used · {b.members.length} member{b.members.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <span style={{ color: textColors.muted, flexShrink: 0, display: "inline-flex" }}>
                      <Icon name="action:forward" size={16} />
                    </span>
                  </ListRow>
                )
              })}
            </div>
          )}

          {/* Create button */}
          <button
            type="button"
            onClick={() => setView({ mode: "create" })}
            style={{
              marginTop: spacingScale["20"],
              width: "100%",
              padding: "14px 0",
              borderRadius: radius.control,
              border: "none",
              background: colorRamp.accent[500],
              color: "var(--text)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
            aria-label="Create a shared budget"
          >
            + New shared budget
          </button>
        </>
      )}

      {/* ── CREATE VIEW ────────────────────────────────────────────── */}
      {view.mode === "create" && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["16"] }}>
          <FormField label="Budget name" value={formName} onChange={setFormName} placeholder="e.g. Groceries with Alex" />
          <FormField label="Category" value={formCategory} onChange={setFormCategory} placeholder="e.g. food, rent, fun" />
          <FormField label="Monthly limit ($)" value={formLimit} onChange={setFormLimit} placeholder="200" type="number" />
          <FormField label="Your monthly contribution ($)" value={formContribution} onChange={setFormContribution} placeholder="100" type="number" />

          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            style={{
              marginTop: spacingScale["8"],
              width: "100%",
              padding: "14px 0",
              borderRadius: radius.control,
              border: "none",
              background: saving ? colorRamp.accent[300] : colorRamp.accent[500],
              color: "var(--text)",
              fontSize: typography.body.fontSize,
              fontWeight: fontWeights.semibold,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {saving ? "Creating…" : "Create & invite a friend"}
          </button>
        </div>
      )}

      {/* ── EDIT VIEW ──────────────────────────────────────────────── */}
      {view.mode === "edit" && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["16"] }}>
          <FormField label="Budget name" value={formName} onChange={setFormName} placeholder="Budget name" />
          <FormField label="Category" value={formCategory} onChange={setFormCategory} placeholder="Category" />
          <FormField label="Monthly limit ($)" value={formLimit} onChange={setFormLimit} placeholder="200" type="number" />

          {/* Members summary */}
          <div>
            <p style={{ ...typography.caption, color: textColors.muted, marginBottom: spacingScale["4"] }}>
              Members ({view.budget.members.length})
            </p>
            {view.budget.members.map((m) => (
              <p key={m.id} style={{ ...typography["body-sm"], color: textColors.sub, margin: `${spacingScale["2"]} 0` }}>
                · Contributes ${m.contributionAmount}/mo
              </p>
            ))}
          </div>

          <div style={{ display: "flex", gap: spacingScale["8"] }}>
            <button
              type="button"
              onClick={() => handleUpdate(view.budget)}
              disabled={saving}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: radius.control,
                border: "none",
                background: saving ? colorRamp.accent[300] : colorRamp.accent[500],
                color: "var(--text)",
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setView({ mode: "invite", budget: view.budget })}
              style={{
                flex: 1,
                padding: "14px 0",
                borderRadius: radius.control,
                border: `1px solid ${colorRamp.accent[500]}`,
                background: "transparent",
                color: colorRamp.accent[500],
                fontSize: typography.body.fontSize,
                fontWeight: fontWeights.semibold,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Invite friend
            </button>
          </div>

          <button
            type="button"
            onClick={() => handleArchive(view.budget)}
            style={{
              marginTop: spacingScale["8"],
              width: "100%",
              padding: "12px 0",
              borderRadius: radius.control,
              border: "none",
              background: "transparent",
              color: textColors.muted,
              fontSize: typography.body.fontSize,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Archive this budget
          </button>
        </div>
      )}

      {/* ── INVITE VIEW ────────────────────────────────────────────── */}
      {view.mode === "invite" && (
        <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["16"] }}>
          {friends.length === 0 ? (
            <p style={{ ...typography["body-sm"], color: textColors.sub }}>
              No friends yet — add a friend first to invite them.
            </p>
          ) : (
            <>
              <p style={{ ...typography.caption, color: textColors.muted }}>Pick a friend</p>
              <div style={{ display: "flex", flexDirection: "column", gap: spacingScale["8"] }}>
                {friends
                  .filter((f) => f.status === "accepted")
                  .map((f) => {
                    const friendId = f.requesterId === currentUserId ? f.addresseeId : f.requesterId
                    const isSelected = selectedFriendId === friendId
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setSelectedFriendId(friendId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: spacing.sm,
                          padding: "10px 12px",
                          borderRadius: radius.control,
                          border: isSelected ? `2px solid ${colorRamp.accent[500]}` : "1px solid var(--border, #333)",
                          background: isSelected ? colorRamp.accent[50] : "transparent",
                          cursor: "pointer",
                          textAlign: "left",
                          fontFamily: "inherit",
                          width: "100%",
                        }}
                        aria-pressed={isSelected}
                      >
                        <span style={{ ...typography.body, color: textColors.text }}>
                          {friendId.slice(0, 8)}…
                        </span>
                      </button>
                    )
                  })}
              </div>

              <FormField
                label="Their monthly contribution ($)"
                value={inviteContribution}
                onChange={setInviteContribution}
                placeholder="100"
                type="number"
              />

              <button
                type="button"
                onClick={() => handleInvite(view.budget)}
                disabled={inviting}
                style={{
                  width: "100%",
                  padding: "14px 0",
                  borderRadius: radius.control,
                  border: "none",
                  background: inviting ? colorRamp.accent[300] : colorRamp.accent[500],
                  color: "var(--text)",
                  fontSize: typography.body.fontSize,
                  fontWeight: fontWeights.semibold,
                  cursor: inviting ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {inviting ? "Inviting…" : "Send invite"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Reusable form field
// ============================================================================

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  const id = `shared-budget-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
  return (
    <div>
      <label
        htmlFor={id}
        style={{ ...typography.caption, color: textColors.muted, display: "block", marginBottom: spacingScale["4"] }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        style={{
          width: "100%",
          padding: "12px 14px",
          borderRadius: radius.control,
          border: "1px solid var(--border, #333)",
          background: "var(--surface)",
          color: "var(--text)",
          fontSize: typography.body.fontSize,
          fontFamily: "inherit",
          outline: "none",
        }}
      />
    </div>
  )
}
