export type QuestionItem = {
  id: number
  prompt: string
  options: Record<string, string>
  sourcePages?: { question?: number }
  answer?: string
}

export type ExamBank = {
  exam: string
  items: QuestionItem[]
}
