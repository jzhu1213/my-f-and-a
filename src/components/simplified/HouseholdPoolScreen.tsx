"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { springs } from "@/lib/animations"
import { GlassCard } from "@/components/ui/GlassCard"
import { FONT_FAMILY } from "@/styles/typography"
import {
  CONTENT_MAX_WIDTH,
  HORIZONTAL_PADDING,
  DOCK_PADDING_BOTTOM,
  sectionHeadingStrong,
  borderRadius,
  progressTrack,
} from "@/styles/shared"
import {
  createPool,
  getPools,
  getPool,
  deletePool,
  addMember,
  removeMember,
  logPoolExpense,
  getPoolExpenses,
  getPoolSummary,
  getPoolShareUrl,
  type HouseholdPool,
  type HouseholdPoolExpense,
  type HouseholdPoolSummary,
} from "@/lib/householdPool"

// ============================================================================
// Types
// ============================================================================

export interface HouseholdPoolScreenProps {
  onClose: () => void
}

type View = "list" | "create" | "detail"

// ============================================================================
// Styles
// ============================================================================

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(0, 0, 0, 0.2)",
  border: "1px solid var(--border)",
  borderRadius: 10,
  outline: "none",
  boxSizing: "border-box",
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "var(--sub)",
  marginBottom: 4,
  fontFamily: FONT_FAMILY,
}

const primaryButton: React.CSSProperties = {
  width: "100%",
  padding: "14px 0",
  fontSize: 15,
  fontWeight: 600,
  fontFamily: FONT_FAMILY,
  color: "#fff",
  background: "var(--accent)",
  border: "none",
  borderRadius: borderRadius.sm,
  cursor: "pointer",
}

const secondaryButton: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: FONT_FAMILY,
  color: "var(--text)",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: borderRadius.sm,
  cursor: "pointer",
}

// ============================================================================
// HouseholdPoolScreen Component
// ============================================================================

/**
 * HouseholdPoolScreen — Full-screen overlay for managing household/roommate
 * shared expense pools. Pools are completely separate from personal spending
 * and never affect the daily allowance hero number.
 *
 * Task 170.1
 */
