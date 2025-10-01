import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, Transaction, Invoice, Post, Budget, UserType } from '@/types'
import { addMonths, format } from 'date-fns'

export interface AppState {
  currentUser: UserProfile | null
  users: Record<string, UserProfile>
  transactions: Transaction[]
  invoices: Invoice[]
  posts: Post[]
  budgets: Budget[]

  // auth
  signUp: (email: string, name: string, userType: UserType) => void
  login: (email: string) => void
  logout: () => void

  // transactions
  addTransaction: (t: Omit<Transaction, 'id' | 'userId' | 'category'> & { category?: string }) => void
  categorize: (note: string, type: 'income' | 'expense') => string

  // budgeting
  setBudget: (b: Omit<Budget, 'id' | 'userId'>) => void

  // invoices
  addInvoice: (invoice: Omit<Invoice, 'id' | 'userId' | 'status'> & { status?: Invoice['status'] }) => void
  setInvoiceStatus: (id: string, status: Invoice['status']) => void

  // posts
  addPost: (content: string) => void
  toggleLike: (postId: string) => void
  followUser: (userId: string) => void
}

function generateId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

export const useAppStore = create<AppState>()(persist((set, get) => ({
  currentUser: null,
  users: {},
  transactions: [],
  invoices: [],
  posts: [],
  budgets: [],

  signUp: (email, name, userType) => set((state) => {
    const id = generateId('usr')
    const profile: UserProfile = { id, email, name, userType, badges: [] }
    return { users: { ...state.users, [id]: profile }, currentUser: profile }
  }),

  login: (email) => set((state) => {
    const found = Object.values(state.users).find(u => u.email === email) || null
    return { currentUser: found }
  }),

  logout: () => set(() => ({ currentUser: null })),

  categorize: (note, type) => {
    const text = note.toLowerCase()
    const rules: { match: RegExp, category: string }[] = [
      { match: /(salary|payroll|wage|income)/, category: 'Income: Salary' },
      { match: /(invoice|client|project)/, category: 'Income: Client' },
      { match: /(grocer|supermarket|food|restaurant)/, category: 'Expense: Food' },
      { match: /(rent|mortgage)/, category: 'Expense: Housing' },
      { match: /(uber|lyft|transit|gas)/, category: 'Expense: Transport' },
      { match: /(tool|software|subscription)/, category: 'Expense: Tools' },
      { match: /(tax)/, category: 'Expense: Taxes' },
    ]
    const found = rules.find(r => r.match.test(text))
    if (found) return found.category
    return type === 'income' ? 'Income: Other' : 'Expense: Other'
  },

  addTransaction: (t) => set((state) => {
    if (!state.currentUser) return {}
    const category = t.category ?? get().categorize(t.note ?? '', t.type)
    const tx: Transaction = { id: generateId('tx'), userId: state.currentUser.id, category, ...t }
    // badge: first 10 expenses
    const expenseCount = [...state.transactions, tx].filter(x => x.userId === state.currentUser!.id && x.type === 'expense').length
    const newUsers = { ...state.users }
    if (expenseCount === 10) {
      newUsers[state.currentUser.id] = { ...state.currentUser, badges: [...state.currentUser.badges, 'Expense Apprentice'] }
    }
    return { transactions: [tx, ...state.transactions], users: newUsers, currentUser: newUsers[state.currentUser.id] || state.currentUser }
  }),

  setBudget: (b) => set((state) => {
    if (!state.currentUser) return {}
    const month = b.month || format(new Date(), 'yyyy-MM')
    const existing = state.budgets.filter(x => !(x.userId === state.currentUser!.id && x.month === month))
    const budget: Budget = { id: generateId('bdg'), userId: state.currentUser.id, month, incomeTarget: b.incomeTarget, expenseTarget: b.expenseTarget }
    return { budgets: [budget, ...existing] }
  }),

  addInvoice: (invoice) => set((state) => {
    if (!state.currentUser) return {}
    const inv: Invoice = { id: generateId('inv'), userId: state.currentUser.id, status: invoice.status ?? 'draft', ...invoice }
    return { invoices: [inv, ...state.invoices] }
  }),

  setInvoiceStatus: (id, status) => set((state) => ({
    invoices: state.invoices.map(i => i.id === id ? { ...i, status } : i)
  })),

  addPost: (content) => set((state) => {
    if (!state.currentUser) return {}
    const post: Post = { id: generateId('pst'), userId: state.currentUser.id, content, createdAt: new Date().toISOString(), likes: 0, likedBy: [] }
    return { posts: [post, ...state.posts] }
  }),

  toggleLike: (postId) => set((state) => {
    if (!state.currentUser) return {}
    const uid = state.currentUser.id
    return {
      posts: state.posts.map(p => p.id === postId ? (
        p.likedBy.includes(uid)
          ? { ...p, likedBy: p.likedBy.filter(x => x !== uid), likes: Math.max(0, p.likes - 1) }
          : { ...p, likedBy: [...p.likedBy, uid], likes: p.likes + 1 }
      ) : p)
    }
  }),

  followUser: (_userId) => {
    // placeholder for future social graph
  },
}), { name: 'myf-and-a' }))

export function currentMonthString(offset = 0) {
  return format(addMonths(new Date(), offset), 'yyyy-MM')
}

