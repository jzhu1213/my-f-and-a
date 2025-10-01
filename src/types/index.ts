export type UserType = 'personal' | 'small_business' | 'gig_worker'

export interface UserProfile {
  id: string
  email: string
  name: string
  userType: UserType
  badges: string[]
}

export type TransactionType = 'income' | 'expense'

export interface Transaction {
  id: string
  userId: string
  date: string
  amount: number
  type: TransactionType
  category: string
  note?: string
}

export interface Budget {
  id: string
  userId: string
  month: string // YYYY-MM
  incomeTarget: number
  expenseTarget: number
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface Invoice {
  id: string
  userId: string
  clientName: string
  clientEmail?: string
  date: string
  dueDate?: string
  items: InvoiceItem[]
  notes?: string
  status: 'draft' | 'sent' | 'paid'
}

export interface Post {
  id: string
  userId: string
  content: string
  createdAt: string
  likes: number
  likedBy: string[]
}