export function HouseholdPoolScreen({ onClose }: HouseholdPoolScreenProps) {
  const [view, setView] = useState<View>("list")
  const [pools, setPools] = useState<HouseholdPool[]>([])
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null)

  // Refresh pools from localStorage
  const refreshPools = useCallback(() => {
    setPools(getPools())
  }, [])

  useEffect(() => {
    refreshPools()
  }, [refreshPools])

  const handleOpenDetail = (poolId: string) => {
    setSelectedPoolId(poolId)
    setView("detail")
  }

  const handleBack = () => {
    setView("list")
    setSelectedPoolId(null)
    refreshPools()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={springs.gentle}
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg)",
        zIndex: 200,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        style={{
          maxWidth: CONTENT_MAX_WIDTH,
          margin: "0 auto",
          padding: `24px ${HORIZONTAL_PADDING}px ${DOCK_PADDING_BOTTOM}px`,
          fontFamily: FONT_FAMILY,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 20 }}>
          <button
            onClick={view === "list" ? onClose : handleBack}
            style={{
              background: "none",
              border: "none",
              color: "var(--sub)",
              fontSize: 14,
              fontFamily: FONT_FAMILY,
              cursor: "pointer",
              padding: "4px 0",
              marginRight: 12,
            }}
            aria-label={view === "list" ? "Close" : "Back"}
          >
            ← {view === "list" ? "Back" : "Pools"}
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", flex: 1 }}>
            {view === "create" ? "New Pool" : view === "detail" ? "Pool Details" : "Shared Pools"}
          </h2>
        </div>

        <AnimatePresence mode="wait">
          {view === "list" && (
            <PoolListView
              key="list"
              pools={pools}
              onOpenDetail={handleOpenDetail}
              onOpenCreate={() => setView("create")}
            />
          )}
          {view === "create" && (
            <CreatePoolView
              key="create"
              onCreated={() => {
                refreshPools()
                setView("list")
              }}
            />
          )}
          {view === "detail" && selectedPoolId && (
            <PoolDetailView
              key="detail"
              poolId={selectedPoolId}
              onDeleted={() => {
                refreshPools()
                setView("list")
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Pool List View
// ============================================================================

function PoolListView({
  pools,
  onOpenDetail,
  onOpenCreate,
}: {
  pools: HouseholdPool[]
  onOpenDetail: (id: string) => void
  onOpenCreate: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Description */}
      <p style={{ fontSize: 14, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
        Shared pools let you track group expenses like groceries and utilities with
        roommates — completely separate from your daily budget.
      </p>

      {pools.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏠</p>
          <p style={{ fontSize: 15, color: "var(--text)", marginBottom: 6, fontWeight: 500 }}>
            No shared pools yet
          </p>
          <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 20, lineHeight: 1.5 }}>
            Create a pool to start tracking shared expenses with roommates.
            It won&apos;t touch your daily number.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {pools.map((pool) => (
            <PoolCard key={pool.id} pool={pool} onOpen={() => onOpenDetail(pool.id)} />
          ))}
        </div>
      )}

      {/* Create button */}
      <button
        onClick={onOpenCreate}
        style={primaryButton}
      >
        + Create a Pool
      </button>
    </motion.div>
  )
}

// ============================================================================
// Pool Card
// ============================================================================

function PoolCard({ pool, onOpen }: { pool: HouseholdPool; onOpen: () => void }) {
  const summary = getPoolSummary(pool.id)
  const spent = summary?.spentThisMonth ?? 0
  const pct = pool.monthlyLimit > 0 ? Math.min(1, spent / pool.monthlyLimit) : 0

  return (
    <motion.div whileTap={{ scale: 0.98 }} transition={springs.snappy}>
      <GlassCard
        elevation="low"
        style={{ padding: "16px 18px", cursor: "pointer" }}
        onClick={onOpen}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }} aria-hidden="true">{pool.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
              {pool.name}
            </p>
            <p style={{ fontSize: 12, color: "var(--sub)" }}>
              {pool.members.length + 1} {pool.members.length === 0 ? "person" : "people"} · ${pool.monthlyLimit}/mo
            </p>
          </div>
          <span style={{ fontSize: 14, color: "var(--muted)" }} aria-hidden="true">→</span>
        </div>

        {/* Progress bar */}
        <div style={progressTrack}>
          <div
            style={{
              width: `${pct * 100}%`,
              height: "100%",
              borderRadius: 2,
              background: pct >= 0.9 ? "var(--warning)" : "var(--accent)",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 12, color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
            ${spent.toFixed(2)} spent
          </span>
          <span style={{ fontSize: 12, color: "var(--sub)", fontVariantNumeric: "tabular-nums" }}>
            ${Math.max(0, pool.monthlyLimit - spent).toFixed(2)} left
          </span>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// Create Pool View
// ============================================================================

function CreatePoolView({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("🏠")
  const [monthlyLimit, setMonthlyLimit] = useState("")

  const EMOJI_OPTIONS = ["🏠", "🛒", "💡", "🍕", "🚿", "📦", "🎮", "🧹"]

  const handleCreate = () => {
    const limit = parseFloat(monthlyLimit) || 0
    if (!name.trim() || limit <= 0) return
    createPool(name, emoji, limit)
    onCreated()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      <p style={{ fontSize: 14, color: "var(--sub)", lineHeight: 1.5 }}>
        Set up a shared budget for expenses you split with roommates. This stays
        completely separate from your personal daily number.
      </p>

      {/* Name */}
      <div>
        <p style={labelStyle}>Pool name</p>
        <input
          type="text"
          placeholder="e.g. Groceries, Utilities, Apartment"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          maxLength={40}
        />
      </div>

      {/* Emoji */}
      <div>
        <p style={labelStyle}>Icon</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {EMOJI_OPTIONS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              style={{
                width: 40,
                height: 40,
                fontSize: 20,
                borderRadius: borderRadius.sm,
                border: emoji === e ? "2px solid var(--accent)" : "1px solid var(--border)",
                background: emoji === e ? "rgba(129, 140, 248, 0.15)" : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
              aria-label={`Select ${e} icon`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Monthly limit */}
      <div>
        <p style={labelStyle}>Monthly budget</p>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0.00"
          value={monthlyLimit}
          onChange={(e) => setMonthlyLimit(e.target.value)}
          style={inputStyle}
          min="0"
        />
        <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
          How much the group plans to spend together each month.
        </p>
      </div>

      {/* Submit */}
      <button
        onClick={handleCreate}
        disabled={!name.trim() || !(parseFloat(monthlyLimit) > 0)}
        style={{
          ...primaryButton,
          opacity: !name.trim() || !(parseFloat(monthlyLimit) > 0) ? 0.5 : 1,
        }}
      >
        Create Pool
      </button>
    </motion.div>
  )
}

// ============================================================================
// Pool Detail View
// ============================================================================

function PoolDetailView({ poolId, onDeleted }: { poolId: string; onDeleted: () => void }) {
  const [pool, setPool] = useState<HouseholdPool | null>(null)
  const [summary, setSummary] = useState<HouseholdPoolSummary | null>(null)
  const [expenses, setExpenses] = useState<HouseholdPoolExpense[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    const p = getPool(poolId)
    setPool(p)
    setSummary(getPoolSummary(poolId))
    setExpenses(getPoolExpenses(poolId))
  }, [poolId])

  useEffect(() => {
    refresh()
  }, [refresh])

  if (!pool) return null

  const handleDelete = () => {
    deletePool(poolId)
    onDeleted()
  }

  const handleCopyLink = async () => {
    const url = getPoolShareUrl(pool.shareToken)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: no-op on older browsers
    }
  }

  const pct = pool.monthlyLimit > 0
    ? Math.min(1, (summary?.spentThisMonth ?? 0) / pool.monthlyLimit)
    : 0

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ display: "flex", flexDirection: "column", gap: 20 }}
    >
      {/* Pool header */}
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 40 }} aria-hidden="true">{pool.emoji}</span>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginTop: 8 }}>
          {pool.name}
        </h3>
        <p style={{ fontSize: 13, color: "var(--sub)", marginTop: 4 }}>
          ${pool.monthlyLimit}/month · {pool.members.length + 1} people
        </p>
      </div>

      {/* Summary card */}
      {summary && (
        <GlassCard elevation="low" style={{ padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 11, color: "var(--sub)" }}>Spent this month</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>
                ${summary.spentThisMonth.toFixed(2)}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "var(--sub)" }}>Remaining</p>
              <p style={{ fontSize: 22, fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>
                ${summary.remainingThisMonth.toFixed(2)}
              </p>
            </div>
          </div>
          <div style={progressTrack}>
            <div
              style={{
                width: `${pct * 100}%`,
                height: "100%",
                borderRadius: 2,
                background: pct >= 0.9 ? "var(--warning)" : "var(--accent)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
          {summary.expenseCount > 0 && (
            <p style={{ fontSize: 12, color: "var(--sub)", marginTop: 8 }}>
              {summary.expenseCount} expense{summary.expenseCount !== 1 ? "s" : ""} · ~${summary.perPersonShare.toFixed(2)}/person
            </p>
          )}
        </GlassCard>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setShowAddExpense(true)} style={secondaryButton}>
          + Log Expense
        </button>
        <button onClick={() => setShowAddMember(true)} style={secondaryButton}>
          + Add Member
        </button>
        <button onClick={() => setShowInvite(true)} style={secondaryButton}>
          🔗 Invite
        </button>
      </div>

      {/* Add Expense Form */}
      <AnimatePresence>
        {showAddExpense && (
          <AddExpenseForm
            poolId={poolId}
            members={pool.members}
            onDone={() => { setShowAddExpense(false); refresh() }}
          />
        )}
      </AnimatePresence>

      {/* Add Member Form */}
      <AnimatePresence>
        {showAddMember && (
          <AddMemberForm
            poolId={poolId}
            onDone={() => { setShowAddMember(false); refresh() }}
          />
        )}
      </AnimatePresence>

      {/* Invite Sheet */}
      <AnimatePresence>
        {showInvite && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <GlassCard elevation="low" style={{ padding: 16 }}>
              <p style={{ ...sectionHeadingStrong, marginBottom: 8 }}>Share this pool</p>
              <p style={{ fontSize: 13, color: "var(--sub)", marginBottom: 12, lineHeight: 1.4 }}>
                Send this link to your roommates so they can view and log expenses.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  readOnly
                  value={getPoolShareUrl(pool.shareToken)}
                  style={{ ...inputStyle, flex: 1, fontSize: 12 }}
                />
                <button
                  onClick={handleCopyLink}
                  style={{ ...secondaryButton, whiteSpace: "nowrap" }}
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setShowInvite(false)}
                style={{ ...secondaryButton, marginTop: 10, width: "100%" }}
              >
                Done
              </button>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members list */}
      <div>
        <p style={{ ...sectionHeadingStrong, marginBottom: 10 }}>Members</p>
        <GlassCard elevation="low" style={{ padding: "12px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 14, color: "var(--text)" }}>You</span>
            <span style={{ fontSize: 12, color: "var(--sub)" }}>Owner</span>
          </div>
          {pool.members.map((member) => (
            <div
              key={member.id}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", borderTop: "1px solid var(--border)" }}
            >
              <span style={{ fontSize: 14, color: "var(--text)" }}>{member.name}</span>
              <button
                onClick={() => { removeMember(poolId, member.id); refresh() }}
                style={{ background: "none", border: "none", fontSize: 12, color: "var(--muted)", cursor: "pointer" }}
                aria-label={`Remove ${member.name}`}
              >
                Remove
              </button>
            </div>
          ))}
        </GlassCard>
      </div>

      {/* Recent Expenses */}
      <div>
        <p style={{ ...sectionHeadingStrong, marginBottom: 10 }}>Recent Expenses</p>
        {expenses.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--sub)", textAlign: "center", padding: "20px 0" }}>
            No expenses logged yet. Tap &quot;Log Expense&quot; to get started!
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {expenses.slice(0, 20).map((exp) => (
              <GlassCard key={exp.id} elevation="low" style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>
                      ${exp.amount.toFixed(2)}
                      {exp.note && <span style={{ color: "var(--sub)", fontWeight: 400 }}> · {exp.note}</span>}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                      {exp.loggedBy} · {exp.category} · {exp.date}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      {/* Danger zone — delete pool */}
      <div style={{ marginTop: 20 }}>
        <button
          onClick={handleDelete}
          style={{
            ...secondaryButton,
            width: "100%",
            color: "var(--error)",
            borderColor: "rgba(248, 113, 113, 0.3)",
          }}
        >
          Delete Pool
        </button>
      </div>
    </motion.div>
  )
}

// ============================================================================
// Add Expense Form
// ============================================================================

function AddExpenseForm({
  poolId,
  members,
  onDone,
}: {
  poolId: string
  members: { id: string; name: string }[]
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("groceries")
  const [note, setNote] = useState("")
  const [loggedBy, setLoggedBy] = useState("Me")

  const CATEGORIES = ["groceries", "utilities", "cleaning", "household", "other"]

  const handleSubmit = () => {
    const val = parseFloat(amount)
    if (!val || val <= 0) return
    logPoolExpense(poolId, val, category, loggedBy, note || undefined)
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <GlassCard elevation="low" style={{ padding: 16 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 12 }}>Log a shared expense</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Amount */}
          <div>
            <p style={labelStyle}>Amount</p>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={inputStyle}
              min="0"
            />
          </div>

          {/* Category */}
          <div>
            <p style={labelStyle}>Category</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 99,
                    border: category === cat ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    background: category === cat ? "rgba(129, 140, 248, 0.15)" : "transparent",
                    color: category === cat ? "var(--accent)" : "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <p style={labelStyle}>Note (optional)</p>
            <input
              type="text"
              placeholder="e.g. Weekly shop at Costco"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              style={inputStyle}
              maxLength={80}
            />
          </div>

          {/* Logged by */}
          <div>
            <p style={labelStyle}>Logged by</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Me", ...members.map(m => m.name)].map((name) => (
                <button
                  key={name}
                  onClick={() => setLoggedBy(name)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    borderRadius: 99,
                    border: loggedBy === name ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                    background: loggedBy === name ? "rgba(129, 140, 248, 0.15)" : "transparent",
                    color: loggedBy === name ? "var(--accent)" : "var(--sub)",
                    fontFamily: FONT_FAMILY,
                    cursor: "pointer",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onDone} style={{ ...secondaryButton, flex: 1 }}>
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!(parseFloat(amount) > 0)}
              style={{
                ...primaryButton,
                flex: 1,
                opacity: !(parseFloat(amount) > 0) ? 0.5 : 1,
              }}
            >
              Log It
            </button>
          </div>
        </div>
      </GlassCard>
    </motion.div>
  )
}

// ============================================================================
// Add Member Form
// ============================================================================

function AddMemberForm({ poolId, onDone }: { poolId: string; onDone: () => void }) {
  const [name, setName] = useState("")

  const handleSubmit = () => {
    if (!name.trim()) return
    addMember(poolId, name)
    onDone()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <GlassCard elevation="low" style={{ padding: 16 }}>
        <p style={{ ...sectionHeadingStrong, marginBottom: 12 }}>Add a roommate</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Roommate's name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            maxLength={40}
          />
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            style={{
              ...primaryButton,
              width: "auto",
              padding: "10px 18px",
              opacity: !name.trim() ? 0.5 : 1,
            }}
          >
            Add
          </button>
        </div>
        <button
          onClick={onDone}
          style={{ ...secondaryButton, marginTop: 10, width: "100%" }}
        >
          Done
        </button>
      </GlassCard>
    </motion.div>
  )
}
