"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { springs } from "@/lib/animations"
import { ManagedListScreen, type ItemRenderContext } from "@/components/ui/ManagedListScreen"
import { BUDGET_CATEGORIES } from "@/types"
import type { TransactionCategory } from "@/types"
import type { CategorizationRule, CategorizationRuleUpdate } from "@/lib/categorizationRules"
import type { FundingSource } from "@/lib/fundingSources"
import { getCategoryEmoji } from "@/lib/vocabulary"
import { FONT_FAMILY, spacing, typography, fontWeights } from '@/styles/typography'
import { listRow } from "@/styles/shared"
import { radius } from '@/styles/surfaces'

// ============================================================================
// Types
// ============================================================================

export interface CategorizationRulesScreenProps {
  /** All user-defined categorization / routing rules. */
  rules: CategorizationRule[]
  /** Available funding sources for the optional auto-route target. */
  fundingSources: FundingSource[]
  /** Add a new rule. `fundingSourceId` is null when the rule only categorizes. */
  onAddRule: (
    keyword: string,
    category: TransactionCategory,
    fundingSourceId: string | null
  ) => void
  /** Update an existing rule in place. */
  onUpdateRule: (id: string, updates: CategorizationRuleUpdate) => void
  /** Delete a rule by id. */
  onDeleteRule: (id: string) => void
  /** Navigate back / close the screen. */
  onClose: () => void
}

// ============================================================================
// Form state
// ============================================================================

interface RuleFormData {
  keyword: string
  category: TransactionCategory
  fundingSourceId: string | null
}

const DEFAULT_FORM: RuleFormData = {
  keyword: "",
  category: "food",
  fundingSourceId: null,
}

// ============================================================================
// Styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: typography.body.fontSize,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "var(--color-sunken)",
  border: "1px solid var(--border)",
  borderRadius: radius.control,
  outline: "none",
}

const labelStyle: React.CSSProperties = {
  fontSize: typography['body-sm'].fontSize,
  fontWeight: fontWeights.medium,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

function chipStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: radius.full,
    border: isActive ? "1.5px solid var(--accent-500)" : "1px solid var(--border)",
    background: isActive ? "var(--accent-200)" : "var(--fill-04)",
    color: isActive ? "var(--text)" : "var(--sub)",
    fontSize: typography['body-sm'].fontSize,
    fontWeight: fontWeights.medium,
    fontFamily: FONT_FAMILY,
    cursor: "pointer",
  }
}

// ============================================================================
// CategorizationRulesScreen Component
// ============================================================================

/**
 * CategorizationRulesScreen — full-screen managed list for user-defined
 * "always categorize X as Y" and auto-route rules (task 187.1).
 *
 * Reached from Settings. Built on the shared ManagedListScreen scaffold so it
 * inherits the warm empty state, 2-step delete confirmation, and add/edit flow.
 * Every rule is user-created, visible, and reversible.
 *
 * Validates: Requirements 113.3, 141.1
 */
export function CategorizationRulesScreen({
  rules,
  fundingSources,
  onAddRule,
  onUpdateRule,
  onDeleteRule,
  onClose,
}: CategorizationRulesScreenProps) {
  // ── Render Callbacks ───────────────────────────────────────────────────────
  function sourceLabel(id: string | null | undefined): FundingSource | undefined {
    if (!id) return undefined
    return fundingSources.find(s => s.id === id)
  }

  function renderItem(context: ItemRenderContext<CategorizationRule>) {
    const { item: rule, requestDelete, isConfirmingDelete, confirmDelete, cancelDelete } = context
    const source = sourceLabel(rule.fundingSourceId)

    return (
      <div
        style={{
          ...listRow,
          cursor: "pointer",
          padding: "10px 0",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: spacing.sm, flex: 1 }}
          onClick={context.startEdit}
          role="button"
          tabIndex={0}
          aria-label={`Edit rule for "${rule.keyword}"`}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") context.startEdit()
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: typography.body.fontSize, color: "var(--text)", margin: 0, fontWeight: fontWeights.medium }}>
              &ldquo;{rule.keyword}&rdquo; → {getCategoryEmoji(rule.category)} {rule.category}
            </p>
            {source && (
              <p style={{ fontSize: typography['body-sm'].fontSize, color: "var(--muted)", margin: "2px 0 0" }}>
                Routes to {source.emoji} {source.label}
              </p>
            )}
          </div>
        </div>
        {isConfirmingDelete ? (
          <div style={{ display: "flex", gap: 4, marginInlineStart: spacing.xs }}>
            <motion.button
              onClick={confirmDelete}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              style={{
                background: "var(--error-200)",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: typography['body-sm'].fontSize,
                fontWeight: fontWeights.semibold,
                color: "var(--error)",
                borderRadius: radius.min,
              }}
              aria-label={`Confirm delete rule for "${rule.keyword}"`}
            >
              Delete
            </motion.button>
            <motion.button
              onClick={cancelDelete}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              style={{
                background: "none",
                border: "none",
                padding: "4px 8px",
                cursor: "pointer",
                fontSize: typography['body-sm'].fontSize,
                color: "var(--sub)",
              }}
              aria-label="Cancel delete"
            >
              ✕
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={requestDelete}
            whileTap={{ scale: 0.95 }}
            transition={springs.snappy}
            style={{
              background: "none",
              border: "none",
              padding: "4px 8px",
              cursor: "pointer",
              fontSize: typography.body.fontSize,
              color: "var(--error)",
              marginInlineStart: spacing.xs,
            }}
            aria-label={`Delete rule for "${rule.keyword}"`}
          >
            ✕
          </motion.button>
        )}
      </div>
    )
  }

  function renderForm({
    item,
    onDone,
    onCancel,
  }: {
    item: CategorizationRule | null
    onDone: () => void
    onCancel: () => void
  }) {
    return (
      <RuleFormWrapper
        item={item}
        fundingSources={fundingSources}
        onAddRule={onAddRule}
        onUpdateRule={onUpdateRule}
        onDone={onDone}
        onCancel={onCancel}
      />
    )
  }

  return (
    <ManagedListScreen<CategorizationRule>
      items={rules}
      title="Categorization & Routing Rules"
      addLabel="+ Add rule"
      emptyEmoji="🪄"
      emptyTitle="No rules yet"
      emptySubtitle="Teach Folio once — e.g. always file “starbucks” as food, or route “rent” to your debit card."
      onBack={onClose}
      onDelete={onDeleteRule}
      renderItem={renderItem}
      renderForm={renderForm}
      listLayout="single-card"
    />
  )
}

// ============================================================================
// RuleFormWrapper — self-contained form with its own state
// ============================================================================

interface RuleFormWrapperProps {
  item: CategorizationRule | null
  fundingSources: FundingSource[]
  onAddRule: (
    keyword: string,
    category: TransactionCategory,
    fundingSourceId: string | null
  ) => void
  onUpdateRule: (id: string, updates: CategorizationRuleUpdate) => void
  onDone: () => void
  onCancel: () => void
}

function RuleFormWrapper({
  item,
  fundingSources,
  onAddRule,
  onUpdateRule,
  onDone,
  onCancel,
}: RuleFormWrapperProps) {
  const [form, setForm] = useState<RuleFormData>(
    item
      ? {
          keyword: item.keyword,
          category: item.category,
          fundingSourceId: item.fundingSourceId ?? null,
        }
      : DEFAULT_FORM
  )

  function handleSave() {
    const keyword = form.keyword.trim()
    if (!keyword) return
    if (item) {
      onUpdateRule(item.id, {
        keyword,
        category: form.category,
        fundingSourceId: form.fundingSourceId,
      })
    } else {
      onAddRule(keyword, form.category, form.fundingSourceId)
    }
    onDone()
  }

  const canSave = form.keyword.trim().length > 0

  return (
    <div
      style={{
        padding: 14,
        borderRadius: radius.control,
        background: "var(--fill-03)",
        border: "1px solid var(--border)",
      }}
    >
      {/* Keyword */}
      <div style={{ marginBottom: 10 }}>
        <p style={labelStyle}>When a note contains…</p>
        <input
          type="text"
          value={form.keyword}
          onChange={e => setForm(prev => ({ ...prev, keyword: e.target.value.slice(0, 40) }))}
          placeholder="e.g. starbucks"
          maxLength={40}
          style={inputStyle}
          autoFocus
          aria-label="Rule keyword"
        />
      </div>

      {/* Category */}
      <div style={{ marginBottom: spacing.sm }}>
        <p style={labelStyle}>Always categorize as</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {BUDGET_CATEGORIES.map(cat => {
            const isActive = form.category === cat.category
            return (
              <motion.button
                key={cat.category}
                type="button"
                onClick={() => setForm(prev => ({ ...prev, category: cat.category }))}
                whileTap={{ scale: 0.95 }}
                transition={springs.snappy}
                style={chipStyle(isActive)}
                aria-label={`Categorize as ${cat.label}`}
                aria-pressed={isActive}
              >
                {cat.emoji} {cat.label}
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Optional auto-route */}
      {fundingSources.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p style={labelStyle}>And route to (optional)</p>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <motion.button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, fundingSourceId: null }))}
              whileTap={{ scale: 0.95 }}
              transition={springs.snappy}
              style={chipStyle(form.fundingSourceId === null)}
              aria-label="Don't route to a payment method"
              aria-pressed={form.fundingSourceId === null}
            >
              No routing
            </motion.button>
            {fundingSources.map(source => {
              const isActive = form.fundingSourceId === source.id
              return (
                <motion.button
                  key={source.id}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, fundingSourceId: source.id }))}
                  whileTap={{ scale: 0.95 }}
                  transition={springs.snappy}
                  style={chipStyle(isActive)}
                  aria-label={`Route to ${source.label}`}
                  aria-pressed={isActive}
                >
                  {source.emoji} {source.label}
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: spacing.xs }}>
        <motion.button
          onClick={onCancel}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.medium,
            fontFamily: FONT_FAMILY,
            color: "var(--text)",
            background: "var(--fill-06)",
            border: "1px solid var(--border)",
            borderRadius: radius.full,
            cursor: "pointer",
          }}
          aria-label="Cancel"
        >
          Cancel
        </motion.button>
        <motion.button
          onClick={handleSave}
          whileTap={{ scale: 0.97 }}
          transition={springs.snappy}
          disabled={!canSave}
          style={{
            flex: 1,
            padding: "10px 16px",
            fontSize: typography.body.fontSize,
            fontWeight: fontWeights.semibold,
            fontFamily: FONT_FAMILY,
            color: canSave ? "var(--text)" : "var(--muted)",
            background: canSave ? "var(--accent-500)" : "var(--fill-06)",
            border: "none",
            borderRadius: radius.full,
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave ? 1 : 0.6,
          }}
          aria-label={item ? "Save changes" : "Add rule"}
        >
          {item ? "Save" : "Add"}
        </motion.button>
      </div>
    </div>
  )
}
